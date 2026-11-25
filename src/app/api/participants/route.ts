import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser, getActiveEventId } from '@/lib/auth';
import { calculateFinancialSummary } from '@/lib/finance';
import { formatRut, cleanRut } from '@/lib/rut';

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const paramEventId = searchParams.get('eventId');
    const activeEventId = paramEventId || (await getActiveEventId());
    const search = searchParams.get('search')?.trim().toLowerCase() || '';
    const role = searchParams.get('role')?.trim() || '';
    const status = searchParams.get('status')?.trim() || '';
    const health = searchParams.get('health')?.trim() || '';
    const limit = parseInt(searchParams.get('limit') || '500', 10);
    const page = parseInt(searchParams.get('page') || '1', 10);

    const where: any = {};
    if (activeEventId) {
      where.eventId = activeEventId;
    }

    if (role && role !== 'ALL') {
      if (role === 'JOVEN') {
        where.contingentRole = { in: ['Participante', 'Responsable de Patrulla', 'JOVEN'] };
      } else if (role === 'DIRIGENTE') {
        where.contingentRole = { in: ['RESPONSABLE', 'DIRIGENTE', 'Educador'] };
      } else if (role === 'IST') {
        where.contingentRole = 'IST';
      } else if (role === 'CMT') {
        where.contingentRole = 'CMT';
      } else {
        where.contingentRole = role;
      }
    }

    if (status && status !== 'ALL') {
      where.status = status;
    }

    if (search) {
      const cleanS = cleanRut(search);
      where.OR = [
        { firstName: { contains: search } },
        { lastName: { contains: search } },
        { secondLastName: { contains: search } },
        { rut: { contains: search } },
        { rutClean: { contains: cleanS || search } },
        { scoutGroup: { contains: search } },
        { scoutZone: { contains: search } },
        { scoutDistrict: { contains: search } },
        { email: { contains: search } },
        { cupoCode: { contains: search } },
        { unitName: { contains: search } },
        { patrolName: { contains: search } },
        { city: { contains: search } },
        { commune: { contains: search } },
      ];
    }

    const participants = await prisma.participant.findMany({
      where,
      include: {
        medicalRecord: {
          select: {
            completionStatus: true,
            hasSevereAllergies: true,
            bloodType: true,
            qrAccessCode: true,
          },
        },
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
      take: limit,
      skip: (page - 1) * limit,
    });

    const enriched = participants.map((p) => {
      const totalAmount = p.targetFeeUSD && p.targetFeeUSD > 0
        ? p.targetFeeUSD
        : (p.plan?.totalAmount || 3600);

      const fin = calculateFinancialSummary(
        p.plan?.installments || [],
        p.payments || [],
        totalAmount
      );

      return {
        ...p,
        financial: fin,
      };
    });

    // Filtro por salud financiera si aplica
    const filtered = health && health !== 'ALL'
      ? enriched.filter((p) => {
          if (health === 'AL_DIA') return p.financialStatusSheet === 'Al Día' || p.financial.health === 'AL_DIA';
          if (health === 'EN_MORA') return p.financialStatusSheet === 'Adeuda' || p.financial.health === 'EN_MORA';
          if (health === 'PAGADO_TOTAL') return p.financialStatusSheet === 'Total Pagado' || p.financial.health === 'PAGADO_TOTAL';
          if (health === 'BAJA') return p.financialStatusSheet === 'BAJA' || p.status === 'RETIRADO';
          return true;
        })
      : enriched;

    return NextResponse.json({
      participants: filtered,
      count: filtered.length,
    });
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
    const activeEventId = body.eventId || (await getActiveEventId());

    const {
      rut,
      firstName,
      lastName,
      secondLastName,
      email,
      phone,
      birthDate,
      gender,
      address,
      commune,
      city,
      nationality,
      dietaryRestrictions,
      medicalNotes,
      guardianName,
      guardianPhone,
      guardianEmail,
      scoutZone,
      scoutDistrict,
      scoutGroup,
      contingentRole,
      status,
      unitOrPatrol,
      cupoCode,
      unit,
      unitName,
      patrol,
      patrolName,
      uniformSize,
      targetFeeUSD,
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

    const existing = await prisma.participant.findUnique({
      where: { rut: formattedRut },
    });
    if (existing) {
      return NextResponse.json(
        { error: `El RUT ${formattedRut} ya se encuentra registrado` },
        { status: 409 }
      );
    }

    const rawRole = contingentRole || 'Participante';
    let roleKey = 'JOVEN';
    if (rawRole.toUpperCase().includes('RESPONSABLE') || rawRole.toUpperCase().includes('DIRIGENTE')) {
      roleKey = 'DIRIGENTE';
    } else if (rawRole.toUpperCase().includes('IST') || rawRole.toUpperCase().includes('SERVICIO')) {
      roleKey = 'IST';
    } else if (rawRole.toUpperCase().includes('CMT') || rawRole.toUpperCase().includes('CONTINGENTE')) {
      roleKey = 'CMT';
    }

    const plan = await prisma.paymentPlan.findFirst({
      where: {
        roleKey,
        ...(activeEventId ? { eventId: activeEventId } : {}),
      },
    });

    const newParticipant = await prisma.participant.create({
      data: {
        id: `p_${cleanedRut.toLowerCase()}_${Date.now()}`,
        eventId: activeEventId,
        rut: formattedRut,
        rutClean: cleanedRut,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        secondLastName: secondLastName?.trim() || null,
        email: email.trim().toLowerCase(),
        phone: phone?.trim() || null,
        birthDate: birthDate ? new Date(birthDate) : null,
        gender: gender || null,
        address: address?.trim() || null,
        commune: commune?.trim() || null,
        city: city?.trim() || null,
        nationality: nationality?.trim() || null,
        dietaryRestrictions: dietaryRestrictions?.trim() || null,
        medicalNotes: medicalNotes?.trim() || null,
        guardianName: guardianName?.trim() || null,
        guardianPhone: guardianPhone?.trim() || null,
        guardianEmail: guardianEmail?.trim() || null,
        scoutZone: scoutZone?.trim() || null,
        scoutDistrict: scoutDistrict?.trim() || null,
        scoutGroup: scoutGroup?.trim() || null,
        contingentRole: rawRole,
        status: status || 'CONFIRMADO',
        unitOrPatrol: unitOrPatrol?.trim() || null,
        cupoCode: cupoCode?.trim() || null,
        unit: unit?.trim() || null,
        unitName: unitName?.trim() || null,
        patrol: patrol?.trim() || null,
        patrolName: patrolName?.trim() || null,
        uniformSize: uniformSize?.trim() || null,
        targetFeeUSD: targetFeeUSD ? parseFloat(targetFeeUSD) : null,
        planId: plan ? plan.id : null,
        notes: notes?.trim() || null,
      },
      include: {
        medicalRecord: {
          select: {
            completionStatus: true,
            hasSevereAllergies: true,
            bloodType: true,
            qrAccessCode: true,
          },
        },
        plan: {
          include: { installments: true },
        },
        payments: true,
      },
    });

    const financial = calculateFinancialSummary(
      newParticipant.plan?.installments || [],
      newParticipant.payments || [],
      newParticipant.targetFeeUSD || newParticipant.plan?.totalAmount
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
