import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  try {
    const plans = await prisma.paymentPlan.findMany({
      include: {
        installments: {
          orderBy: { installmentNumber: 'asc' },
        },
        _count: {
          select: { participants: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    return NextResponse.json({ plans });
  } catch (error) {
    console.error('Error fetching plans:', error);
    return NextResponse.json(
      { error: 'Error al obtener los planes de pago' },
      { status: 500 }
    );
  }
}
