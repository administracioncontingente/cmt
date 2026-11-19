import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyMedicalCode, createMedicalEditToken } from '@/lib/medicalAuth';
import QRCode from 'qrcode';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { participantId, email, code } = body;

    if (!participantId || !email || !code) {
      return NextResponse.json(
        { error: 'Parámetros incompletos (participantId, email y code son requeridos)' },
        { status: 400 }
      );
    }

    const isValid = await verifyMedicalCode({
      participantId,
      email,
      code,
    });

    if (!isValid) {
      return NextResponse.json(
        { error: 'Código de verificación incorrecto o expirado. Solicita uno nuevo.' },
        { status: 401 }
      );
    }

    const participant = await prisma.participant.findUnique({
      where: { id: participantId },
      include: {
        medicalRecord: true,
      },
    });

    if (!participant) {
      return NextResponse.json(
        { error: 'Participante no encontrado' },
        { status: 404 }
      );
    }

    // Asegurar que exista un MedicalRecord con qrAccessCode
    let medicalRecord = participant.medicalRecord;
    if (!medicalRecord) {
      medicalRecord = await prisma.medicalRecord.create({
        data: {
          participantId: participant.id,
          emergencyContactName: participant.guardianName || null,
          emergencyContactPhone: participant.guardianPhone || null,
          emergencyContactEmail: participant.guardianEmail || null,
          emergencyContactRelation: participant.guardianRelationship || null,
          dietaryRestrictionsES: participant.dietaryRestrictions || null,
          allergiesES: participant.medicalNotes || null,
        },
      });
    }

    // Generar token JWT para guardar cambios
    const editToken = await createMedicalEditToken({
      participantId: participant.id,
      rut: participant.rut,
      email: email.toLowerCase().trim(),
      scope: 'MEDICAL_EDIT',
    });

    // Generar código QR en Base64 Data URL para visualización inmediata
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
      editToken,
      qrEmergencyUrl,
      qrDataUrl,
      participant: {
        id: participant.id,
        rut: participant.rut,
        firstName: participant.firstName,
        lastName: participant.lastName,
        secondLastName: participant.secondLastName,
        email: participant.email,
        phone: participant.phone,
        birthDate: participant.birthDate,
        gender: participant.gender,
        guardianName: participant.guardianName,
        guardianPhone: participant.guardianPhone,
        guardianEmail: participant.guardianEmail,
        guardianRelationship: participant.guardianRelationship,
        scoutZone: participant.scoutZone,
        scoutDistrict: participant.scoutDistrict,
        scoutGroup: participant.scoutGroup,
        contingentRole: participant.contingentRole,
        cupoCode: participant.cupoCode,
      },
      medicalRecord,
    });
  } catch (error: any) {
    console.error('Error al verificar código OTP médico:', error);
    return NextResponse.json(
      { error: error.message || 'Error interno al validar el código' },
      { status: 500 }
    );
  }
}
