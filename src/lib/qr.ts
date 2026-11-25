import { NextRequest } from 'next/server';
import QRCode from 'qrcode';

/**
 * Resolves the public base URL from the incoming request headers or NextURL, with a localhost fallback.
 */
export function getRequestBaseUrl(req: NextRequest): string {
  const origin = req.headers.get('origin')?.trim();
  if (origin && origin !== 'null') {
    return origin.replace(/\/+$/, '');
  }

  const host = req.headers.get('x-forwarded-host') || req.headers.get('host');
  if (host) {
    const protoHeader = req.headers.get('x-forwarded-proto');
    const proto = protoHeader
      ? protoHeader.split(',')[0].trim()
      : host.startsWith('localhost') || host.startsWith('127.0.0.1')
        ? 'http'
        : 'https';
    return `${proto}://${host}`.replace(/\/+$/, '');
  }

  if (req.nextUrl?.origin && req.nextUrl.origin !== 'null') {
    return req.nextUrl.origin.replace(/\/+$/, '');
  }

  return 'http://localhost:3000';
}

/**
 * Generates the emergency medical access URL and its AGSCH-branded QR Data URL.
 */
export async function generateMedicalQr(
  req: NextRequest,
  qrAccessCode: string
): Promise<{ qrEmergencyUrl: string; qrDataUrl: string }> {
  const baseUrl = getRequestBaseUrl(req);
  const qrEmergencyUrl = `${baseUrl}/medico/${qrAccessCode}`;
  const qrDataUrl = await QRCode.toDataURL(qrEmergencyUrl, {
    margin: 1,
    width: 256,
    color: {
      dark: '#001558',
      light: '#FFFFFF',
    },
  });

  return { qrEmergencyUrl, qrDataUrl };
}
