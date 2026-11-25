import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { getCurrentUser, resolveAuthorizedEventId, getEventPermissions } from '@/lib/auth';
import {
  calculateFinancialSummary,
  resolveParticipantTargetAmount,
  matchesHealthFilter,
} from '@/lib/finance';
import { buildRoleWhereClause } from '@/lib/roles';
import { cleanRut } from '@/lib/rut';
import { apiErrorResponse } from '@/lib/apiUtils';
import * as XLSX from 'xlsx';

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
      return NextResponse.json(
        { error: 'No hay un evento activo seleccionado para exportar' },
        { status: 400 }
      );
    }

    const permissions = getEventPermissions(user, activeEventId);
    if (!permissions.canView) {
      return NextResponse.json({ error: 'No tienes acceso a este evento' }, { status: 403 });
    }

    const event = await prisma.event.findUnique({
      where: { id: activeEventId },
      select: { id: true, code: true, currency: true },
    });

    const currency = event?.currency || 'USD';
    const eventCode = (event?.code || 'EVENTO').replace(/[^a-zA-Z0-9_-]/g, '_');

    const search = searchParams.get('search')?.trim() || '';
    const role = searchParams.get('role')?.trim() || '';
    const status = searchParams.get('status')?.trim() || '';
    const health = searchParams.get('health')?.trim() || '';

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
        plan: {
          include: {
            installments: { orderBy: { installmentNumber: 'asc' } },
          },
        },
        payments: true,
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
      return { ...p, financial: fin, totalAmount };
    });

    const filtered = health && health !== 'ALL'
      ? enriched.filter((p) => matchesHealthFilter(p, health))
      : enriched;

    const dataRows = filtered.map((p) => {
      const remaining = Math.max(0, p.totalAmount - p.financial.totalPaid);
      return {
        'Código Cupo': p.cupoCode || '',
        'RUT': p.rut,
        'Nombres': p.firstName,
        'Primer Apellido': p.lastName,
        'Segundo Apellido': p.secondLastName || '',
        'Rol Contingente': p.contingentRole,
        'Estado': p.status,
        'Correo': p.email,
        'Teléfono': p.phone || '',
        'Comuna': p.commune || '',
        'Ciudad': p.city || '',
        'Zona Scout': p.scoutZone || '',
        'Distrito Scout': p.scoutDistrict || '',
        'Grupo Scout': p.scoutGroup || '',
        'Territorium': p.territorium || '',
        'Unidad': p.unitName || p.unit || '',
        'Patrulla': p.patrolName || p.patrol || '',
        'Talla Indumentaria': p.uniformSize || '',
        'Registro Polonia': p.polandRegistered || '',
        [`Cuota Final (${currency})`]: p.totalAmount,
        [`Abonado Real (${currency})`]: p.financial.totalPaid,
        [`Saldo Restante (${currency})`]: remaining,
        [`Deuda a Fecha (${currency})`]: p.debtToDateUSD ?? p.financial.overdueAmount,
        'Situación Financiera': p.financialStatusSheet || (p.financial.isFullyPaid ? 'Total Pagado' : 'Al Día'),
        'Nombre Apoderado': p.guardianName || '',
        'Teléfono Apoderado': p.guardianPhone || '',
        'Correo Apoderado': p.guardianEmail || '',
        'Cédula Drive URL': p.idCardUrl || '',
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(dataRows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Nómina Contingente AGSCH');

    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    const date = new Date().toISOString().split('T')[0];
    const filename = `Contingente_AGSCH_${eventCode}_${date}.xlsx`;

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error: unknown) {
    return apiErrorResponse(error, 'Error al exportar los datos', 500);
  }
}
