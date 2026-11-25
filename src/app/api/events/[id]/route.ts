import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser, getEventPermissions, ACTIVE_EVENT_COOKIE } from '@/lib/auth';
import { apiErrorResponse, parseOptionalDate } from '@/lib/apiUtils';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const { id } = await params;
  const permissions = getEventPermissions(user, id);
  if (!permissions.canView) {
    return NextResponse.json({ error: 'No tienes acceso a este evento' }, { status: 403 });
  }

  try {
    const event = await prisma.event.findUnique({
      where: { id },
      include: {
        plans: {
          include: {
            installments: true,
          },
        },
        memberships: {
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
        },
        _count: {
          select: {
            participants: true,
          },
        },
      },
    });

    if (!event) {
      return NextResponse.json({ error: 'Evento no encontrado' }, { status: 404 });
    }

    return NextResponse.json({
      event,
      permissions,
    });
  } catch (error: unknown) {
    return apiErrorResponse(error, 'Error al obtener el evento', 500);
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const { id } = await params;
  const permissions = getEventPermissions(user, id);

  if (!permissions.isEventAdmin) {
    return NextResponse.json(
      { error: 'No tienes permisos de administración en este evento.' },
      { status: 403 }
    );
  }

  try {
    const body = (await req.json()) as Record<string, unknown>;

    let startDateUpdate: Date | null | undefined = undefined;
    if (body.startDate !== undefined) {
      if (body.startDate === null || body.startDate === '') {
        startDateUpdate = null;
      } else {
        const parsed = parseOptionalDate(body.startDate);
        if (!parsed) {
          return NextResponse.json({ error: 'Fecha de inicio inválida' }, { status: 400 });
        }
        startDateUpdate = parsed;
      }
    }

    let endDateUpdate: Date | null | undefined = undefined;
    if (body.endDate !== undefined) {
      if (body.endDate === null || body.endDate === '') {
        endDateUpdate = null;
      } else {
        const parsed = parseOptionalDate(body.endDate);
        if (!parsed) {
          return NextResponse.json({ error: 'Fecha de término inválida' }, { status: 400 });
        }
        endDateUpdate = parsed;
      }
    }

    if (body.name !== undefined && (typeof body.name !== 'string' || !body.name.trim())) {
      return NextResponse.json({ error: 'El nombre del evento no puede estar vacío' }, { status: 400 });
    }

    const updated = await prisma.event.update({
      where: { id },
      data: {
        name: typeof body.name === 'string' ? body.name.trim() : undefined,
        shortName: typeof body.shortName === 'string' ? body.shortName.trim() : body.shortName === null ? null : undefined,
        type: typeof body.type === 'string' ? body.type.trim() : undefined,
        description: typeof body.description === 'string' ? body.description.trim() : body.description === null ? null : undefined,
        country: typeof body.country === 'string' ? body.country.trim() : body.country === null ? null : undefined,
        city: typeof body.city === 'string' ? body.city.trim() : body.city === null ? null : undefined,
        flagEmoji: typeof body.flagEmoji === 'string' ? body.flagEmoji.trim() : body.flagEmoji === null ? null : undefined,
        startDate: startDateUpdate,
        endDate: endDateUpdate,
        currency: typeof body.currency === 'string' && body.currency.trim() ? body.currency.trim().toUpperCase() : undefined,
        isActive: typeof body.isActive === 'boolean' ? body.isActive : undefined,
        themeColor: typeof body.themeColor === 'string' ? body.themeColor.trim() : body.themeColor === null ? null : undefined,
        accentColor: typeof body.accentColor === 'string' ? body.accentColor.trim() : body.accentColor === null ? null : undefined,
      },
    });

    return NextResponse.json({
      message: 'Evento actualizado exitosamente',
      event: updated,
    });
  } catch (error: unknown) {
    return apiErrorResponse(error, 'Error al actualizar el evento', 500);
  }
}

// POST /api/events/[id]/select -> Establece este evento como activo en las cookies
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const { id } = await params;
  const permissions = getEventPermissions(user, id);
  if (!permissions.canView) {
    return NextResponse.json({ error: 'No tienes acceso a este evento' }, { status: 403 });
  }

  try {
    const event = await prisma.event.findUnique({
      where: { id },
      select: { id: true, name: true, code: true },
    });

    if (!event) {
      return NextResponse.json({ error: 'Evento no encontrado' }, { status: 404 });
    }

    const response = NextResponse.json({
      success: true,
      activeEvent: event,
    });

    response.cookies.set(ACTIVE_EVENT_COOKIE, event.id, {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 30, // 30 days
    });

    return response;
  } catch (error: unknown) {
    return apiErrorResponse(error, 'Error al seleccionar el evento', 500);
  }
}
