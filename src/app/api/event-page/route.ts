import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  getCurrentUser,
  getEventPermissions,
  resolveAuthorizedEventId,
} from '@/lib/auth';
import { apiErrorResponse, parseOptionalDate } from '@/lib/apiUtils';
import {
  DocumentValidationError,
  isValidHttpUrl,
  parseEventHighlights,
  safeHexColor,
  serializeEventHighlights,
} from '@/lib/eventDocuments';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function cleanNullableString(raw: unknown, maxLen: number): string | null | undefined {
  if (raw === undefined) return undefined;
  if (raw === null) return null;
  if (typeof raw !== 'string') return undefined;
  const trimmed = raw.trim();
  return trimmed ? trimmed.slice(0, maxLen) : null;
}

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const paramEventId = searchParams.get('eventId');
    const { eventId, forbidden } = await resolveAuthorizedEventId(
      user,
      paramEventId
    );

    if (forbidden) {
      return NextResponse.json(
        { error: 'No tienes acceso a este evento' },
        { status: 403 }
      );
    }

    if (!eventId) {
      return NextResponse.json({
        event: null,
        highlights: [],
        permissions: null,
      });
    }

    const permissions = getEventPermissions(user, eventId);
    if (!permissions.canView) {
      return NextResponse.json(
        { error: 'No tienes acceso a este evento' },
        { status: 403 }
      );
    }

    const event = await prisma.event.findUnique({
      where: { id: eventId },
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
        isActive: true,
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
        updatedAt: true,
      },
    });

    if (!event) {
      return NextResponse.json(
        { error: 'Evento no encontrado' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      event,
      highlights: parseEventHighlights(event.highlightsJson),
      permissions,
    });
  } catch (error: unknown) {
    return apiErrorResponse(
      error,
      'Error al obtener la configuración de la página del evento',
      500
    );
  }
}

export async function PUT(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  try {
    const body = (await req.json()) as Record<string, unknown>;
    const requestedEventId =
      typeof body.eventId === 'string' ? body.eventId : null;
    const { eventId, forbidden } = await resolveAuthorizedEventId(
      user,
      requestedEventId
    );

    if (forbidden) {
      return NextResponse.json(
        { error: 'No tienes acceso a este evento' },
        { status: 403 }
      );
    }
    if (!eventId) {
      return NextResponse.json(
        { error: 'No hay un evento activo seleccionado' },
        { status: 400 }
      );
    }

    const permissions = getEventPermissions(user, eventId);
    if (!permissions.canManageEventPage) {
      return NextResponse.json(
        {
          error:
            'Solo Administradores y Coordinadores del evento pueden editar su página informativa.',
        },
        { status: 403 }
      );
    }

    const officialWebsiteUrl = cleanNullableString(
      body.officialWebsiteUrl,
      500
    );
    if (officialWebsiteUrl && !isValidHttpUrl(officialWebsiteUrl)) {
      return NextResponse.json(
        {
          error:
            'El sitio web oficial debe comenzar con https:// o http://',
        },
        { status: 400 }
      );
    }

    const bannerUrl = cleanNullableString(body.bannerUrl, 500);
    if (bannerUrl && !isValidHttpUrl(bannerUrl)) {
      return NextResponse.json(
        {
          error:
            'La URL del banner debe comenzar con https:// o http://',
        },
        { status: 400 }
      );
    }

    const contactEmail = cleanNullableString(body.contactEmail, 160);
    if (contactEmail && !EMAIL_RE.test(contactEmail)) {
      return NextResponse.json(
        { error: 'El correo electrónico de contacto no tiene un formato válido' },
        { status: 400 }
      );
    }

    let startDateUpdate: Date | null | undefined = undefined;
    if (body.startDate !== undefined) {
      if (body.startDate === null || body.startDate === '') {
        startDateUpdate = null;
      } else {
        const parsed = parseOptionalDate(body.startDate);
        if (!parsed) {
          return NextResponse.json(
            { error: 'Fecha de inicio inválida' },
            { status: 400 }
          );
        }
        startDateUpdate = parsed;
      }
    }

    let endDateUpdate: Date | null | undefined = undefined;
    if (body.endDate !== undefined) {
      if (body.endDate === null || body.endDate === '') {
        endDateUpdate = null;
      } else {
        const parsed = parseOptionalDate(body.endDate);
        if (!parsed) {
          return NextResponse.json(
            { error: 'Fecha de término inválida' },
            { status: 400 }
          );
        }
        endDateUpdate = parsed;
      }
    }

    if (
      body.name !== undefined &&
      (typeof body.name !== 'string' || !body.name.trim())
    ) {
      return NextResponse.json(
        { error: 'El nombre del evento no puede quedar vacío' },
        { status: 400 }
      );
    }

    let highlightsJson: string | null | undefined = undefined;
    if (body.highlights !== undefined) {
      try {
        highlightsJson = serializeEventHighlights(body.highlights);
      } catch (err: unknown) {
        if (err instanceof DocumentValidationError) {
          return NextResponse.json(
            { error: err.message },
            { status: err.statusCode }
          );
        }
        throw err;
      }
    }

    const themeColorUpdate =
      body.themeColor !== undefined
        ? body.themeColor
          ? safeHexColor(String(body.themeColor), '#001558')
          : '#001558'
        : undefined;
    const accentColorUpdate =
      body.accentColor !== undefined
        ? body.accentColor
          ? safeHexColor(String(body.accentColor), '#FEB135')
          : '#FEB135'
        : undefined;

    const updated = await prisma.event.update({
      where: { id: eventId },
      data: {
        name:
          typeof body.name === 'string' ? body.name.trim().slice(0, 180) : undefined,
        shortName: cleanNullableString(body.shortName, 80),
        description: cleanNullableString(body.description, 2000),
        country: cleanNullableString(body.country, 100),
        city: cleanNullableString(body.city, 120),
        flagEmoji: cleanNullableString(body.flagEmoji, 16),
        startDate: startDateUpdate,
        endDate: endDateUpdate,
        themeColor: themeColorUpdate,
        accentColor: accentColorUpdate,
        bannerUrl,
        isPublicPagePublished:
          typeof body.isPublicPagePublished === 'boolean'
            ? body.isPublicPagePublished
            : undefined,
        publicHeadline: cleanNullableString(body.publicHeadline, 200),
        publicSummary: cleanNullableString(body.publicSummary, 8000),
        venueDetails: cleanNullableString(body.venueDetails, 4000),
        registrationInfo: cleanNullableString(body.registrationInfo, 4000),
        contactEmail: contactEmail ? contactEmail.toLowerCase() : contactEmail,
        contactPhone: cleanNullableString(body.contactPhone, 60),
        officialWebsiteUrl,
        highlightsJson,
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
        isActive: true,
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
        updatedAt: true,
      },
    });

    return NextResponse.json({
      message: 'Información de la página del evento guardada correctamente',
      event: updated,
      highlights: parseEventHighlights(updated.highlightsJson),
    });
  } catch (error: unknown) {
    return apiErrorResponse(
      error,
      'Error al guardar la página informativa del evento',
      500
    );
  }
}
