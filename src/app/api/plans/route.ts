import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser, getActiveEventId } from '@/lib/auth';

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

    const plans = await prisma.paymentPlan.findMany({
      where,
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
