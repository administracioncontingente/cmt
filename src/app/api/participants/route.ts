import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { getCurrentUser, resolveAuthorizedEventId, getEventPermissions } from '@/lib/auth';
import {
  calculateFinancialSummary,
  resolveParticipantTargetAmount,
  matchesHealthFilter,
} from '@/lib/finance';
import { formatRut, cleanRut } from '@/lib/rut';
import { buildRoleWhereClause, normalizeRoleKey } from '@/lib/roles';
import { apiErrorResponse, parseOptionalDate, parseOptionalFloat } from '@/lib/apiUtils';

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const paramEventId = searchParams.get('eventId');
    const { eventId: activeEventId, forbidden } = await resolveAuthorizedEventId(user, paramEventId);

    if (forbidden) {
      return NextResponse.json({ error: 'No tienes acceso a este evento' }, { status: 403 });
    }

    if (!activeEventId) {
      return NextResponse.json({ participants: [], count: 0 });
    }

    const permissions = getEventPermissions(user, activeEventId);
    if (!permissions.canView) {
      return NextResponse.json({ error: 'No tienes acceso a este evento' }, { status: 403 });
    }

    const search = searchParams.get('search')?.trim() || '';
    const role = searchParams.get('role')?.trim() || '';
    const status = searchParams.get('status')?.trim() || '';
    const health = searchParams.get('health')?.trim() || '';

    const rawLimit = searchParams.get('limit');
    const rawPage = searchParams.get('page');
    const parsedLimit = rawLimit !== null ? Number.parseInt(rawLimit, 10) : 500;
    const parsedPage = rawPage !== null ? Number.parseInt(rawPage, 10) : 1;
    const limit = Number.isFinite(parsedLimit) ? Math.min(1000, Math.max(1, parsedLimit)) : 500;
    const page = Number.isFinite(parsedPage) ? Math.max(1, parsedPage) : 1;

    const where: Prisma.ParticipantWhereInput = { eventId: activeEventId };

    if (role && role !== 'ALL') {
      const roleFilter = buildRoleWhereClause(role);
      if (roleFilter.contingentRole !== undefined) {
        where.contingentRole = roleFilter.contingentRole;
      }
    }

    if (status && status !== 'ALL') {
      where.status = status;
    }

    if (search) {
      const cleanS = cleanRut(search);
      where.OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { secondLastName: { contains: search, mode: 'insensitive' } },
        { rut: { contains: search, mode: 'insensitive' } },
        { rutClean: { contains: cleanS || search, mode: 'insensitive' } },
        { scoutGroup: { contains: search, mode: 'insensitive' } },
        { scoutZone: { contains: search, mode: 'insensitive' } },
        { scoutDistrict: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { cupoCode: { contains: search, mode: 'insensitive' } },
        { unitName: { contains: search, mode: 'insensitive' } },
        { patrolName: { contains: search, mode: 'insensitive' } },
        { city: { contains: search, mode: 'insensitive' } },
        { commune: { contains: search, mode: 'insensitive' } },
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
      const totalAmount = resolveParticipantTargetAmount(p.targetFeeUSD, p.plan?.totalAmount);
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
      ? enriched.filter((p) => matchesHealthFilter(p, health))
      : enriched;

    return NextResponse.json({
      participants: filtered,
      count: filtered.length,
    });
  } catch (error: unknown) {
    return apiErrorResponse(error, 'Error al obtener la lista de participantes', 500);
  }
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  try {
    const body = (await req.json()) as Record<string, unknown>;
    const requestedEventId = typeof body.eventId === 'string' ? body.eventId : null;
    const { eventId: activeEventId, forbidden } = await resolveAuthorizedEventId(user, requestedEventId);

    if (forbidden) {
      return NextResponse.json({ error: 'No tienes acceso a este evento' }, { status: 403 });
    }

    if (!activeEventId) {
      return NextResponse.json(
        { error: 'Se requiere un evento activo para registrar un participante' },
        { status: 400 }
      );
    }

    const permissions = getEventPermissions(user, activeEventId);
    if (!permissions.canEditParticipants) {
      return NextResponse.json(
        { error: 'No tienes permisos para registrar participantes en este evento' },
        { status: 403 }
      );
    }

    const rut = typeof body.rut === 'string' ? body.rut : '';
    const firstName = typeof body.firstName === 'string' ? body.firstName : '';
    const lastName = typeof body.lastName === 'string' ? body.lastName : '';
    const email = typeof body.email === 'string' ? body.email : '';

    if (!rut.trim() || !firstName.trim() || !lastName.trim() || !email.trim()) {
      return NextResponse.json(
        { error: 'RUT, nombres, apellidos y correo son obligatorios' },
        { status: 400 }
      );
    }

    const cleanedRut = cleanRut(rut);
    if (cleanedRut.length < 2) {
      return NextResponse.json({ error: 'RUT inválido' }, { status: 400 });
    }
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

    let parsedBirthDate: Date | null = null;
    if (body.birthDate !== undefined && body.birthDate !== null && body.birthDate !== '') {
      parsedBirthDate = parseOptionalDate(body.birthDate);
      if (!parsedBirthDate) {
        return NextResponse.json({ error: 'Fecha de nacimiento inválida' }, { status: 400 });
      }
    }

    const rawRole = typeof body.contingentRole === 'string' && body.contingentRole.trim()
      ? body.contingentRole.trim()
      : 'Participante';
    const roleKey = normalizeRoleKey(rawRole);

    const plan = await prisma.paymentPlan.findFirst({
      where: {
        roleKey,
        eventId: activeEventId,
      },
    });

    const optStr = (val: unknown): string | null =>
      typeof val === 'string' && val.trim() ? val.trim() : null;

    const newParticipant = await prisma.participant.create({
      data: {
        id: `p_${cleanedRut.toLowerCase()}_${Date.now()}`,
        eventId: activeEventId,
        rut: formattedRut,
        rutClean: cleanedRut,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        secondLastName: optStr(body.secondLastName),
        email: email.trim().toLowerCase(),
        phone: optStr(body.phone),
        birthDate: parsedBirthDate,
        gender: optStr(body.gender),
        address: optStr(body.address),
        commune: optStr(body.commune),
        city: optStr(body.city),
        nationality: optStr(body.nationality),
        dietaryRestrictions: optStr(body.dietaryRestrictions),
        medicalNotes: optStr(body.medicalNotes),
        guardianName: optStr(body.guardianName),
        guardianPhone: optStr(body.guardianPhone),
        guardianEmail: optStr(body.guardianEmail),
        scoutZone: optStr(body.scoutZone),
        scoutDistrict: optStr(body.scoutDistrict),
        scoutGroup: optStr(body.scoutGroup),
        contingentRole: rawRole,
        status: optStr(body.status) || 'CONFIRMADO',
        unitOrPatrol: optStr(body.unitOrPatrol),
        cupoCode: optStr(body.cupoCode),
        unit: optStr(body.unit),
        unitName: optStr(body.unitName),
        patrol: optStr(body.patrol),
        patrolName: optStr(body.patrolName),
        uniformSize: optStr(body.uniformSize),
        targetFeeUSD: parseOptionalFloat(body.targetFeeUSD),
        planId: plan ? plan.id : null,
        notes: optStr(body.notes),
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

    const targetAmount = resolveParticipantTargetAmount(
      newParticipant.targetFeeUSD,
      newParticipant.plan?.totalAmount
    );
    const financial = calculateFinancialSummary(
      newParticipant.plan?.installments || [],
      newParticipant.payments || [],
      targetAmount
    );

    return NextResponse.json(
      { participant: { ...newParticipant, financial } },
      { status: 201 }
    );
  } catch (error: unknown) {
    return apiErrorResponse(error, 'Error al registrar participante', 500);
  }
}
