import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

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

function safeStr(val) {
  if (val === undefined || val === null) return '';
  return String(val).trim();
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

function parseChileanNumber(val) {
  if (val === undefined || val === null) return 0;
  let s = String(val).replace(/\$/g, '').replace(/\s/g, '').trim();
  if (!s) return 0;

  if (s.includes(',') && s.includes('.')) {
    if (s.lastIndexOf(',') > s.lastIndexOf('.')) {
      s = s.replace(/\./g, '').replace(',', '.');
    } else {
      s = s.replace(/,/g, '');
    }
  } else if (s.includes(',')) {
    const parts = s.split(',');
    if (parts.length === 2 && parts[1].length <= 2) {
      s = s.replace(',', '.');
    } else {
      s = s.replace(/,/g, '');
    }
  }

  const parsed = parseFloat(s);
  return Number.isFinite(parsed) ? round2(parsed) : 0;
}

function parseChileanDate(str) {
  if (!str) return null;
  const s = String(str).trim();
  const datePart = s.split(' ')[0];
  const ddmmyyyy = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(datePart);
  if (ddmmyyyy) {
    const day = parseInt(ddmmyyyy[1], 10);
    const month = parseInt(ddmmyyyy[2], 10);
    const year = parseInt(ddmmyyyy[3], 10);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      const d = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
      if (!Number.isNaN(d.getTime())) return d;
    }
  }
  const fallback = new Date(s);
  return Number.isNaN(fallback.getTime()) ? null : fallback;
}

