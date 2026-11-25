import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { getCurrentUser, getEventPermissions } from '@/lib/auth';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const { id: eventId } = await params;
  const permissions = getEventPermissions(user, eventId);

  if (!permissions.canView) {
    return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 });
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
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
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
    const body = await req.json();
    const { email, name, role, title, password } = body;

    if (!email || !role) {
      return NextResponse.json(
        { error: 'Email y rol requeridos' },
        { status: 400 }
      );
    }

    const cleanEmail = email.toLowerCase().trim();

    // Buscar o crear usuario
    let targetUser = await prisma.user.findUnique({
      where: { email: cleanEmail },
    });

    if (!targetUser) {
      const defaultPass = password || 'admin123';
      const hash = await bcrypt.hash(defaultPass, 10);
      targetUser = await prisma.user.create({
        data: {
          email: cleanEmail,
          name: name?.trim() || cleanEmail.split('@')[0],
          passwordHash: hash,
          role: 'USER',
        },
      });
    }

    // Upsert membresía
    const membership = await prisma.eventMembership.upsert({
      where: {
        userId_eventId: {
          userId: targetUser.id,
          eventId,
        },
      },
      update: {
        role,
        title: title?.trim() || null,
      },
      create: {
        userId: targetUser.id,
        eventId,
        role,
        title: title?.trim() || null,
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
  } catch (error: any) {
    console.error('Error assigning team member:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
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

    await prisma.eventMembership.deleteMany({
      where: {
        userId,
        eventId,
      },
    });

    return NextResponse.json({ message: 'Miembro removido del evento exitosamente' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
