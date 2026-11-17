import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import { calculateFinancialSummary } from '@/lib/finance';
import { formatRut, cleanRut } from '@/lib/rut';

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search')?.trim().toLowerCase() || '';
    const role = searchParams.get('role')?.trim() || '';
    const status = searchParams.get('status')?.trim() || '';
    const health = searchParams.get('health')?.trim() || '';

    const where: any = {};

    if (role && role !== 'ALL') {
      where.contingentRole = role;
    }

    if (status && status !== 'ALL') {
      where.status = status;
    }

    if (search) {
      where.OR = [
        { firstName: { contains: search } },
        { lastName: { contains: search } },
        { rut: { contains: search } },
        { scoutGroup: { contains: search } },
        { scoutZone: { contains: search } },
        { email: { contains: search } },
      ];
    }

    const participants = await prisma.participant.findMany({
      where,
      include: {
        plan: {
          include: {
            installments: {
              orderBy: { installmentNumber: 'asc' },
            },
          },
        },
        payments: {
          orderBy: { paymentDate: 'desc' },
        },
      },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    });

    const enriched = participants.map((p) => {
      const fin = calculateFinancialSummary(
        p.plan?.installments || [],
        p.payments || [],
        p.plan?.totalAmount
      );

      return {
        ...p,
        financial: fin,
      };
    });

    // Filtro por salud financiera si aplica
    const filtered = health && health !== 'ALL'
      ? enriched.filter((p) => p.financial.health === health)
      : enriched;

    return NextResponse.json({ participants: filtered });
  } catch (error) {
    console.error('Error in GET /api/participants:', error);
    return NextResponse.json(
      { error: 'Error al obtener la lista de participantes' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  try {
    const body = await req.json();

    const {
      rut,
      firstName,
      lastName,
      email,
      phone,
      birthDate,
      gender,
      dietaryRestrictions,
      medicalNotes,
      guardianName,
      guardianRelationship,
      guardianPhone,
      guardianEmail,
      scoutZone,
      scoutDistrict,
      scoutGroup,
      contingentRole,
      status,
      unitOrPatrol,
      notes,
    } = body;

    if (!rut || !firstName || !lastName || !email) {
      return NextResponse.json(
        { error: 'RUT, nombres, apellidos y correo son obligatorios' },
        { status: 400 }
      );
    }

    const cleanedRut = cleanRut(rut);
    const formattedRut = formatRut(cleanedRut);

    // Verificar unicidad de RUT
    const existing = await prisma.participant.findUnique({
      where: { rut: formattedRut },
    });
    if (existing) {
      return NextResponse.json(
        { error: `El RUT ${formattedRut} ya se encuentra registrado` },
        { status: 409 }
      );
    }

    // Asociar automáticamente el plan según el rol si no viene asignado
    const roleKey = contingentRole || 'JOVEN';
    const plan = await prisma.paymentPlan.findUnique({
      where: { roleKey },
    });

    const newParticipant = await prisma.participant.create({
      data: {
        rut: formattedRut,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim().toLowerCase(),
        phone: phone?.trim() || null,
        birthDate: birthDate ? new Date(birthDate) : null,
        gender: gender || null,
        dietaryRestrictions: dietaryRestrictions?.trim() || null,
        medicalNotes: medicalNotes?.trim() || null,
        guardianName: guardianName?.trim() || null,
        guardianRelationship: guardianRelationship?.trim() || null,
        guardianPhone: guardianPhone?.trim() || null,
        guardianEmail: guardianEmail?.trim() || null,
        scoutZone: scoutZone?.trim() || null,
        scoutDistrict: scoutDistrict?.trim() || null,
        scoutGroup: scoutGroup?.trim() || null,
        contingentRole: roleKey,
        status: status || 'PRE_INSCRITO',
        unitOrPatrol: unitOrPatrol?.trim() || null,
        planId: plan ? plan.id : null,
        notes: notes?.trim() || null,
      },
      include: {
        plan: {
          include: {
            installments: true,
          },
        },
        payments: true,
      },
    });

    const financial = calculateFinancialSummary(
      newParticipant.plan?.installments || [],
      newParticipant.payments || [],
      newParticipant.plan?.totalAmount
    );

    return NextResponse.json(
      { participant: { ...newParticipant, financial } },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating participant:', error);
    return NextResponse.json(
      { error: 'Error al registrar participante' },
      { status: 500 }
    );
  }
}
