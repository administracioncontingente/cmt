import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser, getActiveEventId } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  try {
    const isSuperAdmin = user.role === 'SUPER_ADMIN';
    const activeEventId = await getActiveEventId();

    // Si es SUPER_ADMIN ve todos los eventos, si no, solo en los que tiene membresía
    let events = [];
    if (isSuperAdmin) {
      events = await prisma.event.findMany({
        where: { isActive: true },
        orderBy: [{ isDefault: 'desc' }, { startDate: 'asc' }],
        include: {
          _count: {
            select: {
              participants: true,
              memberships: true,
              plans: true,
            },
          },
        },
      });
    } else {
      const userMemberships = await prisma.eventMembership.findMany({
        where: { userId: user.id },
        select: { eventId: true },
      });
      const allowedEventIds = userMemberships.map((m) => m.eventId);

      events = await prisma.event.findMany({
        where: {
          id: { in: allowedEventIds },
          isActive: true,
        },
        orderBy: [{ isDefault: 'desc' }, { startDate: 'asc' }],
        include: {
          _count: {
            select: {
              participants: true,
              memberships: true,
              plans: true,
            },
          },
        },
      });
    }

    const eventsWithRoles = events.map((ev) => {
      const membership = user.eventRoles?.find((r) => r.eventId === ev.id);
      return {
        ...ev,
        userRole: isSuperAdmin ? 'SUPER_ADMIN' : membership?.role || 'VIEWER',
        userTitle: isSuperAdmin ? 'Administrador Global' : membership?.title || 'Miembro',
        isActiveSelection: ev.id === activeEventId,
      };
    });

    return NextResponse.json({
      events: eventsWithRoles,
      activeEventId,
      isSuperAdmin,
    });
  } catch (error: any) {
    console.error('Error fetching events:', error);
    return NextResponse.json(
      { error: 'Error al obtener eventos: ' + error.message },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== 'SUPER_ADMIN') {
    return NextResponse.json(
      { error: 'Solo los administradores globales (SUPER_ADMIN) pueden crear nuevos eventos.' },
      { status: 403 }
    );
  }

  try {
    const body = await req.json();
    const {
      code,
      name,
      shortName,
      type,
      description,
      country,
      city,
      flagEmoji,
      startDate,
      endDate,
      currency,
      themeColor,
      accentColor,
    } = body;

    if (!code || !name) {
      return NextResponse.json(
        { error: 'Código y nombre del evento requeridos' },
        { status: 400 }
      );
    }

    const cleanCode = code.trim().toUpperCase();

    const existing = await prisma.event.findUnique({
      where: { code: cleanCode },
    });

    if (existing) {
      return NextResponse.json(
        { error: `El código de evento "${cleanCode}" ya está en uso.` },
        { status: 400 }
      );
    }

    const newEvent = await prisma.event.create({
      data: {
        code: cleanCode,
        name: name.trim(),
        shortName: shortName?.trim() || name.trim(),
        type: type || 'JAMBOREE_MUNDIAL',
        description: description?.trim() || null,
        country: country?.trim() || null,
        city: city?.trim() || null,
        flagEmoji: flagEmoji?.trim() || '🏕️',
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
        currency: currency?.toUpperCase() || 'USD',
        themeColor: themeColor || '#001558',
        accentColor: accentColor || '#FEB135',
        isActive: true,
        // Auto-asignar al creador como EVENT_ADMIN
        memberships: {
          create: {
            userId: user.id,
            role: 'EVENT_ADMIN',
            title: 'Creador del Evento',
          },
        },
      },
    });

    return NextResponse.json({
      message: 'Evento creado exitosamente',
      event: newEvent,
    });
  } catch (error: any) {
    console.error('Error creating event:', error);
    return NextResponse.json(
      { error: 'Error al crear evento: ' + error.message },
      { status: 500 }
    );
  }
}
