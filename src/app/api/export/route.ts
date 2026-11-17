import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import { calculateFinancialSummary } from '@/lib/finance';
import * as XLSX from 'xlsx';

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
    if (role && role !== 'ALL') where.contingentRole = role;
    if (status && status !== 'ALL') where.status = status;
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
            installments: { orderBy: { installmentNumber: 'asc' } },
          },
        },
        payments: true,
      },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    });

    const enriched = participants.map((p) => {
      const fin = calculateFinancialSummary(
        p.plan?.installments || [],
        p.payments || [],
        p.plan?.totalAmount
      );
      return { ...p, financial: fin };
    });

    const filtered = health && health !== 'ALL'
      ? enriched.filter((p) => p.financial.health === health)
      : enriched;

    const roleLabels: Record<string, string> = {
      JOVEN: 'Joven / Participante',
      DIRIGENTE: 'Dirigente de Unidad',
      IST: 'IST (Servicio)',
      CMT: 'Equipo de Contingente',
    };

    const statusLabels: Record<string, string> = {
      PRE_INSCRITO: 'Preinscrito',
      CONFIRMADO: 'Confirmado',
      LISTA_ESPERA: 'Lista de Espera',
      RETIRADO: 'Retirado',
    };

    const healthLabels: Record<string, string> = {
      AL_DIA: 'Al día',
      EN_MORA: 'En mora',
      PAGADO_TOTAL: 'Pagado total',
    };

    const dataRows = filtered.map((p) => ({
      'RUT': p.rut,
      'Nombres': p.firstName,
      'Apellidos': p.lastName,
      'Rol Contingente': roleLabels[p.contingentRole] || p.contingentRole,
      'Estado Inscripción': statusLabels[p.status] || p.status,
      'Correo': p.email,
      'Teléfono': p.phone || '',
      'Zona Scout': p.scoutZone || '',
      'Distrito Scout': p.scoutDistrict || '',
      'Grupo Scout': p.scoutGroup || '',
      'Unidad / Patrulla': p.unitOrPatrol || '',
      'Total Plan (USD)': p.financial.totalRequired,
      'Abonado (USD)': p.financial.totalPaid,
      'Saldo Pendiente (USD)': p.financial.balanceRemaining,
      'Monto en Mora (USD)': p.financial.overdueAmount,
      'Estado Financiero': healthLabels[p.financial.health] || p.financial.health,
      'Apoderado': p.guardianName || '',
      'Teléfono Apoderado': p.guardianPhone || '',
      'Restricciones Dietarias': p.dietaryRestrictions || '',
      'Notas Médicas': p.medicalNotes || '',
    }));

    const worksheet = XLSX.utils.json_to_sheet(dataRows);

    // Ajustar anchos de columnas
    const colWidths = [
      { wch: 14 }, // RUT
      { wch: 18 }, // Nombres
      { wch: 20 }, // Apellidos
      { wch: 22 }, // Rol
      { wch: 18 }, // Estado
      { wch: 26 }, // Correo
      { wch: 16 }, // Telefono
      { wch: 18 }, // Zona
      { wch: 18 }, // Distrito
      { wch: 26 }, // Grupo
      { wch: 24 }, // Unidad
      { wch: 16 }, // Total USD
      { wch: 15 }, // Abonado USD
      { wch: 18 }, // Saldo USD
      { wch: 18 }, // Mora USD
      { wch: 16 }, // Estado Fin
      { wch: 22 }, // Apoderado
      { wch: 18 }, // Tel Apoderado
      { wch: 22 }, // Dieta
      { wch: 22 }, // Medico
    ];
    worksheet['!cols'] = colWidths;

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Contingente Polonia 2027');

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
