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

    const financial = calculateFinancialSummary(
      participant.plan?.installments || [],
      participant.payments || [],
      participant.plan?.totalAmount
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
    if (body.rut) {
      formattedRut = formatRut(cleanRut(body.rut));
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

    // Si cambia el rol, actualizar plan asociado si no se fuerza uno específico
    let planId = body.planId !== undefined ? body.planId : existing.planId;
    if (body.contingentRole && body.contingentRole !== existing.contingentRole) {
      const targetPlan = await prisma.paymentPlan.findUnique({
        where: { roleKey: body.contingentRole },
      });
      if (targetPlan) {
        planId = targetPlan.id;
      }
    }

    const updated = await prisma.participant.update({
      where: { id },
      data: {
        rut: formattedRut,
        firstName: body.firstName?.trim() ?? existing.firstName,
        lastName: body.lastName?.trim() ?? existing.lastName,
        email: body.email?.trim().toLowerCase() ?? existing.email,
        phone: body.phone !== undefined ? body.phone?.trim() : existing.phone,
        birthDate: body.birthDate ? new Date(body.birthDate) : existing.birthDate,
        gender: body.gender !== undefined ? body.gender : existing.gender,
        dietaryRestrictions: body.dietaryRestrictions !== undefined ? body.dietaryRestrictions?.trim() : existing.dietaryRestrictions,
        medicalNotes: body.medicalNotes !== undefined ? body.medicalNotes?.trim() : existing.medicalNotes,
        guardianName: body.guardianName !== undefined ? body.guardianName?.trim() : existing.guardianName,
        guardianRelationship: body.guardianRelationship !== undefined ? body.guardianRelationship?.trim() : existing.guardianRelationship,
        guardianPhone: body.guardianPhone !== undefined ? body.guardianPhone?.trim() : existing.guardianPhone,
        guardianEmail: body.guardianEmail !== undefined ? body.guardianEmail?.trim() : existing.guardianEmail,
        scoutZone: body.scoutZone !== undefined ? body.scoutZone?.trim() : existing.scoutZone,
        scoutDistrict: body.scoutDistrict !== undefined ? body.scoutDistrict?.trim() : existing.scoutDistrict,
        scoutGroup: body.scoutGroup !== undefined ? body.scoutGroup?.trim() : existing.scoutGroup,
        contingentRole: body.contingentRole ?? existing.contingentRole,
        status: body.status ?? existing.status,
        unitOrPatrol: body.unitOrPatrol !== undefined ? body.unitOrPatrol?.trim() : existing.unitOrPatrol,
        planId,
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

    const financial = calculateFinancialSummary(
      updated.plan?.installments || [],
      updated.payments || [],
      updated.plan?.totalAmount
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
