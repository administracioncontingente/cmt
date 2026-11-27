import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser, getEventPermissions } from '@/lib/auth';
import { calculateFinancialSummary, resolveParticipantTargetAmount } from '@/lib/finance';
import { formatRut, cleanRut } from '@/lib/rut';
import { apiErrorResponse, parseOptionalDate, parseOptionalFloat } from '@/lib/apiUtils';

const participantDetailInclude = {
  medicalRecord: true,
  plan: {
    include: {
      installments: {
        orderBy: { installmentNumber: 'asc' as const },
      },
    },
  },
  payments: {
    include: {
      registeredBy: {
        select: { id: true, name: true, email: true },
      },
    },
    orderBy: { paymentDate: 'desc' as const },
  },
  emailMessages: {
    orderBy: { date: 'desc' as const },
  },
  incidents: {
    orderBy: { createdAt: 'desc' as const },
    include: {
      assignedTo: { select: { id: true, name: true } },
      comments: true,
    },
  },
  kitSizes: {
    include: {
      kitItem: {
        select: {
          id: true,
          code: true,
          name: true,
          category: true,
          includedQuantity: true,
        },
      },
    },
    orderBy: { kitItem: { sortOrder: 'asc' as const } },
  },
};

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const { id } = await params;

  try {
    const participant = await prisma.participant.findUnique({
      where: { id },
      include: participantDetailInclude,
    });

    if (!participant) {
      return NextResponse.json(
        { error: 'Participante no encontrado' },
        { status: 404 }
      );
    }

    if (participant.eventId && !getEventPermissions(user, participant.eventId).canView) {
      return NextResponse.json(
        { error: 'No tienes acceso a este evento' },
        { status: 403 }
      );
    }

    const totalAmount = resolveParticipantTargetAmount(
      participant.targetFeeUSD,
      participant.plan?.totalAmount
    );

    const financial = calculateFinancialSummary(
      participant.plan?.installments || [],
      participant.payments || [],
      totalAmount
    );

    return NextResponse.json({ participant: { ...participant, financial } });
  } catch (error: unknown) {
    return apiErrorResponse(error, 'Error al obtener detalle del participante', 500);
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
    const existing = await prisma.participant.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: 'Participante no encontrado' },
        { status: 404 }
      );
    }

    if (existing.eventId) {
      if (!getEventPermissions(user, existing.eventId).canEditParticipants) {
        return NextResponse.json(
          { error: 'No tienes permisos para editar participantes en este evento' },
          { status: 403 }
        );
      }
    } else if (user.role !== 'SUPER_ADMIN') {
      return NextResponse.json(
        { error: 'No tienes acceso a este participante' },
        { status: 403 }
      );
    }

    const body = (await req.json()) as Record<string, unknown>;

    let formattedRut = existing.rut;
    let cleanR = existing.rutClean;
    if (typeof body.rut === 'string' && body.rut.trim()) {
      cleanR = cleanRut(body.rut);
      if (cleanR.length < 2) {
        return NextResponse.json({ error: 'RUT inválido' }, { status: 400 });
      }
      formattedRut = formatRut(cleanR);
      if (formattedRut !== existing.rut) {
        const checkDupl = await prisma.participant.findUnique({
          where: { rut: formattedRut },
        });
        if (checkDupl) {
          return NextResponse.json(
            { error: `El RUT ${formattedRut} ya pertenece a otro participante` },
            { status: 409 }
          );
        }
      }
    }

    let birthDateUpdate = existing.birthDate;
    if (body.birthDate !== undefined) {
      if (body.birthDate === null || body.birthDate === '') {
        birthDateUpdate = null;
      } else {
        const parsed = parseOptionalDate(body.birthDate);
        if (!parsed) {
          return NextResponse.json({ error: 'Fecha de nacimiento inválida' }, { status: 400 });
        }
        birthDateUpdate = parsed;
      }
    }

    const optUpdate = (val: unknown, fallback: string | null): string | null => {
      if (val === undefined) return fallback;
      if (val === null) return null;
      if (typeof val === 'string') return val.trim() || null;
      return fallback;
    };

    const updated = await prisma.participant.update({
      where: { id },
      data: {
        rut: formattedRut,
        rutClean: cleanR,
        firstName: typeof body.firstName === 'string' && body.firstName.trim() ? body.firstName.trim() : existing.firstName,
        lastName: typeof body.lastName === 'string' && body.lastName.trim() ? body.lastName.trim() : existing.lastName,
        secondLastName: optUpdate(body.secondLastName, existing.secondLastName),
        email: typeof body.email === 'string' && body.email.trim() ? body.email.trim().toLowerCase() : existing.email,
        phone: optUpdate(body.phone, existing.phone),
        birthDate: birthDateUpdate,
        gender: optUpdate(body.gender, existing.gender),
        address: optUpdate(body.address, existing.address),
        commune: optUpdate(body.commune, existing.commune),
        city: optUpdate(body.city, existing.city),
        nationality: optUpdate(body.nationality, existing.nationality),
        dietaryRestrictions: optUpdate(body.dietaryRestrictions, existing.dietaryRestrictions),
        medicalNotes: optUpdate(body.medicalNotes, existing.medicalNotes),
        guardianName: optUpdate(body.guardianName, existing.guardianName),
        guardianPhone: optUpdate(body.guardianPhone, existing.guardianPhone),
        guardianEmail: optUpdate(body.guardianEmail, existing.guardianEmail),
        scoutZone: optUpdate(body.scoutZone, existing.scoutZone),
        scoutDistrict: optUpdate(body.scoutDistrict, existing.scoutDistrict),
        scoutGroup: optUpdate(body.scoutGroup, existing.scoutGroup),
        contingentRole: typeof body.contingentRole === 'string' && body.contingentRole.trim() ? body.contingentRole.trim() : existing.contingentRole,
        status: typeof body.status === 'string' && body.status.trim() ? body.status.trim() : existing.status,
        unitOrPatrol: optUpdate(body.unitOrPatrol, existing.unitOrPatrol),
        cupoCode: optUpdate(body.cupoCode, existing.cupoCode),
        unit: optUpdate(body.unit, existing.unit),
        unitName: optUpdate(body.unitName, existing.unitName),
        patrol: optUpdate(body.patrol, existing.patrol),
        patrolName: optUpdate(body.patrolName, existing.patrolName),
        uniformSize: optUpdate(body.uniformSize, existing.uniformSize),
        polandRegistered: optUpdate(body.polandRegistered, existing.polandRegistered),
        targetFeeUSD: body.targetFeeUSD !== undefined ? parseOptionalFloat(body.targetFeeUSD) : existing.targetFeeUSD,
        notes: optUpdate(body.notes, existing.notes),
      },
      include: participantDetailInclude,
    });

    const totalAmount = resolveParticipantTargetAmount(
      updated.targetFeeUSD,
      updated.plan?.totalAmount
    );

    const financial = calculateFinancialSummary(
      updated.plan?.installments || [],
      updated.payments || [],
      totalAmount
    );

    return NextResponse.json({ participant: { ...updated, financial } });
  } catch (error: unknown) {
    return apiErrorResponse(error, 'Error al actualizar participante', 500);
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const { id } = await params;

  try {
    const existing = await prisma.participant.findUnique({
      where: { id },
      select: { id: true, eventId: true },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Participante no encontrado' },
        { status: 404 }
      );
    }

    if (existing.eventId) {
      if (!getEventPermissions(user, existing.eventId).canDeleteParticipants) {
        return NextResponse.json(
          { error: 'Solo los administradores del evento pueden eliminar participantes' },
          { status: 403 }
        );
      }
    } else if (user.role !== 'SUPER_ADMIN') {
      return NextResponse.json(
        { error: 'No tienes permisos para eliminar este participante' },
        { status: 403 }
      );
    }

    await prisma.participant.delete({ where: { id } });
    return NextResponse.json({ success: true, message: 'Participante eliminado' });
  } catch (error: unknown) {
    return apiErrorResponse(error, 'Error al eliminar participante', 500);
  }
}
