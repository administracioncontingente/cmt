import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { getCurrentUser, resolveAuthorizedEventId, getEventPermissions } from '@/lib/auth';
import { apiErrorResponse } from '@/lib/apiUtils';
import { normalizeRoleKey } from '@/lib/roles';

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
      const emptyRoleCounts: Record<string, number> = { JOVEN: 0, DIRIGENTE: 0, IST: 0, CMT: 0 };
      const emptyStatusCounts: Record<string, number> = {
        CONFIRMADO: 0,
        PRE_INSCRITO: 0,
        LISTA_ESPERA: 0,
        RETIRADO: 0,
      };
      return NextResponse.json({
        summary: {
          totalParticipants: 0,
          totalProjectedUSD: 0,
          totalCollectedUSD: 0,
          totalOutstandingUSD: 0,
          totalOverdueUSD: 0,
          countAlDia: 0,
          countEnMora: 0,
          countCompletado: 0,
          countBaja: 0,
          roleCounts: emptyRoleCounts,
          statusCounts: emptyStatusCounts,
        },
        event: null,
        permissions: null,
        totalParticipants: 0,
        totalProjectedUSD: 0,
        totalCollectedUSD: 0,
        totalOutstandingUSD: 0,
        totalOverdueUSD: 0,
        collectionPercentage: 0,
        currency: 'USD',
        financialSummary: { completado: 0, alDia: 0, enMora: 0, baja: 0 },
        roleBreakdown: emptyRoleCounts,
        statusBreakdown: emptyStatusCounts,
        medicalSummary: {
          completadas: 0,
          pendientes: 0,
          alergiasSeveras: 0,
          portaEpiPen: 0,
          cadenaFrio: 0,
        },
      });
    }

    const userPermissions = getEventPermissions(user, activeEventId);
    if (!userPermissions.canView) {
      return NextResponse.json({ error: 'No tienes acceso a este evento' }, { status: 403 });
    }

    const where: Prisma.ParticipantWhereInput = { eventId: activeEventId };

    // Obtener información del evento activo
    const eventInfo = await prisma.event.findUnique({
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
        isPublicPagePublished: true,
      },
    });

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

    const round2 = (n: number) => Math.round(n * 100) / 100;

    let activeParticipantsCount = 0;
    let totalProjectedUSD = 0;
    let totalCollectedUSD = 0;
    let bajaCollectedUSD = 0;
    let totalOutstandingUSD = 0;
    let totalOverdueUSD = 0;

    let countAlDia = 0;
    let countEnMora = 0;
    let countCompletado = 0;
    let countBaja = 0;

    // Métricas Médicas WSJ (sobre contingente activo)
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
      const fStatus = (p.financialStatusSheet || '').toUpperCase();
      const isBaja =
        p.status === 'RETIRADO' ||
        p.status?.toUpperCase().includes('BAJA') ||
        p.status?.toUpperCase().includes('RETIRAD') ||
        fStatus.includes('BAJA');

      const realPaid =
        p.totalPaidSheet !== null && p.totalPaidSheet !== undefined
          ? p.totalPaidSheet
          : p.payments.reduce((acc, pay) => acc + pay.amount, 0);

      if (isBaja) {
        countBaja++;
        statusCounts.RETIRADO++;
        bajaCollectedUSD += realPaid;
        return;
      }

      activeParticipantsCount++;

      // Role categorizing (solo activos)
      const roleKey = normalizeRoleKey(p.contingentRole);
      roleCounts[roleKey] = (roleCounts[roleKey] || 0) + 1;

      // Status categorizing (solo activos)
      if (p.status in statusCounts) {
        statusCounts[p.status]++;
      }

      // Financial status from sheet / database
      if (fStatus.includes('TOTAL') || fStatus.includes('COMPLETO')) {
        countCompletado++;
      } else if (fStatus.includes('DÍA') || fStatus.includes('DIA')) {
        countAlDia++;
      } else {
        countEnMora++;
      }

      // Amounts (solo activos; respetar targetFeeUSD = 0 explícito)
      const target =
        p.targetFeeUSD !== null && p.targetFeeUSD !== undefined
          ? p.targetFeeUSD
          : (p.plan?.totalAmount ?? 0);

      const debt =
        p.debtFinalUSD !== null && p.debtFinalUSD !== undefined
          ? p.debtFinalUSD
          : Math.max(0, target - realPaid);

      const overdue = p.debtToDateUSD ?? 0;

      totalProjectedUSD += target;
      totalCollectedUSD += realPaid;
      totalOutstandingUSD += debt;
      totalOverdueUSD += overdue;

      // Stats médicas (contingente activo)
      if (
        p.medicalRecord?.completionStatus === 'COMPLETED' ||
        p.medicalRecord?.completionStatus === 'VERIFIED'
      ) {
        countFichaCompletada++;
      } else {
        countFichaPendiente++;
      }

      if (p.medicalRecord?.hasSevereAllergies) countAlergiaSevera++;
      if (p.medicalRecord?.carriesEpiPen) countEpiPen++;
      if (p.medicalRecord?.requiresColdChainMedication) countCadenaFrio++;
    });

    totalProjectedUSD = round2(totalProjectedUSD);
    totalCollectedUSD = round2(totalCollectedUSD);
    bajaCollectedUSD = round2(bajaCollectedUSD);
    totalOutstandingUSD = round2(totalOutstandingUSD);
    totalOverdueUSD = round2(totalOverdueUSD);

    const collectionPercentage =
      totalProjectedUSD > 0 ? Math.round((totalCollectedUSD / totalProjectedUSD) * 100) : 0;

    return NextResponse.json({
      summary: {
        totalParticipants: activeParticipantsCount,
        totalRegistered: participants.length,
        totalProjectedUSD,
        totalCollectedUSD,
        bajaCollectedUSD,
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
      totalParticipants: activeParticipantsCount,
      totalRegistered: participants.length,
      totalProjectedUSD,
      totalCollectedUSD,
      bajaCollectedUSD,
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
  } catch (error: unknown) {
    return apiErrorResponse(error, 'Error interno al calcular estadísticas', 500);
  }
}
