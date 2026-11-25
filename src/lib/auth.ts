import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { prisma } from './prisma';

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'agsch-jamboree-poland-2027-super-secret-key-32chars!'
);

export const SESSION_COOKIE_NAME = 'agsch_session';
export const ACTIVE_EVENT_COOKIE = 'agsch_active_event_id';

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
    .sign(JWT_SECRET);
}

export async function verifySessionToken(token: string): Promise<UserSession | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
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
  const canView = isSuperAdmin || Boolean(membership);

  return {
    isSuperAdmin,
    isEventAdmin,
    canManageFinance,
    canManageMedical,
    canEditParticipants,
    canView,
    role: isSuperAdmin ? 'SUPER_ADMIN' : eventRole || 'NONE',
    title: membership?.title || (isSuperAdmin ? 'Administrador Global' : 'Sin rol'),
  };
}
