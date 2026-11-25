import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser, getEventPermissions } from '@/lib/auth';
import { apiErrorResponse } from '@/lib/apiUtils';
import {
  createIncidentWithUniqueTicket,
  isValidIncidentCategory,
  isValidIncidentPriority,
} from '@/lib/incidents';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const { id: messageId } = await params;

  try {
    const body = (await req.json().catch(() => ({}))) as {
      category?: unknown;
      priority?: unknown;
      assignedToId?: unknown;
      title?: unknown;
      customNotes?: unknown;
    };

    const message = await prisma.emailMessage.findUnique({
      where: { id: messageId },
      include: {
        participant: true,
      },
    });

    if (!message) {
      return NextResponse.json({ error: 'Mensaje no encontrado' }, { status: 404 });
    }

    if (!getEventPermissions(user, message.eventId).canManageCrm) {
      return NextResponse.json(
        { error: 'No tienes permisos para crear incidencias en este evento' },
        { status: 403 }
      );
    }

    if (message.ticketId) {
      return NextResponse.json(
        { error: 'Este correo ya está vinculado a una incidencia existente.' },
        { status: 409 }
      );
    }

    if (!message.participantId) {
      return NextResponse.json(
        {
          error:
            'Para convertir un correo en Incidencia, primero debe estar asociado a un participante.',
        },
        { status: 400 }
      );
    }

    const participantId = message.participantId;

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

    const incidentTitle =
      typeof body.title === 'string' && body.title.trim()
        ? body.title.trim()
        : message.subject;
    const incidentDesc =
      typeof body.customNotes === 'string' && body.customNotes.trim()
        ? body.customNotes.trim()
        : message.bodyText || message.snippet || 'Sin descripción';
    const resolvedAssignedToId =
      typeof body.assignedToId === 'string' && body.assignedToId.trim()
        ? body.assignedToId.trim()
        : user.id;

    const incident = await createIncidentWithUniqueTicket(
      message.eventId,
      async (ticketNumber) =>
        prisma.$transaction(async (tx) => {
          const created = await tx.incident.create({
            data: {
              ticketNumber,
              eventId: message.eventId,
              participantId,
              title: incidentTitle,
              description: incidentDesc,
              category: resolvedCategory,
              priority: resolvedPriority,
              status: 'ABIERTA',
              assignedToId: resolvedAssignedToId,
              createdById: user.id,
              messages: {
                connect: { id: message.id },
              },
              comments: {
                create: {
                  userId: user.id,
                  authorName: user.name,
                  content: `Ticket creado automáticamente a partir del correo "${message.subject}" de ${message.senderEmail}.`,
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
                  unitName: true,
                },
              },
              assignedTo: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                },
              },
            },
          });

          if (message.googleThreadId) {
            await tx.emailMessage.updateMany({
              where: {
                eventId: message.eventId,
                googleThreadId: message.googleThreadId,
              },
              data: {
                ticketId: created.id,
              },
            });
          }

          return created;
        })
    );

    return NextResponse.json({
      message: `Incidencia ${incident.ticketNumber} creada exitosamente`,
      incident,
    });
  } catch (error: unknown) {
    return apiErrorResponse(error, 'Error al crear incidencia desde el correo');
  }
}
