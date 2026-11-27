export interface SendMagicLinkEmailParams {
  toEmail: string;
  recipientName: string;
  eventName: string;
  accessUrl: string;
  expiresMinutes?: number;
}

export interface SendMagicLinkEmailResult {
  delivered: boolean;
  provider: 'resend' | 'console';
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function sanitizeHttpUrl(rawUrl: string): string {
  const trimmed = rawUrl.trim();
  if (trimmed.startsWith('https://') || trimmed.startsWith('http://')) {
    return trimmed;
  }
  return '#';
}

function logMagicLinkToConsole(params: {
  toEmail: string;
  recipientName: string;
  eventName: string;
  accessUrl: string;
  expiresMinutes: number;
}): void {
  const logMessage = `
======================================================
📧 [AGSCH] ENLACE MÁGICO - PORTAL DEL PARTICIPANTE
Para: ${params.recipientName} <${params.toEmail}>
Evento: ${params.eventName}
Enlace de acceso: ${params.accessUrl}
Vigencia: ${params.expiresMinutes} minutos (un solo uso)
======================================================
  `;
  console.log(logMessage);
}

/**
 * Sends a participant portal magic-link email via Resend when RESEND_API_KEY is configured,
 * or falls back to structured console logging in development/unconfigured environments.
 */
export async function sendMagicLinkEmail(
  params: SendMagicLinkEmailParams
): Promise<SendMagicLinkEmailResult> {
  const expiresMinutes =
    typeof params.expiresMinutes === 'number' && params.expiresMinutes > 0
      ? Math.round(params.expiresMinutes)
      : 15;

  const cleanEventName = params.eventName.replace(/[\r\n]+/g, ' ').trim() || 'AGSCH Eventos';
  const cleanRecipientName = params.recipientName.replace(/[\r\n]+/g, ' ').trim() || 'Participante';
  const safeHref = escapeHtml(sanitizeHttpUrl(params.accessUrl));
  const safeUrlText = escapeHtml(params.accessUrl.trim());
  const safeRecipient = escapeHtml(cleanRecipientName);
  const safeEvent = escapeHtml(cleanEventName);

  const subject = `Enlace de acceso al Portal del Participante • ${cleanEventName}`;

  const html = `<!DOCTYPE html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(subject)}</title>
  </head>
  <body style="margin:0;padding:0;background-color:#F5F6F8;font-family:'Nunito Sans',Arial,Helvetica,sans-serif;color:#1E293B;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#F5F6F8;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:580px;background-color:#FFFFFF;border-radius:12px;overflow:hidden;border:1px solid #E2E8F0;">
            <tr>
              <td style="background-color:#001558;padding:24px 32px;border-bottom:4px solid #FEB135;">
                <p style="margin:0;font-size:12px;letter-spacing:0.08em;text-transform:uppercase;color:#FEB135;font-weight:700;">
                  Asociación de Guías y Scouts de Chile
                </p>
                <h1 style="margin:6px 0 0 0;font-size:20px;line-height:1.3;color:#FFFFFF;font-weight:700;">
                  Portal del Participante • ${safeEvent}
                </h1>
              </td>
            </tr>
            <tr>
              <td style="padding:32px;">
                <p style="margin:0 0 16px 0;font-size:16px;line-height:1.5;color:#0F172A;">
                  Hola <strong>${safeRecipient}</strong>,
                </p>
                <p style="margin:0 0 24px 0;font-size:15px;line-height:1.6;color:#334155;">
                  Recibimos una solicitud para ingresar de forma segura a tu <strong>Portal del Participante</strong> en <strong>${safeEvent}</strong>. Desde ahí podrás revisar tu estado de inscripción, completar tu ficha médica, confirmar tallas de kit y gestionar tus cuotas.
                </p>
                <table role="presentation" cellspacing="0" cellpadding="0" style="margin:0 0 24px 0;">
                  <tr>
                    <td align="center" style="border-radius:8px;background-color:#FEB135;">
                      <a href="${safeHref}" target="_blank" rel="noopener noreferrer" style="display:inline-block;padding:14px 28px;font-size:15px;font-weight:700;color:#001558;text-decoration:none;border-radius:8px;">
                        Ingresar al Portal del Participante
                      </a>
                    </td>
                  </tr>
                </table>
                <div style="margin:0 0 24px 0;padding:14px 16px;background-color:#FFFBF0;border:1px solid #FDE68A;border-radius:8px;">
                  <p style="margin:0;font-size:13px;line-height:1.5;color:#78350F;">
                    <strong>Importante:</strong> Este enlace es personal, de un solo uso y vence en <strong>${expiresMinutes} minutos</strong>. Si no solicitaste este acceso, puedes ignorar este correo con tranquilidad.
                  </p>
                </div>
                <p style="margin:0 0 8px 0;font-size:13px;line-height:1.5;color:#64748B;">
                  Si el botón no funciona, copia y pega el siguiente enlace en tu navegador:
                </p>
                <p style="margin:0;font-size:12px;line-height:1.5;word-break:break-all;color:#001558;background-color:#F8FAFC;padding:12px;border-radius:6px;border:1px solid #E2E8F0;">
                  ${safeUrlText}
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:18px 32px;background-color:#F8FAFC;border-top:1px solid #E2E8F0;">
                <p style="margin:0;font-size:12px;line-height:1.5;color:#64748B;">
                  AGSCH Eventos • Portal Oficial de Participantes y Contingentes
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  const text = [
    `Asociación de Guías y Scouts de Chile — Portal del Participante`,
    `Evento: ${cleanEventName}`,
    '',
    `Hola ${cleanRecipientName},`,
    '',
    `Solicitaste acceso al Portal del Participante para ${cleanEventName}.`,
    `Ingresa usando el siguiente enlace (válido por ${expiresMinutes} minutos, un solo uso):`,
    params.accessUrl.trim(),
    '',
    'Si no solicitaste este acceso, puedes ignorar este mensaje.',
  ].join('\n');

  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    logMagicLinkToConsole({
      toEmail: params.toEmail,
      recipientName: cleanRecipientName,
      eventName: cleanEventName,
      accessUrl: params.accessUrl.trim(),
      expiresMinutes,
    });
    return { delivered: false, provider: 'console' };
  }

  const from = process.env.MAIL_FROM?.trim() || 'AGSCH Eventos <onboarding@resend.dev>';

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [params.toEmail],
        subject,
        html,
        text,
      }),
    });

    if (res.ok) {
      return { delivered: true, provider: 'resend' };
    }

    const errorBody = await res.text().catch(() => '');
    console.error(
      `[AGSCH Mailer] Error enviando magic link con Resend (HTTP ${res.status}): ${errorBody.slice(0, 200)}`
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error de red desconocido';
    console.error(`[AGSCH Mailer] Excepción enviando magic link con Resend: ${message}`);
  }

  logMagicLinkToConsole({
    toEmail: params.toEmail,
    recipientName: cleanRecipientName,
    eventName: cleanEventName,
    accessUrl: params.accessUrl.trim(),
    expiresMinutes,
  });
  return { delivered: false, provider: 'console' };
}
