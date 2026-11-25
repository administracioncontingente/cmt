import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { getCurrentUser, resolveAuthorizedEventId, getEventPermissions } from '@/lib/auth';
import { apiErrorResponse } from '@/lib/apiUtils';

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
      return NextResponse.json({ plans: [] });
    }

    const permissions = getEventPermissions(user, activeEventId);
    if (!permissions.canView) {
      return NextResponse.json({ error: 'No tienes acceso a este evento' }, { status: 403 });
    }

    const where: Prisma.PaymentPlanWhereInput = { eventId: activeEventId };

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
  } catch (error: unknown) {
    return apiErrorResponse(error, 'Error al obtener los planes de pago', 500);
  }
}
