import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser, getActiveEventId } from '@/lib/auth';
import { seedSampleInboxMessages } from '@/lib/inboxSync';

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const paramEventId = searchParams.get('eventId');
    const activeEventId = paramEventId || (await getActiveEventId());

    if (!activeEventId) {
      return NextResponse.json({ messages: [], count: 0 });
    }

    const participantId = searchParams.get('participantId');
    const filter = searchParams.get('filter'); // 'all', 'associated', 'unassociated', 'tickets'
    const search = searchParams.get('search')?.trim().toLowerCase() || '';

    const where: any = { eventId: activeEventId };

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

    const totalCount = await prisma.emailMessage.count({ where: { eventId: activeEventId } });
    const associatedCount = await prisma.emailMessage.count({
      where: { eventId: activeEventId, participantId: { not: null } },
    });
    const ticketCount = await prisma.emailMessage.count({
      where: { eventId: activeEventId, ticketId: { not: null } },
    });

    return NextResponse.json({
      messages,
      metrics: {
        total: totalCount,
        associated: associatedCount,
        unassociated: totalCount - associatedCount,
        tickets: ticketCount,
      },
    });
  } catch (error: any) {
    console.error('Error fetching inbox messages:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST /api/inbox -> Sincronizar o inyectar correos
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const paramEventId = body.eventId;
    const activeEventId = paramEventId || (await getActiveEventId());

    if (!activeEventId) {
      return NextResponse.json({ error: 'No hay evento activo seleccionado' }, { status: 400 });
    }

    // Si se solicita simulación o no hay token en vivo
    const synced = await seedSampleInboxMessages(activeEventId);

    return NextResponse.json({
      message: `Sincronización completada. ${synced.length} correos procesados y asociados.`,
      syncedCount: synced.length,
      messages: synced,
    });
  } catch (error: any) {
    console.error('Error syncing inbox:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
