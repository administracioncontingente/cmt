import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { apiErrorResponse } from '@/lib/apiUtils';
import { processFilloutWebhook, type FilloutWebhookPayload } from '@/lib/fillout';

function verifyWebhookSecret(req: NextRequest): boolean {
  const expected = process.env.FILLOUT_WEBHOOK_SECRET?.trim();
  if (!expected) {
    return process.env.NODE_ENV !== 'production';
  }

  const headerSecret = req.headers.get('x-fillout-secret')?.trim();
  const authHeader = req.headers.get('authorization')?.trim();
  const bearerSecret = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;
  const provided = headerSecret || bearerSecret;

  if (!provided) return false;

  const expectedBuf = Buffer.from(expected, 'utf8');
  const providedBuf = Buffer.from(provided, 'utf8');
  if (expectedBuf.length !== providedBuf.length) return false;

  return crypto.timingSafeEqual(expectedBuf, providedBuf);
}

/**
 * POST /api/webhooks/fillout
 * Receives real-time submissions from Fillout main payment form (1qPV7xVVsjus)
 * and multi-participant split subform (nmU7huGUkvus).
 */
export async function POST(req: NextRequest) {
  if (!verifyWebhookSecret(req)) {
    return NextResponse.json({ error: 'Webhook no autorizado' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const eventCode = searchParams.get('eventCode');
    const explicitFormKind = searchParams.get('formType');

    const payload = (await req.json()) as FilloutWebhookPayload;
    if (!payload || !payload.submission) {
      return NextResponse.json(
        { error: 'Payload de Fillout inválido (falta submission)' },
        { status: 400 }
      );
    }

    const result = await processFilloutWebhook(payload, {
      eventCode,
      explicitFormKind,
    });

    return NextResponse.json(result, { status: 200 });
  } catch (error: unknown) {
    return apiErrorResponse(error, 'Error al procesar webhook de Fillout', 500);
  }
}
