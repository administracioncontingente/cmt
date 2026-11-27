import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser, getEventPermissions } from '@/lib/auth';
import { apiErrorResponse } from '@/lib/apiUtils';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const { id } = await params;

  try {
    const receipt = await prisma.paymentReceipt.findUnique({
      where: { id },
      select: {
        id: true,
        eventId: true,
        fileName: true,
        mimeType: true,
        sizeBytes: true,
        content: true,
      },
    });

    if (!receipt) {
      return NextResponse.json(
        { error: 'Comprobante no encontrado' },
        { status: 404 }
      );
    }

    const permissions = getEventPermissions(user, receipt.eventId);
    if (!permissions.canView) {
      return NextResponse.json(
        { error: 'No tienes permisos para ver este comprobante' },
        { status: 403 }
      );
    }

    const safeFileName = receipt.fileName.replace(/[\r\n"\\]/g, '_');

    return new NextResponse(new Uint8Array(receipt.content), {
      status: 200,
      headers: {
        'Content-Type': receipt.mimeType,
        'Content-Length': String(receipt.sizeBytes),
        'Content-Disposition': `inline; filename="${safeFileName}"`,
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': 'private, max-age=3600',
      },
    });
  } catch (error: unknown) {
    return apiErrorResponse(error, 'Error al descargar el comprobante', 500);
  }
}
