import crypto from 'crypto';
import { SignJWT, jwtVerify } from 'jose';
import { prisma } from '@/lib/prisma';
import { getJwtSecret } from '@/lib/jwtConfig';
import { ingestEmailMessage, type SyncedMessageData } from '@/lib/inboxSync';

export const GOOGLE_OAUTH_STATE_COOKIE = 'agsch_google_oauth_state';

export const GOOGLE_OAUTH_SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/userinfo.email',
] as const;

export interface GoogleOAuthConfig {
  configured: boolean;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

export interface GoogleOAuthStatePayload {
  eventId: string;
  userId: string;
  nonce: string;
  scope: 'GOOGLE_OAUTH_STATE';
}

export function getGoogleOAuthConfig(origin: string): GoogleOAuthConfig {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim() || '';
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim() || '';
  const cleanOrigin = origin.replace(/\/+$/, '');
  const redirectUri =
    process.env.GOOGLE_REDIRECT_URI?.trim() ||
    `${cleanOrigin}/api/integrations/google/callback`;

  return {
    configured: Boolean(clientId && clientSecret),
    clientId,
    clientSecret,
    redirectUri,
  };
}

export async function createGoogleOAuthState(params: {
  eventId: string;
  userId: string;
}): Promise<{ stateJwt: string; nonce: string }> {
  const nonce = crypto.randomBytes(16).toString('hex');
  const payload: GoogleOAuthStatePayload = {
    eventId: params.eventId,
    userId: params.userId,
    nonce,
    scope: 'GOOGLE_OAUTH_STATE',
  };

  const stateJwt = await new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('10m')
    .sign(getJwtSecret());

  return { stateJwt, nonce };
}

export async function verifyGoogleOAuthState(
  token: string
): Promise<GoogleOAuthStatePayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getJwtSecret());
    if (
      payload.scope !== 'GOOGLE_OAUTH_STATE' ||
      typeof payload.eventId !== 'string' ||
      typeof payload.userId !== 'string' ||
      typeof payload.nonce !== 'string'
    ) {
      return null;
    }
    return {
      eventId: payload.eventId,
      userId: payload.userId,
      nonce: payload.nonce,
      scope: 'GOOGLE_OAUTH_STATE',
    };
  } catch {
    return null;
  }
}

export async function exchangeGoogleCodeForTokens(params: {
  code: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}): Promise<{
  accessToken: string;
  refreshToken: string | null;
  expiresAt: Date;
}> {
  const body = new URLSearchParams({
    code: params.code,
    client_id: params.clientId,
    client_secret: params.clientSecret,
    redirect_uri: params.redirectUri,
    grant_type: 'authorization_code',
  });

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  const data = (await res.json().catch(() => ({}))) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    error?: string;
    error_description?: string;
  };

  if (!res.ok || !data.access_token) {
    throw new Error(
      data.error_description ||
        data.error ||
        `Error intercambiando código OAuth de Google (HTTP ${res.status})`
    );
  }

  const expiresInSec =
    typeof data.expires_in === 'number' && data.expires_in > 0
      ? data.expires_in
      : 3600;

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token || null,
    expiresAt: new Date(Date.now() + expiresInSec * 1000),
  };
}

export async function fetchGoogleUserEmail(accessToken: string): Promise<string> {
  const res = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = (await res.json().catch(() => ({}))) as {
    email?: string;
    error?: { message?: string };
  };
  if (!res.ok || !data.email) {
    throw new Error(
      data.error?.message ||
        'No se pudo obtener el correo de la cuenta de Google Workspace'
    );
  }
  return data.email.toLowerCase().trim();
}

export async function getValidGoogleAccessToken(accountId: string): Promise<{
  accessToken: string;
  email: string;
}> {
  const account = await prisma.emailAccount.findUnique({
    where: { id: accountId },
    select: {
      id: true,
      email: true,
      provider: true,
      accessToken: true,
      refreshToken: true,
      tokenExpiry: true,
    },
  });

  if (!account || account.provider !== 'GOOGLE') {
    throw new Error('Cuenta de Google Workspace no encontrada');
  }

  const nowPlusBuffer = new Date(Date.now() + 90 * 1000);
  if (
    account.accessToken &&
    account.tokenExpiry &&
    account.tokenExpiry > nowPlusBuffer
  ) {
    return { accessToken: account.accessToken, email: account.email };
  }

  if (!account.refreshToken) {
    throw new Error(
      'El token expiró y no hay refresh token guardado. Vuelve a conectar la cuenta de Google Workspace.'
    );
  }

  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) {
    throw new Error(
      'Faltan GOOGLE_CLIENT_ID y GOOGLE_CLIENT_SECRET en las variables de entorno del servidor.'
    );
  }

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: account.refreshToken,
    grant_type: 'refresh_token',
  });

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  const data = (await res.json().catch(() => ({}))) as {
    access_token?: string;
    expires_in?: number;
    error?: string;
    error_description?: string;
  };

  if (!res.ok || !data.access_token) {
    const errMsg =
      data.error_description ||
      data.error ||
      `No se pudo renovar el acceso de Google (HTTP ${res.status})`;
    await prisma.emailAccount.update({
      where: { id: account.id },
      data: { syncStatus: 'ERROR', lastError: errMsg },
    });
    throw new Error(errMsg);
  }

  const expiresInSec =
    typeof data.expires_in === 'number' && data.expires_in > 0
      ? data.expires_in
      : 3600;
  const newExpiry = new Date(Date.now() + expiresInSec * 1000);

  await prisma.emailAccount.update({
    where: { id: account.id },
    data: {
      accessToken: data.access_token,
      tokenExpiry: newExpiry,
      lastError: null,
    },
  });

  return { accessToken: data.access_token, email: account.email };
}

