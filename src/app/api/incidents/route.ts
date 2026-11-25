import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import {
  getCurrentUser,
  getEventPermissions,
  resolveAuthorizedEventId,
} from '@/lib/auth';
import { apiErrorResponse } from '@/lib/apiUtils';
import {
  createIncidentWithUniqueTicket,
  isValidIncidentCategory,
  isValidIncidentPriority,
} from '@/lib/incidents';

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
        incidents: [],
        metrics: { total: 0, ABIERTA: 0, EN_PROCESO: 0, RESUELTA: 0, CERRADA: 0 },
      });
    }

    if (!getEventPermissions(user, activeEventId).canView) {
      return NextResponse.json(
        { error: 'No tienes permisos para ver incidencias de este evento' },
        { status: 403 }
      );
    }

    const participantId = searchParams.get('participantId');
    const status = searchParams.get('status');
    const category = searchParams.get('category');
    const priority = searchParams.get('priority');
    const search = searchParams.get('search')?.trim().toLowerCase() || '';

    const where: Prisma.IncidentWhereInput = { eventId: activeEventId };

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

    const [abiertaCount, enProcesoCount, resueltaCount, cerradaCount] =
      await Promise.all([
        prisma.incident.count({
          where: { eventId: activeEventId, status: 'ABIERTA' },
        }),
        prisma.incident.count({
          where: { eventId: activeEventId, status: 'EN_PROCESO' },
        }),
        prisma.incident.count({
          where: { eventId: activeEventId, status: 'RESUELTA' },
        }),
        prisma.incident.count({
          where: { eventId: activeEventId, status: 'CERRADA' },
        }),
      ]);

    return NextResponse.json({
      incidents,
      metrics: {
        total: incidents.length,
        ABIERTA: abiertaCount,
        EN_PROCESO: enProcesoCount,
        RESUELTA: resueltaCount,
        CERRADA: cerradaCount,
      },
    });
  } catch (error: unknown) {
    return apiErrorResponse(error, 'Error al obtener las incidencias');
  }
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  try {
    const body = (await req.json()) as {
      eventId?: unknown;
      participantId?: unknown;
      title?: unknown;
      description?: unknown;
      category?: unknown;
      priority?: unknown;
      assignedToId?: unknown;
    };

    const paramEventId =
      typeof body.eventId === 'string' && body.eventId.trim()
        ? body.eventId.trim()
        : undefined;

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

    const participantId =
      typeof body.participantId === 'string' ? body.participantId.trim() : '';
    const title = typeof body.title === 'string' ? body.title.trim() : '';

    if (!activeEventId || !participantId || !title) {
      return NextResponse.json(
        { error: 'Evento, participante y título son obligatorios.' },
        { status: 400 }
      );
    }

    if (!getEventPermissions(user, activeEventId).canManageCrm) {
      return NextResponse.json(
        { error: 'No tienes permisos para crear incidencias en este evento' },
        { status: 403 }
      );
    }

    const participant = await prisma.participant.findUnique({
      where: { id: participantId },
      select: { id: true, eventId: true },
    });

    if (!participant) {
      return NextResponse.json(
        { error: 'Participante no encontrado' },
        { status: 404 }
      );
    }

    if (participant.eventId !== activeEventId) {
      return NextResponse.json(
        { error: 'El participante no pertenece al evento seleccionado' },
        { status: 400 }
      );
    }

    let resolvedCategory = 'CONSULTA_GENERAL';
    if (body.category !== undefined && body.category !== null && body.category !== '') {
      if (typeof body.category !== 'string' || !isValidIncidentCategory(body.category)) {
        return NextResponse.json(
          { error: 'Categoría de incidencia inválida' },
          { status: 400 }
        );
      }
      resolvedCategory = body.category;
    }

    let resolvedPriority = 'MEDIA';
    if (body.priority !== undefined && body.priority !== null && body.priority !== '') {
      if (typeof body.priority !== 'string' || !isValidIncidentPriority(body.priority)) {
        return NextResponse.json(
          { error: 'Prioridad de incidencia inválida' },
          { status: 400 }
        );
      }
      resolvedPriority = body.priority;
    }

    const description =
      typeof body.description === 'string' ? body.description.trim() : '';
    const assignedToId =
      typeof body.assignedToId === 'string' && body.assignedToId.trim()
        ? body.assignedToId.trim()
        : user.id;

    const incident = await createIncidentWithUniqueTicket(
      activeEventId,
      async (ticketNumber) =>
        prisma.incident.create({
          data: {
            ticketNumber,
            eventId: activeEventId,
            participantId,
            title,
            description,
            category: resolvedCategory,
            priority: resolvedPriority,
            status: 'ABIERTA',
            assignedToId,
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
              select: {
                id: true,
                rut: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
            assignedTo: {
              select: { id: true, name: true, email: true },
            },
          },
        })
    );

    return NextResponse.json({
      message: `Incidencia ${incident.ticketNumber} registrada exitosamente`,
      incident,
    });
  } catch (error: unknown) {
    return apiErrorResponse(error, 'Error al crear la incidencia');
  }
}
