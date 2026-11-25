export interface InstallmentInfo {
  id: string;
  installmentNumber: number;
  title: string;
  dueDate: string | Date;
  amount: number;
}

export interface PaymentInfo {
  id: string;
  amount: number;
  paymentDate: string | Date;
  paymentMethod: string;
  transactionReference?: string | null;
  notes?: string | null;
}

export interface InstallmentBreakdown {
  id: string;
  installmentNumber: number;
  title: string;
  dueDate: Date;
  amount: number;
  coveredAmount: number;
  remainingAmount: number;
  isPastDue: boolean;
  status: 'PAGADA' | 'PARCIAL' | 'VENCIDA' | 'PENDIENTE';
}

export interface FinancialSummary {
  totalRequired: number;
  totalPaid: number;
  balanceRemaining: number;
  isFullyPaid: boolean;
  dueToDate: number;
  overdueAmount: number;
  isOverdue: boolean;
  overdueCount: number;
  health: 'PAGADO_TOTAL' | 'AL_DIA' | 'EN_MORA';
  breakdown: InstallmentBreakdown[];
}

const round2 = (n: number): number => Math.round(n * 100) / 100;

/**
 * Resolves the effective target fee amount for a participant.
 * Explicit 0 (e.g. BAJA or scholarship/exempt) is preserved rather than falling back to the plan total.
 */
export function resolveParticipantTargetAmount(
  targetFeeUSD?: number | null,
  planTotalAmount?: number | null
): number {
  if (targetFeeUSD !== null && targetFeeUSD !== undefined) {
    return targetFeeUSD;
  }
  return planTotalAmount ?? 3600;
}

/**
 * Calcula la salud financiera y la imputación de cuotas de un participante.
 */
export function calculateFinancialSummary(
  installments: InstallmentInfo[] = [],
  payments: PaymentInfo[] = [],
  totalPlanAmountOverride?: number
): FinancialSummary {
  const sortedInstallments = [...installments].sort(
    (a, b) => a.installmentNumber - b.installmentNumber
  );

  const totalRequired = round2(
    totalPlanAmountOverride ??
      sortedInstallments.reduce((sum, item) => sum + item.amount, 0)
  );

  const totalPaid = round2(payments.reduce((sum, p) => sum + p.amount, 0));
  const balanceRemaining = round2(Math.max(0, totalRequired - totalPaid));
  const isFullyPaid = totalRequired === 0 ? true : totalPaid >= totalRequired;

  const now = new Date();

  let remainingPaymentToAllocate = totalPaid;
  let dueToDate = 0;
  let overdueCount = 0;

  const breakdown: InstallmentBreakdown[] = sortedInstallments.map((inst) => {
    const dueDate = new Date(inst.dueDate);
    const isPastDue = dueDate.getTime() < now.getTime();

    if (isPastDue) {
      dueToDate += inst.amount;
    }

    const coveredAmount = round2(Math.min(inst.amount, Math.max(0, remainingPaymentToAllocate)));
    remainingPaymentToAllocate = round2(remainingPaymentToAllocate - coveredAmount);

    const remainingAmount = round2(Math.max(0, inst.amount - coveredAmount));

    let status: 'PAGADA' | 'PARCIAL' | 'VENCIDA' | 'PENDIENTE';
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
      id: inst.id,
      installmentNumber: inst.installmentNumber,
      title: inst.title,
      dueDate,
      amount: inst.amount,
      coveredAmount,
      remainingAmount,
      isPastDue,
      status,
    };
  });

  dueToDate = totalRequired === 0 ? 0 : round2(dueToDate);
  const overdueAmount = totalRequired === 0 ? 0 : round2(Math.max(0, dueToDate - totalPaid));
  const isOverdue = overdueAmount > 0;
  if (totalRequired === 0) {
    overdueCount = 0;
  }

  let health: 'PAGADO_TOTAL' | 'AL_DIA' | 'EN_MORA' = 'AL_DIA';
  if (isFullyPaid) {
    health = 'PAGADO_TOTAL';
  } else if (isOverdue) {
    health = 'EN_MORA';
  }

  return {
    totalRequired,
    totalPaid,
    balanceRemaining,
    isFullyPaid,
    dueToDate,
    overdueAmount,
    isOverdue,
    overdueCount,
    health,
    breakdown,
  };
}

/**
 * Checks whether an enriched participant matches a financial health filter.
 */
export function matchesHealthFilter(
  participant: {
    status: string;
    financialStatusSheet?: string | null;
    financial: FinancialSummary;
  },
  health: string
): boolean {
  if (!health || health === 'ALL') return true;
  if (health === 'AL_DIA') {
    return (
      participant.financialStatusSheet === 'Al Día' ||
      participant.financial.health === 'AL_DIA'
    );
  }
  if (health === 'EN_MORA') {
    return (
      participant.financialStatusSheet === 'Adeuda' ||
      participant.financial.health === 'EN_MORA'
    );
  }
  if (health === 'PAGADO_TOTAL') {
    return (
      participant.financialStatusSheet === 'Total Pagado' ||
      participant.financial.health === 'PAGADO_TOTAL'
    );
  }
  if (health === 'BAJA') {
    return participant.financialStatusSheet === 'BAJA' || participant.status === 'RETIRADO';
  }
  return true;
}

/**
 * Computes synchronized spreadsheet summary fields after payment or fee changes.
 */
export function computeSheetSyncFields(params: {
  installments: InstallmentInfo[];
  payments: PaymentInfo[];
  targetFeeUSD?: number | null;
  planTotalAmount?: number | null;
  currentStatus: string;
}) {
  const target = resolveParticipantTargetAmount(params.targetFeeUSD, params.planTotalAmount);
  const financial = calculateFinancialSummary(params.installments, params.payments, target);

  let financialStatusSheet = 'Al Día';
  if (params.currentStatus === 'RETIRADO') {
    financialStatusSheet = 'BAJA';
  } else if (financial.isFullyPaid) {
    financialStatusSheet = 'Total Pagado';
  } else if (financial.isOverdue) {
    financialStatusSheet = 'Adeuda';
  }

  return {
    totalPaidSheet: financial.totalPaid,
    debtFinalUSD: financial.balanceRemaining,
    debtToDateUSD: financial.overdueAmount,
    overpaymentUSD: Math.max(0, financial.totalPaid - target),
    financialStatusSheet,
    financial,
  };
}

/**
 * Formats an amount in the requested currency (USD, EUR, CLP) with safe fallback for unknown codes.
 */
export function formatCurrency(amount: number, currency = 'USD'): string {
  const code = (currency || 'USD').trim().toUpperCase();
  const safeAmount = Number.isFinite(amount) ? amount : 0;
  const localeMap: Record<string, string> = {
    USD: 'en-US',
    EUR: 'es-CL',
    CLP: 'es-CL',
  };
  const locale = localeMap[code] || 'en-US';
  const isClp = code === 'CLP';

  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: code,
      minimumFractionDigits: 0,
      maximumFractionDigits: isClp ? 0 : 2,
    }).format(safeAmount);
  } catch {
    const formatted = new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(safeAmount);
    return `${code} ${formatted}`;
  }
}

/**
 * Formato de moneda USD estándar
 */
export function formatUSD(amount: number): string {
  return formatCurrency(amount, 'USD');
}
