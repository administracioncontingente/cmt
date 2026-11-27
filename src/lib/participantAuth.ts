import crypto from 'crypto';
import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getJwtSecret } from '@/lib/jwtConfig';

export const PARTICIPANT_SESSION_COOKIE = 'agsch_participant_session';
export const MAGIC_LINK_TTL_MS = 15 * 60 * 1000;
export const MAGIC_LINK_COOLDOWN_MS = 45 * 1000;

export interface ParticipantSession {
  participantId: string;
  email: string;
  scope: 'PARTICIPANT_PORTAL';
}

/**
 * Computes the SHA-256 hex digest for a raw magic-link token.
 */
export function hashMagicToken(rawToken: string): string {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}

/**
 * Returns true if a magic link was recently issued for the given email within the cooldown window.
 */
export async function checkMagicLinkCooldown(email: string): Promise<boolean> {
  const normalizedEmail = email.toLowerCase().trim();
  if (!normalizedEmail) return false;

  const cutoff = new Date(Date.now() - MAGIC_LINK_COOLDOWN_MS);
  const recent = await prisma.participantMagicLink.findFirst({
    where: {
      email: normalizedEmail,
      createdAt: { gt: cutoff },
    },
    select: { id: true },
  });

  return Boolean(recent);
}

/**
 * Invalidates prior unused magic links for the participant and stores a hashed single-use token.
 */
export async function createParticipantMagicLink(params: {
  participantId: string;
  email: string;
  ipAddress?: string | null;
  userAgent?: string | null;
}): Promise<{ rawToken: string; expiresAt: Date }> {
  const normalizedEmail = params.email.toLowerCase().trim();
  const now = new Date();

  await prisma.participantMagicLink.updateMany({
    where: {
      participantId: params.participantId,
      usedAt: null,
    },
    data: {
      usedAt: now,
    },
  });

  const rawToken = crypto.randomBytes(32).toString('base64url');
  const tokenHash = hashMagicToken(rawToken);
  const expiresAt = new Date(Date.now() + MAGIC_LINK_TTL_MS);

  await prisma.participantMagicLink.create({
    data: {
      participantId: params.participantId,
      email: normalizedEmail,
      tokenHash,
      expiresAt,
      ipAddress: params.ipAddress ?? null,
      userAgent: params.userAgent ?? null,
    },
  });

  return { rawToken, expiresAt };
}

/**
 * Atomically consumes a valid, unexpired, unused magic-link token and returns the participant identity.
 */
export async function consumeParticipantMagicLink(
  rawToken: string
): Promise<{ participantId: string; email: string } | null> {
  const trimmed = rawToken.trim();
  if (!trimmed) return null;

  const tokenHash = hashMagicToken(trimmed);
  const now = new Date();

  const record = await prisma.participantMagicLink.findUnique({
    where: { tokenHash },
    select: {
      id: true,
      participantId: true,
      email: true,
      usedAt: true,
      expiresAt: true,
    },
  });

  if (!record || record.usedAt !== null || record.expiresAt <= now) {
    return null;
  }

  const result = await prisma.participantMagicLink.updateMany({
    where: {
      id: record.id,
      usedAt: null,
    },
    data: {
      usedAt: new Date(),
    },
  });

  if (result.count !== 1) {
    return null;
  }

  return {
    participantId: record.participantId,
    email: record.email,
  };
}

/**
 * Signs a 24-hour JWT for an authenticated participant portal session.
 */
export async function createParticipantSessionToken(payload: {
  participantId: string;
  email: string;
}): Promise<string> {
  const sessionPayload: ParticipantSession = {
    participantId: payload.participantId,
    email: payload.email.toLowerCase().trim(),
    scope: 'PARTICIPANT_PORTAL',
  };

  return await new SignJWT({ ...sessionPayload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('24h')
    .sign(getJwtSecret());
}

/**
 * Verifies a participant portal JWT and enforces the PARTICIPANT_PORTAL scope.
 */
export async function verifyParticipantSessionToken(
  token: string
): Promise<ParticipantSession | null> {
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, getJwtSecret());
    if (
      typeof payload.participantId !== 'string' ||
      !payload.participantId ||
      typeof payload.email !== 'string' ||
      !payload.email ||
      payload.scope !== 'PARTICIPANT_PORTAL'
    ) {
      return null;
    }

    return {
      participantId: payload.participantId,
      email: payload.email,
      scope: 'PARTICIPANT_PORTAL',
    };
  } catch {
    return null;
  }
}

/**
 * Reads and verifies the current participant portal session from Next.js request cookies.
 */
export async function getParticipantSession(): Promise<ParticipantSession | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(PARTICIPANT_SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifyParticipantSessionToken(token);
}

/**
 * Attaches the participant portal session cookie to an outgoing NextResponse.
 */
export function setParticipantSessionCookie(response: NextResponse, token: string): void {
  response.cookies.set(PARTICIPANT_SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 86400,
  });
}

/**
 * Clears the participant portal session cookie on an outgoing NextResponse.
 */
export function clearParticipantSessionCookie(response: NextResponse): void {
  response.cookies.set(PARTICIPANT_SESSION_COOKIE, '', {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 0,
  });
}
