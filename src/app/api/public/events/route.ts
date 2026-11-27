import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { apiErrorResponse } from '@/lib/apiUtils';

export async function GET() {
  try {
    const events = await prisma.event.findMany({
      where: { isActive: true },
      orderBy: [{ isDefault: 'desc' }, { startDate: 'asc' }],
      select: {
        id: true,
        code: true,
        name: true,
        shortName: true,
        flagEmoji: true,
        currency: true,
        country: true,
        city: true,
        isDefault: true,
      },
    });

    return NextResponse.json({ events });
  } catch (error: unknown) {
    return apiErrorResponse(
      error,
      'Error al obtener eventos disponibles',
      500
    );
  }
}
