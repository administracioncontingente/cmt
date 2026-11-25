import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser, getEventPermissions } from '@/lib/auth';
import { apiErrorResponse } from '@/lib/apiUtils';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const { id: incidentId } = await params;

  try {
    const incident = await prisma.incident.findUnique({
      where: { id: incidentId },
      select: { id: true, eventId: true },
    });

    if (!incident) {
      return NextResponse.json({ error: 'Incidencia no encontrada' }, { status: 404 });
    }

    if (!getEventPermissions(user, incident.eventId).canManageCrm) {
      return NextResponse.json(
        { error: 'No tienes permisos para comentar en esta incidencia' },
        { status: 403 }
      );
    }

    const body = (await req.json()) as { content?: unknown; isInternal?: unknown };
    const content = typeof body.content === 'string' ? body.content.trim() : '';

    if (!content) {
      return NextResponse.json(
        { error: 'El contenido del comentario es requerido' },
        { status: 400 }
      );
    }

    const comment = await prisma.incidentComment.create({
      data: {
        incidentId,
        userId: user.id,
        authorName: user.name,
        content,
        isInternal: body.isInternal !== undefined ? Boolean(body.isInternal) : true,
      },
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
    });

    return NextResponse.json({
      message: 'Comentario agregado',
      comment,
    });
  } catch (error: unknown) {
    return apiErrorResponse(error, 'Error al agregar comentario a la incidencia');
  }
}
