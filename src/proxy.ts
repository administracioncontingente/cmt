import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify, type JWTPayload } from 'jose';
import { getJwtSecret } from '@/lib/jwtConfig';

const SESSION_COOKIE_NAME = 'agsch_session';
const PARTICIPANT_SESSION_COOKIE_NAME = 'agsch_participant_session';

const PUBLIC_PATH_PREFIXES = [
  '/login',
  '/api/auth/login',
  '/api/webhooks/fillout',
  '/api/public',
  '/pagos',
  '/ficha-medica',
  '/medico',
  '/api/medical',
  '/portal',
  '/api/portal',
  '/_next',
  '/favicon.ico',
  '/public',
  '/calendarios',
];

/**
 * Verifies a JWT string against the application HMAC secret and returns its payload or null.
 */
async function verifyJwt(token: string): Promise<JWTPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getJwtSecret());
    return payload;
  } catch {
    return null;
  }
}

/**
 * Checks whether the request carries a valid admin/staff or scoped participant session for receipts.
 */
async function isAuthorizedForReceipt(req: NextRequest): Promise<boolean> {
  const adminToken = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  const adminPayload = adminToken ? await verifyJwt(adminToken) : null;
  if (adminPayload && adminPayload.scope !== 'PARTICIPANT_PORTAL') {
    return true;
  }

  const participantToken = req.cookies.get(PARTICIPANT_SESSION_COOKIE_NAME)?.value;
  if (!participantToken) return false;

  const participantPayload = await verifyJwt(participantToken);
  return (
    participantPayload?.scope === 'PARTICIPANT_PORTAL' &&
    typeof participantPayload.participantId === 'string' &&
    participantPayload.participantId.length > 0
  );
}

/**
 * Next.js 16 request proxy guarding authenticated dashboard and API routes.
 */
export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (
    pathname === '/eventos' ||
    pathname.startsWith('/eventos/') ||
    PUBLIC_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix))
  ) {
    return NextResponse.next();
  }

  if (pathname.startsWith('/api/receipts')) {
    if (await isAuthorizedForReceipt(req)) {
      return NextResponse.next();
    }
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;

  if (!token) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }
    const loginUrl = new URL('/login', req.url);
    return NextResponse.redirect(loginUrl);
  }

  if (await verifyJwt(token)) {
    return NextResponse.next();
  }

  if (pathname.startsWith('/api/')) {
    return NextResponse.json({ error: 'Sesión expirada o inválida' }, { status: 401 });
  }
  const loginUrl = new URL('/login', req.url);
  const response = NextResponse.redirect(loginUrl);
  response.cookies.set(SESSION_COOKIE_NAME, '', { maxAge: 0, path: '/' });
  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)'],
};
