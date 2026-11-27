import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { cleanRut, formatRut, validateRut } from '@/lib/rut';
import { computeSheetSyncFields } from '@/lib/finance';
import { createIncidentWithUniqueTicket } from '@/lib/incidents';
import type { GroupAllocationInputDTO } from '@/types/domain';

export const MAX_RECEIPT_BYTES = 4 * 1024 * 1024; // 4 MB

export const ALLOWED_RECEIPT_MIMES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
]);

export const ALLOWED_DETAIL_MIMES = new Set([
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'text/csv',
  'text/plain',
  'application/pdf',
]);

const ALLOWED_METHODS = new Set([
  'TRANSFERENCIA',
  'DEPOSITO',
  'TARJETA',
  'EFECTIVO',
  'TRASPASO',
  'DEVOLUCION',
  'OTRO',
]);

export type DirectPaymentSource =
  | 'PORTAL_FORM'
  | 'PORTAL_GROUP_FORM'
  | 'MANUAL'
  | 'MANUAL_GROUP';

export class PaymentValidationError extends Error {
  statusCode: number;
  details?: string[];

  constructor(message: string, statusCode = 400, details?: string[]) {
    super(message);
    this.name = 'PaymentValidationError';
    this.statusCode = statusCode;
    this.details = details;
  }
}

const round2 = (n: number): number => Math.round(n * 100) / 100;

/**
 * Masks participant last names for public confirmation responses (e.g. "Sofía S. V.").
 */
export function maskParticipantName(
  firstName: string,
  lastName: string,
  secondLastName?: string | null
): string {
  const firstToken = firstName.trim().split(/\s+/)[0] || firstName.trim();
  const l1 = lastName.trim()[0];
  const l2 = secondLastName?.trim()[0];
  const parts = [firstToken];
  if (l1) parts.push(`${l1.toUpperCase()}.`);
  if (l2) parts.push(`${l2.toUpperCase()}.`);
  return parts.join(' ');
}

