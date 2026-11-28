import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { getCurrentUser, getEventPermissions } from '@/lib/auth';
import { apiErrorResponse, parseOptionalDate } from '@/lib/apiUtils';
import {
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

function parseOptionalBool(raw: unknown): boolean | undefined {
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
  return undefined;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const existing = await prisma.eventDocument.findUnique({
      where: { id },
      select: {
        id: true,
        eventId: true,
        storageType: true,
        uploadedById: true,
      },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Documento no encontrado' },
        { status: 404 }
      );
    }

    const permissions = getEventPermissions(user, existing.eventId);
    const canModify =
      permissions.canManageEventPage ||
      (permissions.canManageDocuments && existing.uploadedById === user.id);

    if (!canModify) {
      return NextResponse.json(
        { error: 'No tienes permisos para modificar este documento' },
        { status: 403 }
      );
    }

    const contentType = req.headers.get('content-type') || '';
    const updateData: Prisma.EventDocumentUpdateInput = {};

    let rawStorageType: string | undefined;
    let rawExternalUrl: string | null | undefined;
    let fileEntry: File | null = null;

    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      const has = (key: string) => formData.has(key);
      const getStr = (key: string): string | null => {
        const v = formData.get(key);
        return typeof v === 'string' ? v : null;
      };

      if (has('title')) {
        const title = (getStr('title') || '').trim();
        if (!title) {
          return NextResponse.json(
            { error: 'El título no puede quedar vacío' },
            { status: 400 }
          );
        }
        updateData.title = title.slice(0, 200);
      }
      if (has('summary')) {
        const summary = getStr('summary')?.trim();
        updateData.summary = summary ? summary.slice(0, 1200) : null;
      }
      if (has('category')) {
        updateData.category = sanitizeDocumentCategory(getStr('category'));
      }
      if (has('documentCode')) {
        const code = getStr('documentCode')?.trim();
        updateData.documentCode = code ? code.slice(0, 60) : null;
      }
      if (has('audience')) {
        updateData.audience = sanitizeDocumentAudience(getStr('audience'));
      }
      if (has('isPublished')) {
        updateData.isPublished = parseOptionalBool(formData.get('isPublished'));
      }
      if (has('isPinned')) {
        updateData.isPinned = parseOptionalBool(formData.get('isPinned'));
      }
      if (has('publishedAt')) {
        const rawDate = getStr('publishedAt')?.trim();
        if (!rawDate) {
          updateData.publishedAt = null;
        } else {
          const parsedDate = parseOptionalDate(rawDate);
          if (!parsedDate) {
            return NextResponse.json(
              { error: 'Fecha de publicación inválida' },
              { status: 400 }
            );
          }
          updateData.publishedAt = parsedDate;
        }
      }
      if (has('storageType')) {
        rawStorageType = (getStr('storageType') || '').toUpperCase();
      }
      if (has('externalUrl')) {
        rawExternalUrl = getStr('externalUrl');
      }
      const rawFile = formData.get('file');
      if (rawFile instanceof File && rawFile.size > 0) {
        fileEntry = rawFile;
      }
    } else {
      const body = (await req.json()) as Record<string, unknown>;

      if (body.title !== undefined) {
        if (typeof body.title !== 'string' || !body.title.trim()) {
          return NextResponse.json(
            { error: 'El título no puede quedar vacío' },
            { status: 400 }
          );
        }
        updateData.title = body.title.trim().slice(0, 200);
      }
      if (body.summary !== undefined) {
        updateData.summary =
          typeof body.summary === 'string' && body.summary.trim()
            ? body.summary.trim().slice(0, 1200)
            : null;
      }
      if (body.category !== undefined) {
        updateData.category = sanitizeDocumentCategory(
          typeof body.category === 'string' ? body.category : null
        );
      }
      if (body.documentCode !== undefined) {
        updateData.documentCode =
          typeof body.documentCode === 'string' && body.documentCode.trim()
            ? body.documentCode.trim().slice(0, 60)
            : null;
      }
      if (body.audience !== undefined) {
        updateData.audience = sanitizeDocumentAudience(
          typeof body.audience === 'string' ? body.audience : null
        );
      }
      if (body.isPublished !== undefined) {
        const val = parseOptionalBool(body.isPublished);
        if (val !== undefined) updateData.isPublished = val;
      }
      if (body.isPinned !== undefined) {
        const val = parseOptionalBool(body.isPinned);
        if (val !== undefined) updateData.isPinned = val;
      }
      if (body.publishedAt !== undefined) {
        if (body.publishedAt === null || body.publishedAt === '') {
          updateData.publishedAt = null;
        } else {
          const parsed = parseOptionalDate(body.publishedAt);
          if (!parsed) {
            return NextResponse.json(
              { error: 'Fecha de publicación inválida' },
              { status: 400 }
            );
          }
          updateData.publishedAt = parsed;
        }
      }
      if (typeof body.storageType === 'string') {
        rawStorageType = body.storageType.toUpperCase();
      }
      if (body.externalUrl !== undefined) {
        rawExternalUrl =
          typeof body.externalUrl === 'string' ? body.externalUrl : null;
      }
    }

    const nextStorageType =
      rawStorageType === 'EXTERNAL_LINK' || rawStorageType === 'UPLOAD'
        ? rawStorageType
        : existing.storageType;

    if (nextStorageType === 'EXTERNAL_LINK') {
      if (
        rawStorageType === 'EXTERNAL_LINK' ||
        rawExternalUrl !== undefined
      ) {
        if (!isValidHttpUrl(rawExternalUrl)) {
          return NextResponse.json(
            {
              error:
                'Ingresa una URL válida que comience con https:// o http://',
            },
            { status: 400 }
          );
        }
        updateData.storageType = 'EXTERNAL_LINK';
        updateData.externalUrl = rawExternalUrl!.trim();
        updateData.fileName = null;
        updateData.mimeType = null;
        updateData.sizeBytes = null;
        updateData.content = null;
      }
    } else if (nextStorageType === 'UPLOAD') {
      if (fileEntry) {
        try {
          const validated = await validateDocumentFile(fileEntry);
          updateData.storageType = 'UPLOAD';
          updateData.fileName = validated.fileName;
          updateData.mimeType = validated.mimeType;
          updateData.sizeBytes = validated.sizeBytes;
          updateData.content = validated.buffer;
          updateData.externalUrl = null;
        } catch (err: unknown) {
          if (err instanceof DocumentValidationError) {
            return NextResponse.json(
              { error: err.message },
              { status: err.statusCode }
            );
          }
          throw err;
        }
      } else if (existing.storageType !== 'UPLOAD') {
        return NextResponse.json(
          {
            error:
              'Para cambiar a archivo subido debes adjuntar un archivo.',
          },
          { status: 400 }
        );
      }
    }

    const updated = await prisma.eventDocument.update({
      where: { id },
      data: updateData,
      select: DOCUMENT_METADATA_SELECT,
    });

    return NextResponse.json({
      message: 'Documento actualizado correctamente',
      document: updated,
    });
  } catch (error: unknown) {
    return apiErrorResponse(error, 'Error al actualizar el documento', 500);
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const existing = await prisma.eventDocument.findUnique({
      where: { id },
      select: {
        id: true,
        eventId: true,
        uploadedById: true,
      },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Documento no encontrado' },
        { status: 404 }
      );
    }

    const permissions = getEventPermissions(user, existing.eventId);
    const canDelete =
      permissions.canManageEventPage ||
      (permissions.canManageDocuments && existing.uploadedById === user.id);

    if (!canDelete) {
      return NextResponse.json(
        { error: 'No tienes permisos para eliminar este documento' },
        { status: 403 }
      );
    }

    await prisma.eventDocument.delete({ where: { id } });

    return NextResponse.json({
      success: true,
      message: 'Documento eliminado correctamente',
    });
  } catch (error: unknown) {
    return apiErrorResponse(error, 'Error al eliminar el documento', 500);
  }
}
