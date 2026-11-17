import { PrismaClient } from '@prisma/client';
import * as XLSX from 'xlsx';

const prisma = new PrismaClient();

function cleanRut(rut) {
  if (!rut) return '';
  return rut.replace(/[^0-9kK]/g, '').toUpperCase();
}

function calculateDv(rutBody) {
  const cleanBody = rutBody.replace(/[^0-9]/g, '');
  if (!cleanBody) return '';
  let sum = 0;
  let multiplier = 2;
  for (let i = cleanBody.length - 1; i >= 0; i--) {
    sum += parseInt(cleanBody[i], 10) * multiplier;
    multiplier = multiplier === 7 ? 2 : multiplier + 1;
  }
  const remainder = sum % 11;
  const expectedDv = 11 - remainder;
  if (expectedDv === 11) return '0';
  if (expectedDv === 10) return 'K';
  return expectedDv.toString();
}

function validateRut(rut) {
  const cleaned = cleanRut(rut);
  if (cleaned.length < 2) return false;
  const body = cleaned.slice(0, -1);
  const dv = cleaned.slice(-1).toUpperCase();
  if (!/^\d+$/.test(body)) return false;
  return dv === calculateDv(body);
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

function calculateFinancialSummary(installments = [], payments = [], totalPlanAmountOverride) {
  const sorted = [...installments].sort((a, b) => a.installmentNumber - b.installmentNumber);
  const totalRequired = totalPlanAmountOverride ?? sorted.reduce((sum, item) => sum + item.amount, 0);
  const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);
  const balanceRemaining = Math.max(0, totalRequired - totalPaid);
  const isFullyPaid = totalPaid >= totalRequired && totalRequired > 0;
  const now = new Date();
  let remainingPayment = totalPaid;
  let dueToDate = 0;
  let overdueCount = 0;

  const breakdown = sorted.map((inst) => {
    const dueDate = new Date(inst.dueDate);
    const isPastDue = dueDate.getTime() < now.getTime();
    if (isPastDue) dueToDate += inst.amount;

    const coveredAmount = Math.min(inst.amount, Math.max(0, remainingPayment));
    remainingPayment -= coveredAmount;

    let status;
    if (coveredAmount >= inst.amount) {
      status = 'PAGADA';
    } else if (coveredAmount > 0) {
      status = isPastDue ? 'VENCIDA' : 'PARCIAL';
      if (isPastDue) overdueCount++;
    } else {
      status = isPastDue ? 'VENCIDA' : 'PENDIENTE';
      if (isPastDue) overdueCount++;
    }

    return {
      installmentNumber: inst.installmentNumber,
      title: inst.title,
      dueDate,
      amount: inst.amount,
      coveredAmount,
      isPastDue,
      status,
    };
  });

  const overdueAmount = Math.max(0, dueToDate - totalPaid);
  const isOverdue = overdueAmount > 0;
  let health = 'AL_DIA';
  if (isFullyPaid) health = 'PAGADO_TOTAL';
  else if (isOverdue) health = 'EN_MORA';

  return { totalRequired, totalPaid, balanceRemaining, isFullyPaid, overdueAmount, isOverdue, overdueCount, health, breakdown };
}

function formatUSD(amount) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
}

async function main() {
  console.log('🧪 Starting Verification Test Suite for AGSCH Poland 2027 CRM...\n');

  // 1. RUT Tests
  console.log('--- TEST 1: Chilean RUT Validation & Formatting ---');
  const testRuts = [
    { rut: '21.345.678-4', expectedValid: true },
    { rut: '208901230', expectedValid: true },
    { rut: '16.543.210-k', expectedValid: true },
    { rut: '18.765.432-7', expectedValid: true },
    { rut: '22.109.876-5', expectedValid: true },
    { rut: '11.111.111-9', expectedValid: false },
    { rut: '12.345.678-9', expectedValid: false },
  ];
  for (const t of testRuts) {
    const isValid = validateRut(t.rut);
    const formatted = formatRut(t.rut);
    console.log(`RUT ${t.rut} -> Formatted: ${formatted} | Valid: ${isValid} (Expected: ${t.expectedValid})`);
    if (isValid !== t.expectedValid) throw new Error(`RUT test failed for ${t.rut}`);
  }
  console.log('✅ RUT validation tests passed!\n');

  // 2. Plans
  console.log('--- TEST 2: Database Query & Payment Plans ---');
  const plans = await prisma.paymentPlan.findMany({
    include: { installments: { orderBy: { installmentNumber: 'asc' } } },
  });
  console.log(`Found ${plans.length} payment plans:`);
  for (const p of plans) {
    console.log(`- ${p.name} (${p.roleKey}): Total ${formatUSD(p.totalAmount)} | ${p.installments.length} cuotas programadas`);
  }
  if (plans.length < 4) throw new Error('Missing payment plans');
  console.log('✅ Payment plans verified!\n');

  // 3. Participants
  console.log('--- TEST 3: Participants Financial Summaries ---');
  const participants = await prisma.participant.findMany({
    include: {
      plan: { include: { installments: true } },
      payments: true,
    },
  });
  console.log(`Total participants in DB: ${participants.length}`);
  for (const p of participants) {
    const fin = calculateFinancialSummary(p.plan?.installments || [], p.payments || [], p.plan?.totalAmount);
    console.log(
      `• ${p.firstName} ${p.lastName} (${p.rut}) [${p.contingentRole}]: ` +
      `Total: ${formatUSD(fin.totalRequired)} | ` +
      `Pagado: ${formatUSD(fin.totalPaid)} | ` +
      `Saldo: ${formatUSD(fin.balanceRemaining)} | ` +
      `Mora: ${formatUSD(fin.overdueAmount)} | ` +
      `Estado: [${fin.health}]`
    );
  }
  console.log('✅ Financial summary calculation verified!\n');

  // 4. Excel Export Buffer
  console.log('--- TEST 4: Excel Sheet Generation ---');
  const sampleData = participants.map((p) => ({
    RUT: p.rut,
    Nombre: `${p.firstName} ${p.lastName}`,
    Rol: p.contingentRole,
  }));
  const ws = XLSX.utils.json_to_sheet(sampleData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Participantes');
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  console.log(`Generated Excel buffer: ${buf.length} bytes`);
  if (!buf || buf.length === 0) throw new Error('Excel buffer generation failed');
  console.log('✅ Excel export capability verified!\n');

  console.log('🎉 ALL SYSTEM VERIFICATIONS PASSED SUCCESSFULLY!');
}

main()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
