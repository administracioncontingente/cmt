import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import { calculateFinancialSummary } from '@/lib/finance';

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
    const body = await req.json();
    const { amount, paymentDate, paymentMethod, transactionReference, notes } = body;

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      return NextResponse.json(
        { error: 'El monto del abono debe ser mayor a 0 USD' },
        { status: 400 }
      );
    }

    const participant = await prisma.participant.findUnique({
      where: { id: participantId },
    });

    if (!participant) {
      return NextResponse.json(
        { error: 'Participante no encontrado' },
        { status: 404 }
      );
    }

    const payment = await prisma.payment.create({
      data: {
        participantId,
        amount: numAmount,
        paymentDate: paymentDate ? new Date(paymentDate) : new Date(),
        paymentMethod: paymentMethod || 'TRANSFERENCIA',
        transactionReference: transactionReference?.trim() || null,
        notes: notes?.trim() || null,
        registeredById: user.id,
      },
    });

    // Fetch updated participant with payments & plan
    const updated = await prisma.participant.findUnique({
      where: { id: participantId },
      include: {
        plan: {
          include: {
            installments: { orderBy: { installmentNumber: 'asc' } },
          },
        },
        payments: {
          include: {
            registeredBy: { select: { name: true, email: true } },
          },
          orderBy: { paymentDate: 'desc' },
        },
      },
    });

    const financial = calculateFinancialSummary(
      updated?.plan?.installments || [],
      updated?.payments || [],
      updated?.plan?.totalAmount
    );

    return NextResponse.json({
      success: true,
      payment,
      participant: { ...updated, financial },
    });
  } catch (error) {
    console.error('Error registering payment:', error);
    return NextResponse.json(
      { error: 'Error al registrar el abono' },
      { status: 500 }
    );
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
    });

    if (!payment || payment.participantId !== participantId) {
      return NextResponse.json(
        { error: 'Abono no encontrado para este participante' },
        { status: 404 }
      );
    }

    await prisma.payment.delete({ where: { id: paymentId } });

    // Fetch updated participant
    const updated = await prisma.participant.findUnique({
      where: { id: participantId },
      include: {
        plan: {
          include: {
            installments: { orderBy: { installmentNumber: 'asc' } },
          },
        },
        payments: {
          include: {
            registeredBy: { select: { name: true, email: true } },
          },
          orderBy: { paymentDate: 'desc' },
        },
      },
    });

    const financial = calculateFinancialSummary(
      updated?.plan?.installments || [],
      updated?.payments || [],
      updated?.plan?.totalAmount
    );

    return NextResponse.json({
      success: true,
      participant: { ...updated, financial },
    });
  } catch (error) {
    console.error('Error deleting payment:', error);
    return NextResponse.json(
      { error: 'Error al eliminar el abono' },
      { status: 500 }
    );
  }
}
