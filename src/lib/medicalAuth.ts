import { prisma } from '@/lib/prisma';
import { SignJWT, jwtVerify } from 'jose';
import crypto from 'crypto';
import { getJwtSecret } from '@/lib/jwtConfig';

export interface MedicalAuthTokenPayload {
  participantId: string;
  rut: string;
  email: string;
  scope: 'MEDICAL_EDIT' | 'MEDICAL_VIEW';
}

export interface OtpChallengePayload {
  participantId: string;
  email: string;
  scope: 'MEDICAL_OTP_CHALLENGE';
}

/**
 * Genera un código OTP aleatorio de 6 dígitos (100000 - 999999 inclusive)
 */
export function generateOtpCode(): string {
  return crypto.randomInt(100000, 1000000).toString();
}

/**
 * Registra un nuevo código OTP para el participante
 */
export async function createMedicalVerificationCode(params: {
  participantId: string;
  email: string;
  ipAddress?: string;
}): Promise<{ code: string; expiresAt: Date }> {
  const normalizedEmail = params.email.toLowerCase().trim();

  // Invalidar todos los códigos previos no usados de este participante
  await prisma.medicalVerificationCode.updateMany({
    where: {
      participantId: params.participantId,
      usedAt: null,
    },
    data: {
      usedAt: new Date(),
    },
  });

  const code = generateOtpCode();
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutos

  await prisma.medicalVerificationCode.create({
    data: {
      participantId: params.participantId,
      email: normalizedEmail,
      code,
      expiresAt,
      ipAddress: params.ipAddress || null,
    },
  });

  // Simulación y envío de correo
  await dispatchVerificationEmail({
    toEmail: params.email,
    code,
  });

  return { code, expiresAt };
}

/**
 * Valida un código OTP de forma atómica para evitar uso concurrente doble
 */
export async function verifyMedicalCode(params: {
  participantId: string;
  email: string;
  code: string;
}): Promise<boolean> {
  const record = await prisma.medicalVerificationCode.findFirst({
    where: {
      participantId: params.participantId,
      email: params.email.toLowerCase().trim(),
      code: params.code.trim(),
      usedAt: null,
      expiresAt: {
        gt: new Date(),
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
  });

  if (!record) {
    return false;
  }

  const result = await prisma.medicalVerificationCode.updateMany({
    where: { id: record.id, usedAt: null },
    data: { usedAt: new Date() },
  });

  return result.count === 1;
}

/**
 * Genera un token firmado de desafío OTP (válido por 15 minutos)
 */
export async function createOtpChallengeToken(payload: OtpChallengePayload): Promise<string> {
  return await new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('15m')
    .sign(getJwtSecret());
}

/**
 * Verifica un token de desafío OTP
 */
export async function verifyOtpChallengeToken(token: string): Promise<OtpChallengePayload | null> {
  try {
    const { payload } = await jwtVerify(token, getJwtSecret());
    if (
      !payload.participantId ||
      !payload.email ||
      payload.scope !== 'MEDICAL_OTP_CHALLENGE'
    ) {
      return null;
    }
    return {
      participantId: payload.participantId as string,
      email: payload.email as string,
      scope: 'MEDICAL_OTP_CHALLENGE',
    };
  } catch {
    return null;
  }
}

/**
 * Genera un token firmado para edición de ficha médica
 */
export async function createMedicalEditToken(payload: MedicalAuthTokenPayload): Promise<string> {
  return await new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('2h') // Válido por 2 horas para completar la ficha
    .sign(getJwtSecret());
}

/**
 * Verifica un token firmado de edición médica
 */
export async function verifyMedicalEditToken(token: string): Promise<MedicalAuthTokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getJwtSecret());
    if (
      !payload.participantId ||
      (payload.scope !== 'MEDICAL_EDIT' && payload.scope !== 'MEDICAL_VIEW')
    ) {
      return null;
    }
    return {
      participantId: payload.participantId as string,
      rut: payload.rut as string,
      email: payload.email as string,
      scope: payload.scope,
    };
  } catch {
    return null;
  }
}

/**
 * Envia el correo con el código de verificación
 */
async function dispatchVerificationEmail(params: { toEmail: string; code: string }) {
  // Si hay servidor SMTP configurado en variables de entorno, se enviaría por ahí.
  // En consola se deja constancia visible y formato oficial de correo para desarrollo y auditoría:
  const logMessage = `
======================================================
📧 [AGSCH] CÓDIGO DE VERIFICACIÓN MÉDICA
Para: ${params.toEmail}
Código de Validación: ${params.code}
Válido por: 15 minutos
Motivo: Acceso y firma de Ficha Médica Oficial AGSCH
======================================================
  `;
  console.log(logMessage);
}
