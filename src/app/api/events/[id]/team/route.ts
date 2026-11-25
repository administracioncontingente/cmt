import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { getCurrentUser, getEventPermissions, isValidEventRole } from '@/lib/auth';
import { apiErrorResponse } from '@/lib/apiUtils';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const { id: eventId } = await params;
  const permissions = getEventPermissions(user, eventId);

  if (!permissions.canView) {
    return NextResponse.json({ error: 'No tienes acceso a este evento' }, { status: 403 });
  }

  try {
    const memberships = await prisma.eventMembership.findMany({
      where: { eventId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    return NextResponse.json({
      members: memberships,
      canManageTeam: permissions.isEventAdmin,
    });
  } catch (error: unknown) {
    return apiErrorResponse(error, 'Error al obtener el equipo del evento', 500);
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const { id: eventId } = await params;
  const permissions = getEventPermissions(user, eventId);

  if (!permissions.isEventAdmin) {
    return NextResponse.json(
      { error: 'Solo los administradores del evento o súper administradores pueden gestionar el equipo.' },
      { status: 403 }
    );
  }

  try {
    const body = (await req.json()) as Record<string, unknown>;
    const { email, name, role, title, password } = body;

    if (typeof email !== 'string' || typeof role !== 'string' || !email.trim() || !role.trim()) {
      return NextResponse.json(
        { error: 'Email y rol requeridos' },
        { status: 400 }
      );
    }

    const normalizedRole = role.trim().toUpperCase();
    if (!isValidEventRole(normalizedRole)) {
      return NextResponse.json(
        { error: 'Rol de evento inválido' },
        { status: 400 }
      );
    }

    const event = await prisma.event.findUnique({
      where: { id: eventId },
      select: { id: true },
    });
    if (!event) {
      return NextResponse.json({ error: 'Evento no encontrado' }, { status: 404 });
    }

    const cleanEmail = email.toLowerCase().trim();

    // Buscar o crear usuario
    let targetUser = await prisma.user.findUnique({
      where: { email: cleanEmail },
    });

    if (!targetUser) {
      if (typeof password !== 'string' || password.trim().length < 6) {
        return NextResponse.json(
          { error: 'Para usuarios nuevos, la contraseña es obligatoria y debe tener al menos 6 caracteres' },
          { status: 400 }
        );
      }

      const hash = await bcrypt.hash(password, 10);
      targetUser = await prisma.user.create({
        data: {
          email: cleanEmail,
          name: typeof name === 'string' && name.trim() ? name.trim() : cleanEmail.split('@')[0],
          passwordHash: hash,
          role: 'USER',
        },
      });
    }

    const cleanTitle = typeof title === 'string' && title.trim() ? title.trim() : null;

    // Upsert membresía
    const membership = await prisma.eventMembership.upsert({
      where: {
        userId_eventId: {
          userId: targetUser.id,
          eventId,
        },
      },
      update: {
        role: normalizedRole,
        title: cleanTitle,
      },
      create: {
        userId: targetUser.id,
        eventId,
        role: normalizedRole,
        title: cleanTitle,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
      },
    });

    return NextResponse.json({
      message: 'Miembro asignado exitosamente',
      membership,
    });
  } catch (error: unknown) {
    return apiErrorResponse(error, 'Error al asignar miembro al equipo', 500);
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const { id: eventId } = await params;
  const permissions = getEventPermissions(user, eventId);

  if (!permissions.isEventAdmin) {
    return NextResponse.json(
      { error: 'No tienes permisos para remover miembros de este evento.' },
      { status: 403 }
    );
  }

  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ error: 'ID de usuario requerido' }, { status: 400 });
    }

    if (userId === user.id) {
      return NextResponse.json(
        { error: 'No puedes removerte a ti mismo del equipo del evento.' },
        { status: 400 }
      );
    }

    await prisma.eventMembership.deleteMany({
      where: {
        userId,
        eventId,
      },
    });

    return NextResponse.json({ message: 'Miembro removido del evento exitosamente' });
  } catch (error: unknown) {
    return apiErrorResponse(error, 'Error al remover miembro del evento', 500);
  }
}
