import { NextResponse } from 'next/server';
import { clearParticipantSessionCookie } from '@/lib/participantAuth';

export async function POST() {
  const res = NextResponse.json({ success: true });
  clearParticipantSessionCookie(res);
  return res;
}
