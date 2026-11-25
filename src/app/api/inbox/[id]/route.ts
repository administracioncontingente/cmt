import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser, getEventPermissions } from '@/lib/auth';
import { apiErrorResponse } from '@/lib/apiUtils';

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
    const message = await prisma.emailMessage.findUnique({
      where: { id },
      include: {
        participant: true,
        ticket: {
          include: {
            assignedTo: { select: { id: true, name: true, email: true } },
            comments: true,
          },
        },
      },
    });

    if (!message) {
      return NextResponse.json({ error: 'Mensaje no encontrado' }, { status: 404 });
    }

    if (!getEventPermissions(user, message.eventId).canView) {
      return NextResponse.json(
        { error: 'No tienes permisos para ver este mensaje' },
        { status: 403 }
      );
    }

    const threadMessages = message.googleThreadId
      ? await prisma.emailMessage.findMany({
          where: {
            eventId: message.eventId,
            googleThreadId: message.googleThreadId,
          },
          orderBy: { date: 'asc' },
        })
      : [];

    return NextResponse.json({
      message,
      threadMessages: threadMessages.length > 0 ? threadMessages : [message],
    });
  } catch (error: unknown) {
    return apiErrorResponse(error, 'Error al obtener el mensaje');
  }
}

// PUT /api/inbox/[id] -> Actualizar asociación manual a participante
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const { id } = await params;

  try {
    const existingMessage = await prisma.emailMessage.findUnique({
      where: { id },
      select: { id: true, eventId: true },
    });

    if (!existingMessage) {
      return NextResponse.json({ error: 'Mensaje no encontrado' }, { status: 404 });
    }

    if (!getEventPermissions(user, existingMessage.eventId).canManageCrm) {
      return NextResponse.json(
        { error: 'No tienes permisos para asociar mensajes en este evento' },
        { status: 403 }
      );
    }

    const body = (await req.json()) as { participantId?: unknown };
    const participantId =
      typeof body.participantId === 'string' && body.participantId.trim()
        ? body.participantId.trim()
        : null;

    if (participantId) {
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

      if (participant.eventId !== existingMessage.eventId) {
        return NextResponse.json(
          { error: 'El participante no pertenece al evento del mensaje' },
          { status: 400 }
        );
      }
    }

    const updated = await prisma.emailMessage.update({
      where: { id },
      data: {
        participantId,
        matchMethod: participantId ? 'MANUAL' : null,
      },
      include: {
        participant: {
          select: {
            id: true,
            rut: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    return NextResponse.json({
      message: participantId
        ? 'Mensaje asociado al participante exitosamente'
        : 'Asociación removida',
      updated,
    });
  } catch (error: unknown) {
    return apiErrorResponse(error, 'Error al actualizar asociación del mensaje');
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const { id } = await params;

  try {
    const existingMessage = await prisma.emailMessage.findUnique({
      where: { id },
      select: { id: true, eventId: true },
    });

    if (!existingMessage) {
      return NextResponse.json({ error: 'Mensaje no encontrado' }, { status: 404 });
    }

    if (!getEventPermissions(user, existingMessage.eventId).isEventAdmin) {
      return NextResponse.json(
        { error: 'Solo administradores del evento pueden eliminar mensajes' },
        { status: 403 }
      );
    }

    await prisma.emailMessage.delete({ where: { id } });
    return NextResponse.json({ message: 'Mensaje eliminado' });
  } catch (error: unknown) {
    return apiErrorResponse(error, 'Error al eliminar el mensaje');
  }
}
