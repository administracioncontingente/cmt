import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cleanRut, formatRut } from '@/lib/rut';
import {
  createMedicalVerificationCode,
  createOtpChallengeToken,
} from '@/lib/medicalAuth';
import { apiErrorResponse } from '@/lib/apiUtils';

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { rut?: unknown; email?: unknown };
    const { rut, email } = body;

    if (!rut || typeof rut !== 'string') {
      return NextResponse.json(
        { error: 'Debe ingresar el RUT del participante' },
        { status: 400 }
      );
    }

    const cleaned = cleanRut(rut);
    const formatted = formatRut(cleaned);

    // Buscar participante por RUT formateado o limpio
    const participant = await prisma.participant.findFirst({
      where: {
        OR: [
          { rut: formatted },
          { rut: cleaned },
          { rutClean: cleaned },
        ],
      },
      select: {
        id: true,
        rut: true,
        firstName: true,
        lastName: true,
        email: true,
        guardianEmail: true,
        guardianName: true,
        contingentRole: true,
      },
    });

    if (!participant) {
      return NextResponse.json(
        { error: 'No se encontró ningún participante registrado con el RUT ingresado.' },
        { status: 404 }
      );
    }

    // Determinar a qué correo enviar el código:
    // Prioridad 1: Si el usuario especificó un correo, validar que coincida con apoderado o participante
    let targetEmail: string | null = null;
    let targetRole: 'APODERADO' | 'PARTICIPANTE' = 'APODERADO';

    const normalizedInputEmail =
      typeof email === 'string' ? email.toLowerCase().trim() : '';
    const pGuardianEmail = (participant.guardianEmail || '').toLowerCase().trim();
    const pParticipantEmail = (participant.email || '').toLowerCase().trim();

    if (normalizedInputEmail) {
      if (pGuardianEmail && pGuardianEmail === normalizedInputEmail) {
        targetEmail = pGuardianEmail;
        targetRole = 'APODERADO';
      } else if (pParticipantEmail && pParticipantEmail === normalizedInputEmail) {
        targetEmail = pParticipantEmail;
        targetRole = 'PARTICIPANTE';
      } else {
        return NextResponse.json(
          {
            error:
              'El correo electrónico ingresado no coincide con los registros del apoderado ni del participante.',
          },
          { status: 403 }
        );
      }
    } else {
      // Si no especificó correo, preferir el correo del apoderado (o participante si no hay apoderado)
      if (pGuardianEmail) {
        targetEmail = pGuardianEmail;
        targetRole = 'APODERADO';
      } else if (pParticipantEmail) {
        targetEmail = pParticipantEmail;
        targetRole = 'PARTICIPANTE';
      }
    }

    if (!targetEmail) {
      return NextResponse.json(
        {
          error:
            'No hay un correo electrónico registrado para este participante. Por favor contacta al equipo de contingente.',
        },
        { status: 400 }
      );
    }

    // Generar OTP y enviar correo
    const clientIp =
      req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || undefined;
    const { code, expiresAt } = await createMedicalVerificationCode({
      participantId: participant.id,
      email: targetEmail,
      ipAddress: clientIp,
    });

    const challengeToken = await createOtpChallengeToken({
      participantId: participant.id,
      email: targetEmail,
      scope: 'MEDICAL_OTP_CHALLENGE',
    });

    // Enmascarar el correo para privacidad (ej: j***z@gmail.com)
    const [localPart, domainPart] = targetEmail.split('@');
    const maskedLocal =
      localPart.length > 2
        ? `${localPart[0]}***${localPart[localPart.length - 1]}`
        : `${localPart[0] || ''}***`;
    const maskedEmail = `${maskedLocal}@${domainPart || ''}`;

    return NextResponse.json({
      success: true,
      participantId: participant.id,
      participantName: `${participant.firstName} ${participant.lastName}`,
      maskedEmail,
      challengeToken,
      targetRole,
      expiresAt: expiresAt.toISOString(),
      // debugCode se incluye en respuesta para testing directo durante desarrollo
      debugCode: process.env.NODE_ENV !== 'production' ? code : undefined,
      message: `Código de verificación enviado con éxito a ${maskedEmail}`,
    });
  } catch (error: unknown) {
    return apiErrorResponse(error, 'Error interno al procesar la solicitud');
  }
}
