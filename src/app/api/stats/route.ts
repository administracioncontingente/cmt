import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser, getActiveEventId, getEventPermissions } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const paramEventId = searchParams.get('eventId');
    const activeEventId = paramEventId || (await getActiveEventId());

    const where: any = {};
    if (activeEventId) {
      where.eventId = activeEventId;
    }

    // Obtener información del evento activo
    const eventInfo = activeEventId
      ? await prisma.event.findUnique({
          where: { id: activeEventId },
          select: {
            id: true,
            code: true,
            name: true,
            shortName: true,
            country: true,
            city: true,
            flagEmoji: true,
            currency: true,
            themeColor: true,
            accentColor: true,
          },
        })
      : null;

    const participants = await prisma.participant.findMany({
      where,
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
        medicalRecord: {
          select: {
            completionStatus: true,
            hasSevereAllergies: true,
            carriesEpiPen: true,
            requiresColdChainMedication: true,
          },
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

    // Métricas Médicas WSJ
    let countFichaCompletada = 0;
    let countFichaPendiente = 0;
    let countAlergiaSevera = 0;
    let countEpiPen = 0;
    let countCadenaFrio = 0;

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
      } else if (p.status?.includes('BAJA') || p.status?.includes('RETIRAD')) {
        statusCounts.RETIRADO++;
      }

      // Financial status from sheet / database
      const fStatus = (p.financialStatusSheet || '').toUpperCase();
      if (fStatus.includes('TOTAL') || fStatus.includes('COMPLETO')) {
        countCompletado++;
      } else if (fStatus.includes('DÍA') || fStatus.includes('DIA')) {
        countAlDia++;
      } else if (fStatus.includes('BAJA')) {
        countBaja++;
      } else {
        countEnMora++;
      }

      // Amounts
      const target = p.targetFeeUSD || p.plan?.totalAmount || 0;
      const realPaid = p.totalPaidSheet !== null && p.totalPaidSheet !== undefined
        ? p.totalPaidSheet
        : p.payments.reduce((acc, pay) => acc + pay.amount, 0);

      const debt = p.debtFinalUSD !== null && p.debtFinalUSD !== undefined
        ? p.debtFinalUSD
        : Math.max(0, target - realPaid);

      const overdue = p.debtToDateUSD || 0;

      totalProjectedUSD += target;
      totalCollectedUSD += realPaid;
      totalOutstandingUSD += debt;
      totalOverdueUSD += overdue;

      // Stats médicas
      if (p.medicalRecord?.completionStatus === 'COMPLETED' || p.medicalRecord?.completionStatus === 'VERIFIED') {
        countFichaCompletada++;
      } else {
        countFichaPendiente++;
      }

      if (p.medicalRecord?.hasSevereAllergies) countAlergiaSevera++;
      if (p.medicalRecord?.carriesEpiPen) countEpiPen++;
      if (p.medicalRecord?.requiresColdChainMedication) countCadenaFrio++;
    });

    const collectionPercentage = totalProjectedUSD > 0
      ? Math.round((totalCollectedUSD / totalProjectedUSD) * 100)
      : 0;

    const userPermissions = activeEventId ? getEventPermissions(user, activeEventId) : null;

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
      event: eventInfo,
      permissions: userPermissions,
      totalParticipants: participants.length,
      totalProjectedUSD,
      totalCollectedUSD,
      totalOutstandingUSD,
      totalOverdueUSD,
      collectionPercentage,
      currency: eventInfo?.currency || 'USD',
      financialSummary: {
        completado: countCompletado,
        alDia: countAlDia,
        enMora: countEnMora,
        baja: countBaja,
      },
      roleBreakdown: roleCounts,
      statusBreakdown: statusCounts,
      medicalSummary: {
        completadas: countFichaCompletada,
        pendientes: countFichaPendiente,
        alergiasSeveras: countAlergiaSevera,
        portaEpiPen: countEpiPen,
        cadenaFrio: countCadenaFrio,
      },
    });
  } catch (error: any) {
    console.error('Error calculating stats:', error);
    return NextResponse.json(
      { error: 'Error interno al calcular estadísticas: ' + error.message },
      { status: 500 }
    );
  }
}
