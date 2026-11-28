import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getParticipantSession } from '@/lib/participantAuth';
import { apiErrorResponse } from '@/lib/apiUtils';
import { createIncidentWithUniqueTicket, isValidIncidentCategory } from '@/lib/incidents';
import { PORTAL_TICKET_SELECT, toPortalTicketDTO } from '@/lib/portalTickets';
import {
  TICKET_DAILY_LIMIT,
  TICKET_MESSAGE_MAX,
  TICKET_SUBJECT_MAX,
} from '@/lib/supportTicketMeta';

export async function GET() {
  const session = await getParticipantSession();
  if (!session) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  try {
    const records = await prisma.incident.findMany({
      where: { participantId: session.participantId },
      orderBy: [{ updatedAt: 'desc' }],
      select: PORTAL_TICKET_SELECT,
    });

    return NextResponse.json({ tickets: records.map(toPortalTicketDTO) });
  } catch (error: unknown) {
    return apiErrorResponse(error, 'Error al obtener tus tickets de soporte', 500);
  }
}

export async function POST(req: NextRequest) {
  const session = await getParticipantSession();
  if (!session) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const title = typeof body.title === 'string' ? body.title.trim() : '';
    const description =
      typeof body.description === 'string' ? body.description.trim() : '';
    const rawCategory =
      typeof body.category === 'string' ? body.category.trim().toUpperCase() : '';
    const isUrgent = body.isUrgent === true;

    if (title.length < 5) {
      return NextResponse.json(
        { error: 'El asunto debe tener al menos 5 caracteres.' },
        { status: 400 }
      );
    }
    if (description.length < 10) {
      return NextResponse.json(
        { error: 'Describe tu solicitud con al menos 10 caracteres.' },
        { status: 400 }
      );
    }

    const category = isValidIncidentCategory(rawCategory)
      ? rawCategory
      : 'CONSULTA_GENERAL';

    const participant = await prisma.participant.findUnique({
      where: { id: session.participantId },
      select: { id: true, eventId: true },
    });

    if (!participant) {
      return NextResponse.json({ error: 'Participante no encontrado' }, { status: 404 });
    }
    if (!participant.eventId) {
      return NextResponse.json(
        { error: 'Tu inscripción no está asociada a un evento activo.' },
        { status: 400 }
      );
    }

    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentCount = await prisma.incident.count({
      where: {
        participantId: participant.id,
        createdById: null,
        createdAt: { gte: since },
      },
    });
    if (recentCount >= TICKET_DAILY_LIMIT) {
      return NextResponse.json(
        {
          error: `Alcanzaste el máximo de ${TICKET_DAILY_LIMIT} tickets en 24 horas. Puedes responder en un ticket existente.`,
        },
        { status: 429 }
      );
    }

    const eventId = participant.eventId;
    const created = await createIncidentWithUniqueTicket(eventId, (ticketNumber) =>
      prisma.incident.create({
        data: {
          ticketNumber,
          eventId,
          participantId: participant.id,
          title: title.slice(0, TICKET_SUBJECT_MAX),
          description: `${description.slice(0, TICKET_MESSAGE_MAX)}\n\n— Enviado desde el Portal del Participante (${session.email})`,
          category,
          priority: isUrgent ? 'ALTA' : 'MEDIA',
          status: 'ABIERTA',
        },
        select: PORTAL_TICKET_SELECT,
      })
    );

    return NextResponse.json(
      {
        message: `Ticket ${created.ticketNumber} creado. El equipo te responderá por este mismo portal.`,
        ticket: toPortalTicketDTO(created),
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    return apiErrorResponse(error, 'Error al crear el ticket de soporte', 500);
  }
}
