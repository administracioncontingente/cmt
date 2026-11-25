import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { getCurrentUser, getEventPermissions } from '@/lib/auth';
import { apiErrorResponse } from '@/lib/apiUtils';
import {
  isValidIncidentCategory,
  isValidIncidentPriority,
  isValidIncidentStatus,
} from '@/lib/incidents';

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

    if (!getEventPermissions(user, incident.eventId).canView) {
      return NextResponse.json(
        { error: 'No tienes permisos para ver esta incidencia' },
        { status: 403 }
      );
    }

    return NextResponse.json({ incident });
  } catch (error: unknown) {
    return apiErrorResponse(error, 'Error al obtener la incidencia');
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
    const existing = await prisma.incident.findUnique({
      where: { id },
      select: { id: true, eventId: true },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Incidencia no encontrada' }, { status: 404 });
    }

    if (!getEventPermissions(user, existing.eventId).canManageCrm) {
      return NextResponse.json(
        { error: 'No tienes permisos para actualizar esta incidencia' },
        { status: 403 }
      );
    }

    const body = (await req.json()) as {
      status?: unknown;
      priority?: unknown;
      category?: unknown;
      assignedToId?: unknown;
      resolutionNotes?: unknown;
    };

    const data: Prisma.IncidentUpdateInput = {};

    let validatedStatus: string | null = null;
    if (body.status !== undefined && body.status !== null && body.status !== '') {
      if (typeof body.status !== 'string' || !isValidIncidentStatus(body.status)) {
        return NextResponse.json(
          { error: 'Estado de incidencia inválido' },
          { status: 400 }
        );
      }
      validatedStatus = body.status;
      data.status = validatedStatus;
      data.resolvedAt =
        validatedStatus === 'RESUELTA' || validatedStatus === 'CERRADA'
          ? new Date()
          : null;
    }

    if (body.priority !== undefined && body.priority !== null && body.priority !== '') {
      if (typeof body.priority !== 'string' || !isValidIncidentPriority(body.priority)) {
        return NextResponse.json(
          { error: 'Prioridad de incidencia inválida' },
          { status: 400 }
        );
      }
      data.priority = body.priority;
    }

    if (body.category !== undefined && body.category !== null && body.category !== '') {
      if (typeof body.category !== 'string' || !isValidIncidentCategory(body.category)) {
        return NextResponse.json(
          { error: 'Categoría de incidencia inválida' },
          { status: 400 }
        );
      }
      data.category = body.category;
    }

    if (body.assignedToId !== undefined) {
      if (typeof body.assignedToId === 'string' && body.assignedToId.trim()) {
        data.assignedTo = { connect: { id: body.assignedToId.trim() } };
      } else {
        data.assignedTo = { disconnect: true };
      }
    }

    const resolutionNotesText =
      typeof body.resolutionNotes === 'string'
        ? body.resolutionNotes.trim()
        : body.resolutionNotes === null
          ? null
          : undefined;

    if (resolutionNotesText !== undefined) {
      data.resolutionNotes = resolutionNotesText;
    }

    const updated = await prisma.$transaction(async (tx) => {
      if (validatedStatus) {
        await tx.incidentComment.create({
          data: {
            incidentId: id,
            userId: user.id,
            authorName: user.name,
            content: `Estado actualizado a "${validatedStatus}" por ${user.name}.${
              resolutionNotesText ? ` Notas: ${resolutionNotesText}` : ''
            }`,
            isInternal: true,
          },
        });
      }

      return tx.incident.update({
        where: { id },
        data,
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
    });

    return NextResponse.json({
      message: 'Incidencia actualizada con éxito',
      incident: updated,
    });
  } catch (error: unknown) {
    return apiErrorResponse(error, 'Error al actualizar la incidencia');
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
    const existing = await prisma.incident.findUnique({
      where: { id },
      select: { id: true, eventId: true },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Incidencia no encontrada' }, { status: 404 });
    }

    if (!getEventPermissions(user, existing.eventId).isEventAdmin) {
      return NextResponse.json(
        { error: 'Solo administradores del evento pueden eliminar incidencias' },
        { status: 403 }
      );
    }

    await prisma.incident.delete({ where: { id } });
    return NextResponse.json({ message: 'Incidencia eliminada con éxito' });
  } catch (error: unknown) {
    return apiErrorResponse(error, 'Error al eliminar la incidencia');
  }
}
