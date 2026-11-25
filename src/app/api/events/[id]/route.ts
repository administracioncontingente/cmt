import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser, getEventPermissions, ACTIVE_EVENT_COOKIE } from '@/lib/auth';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const { id } = await params;

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

    const permissions = getEventPermissions(user, event.id);
    if (!permissions.canView) {
      return NextResponse.json({ error: 'No tienes acceso a este evento' }, { status: 403 });
    }

    return NextResponse.json({
      event,
      permissions,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
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
    const body = await req.json();
    const updated = await prisma.event.update({
      where: { id },
      data: {
        name: body.name,
        shortName: body.shortName,
        type: body.type,
        description: body.description,
        country: body.country,
        city: body.city,
        flagEmoji: body.flagEmoji,
        startDate: body.startDate ? new Date(body.startDate) : undefined,
        endDate: body.endDate ? new Date(body.endDate) : undefined,
        currency: body.currency,
        isActive: body.isActive !== undefined ? body.isActive : undefined,
        themeColor: body.themeColor,
        accentColor: body.accentColor,
      },
    });

    return NextResponse.json({
      message: 'Evento actualizado exitosamente',
      event: updated,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST /api/events/[id]/select -> Establece este evento como activo en las cookies
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const { id } = await params;

  try {
    const event = await prisma.event.findUnique({
      where: { id },
      select: { id: true, name: true, code: true },
    });

    if (!event) {
      return NextResponse.json({ error: 'Evento no encontrado' }, { status: 404 });
    }

    const permissions = getEventPermissions(user, event.id);
    if (!permissions.canView) {
      return NextResponse.json({ error: 'No tienes permiso para acceder a este evento' }, { status: 403 });
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
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
