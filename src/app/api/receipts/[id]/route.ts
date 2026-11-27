import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser, getEventPermissions } from '@/lib/auth';
import { getParticipantSession } from '@/lib/participantAuth';
import { apiErrorResponse } from '@/lib/apiUtils';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const [adminUser, participantSession] = await Promise.all([
    getCurrentUser(),
    getParticipantSession(),
  ]);

  if (!adminUser && !participantSession) {
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

    const hasAdminAccess = Boolean(
      adminUser && getEventPermissions(adminUser, receipt.eventId).canView
    );

    let hasParticipantAccess = false;
    if (!hasAdminAccess && participantSession) {
      const payment = await prisma.payment.findFirst({
        where: {
          participantId: participantSession.participantId,
          receiptUrl: `/api/receipts/${id}`,
        },
        select: { id: true },
      });
      hasParticipantAccess = Boolean(payment);
    }

    if (!hasAdminAccess && !hasParticipantAccess) {
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
