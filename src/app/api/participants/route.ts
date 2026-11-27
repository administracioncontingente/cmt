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

type ParticipantSortField = 'name' | 'paid' | 'remaining' | 'role';
type SortDirection = 'asc' | 'desc';

function parseSortField(raw: string | null): ParticipantSortField {
  if (raw === 'paid' || raw === 'remaining' || raw === 'role' || raw === 'name') {
    return raw;
  }
  return 'name';
}

function parseSortDirection(raw: string | null): SortDirection {
  return raw === 'desc' ? 'desc' : 'asc';
}

function matchesMedicalFilter(
  medicalRecord: {
    completionStatus?: string | null;
    hasSevereAllergies?: boolean | null;
    carriesEpiPen?: boolean | null;
    requiresColdChainMedication?: boolean | null;
  } | null,
  medicalFilter: string
): boolean {
  if (!medicalFilter || medicalFilter === 'ALL') return true;
  const status = medicalRecord?.completionStatus;
  switch (medicalFilter) {
    case 'COMPLETED':
      return status === 'COMPLETED' || status === 'VERIFIED';
    case 'PENDING':
      return status !== 'COMPLETED' && status !== 'VERIFIED';
    case 'SEVERE_ALLERGY':
      return Boolean(medicalRecord?.hasSevereAllergies);
    case 'EPIPEN':
      return Boolean(medicalRecord?.carriesEpiPen);
    case 'COLD_CHAIN':
      return Boolean(medicalRecord?.requiresColdChainMedication);
    default:
      return true;
  }
}

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

    const rawLimit = searchParams.get('limit');
    const rawPage = searchParams.get('page');
    const defaultLimit = rawPage !== null ? 50 : 500;
    const parsedLimit = rawLimit !== null ? Number.parseInt(rawLimit, 10) : defaultLimit;
    const parsedPage = rawPage !== null ? Number.parseInt(rawPage, 10) : 1;
    const limit = Number.isFinite(parsedLimit)
      ? Math.min(1000, Math.max(1, parsedLimit))
      : defaultLimit;
    const page = Number.isFinite(parsedPage) ? Math.max(1, parsedPage) : 1;

    if (!activeEventId) {
      return NextResponse.json({
        participants: [],
        count: 0,
        totalCount: 0,
        page,
        limit,
        totalPages: 1,
      });
    }

    const permissions = getEventPermissions(user, activeEventId);
    if (!permissions.canView) {
      return NextResponse.json({ error: 'No tienes acceso a este evento' }, { status: 403 });
    }

    const search = searchParams.get('search')?.trim() || '';
    const role = searchParams.get('role')?.trim() || '';
    const status = searchParams.get('status')?.trim() || '';
    const health = searchParams.get('health')?.trim() || '';
    const medical = searchParams.get('medical')?.trim().toUpperCase() || '';
    const sortBy = parseSortField(searchParams.get('sortBy')?.trim() || null);
    const sortDir = parseSortDirection(searchParams.get('sortDir')?.trim() || null);

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
            carriesEpiPen: true,
            requiresColdChainMedication: true,
            bloodType: true,
            qrAccessCode: true,
            emergencyContactName: true,
            emergencyContactPhone: true,
            declaredAt: true,
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

    // Filtros en memoria (salud financiera + ficha médica) antes de paginar
    const healthFiltered =
      health && health !== 'ALL'
        ? enriched.filter((p) => matchesHealthFilter(p, health))
        : enriched;

    const medicalFiltered =
      medical && medical !== 'ALL'
        ? healthFiltered.filter((p) => matchesMedicalFilter(p.medicalRecord, medical))
        : healthFiltered;

    const getPaid = (p: (typeof enriched)[number]): number =>
      p.financial?.totalPaid ?? p.totalPaidSheet ?? 0;

    const getRemaining = (p: (typeof enriched)[number]): number => {
      const totalAmount = resolveParticipantTargetAmount(p.targetFeeUSD, p.plan?.totalAmount);
      return Math.max(0, totalAmount - getPaid(p));
    };

    const compareByName = (a: (typeof enriched)[number], b: (typeof enriched)[number]): number => {
      const lastCmp = (a.lastName || '').localeCompare(b.lastName || '', 'es', {
        sensitivity: 'base',
      });
      if (lastCmp !== 0) return lastCmp;
      return (a.firstName || '').localeCompare(b.firstName || '', 'es', {
        sensitivity: 'base',
      });
    };

    const dir = sortDir === 'desc' ? -1 : 1;
    const sorted = [...medicalFiltered].sort((a, b) => {
      if (sortBy === 'paid') {
        const diff = getPaid(a) - getPaid(b);
        if (diff !== 0) return diff * dir;
        return compareByName(a, b);
      }
      if (sortBy === 'remaining') {
        const diff = getRemaining(a) - getRemaining(b);
        if (diff !== 0) return diff * dir;
        return compareByName(a, b);
      }
      if (sortBy === 'role') {
        const roleCmp = (a.contingentRole || '').localeCompare(b.contingentRole || '', 'es', {
          sensitivity: 'base',
        });
        if (roleCmp !== 0) return roleCmp * dir;
        return compareByName(a, b);
      }
      return compareByName(a, b) * dir;
    });

    const totalCount = sorted.length;
    const totalPages = Math.max(1, Math.ceil(totalCount / limit));
    const paged = sorted.slice((page - 1) * limit, page * limit);

    return NextResponse.json({
      participants: paged,
      count: paged.length,
      totalCount,
      page,
      limit,
      totalPages,
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