interface GmailMessagePart {
  mimeType?: string;
  filename?: string;
  body?: { data?: string; size?: number; attachmentId?: string };
  parts?: GmailMessagePart[];
}

interface GmailMessageResponse {
  id: string;
  threadId: string;
  labelIds?: string[];
  snippet?: string;
  internalDate?: string;
  payload?: {
    headers?: Array<{ name: string; value: string }>;
    mimeType?: string;
    body?: { data?: string };
    parts?: GmailMessagePart[];
  };
}

function decodeBase64Url(encoded?: string): string {
  if (!encoded) return '';
  const normalized = encoded.replace(/-/g, '+').replace(/_/g, '/');
  return Buffer.from(normalized, 'base64').toString('utf8');
}

function parseEmailAddressHeader(raw?: string): {
  name?: string;
  email: string;
} {
  if (!raw) return { email: 'desconocido@gmail.com' };
  const angleMatch = /^(.*?)\s*<([^>]+)>/.exec(raw.trim());
  if (angleMatch) {
    const cleanName = angleMatch[1].replace(/^["']|["']$/g, '').trim();
    return {
      name: cleanName || undefined,
      email: angleMatch[2].trim().toLowerCase(),
    };
  }
  const emailOnly = raw.trim().toLowerCase();
  return { email: emailOnly };
}

function extractGmailBodies(part?: GmailMessagePart): {
  text: string;
  html: string;
  hasAttachments: boolean;
} {
  let text = '';
  let html = '';
  let hasAttachments = false;

  function walk(node?: GmailMessagePart) {
    if (!node) return;
    if (node.filename && node.filename.trim().length > 0) {
      hasAttachments = true;
    }
    const mime = (node.mimeType || '').toLowerCase();
    if (mime === 'text/plain' && node.body?.data && !text) {
      text = decodeBase64Url(node.body.data);
    } else if (mime === 'text/html' && node.body?.data && !html) {
      html = decodeBase64Url(node.body.data);
    }
    if (Array.isArray(node.parts)) {
      for (const child of node.parts) {
        walk(child);
      }
    }
  }

  walk(part);
  return { text, html, hasAttachments };
}

export async function syncGoogleInboxForEvent(
  eventId: string,
  maxResults = 25
): Promise<{
  accountEmail: string;
  syncedCount: number;
  messages: Awaited<ReturnType<typeof ingestEmailMessage>>[];
}> {
  const account = await prisma.emailAccount.findFirst({
    where: { eventId, provider: 'GOOGLE' },
    orderBy: { updatedAt: 'desc' },
  });

  if (!account) {
    throw new Error(
      'No hay una cuenta de Google Workspace conectada para este evento.'
    );
  }

  await prisma.emailAccount.update({
    where: { id: account.id },
    data: { syncStatus: 'SYNCING', lastError: null },
  });

  try {
    const { accessToken, email: accountEmail } = await getValidGoogleAccessToken(
      account.id
    );

    const listUrl = `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=${maxResults}&q=${encodeURIComponent('-in:spam -in:trash')}`;
    const listRes = await fetch(listUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    const listData = (await listRes.json().catch(() => ({}))) as {
      messages?: Array<{ id: string; threadId: string }>;
      error?: { message?: string };
    };

    if (!listRes.ok) {
      throw new Error(
        listData.error?.message ||
          `Error listando mensajes de Gmail (HTTP ${listRes.status})`
      );
    }

    const messageRefs = listData.messages || [];
    const ingested = [];

    for (const ref of messageRefs) {
      const msgRes = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(ref.id)}?format=full`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      if (!msgRes.ok) continue;

      const msgData = (await msgRes.json()) as GmailMessageResponse;
      const headers = msgData.payload?.headers || [];
      const getHeader = (name: string) =>
        headers.find((h) => h.name.toLowerCase() === name.toLowerCase())
          ?.value || '';

      const fromParsed = parseEmailAddressHeader(getHeader('From'));
      const toParsed = parseEmailAddressHeader(getHeader('To'));
      const subject = getHeader('Subject').trim() || '(Sin asunto)';
      const dateStr = getHeader('Date');
      const internalMs = msgData.internalDate
        ? Number(msgData.internalDate)
        : NaN;
      const parsedDate =
        Number.isFinite(internalMs) && internalMs > 0
          ? new Date(internalMs)
          : dateStr && !Number.isNaN(new Date(dateStr).getTime())
            ? new Date(dateStr)
            : new Date();

      const { text, html, hasAttachments } = extractGmailBodies(
        msgData.payload
      );

      const syncedPayload: SyncedMessageData = {
        googleMessageId: msgData.id,
        googleThreadId: msgData.threadId,
        senderEmail: fromParsed.email,
        senderName: fromParsed.name,
        recipientEmail: toParsed.email || accountEmail,
        subject,
        snippet: msgData.snippet,
        bodyText: text || msgData.snippet || '',
        bodyHtml: html || undefined,
        date: parsedDate,
        hasAttachments,
        labels: msgData.labelIds || ['INBOX'],
      };

      const saved = await ingestEmailMessage(eventId, account.id, syncedPayload);
      ingested.push(saved);
    }

    await prisma.emailAccount.update({
      where: { id: account.id },
      data: {
        syncStatus: 'SUCCESS',
        lastSyncedAt: new Date(),
        lastError: null,
      },
    });

    return {
      accountEmail,
      syncedCount: ingested.length,
      messages: ingested,
    };
  } catch (err: unknown) {
    const errMsg =
      err instanceof Error ? err.message : 'Error sincronizando Gmail';
    await prisma.emailAccount
      .update({
        where: { id: account.id },
        data: { syncStatus: 'ERROR', lastError: errMsg },
      })
      .catch(() => undefined);
    throw err;
  }
}

function encodeMimeSubject(subject: string): string {
  const clean = subject.replace(/[\r\n]+/g, ' ').trim();
  return `=?UTF-8?B?${Buffer.from(clean, 'utf8').toString('base64')}?=`;
}

export async function sendEmailViaGoogleWorkspace(params: {
  eventId?: string | null;
  toEmail: string;
  subject: string;
  html: string;
  text: string;
}): Promise<{ delivered: boolean; fromEmail?: string }> {
  const account = await prisma.emailAccount.findFirst({
    where: {
      provider: 'GOOGLE',
      refreshToken: { not: null },
      ...(params.eventId ? { eventId: params.eventId } : {}),
    },
    orderBy: { updatedAt: 'desc' },
    select: { id: true, email: true },
  });

  const fallbackAccount =
    account ??
    (await prisma.emailAccount.findFirst({
      where: {
        provider: 'GOOGLE',
        refreshToken: { not: null },
      },
      orderBy: { updatedAt: 'desc' },
      select: { id: true, email: true },
    }));

  if (!fallbackAccount) {
    return { delivered: false };
  }

  try {
    const { accessToken, email: fromEmail } = await getValidGoogleAccessToken(
      fallbackAccount.id
    );

    const boundary = `agsch_${crypto.randomBytes(12).toString('hex')}`;
    const safeTo = params.toEmail.replace(/[\r\n]+/g, '').trim();

    const rawMime = [
      `From: AGSCH Eventos <${fromEmail}>`,
      `To: ${safeTo}`,
      `Subject: ${encodeMimeSubject(params.subject)}`,
      'MIME-Version: 1.0',
      `Content-Type: multipart/alternative; boundary="${boundary}"`,
      '',
      `--${boundary}`,
      'Content-Type: text/plain; charset="UTF-8"',
      'Content-Transfer-Encoding: base64',
      '',
      Buffer.from(params.text, 'utf8').toString('base64'),
      `--${boundary}`,
      'Content-Type: text/html; charset="UTF-8"',
      'Content-Transfer-Encoding: base64',
      '',
      Buffer.from(params.html, 'utf8').toString('base64'),
      `--${boundary}--`,
      '',
    ].join('\r\n');

    const encodedRaw = Buffer.from(rawMime, 'utf8')
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    const res = await fetch(
      'https://gmail.googleapis.com/gmail/v1/users/me/messages/send',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ raw: encodedRaw }),
      }
    );

    if (res.ok) {
      return { delivered: true, fromEmail };
    }

    const errText = await res.text().catch(() => '');
    console.error(
      `[AGSCH Google Mailer] Error enviando correo via Gmail API (HTTP ${res.status}): ${errText.slice(0, 200)}`
    );
    return { delivered: false };
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : 'Error enviando con Google Workspace';
    console.error(`[AGSCH Google Mailer] Excepción: ${message}`);
    return { delivered: false };
  }
}
