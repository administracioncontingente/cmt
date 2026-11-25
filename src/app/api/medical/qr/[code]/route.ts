import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { apiErrorResponse } from '@/lib/apiUtils';
import { generateMedicalQr } from '@/lib/qr';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params;

    const medicalRecord = await prisma.medicalRecord.findUnique({
      where: { qrAccessCode: code },
      include: {
        participant: {
          select: {
            id: true,
            rut: true,
            firstName: true,
            lastName: true,
            secondLastName: true,
            contingentRole: true,
            birthDate: true,
            gender: true,
            cupoCode: true,
            unitName: true,
            patrolName: true,
            guardianName: true,
            guardianPhone: true,
            guardianEmail: true,
          },
        },
      },
    });

    if (!medicalRecord) {
      return NextResponse.json(
        { error: 'Ficha médica no encontrada o código QR no válido.' },
        { status: 404 }
      );
    }

    const { qrEmergencyUrl, qrDataUrl } = await generateMedicalQr(
      req,
      medicalRecord.qrAccessCode
    );

    return NextResponse.json({
      success: true,
      participant: medicalRecord.participant,
      medicalRecord,
      qrEmergencyUrl,
      qrDataUrl,
    });
  } catch (error: unknown) {
    return apiErrorResponse(error, 'Error al procesar consulta de emergencia');
  }
}
