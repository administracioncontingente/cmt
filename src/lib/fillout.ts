import { prisma } from '@/lib/prisma';
import { cleanRut } from '@/lib/rut';
import { parseOptionalDate, parseOptionalFloat } from '@/lib/apiUtils';
import { computeSheetSyncFields } from '@/lib/finance';
import { createIncidentWithUniqueTicket } from '@/lib/incidents';

export const FILLOUT_MAIN_FORM_ID = '1qPV7xVVsjus';
export const FILLOUT_SUBFORM_ID = 'nmU7huGUkvus';

export interface FilloutQuestionItem {
  id?: string;
  name?: string;
  type?: string;
  value?: unknown;
}

export interface FilloutUrlParamItem {
  id?: string;
  name?: string;
  value?: unknown;
}

export interface FilloutWebhookPayload {
  formId?: string;
  formName?: string;
  submission?: {
    submissionId?: string;
    submissionTime?: string;
    lastUpdatedAt?: string;
    questions?: FilloutQuestionItem[];
    urlParameters?: FilloutUrlParamItem[];
  };
}

export type FilloutFormKind = 'main' | 'subform';

export interface FilloutProcessResult {
  ok: boolean;
  status:
    | 'CREATED'
    | 'ALREADY_PROCESSED'
    | 'DEFERRED_TO_SUBFORM'
    | 'EXCEL_INCIDENT_CREATED'
    | 'PARTICIPANT_NOT_FOUND'
    | 'IGNORED_INVALID';
  formKind: FilloutFormKind;
  submissionId: string | null;
  participantId?: string;
  paymentId?: string;
  incidentTicket?: string;
  message: string;
}

