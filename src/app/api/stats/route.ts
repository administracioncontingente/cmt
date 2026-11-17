import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  try {
    const participants = await prisma.participant.findMany({
      select: {
        id: true,
        contingentRole: true,
        status: true,
        targetFeeUSD: true,
        totalPaidSheet: true,
        debtFinalUSD: true,
        debtToDateUSD: true,
        financialStatusSheet: true,
        plan: {
          select: { totalAmount: true },
        },
        payments: {
          select: { amount: true },
        },
      },
    });

    let totalProjectedUSD = 0;
    let totalCollectedUSD = 0;
    let totalOutstandingUSD = 0;
    let totalOverdueUSD = 0;

    let countAlDia = 0;
    let countEnMora = 0;
    let countCompletado = 0;
    let countBaja = 0;

    const roleCounts: Record<string, number> = {
      JOVEN: 0,
      DIRIGENTE: 0,
      IST: 0,
      CMT: 0,
    };

    const statusCounts: Record<string, number> = {
      CONFIRMADO: 0,
      PRE_INSCRITO: 0,
      LISTA_ESPERA: 0,
      RETIRADO: 0,
    };

    participants.forEach((p) => {
      // Role categorizing
      const r = (p.contingentRole || '').toUpperCase();
      if (r.includes('RESPONSABLE') || r.includes('DIRIGENTE')) {
        roleCounts.DIRIGENTE++;
      } else if (r.includes('IST') || r.includes('SERVICIO')) {
        roleCounts.IST++;
      } else if (r.includes('CMT')) {
        roleCounts.CMT++;
      } else {
        roleCounts.JOVEN++;
      }

      // Status categorizing
      if (p.status in statusCounts) {
        statusCounts[p.status]++;
      } else {
        statusCounts.CONFIRMADO++;
      }

      const target = p.targetFeeUSD && p.targetFeeUSD > 0
        ? p.targetFeeUSD
        : (p.plan?.totalAmount || 3600);

      const paid = p.payments.reduce((sum, pay) => sum + pay.amount, 0);
      const remaining = Math.max(0, target - paid);

      totalProjectedUSD += target;
      totalCollectedUSD += paid;
      totalOutstandingUSD += remaining;

      if (p.debtToDateUSD && p.debtToDateUSD > 0) {
        totalOverdueUSD += p.debtToDateUSD;
      }

      // Financial status from sheet or calculated
      const sheetStatus = p.financialStatusSheet || '';
      if (sheetStatus === 'Total Pagado' || (target > 0 && paid >= target)) {
        countCompletado++;
      } else if (sheetStatus === 'Adeuda' || (p.debtToDateUSD && p.debtToDateUSD > 0)) {
        countEnMora++;
      } else if (sheetStatus === 'BAJA' || p.status === 'RETIRADO') {
        countBaja++;
      } else {
        countAlDia++;
      }
    });

    // Recent payments
    const recentPayments = await prisma.payment.findMany({
      take: 6,
      orderBy: { paymentDate: 'desc' },
      include: {
        participant: {
          select: {
            firstName: true,
            lastName: true,
            rut: true,
            contingentRole: true,
          },
        },
      },
    });

    return NextResponse.json({
      summary: {
        totalParticipants: participants.length,
        totalProjectedUSD,
        totalCollectedUSD,
        totalOutstandingUSD,
        totalOverdueUSD,
        countAlDia,
        countEnMora,
        countCompletado,
        countBaja,
        roleCounts,
        statusCounts,
      },
      recentPayments,
    });
  } catch (error) {
    console.error('Error in /api/stats:', error);
    return NextResponse.json(
      { error: 'Error al calcular estadísticas' },
      { status: 500 }
    );
  }
}
