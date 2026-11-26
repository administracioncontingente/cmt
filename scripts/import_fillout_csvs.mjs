import { PrismaClient } from '@prisma/client';
import fs from 'fs';

const prisma = new PrismaClient();

const DEFAULT_MAIN_CSV =
  '/home/saul/Descargas/Fillout Comprobantes de pago de cuota WSJ 2027 results.csv';
const DEFAULT_SUBFORM_CSV =
  '/home/saul/Descargas/Fillout Nombres incluidos en más de un pago WSJ2027 results.csv';

const HISTORICAL_CUTOFF = new Date('2026-09-29T23:59:59Z');

function parseCsvRFC4180(text) {
  const rows = [];
  let row = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        current += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        current += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(current);
      current = '';
    } else if (ch === '\r' && next === '\n') {
      row.push(current);
      rows.push(row);
      row = [];
      current = '';
      i++;
    } else if (ch === '\n') {
      row.push(current);
      rows.push(row);
      row = [];
      current = '';
    } else {
      current += ch;
    }
  }

  if (current.length > 0 || row.length > 0) {
    row.push(current);
    rows.push(row);
  }

  if (rows.length === 0) return [];
  const headers = rows[0].map((h) => h.replace(/^\uFEFF/, '').trim());
  const objects = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (r.length === 1 && r[0].trim() === '') continue;
    const obj = {};
    for (let j = 0; j < headers.length; j++) {
      obj[headers[j]] = r[j] ?? '';
    }
    objects.push(obj);
  }
  return objects;
}

