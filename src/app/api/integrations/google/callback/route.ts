import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser, getEventPermissions } from '@/lib/auth';
import {
  GOOGLE_OAUTH_STATE_COOKIE,
  exchangeGoogleCodeForTokens,
  fetchGoogleUserEmail,
  getGoogleOAuthConfig,
  verifyGoogleOAuthState,
} from '@/lib/googleWorkspace';

function redirectWithError(req: NextRequest, message: string): NextResponse {
  const res = NextResponse.redirect(
    new URL(`/crm?googleError=${encodeURIComponent(message)}`, req.url)
  );
  res.cookies.set(GOOGLE_OAUTH_STATE_COOKIE, '', {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 0,
  });
  return res;
}

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.redirect(new URL('/login', req.url));
  }

  const { searchParams } = new URL(req.url);
  const oauthError = searchParams.get('error');
  if (oauthError) {
    return redirectWithError(
      req,
      `Google canceló o rechazó la autorización (${oauthError}).`
    );
  }

  const code = searchParams.get('code')?.trim();
  const stateParam = searchParams.get('state')?.trim();
  const cookieNonce = req.cookies.get(GOOGLE_OAUTH_STATE_COOKIE)?.value;

  if (!code || !stateParam || !cookieNonce) {
    return redirectWithError(
      req,
      'Solicitud OAuth inválida o expirada. Intenta conectar nuevamente.'
    );
  }

  const parsedState = await verifyGoogleOAuthState(stateParam);
  if (
    !parsedState ||
    parsedState.nonce !== cookieNonce ||
    parsedState.userId !== user.id
  ) {
    return redirectWithError(
      req,
      'Verificación de seguridad OAuth inválida. Intenta nuevamente.'
    );
  }

  if (!getEventPermissions(user, parsedState.eventId).isEventAdmin) {
    return redirectWithError(
      req,
      'No tienes permisos de administración en este evento.'
    );
  }

  const config = getGoogleOAuthConfig(req.nextUrl.origin);
  if (!config.configured) {
    return redirectWithError(
      req,
      'Faltan GOOGLE_CLIENT_ID y GOOGLE_CLIENT_SECRET en el servidor.'
    );
  }

  try {
    const tokens = await exchangeGoogleCodeForTokens({
      code,
      clientId: config.clientId,
      clientSecret: config.clientSecret,
      redirectUri: config.redirectUri,
    });

    const email = await fetchGoogleUserEmail(tokens.accessToken);

    const existing = await prisma.emailAccount.findUnique({
      where: {
        eventId_email: {
          eventId: parsedState.eventId,
          email,
        },
      },
      select: { refreshToken: true },
    });

    await prisma.emailAccount.upsert({
      where: {
        eventId_email: {
          eventId: parsedState.eventId,
          email,
        },
      },
      update: {
        provider: 'GOOGLE',
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken || existing?.refreshToken || null,
        tokenExpiry: tokens.expiresAt,
        syncStatus: 'SUCCESS',
        lastError: null,
      },
      create: {
        eventId: parsedState.eventId,
        email,
        provider: 'GOOGLE',
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        tokenExpiry: tokens.expiresAt,
        syncStatus: 'SUCCESS',
      },
    });

    const res = NextResponse.redirect(
      new URL(
        `/crm?googleConnected=${encodeURIComponent(email)}`,
        req.url
      )
    );
    res.cookies.set(GOOGLE_OAUTH_STATE_COOKIE, '', {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 0,
    });
    return res;
  } catch (err: unknown) {
    const message =
      err instanceof Error
        ? err.message
        : 'Error al conectar la cuenta de Google Workspace';
    return redirectWithError(req, message);
  }
}
