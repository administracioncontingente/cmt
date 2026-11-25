import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser, getEventPermissions } from '@/lib/auth';
import { computeSheetSyncFields } from '@/lib/finance';
import { apiErrorResponse, parseOptionalDate, parseOptionalFloat } from '@/lib/apiUtils';

const fullParticipantInclude = {
  medicalRecord: true,
  plan: {
    include: {
      installments: { orderBy: { installmentNumber: 'asc' as const } },
    },
  },
  payments: {
    include: {
      registeredBy: { select: { id: true, name: true, email: true } },
    },
    orderBy: { paymentDate: 'desc' as const },
  },
  emailMessages: {
    orderBy: { date: 'desc' as const },
  },
  incidents: {
    orderBy: { createdAt: 'desc' as const },
    include: {
      assignedTo: { select: { id: true, name: true } },
      comments: true,
    },
  },
};

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const { id: participantId } = await params;

  try {
    const body = (await req.json()) as Record<string, unknown>;
    const { amount, paymentDate, paymentMethod, transactionReference, notes } = body;

    const numAmount = parseOptionalFloat(amount);
    if (numAmount === null || numAmount <= 0) {
      return NextResponse.json(
        { error: 'El monto del abono debe ser mayor a 0' },
        { status: 400 }
      );
    }

    const participant = await prisma.participant.findUnique({
      where: { id: participantId },
      select: { id: true, eventId: true },
    });

    if (!participant) {
      return NextResponse.json(
        { error: 'Participante no encontrado' },
        { status: 404 }
      );
    }

    if (participant.eventId) {
      if (!getEventPermissions(user, participant.eventId).canManageFinance) {
        return NextResponse.json(
          { error: 'No tienes permisos financieros en este evento' },
          { status: 403 }
        );
      }
    } else if (user.role !== 'SUPER_ADMIN') {
      return NextResponse.json(
        { error: 'No tienes permisos financieros para este participante' },
        { status: 403 }
      );
    }

    const parsedDate = parseOptionalDate(paymentDate) ?? new Date();
    const methodStr =
      typeof paymentMethod === 'string' && paymentMethod.trim()
        ? paymentMethod.trim()
        : 'TRANSFERENCIA';
    const refStr =
      typeof transactionReference === 'string' && transactionReference.trim()
        ? transactionReference.trim()
        : null;
    const notesStr = typeof notes === 'string' && notes.trim() ? notes.trim() : null;

    const result = await prisma.$transaction(async (tx) => {
      const payment = await tx.payment.create({
        data: {
          participantId,
          amount: numAmount,
          paymentDate: parsedDate,
          paymentMethod: methodStr,
          transactionReference: refStr,
          notes: notesStr,
          registeredById: user.id,
        },
      });

      const currentParticipant = await tx.participant.findUnique({
        where: { id: participantId },
        include: {
          plan: {
            include: {
              installments: { orderBy: { installmentNumber: 'asc' } },
            },
          },
          payments: {
            orderBy: { paymentDate: 'desc' },
          },
        },
      });

      const syncFields = computeSheetSyncFields({
        installments: currentParticipant?.plan?.installments || [],
        payments: currentParticipant?.payments || [],
        targetFeeUSD: currentParticipant?.targetFeeUSD,
        planTotalAmount: currentParticipant?.plan?.totalAmount,
        currentStatus: currentParticipant?.status || 'CONFIRMADO',
      });

      const updatedParticipant = await tx.participant.update({
        where: { id: participantId },
        data: {
          totalPaidSheet: syncFields.totalPaidSheet,
          debtFinalUSD: syncFields.debtFinalUSD,
          debtToDateUSD: syncFields.debtToDateUSD,
          overpaymentUSD: syncFields.overpaymentUSD,
          financialStatusSheet: syncFields.financialStatusSheet,
        },
        include: fullParticipantInclude,
      });

      return { payment, updatedParticipant, financial: syncFields.financial };
    });

    return NextResponse.json({
      success: true,
      payment: result.payment,
      participant: { ...result.updatedParticipant, financial: result.financial },
    });
  } catch (error: unknown) {
    return apiErrorResponse(error, 'Error al registrar el abono', 500);
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const { id: participantId } = await params;

  try {
    const { searchParams } = new URL(req.url);
    const paymentId = searchParams.get('paymentId');

    if (!paymentId) {
      return NextResponse.json(
        { error: 'paymentId requerido' },
        { status: 400 }
      );
    }

    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
      include: {
        participant: {
          select: { id: true, eventId: true },
        },
      },
    });

    if (!payment || payment.participantId !== participantId) {
      return NextResponse.json(
        { error: 'Abono no encontrado para este participante' },
        { status: 404 }
      );
    }

    if (payment.participant.eventId) {
      if (!getEventPermissions(user, payment.participant.eventId).canManageFinance) {
        return NextResponse.json(
          { error: 'No tienes permisos financieros en este evento' },
          { status: 403 }
        );
      }
    } else if (user.role !== 'SUPER_ADMIN') {
      return NextResponse.json(
        { error: 'No tienes permisos financieros para este participante' },
        { status: 403 }
      );
    }

    const result = await prisma.$transaction(async (tx) => {
      await tx.payment.delete({ where: { id: paymentId } });

      const currentParticipant = await tx.participant.findUnique({
        where: { id: participantId },
        include: {
          plan: {
            include: {
              installments: { orderBy: { installmentNumber: 'asc' } },
            },
          },
          payments: {
            orderBy: { paymentDate: 'desc' },
          },
        },
      });

      const syncFields = computeSheetSyncFields({
        installments: currentParticipant?.plan?.installments || [],
        payments: currentParticipant?.payments || [],
        targetFeeUSD: currentParticipant?.targetFeeUSD,
        planTotalAmount: currentParticipant?.plan?.totalAmount,
        currentStatus: currentParticipant?.status || 'CONFIRMADO',
      });

      const updatedParticipant = await tx.participant.update({
        where: { id: participantId },
        data: {
          totalPaidSheet: syncFields.totalPaidSheet,
          debtFinalUSD: syncFields.debtFinalUSD,
          debtToDateUSD: syncFields.debtToDateUSD,
          overpaymentUSD: syncFields.overpaymentUSD,
          financialStatusSheet: syncFields.financialStatusSheet,
        },
        include: fullParticipantInclude,
      });

      return { updatedParticipant, financial: syncFields.financial };
    });

    return NextResponse.json({
      success: true,
      participant: { ...result.updatedParticipant, financial: result.financial },
    });
  } catch (error: unknown) {
    return apiErrorResponse(error, 'Error al eliminar el abono', 500);
  }
}
