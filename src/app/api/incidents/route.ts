import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser, getActiveEventId } from '@/lib/auth';

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
      return NextResponse.json({ incidents: [] });
    }

    const participantId = searchParams.get('participantId');
    const status = searchParams.get('status');
    const category = searchParams.get('category');
    const priority = searchParams.get('priority');
    const search = searchParams.get('search')?.trim().toLowerCase() || '';

    const where: any = { eventId: activeEventId };

    if (participantId) where.participantId = participantId;
    if (status && status !== 'ALL') where.status = status;
    if (category && category !== 'ALL') where.category = category;
    if (priority && priority !== 'ALL') where.priority = priority;

    if (search) {
      where.OR = [
        { ticketNumber: { contains: search, mode: 'insensitive' } },
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
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

    const incidents = await prisma.incident.findMany({
      where,
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
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
            email: true,
            phone: true,
          },
        },
        assignedTo: {
          select: { id: true, name: true, email: true },
        },
        createdBy: {
          select: { id: true, name: true, email: true },
        },
        _count: {
          select: {
            messages: true,
            comments: true,
          },
        },
      },
    });

    const statusCounts = {
      ABIERTA: await prisma.incident.count({ where: { eventId: activeEventId, status: 'ABIERTA' } }),
      EN_PROCESO: await prisma.incident.count({ where: { eventId: activeEventId, status: 'EN_PROCESO' } }),
      RESUELTA: await prisma.incident.count({ where: { eventId: activeEventId, status: 'RESUELTA' } }),
      CERRADA: await prisma.incident.count({ where: { eventId: activeEventId, status: 'CERRADA' } }),
    };

    return NextResponse.json({
      incidents,
      metrics: {
        total: incidents.length,
        ...statusCounts,
      },
    });
  } catch (error: any) {
    console.error('Error fetching incidents:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const {
      eventId: paramEventId,
      participantId,
      title,
      description,
      category,
      priority,
      assignedToId,
    } = body;

    const activeEventId = paramEventId || (await getActiveEventId());

    if (!activeEventId || !participantId || !title) {
      return NextResponse.json(
        { error: 'Evento, participante y título son obligatorios.' },
        { status: 400 }
      );
    }

    const count = await prisma.incident.count({ where: { eventId: activeEventId } });
    const year = new Date().getFullYear();
    const ticketNumber = `INC-${year}-${String(count + 1).padStart(3, '0')}`;

    const incident = await prisma.incident.create({
      data: {
        ticketNumber,
        eventId: activeEventId,
        participantId,
        title: title.trim(),
        description: description?.trim() || '',
        category: category || 'CONSULTA_GENERAL',
        priority: priority || 'MEDIA',
        status: 'ABIERTA',
        assignedToId: assignedToId || user.id,
        createdById: user.id,
        comments: {
          create: {
            userId: user.id,
            authorName: user.name,
            content: 'Incidencia creada en el sistema.',
            isInternal: true,
          },
        },
      },
      include: {
        participant: {
          select: { id: true, rut: true, firstName: true, lastName: true },
        },
        assignedTo: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    return NextResponse.json({
      message: `Incidencia ${incident.ticketNumber} registrada exitosamente`,
      incident,
    });
  } catch (error: any) {
    console.error('Error creating incident:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
