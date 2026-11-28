import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getParticipantSession } from '@/lib/participantAuth';
import { apiErrorResponse } from '@/lib/apiUtils';
import { PORTAL_TICKET_SELECT, toPortalTicketDTO } from '@/lib/portalTickets';
import { TICKET_MESSAGE_MAX } from '@/lib/supportTicketMeta';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getParticipantSession();
  if (!session) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const { id } = await params;

  try {
    const body = (await req.json().catch(() => ({}))) as { content?: unknown };
    const content = typeof body.content === 'string' ? body.content.trim() : '';
    if (content.length < 2) {
      return NextResponse.json({ error: 'Escribe un mensaje antes de enviar.' }, { status: 400 });
    }

    const ticket = await prisma.incident.findUnique({
      where: { id },
      select: {
        id: true,
        participantId: true,
        status: true,
        participant: { select: { firstName: true, lastName: true } },
      },
    });

    // 404 also for tickets of other participants to avoid leaking existence
    if (!ticket || ticket.participantId !== session.participantId) {
      return NextResponse.json({ error: 'Ticket no encontrado' }, { status: 404 });
    }

    if (ticket.status === 'CERRADA') {
      return NextResponse.json(
        { error: 'Este ticket está cerrado. Crea un nuevo ticket si necesitas más ayuda.' },
        { status: 409 }
      );
    }

    const nextStatus =
      ticket.status === 'RESUELTA'
        ? 'ABIERTA'
        : ticket.status === 'ESPERANDO_RESPUESTA'
          ? 'EN_PROCESO'
          : ticket.status;

    const authorName =
      `${ticket.participant.firstName} ${ticket.participant.lastName}`.trim() || session.email;

    const updated = await prisma.$transaction(async (tx) => {
      await tx.incidentComment.create({
        data: {
          incidentId: ticket.id,
          userId: null,
          authorName,
          content: content.slice(0, TICKET_MESSAGE_MAX),
          isInternal: false,
        },
      });
      return tx.incident.update({
        where: { id: ticket.id },
        data: {
          status: nextStatus,
          ...(ticket.status === 'RESUELTA' ? { resolvedAt: null } : {}),
        },
        select: PORTAL_TICKET_SELECT,
      });
    });

    return NextResponse.json({
      message:
        ticket.status === 'RESUELTA'
          ? 'Mensaje enviado. El ticket fue reabierto.'
          : 'Mensaje enviado al equipo.',
      ticket: toPortalTicketDTO(updated),
    });
  } catch (error: unknown) {
    return apiErrorResponse(error, 'Error al enviar el mensaje', 500);
  }
}
