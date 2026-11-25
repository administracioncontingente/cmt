import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  verifyMedicalCode,
  createMedicalEditToken,
  verifyOtpChallengeToken,
} from '@/lib/medicalAuth';
import { apiErrorResponse } from '@/lib/apiUtils';
import { generateMedicalQr } from '@/lib/qr';

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      challengeToken?: unknown;
      participantId?: unknown;
      email?: unknown;
      code?: unknown;
    };

    const code = typeof body.code === 'string' ? body.code.trim() : '';
    const challengeToken =
      typeof body.challengeToken === 'string' ? body.challengeToken.trim() : '';

    let resolvedParticipantId =
      typeof body.participantId === 'string' ? body.participantId.trim() : '';
    let resolvedEmail = typeof body.email === 'string' ? body.email.trim() : '';

    if (challengeToken) {
      const challengePayload = await verifyOtpChallengeToken(challengeToken);
      if (!challengePayload) {
        return NextResponse.json(
          {
            error:
              'El desafío de verificación es inválido o ha expirado. Solicita un nuevo código.',
          },
          { status: 401 }
        );
      }
      resolvedParticipantId = challengePayload.participantId;
      resolvedEmail = challengePayload.email;
    }

    if (!resolvedParticipantId || !resolvedEmail || !code) {
      return NextResponse.json(
        {
          error:
            'Parámetros incompletos (challengeToken o participantId/email y code son requeridos)',
        },
        { status: 400 }
      );
    }

    const isValid = await verifyMedicalCode({
      participantId: resolvedParticipantId,
      email: resolvedEmail,
      code,
    });

    if (!isValid) {
      return NextResponse.json(
        { error: 'Código de verificación incorrecto o expirado. Solicita uno nuevo.' },
        { status: 401 }
      );
    }

    const participant = await prisma.participant.findUnique({
      where: { id: resolvedParticipantId },
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
      email: resolvedEmail.toLowerCase().trim(),
      scope: 'MEDICAL_EDIT',
    });

    const { qrEmergencyUrl, qrDataUrl } = await generateMedicalQr(
      req,
      medicalRecord.qrAccessCode
    );

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
  } catch (error: unknown) {
    return apiErrorResponse(error, 'Error interno al validar el código');
  }
}
