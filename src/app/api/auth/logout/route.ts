import { NextResponse } from 'next/server';
import { SESSION_COOKIE_NAME, ACTIVE_EVENT_COOKIE } from '@/lib/auth';

export async function POST() {
  const response = NextResponse.json({ ok: true });
  const isProd = process.env.NODE_ENV === 'production';

  response.cookies.set(SESSION_COOKIE_NAME, '', {
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax',
    expires: new Date(0),
    path: '/',
  });

  response.cookies.set(ACTIVE_EVENT_COOKIE, '', {
    httpOnly: false,
    secure: isProd,
    sameSite: 'lax',
    expires: new Date(0),
    path: '/',
  });

  return response;
}
