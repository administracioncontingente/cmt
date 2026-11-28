import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import {
  getCurrentUser,
  getEventPermissions,
  resolveAuthorizedEventId,
} from '@/lib/auth';
import { seedSampleInboxMessages } from '@/lib/inboxSync';
import { syncGoogleInboxForEvent } from '@/lib/googleWorkspace';
import { apiErrorResponse } from '@/lib/apiUtils';

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const paramEventId = searchParams.get('eventId');
    const { eventId: activeEventId, forbidden } = await resolveAuthorizedEventId(
      user,
      paramEventId
    );

    if (forbidden) {
      return NextResponse.json(
        { error: 'No tienes acceso al evento solicitado' },
        { status: 403 }
      );
    }

    if (!activeEventId) {
      return NextResponse.json({
        messages: [],
        count: 0,
        metrics: { total: 0, associated: 0, unassociated: 0, tickets: 0 },
      });
    }

    if (!getEventPermissions(user, activeEventId).canView) {
      return NextResponse.json(
        { error: 'No tienes permisos para ver el inbox de este evento' },
        { status: 403 }
      );
    }

    const participantId = searchParams.get('participantId');
    const filter = searchParams.get('filter'); // 'all', 'associated', 'unassociated', 'tickets'
    const search = searchParams.get('search')?.trim().toLowerCase() || '';

    const where: Prisma.EmailMessageWhereInput = { eventId: activeEventId };

    if (participantId) {
      where.participantId = participantId;
    } else if (filter === 'associated') {
      where.participantId = { not: null };
    } else if (filter === 'unassociated') {
      where.participantId = null;
    } else if (filter === 'tickets') {
      where.ticketId = { not: null };
    }

    if (search) {
      where.OR = [
        { subject: { contains: search, mode: 'insensitive' } },
        { senderEmail: { contains: search, mode: 'insensitive' } },
        { senderName: { contains: search, mode: 'insensitive' } },
        { snippet: { contains: search, mode: 'insensitive' } },
        { bodyText: { contains: search, mode: 'insensitive' } },
        {
          participant: {
            OR: [
              { firstName: { contains: search, mode: 'insensitive' } },
              { lastName: { contains: search, mode: 'insensitive' } },
              { rut: { contains: search, mode: 'insensitive' } },
            ],
          },
        },
      ];
    }

    const messages = await prisma.emailMessage.findMany({
      where,
      orderBy: { date: 'desc' },
      include: {
        participant: {
          select: {
            id: true,
            rut: true,
            firstName: true,
            lastName: true,
            contingentRole: true,
            unitName: true,
            cupoCode: true,
          },
        },
        ticket: {
          select: {
            id: true,
            ticketNumber: true,
            title: true,
            status: true,
            priority: true,
            category: true,
          },
        },
      },
    });

    const [totalCount, associatedCount, ticketCount] = await Promise.all([
      prisma.emailMessage.count({ where: { eventId: activeEventId } }),
      prisma.emailMessage.count({
        where: { eventId: activeEventId, participantId: { not: null } },
      }),
      prisma.emailMessage.count({
        where: { eventId: activeEventId, ticketId: { not: null } },
      }),
    ]);

    return NextResponse.json({
      messages,
      metrics: {
        total: totalCount,
        associated: associatedCount,
        unassociated: totalCount - associatedCount,
        tickets: ticketCount,
      },
    });
  } catch (error: unknown) {
    return apiErrorResponse(error, 'Error al obtener mensajes del inbox');
  }
}

// POST /api/inbox -> Sincronizar o inyectar correos
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  try {
    const body = (await req.json().catch(() => ({}))) as {
      eventId?: unknown;
      mode?: unknown;
    };
    const paramEventId =
      typeof body.eventId === 'string' && body.eventId.trim()
        ? body.eventId.trim()
        : undefined;
    const requestedMode =
      typeof body.mode === 'string' ? body.mode.trim().toLowerCase() : 'auto';

    const { eventId: activeEventId, forbidden } = await resolveAuthorizedEventId(
      user,
      paramEventId
    );

    if (forbidden) {
      return NextResponse.json(
        { error: 'No tienes acceso al evento solicitado' },
        { status: 403 }
      );
    }

    if (!activeEventId) {
      return NextResponse.json(
        { error: 'No hay evento activo seleccionado' },
        { status: 400 }
      );
    }

    if (!getEventPermissions(user, activeEventId).canManageCrm) {
      return NextResponse.json(
        { error: 'No tienes permisos para sincronizar el inbox en este evento' },
        { status: 403 }
      );
    }

    if (requestedMode === 'sample') {
      const synced = await seedSampleInboxMessages(activeEventId);
      return NextResponse.json({
        mode: 'sample',
        message: `Muestra cargada. ${synced.length} correos de ejemplo procesados.`,
        syncedCount: synced.length,
        messages: synced,
      });
    }

    const connectedGoogle = await prisma.emailAccount.findFirst({
      where: { eventId: activeEventId, provider: 'GOOGLE' },
      select: { id: true, email: true },
    });

    if (connectedGoogle) {
      const result = await syncGoogleInboxForEvent(activeEventId, 25);
      return NextResponse.json({
        mode: 'google',
        accountEmail: result.accountEmail,
        message: `Gmail (${result.accountEmail}) sincronizado: ${result.syncedCount} correos procesados.`,
        syncedCount: result.syncedCount,
        messages: result.messages,
      });
    }

    return NextResponse.json(
      {
        error:
          'No hay una cuenta de Google Workspace conectada para este evento. Conéctala en el panel superior o usa "Cargar Muestra".',
        needsConnection: true,
      },
      { status: 400 }
    );
  } catch (error: unknown) {
    return apiErrorResponse(error, 'Error al sincronizar el inbox');
  }
}
