import { NextRequest, NextResponse } from 'next/server';
import {
  getCurrentUser,
  getEventPermissions,
  resolveAuthorizedEventId,
} from '@/lib/auth';
import {
  GOOGLE_OAUTH_SCOPES,
  GOOGLE_OAUTH_STATE_COOKIE,
  createGoogleOAuthState,
  getGoogleOAuthConfig,
} from '@/lib/googleWorkspace';

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.redirect(new URL('/login', req.url));
  }

  const { searchParams } = new URL(req.url);
  const paramEventId = searchParams.get('eventId');

  const { eventId, forbidden } = await resolveAuthorizedEventId(
    user,
    paramEventId
  );

  if (forbidden || !eventId || !getEventPermissions(user, eventId).isEventAdmin) {
    return NextResponse.redirect(
      new URL(
        `/crm?googleError=${encodeURIComponent('Solo Administradores del evento pueden conectar Google Workspace.')}`,
        req.url
      )
    );
  }

  const config = getGoogleOAuthConfig(req.nextUrl.origin);
  if (!config.configured) {
    return NextResponse.redirect(
      new URL(
        `/crm?googleError=${encodeURIComponent('Faltan GOOGLE_CLIENT_ID y GOOGLE_CLIENT_SECRET en el servidor.')}`,
        req.url
      )
    );
  }

  const { stateJwt, nonce } = await createGoogleOAuthState({
    eventId,
    userId: user.id,
  });

  const authParams = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: 'code',
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: 'true',
    scope: GOOGLE_OAUTH_SCOPES.join(' '),
    state: stateJwt,
  });

  const response = NextResponse.redirect(
    `https://accounts.google.com/o/oauth2/v2/auth?${authParams.toString()}`
  );

  response.cookies.set(GOOGLE_OAUTH_STATE_COOKIE, nonce, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 600,
  });

  return response;
}
