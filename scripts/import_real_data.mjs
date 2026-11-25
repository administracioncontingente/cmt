import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import bcrypt from 'bcryptjs';

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

function formatRut(rut) {
  const cleaned = cleanRut(rut);
  if (cleaned.length < 2) return rut;
  const body = cleaned.slice(0, -1);
  const dv = cleaned.slice(-1);
  let formattedBody = '';
  let count = 0;
  for (let i = body.length - 1; i >= 0; i--) {
    formattedBody = body[i] + formattedBody;
    count++;
    if (count % 3 === 0 && i !== 0) formattedBody = '.' + formattedBody;
  }
  return `${formattedBody}-${dv}`;
}

function safeStr(val) {
  if (val === undefined || val === null) return '';
  return String(val).trim();
}

function parseNum(val) {
  if (val === undefined || val === null) return 0.0;
  let s = String(val).replace(/\$/g, '').replace(/\s/g, '').trim();
  if (!s) return 0.0;

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

  const n = parseFloat(s);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0.0;
}

function parseDate(str) {
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
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

function readCsv(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  return parseCsvRFC4180(content);
}

async function main() {
  console.log('🚀 Iniciando importación de la Base Real del Contingente AGSCH (Polonia 2027)...');

  // 1. Limpieza de datos anteriores (manteniendo usuario admin)
  console.log('🧹 Limpiando datos de prueba...');
  await prisma.payment.deleteMany();
  await prisma.participant.deleteMany();

  // Asegurar usuario admin
  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@agsch.cl' },
    update: {},
    create: {
      email: 'admin@agsch.cl',
      name: 'Comisionado de Contingente',
      passwordHash: await bcrypt.hash('admin123', 10),
      role: 'ADMIN',
    },
  });
  console.log('👤 Usuario admin verificado: admin@agsch.cl');

  // Asegurar planes de pago
  const plans = await prisma.paymentPlan.findMany();
  const planMap = new Map(plans.map((p) => [p.roleKey, p.id]));

  // 2. Leer archivo de Respuestas de Formulario 1
  console.log('📖 Leyendo data/respuestas_formulario_1.csv...');
  const participantRows = readCsv('/home/saul/agsch/data/respuestas_formulario_1.csv');
  console.log(`Se encontraron ${participantRows.length} registros en la planilla oficial.`);

  const participantData = [];
  const rutToIdMap = new Map();

  for (const row of participantRows) {
    const rawRut = row['RUT'] || row['RUT_SGUION'] || '';
    const cleaned = cleanRut(rawRut);
    if (!cleaned) continue;

    const formatted = formatRut(cleaned);
    const id = `p_${cleaned.toLowerCase()}`;
    rutToIdMap.set(cleaned, id);

    // Mapear rol a plan
    const rawRole = safeStr(row['ROL'] || row['¿En qué rol te interesa participar en el evento?'] || 'Participante');
    let roleKey = 'JOVEN';
    if (rawRole.toUpperCase().includes('RESPONSABLE') || rawRole.toUpperCase().includes('DIRIGENTE')) {
      roleKey = 'DIRIGENTE';
    } else if (rawRole.toUpperCase().includes('IST') || rawRole.toUpperCase().includes('SERVICIO')) {
      roleKey = 'IST';
    } else if (rawRole.toUpperCase().includes('CMT') || rawRole.toUpperCase().includes('CONTINGENTE')) {
      roleKey = 'CMT';
    }

    const planId = planMap.get(roleKey) || null;

    // Estado de participación
    const participa = safeStr(row['PARTICIPA']).toUpperCase();
    const cuotaAlDia = safeStr(row['CUOTA AL DIA']);
    let status = 'CONFIRMADO';
    if (participa.includes('NO') || participa.includes('BAJA') || cuotaAlDia === 'BAJA') {
      status = 'RETIRADO';
    } else if (safeStr(row['INSCRITO']) === 'NO') {
      status = 'PRE_INSCRITO';
    }

    const email = safeStr(row['Correo electrónico participante'] || row['Dirección de correo electrónico'] || `${cleaned.toLowerCase()}@participante.agsch.cl`);

    participantData.push({
      id,
      rut: formatted,
      rutClean: cleaned,
      firstName: safeStr(row['Nombres']),
      lastName: safeStr(row['Primer Apellido']),
      secondLastName: safeStr(row['Segundo Apellido']) || null,
      email,
      phone: safeStr(row['Teléfono del participante']) || null,
      birthDate: parseDate(row['Fecha de Nacimiento']),
      gender: safeStr(row['Género']) || null,
      address: safeStr(row['Dirección del participante']) || null,
      commune: safeStr(row['Comuna']) || null,
      city: safeStr(row['Ciudad']) || null,
      nationality: safeStr(row['Nacionalidad']) || null,
      secondNationality: safeStr(row['Indicar si posees una segunda nacionalidad ']) || null,
      idCardUrl: safeStr(row['Sube Cédula de Identidad']) || null,
      previousEvents: safeStr(row['¿Has participado de algún evento mundial/interamericano anterior?']) || null,

      // Apoderado
      guardianName: safeStr(row['Nombre de apoderado/a'] || row['APODERADO']) || null,
      guardianRelationship: null,
      guardianPhone: safeStr(row['Teléfono apoderado/a']) || null,
      guardianEmail: safeStr(row['Correo electrónico de apoderado/a']) || null,

      // Scout
      scoutZone: safeStr(row['Zona'] || row['ZONA EVENTO']) || null,
      scoutDistrict: safeStr(row['Distrito']) || null,
      scoutGroup: safeStr(row['Grupo'] || row['GRUPO EVENTO']) || null,
      scoutCurrentRole: safeStr(row['Actualmente estoy participando en:']) || null,
      scoutTrainingLevel: safeStr(row['Nivel de Formación']) || null,
      scoutMemberNumber: safeStr(row['Número de miembro activo']) || null,
      groupLeaderName: safeStr(row['Nombre Contacto de la Dirigente o Guiadora a cargo del Grupo']) || null,
      groupLeaderEmail: safeStr(row['Correo del Contacto del Grupo']) || null,
      groupLeaderPhone: safeStr(row['Teléfono del contacto del Grupo']) || null,
      activeRegistrations: [
        safeStr(row['REGISTRO 2024']),
        safeStr(row['REGISTRO 2025']),
        safeStr(row['REGISTRO 2026']),
        safeStr(row['REGISTRO 2027'])
      ].filter(Boolean).join(', ') || null,

      // Contingente y logística
      contingentRole: rawRole,
      status,
      unitOrPatrol: (safeStr(row['UNIT-NAME']) && safeStr(row['PATROL-NAME']))
        ? `${safeStr(row['UNIT-NAME'])} - ${safeStr(row['PATROL-NAME'])}`
        : (safeStr(row['UNIT-NAME']) || safeStr(row['PATROL-NAME']) || safeStr(row['UNIT']) || null),
      cupoCode: safeStr(row['COD CUPO']) || null,
      territorium: safeStr(row['TERRITORIUM']) || null,
      unit: safeStr(row['UNIT']) || null,
      unitName: safeStr(row['UNIT-NAME']) || null,
      patrol: safeStr(row['PATRULLA']) || null,
      patrolName: safeStr(row['PATROL-NAME']) || null,
      patrolCode: safeStr(row['COD PATRULLA']) || null,
      uniformSize: safeStr(row['TALLAS OK']) || null,
      polandRegistered: safeStr(row['REGISTRO POLAND']) || null,

      // Datos financieros de la planilla oficial
      feeType: safeStr(row['TIPO CUOTA']) || null,
      feeEnrollmentType: safeStr(row['TIPO INSCRIPCIÓN']) || null,
      calendarUrl: (() => {
        const raw = safeStr(row['IMAGE_CAL']);
        if (!raw) return null;
        if (raw.includes('gruposanagustin.cl/wsj2027cuota/')) {
          const filename = raw.split('wsj2027cuota/')[1].split('?')[0];
          return `/calendarios/${filename}`;
        }
        return raw;
      })(),
      totalPaidSheet: parseNum(row['CUOTA PAGADA']),
      targetFeeUSD: parseNum(row['CUOTA FINAL']),
      dueToDateUSD: parseNum(row['CUOTA A FECHA']),
      debtFinalUSD: parseNum(row['DEUDA FINAL']),
      debtToDateUSD: parseNum(row['DEUDA A FECHA']),
      overpaymentUSD: parseNum(row['SOBREPAGO CUOTA']),
      financialStatusSheet: cuotaAlDia || null,

      planId,
      notes: row['SALUDO'] ? `Saludo: ${safeStr(row['SALUDO'])}` : null,
    });
  }

  console.log(`💾 Insertando ${participantData.length} participantes reales en SQLite...`);
  const BATCH_SIZE = 100;
  for (let i = 0; i < participantData.length; i += BATCH_SIZE) {
    const batch = participantData.slice(i, i + BATCH_SIZE);
    await prisma.participant.createMany({ data: batch });
  }
  console.log('✅ Participantes insertados exitosamente.');

  // 3. Leer e importar Detalle de Cuotas (Abonos reales)
  console.log('📖 Leyendo data/detalle_cuotas.csv...');
  const paymentRows = readCsv('/home/saul/agsch/data/detalle_cuotas.csv');
  console.log(`Se encontraron ${paymentRows.length} registros de pagos/abonos.`);

  const paymentData = [];
  let skippedInternalCount = 0;

  for (const row of paymentRows) {
    const rawRut = row['RUT'] || '';
    const clean = cleanRut(rawRut);
    const participantId = rutToIdMap.get(clean);

    if (!participantId) {
      skippedInternalCount++;
      continue;
    }

    const amount = parseNum(row['Monto']);
    if (amount === 0) continue;

    const doc = safeStr(row['Documento']);
    const docUpper = doc.toUpperCase();
    let paymentMethod = 'TRANSFERENCIA';
    if (docUpper.includes('TRASPASO')) {
      paymentMethod = 'TRASPASO';
    } else if (docUpper.includes('DEVOLUCION') || amount < 0) {
      paymentMethod = 'DEVOLUCION';
    }

    paymentData.push({
      participantId,
      amount,
      paymentDate: parseDate(row['Fecha']) || new Date(),
      paymentMethod,
      transactionReference: doc || null,
      notes: safeStr(row['Distrito-Grupo']) && safeStr(row['Distrito-Grupo']) !== '#N/A'
        ? `Distrito-Grupo: ${safeStr(row['Distrito-Grupo'])}`
        : null,
      registeredById: adminUser.id,
    });
  }

  console.log(`💾 Insertando ${paymentData.length} pagos reales asociados a participantes...`);
  for (let i = 0; i < paymentData.length; i += 200) {
    const batch = paymentData.slice(i, i + 200);
    await prisma.payment.createMany({ data: batch });
  }

  console.log('✅ Abonos insertados exitosamente.');

  // Estadísticas finales
  const totalP = await prisma.participant.count();
  const totalPay = await prisma.payment.count();
  const sumPay = await prisma.payment.aggregate({ _sum: { amount: true } });

  console.log('\n📊 --- RESUMEN DE MIGRACIÓN A BASE REAL ---');
  console.log(`• Total Participantes en BD: ${totalP}`);
  console.log(`• Total Abonos / Pagos en BD: ${totalPay}`);
  console.log(`• Monto Total Recaudado en BD: $${sumPay._sum.amount?.toLocaleString('en-US', { minimumFractionDigits: 2 })} USD`);
  console.log(`• Registros internos/excluidos (NOWSJ/INTERNO): ${skippedInternalCount}`);
  console.log('🎉 Migración de base de datos completada con éxito!');
}

main()
  .catch((e) => {
    console.error('❌ Error durante la importación:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
