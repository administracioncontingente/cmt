import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';

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
    const body = await req.json().catch(() => ({}));
    const { category, priority, assignedToId, title, customNotes } = body;

    const message = await prisma.emailMessage.findUnique({
      where: { id: messageId },
      include: {
        participant: true,
      },
    });

    if (!message) {
      return NextResponse.json({ error: 'Mensaje no encontrado' }, { status: 404 });
    }

    if (!message.participantId) {
      return NextResponse.json(
        { error: 'Para convertir un correo en Incidencia, primero debe estar asociado a un participante.' },
        { status: 400 }
      );
    }

    // Generar número de ticket secuencial (ej: INC-2027-001)
    const count = await prisma.incident.count({ where: { eventId: message.eventId } });
    const year = new Date().getFullYear();
    const ticketNumber = `INC-${year}-${String(count + 1).padStart(3, '0')}`;

    const incidentTitle = title?.trim() || message.subject;
    const incidentDesc = customNotes?.trim() || message.bodyText || message.snippet || 'Sin descripción';

    const incident = await prisma.incident.create({
      data: {
        ticketNumber,
        eventId: message.eventId,
        participantId: message.participantId,
        title: incidentTitle,
        description: incidentDesc,
        category: category || 'CONSULTA_GENERAL',
        priority: priority || 'MEDIA',
        status: 'ABIERTA',
        assignedToId: assignedToId || user.id,
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

    // Si tiene hilo, vincular también los otros mensajes del mismo hilo
    if (message.googleThreadId) {
      await prisma.emailMessage.updateMany({
        where: {
          eventId: message.eventId,
          googleThreadId: message.googleThreadId,
        },
        data: {
          ticketId: incident.id,
        },
      });
    }

    return NextResponse.json({
      message: `Incidencia ${incident.ticketNumber} creada exitosamente`,
      incident,
    });
  } catch (error: any) {
    console.error('Error creating ticket from message:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