async function main() {
  console.log('Iniciando saneamiento financiero no destructivo desde CSVs oficiales...');

  const event =
    (await prisma.event.findUnique({ where: { code: 'WSJ-2027' } })) ||
    (await prisma.event.findFirst({ where: { isDefault: true } }));

  if (!event) {
    throw new Error('No se encontró el evento WSJ-2027 ni evento por defecto.');
  }

  const participants = await prisma.participant.findMany({
    where: { eventId: event.id },
    select: { id: true, rut: true, rutClean: true },
  });

  if (participants.length === 0) {
    throw new Error(`No hay participantes en el evento ${event.code}.`);
  }

  const participantIds = participants.map((p) => p.id);
  const participantByCleanRut = new Map();
  for (const p of participants) {
    participantByCleanRut.set(p.rutClean || cleanRut(p.rut), p);
  }

  // Guardia de seguridad: abortar si existen abonos manuales recientes
  const manualCutoff = new Date('2026-11-20T00:00:00Z');
  const recentPaymentsCount = await prisma.payment.count({
    where: {
      participantId: { in: participantIds },
      createdAt: { gt: manualCutoff },
    },
  });

  if (recentPaymentsCount > 0) {
    throw new Error(
      `ABORTADO: Se detectaron ${recentPaymentsCount} abonos creados después de 2026-11-20T00:00:00Z. Respalda o preserva esos abonos antes de continuar.`
    );
  }

  const adminUser = await prisma.user.findFirst({
    where: { role: { in: ['SUPER_ADMIN', 'ADMIN'] } },
    orderBy: { createdAt: 'asc' },
    select: { id: true },
  });

  const formCsvPath = path.resolve(process.cwd(), 'data/respuestas_formulario_1.csv');
  const cuotasCsvPath = path.resolve(process.cwd(), 'data/detalle_cuotas.csv');

  const formRows = parseCsvRFC4180(fs.readFileSync(formCsvPath, 'utf-8'));
  const cuotaRows = parseCsvRFC4180(fs.readFileSync(cuotasCsvPath, 'utf-8'));

  console.log(`CSV formulario: ${formRows.length} filas | CSV cuotas: ${cuotaRows.length} filas`);

  // 1. Preparar actualizaciones de los 7 campos de planilla por participante
  const updates = [];
  for (const row of formRows) {
    const cleaned = cleanRut(row['RUT'] || row['RUT_SGUION']);
    if (!cleaned) continue;
    const p = participantByCleanRut.get(cleaned);
    if (!p) continue;

    const cuotaAlDia = safeStr(row['CUOTA AL DIA']) || null;
    updates.push({
      id: p.id,
      data: {
        totalPaidSheet: parseChileanNumber(row['CUOTA PAGADA']),
        targetFeeUSD: parseChileanNumber(row['CUOTA FINAL']),
        dueToDateUSD: parseChileanNumber(row['CUOTA A FECHA']),
        debtFinalUSD: parseChileanNumber(row['DEUDA FINAL']),
        debtToDateUSD: parseChileanNumber(row['DEUDA A FECHA']),
        overpaymentUSD: parseChileanNumber(row['SOBREPAGO CUOTA']),
        financialStatusSheet: cuotaAlDia,
      },
    });
  }

  console.log(`Actualizando ${updates.length} participantes en ${event.code}...`);
  const UPDATE_CHUNK = 25;
  for (let i = 0; i < updates.length; i += UPDATE_CHUNK) {
    const chunk = updates.slice(i, i + UPDATE_CHUNK);
    await Promise.all(
      chunk.map((item) =>
        prisma.participant.update({
          where: { id: item.id },
          data: item.data,
        })
      )
    );
  }
  console.log('Campos financieros de participantes saneados.');

  // 2. Preparar los 6.292 movimientos (incluidos traspasos/devoluciones negativos)
  const paymentData = [];
  let negativeCount = 0;

  for (const row of cuotaRows) {
    const cleaned = cleanRut(row['RUT']);
    const p = participantByCleanRut.get(cleaned);
    if (!p) continue;

    const amount = parseChileanNumber(row['Monto']);
    if (amount === 0) continue;
    if (amount < 0) negativeCount++;

    const doc = safeStr(row['Documento']);
    const docUpper = doc.toUpperCase();
    let paymentMethod = 'TRANSFERENCIA';
    if (docUpper.includes('TRASPASO')) {
      paymentMethod = 'TRASPASO';
    } else if (docUpper.includes('DEVOLUCION') || amount < 0) {
      paymentMethod = 'DEVOLUCION';
    }

    const distritoGrupo = safeStr(row['Distrito-Grupo']);
    paymentData.push({
      participantId: p.id,
      amount,
      paymentDate: parseChileanDate(row['Fecha']) || new Date(),
      paymentMethod,
      transactionReference: doc || null,
      notes: distritoGrupo && distritoGrupo !== '#N/A' ? `Distrito-Grupo: ${distritoGrupo}` : null,
      registeredById: adminUser?.id || null,
    });
  }

  console.log(
    `Reemplazando abonos en ${event.code}: ${paymentData.length} movimientos (${negativeCount} negativos)...`
  );

  await prisma.$transaction(
    async (tx) => {
      await tx.payment.deleteMany({
        where: { participantId: { in: participantIds } },
      });

      const INSERT_CHUNK = 200;
      for (let i = 0; i < paymentData.length; i += INSERT_CHUNK) {
        const batch = paymentData.slice(i, i + INSERT_CHUNK);
        await tx.payment.createMany({ data: batch });
      }
    },
    { maxWait: 15000, timeout: 120000 }
  );

  // 3. Verificación final contra Supabase
  const refreshed = await prisma.participant.findMany({
    where: { eventId: event.id },
    select: {
      rut: true,
      status: true,
      financialStatusSheet: true,
      targetFeeUSD: true,
      totalPaidSheet: true,
      debtFinalUSD: true,
      debtToDateUSD: true,
      payments: { select: { amount: true } },
    },
  });

  let discrepancies = 0;
  let activeCount = 0;
  let bajaCount = 0;
  let metaActivos = 0;
  let recaudadoActivos = 0;
  let recaudadoBajas = 0;
  let deudaFinalActivos = 0;
  let deudaAFechaActivos = 0;

  for (const p of refreshed) {
    const sumPayments = round2(p.payments.reduce((acc, pay) => acc + pay.amount, 0));
    const sheetPaid = p.totalPaidSheet ?? 0;
    if (Math.abs(sumPayments - sheetPaid) > 0.05) {
      discrepancies++;
      console.error(`Discrepancia ${p.rut}: payments=${sumPayments} vs sheet=${sheetPaid}`);
    }

    const isBaja =
      p.status === 'RETIRADO' || (p.financialStatusSheet || '').toUpperCase().includes('BAJA');
    if (isBaja) {
      bajaCount++;
      recaudadoBajas += sheetPaid;
    } else {
      activeCount++;
      metaActivos += p.targetFeeUSD ?? 0;
      recaudadoActivos += sheetPaid;
      deudaFinalActivos += p.debtFinalUSD ?? 0;
      deudaAFechaActivos += p.debtToDateUSD ?? 0;
    }
  }

  console.log('\n--- RESULTADO DE SANEAMIENTO Y RECONCILIACIÓN ---');
  console.log({
    totalParticipants: refreshed.length,
    activeCount,
    bajaCount,
    paymentRowsInserted: paymentData.length,
    discrepancies,
    metaActivos: round2(metaActivos),
    recaudadoActivos: round2(recaudadoActivos),
    recaudadoBajas: round2(recaudadoBajas),
    deudaFinalActivos: round2(deudaFinalActivos),
    deudaAFechaActivos: round2(deudaAFechaActivos),
  });

  if (discrepancies > 0) {
    throw new Error(`Se encontraron ${discrepancies} discrepancias tras la reconciliación.`);
  }
}

main()
  .catch((err) => {
    console.error('Error en saneamiento:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
