import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser, getEventPermissions } from '@/lib/auth';
import { apiErrorResponse } from '@/lib/apiUtils';
import {
  buildContentDisposition,
  INLINE_PREVIEW_MIMES,
  isValidHttpUrl,
} from '@/lib/eventDocuments';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const forceDownload =
    searchParams.get('download') === '1' ||
    searchParams.get('download') === 'true';

  try {
    const doc = await prisma.eventDocument.findUnique({
      where: { id },
      select: {
        id: true,
        eventId: true,
        storageType: true,
        externalUrl: true,
        fileName: true,
        mimeType: true,
        sizeBytes: true,
        content: true,
        isPublished: true,
        event: {
          select: {
            isActive: true,
            isPublicPagePublished: true,
          },
        },
      },
    });

    if (!doc || !doc.event?.isActive) {
      return NextResponse.json(
        { error: 'Documento no encontrado' },
        { status: 404 }
      );
    }

    const isPubliclyAvailable =
      doc.isPublished && doc.event.isPublicPagePublished;

    if (!isPubliclyAvailable) {
      const staffUser = await getCurrentUser();
      const hasStaffAccess = Boolean(
        staffUser && getEventPermissions(staffUser, doc.eventId).canView
      );
      if (!hasStaffAccess) {
        return NextResponse.json(
          { error: 'Documento no encontrado' },
          { status: 404 }
        );
      }
    } else {
      await prisma.eventDocument
        .update({
          where: { id: doc.id },
          data: { downloadCount: { increment: 1 } },
        })
        .catch(() => undefined);
    }

    if (doc.storageType === 'EXTERNAL_LINK') {
      if (!isValidHttpUrl(doc.externalUrl)) {
        return NextResponse.json(
          { error: 'El enlace del documento no es válido' },
          { status: 400 }
        );
      }
      return NextResponse.redirect(doc.externalUrl!.trim(), 302);
    }

    if (!doc.content) {
      return NextResponse.json(
        { error: 'Archivo binario no disponible' },
        { status: 404 }
      );
    }

    const mimeType = doc.mimeType || 'application/octet-stream';
    const fileName = doc.fileName || `documento-${doc.id}`;
    const dispositionMode =
      !forceDownload && INLINE_PREVIEW_MIMES.has(mimeType)
        ? 'inline'
        : 'attachment';

    return new NextResponse(new Uint8Array(doc.content), {
      status: 200,
      headers: {
        'Content-Type': mimeType,
        'Content-Length': String(doc.sizeBytes ?? doc.content.length),
        'Content-Disposition': buildContentDisposition(dispositionMode, fileName),
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': isPubliclyAvailable
          ? 'public, max-age=300'
          : 'private, no-store',
      },
    });
  } catch (error: unknown) {
    return apiErrorResponse(error, 'Error al descargar el documento', 500);
  }
}
