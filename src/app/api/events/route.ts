import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser, resolveAuthorizedEventId } from '@/lib/auth';
import { apiErrorResponse, parseOptionalDate } from '@/lib/apiUtils';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  try {
    const isSuperAdmin = user.role === 'SUPER_ADMIN';
    const { eventId: activeEventId } = await resolveAuthorizedEventId(user);

    // Si es SUPER_ADMIN ve todos los eventos, si no, solo en los que tiene membresía
    const allowedEventIds = isSuperAdmin
      ? []
      : (
          await prisma.eventMembership.findMany({
            where: { userId: user.id },
            select: { eventId: true },
          })
        ).map((m) => m.eventId);

    const events = await prisma.event.findMany({
      where: {
        isActive: true,
        ...(isSuperAdmin ? {} : { id: { in: allowedEventIds } }),
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
  } catch (error: unknown) {
    return apiErrorResponse(error, 'Error al obtener eventos', 500);
  }
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }
  if (user.role !== 'SUPER_ADMIN') {
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
    } = body as Record<string, unknown>;

    if (typeof code !== 'string' || typeof name !== 'string' || !code.trim() || !name.trim()) {
      return NextResponse.json(
        { error: 'Código y nombre del evento requeridos' },
        { status: 400 }
      );
    }

    let parsedStartDate: Date | null = null;
    if (startDate !== undefined && startDate !== null && startDate !== '') {
      parsedStartDate = parseOptionalDate(startDate);
      if (!parsedStartDate) {
        return NextResponse.json({ error: 'Fecha de inicio inválida' }, { status: 400 });
      }
    }

    let parsedEndDate: Date | null = null;
    if (endDate !== undefined && endDate !== null && endDate !== '') {
      parsedEndDate = parseOptionalDate(endDate);
      if (!parsedEndDate) {
        return NextResponse.json({ error: 'Fecha de término inválida' }, { status: 400 });
      }
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
        shortName: typeof shortName === 'string' && shortName.trim() ? shortName.trim() : name.trim(),
        type: typeof type === 'string' && type.trim() ? type.trim() : 'JAMBOREE_MUNDIAL',
        description: typeof description === 'string' && description.trim() ? description.trim() : null,
        country: typeof country === 'string' && country.trim() ? country.trim() : null,
        city: typeof city === 'string' && city.trim() ? city.trim() : null,
        flagEmoji: typeof flagEmoji === 'string' && flagEmoji.trim() ? flagEmoji.trim() : '🏕️',
        startDate: parsedStartDate,
        endDate: parsedEndDate,
        currency: typeof currency === 'string' && currency.trim() ? currency.trim().toUpperCase() : 'USD',
        themeColor: typeof themeColor === 'string' && themeColor.trim() ? themeColor.trim() : '#001558',
        accentColor: typeof accentColor === 'string' && accentColor.trim() ? accentColor.trim() : '#FEB135',
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
  } catch (error: unknown) {
    return apiErrorResponse(error, 'Error al crear evento', 500);
  }
}
