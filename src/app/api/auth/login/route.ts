import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { createSessionToken, SESSION_COOKIE_NAME, ACTIVE_EVENT_COOKIE, EventRoleInfo } from '@/lib/auth';
import { apiErrorResponse } from '@/lib/apiUtils';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, password } = body as { email?: unknown; password?: unknown };

    if (
      typeof email !== 'string' ||
      typeof password !== 'string' ||
      !email.trim() ||
      !password
    ) {
      return NextResponse.json(
        { error: 'Email y contraseña requeridos' },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
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

    if (!user) {
      return NextResponse.json(
        { error: 'Credenciales inválidas' },
        { status: 401 }
      );
    }

    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      return NextResponse.json(
        { error: 'Credenciales inválidas' },
        { status: 401 }
      );
    }

    const eventRoles: EventRoleInfo[] = user.memberships.map((m) => ({
      eventId: m.eventId,
      eventCode: m.event.code,
      eventName: m.event.name,
      shortName: m.event.shortName,
      flagEmoji: m.event.flagEmoji,
      role: m.role,
      title: m.title,
    }));

    const token = await createSessionToken({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      eventRoles,
    });

    const response = NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        eventRoles,
      },
    });

    response.cookies.set(SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7, // 7 days
    });

    // Establecer evento activo por defecto si tiene alguno asignado o el default (para SUPER_ADMIN)
    let defaultEventId: string | null = user.memberships[0]?.eventId || null;
    if (!defaultEventId && user.role === 'SUPER_ADMIN') {
      const defaultEv = await prisma.event.findFirst({
        where: { isDefault: true, isActive: true },
        select: { id: true },
      });
      defaultEventId = defaultEv?.id || null;
    }

    if (defaultEventId) {
      response.cookies.set(ACTIVE_EVENT_COOKIE, defaultEventId, {
        httpOnly: false,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 60 * 60 * 24 * 30, // 30 days
      });
    }

    return response;
  } catch (error: unknown) {
    return apiErrorResponse(error, 'Error de servidor', 500);
  }
}
