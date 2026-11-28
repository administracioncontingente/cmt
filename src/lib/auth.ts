import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { prisma } from './prisma';
import { getJwtSecret } from './jwtConfig';

export const SESSION_COOKIE_NAME = 'agsch_session';
export const ACTIVE_EVENT_COOKIE = 'agsch_active_event_id';

export const ALLOWED_EVENT_ROLES = [
  'EVENT_ADMIN',
  'TREASURER',
  'COORDINATOR',
  'MEDICAL_STAFF',
  'VIEWER',
] as const;

export type AllowedEventRole = (typeof ALLOWED_EVENT_ROLES)[number];

/** Type guard verifying that a string is a supported event membership role. */
export function isValidEventRole(role: string): role is AllowedEventRole {
  return (ALLOWED_EVENT_ROLES as readonly string[]).includes(role);
}

export interface EventRoleInfo {
  eventId: string;
  eventCode: string;
  eventName: string;
  shortName?: string | null;
  flagEmoji?: string | null;
  role: string; // EVENT_ADMIN, TREASURER, COORDINATOR, MEDICAL_STAFF, VIEWER
  title?: string | null;
}

export interface UserSession {
  id: string;
  email: string;
  name: string;
  role: string; // SUPER_ADMIN, ADMIN, USER
  eventRoles?: EventRoleInfo[];
}

export async function createSessionToken(payload: UserSession): Promise<string> {
  return await new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(getJwtSecret());
}

export async function verifySessionToken(token: string): Promise<UserSession | null> {
  try {
    const { payload } = await jwtVerify(token, getJwtSecret());
    return {
      id: payload.id as string,
      email: payload.email as string,
      name: payload.name as string,
      role: payload.role as string,
      eventRoles: (payload.eventRoles as EventRoleInfo[]) || [],
    };
  } catch {
    return null;
  }
}

export async function getCurrentUser(): Promise<UserSession | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;

  const session = await verifySessionToken(token);
  if (!session) return null;

  // Refresh roles from database to keep permissions always up to date
  try {
    const dbUser = await prisma.user.findUnique({
      where: { id: session.id },
      include: {
        memberships: {
          include: {
            event: {
              select: {
                id: true,
                code: true,
                name: true,
                shortName: true,
                flagEmoji: true,
              },
            },
          },
        },
      },
    });

    if (!dbUser) return null;

    const eventRoles: EventRoleInfo[] = dbUser.memberships.map((m) => ({
      eventId: m.eventId,
      eventCode: m.event.code,
      eventName: m.event.name,
      shortName: m.event.shortName,
      flagEmoji: m.event.flagEmoji,
      role: m.role,
      title: m.title,
    }));

    return {
      id: dbUser.id,
      email: dbUser.email,
      name: dbUser.name,
      role: dbUser.role,
      eventRoles,
    };
  } catch {
    return session;
  }
}

/**
 * Obtiene el ID del evento activo según la cookie del navegador o el evento por defecto
 */
export async function getActiveEventId(): Promise<string | null> {
  const cookieStore = await cookies();
  const activeFromCookie = cookieStore.get(ACTIVE_EVENT_COOKIE)?.value;
  if (activeFromCookie) {
    const exists = await prisma.event.findUnique({
      where: { id: activeFromCookie },
      select: { id: true },
    });
    if (exists) return exists.id;
  }

  // Buscar evento por defecto
  const defaultEvent = await prisma.event.findFirst({
    where: { isDefault: true, isActive: true },
    select: { id: true },
  });

  if (defaultEvent) return defaultEvent.id;

  // Cualquier evento activo
  const anyEvent = await prisma.event.findFirst({
    where: { isActive: true },
    select: { id: true },
  });

  return anyEvent?.id || null;
}

/**
 * Evalúa los permisos granulares del usuario para un evento específico
 */
