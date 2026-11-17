import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import { calculateFinancialSummary } from '@/lib/finance';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  try {
    const participants = await prisma.participant.findMany({
      include: {
        plan: {
          include: {
            installments: { orderBy: { installmentNumber: 'asc' } },
          },
        },
        payments: true,
      },
    });

    let totalProjectedUSD = 0;
    let totalCollectedUSD = 0;
    let totalOutstandingUSD = 0;
    let totalOverdueUSD = 0;

    let countAlDia = 0;
    let countEnMora = 0;
    let countCompletado = 0;

    const roleCounts = {
      JOVEN: 0,
      DIRIGENTE: 0,
      IST: 0,
      CMT: 0,
    };

    const statusCounts = {
      PRE_INSCRITO: 0,
      CONFIRMADO: 0,
      LISTA_ESPERA: 0,
      RETIRADO: 0,
    };

    participants.forEach((p) => {
      // Role
      if (p.contingentRole in roleCounts) {
        roleCounts[p.contingentRole as keyof typeof roleCounts]++;
      }
      // Status
      if (p.status in statusCounts) {
        statusCounts[p.status as keyof typeof statusCounts]++;
      }

      const fin = calculateFinancialSummary(
        p.plan?.installments || [],
        p.payments || [],
        p.plan?.totalAmount
      );

      totalProjectedUSD += fin.totalRequired;
      totalCollectedUSD += fin.totalPaid;
      totalOutstandingUSD += fin.balanceRemaining;
      totalOverdueUSD += fin.overdueAmount;

      if (fin.health === 'PAGADO_TOTAL') {
        countCompletado++;
      } else if (fin.health === 'EN_MORA') {
        countEnMora++;
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
