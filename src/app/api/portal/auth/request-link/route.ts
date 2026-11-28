import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import {
  checkMagicLinkCooldown,
  createParticipantMagicLink,
} from '@/lib/participantAuth';
import { sendMagicLinkEmail } from '@/lib/mailer';
import { cleanRut, formatRut } from '@/lib/rut';
import { apiErrorResponse } from '@/lib/apiUtils';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const NEUTRAL_SUCCESS_MESSAGE =
  'Si el correo está registrado en el sistema, recibirás un enlace de acceso válido por 15 minutos.';

export async function POST(req: NextRequest) {
  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return NextResponse.json(
      { error: 'Solicitud JSON inválida.' },
      { status: 400 }
    );
  }

  if (!rawBody || typeof rawBody !== 'object' || Array.isArray(rawBody)) {
    return NextResponse.json(
      { error: 'Solicitud inválida.' },
      { status: 400 }
    );
  }

  const body = rawBody as { email?: unknown; rut?: unknown };
  const normalizedEmail =
    typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';

  if (
    !normalizedEmail ||
    normalizedEmail.length > 254 ||
    !EMAIL_REGEX.test(normalizedEmail)
  ) {
    return NextResponse.json(
      { error: 'Debes ingresar un correo electrónico válido.' },
      { status: 400 }
    );
  }

  try {
    const inCooldown = await checkMagicLinkCooldown(normalizedEmail);
    if (inCooldown) {
      return NextResponse.json(
        {
          error:
            'Por seguridad debes esperar unos segundos (45s) antes de solicitar otro enlace.',
        },
        { status: 429 }
      );
    }

    const emailFilter: Prisma.ParticipantWhereInput = {
      OR: [
        { email: { equals: normalizedEmail, mode: 'insensitive' } },
        { guardianEmail: { equals: normalizedEmail, mode: 'insensitive' } },
      ],
    };

    const rawRut = typeof body.rut === 'string' ? body.rut.trim() : '';
    const cleanedRut = rawRut ? cleanRut(rawRut) : '';

    const where: Prisma.ParticipantWhereInput = cleanedRut
      ? {
          AND: [
            emailFilter,
            {
              OR: [
                { rutClean: cleanedRut },
                { rut: formatRut(cleanedRut) },
                { rut: cleanedRut },
              ],
            },
          ],
        }
      : emailFilter;

    const participants = await prisma.participant.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }],
      select: {
        id: true,
        eventId: true,
        firstName: true,
        lastName: true,
        status: true,
        event: {
          select: {
            name: true,
            shortName: true,
          },
        },
      },
    });

    const target =
      participants.find((participant) => participant.status !== 'RETIRADO') ??
      participants[0];

    if (!target) {
      return NextResponse.json({
        success: true,
        emailDelivered: false,
        message: NEUTRAL_SUCCESS_MESSAGE,
      });
    }

    const forwardedFor = req.headers.get('x-forwarded-for');
    const ipAddress =
      forwardedFor?.split(',')[0]?.trim() ||
      req.headers.get('x-real-ip')?.trim() ||
      null;
    const userAgent = req.headers.get('user-agent')?.trim() || null;

    const { rawToken } = await createParticipantMagicLink({
      participantId: target.id,
      email: normalizedEmail,
      ipAddress,
      userAgent,
    });

    const originFallback =
      req.nextUrl.origin && req.nextUrl.origin !== 'null'
        ? req.nextUrl.origin
        : 'http://localhost:3000';
    const baseUrl = (
      process.env.NEXT_PUBLIC_APP_URL?.trim() || originFallback
    ).replace(/\/+$/, '');
    const accessUrl = `${baseUrl}/portal/acceso?token=${encodeURIComponent(rawToken)}`;

    const mailResult = await sendMagicLinkEmail({
      toEmail: normalizedEmail,
      recipientName: `${target.firstName} ${target.lastName}`.trim(),
      eventName: target.event?.name || 'Portal AGSCH',
      eventId: target.eventId,
      accessUrl,
      expiresMinutes: 15,
    });

    const previewAllowed =
      !mailResult.delivered &&
      (process.env.NODE_ENV !== 'production' ||
        process.env.ALLOW_MAGIC_LINK_PREVIEW === 'true');

    return NextResponse.json({
      success: true,
      message: NEUTRAL_SUCCESS_MESSAGE,
      emailDelivered: mailResult.delivered,
      ...(previewAllowed ? { previewUrl: accessUrl } : {}),
    });
  } catch (error: unknown) {
    return apiErrorResponse(error, 'Error al solicitar el enlace de acceso', 500);
  }
}
