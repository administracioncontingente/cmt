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
    const incident = await prisma.incident.findUnique({
      where: { id },
      include: {
        participant: {
          include: {
            plan: true,
            payments: { take: 5, orderBy: { paymentDate: 'desc' } },
            medicalRecord: {
              select: {
                completionStatus: true,
                bloodType: true,
                hasSevereAllergies: true,
                carriesEpiPen: true,
              },
            },
          },
        },
        assignedTo: {
          select: { id: true, name: true, email: true },
        },
        createdBy: {
          select: { id: true, name: true, email: true },
        },
        messages: {
          orderBy: { date: 'asc' },
        },
        comments: {
          orderBy: { createdAt: 'asc' },
          include: {
            user: { select: { id: true, name: true, email: true } },
          },
        },
      },
    });

    if (!incident) {
      return NextResponse.json({ error: 'Incidencia no encontrada' }, { status: 404 });
    }

    return NextResponse.json({ incident });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

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
    const { status, priority, category, assignedToId, resolutionNotes } = body;

    const data: any = {};
    if (status) {
      data.status = status;
      if (status === 'RESUELTA' || status === 'CERRADA') {
        data.resolvedAt = new Date();
      }
    }
    if (priority) data.priority = priority;
    if (category) data.category = category;
    if (assignedToId !== undefined) data.assignedToId = assignedToId;
    if (resolutionNotes !== undefined) data.resolutionNotes = resolutionNotes;

    const updated = await prisma.incident.update({
      where: { id },
      data,
      include: {
        assignedTo: { select: { id: true, name: true } },
        participant: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    // Registrar comentario automático si cambió de estado
    if (status) {
      await prisma.incidentComment.create({
        data: {
          incidentId: id,
          userId: user.id,
          authorName: user.name,
          content: `Estado actualizado a "${status}" por ${user.name}.${resolutionNotes ? ` Notas: ${resolutionNotes}` : ''}`,
          isInternal: true,
        },
      });
    }

    return NextResponse.json({
      message: 'Incidencia actualizada con éxito',
      incident: updated,
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
    await prisma.incident.delete({ where: { id } });
    return NextResponse.json({ message: 'Incidencia eliminada con éxito' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
