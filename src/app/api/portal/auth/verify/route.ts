import { NextRequest, NextResponse } from 'next/server';
import {
  consumeParticipantMagicLink,
  createParticipantSessionToken,
  setParticipantSessionCookie,
} from '@/lib/participantAuth';
import { apiErrorResponse } from '@/lib/apiUtils';

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
      { error: 'Token de acceso requerido.' },
      { status: 400 }
    );
  }

  const { token } = rawBody as { token?: unknown };
  if (!token || typeof token !== 'string' || !token.trim()) {
    return NextResponse.json(
      { error: 'Token de acceso requerido.' },
      { status: 400 }
    );
  }

  try {
    const verified = await consumeParticipantMagicLink(token);
    if (!verified) {
      return NextResponse.json(
        {
          error:
            'El enlace es inválido, ya fue utilizado o expiró. Solicita un nuevo enlace.',
        },
        { status: 401 }
      );
    }

    const jwt = await createParticipantSessionToken({
      participantId: verified.participantId,
      email: verified.email,
    });

    const res = NextResponse.json({ success: true });
    setParticipantSessionCookie(res, jwt);
    return res;
  } catch (error: unknown) {
    return apiErrorResponse(error, 'Error al verificar el enlace de acceso', 500);
  }
}
