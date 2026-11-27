import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  createParticipantSessionToken,
  getParticipantSession,
  setParticipantSessionCookie,
} from '@/lib/participantAuth';
import { apiErrorResponse } from '@/lib/apiUtils';

export async function POST(req: NextRequest) {
  const session = await getParticipantSession();
  if (!session) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

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
      { error: 'El identificador del participante es requerido.' },
      { status: 400 }
    );
  }

  const { participantId } = rawBody as { participantId?: unknown };
  if (typeof participantId !== 'string' || !participantId.trim()) {
    return NextResponse.json(
      { error: 'El identificador del participante es requerido.' },
      { status: 400 }
    );
  }

  try {
    const target = await prisma.participant.findUnique({
      where: { id: participantId.trim() },
      select: {
        id: true,
        email: true,
        guardianEmail: true,
      },
    });

    if (!target) {
      return NextResponse.json(
        { error: 'Participante no encontrado' },
        { status: 404 }
      );
    }

    const sessionEmail = session.email.toLowerCase().trim();
    const matchesEmail = target.email.toLowerCase().trim() === sessionEmail;
    const matchesGuardian =
      (target.guardianEmail || '').toLowerCase().trim() === sessionEmail;

    if (!matchesEmail && !matchesGuardian) {
      return NextResponse.json(
        { error: 'No tienes permiso para acceder a este participante.' },
        { status: 403 }
      );
    }

    const token = await createParticipantSessionToken({
      participantId: target.id,
      email: session.email,
    });

    const res = NextResponse.json({ success: true });
    setParticipantSessionCookie(res, token);
    return res;
  } catch (error: unknown) {
    return apiErrorResponse(error, 'Error al cambiar de participante', 500);
  }
}
