import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser, getActiveEventId } from '@/lib/auth';
import { calculateFinancialSummary } from '@/lib/finance';
import * as XLSX from 'xlsx';

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

    const where: any = {};
    if (activeEventId) {
      where.eventId = activeEventId;
    }
    if (role && role !== 'ALL') {
      if (role === 'JOVEN') where.contingentRole = { in: ['Participante', 'Responsable de Patrulla', 'JOVEN'] };
      else if (role === 'DIRIGENTE') where.contingentRole = { in: ['RESPONSABLE', 'DIRIGENTE', 'Educador'] };
      else if (role === 'IST') where.contingentRole = 'IST';
      else if (role === 'CMT') where.contingentRole = 'CMT';
      else where.contingentRole = role;
    }

    if (status && status !== 'ALL') where.status = status;

    if (search) {
      where.OR = [
        { firstName: { contains: search } },
        { lastName: { contains: search } },
        { secondLastName: { contains: search } },
        { rut: { contains: search } },
        { scoutGroup: { contains: search } },
        { scoutZone: { contains: search } },
        { cupoCode: { contains: search } },
        { unitName: { contains: search } },
        { patrolName: { contains: search } },
        { email: { contains: search } },
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
      const totalAmount = p.targetFeeUSD && p.targetFeeUSD > 0
        ? p.targetFeeUSD
        : (p.plan?.totalAmount || 3600);

      const fin = calculateFinancialSummary(
        p.plan?.installments || [],
        p.payments || [],
        totalAmount
      );
      return { ...p, financial: fin, totalAmount };
    });

    const filtered = health && health !== 'ALL'
      ? enriched.filter((p) => {
          if (health === 'AL_DIA') return p.financialStatusSheet === 'Al Día' || p.financial.health === 'AL_DIA';
          if (health === 'EN_MORA') return p.financialStatusSheet === 'Adeuda' || p.financial.health === 'EN_MORA';
          if (health === 'PAGADO_TOTAL') return p.financialStatusSheet === 'Total Pagado' || p.financial.health === 'PAGADO_TOTAL';
          if (health === 'BAJA') return p.financialStatusSheet === 'BAJA' || p.status === 'RETIRADO';
          return true;
        })
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
        'Cuota Final (USD)': p.totalAmount,
        'Abonado Real (USD)': p.financial.totalPaid,
        'Saldo Restante (USD)': remaining,
        'Deuda a Fecha (USD)': p.debtToDateUSD || p.financial.overdueAmount,
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
    const filename = `Contingente_AGSCH_Polonia2027_${new Date().toISOString().split('T')[0]}.xlsx`;

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error('Error in /api/export:', error);
    return NextResponse.json(
      { error: 'Error al exportar los datos' },
      { status: 500 }
    );
  }
}
