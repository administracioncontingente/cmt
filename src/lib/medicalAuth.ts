import { prisma } from '@/lib/prisma';
import { SignJWT, jwtVerify } from 'jose';
import crypto from 'crypto';

const MEDICAL_JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'agsch-jamboree-poland-2027-super-secret-key-32chars!'
);

export interface MedicalAuthTokenPayload {
  participantId: string;
  rut: string;
  email: string;
  scope: 'MEDICAL_EDIT' | 'MEDICAL_VIEW';
}

/**
 * Genera un código OTP aleatorio de 6 dígitos
 */
export function generateOtpCode(): string {
  return crypto.randomInt(100000, 999999).toString();
}

/**
 * Registra un nuevo código OTP para el participante
 */
export async function createMedicalVerificationCode(params: {
  participantId: string;
  email: string;
  ipAddress?: string;
}): Promise<{ code: string; expiresAt: Date }> {
  // Invalidar códigos previos activos para este participante y correo
  await prisma.medicalVerificationCode.updateMany({
    where: {
      participantId: params.participantId,
      email: params.email.toLowerCase().trim(),
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
      email: params.email.toLowerCase().trim(),
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
 * Valida un código OTP
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

  // Marcar como utilizado
  await prisma.medicalVerificationCode.update({
    where: { id: record.id },
    data: { usedAt: new Date() },
  });

  return true;
}

/**
 * Genera un token firmado para edición de ficha médica
 */
export async function createMedicalEditToken(payload: MedicalAuthTokenPayload): Promise<string> {
  return await new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('2h') // Válido por 2 horas para completar la ficha
    .sign(MEDICAL_JWT_SECRET);
}

/**
 * Verifica un token firmado de edición médica
 */
export async function verifyMedicalEditToken(token: string): Promise<MedicalAuthTokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, MEDICAL_JWT_SECRET);
    if (!payload.participantId || !payload.scope) return null;
    return {
      participantId: payload.participantId as string,
      rut: payload.rut as string,
      email: payload.email as string,
      scope: payload.scope as 'MEDICAL_EDIT' | 'MEDICAL_VIEW',
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
📧 [AGSCH WSJ 2027] CÓDIGO DE VERIFICACIÓN MÉDICA
Para: ${params.toEmail}
Código de Validación: ${params.code}
Válido por: 15 minutos
Motivo: Acceso y firma de Ficha Médica Oficial Polonia 2027
======================================================
  `;
  console.log(logMessage);
}