export function getEventPermissions(user: UserSession, eventId: string) {
  const isSuperAdmin = user.role === 'SUPER_ADMIN';
  const membership = user.eventRoles?.find((r) => r.eventId === eventId);
  const eventRole = membership?.role;

  const isEventAdmin = isSuperAdmin || eventRole === 'EVENT_ADMIN';
  const canManageFinance = isSuperAdmin || eventRole === 'EVENT_ADMIN' || eventRole === 'TREASURER';
  const canManageMedical = isSuperAdmin || eventRole === 'EVENT_ADMIN' || eventRole === 'MEDICAL_STAFF';
  const canEditParticipants = isSuperAdmin || eventRole === 'EVENT_ADMIN' || eventRole === 'COORDINATOR';
  const canManageCrm = isSuperAdmin || (Boolean(membership) && eventRole !== 'VIEWER');
  const canManageDocuments = isSuperAdmin || (Boolean(membership) && eventRole !== 'VIEWER');
  const canManageEventPage = isSuperAdmin || eventRole === 'EVENT_ADMIN' || eventRole === 'COORDINATOR';
  const canDeleteParticipants = isEventAdmin;
  const canView = isSuperAdmin || Boolean(membership);

  return {
    isSuperAdmin,
    isEventAdmin,
    canManageFinance,
    canManageMedical,
    canEditParticipants,
    canManageCrm,
    canManageDocuments,
    canManageEventPage,
    canDeleteParticipants,
    canView,
    role: isSuperAdmin ? 'SUPER_ADMIN' : eventRole || 'NONE',
    title: membership?.title || (isSuperAdmin ? 'Administrador Global' : 'Sin rol'),
  };
}

/**
 * Resolves an authorized active event ID for the given user.
 * When requestedEventId is provided, verifies access and flags forbidden=true if unauthorized.
 */
export async function resolveAuthorizedEventId(
  user: UserSession,
  requestedEventId?: string | null
): Promise<{ eventId: string | null; forbidden: boolean }> {
  const isSuperAdmin = user.role === 'SUPER_ADMIN';

  if (requestedEventId) {
    if (!isSuperAdmin && !getEventPermissions(user, requestedEventId).canView) {
      return { eventId: null, forbidden: true };
    }

    const event = await prisma.event.findUnique({
      where: { id: requestedEventId },
      select: { id: true },
    });

    if (!event) {
      return { eventId: null, forbidden: false };
    }

    if (!getEventPermissions(user, event.id).canView) {
      return { eventId: null, forbidden: true };
    }

    return { eventId: event.id, forbidden: false };
  }

  const cookieStore = await cookies();
  const activeFromCookie = cookieStore.get(ACTIVE_EVENT_COOKIE)?.value;
  if (activeFromCookie) {
    const cookieEvent = await prisma.event.findFirst({
      where: { id: activeFromCookie, isActive: true },
      select: { id: true },
    });
    if (cookieEvent && getEventPermissions(user, cookieEvent.id).canView) {
      return { eventId: cookieEvent.id, forbidden: false };
    }
  }

  const allowedEventIds = (user.eventRoles || []).map((r) => r.eventId);
  if (!isSuperAdmin && allowedEventIds.length === 0) {
    return { eventId: null, forbidden: false };
  }

  const defaultEvent = await prisma.event.findFirst({
    where: {
      isDefault: true,
      isActive: true,
      ...(isSuperAdmin ? {} : { id: { in: allowedEventIds } }),
    },
    select: { id: true },
  });

  if (defaultEvent && getEventPermissions(user, defaultEvent.id).canView) {
    return { eventId: defaultEvent.id, forbidden: false };
  }

  const fallbackEvent = await prisma.event.findFirst({
    where: {
      isActive: true,
      ...(isSuperAdmin ? {} : { id: { in: allowedEventIds } }),
    },
    orderBy: [{ isDefault: 'desc' }, { startDate: 'asc' }],
    select: { id: true },
  });

  return { eventId: fallbackEvent?.id || null, forbidden: false };
}
