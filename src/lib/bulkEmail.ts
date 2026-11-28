import { formatCurrency } from '@/lib/finance';

export const BULK_EMAIL_BATCH_SIZE = 15;

export const BULK_TEMPLATE_VARIABLES = [
  { key: '{{nombre}}', description: 'Primer nombre del participante' },
  { key: '{{nombre_completo}}', description: 'Nombre y apellidos' },
  { key: '{{rut}}', description: 'RUT formateado' },
  { key: '{{rol}}', description: 'Rol en el contingente' },
  { key: '{{evento}}', description: 'Nombre del evento' },
  { key: '{{saldo_pendiente}}', description: 'Saldo pendiente formateado' },
  { key: '{{total_pagado}}', description: 'Monto abonado formateado' },
  { key: '{{link_portal}}', description: 'Enlace al Portal del Participante' },
  { key: '{{link_evento}}', description: 'Enlace a la página del evento' },
] as const;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isDeliverableEmail(email?: string | null): boolean {
  if (!email) return false;
  const clean = email.trim().toLowerCase();
  if (!EMAIL_RE.test(clean)) return false;
  if (clean.endsWith('@participante.agsch.cl')) return false;
  return true;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export interface BulkTemplateContext {
  firstName: string;
  fullName: string;
  rut: string;
  contingentRole: string;
  eventName: string;
  remainingAmount: number;
  paidAmount: number;
  currency: string;
  portalUrl: string;
  eventPageUrl: string;
}

export function renderBulkTemplateText(
  template: string,
  ctx: BulkTemplateContext
): string {
  const vars: Record<string, string> = {
    '{{nombre}}': ctx.firstName,
    '{{nombre_completo}}': ctx.fullName,
    '{{rut}}': ctx.rut,
    '{{rol}}': ctx.contingentRole,
    '{{evento}}': ctx.eventName,
    '{{saldo_pendiente}}': formatCurrency(ctx.remainingAmount, ctx.currency),
    '{{total_pagado}}': formatCurrency(ctx.paidAmount, ctx.currency),
    '{{link_portal}}': ctx.portalUrl,
    '{{link_evento}}': ctx.eventPageUrl,
  };

  let out = template;
  for (const [token, val] of Object.entries(vars)) {
    out = out.split(token).join(val);
  }
  return out;
}

export function buildBulkEmailContent(params: {
  subjectTemplate: string;
  bodyTemplate: string;
  ctx: BulkTemplateContext;
  includePortalCta?: boolean;
}): { subject: string; text: string; html: string } {
  const subject = renderBulkTemplateText(params.subjectTemplate, params.ctx)
    .replace(/[\r\n]+/g, ' ')
    .trim();
  const bodyPlain = renderBulkTemplateText(params.bodyTemplate, params.ctx).trim();

  const text = params.includePortalCta
    ? `${bodyPlain}\n\nPortal del Participante: ${params.ctx.portalUrl}\nPágina del Evento: ${params.ctx.eventPageUrl}`
    : bodyPlain;

  const paragraphsHtml = bodyPlain
    .split(/\n{2,}/)
    .map(
      (p) =>
        `<p style="margin:0 0 14px 0;font-size:15px;line-height:1.6;color:#334155;">${escapeHtml(
          p
        ).replace(/\n/g, '<br />')}</p>`
    )
    .join('');

  const ctaHtml = params.includePortalCta
    ? `<table role="presentation" cellspacing="0" cellpadding="0" style="margin:24px 0 8px 0;">
        <tr>
          <td align="center" style="border-radius:8px;background-color:#FEB135;">
            <a href="${escapeHtml(params.ctx.portalUrl)}" target="_blank" rel="noopener noreferrer" style="display:inline-block;padding:13px 24px;font-size:14px;font-weight:700;color:#001558;text-decoration:none;border-radius:8px;">
              Ir al Portal del Participante
            </a>
          </td>
        </tr>
      </table>`
    : '';

  const safeEvent = escapeHtml(params.ctx.eventName);

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
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background-color:#FFFFFF;border-radius:12px;overflow:hidden;border:1px solid #E2E8F0;">
            <tr>
              <td style="background-color:#001558;padding:22px 28px;border-bottom:4px solid #FEB135;">
                <p style="margin:0;font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:#FEB135;font-weight:700;">
                  Asociación de Guías y Scouts de Chile
                </p>
                <h1 style="margin:6px 0 0 0;font-size:18px;line-height:1.35;color:#FFFFFF;font-weight:700;">
                  ${safeEvent}
                </h1>
              </td>
            </tr>
            <tr>
              <td style="padding:28px;">
                ${paragraphsHtml}
                ${ctaHtml}
              </td>
            </tr>
            <tr>
              <td style="padding:16px 28px;background-color:#F8FAFC;border-top:1px solid #E2E8F0;">
                <p style="margin:0;font-size:12px;line-height:1.5;color:#64748B;">
                  Comunicado oficial enviado a participantes y familias de ${safeEvent} • AGSCH Eventos
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  return { subject, text, html };
}
