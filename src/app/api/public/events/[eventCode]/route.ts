import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser, getEventPermissions } from '@/lib/auth';
import { apiErrorResponse } from '@/lib/apiUtils';
import { parseEventHighlights } from '@/lib/eventDocuments';
import type { PublicEventPageDTO } from '@/types/domain';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ eventCode: string }> }
) {
  const { eventCode } = await params;

  try {
    const cleanCode = decodeURIComponent(eventCode).trim();

    if (!cleanCode) {
      return NextResponse.json(
        { error: 'Código de evento inválido' },
        { status: 400 }
      );
    }

    const event = await prisma.event.findFirst({
      where: {
        code: { equals: cleanCode, mode: 'insensitive' },
        isActive: true,
      },
      select: {
        id: true,
        code: true,
        name: true,
        shortName: true,
        type: true,
        description: true,
        country: true,
        city: true,
        flagEmoji: true,
        startDate: true,
        endDate: true,
        currency: true,
        themeColor: true,
        accentColor: true,
        bannerUrl: true,
        isPublicPagePublished: true,
        publicHeadline: true,
        publicSummary: true,
        venueDetails: true,
        registrationInfo: true,
        contactEmail: true,
        contactPhone: true,
        officialWebsiteUrl: true,
        highlightsJson: true,
      },
    });

    if (!event) {
      return NextResponse.json(
        { error: 'Evento no encontrado' },
        { status: 404 }
      );
    }

    let isStaffPreview = false;
    if (!event.isPublicPagePublished) {
      const staffUser = await getCurrentUser();
      const canViewDraft = Boolean(
        staffUser && getEventPermissions(staffUser, event.id).canView
      );
      if (!canViewDraft) {
        const draftPayload: PublicEventPageDTO = {
          published: false,
          event: {
            id: event.id,
            code: event.code,
            name: event.name,
            shortName: event.shortName,
            flagEmoji: event.flagEmoji,
            themeColor: event.themeColor,
            accentColor: event.accentColor,
            isPublicPagePublished: false,
          },
        };
        return NextResponse.json(draftPayload);
      }
      isStaffPreview = true;
    }

    const [documents, plans] = await Promise.all([
      prisma.eventDocument.findMany({
        where: {
          eventId: event.id,
          isPublished: true,
        },
        orderBy: [
          { isPinned: 'desc' },
          { publishedAt: 'desc' },
          { createdAt: 'desc' },
        ],
        select: {
          id: true,
          eventId: true,
          title: true,
          summary: true,
          category: true,
          documentCode: true,
          audience: true,
          storageType: true,
          externalUrl: true,
          fileName: true,
          mimeType: true,
          sizeBytes: true,
          isPublished: true,
          isPinned: true,
          publishedAt: true,
          downloadCount: true,
          uploadedById: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      prisma.paymentPlan.findMany({
        where: { eventId: event.id },
        orderBy: { roleKey: 'asc' },
        select: {
          id: true,
          roleKey: true,
          name: true,
          totalAmount: true,
          currency: true,
          description: true,
          installments: {
            orderBy: { installmentNumber: 'asc' },
            select: {
              id: true,
              installmentNumber: true,
              title: true,
              dueDate: true,
              amount: true,
            },
          },
        },
      }),
    ]);

    const { highlightsJson, ...publicEventFields } = event;
    const highlights = parseEventHighlights(highlightsJson);

    const payload: PublicEventPageDTO = {
      published: true,
      isStaffPreview,
      event: publicEventFields,
      highlights,
      plans,
      documents,
    };

    return NextResponse.json(payload);
  } catch (error: unknown) {
    return apiErrorResponse(
      error,
      'Error al obtener la información pública del evento',
      500
    );
  }
}