export function isValidHttpsUrl(raw: string): boolean {
  const trimmed = raw.trim();
  if (!trimmed) return false;
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

export function sanitizePaymentMethod(raw?: string | null): string {
  const normalized = (raw || 'TRANSFERENCIA').trim().toUpperCase();
  if (ALLOWED_METHODS.has(normalized)) return normalized;
  return 'TRANSFERENCIA';
}

export function validatePaymentDateNotFuture(date: Date): void {
  const maxAllowedMs = Date.now() + 36 * 60 * 60 * 1000; // tolerance for TZ
  if (date.getTime() > maxAllowedMs) {
    throw new PaymentValidationError(
      'La fecha del depósito no puede ser futura',
      400
    );
  }
}

function inferMimeType(file: File, kind: 'receipt' | 'detail'): string {
  const rawType = (file.type || '').toLowerCase().trim();
  const ext = file.name.split('.').pop()?.toLowerCase() || '';

  if (kind === 'receipt') {
    if (ALLOWED_RECEIPT_MIMES.has(rawType)) return rawType;
    if (rawType === 'image/jpg') return 'image/jpeg';
    if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg';
    if (ext === 'png') return 'image/png';
    if (ext === 'webp') return 'image/webp';
    if (ext === 'pdf') return 'application/pdf';
    return rawType || 'application/octet-stream';
  }

  if (ALLOWED_DETAIL_MIMES.has(rawType)) return rawType;
  if (ext === 'xlsx') {
    return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  }
  if (ext === 'xls') return 'application/vnd.ms-excel';
  if (ext === 'csv') return 'text/csv';
  if (ext === 'txt') return 'text/plain';
  if (ext === 'pdf') return 'application/pdf';
  return rawType || 'application/octet-stream';
}

type DbClientLike = Prisma.TransactionClient | typeof prisma;

/**
 * Validates size & MIME type of an uploaded file and persists it in PaymentReceipt.
 */
export async function validateAndStoreFile(
  db: DbClientLike,
  eventId: string,
  file: File,
  kind: 'receipt' | 'detail'
): Promise<{ id: string; url: string; fileName: string; mimeType: string; sizeBytes: number }> {
  if (!file || file.size <= 0) {
    throw new PaymentValidationError('El archivo adjunto está vacío', 400);
  }
  if (file.size > MAX_RECEIPT_BYTES) {
    throw new PaymentValidationError(
      `El archivo "${file.name}" supera el límite de 4 MB permitido`,
      400
    );
  }

  const mimeType = inferMimeType(file, kind);
  const allowedSet =
    kind === 'receipt' ? ALLOWED_RECEIPT_MIMES : ALLOWED_DETAIL_MIMES;

  if (!allowedSet.has(mimeType)) {
    throw new PaymentValidationError(
      kind === 'receipt'
        ? 'Formato de comprobante no soportado. Usa JPG, PNG, WebP o PDF.'
        : 'Formato de detalle no soportado. Usa Excel (.xlsx/.xls), CSV, TXT o PDF.',
      400
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const cleanFileName = (file.name || `${kind}.bin`)
    .replace(/[\r\n"\\/]/g, '_')
    .slice(0, 180);

  const receipt = await db.paymentReceipt.create({
    data: {
      eventId,
      fileName: cleanFileName,
      mimeType,
      sizeBytes: file.size,
      content: buffer,
    },
    select: {
      id: true,
      fileName: true,
      mimeType: true,
      sizeBytes: true,
    },
  });

  return {
    id: receipt.id,
    url: `/api/receipts/${receipt.id}`,
    fileName: receipt.fileName,
    mimeType: receipt.mimeType,
    sizeBytes: receipt.sizeBytes,
  };
}

/**
 * Recalculates cached financial summary columns for a participant after new payments.
 */
export async function recalculateParticipantSync(
  tx: Prisma.TransactionClient,
  participantId: string
): Promise<void> {
  const fullParticipant = await tx.participant.findUnique({
    where: { id: participantId },
    include: {
      plan: {
        include: {
          installments: { orderBy: { installmentNumber: 'asc' } },
        },
      },
      payments: {
        orderBy: { paymentDate: 'desc' },
      },
    },
  });

  if (!fullParticipant) return;

  const sync = computeSheetSyncFields({
    installments: fullParticipant.plan?.installments || [],
    payments: fullParticipant.payments || [],
    targetFeeUSD: fullParticipant.targetFeeUSD,
    planTotalAmount: fullParticipant.plan?.totalAmount,
    currentStatus: fullParticipant.status,
  });

  await tx.participant.update({
    where: { id: participantId },
    data: {
      totalPaidSheet: sync.totalPaidSheet,
      debtFinalUSD: sync.debtFinalUSD,
      debtToDateUSD: sync.debtToDateUSD,
      overpaymentUSD: sync.overpaymentUSD,
      financialStatusSheet: sync.financialStatusSheet,
    },
  });
}

/**
 * Prevents accidental duplicate payment submissions for the same participant, reference, amount & date window.
 */
export async function checkDuplicatePayment(
  tx: Prisma.TransactionClient,
  participantId: string,
  transactionReference: string | null,
  amount: number,
  paymentDate: Date
): Promise<void> {
  if (!transactionReference || !transactionReference.trim()) return;

  const ref = transactionReference.trim();
  const minDate = new Date(paymentDate.getTime() - 2 * 24 * 60 * 60 * 1000);
  const maxDate = new Date(paymentDate.getTime() + 2 * 24 * 60 * 60 * 1000);

  const duplicate = await tx.payment.findFirst({
    where: {
      participantId,
      transactionReference: { equals: ref, mode: 'insensitive' },
      amount: { gte: round2(amount - 0.01), lte: round2(amount + 0.01) },
      paymentDate: { gte: minDate, lte: maxDate },
    },
    select: { id: true },
  });

  if (duplicate) {
    throw new PaymentValidationError(
      `Ya existe un pago registrado con el comprobante "${ref}" por el mismo monto (${amount}) en fechas cercanas.`,
      409
    );
  }
}

export interface DirectPaymentRecordItem {
  paymentId: string;
  participantId: string;
  rut: string;
  maskedName: string;
  fullName: string;
  amount: number;
}

export interface RecordDirectPaymentsParams {
  eventId: string;
  mode: 'INDIVIDUAL' | 'GROUP_SPLIT';
  payerRut?: string | null;
  participantId?: string | null;
  amount: number;
  paymentDate: Date;
  paymentMethod?: string | null;
  transactionReference?: string | null;
  receiptFile?: File | null;
  receiptUrl?: string | null;
  branch?: string | null;
  comments?: string | null;
  source: DirectPaymentSource;
  registeredById?: string | null;
  allocations?: GroupAllocationInputDTO[];
}

export interface RecordDirectPaymentsResult {
  createdCount: number;
  totalAmount: number;
  receiptUrl: string | null;
  receiptFileName: string | null;
  items: DirectPaymentRecordItem[];
}

/**
 * Validates and atomically persists individual or multi-participant group payments,
 * storing the shared receipt once and recalculating every affected participant's balance.
 */
export async function recordDirectPayments(
  params: RecordDirectPaymentsParams
): Promise<RecordDirectPaymentsResult> {
  const totalAmount = round2(params.amount);
  if (!Number.isFinite(totalAmount) || totalAmount <= 0) {
    throw new PaymentValidationError('El monto total del pago debe ser mayor a 0', 400);
  }

  validatePaymentDateNotFuture(params.paymentDate);

  const paymentMethod = sanitizePaymentMethod(params.paymentMethod);
  const transactionReference = params.transactionReference?.trim() || null;

  const externalReceiptUrl = params.receiptUrl?.trim() || null;
  if (externalReceiptUrl && !isValidHttpsUrl(externalReceiptUrl)) {
    throw new PaymentValidationError(
      'El enlace externo del comprobante debe iniciar con http:// o https://',
      400
    );
  }

  const branch = params.branch?.trim() || '';
  const comments = params.comments?.trim() || '';

  const baseNoteTags: string[] = [];
  if (params.source === 'PORTAL_FORM') baseNoteTags.push('Portal Web');
  else if (params.source === 'PORTAL_GROUP_FORM') baseNoteTags.push('Portal Web Grupal');
  else if (params.source === 'MANUAL_GROUP') baseNoteTags.push('Ingreso Grupal Tesorería');
  if (branch) baseNoteTags.push(`Sucursal/Banco: ${branch}`);
  if (comments) baseNoteTags.push(comments);

  const payerCleaned = params.payerRut ? cleanRut(params.payerRut) : '';
  const payerFormatted = payerCleaned ? formatRut(payerCleaned) : '';

  if (params.mode === 'INDIVIDUAL') {
    const participant = params.participantId
      ? await prisma.participant.findFirst({
          where: { id: params.participantId, eventId: params.eventId },
          select: {
            id: true,
            rut: true,
            firstName: true,
            lastName: true,
            secondLastName: true,
          },
        })
      : payerCleaned
        ? await prisma.participant.findFirst({
            where: {
              eventId: params.eventId,
              OR: [{ rutClean: payerCleaned }, { rut: payerFormatted }, { rut: params.payerRut?.trim() || '' }],
            },
            select: {
              id: true,
              rut: true,
              firstName: true,
              lastName: true,
              secondLastName: true,
            },
          })
        : null;

    if (!participant) {
      throw new PaymentValidationError(
        `No se encontró un participante inscrito en el evento con el RUT ${payerFormatted || params.payerRut || ''}`,
        404
      );
    }

    const notes = baseNoteTags.length > 0 ? baseNoteTags.join(' • ') : null;

    const txResult = await prisma.$transaction(async (tx) => {
      let storedReceipt: { url: string; fileName: string } | null = null;
      if (params.receiptFile && params.receiptFile.size > 0) {
        storedReceipt = await validateAndStoreFile(
          tx,
          params.eventId,
          params.receiptFile,
          'receipt'
        );
      }

      const finalReceiptUrl = storedReceipt?.url || externalReceiptUrl;

      await checkDuplicatePayment(
        tx,
        participant.id,
        transactionReference,
        totalAmount,
        params.paymentDate
      );

      const created = await tx.payment.create({
        data: {
          participantId: participant.id,
          amount: totalAmount,
          paymentDate: params.paymentDate,
          paymentMethod,
          transactionReference,
          receiptUrl: finalReceiptUrl,
          source: params.source,
          notes,
          registeredById: params.registeredById ?? null,
        },
        select: { id: true },
      });

      await recalculateParticipantSync(tx, participant.id);

      return {
        receiptUrl: finalReceiptUrl,
        receiptFileName: storedReceipt?.fileName || null,
        paymentId: created.id,
      };
    });

    return {
      createdCount: 1,
      totalAmount,
      receiptUrl: txResult.receiptUrl,
      receiptFileName: txResult.receiptFileName,
      items: [
        {
          paymentId: txResult.paymentId,
          participantId: participant.id,
          rut: participant.rut,
          maskedName: maskParticipantName(
            participant.firstName,
            participant.lastName,
            participant.secondLastName
          ),
          fullName: `${participant.firstName} ${participant.lastName}`.trim(),
          amount: totalAmount,
        },
      ],
    };
  }

  // GROUP_SPLIT mode
  const allocations = params.allocations || [];
  if (allocations.length < 2) {
    throw new PaymentValidationError(
      'El desglose grupal requiere al menos 2 participantes asignados',
      400
    );
  }
  if (allocations.length > 100) {
    throw new PaymentValidationError(
      'El desglose grupal admite un máximo de 100 participantes por envío. Para grupos mayores usa la opción de Excel.',
      400
    );
  }

  const normalizedRows: Array<{
    index: number;
    participantId?: string;
    rutRaw: string;
    rutClean: string;
    rutFormatted: string;
    amount: number;
    groupName: string;
  }> = [];
  const seenKeys = new Set<string>();
  const rowErrors: string[] = [];
  let sumAllocations = 0;

  allocations.forEach((alloc, idx) => {
    const rowAmount = round2(Number(alloc.amount));
    if (!Number.isFinite(rowAmount) || rowAmount <= 0) {
      rowErrors.push(`Fila ${idx + 1}: el monto asignado debe ser mayor a 0.`);
    } else {
      sumAllocations += rowAmount;
    }

    const rClean = cleanRut(alloc.rut || '');
    const rFormatted = rClean ? formatRut(rClean) : '';
    const dedupeKey = alloc.participantId
      ? `id:${alloc.participantId}`
      : `rut:${rClean}`;

    if (!alloc.participantId && (!rClean || !validateRut(rClean))) {
      rowErrors.push(`Fila ${idx + 1}: el RUT "${alloc.rut || '(vacío)'}" no es válido.`);
    } else if (seenKeys.has(dedupeKey)) {
      rowErrors.push(
        `Fila ${idx + 1}: el participante ${rFormatted || alloc.rut} está repetido en el desglose.`
      );
    } else {
      seenKeys.add(dedupeKey);
    }

    normalizedRows.push({
      index: idx,
      participantId: alloc.participantId,
      rutRaw: alloc.rut || '',
      rutClean: rClean,
      rutFormatted: rFormatted,
      amount: rowAmount,
      groupName: alloc.groupName?.trim() || '',
    });
  });

  if (rowErrors.length > 0) {
    throw new PaymentValidationError(
      'Hay errores en el desglose de participantes',
      400,
      rowErrors
    );
  }

  if (Math.abs(round2(sumAllocations) - totalAmount) > 0.01) {
    throw new PaymentValidationError(
      `La suma del desglose (${round2(sumAllocations)}) no coincide con el monto total del comprobante (${totalAmount})`,
      400
    );
  }

  // Lookup all participants in the event in one batch
  const requestedIds = normalizedRows
    .map((r) => r.participantId)
    .filter((id): id is string => Boolean(id));
  const requestedRuts = normalizedRows.map((r) => r.rutClean).filter(Boolean);

  const matchedParticipants = await prisma.participant.findMany({
    where: {
      eventId: params.eventId,
      OR: [
        ...(requestedIds.length > 0 ? [{ id: { in: requestedIds } }] : []),
        ...(requestedRuts.length > 0 ? [{ rutClean: { in: requestedRuts } }] : []),
      ],
    },
    select: {
      id: true,
      rut: true,
      rutClean: true,
      firstName: true,
      lastName: true,
      secondLastName: true,
    },
  });

  const byId = new Map(matchedParticipants.map((p) => [p.id, p]));
  const byRutClean = new Map(
    matchedParticipants.map((p) => [p.rutClean || cleanRut(p.rut), p])
  );

  const missingDetails: string[] = [];
  const resolvedRows = normalizedRows.map((row) => {
    const found =
      (row.participantId ? byId.get(row.participantId) : undefined) ||
      byRutClean.get(row.rutClean);
    if (!found) {
      missingDetails.push(
        `Fila ${row.index + 1}: el RUT ${row.rutFormatted || row.rutRaw} no está inscrito en este evento.`
      );
    }
    return { row, participant: found };
  });

  if (missingDetails.length > 0) {
    throw new PaymentValidationError(
      'Algunos participantes del desglose no pertenecen al evento activo',
      400,
      missingDetails
    );
  }

  const txResult = await prisma.$transaction(async (tx) => {
    let storedReceipt: { url: string; fileName: string } | null = null;
    if (params.receiptFile && params.receiptFile.size > 0) {
      storedReceipt = await validateAndStoreFile(
        tx,
        params.eventId,
        params.receiptFile,
        'receipt'
      );
    }

    const finalReceiptUrl = storedReceipt?.url || externalReceiptUrl;
    const createdItems: DirectPaymentRecordItem[] = [];

    for (const entry of resolvedRows) {
      const p = entry.participant!;
      await checkDuplicatePayment(
        tx,
        p.id,
        transactionReference,
        entry.row.amount,
        params.paymentDate
      );

      const perRowNotes = [...baseNoteTags];
      if (payerFormatted && payerCleaned !== (p.rutClean || cleanRut(p.rut))) {
        perRowNotes.push(`Titular depósito: ${payerFormatted}`);
      }
      if (entry.row.groupName) {
        perRowNotes.push(`Grupo: ${entry.row.groupName}`);
      }

      const created = await tx.payment.create({
        data: {
          participantId: p.id,
          amount: entry.row.amount,
          paymentDate: params.paymentDate,
          paymentMethod,
          transactionReference,
          receiptUrl: finalReceiptUrl,
          source: params.source,
          notes: perRowNotes.length > 0 ? perRowNotes.join(' • ') : null,
          registeredById: params.registeredById ?? null,
        },
        select: { id: true },
      });

      await recalculateParticipantSync(tx, p.id);

      createdItems.push({
        paymentId: created.id,
        participantId: p.id,
        rut: p.rut,
        maskedName: maskParticipantName(
          p.firstName,
          p.lastName,
          p.secondLastName
        ),
        fullName: `${p.firstName} ${p.lastName}`.trim(),
        amount: entry.row.amount,
      });
    }

    return {
      receiptUrl: finalReceiptUrl,
      receiptFileName: storedReceipt?.fileName || null,
      items: createdItems,
    };
  });

  return {
    createdCount: txResult.items.length,
    totalAmount,
    receiptUrl: txResult.receiptUrl,
    receiptFileName: txResult.receiptFileName,
    items: txResult.items,
  };
}

export interface CreateGroupExcelIncidentParams {
  eventId: string;
  payerRut: string;
  amount: number;
  paymentDate: Date;
  paymentMethod?: string | null;
  transactionReference: string;
  receiptFile?: File | null;
  receiptUrl?: string | null;
  detailFile?: File | null;
  detailNames?: string | null;
  branch?: string | null;
  comments?: string | null;
}

export async function createGroupDetailIncident(
  params: CreateGroupExcelIncidentParams
): Promise<{
  ticketNumber: string;
  participantId: string;
  maskedName: string;
  receiptUrl: string | null;
  detailUrl: string | null;
}> {
  const totalAmount = round2(params.amount);
  if (!Number.isFinite(totalAmount) || totalAmount <= 0) {
    throw new PaymentValidationError('El monto total del depósito debe ser mayor a 0', 400);
  }
  validatePaymentDateNotFuture(params.paymentDate);

  const payerCleaned = cleanRut(params.payerRut);
  const payerFormatted = formatRut(payerCleaned);
  if (!payerCleaned || !validateRut(payerCleaned)) {
    throw new PaymentValidationError('El RUT del titular informado no es válido', 400);
  }

  const participant = await prisma.participant.findFirst({
    where: {
      eventId: params.eventId,
      OR: [{ rutClean: payerCleaned }, { rut: payerFormatted }],
    },
    select: {
      id: true,
      rut: true,
      firstName: true,
      lastName: true,
      secondLastName: true,
    },
  });

  if (!participant) {
    throw new PaymentValidationError(
      `No se encontró un participante inscrito en el evento con el RUT ${payerFormatted}`,
      404
    );
  }

  const detailNames = params.detailNames?.trim() || '';
  if (!detailNames && (!params.detailFile || params.detailFile.size <= 0)) {
    throw new PaymentValidationError(
      'Debes adjuntar un archivo con el detalle grupal (Excel/CSV/PDF) o escribir la nómina de participantes y montos.',
      400
    );
  }

  const externalReceiptUrl = params.receiptUrl?.trim() || null;
  if (externalReceiptUrl && !isValidHttpsUrl(externalReceiptUrl)) {
    throw new PaymentValidationError(
      'El enlace externo del comprobante debe iniciar con http:// o https://',
      400
    );
  }

  const storedReceipt =
    params.receiptFile && params.receiptFile.size > 0
      ? await validateAndStoreFile(prisma, params.eventId, params.receiptFile, 'receipt')
      : null;

  const storedDetail =
    params.detailFile && params.detailFile.size > 0
      ? await validateAndStoreFile(prisma, params.eventId, params.detailFile, 'detail')
      : null;

  const finalReceiptUrl = storedReceipt?.url || externalReceiptUrl;
  const dateLabel = params.paymentDate.toISOString().split('T')[0];

  const descriptionLines = [
    `Solicitud ingresada desde Portal Web de Pagos (modalidad nómina grupal / archivo).`,
    `Titular que informa: ${participant.firstName} ${participant.lastName} (${participant.rut})`,
    `N° de comprobante: ${params.transactionReference.trim()}`,
    `Monto total depósito: ${totalAmount}`,
    `Fecha depósito: ${dateLabel}`,
    `Método: ${sanitizePaymentMethod(params.paymentMethod)}`,
    params.branch?.trim() ? `Sucursal/Banco: ${params.branch.trim()}` : null,
    finalReceiptUrl ? `Comprobante bancario: ${finalReceiptUrl}` : null,
    storedDetail ? `Archivo de desglose (${storedDetail.fileName}): ${storedDetail.url}` : null,
    detailNames ? `Detalle / Participantes indicados:\n${detailNames}` : null,
    params.comments?.trim() ? `Comentarios: ${params.comments.trim()}` : null,
  ].filter(Boolean);

  const incident = await createIncidentWithUniqueTicket(
    params.eventId,
    (ticketNumber) =>
      prisma.incident.create({
        data: {
          ticketNumber,
          eventId: params.eventId,
          participantId: participant.id,
          title: `Desglose grupal portal web • Doc. ${params.transactionReference.trim()} (${totalAmount})`,
          description: descriptionLines.join('\n'),
          category: 'FINANZAS',
          priority: 'ALTA',
          status: 'ABIERTA',
        },
        select: { ticketNumber: true },
      })
  );

  return {
    ticketNumber: incident.ticketNumber,
    participantId: participant.id,
    maskedName: maskParticipantName(
      participant.firstName,
      participant.lastName,
      participant.secondLastName
    ),
    receiptUrl: finalReceiptUrl,
    detailUrl: storedDetail?.url || null,
  };
}
