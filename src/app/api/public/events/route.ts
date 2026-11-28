import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { apiErrorResponse } from '@/lib/apiUtils';
import type { PublicEventListItemDTO } from '@/types/domain';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const publishedOnly =
    searchParams.get('publishedOnly') === '1' ||
    searchParams.get('publishedOnly') === 'true';

  try {
    const events = await prisma.event.findMany({
      where: {
        isActive: true,
        ...(publishedOnly ? { isPublicPagePublished: true } : {}),
      },
      orderBy: [{ isDefault: 'desc' }, { startDate: 'asc' }],
      select: {
        id: true,
        code: true,
        name: true,
        shortName: true,
        type: true,
        description: true,
        flagEmoji: true,
        currency: true,
        country: true,
        city: true,
        startDate: true,
        endDate: true,
        isDefault: true,
        themeColor: true,
        accentColor: true,
        bannerUrl: true,
        isPublicPagePublished: true,
        publicHeadline: true,
        publicSummary: true,
        contactEmail: true,
        _count: {
          select: {
            documents: {
              where: { isPublished: true },
            },
          },
        },
      },
    });

    const formatted: PublicEventListItemDTO[] = events.map((ev) => ({
      id: ev.id,
      code: ev.code,
      name: ev.name,
      shortName: ev.shortName,
      type: ev.type,
      description: ev.description,
      flagEmoji: ev.flagEmoji,
      currency: ev.currency,
      country: ev.country,
      city: ev.city,
      startDate: ev.startDate,
      endDate: ev.endDate,
      isDefault: ev.isDefault,
      themeColor: ev.themeColor,
      accentColor: ev.accentColor,
      bannerUrl: ev.bannerUrl,
      isPublicPagePublished: ev.isPublicPagePublished,
      publicHeadline: ev.publicHeadline,
      publicSummary: ev.publicSummary,
      contactEmail: ev.contactEmail,
      publishedDocumentsCount: ev._count.documents,
    }));

    return NextResponse.json({ events: formatted });
  } catch (error: unknown) {
    return apiErrorResponse(
      error,
      'Error al obtener eventos disponibles',
      500
    );
  }
}