function cleanRut(rut) {
  if (!rut) return '';
  return String(rut).replace(/[^0-9kK]/g, '').toUpperCase();
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

function parseAmount(val) {
  if (val === undefined || val === null) return 0;
  let s = String(val).replace(/\$/g, '').replace(/\s/g, '').trim();
  if (!s) return 0;
  if (s.includes(',') && s.includes('.')) {
    if (s.lastIndexOf(',') > s.lastIndexOf('.')) s = s.replace(/\./g, '').replace(',', '.');
    else s = s.replace(/,/g, '');
  } else if (s.includes(',')) {
    const parts = s.split(',');
    if (parts.length === 2 && parts[1].length <= 2) s = s.replace(',', '.');
    else s = s.replace(/,/g, '');
  }
  const n = parseFloat(s);
  return Number.isFinite(n) ? round2(n) : 0;
}

function parseIsoOrChileanDate(str) {
  if (!str) return null;
  const s = String(str).trim();
  const ymd = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (ymd) {
    return new Date(Date.UTC(Number(ymd[1]), Number(ymd[2]) - 1, Number(ymd[3]), 12, 0, 0));
  }
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

function computeParticipantSync(installments, payments, targetFeeUSD, planTotalAmount, status) {
  const target =
    targetFeeUSD !== null && targetFeeUSD !== undefined ? targetFeeUSD : (planTotalAmount ?? 3600);
  const totalPaid = round2(payments.reduce((acc, p) => acc + p.amount, 0));
  const balanceRemaining = round2(Math.max(0, target - totalPaid));
  const isFullyPaid = target === 0 ? true : totalPaid >= target;

  const now = Date.now();
  let dueToDate = 0;
  for (const inst of installments) {
    if (new Date(inst.dueDate).getTime() < now) {
      dueToDate += inst.amount;
    }
  }
  dueToDate = target === 0 ? 0 : round2(dueToDate);
  const overdueAmount = target === 0 ? 0 : round2(Math.max(0, dueToDate - totalPaid));

  let financialStatusSheet = 'Al Día';
  if (status === 'RETIRADO') financialStatusSheet = 'BAJA';
  else if (isFullyPaid) financialStatusSheet = 'Total Pagado';
  else if (overdueAmount > 0) financialStatusSheet = 'Adeuda';

  return {
    totalPaidSheet: totalPaid,
    debtFinalUSD: balanceRemaining,
    debtToDateUSD: overdueAmount,
    overpaymentUSD: round2(Math.max(0, totalPaid - target)),
    financialStatusSheet,
  };
}

async function main() {
  const mainCsvPath = process.argv[2] || DEFAULT_MAIN_CSV;
  const subformCsvPath = process.argv[3] || DEFAULT_SUBFORM_CSV;

  const event =
    (await prisma.event.findUnique({ where: { code: 'WSJ-2027' } })) ||
    (await prisma.event.findFirst({ where: { isDefault: true } }));

  if (!event) throw new Error('No se encontró el evento WSJ-2027.');

  const participants = await prisma.participant.findMany({
    where: { eventId: event.id },
    include: {
      plan: { include: { installments: { orderBy: { installmentNumber: 'asc' } } } },
      payments: true,
    },
  });

  const participantByRut = new Map();
  const existingSubmissionIds = new Set();
  for (const p of participants) {
    participantByRut.set(p.rutClean || cleanRut(p.rut), p);
    for (const pay of p.payments) {
      if (pay.filloutSubmissionId) existingSubmissionIds.add(pay.filloutSubmissionId);
    }
  }

  const mainRows = parseCsvRFC4180(fs.readFileSync(mainCsvPath, 'utf-8'));
  const subRows = parseCsvRFC4180(fs.readFileSync(subformCsvPath, 'utf-8'));
  console.log(`Fillout Principal: ${mainRows.length} filas | Subformulario: ${subRows.length} filas`);

  const candidates = [];

  for (const r of mainRows) {
    const multi = (r['El comprobante incluye a más personas'] || '').trim().toLowerCase();
    if (multi === 'sí' || multi === 'si') continue;

    const amount = parseAmount(r['Monto USD']);
    if (amount <= 0) continue;

    const paymentDate =
      parseIsoOrChileanDate(r['Fecha del Depósito']) ||
      parseIsoOrChileanDate(r['Last updated']) ||
      new Date();

    const sucursal = (r['Sucursal'] || '').trim();
    const comentarios = (r['Comentarios Adicionales'] || '').trim();
    const noteParts = ['Fillout'];
    if (sucursal) noteParts.push(`Sucursal: ${sucursal}`);
    if (comentarios) noteParts.push(comentarios);

    candidates.push({
      submissionId: (r['Submission ID'] || '').trim() || null,
      rutClean: cleanRut(r['RUT']),
      amount,
      paymentDate,
      transactionReference: (r['Número del Comprobante'] || '').trim() || null,
      receiptUrl: (r['Comprobante'] || '').trim() || null,
      source: 'FILLOUT_MAIN',
      notes: noteParts.join(' • '),
    });
  }

  for (const r of subRows) {
    const amount = parseAmount(r['Monto asignado USD']);
    if (amount <= 0) continue;

    const paymentDate =
      parseIsoOrChileanDate(r['fecha_pago']) ||
      parseIsoOrChileanDate(r['Last updated']) ||
      new Date();

    const rutPrincipal = (r['rut_principal'] || '').trim();
    const grupo = (r['grupo'] || '').trim();
    const noteParts = ['Subformulario Fillout'];
    if (rutPrincipal) noteParts.push(`RUT principal: ${rutPrincipal}`);
    if (grupo) noteParts.push(`Grupo: ${grupo}`);

    candidates.push({
      submissionId: (r['Submission ID'] || '').trim() || null,
      rutClean: cleanRut(r['RUT Participante']),
      amount,
      paymentDate,
      transactionReference: (r['comprobante'] || '').trim() || null,
      receiptUrl: null,
      source: 'FILLOUT_SUBFORM',
      notes: noteParts.join(' • '),
    });
  }

  let skippedBySubId = 0;
  let dedupedHistorical = 0;
  let unmatchedRut = 0;
  const toInsert = [];
  const receiptBackfills = [];
  const affectedParticipantIds = new Set();

  for (const c of candidates) {
    if (c.submissionId && existingSubmissionIds.has(c.submissionId)) {
      skippedBySubId++;
      continue;
    }

    const p = participantByRut.get(c.rutClean);
    if (!p) {
      unmatchedRut++;
      continue;
    }

    // Evitar duplicar pagos históricos ya cargados desde detalle_cuotas.csv (<= 2026-09-29)
    if (c.paymentDate.getTime() <= HISTORICAL_CUTOFF.getTime()) {
      const existingMatch = p.payments.find((pay) => {
        if (Math.abs(pay.amount - c.amount) > 0.05) return false;
        if (
          c.transactionReference &&
          pay.transactionReference &&
          pay.transactionReference.trim() === c.transactionReference
        ) {
          return true;
        }
        const dayDiff = Math.abs(new Date(pay.paymentDate).getTime() - c.paymentDate.getTime()) / 86400000;
        return dayDiff <= 3;
      });

      if (existingMatch) {
        dedupedHistorical++;
        if (c.receiptUrl && !existingMatch.receiptUrl) {
          receiptBackfills.push({ id: existingMatch.id, receiptUrl: c.receiptUrl });
          existingMatch.receiptUrl = c.receiptUrl;
        }
        continue;
      }
    }

    if (c.submissionId) existingSubmissionIds.add(c.submissionId);
    const newRow = {
      participantId: p.id,
      amount: c.amount,
      paymentDate: c.paymentDate,
      paymentMethod: 'TRANSFERENCIA',
      transactionReference: c.transactionReference,
      receiptUrl: c.receiptUrl,
      filloutSubmissionId: c.submissionId,
      source: c.source,
      notes: c.notes,
    };
    toInsert.push(newRow);
    p.payments.push(newRow);
    affectedParticipantIds.add(p.id);
  }

  console.log({
    totalCandidates: candidates.length,
    skippedBySubId,
    dedupedHistorical,
    unmatchedRut,
    newPaymentsToInsert: toInsert.length,
    receiptBackfills: receiptBackfills.length,
  });

  if (toInsert.length > 0) {
    await prisma.payment.createMany({ data: toInsert });
  }

  for (let i = 0; i < receiptBackfills.length; i += 25) {
    const chunk = receiptBackfills.slice(i, i + 25);
    await Promise.all(
      chunk.map((item) =>
        prisma.payment.update({
          where: { id: item.id },
          data: { receiptUrl: item.receiptUrl },
        })
      )
    );
  }

  for (const pId of affectedParticipantIds) {
    const p = participants.find((item) => item.id === pId);
    if (!p) continue;
    const sync = computeParticipantSync(
      p.plan?.installments || [],
      p.payments,
      p.targetFeeUSD,
      p.plan?.totalAmount,
      p.status
    );
    await prisma.participant.update({
      where: { id: pId },
      data: sync,
    });
  }

  console.log(
    `Sincronización CSV Fillout finalizada: ${toInsert.length} abonos nuevos, ${receiptBackfills.length} comprobantes enlazados, ${affectedParticipantIds.size} participantes recalculados.`
  );
}

main()
  .catch((err) => {
    console.error('Error importando CSV Fillout:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