function normalizeFieldKey(key: string): string {
  return key
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

/**
 * Extracts a string value from Fillout question/param values (handles strings, numbers, and FileUpload arrays).
 */
export function extractFilloutString(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' || typeof value === 'boolean') return String(value).trim();

  if (Array.isArray(value)) {
    const urlsOrStrings = value
      .map((item) => {
        if (typeof item === 'string') return item.trim();
        if (item && typeof item === 'object' && 'url' in item) {
          const url = (item as { url?: unknown }).url;
          return typeof url === 'string' ? url.trim() : '';
        }
        return '';
      })
      .filter(Boolean);
    return urlsOrStrings.join(', ');
  }

  if (typeof value === 'object' && 'url' in value) {
    const url = (value as { url?: unknown }).url;
    return typeof url === 'string' ? url.trim() : '';
  }

  return '';
}

/**
 * Builds a normalized lookup map from Fillout questions and URL parameters.
 */
export function buildFilloutFieldMap(payload: FilloutWebhookPayload): Record<string, unknown> {
  const map: Record<string, unknown> = {};

  for (const param of payload.submission?.urlParameters || []) {
    if (param.name) {
      map[normalizeFieldKey(param.name)] = param.value;
    }
    if (param.id) {
      map[normalizeFieldKey(param.id)] = param.value;
    }
  }

  for (const q of payload.submission?.questions || []) {
    if (q.name) {
      map[normalizeFieldKey(q.name)] = q.value;
    }
    if (q.id) {
      map[normalizeFieldKey(q.id)] = q.value;
    }
  }

  return map;
}

export function detectFilloutFormKind(
  payload: FilloutWebhookPayload,
  fieldMap: Record<string, unknown>,
  explicitKind?: string | null
): FilloutFormKind {
  if (explicitKind === 'subform') return 'subform';
  if (explicitKind === 'main') return 'main';
  if (payload.formId === FILLOUT_SUBFORM_ID) return 'subform';
  if (payload.formId === FILLOUT_MAIN_FORM_ID) return 'main';

  if (
    'monto_asignado_usd' in fieldMap ||
    'rut_participante' in fieldMap ||
    'rut_principal' in fieldMap
  ) {
    return 'subform';
  }
  return 'main';
}

function getField(fieldMap: Record<string, unknown>, ...keys: string[]): string {
  for (const k of keys) {
    const norm = normalizeFieldKey(k);
    if (norm in fieldMap) {
      const val = extractFilloutString(fieldMap[norm]);
      if (val) return val;
    }
  }
  return '';
}

async function resolveEventId(eventCode?: string | null): Promise<string | null> {
  const code = eventCode?.trim().toUpperCase();
  if (code) {
    const byCode = await prisma.event.findUnique({
      where: { code },
      select: { id: true },
    });
    if (byCode) return byCode.id;
  }

  const wsj = await prisma.event.findUnique({
    where: { code: 'WSJ-2027' },
    select: { id: true },
  });
  if (wsj) return wsj.id;

  const def = await prisma.event.findFirst({
    where: { isDefault: true, isActive: true },
    select: { id: true },
  });
  return def?.id || null;
}

/**
 * Inserts a Fillout payment atomically and recalculates the participant's financial summary fields.
 */
async function recordFilloutPayment(params: {
  eventId: string;
  rutRaw: string;
  amount: number;
  paymentDate: Date;
  transactionReference: string | null;
  receiptUrl: string | null;
  filloutSubmissionId: string | null;
  source: 'FILLOUT_MAIN' | 'FILLOUT_SUBFORM';
  notes: string | null;
  formKind: FilloutFormKind;
}): Promise<FilloutProcessResult> {
  const cleaned = cleanRut(params.rutRaw);
  if (!cleaned) {
    return {
      ok: true,
      status: 'IGNORED_INVALID',
      formKind: params.formKind,
      submissionId: params.filloutSubmissionId,
      message: 'RUT vacío o inválido en envío de Fillout',
    };
  }

  if (params.filloutSubmissionId) {
    const existing = await prisma.payment.findUnique({
      where: { filloutSubmissionId: params.filloutSubmissionId },
      select: { id: true, participantId: true },
    });
    if (existing) {
      return {
        ok: true,
        status: 'ALREADY_PROCESSED',
        formKind: params.formKind,
        submissionId: params.filloutSubmissionId,
        participantId: existing.participantId,
        paymentId: existing.id,
        message: 'Envío ya procesado previamente (idempotente)',
      };
    }
  }

  const participant = await prisma.participant.findFirst({
    where: {
      eventId: params.eventId,
      OR: [{ rutClean: cleaned }, { rut: params.rutRaw.trim() }],
    },
    select: { id: true },
  });

  if (!participant) {
    return {
      ok: true,
      status: 'PARTICIPANT_NOT_FOUND',
      formKind: params.formKind,
      submissionId: params.filloutSubmissionId,
      message: `Participante con RUT ${cleaned} no encontrado en el evento`,
    };
  }

  const created = await prisma.$transaction(async (tx) => {
    const payment = await tx.payment.create({
      data: {
        participantId: participant.id,
        amount: Math.round(params.amount * 100) / 100,
        paymentDate: params.paymentDate,
        paymentMethod: 'TRANSFERENCIA',
        transactionReference: params.transactionReference,
        receiptUrl: params.receiptUrl,
        filloutSubmissionId: params.filloutSubmissionId,
        source: params.source,
        notes: params.notes,
      },
    });

    const fullParticipant = await tx.participant.findUnique({
      where: { id: participant.id },
      include: {
        plan: { include: { installments: { orderBy: { installmentNumber: 'asc' } } } },
        payments: { orderBy: { paymentDate: 'desc' } },
      },
    });

    if (fullParticipant) {
      const sync = computeSheetSyncFields({
        installments: fullParticipant.plan?.installments || [],
        payments: fullParticipant.payments || [],
        targetFeeUSD: fullParticipant.targetFeeUSD,
        planTotalAmount: fullParticipant.plan?.totalAmount,
        currentStatus: fullParticipant.status,
      });

      await tx.participant.update({
        where: { id: participant.id },
        data: {
          totalPaidSheet: sync.totalPaidSheet,
          debtFinalUSD: sync.debtFinalUSD,
          debtToDateUSD: sync.debtToDateUSD,
          overpaymentUSD: sync.overpaymentUSD,
          financialStatusSheet: sync.financialStatusSheet,
        },
      });
    }

    return payment;
  });

  return {
    ok: true,
    status: 'CREATED',
    formKind: params.formKind,
    submissionId: params.filloutSubmissionId,
    participantId: participant.id,
    paymentId: created.id,
    message: 'Abono Fillout registrado y saldo actualizado',
  };
}

/**
 * Processes a Fillout webhook payload for either the main payment form or the multi-participant subform.
 */
export async function processFilloutWebhook(
  payload: FilloutWebhookPayload,
  options?: { eventCode?: string | null; explicitFormKind?: string | null }
): Promise<FilloutProcessResult> {
  const fieldMap = buildFilloutFieldMap(payload);
  const formKind = detectFilloutFormKind(payload, fieldMap, options?.explicitFormKind);
  const submissionId = payload.submission?.submissionId?.trim() || null;

  const eventId = await resolveEventId(options?.eventCode);
  if (!eventId) {
    throw new Error('No se encontró un evento activo para registrar el pago de Fillout');
  }

  if (formKind === 'subform') {
    const rutRaw = getField(fieldMap, 'RUT Participante', 'rut_participante', 'RUT');
    const amount = parseOptionalFloat(getField(fieldMap, 'Monto asignado USD', 'monto_asignado_usd', 'Monto USD'));
    const comprobante = getField(fieldMap, 'comprobante', 'Número del Comprobante') || null;
    const fechaRaw = getField(fieldMap, 'fecha_pago', 'Fecha del Depósito') || payload.submission?.submissionTime;
    const rutPrincipal = getField(fieldMap, 'rut_principal');
    const grupo = getField(fieldMap, 'grupo');

    if (!amount || amount <= 0) {
      return {
        ok: true,
        status: 'IGNORED_INVALID',
        formKind,
        submissionId,
        message: 'Monto asignado inválido o cero en subformulario Fillout',
      };
    }

    const noteParts = ['Subformulario Fillout'];
    if (rutPrincipal) noteParts.push(`RUT principal: ${rutPrincipal}`);
    if (grupo) noteParts.push(`Grupo: ${grupo}`);

    return recordFilloutPayment({
      eventId,
      rutRaw,
      amount,
      paymentDate: parseOptionalDate(fechaRaw) ?? new Date(),
      transactionReference: comprobante,
      receiptUrl: null,
      filloutSubmissionId: submissionId,
      source: 'FILLOUT_SUBFORM',
      notes: noteParts.join(' • '),
      formKind,
    });
  }

  // Formulario principal (1qPV7xVVsjus)
  const rutRaw = getField(fieldMap, 'RUT');
  const amount = parseOptionalFloat(getField(fieldMap, 'Monto USD', 'monto_usd'));
  const comprobante = getField(fieldMap, 'Número del Comprobante', 'numero_del_comprobante') || null;
  const fechaRaw = getField(fieldMap, 'Fecha del Depósito', 'fecha_del_deposito') || payload.submission?.submissionTime;
  const sucursal = getField(fieldMap, 'Sucursal');
  const comentarios = getField(fieldMap, 'Comentarios Adicionales', 'comentarios_adicionales');
  const receiptUrl = getField(fieldMap, 'Comprobante') || null;
  const multiRaw = getField(fieldMap, 'El comprobante incluye a más personas', 'el_comprobante_incluye_a_mas_personas');
  const isMultiPerson =
    multiRaw.toLowerCase() === 'sí' || multiRaw.toLowerCase() === 'si' || multiRaw.toLowerCase() === 'yes';

  if (isMultiPerson) {
    const opcion = getField(fieldMap, 'Opción de envío del detalle del comprobante');
    const nombres = getField(fieldMap, 'Nombres Participantes del Comprobante');
    const excelUrl = getField(
      fieldMap,
      'Archivo con detalle de los Nombres de los Participantes del Comprobante'
    );

    if (opcion.toLowerCase().includes('excel') || excelUrl) {
      const cleaned = cleanRut(rutRaw);
      const participant = cleaned
        ? await prisma.participant.findFirst({
            where: { eventId, OR: [{ rutClean: cleaned }, { rut: rutRaw.trim() }] },
            select: { id: true },
          })
        : null;

      if (participant) {
        const incident = await createIncidentWithUniqueTicket(eventId, (ticketNumber) =>
          prisma.incident.create({
            data: {
              ticketNumber,
              eventId,
              participantId: participant.id,
              title: `Desglose grupal pendiente • Comprobante ${comprobante || 'S/N'} (${amount ?? 0} USD)`,
              description: [
                `Envío Fillout (${submissionId || 'sin ID'}) marcado con múltiples participantes y archivo Excel.`,
                `Opción: ${opcion || 'N/A'}`,
                nombres ? `Participantes indicados: ${nombres}` : null,
                receiptUrl ? `Comprobante: ${receiptUrl}` : null,
                excelUrl ? `Archivo detalle Excel: ${excelUrl}` : null,
                comentarios ? `Comentarios: ${comentarios}` : null,
              ]
                .filter(Boolean)
                .join('\n'),
              category: 'FINANZAS',
              priority: 'ALTA',
              status: 'ABIERTA',
            },
          })
        );

        return {
          ok: true,
          status: 'EXCEL_INCIDENT_CREATED',
          formKind,
          submissionId,
          participantId: participant.id,
          incidentTicket: incident.ticketNumber,
          message: `Comprobante grupal con Excel derivado a incidencia ${incident.ticketNumber}`,
        };
      }
    }

    return {
      ok: true,
      status: 'DEFERRED_TO_SUBFORM',
      formKind,
      submissionId,
      message: 'Comprobante multipersona diferido al subformulario de desglose',
    };
  }

  if (!amount || amount <= 0) {
    return {
      ok: true,
      status: 'IGNORED_INVALID',
      formKind,
      submissionId,
      message: 'Monto USD inválido o cero en envío principal de Fillout',
    };
  }

  const noteParts = ['Fillout'];
  if (sucursal) noteParts.push(`Sucursal: ${sucursal}`);
  if (comentarios) noteParts.push(comentarios);

  return recordFilloutPayment({
    eventId,
    rutRaw,
    amount,
    paymentDate: parseOptionalDate(fechaRaw) ?? new Date(),
    transactionReference: comprobante,
    receiptUrl,
    filloutSubmissionId: submissionId,
    source: 'FILLOUT_MAIN',
    notes: noteParts.join(' • '),
    formKind,
  });
}
