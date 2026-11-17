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

  const totalRequired =
    totalPlanAmountOverride ??
    sortedInstallments.reduce((sum, item) => sum + item.amount, 0);

  const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);
  const balanceRemaining = Math.max(0, totalRequired - totalPaid);
  const isFullyPaid = totalPaid >= totalRequired && totalRequired > 0;

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

    const coveredAmount = Math.min(inst.amount, Math.max(0, remainingPaymentToAllocate));
    remainingPaymentToAllocate -= coveredAmount;

    const remainingAmount = Math.max(0, inst.amount - coveredAmount);

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

  const overdueAmount = Math.max(0, dueToDate - totalPaid);
  const isOverdue = overdueAmount > 0;

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
 * Formato de moneda USD estándar
 */
export function formatUSD(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}
