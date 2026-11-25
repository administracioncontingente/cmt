import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';

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

    // Si tiene googleThreadId, buscar el hilo completo
    let threadMessages: any[] = [];
    if (message.googleThreadId) {
      threadMessages = await prisma.emailMessage.findMany({
        where: {
          eventId: message.eventId,
          googleThreadId: message.googleThreadId,
        },
        orderBy: { date: 'asc' },
      });
    }

    return NextResponse.json({
      message,
      threadMessages: threadMessages.length > 0 ? threadMessages : [message],
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
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
    const body = await req.json();
    const { participantId } = body;

    const updated = await prisma.emailMessage.update({
      where: { id },
      data: {
        participantId: participantId || null,
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
      message: participantId ? 'Mensaje asociado al participante exitosamente' : 'Asociación removida',
      updated,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
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
    await prisma.emailMessage.delete({ where: { id } });
    return NextResponse.json({ message: 'Mensaje eliminado' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
