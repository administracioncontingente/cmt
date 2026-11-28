import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import {
  getCurrentUser,
  getEventPermissions,
  resolveAuthorizedEventId,
} from '@/lib/auth';
import { apiErrorResponse, parseOptionalDate } from '@/lib/apiUtils';
import {
  DOCUMENT_CATEGORIES,
  DocumentValidationError,
  isValidHttpUrl,
  sanitizeDocumentAudience,
  sanitizeDocumentCategory,
  validateDocumentFile,
} from '@/lib/eventDocuments';

const DOCUMENT_METADATA_SELECT = {
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
  uploadedBy: {
    select: {
      id: true,
      name: true,
      email: true,
    },
  },
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.EventDocumentSelect;

function parseBoolFlag(raw: unknown, fallback: boolean): boolean {
  if (typeof raw === 'boolean') return raw;
  if (typeof raw === 'string') {
    const normalized = raw.trim().toLowerCase();
    if (normalized === 'true' || normalized === '1' || normalized === 'on') {
      return true;
    }
    if (normalized === 'false' || normalized === '0') {
      return false;
    }
  }
  return fallback;
}

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const paramEventId = searchParams.get('eventId');
    const categoryFilter = searchParams.get('category')?.trim().toUpperCase();
    const statusFilter = searchParams.get('status')?.trim().toUpperCase();
    const search = searchParams.get('search')?.trim();

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
        permissions: null,
        documents: [],
        summary: {
          total: 0,
          published: 0,
          drafts: 0,
          totalDownloads: 0,
          byCategory: {},
        },
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
        flagEmoji: true,
        isPublicPagePublished: true,
      },
    });

    const allEventDocs = await prisma.eventDocument.findMany({
      where: { eventId },
      select: {
        category: true,
        isPublished: true,
        downloadCount: true,
      },
    });

    const byCategory: Record<string, number> = Object.fromEntries(
      DOCUMENT_CATEGORIES.map((c) => [c.value, 0])
    );
    let published = 0;
    let drafts = 0;
    let totalDownloads = 0;

    for (const d of allEventDocs) {
      byCategory[d.category] = (byCategory[d.category] || 0) + 1;
      if (d.isPublished) published++;
      else drafts++;
      totalDownloads += d.downloadCount || 0;
    }

    const where: Prisma.EventDocumentWhereInput = { eventId };
    if (categoryFilter && categoryFilter !== 'ALL') {
      where.category = sanitizeDocumentCategory(categoryFilter);
    }
    if (statusFilter === 'PUBLISHED') {
      where.isPublished = true;
    } else if (statusFilter === 'DRAFT') {
      where.isPublished = false;
    }
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { summary: { contains: search, mode: 'insensitive' } },
        { documentCode: { contains: search, mode: 'insensitive' } },
        { fileName: { contains: search, mode: 'insensitive' } },
      ];
    }

    const documents = await prisma.eventDocument.findMany({
      where,
      orderBy: [
        { isPinned: 'desc' },
        { publishedAt: 'desc' },
        { createdAt: 'desc' },
      ],
      select: DOCUMENT_METADATA_SELECT,
    });

    return NextResponse.json({
      event,
      permissions,
      documents,
      summary: {
        total: allEventDocs.length,
        published,
        drafts,
        totalDownloads,
        byCategory,
      },
    });
  } catch (error: unknown) {
    return apiErrorResponse(
      error,
      'Error al obtener documentos del evento',
      500
    );
  }
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  try {
    const contentType = req.headers.get('content-type') || '';

    let requestedEventId: string | null = null;
    let rawTitle = '';
    let rawSummary: string | null = null;
    let rawCategory: string | null = null;
    let rawCode: string | null = null;
    let rawAudience: string | null = null;
    let rawStorageType: string = 'UPLOAD';
    let rawExternalUrl: string | null = null;
    let rawIsPublished: unknown = true;
    let rawIsPinned: unknown = false;
    let rawPublishedAt: unknown = undefined;
    let fileEntry: File | null = null;

    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      const getStr = (key: string): string | null => {
        const v = formData.get(key);
        return typeof v === 'string' ? v : null;
      };
      requestedEventId = getStr('eventId');
      rawTitle = getStr('title') || '';
      rawSummary = getStr('summary');
      rawCategory = getStr('category');
      rawCode = getStr('documentCode');
      rawAudience = getStr('audience');
      rawStorageType = (getStr('storageType') || 'UPLOAD').toUpperCase();
      rawExternalUrl = getStr('externalUrl');
      rawIsPublished = formData.get('isPublished');
      rawIsPinned = formData.get('isPinned');
      rawPublishedAt = formData.get('publishedAt');
      const rawFile = formData.get('file');
      if (rawFile instanceof File && rawFile.size > 0) {
        fileEntry = rawFile;
      }
    } else {
      const body = (await req.json()) as Record<string, unknown>;
      requestedEventId =
        typeof body.eventId === 'string' ? body.eventId : null;
      rawTitle = typeof body.title === 'string' ? body.title : '';
      rawSummary = typeof body.summary === 'string' ? body.summary : null;
      rawCategory = typeof body.category === 'string' ? body.category : null;
      rawCode =
        typeof body.documentCode === 'string' ? body.documentCode : null;
      rawAudience = typeof body.audience === 'string' ? body.audience : null;
      rawStorageType =
        typeof body.storageType === 'string'
          ? body.storageType.toUpperCase()
          : 'EXTERNAL_LINK';
      rawExternalUrl =
        typeof body.externalUrl === 'string' ? body.externalUrl : null;
      rawIsPublished = body.isPublished;
      rawIsPinned = body.isPinned;
      rawPublishedAt = body.publishedAt;
    }

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
    if (!permissions.canManageDocuments) {
      return NextResponse.json(
        {
          error:
            'No tienes permisos para subir o publicar documentos en este evento.',
        },
        { status: 403 }
      );
    }

    const title = rawTitle.trim();
    if (!title) {
      return NextResponse.json(
        { error: 'El título del documento es obligatorio.' },
        { status: 400 }
      );
    }

    const storageType =
      rawStorageType === 'EXTERNAL_LINK' ? 'EXTERNAL_LINK' : 'UPLOAD';
    const category = sanitizeDocumentCategory(rawCategory);
    const audience = sanitizeDocumentAudience(rawAudience);
    const isPublished = parseBoolFlag(rawIsPublished, true);
    const isPinned = parseBoolFlag(rawIsPinned, false);

    let publishedAt = new Date();
    if (rawPublishedAt && typeof rawPublishedAt === 'string' && rawPublishedAt.trim()) {
      const parsedDate = parseOptionalDate(rawPublishedAt);
      if (!parsedDate) {
        return NextResponse.json(
          { error: 'Fecha de publicación inválida' },
          { status: 400 }
        );
      }
      publishedAt = parsedDate;
    }

    let fileFields: {
      fileName: string | null;
      mimeType: string | null;
      sizeBytes: number | null;
      content: Buffer | null;
      externalUrl: string | null;
    } = {
      fileName: null,
      mimeType: null,
      sizeBytes: null,
      content: null,
      externalUrl: null,
    };

    if (storageType === 'EXTERNAL_LINK') {
      if (!isValidHttpUrl(rawExternalUrl)) {
        return NextResponse.json(
          {
            error:
              'Ingresa una URL válida que comience con https:// o http://',
          },
          { status: 400 }
        );
      }
      fileFields.externalUrl = rawExternalUrl!.trim();
    } else {
      if (!fileEntry) {
        return NextResponse.json(
          { error: 'Debes adjuntar un archivo para subir el documento.' },
          { status: 400 }
        );
      }
      try {
        const validated = await validateDocumentFile(fileEntry);
        fileFields = {
          fileName: validated.fileName,
          mimeType: validated.mimeType,
          sizeBytes: validated.sizeBytes,
          content: validated.buffer,
          externalUrl: null,
        };
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

    const created = await prisma.eventDocument.create({
      data: {
        eventId,
        title: title.slice(0, 200),
        summary: rawSummary?.trim() ? rawSummary.trim().slice(0, 1200) : null,
        category,
        documentCode: rawCode?.trim()
          ? rawCode.trim().slice(0, 60)
          : null,
        audience,
        storageType,
        externalUrl: fileFields.externalUrl,
        fileName: fileFields.fileName,
        mimeType: fileFields.mimeType,
        sizeBytes: fileFields.sizeBytes,
        content: fileFields.content,
        isPublished,
        isPinned,
        publishedAt,
        uploadedById: user.id,
      },
      select: DOCUMENT_METADATA_SELECT,
    });

    return NextResponse.json(
      {
        message: isPublished
          ? 'Documento subido y publicado en la página del evento'
          : 'Documento guardado como borrador',
        document: created,
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    return apiErrorResponse(
      error,
      'Error al subir o publicar el documento',
      500
    );
  }
}
