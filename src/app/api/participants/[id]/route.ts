import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import { calculateFinancialSummary } from '@/lib/finance';
import { formatRut, cleanRut } from '@/lib/rut';

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
    const participant = await prisma.participant.findUnique({
      where: { id },
      include: {
        plan: {
          include: {
            installments: {
              orderBy: { installmentNumber: 'asc' },
            },
          },
        },
        payments: {
          include: {
            registeredBy: {
              select: { name: true, email: true },
            },
          },
          orderBy: { paymentDate: 'desc' },
        },
      },
    });

    if (!participant) {
      return NextResponse.json(
        { error: 'Participante no encontrado' },
        { status: 404 }
      );
    }

    const totalAmount = participant.targetFeeUSD && participant.targetFeeUSD > 0
      ? participant.targetFeeUSD
      : (participant.plan?.totalAmount || 3600);

    const financial = calculateFinancialSummary(
      participant.plan?.installments || [],
      participant.payments || [],
      totalAmount
    );

    return NextResponse.json({ participant: { ...participant, financial } });
  } catch (error) {
    console.error('Error fetching participant detail:', error);
    return NextResponse.json(
      { error: 'Error al obtener detalle del participante' },
      { status: 500 }
    );
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

    const existing = await prisma.participant.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: 'Participante no encontrado' },
        { status: 404 }
      );
    }

    let formattedRut = existing.rut;
    let cleanR = existing.rutClean;
    if (body.rut) {
      cleanR = cleanRut(body.rut);
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

    const updated = await prisma.participant.update({
      where: { id },
      data: {
        rut: formattedRut,
        rutClean: cleanR,
        firstName: body.firstName?.trim() ?? existing.firstName,
        lastName: body.lastName?.trim() ?? existing.lastName,
        secondLastName: body.secondLastName !== undefined ? body.secondLastName?.trim() : existing.secondLastName,
        email: body.email?.trim().toLowerCase() ?? existing.email,
        phone: body.phone !== undefined ? body.phone?.trim() : existing.phone,
        birthDate: body.birthDate ? new Date(body.birthDate) : existing.birthDate,
        gender: body.gender !== undefined ? body.gender : existing.gender,
        address: body.address !== undefined ? body.address?.trim() : existing.address,
        commune: body.commune !== undefined ? body.commune?.trim() : existing.commune,
        city: body.city !== undefined ? body.city?.trim() : existing.city,
        nationality: body.nationality !== undefined ? body.nationality?.trim() : existing.nationality,
        dietaryRestrictions: body.dietaryRestrictions !== undefined ? body.dietaryRestrictions?.trim() : existing.dietaryRestrictions,
        medicalNotes: body.medicalNotes !== undefined ? body.medicalNotes?.trim() : existing.medicalNotes,
        guardianName: body.guardianName !== undefined ? body.guardianName?.trim() : existing.guardianName,
        guardianPhone: body.guardianPhone !== undefined ? body.guardianPhone?.trim() : existing.guardianPhone,
        guardianEmail: body.guardianEmail !== undefined ? body.guardianEmail?.trim() : existing.guardianEmail,
        scoutZone: body.scoutZone !== undefined ? body.scoutZone?.trim() : existing.scoutZone,
        scoutDistrict: body.scoutDistrict !== undefined ? body.scoutDistrict?.trim() : existing.scoutDistrict,
        scoutGroup: body.scoutGroup !== undefined ? body.scoutGroup?.trim() : existing.scoutGroup,
        contingentRole: body.contingentRole ?? existing.contingentRole,
        status: body.status ?? existing.status,
        unitOrPatrol: body.unitOrPatrol !== undefined ? body.unitOrPatrol?.trim() : existing.unitOrPatrol,
        cupoCode: body.cupoCode !== undefined ? body.cupoCode?.trim() : existing.cupoCode,
        unit: body.unit !== undefined ? body.unit?.trim() : existing.unit,
        unitName: body.unitName !== undefined ? body.unitName?.trim() : existing.unitName,
        patrol: body.patrol !== undefined ? body.patrol?.trim() : existing.patrol,
        patrolName: body.patrolName !== undefined ? body.patrolName?.trim() : existing.patrolName,
        uniformSize: body.uniformSize !== undefined ? body.uniformSize?.trim() : existing.uniformSize,
        polandRegistered: body.polandRegistered !== undefined ? body.polandRegistered?.trim() : existing.polandRegistered,
        targetFeeUSD: body.targetFeeUSD !== undefined ? parseFloat(body.targetFeeUSD) : existing.targetFeeUSD,
        notes: body.notes !== undefined ? body.notes?.trim() : existing.notes,
      },
      include: {
        plan: {
          include: {
            installments: { orderBy: { installmentNumber: 'asc' } },
          },
        },
        payments: {
          orderBy: { paymentDate: 'desc' },
        },
      },
    });

    const totalAmount = updated.targetFeeUSD && updated.targetFeeUSD > 0
      ? updated.targetFeeUSD
      : (updated.plan?.totalAmount || 3600);

    const financial = calculateFinancialSummary(
      updated.plan?.installments || [],
      updated.payments || [],
      totalAmount
    );

    return NextResponse.json({ participant: { ...updated, financial } });
  } catch (error) {
    console.error('Error updating participant:', error);
    return NextResponse.json(
      { error: 'Error al actualizar participante' },
      { status: 500 }
    );
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
    await prisma.participant.delete({ where: { id } });
    return NextResponse.json({ success: true, message: 'Participante eliminado' });
  } catch (error) {
    console.error('Error deleting participant:', error);
    return NextResponse.json(
      { error: 'Error al eliminar participante' },
      { status: 500 }
    );
  }
}
