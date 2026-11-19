import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import QRCode from 'qrcode';

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

    const origin = req.headers.get('origin') || req.headers.get('host') || 'http://localhost:3000';
    const baseUrl = origin.startsWith('http') ? origin : `https://${origin}`;
    const qrEmergencyUrl = `${baseUrl}/medico/${medicalRecord.qrAccessCode}`;
    const qrDataUrl = await QRCode.toDataURL(qrEmergencyUrl, {
      margin: 1,
      width: 256,
      color: {
        dark: '#001558',
        light: '#FFFFFF',
      },
    });

    return NextResponse.json({
      success: true,
      participant: medicalRecord.participant,
      medicalRecord,
      qrEmergencyUrl,
      qrDataUrl,
    });
  } catch (error: any) {
    console.error('Error al consultar ficha por QR:', error);
    return NextResponse.json(
      { error: error.message || 'Error al procesar consulta de emergencia' },
      { status: 500 }
    );
  }
}
