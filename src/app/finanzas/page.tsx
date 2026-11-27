'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  ExternalLink,
  FileCheck2,
  FilterX,
  Layers,
  Loader2,
  RefreshCw,
  Search,
  Sparkles,
  TrendingUp,
  Users,
  Wallet,
} from 'lucide-react';
import { AppShell, useAppShell } from '@/components/AppShell';
import { ParticipantDetailModal } from '@/components/ParticipantDetailModal';
import { formatCurrency } from '@/lib/finance';
import type {
  PaymentLedgerItemDTO,
  PaymentPlanDTO,
  PaymentsLedgerResponseDTO,
  PaymentsLedgerSummaryDTO,
} from '@/types/domain';

type FinanzasTab = 'ledger' | 'plans';

const EMPTY_SUMMARY: PaymentsLedgerSummaryDTO = {
  totalAmount: 0,
  totalCount: 0,
  filloutCount: 0,
  withReceiptCount: 0,
  last30DaysAmount: 0,
  sourceCounts: {},
};

const SOURCE_OPTIONS = [
  { value: 'ALL', label: 'Todos los orígenes' },
  { value: 'FILLOUT_MAIN', label: 'Fillout Principal' },
  { value: 'FILLOUT_SUBFORM', label: 'Fillout Grupal' },
  { value: 'CSV_SHEET', label: 'Planilla' },
  { value: 'MANUAL', label: 'Manual' },
] as const;

const METHOD_OPTIONS = [
  { value: 'ALL', label: 'Todos los métodos' },
  { value: 'TRANSFERENCIA', label: 'Transferencia' },
  { value: 'TARJETA', label: 'Tarjeta' },
  { value: 'DEPOSITO', label: 'Depósito' },
  { value: 'EFECTIVO', label: 'Efectivo' },
  { value: 'TRASPASO', label: 'Traspaso' },
  { value: 'DEVOLUCION', label: 'Devolución' },
  { value: 'OTRO', label: 'Otro' },
] as const;

const RECEIPT_OPTIONS = [
  { value: 'ALL', label: 'Todos los comprobantes' },
  { value: 'WITH', label: 'Con comprobante' },
  { value: 'WITHOUT', label: 'Sin comprobante' },
] as const;

function getSourceBadge(source?: string | null): {
  label: string;
  className: string;
} {
  const normalized = (source || 'MANUAL').toUpperCase();
  switch (normalized) {
    case 'FILLOUT_MAIN':
      return {
        label: 'Fillout Principal',
        className: 'bg-[#FFF8E1] text-[#001558] border-[#FEB135]',
      };
    case 'FILLOUT_SUBFORM':
      return {
        label: 'Fillout Grupal',
        className: 'bg-[#EEF2FF] text-[#001558] border-[#001558]/25',
      };
    case 'CSV_SHEET':
      return {
        label: 'Planilla',
        className: 'bg-emerald-50 text-emerald-800 border-emerald-200',
      };
    default:
      return {
        label: 'Manual',
        className: 'bg-slate-100 text-slate-700 border-slate-200',
      };
  }
}

function getInstallmentRelativeBadge(
  dueDateValue: string | Date,
  nowMs: number
): { label: string; className: string } {
  const dueDate = new Date(dueDateValue);
  if (Number.isNaN(dueDate.getTime())) {
    return {
      label: 'Programada',
      className: 'bg-slate-100 text-slate-700 border-slate-200',
    };
  }

  const todayStart = new Date(nowMs);
  todayStart.setHours(0, 0, 0, 0);
  const dueStart = new Date(dueDate);
  dueStart.setHours(0, 0, 0, 0);

  const diffDays = Math.ceil(
    (dueStart.getTime() - todayStart.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (diffDays < 0) {
    return {
      label: 'Vencida',
      className: 'bg-red-50 text-red-700 border-red-200',
    };
  }
  if (diffDays <= 30) {
    return {
      label: 'Próxima ≤30d',
      className: 'bg-[#FFF8E1] text-[#001558] border-[#FEB135]',
    };
  }
  return {
    label: 'Programada',
    className: 'bg-[#EEF2FF] text-[#001558] border-[#001558]/20',
  };
}

function truncateId(value?: string | null, maxLen = 14): string {
  if (!value) return '';
  if (value.length <= maxLen) return value;
  return `${value.slice(0, maxLen)}…`;
}

function FinanzasWorkspace() {
  const { activeEvent, permissions, currency, eventVersion, refreshStats } =
    useAppShell();

  const [activeTab, setActiveTab] = useState<FinanzasTab>('ledger');
  const [selectedParticipantId, setSelectedParticipantId] = useState<
    string | null
  >(null);

  // Ledger state
  const [payments, setPayments] = useState<PaymentLedgerItemDTO[]>([]);
  const [summary, setSummary] =
    useState<PaymentsLedgerSummaryDTO>(EMPTY_SUMMARY);
  const [ledgerCurrency, setLedgerCurrency] = useState<string>(currency);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [loadingLedger, setLoadingLedger] = useState(true);
  const [ledgerError, setLedgerError] = useState<string | null>(null);
  const [reloadTick, setReloadTick] = useState(0);

  // Ledger filters
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [sourceFilter, setSourceFilter] = useState('ALL');
  const [methodFilter, setMethodFilter] = useState('ALL');
  const [receiptFilter, setReceiptFilter] = useState('ALL');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Plans state
  const [plans, setPlans] = useState<PaymentPlanDTO[]>([]);
  const [loadingPlans, setLoadingPlans] = useState(false);
  const [plansError, setPlansError] = useState<string | null>(null);
  const [referenceNowMs] = useState(() => Date.now());

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchQuery(searchInput.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Fetch payments ledger
  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;

    const run = async () => {
      await Promise.resolve();
      if (cancelled) return;
      setLoadingLedger(true);
      setLedgerError(null);

      try {
        const params = new URLSearchParams({
          page: String(page),
          limit: '50',
        });
        if (searchQuery) params.set('search', searchQuery);
        if (sourceFilter !== 'ALL') params.set('source', sourceFilter);
        if (methodFilter !== 'ALL') params.set('method', methodFilter);
        if (receiptFilter !== 'ALL') params.set('hasReceipt', receiptFilter);
        if (dateFrom) params.set('dateFrom', dateFrom);
        if (dateTo) params.set('dateTo', dateTo);

        const res = await fetch(`/api/payments?${params.toString()}`, {
          signal: controller.signal,
        });
        if (!res.ok) {
          const errBody = (await res.json().catch(() => ({}))) as {
            error?: string;
          };
          throw new Error(
            errBody.error || 'No se pudo cargar el libro de pagos'
          );
        }

        const data = (await res.json()) as PaymentsLedgerResponseDTO;
        if (cancelled) return;

        setPayments(data.payments || []);
        setSummary(data.summary || EMPTY_SUMMARY);
        setTotalPages(Math.max(1, data.totalPages || 1));
        setTotalCount(data.totalCount || 0);
        setLedgerCurrency(data.currency || currency);
      } catch (err: unknown) {
        if (
          !cancelled &&
          !(err instanceof DOMException && err.name === 'AbortError')
        ) {
          setLedgerError(
            err instanceof Error
              ? err.message
              : 'Error inesperado al cargar pagos'
          );
        }
      } finally {
        if (!cancelled) {
          setLoadingLedger(false);
        }
      }
    };

    void run();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [
    page,
    searchQuery,
    sourceFilter,
    methodFilter,
    receiptFilter,
    dateFrom,
    dateTo,
    eventVersion,
    reloadTick,
    currency,
  ]);

  // Fetch payment plans
  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;

    const run = async () => {
      await Promise.resolve();
      if (cancelled) return;
      setLoadingPlans(true);
      setPlansError(null);

      try {
        const res = await fetch('/api/plans', { signal: controller.signal });
        if (!res.ok) {
          const errBody = (await res.json().catch(() => ({}))) as {
            error?: string;
          };
          throw new Error(
            errBody.error || 'No se pudieron cargar los planes de pago'
          );
        }
        const data = (await res.json()) as { plans?: PaymentPlanDTO[] };
        if (!cancelled) {
          setPlans(data.plans || []);
        }
      } catch (err: unknown) {
        if (
          !cancelled &&
          !(err instanceof DOMException && err.name === 'AbortError')
        ) {
          setPlansError(
            err instanceof Error
              ? err.message
              : 'Error inesperado al cargar planes'
          );
        }
      } finally {
        if (!cancelled) {
          setLoadingPlans(false);
        }
      }
    };

    void run();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [eventVersion, reloadTick]);

  const handleClearFilters = useCallback(() => {
    setSearchInput('');
    setSearchQuery('');
    setSourceFilter('ALL');
    setMethodFilter('ALL');
    setReceiptFilter('ALL');
    setDateFrom('');
    setDateTo('');
    setPage(1);
  }, []);

  const handleReload = useCallback(() => {
    setReloadTick((t) => t + 1);
    void refreshStats();
  }, [refreshStats]);

  const hasActiveFilters =
    Boolean(searchInput.trim()) ||
    sourceFilter !== 'ALL' ||
    methodFilter !== 'ALL' ||
    receiptFilter !== 'ALL' ||
    Boolean(dateFrom) ||
    Boolean(dateTo);

  const effectiveCurrency = ledgerCurrency || currency;
  const receiptPercent =
    summary.totalCount > 0
      ? Math.round((summary.withReceiptCount / summary.totalCount) * 100)
      : 0;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-[#001558] text-[#FEB135] flex items-center justify-center shrink-0">
                <Wallet className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-black text-[#001558] tracking-tight">
                  Tesorería y Conciliación Financiera
                </h1>
                <p className="text-xs sm:text-sm text-slate-600">
                  {activeEvent
                    ? `${activeEvent.flagEmoji ? `${activeEvent.flagEmoji} ` : ''}${activeEvent.name} • Moneda base: ${effectiveCurrency}`
                    : 'Gestión centralizada de pagos, Fillout y planes de cuotas'}
                </p>
              </div>
            </div>
          </div>

          {/* Local Tabs */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex p-1 rounded-xl bg-[#F5F6F8] border border-slate-200">
              <button
                type="button"
                onClick={() => setActiveTab('ledger')}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'ledger'
                    ? 'bg-[#001558] text-white shadow-xs'
                    : 'text-slate-600 hover:text-[#001558]'
                }`}
              >
                <CreditCard className="w-3.5 h-3.5 text-[#FEB135]" />
                Libro de Pagos y Fillout
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('plans')}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'plans'
                    ? 'bg-[#001558] text-white shadow-xs'
                    : 'text-slate-600 hover:text-[#001558]'
                }`}
              >
                <CalendarClock className="w-3.5 h-3.5 text-[#FEB135]" />
                Planes y Calendario de Cuotas
              </button>
            </div>

            <button
              type="button"
              onClick={handleReload}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white hover:bg-[#FFFBF0] border border-slate-200 hover:border-[#FEB135] text-xs font-bold text-[#001558] transition-colors cursor-pointer"
              title="Recargar información financiera"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${
                  loadingLedger || loadingPlans ? 'animate-spin' : ''
                }`}
              />
              <span>Recargar</span>
            </button>
          </div>
        </div>
      </div>

      {/* TAB 1: LEDGER DE PAGOS */}
      {activeTab === 'ledger' && (
        <div className="space-y-5">
          {/* 4 KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Total Recaudado en Ledger
                </span>
                <div className="w-9 h-9 rounded-xl bg-[#FFFBF0] border border-[#FEB135]/50 text-[#001558] flex items-center justify-center">
                  <Wallet className="w-4 h-4" />
                </div>
              </div>
              <p className="text-2xl sm:text-3xl font-extrabold text-[#001558]">
                {formatCurrency(summary.totalAmount, effectiveCurrency)}
              </p>
              <p className="text-[11px] text-slate-500 mt-2 pt-2 border-t border-slate-100">
                {summary.totalCount.toLocaleString('es-CL')} movimientos en el
                evento
              </p>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Ingresos Últimos 30 Días
                </span>
                <div className="w-9 h-9 rounded-xl bg-[#EEF2FF] border border-[#001558]/15 text-[#001558] flex items-center justify-center">
                  <TrendingUp className="w-4 h-4" />
                </div>
              </div>
              <p className="text-2xl sm:text-3xl font-extrabold text-[#001558]">
                {formatCurrency(summary.last30DaysAmount, effectiveCurrency)}
              </p>
              <p className="text-[11px] text-slate-500 mt-2 pt-2 border-t border-slate-100">
                Ventana móvil de últimos 30 días
              </p>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Pagos vía Fillout
                </span>
                <div className="w-9 h-9 rounded-xl bg-[#FFF8E1] border border-[#FEB135] text-[#001558] flex items-center justify-center">
                  <Sparkles className="w-4 h-4" />
                </div>
              </div>
              <p className="text-2xl sm:text-3xl font-extrabold text-[#001558]">
                {summary.filloutCount.toLocaleString('es-CL')}
              </p>
              <p className="text-[11px] text-slate-500 mt-2 pt-2 border-t border-slate-100">
                Principal: {summary.sourceCounts.FILLOUT_MAIN ?? 0} • Grupal:{' '}
                {summary.sourceCounts.FILLOUT_SUBFORM ?? 0}
              </p>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Comprobantes Adjuntos
                </span>
                <div className="w-9 h-9 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center justify-center">
                  <FileCheck2 className="w-4 h-4" />
                </div>
              </div>
              <p className="text-2xl sm:text-3xl font-extrabold text-[#001558]">
                {summary.withReceiptCount.toLocaleString('es-CL')}
              </p>
              <p className="text-[11px] text-slate-500 mt-2 pt-2 border-t border-slate-100">
                {receiptPercent}% del total con respaldo adjunto
              </p>
            </div>
          </div>

          {/* Filter Bar */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
              {/* Search */}
              <div className="sm:col-span-2 relative">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="Buscar participante, RUT, N° operación o notas..."
                  className="w-full bg-white border border-slate-300 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-800 placeholder-slate-400 focus:border-[#001558] focus:ring-2 focus:ring-[#FEB135]/50 focus:outline-none"
                />
              </div>

              {/* Source */}
              <select
                aria-label="Filtrar por origen"
                value={sourceFilter}
                onChange={(e) => {
                  setSourceFilter(e.target.value);
                  setPage(1);
                }}
                className="bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-800 font-medium focus:border-[#001558] focus:ring-2 focus:ring-[#FEB135]/50 focus:outline-none"
              >
                {SOURCE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>

              {/* Method */}
              <select
                aria-label="Filtrar por método de pago"
                value={methodFilter}
                onChange={(e) => {
                  setMethodFilter(e.target.value);
                  setPage(1);
                }}
                className="bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-800 font-medium focus:border-[#001558] focus:ring-2 focus:ring-[#FEB135]/50 focus:outline-none"
              >
                {METHOD_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>

              {/* Receipt */}
              <select
                aria-label="Filtrar por comprobante"
                value={receiptFilter}
                onChange={(e) => {
                  setReceiptFilter(e.target.value);
                  setPage(1);
                }}
                className="bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-800 font-medium focus:border-[#001558] focus:ring-2 focus:ring-[#FEB135]/50 focus:outline-none"
              >
                {RECEIPT_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>

              {/* Clear / Reload Actions */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleClearFilters}
                  disabled={!hasActiveFilters}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-slate-300 bg-[#F5F6F8] hover:bg-slate-200/70 text-xs font-bold text-slate-700 disabled:opacity-45 transition-colors cursor-pointer"
                >
                  <FilterX className="w-3.5 h-3.5" />
                  <span>Limpiar filtros</span>
                </button>
              </div>
            </div>

            {/* Date range row */}
            <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-slate-100 text-xs">
              <div className="flex items-center gap-2">
                <label
                  htmlFor="finanzas-date-from"
                  className="font-bold text-slate-600"
                >
                  Desde:
                </label>
                <input
                  id="finanzas-date-from"
                  type="date"
                  value={dateFrom}
                  onChange={(e) => {
                    setDateFrom(e.target.value);
                    setPage(1);
                  }}
                  className="bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 focus:border-[#001558] focus:ring-2 focus:ring-[#FEB135]/50 focus:outline-none"
                />
              </div>

              <div className="flex items-center gap-2">
                <label
                  htmlFor="finanzas-date-to"
                  className="font-bold text-slate-600"
                >
                  Hasta:
                </label>
                <input
                  id="finanzas-date-to"
                  type="date"
                  value={dateTo}
                  onChange={(e) => {
                    setDateTo(e.target.value);
                    setPage(1);
                  }}
                  className="bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 focus:border-[#001558] focus:ring-2 focus:ring-[#FEB135]/50 focus:outline-none"
                />
              </div>

              <span className="ml-auto text-[11px] font-semibold text-slate-500">
                Mostrando {payments.length} de{' '}
                {totalCount.toLocaleString('es-CL')} movimientos filtrados
              </span>
            </div>
          </div>

          {/* Error state */}
          {ledgerError && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-2xl p-4 text-xs font-semibold">
              {ledgerError}
            </div>
          )}

          {/* Ledger Table / Cards */}
          <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
            {loadingLedger ? (
              <div className="p-12 flex items-center justify-center gap-2 text-xs font-semibold text-slate-500">
                <Loader2 className="w-5 h-5 animate-spin text-[#001558]" />
                <span>Cargando movimientos del libro de pagos...</span>
              </div>
            ) : payments.length === 0 ? (
              <div className="p-12 text-center space-y-2 text-slate-500">
                <CreditCard className="w-9 h-9 mx-auto text-slate-300" />
                <p className="text-sm font-bold text-[#001558]">
                  No hay pagos registrados con los filtros actuales
                </p>
                <p className="text-xs text-slate-500">
                  Prueba ajustando el rango de fechas, origen o búsqueda.
                </p>
              </div>
            ) : (
              <>
                {/* Desktop Table */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-[#F5F6F8] border-b border-slate-200 text-[11px] font-extrabold text-slate-600 uppercase tracking-wider">
                        <th className="py-3 px-4">Fecha</th>
                        <th className="py-3 px-4">Participante</th>
                        <th className="py-3 px-4 text-right">Monto</th>
                        <th className="py-3 px-4">Método</th>
                        <th className="py-3 px-4">N° Operación / Fillout</th>
                        <th className="py-3 px-4">Origen</th>
                        <th className="py-3 px-4">Comprobante</th>
                        <th className="py-3 px-4">Notas / Registrado por</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 text-xs">
                      {payments.map((p) => {
                        const sourceBadge = getSourceBadge(p.source);
                        const isNegative = p.amount < 0;
                        const refText =
                          p.transactionReference || p.filloutSubmissionId;

                        return (
                          <tr
                            key={p.id}
                            className="hover:bg-[#FFFBF0]/60 transition-colors align-top"
                          >
                            <td className="py-3.5 px-4 whitespace-nowrap font-semibold text-slate-700">
                              {new Date(p.paymentDate).toLocaleDateString(
                                'es-CL'
                              )}
                            </td>

                            <td className="py-3.5 px-4">
                              <button
                                type="button"
                                onClick={() =>
                                  setSelectedParticipantId(p.participant.id)
                                }
                                className="text-left group cursor-pointer"
                              >
                                <span className="font-bold text-[#001558] group-hover:underline block">
                                  {p.participant.firstName}{' '}
                                  {p.participant.lastName}
                                </span>
                                <span className="text-[11px] text-slate-500 font-mono block">
                                  {p.participant.rut}
                                  {p.participant.cupoCode
                                    ? ` • ${p.participant.cupoCode}`
                                    : ''}
                                </span>
                              </button>
                            </td>

                            <td
                              className={`py-3.5 px-4 text-right whitespace-nowrap font-extrabold ${
                                isNegative ? 'text-red-600' : 'text-[#001558]'
                              }`}
                            >
                              {formatCurrency(p.amount, effectiveCurrency)}
                            </td>

                            <td className="py-3.5 px-4 whitespace-nowrap font-semibold text-slate-700">
                              {p.paymentMethod}
                            </td>

                            <td className="py-3.5 px-4 font-mono text-[11px] text-slate-600">
                              {refText ? (
                                <span
                                  title={refText}
                                  className="px-2 py-0.5 rounded bg-slate-100 border border-slate-200 inline-block"
                                >
                                  {truncateId(refText, 16)}
                                </span>
                              ) : (
                                <span className="text-slate-400">—</span>
                              )}
                            </td>

                            <td className="py-3.5 px-4 whitespace-nowrap">
                              <span
                                className={`inline-flex items-center px-2 py-0.5 rounded-md border text-[10px] font-bold ${sourceBadge.className}`}
                              >
                                {sourceBadge.label}
                              </span>
                            </td>

                            <td className="py-3.5 px-4 whitespace-nowrap">
                              {p.receiptUrl ? (
                                <a
                                  href={p.receiptUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#EEF2FF] hover:bg-[#001558] text-[#001558] hover:text-white border border-[#001558]/20 text-[11px] font-bold transition-colors"
                                >
                                  <span>Ver Comprobante</span>
                                  <ExternalLink className="w-3 h-3" />
                                </a>
                              ) : (
                                <span className="text-slate-400 text-[11px]">
                                  Sin adjunto
                                </span>
                              )}
                            </td>

                            <td className="py-3.5 px-4 max-w-xs">
                              {p.notes && (
                                <p className="text-slate-700 line-clamp-2">
                                  {p.notes}
                                </p>
                              )}
                              {p.registeredBy?.name && (
                                <p className="text-[11px] text-slate-500 mt-0.5">
                                  Por: {p.registeredBy.name}
                                </p>
                              )}
                              {!p.notes && !p.registeredBy?.name && (
                                <span className="text-slate-400">—</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Cards */}
                <div className="md:hidden divide-y divide-slate-200">
                  {payments.map((p) => {
                    const sourceBadge = getSourceBadge(p.source);
                    const isNegative = p.amount < 0;
                    const refText =
                      p.transactionReference || p.filloutSubmissionId;

                    return (
                      <div key={p.id} className="p-4 space-y-2.5">
                        <div className="flex items-start justify-between gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              setSelectedParticipantId(p.participant.id)
                            }
                            className="text-left cursor-pointer"
                          >
                            <p className="text-sm font-bold text-[#001558] hover:underline">
                              {p.participant.firstName} {p.participant.lastName}
                            </p>
                            <p className="text-[11px] text-slate-500 font-mono">
                              {p.participant.rut}
                              {p.participant.cupoCode
                                ? ` • ${p.participant.cupoCode}`
                                : ''}
                            </p>
                          </button>

                          <span
                            className={`text-sm font-black whitespace-nowrap ${
                              isNegative ? 'text-red-600' : 'text-[#001558]'
                            }`}
                          >
                            {formatCurrency(p.amount, effectiveCurrency)}
                          </span>
                        </div>

                        <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                          <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-semibold">
                            {new Date(p.paymentDate).toLocaleDateString(
                              'es-CL'
                            )}
                          </span>
                          <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-semibold">
                            {p.paymentMethod}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded border font-bold ${sourceBadge.className}`}
                          >
                            {sourceBadge.label}
                          </span>
                          {refText && (
                            <span
                              title={refText}
                              className="px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-mono"
                            >
                              {truncateId(refText, 14)}
                            </span>
                          )}
                        </div>

                        {(p.notes || p.registeredBy?.name) && (
                          <div className="text-xs text-slate-600 space-y-0.5">
                            {p.notes && <p>{p.notes}</p>}
                            {p.registeredBy?.name && (
                              <p className="text-[11px] text-slate-500">
                                Registrado por: {p.registeredBy.name}
                              </p>
                            )}
                          </div>
                        )}

                        {p.receiptUrl && (
                          <div className="pt-1">
                            <a
                              href={p.receiptUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#EEF2FF] text-[#001558] border border-[#001558]/20 text-xs font-bold"
                            >
                              <span>Ver Comprobante</span>
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </>
            )}

            {/* Pagination Footer */}
            <div className="px-4 py-3 bg-[#F5F6F8] border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs">
              <span className="text-slate-600 font-semibold">
                Página {page} de {totalPages} •{' '}
                {totalCount.toLocaleString('es-CL')} resultados
              </span>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={page <= 1 || loadingLedger}
                  onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white border border-slate-300 text-slate-700 font-bold hover:bg-slate-50 disabled:opacity-45 cursor-pointer"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  <span>Anterior</span>
                </button>
                <button
                  type="button"
                  disabled={page >= totalPages || loadingLedger}
                  onClick={() =>
                    setPage((prev) => Math.min(totalPages, prev + 1))
                  }
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white border border-slate-300 text-slate-700 font-bold hover:bg-slate-50 disabled:opacity-45 cursor-pointer"
                >
                  <span>Siguiente</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: PLANES Y CALENDARIO DE CUOTAS */}
      {activeTab === 'plans' && (
        <div className="space-y-5">
          {plansError && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-2xl p-4 text-xs font-semibold">
              {plansError}
            </div>
          )}

          {loadingPlans ? (
            <div className="bg-white border border-slate-200 rounded-2xl p-12 flex items-center justify-center gap-2 text-xs font-semibold text-slate-500">
              <Loader2 className="w-5 h-5 animate-spin text-[#001558]" />
              <span>Cargando planes y calendario de cuotas...</span>
            </div>
          ) : plans.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center space-y-2 text-slate-500">
              <Layers className="w-9 h-9 mx-auto text-slate-300" />
              <p className="text-sm font-bold text-[#001558]">
                No hay planes de pago configurados para este evento
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {plans.map((plan) => {
                const planCurrency = plan.currency || currency;
                const participantCount = plan._count?.participants ?? 0;
                const installments = plan.installments || [];

                return (
                  <div
                    key={plan.id}
                    className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden flex flex-col"
                  >
                    {/* Plan Header */}
                    <div className="p-5 bg-[#FFFBF0] border-b border-slate-200 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="text-base font-black text-[#001558]">
                            {plan.name}
                          </h2>
                          <span className="px-2 py-0.5 rounded-md bg-[#EEF2FF] text-[#001558] border border-[#001558]/20 text-[10px] font-extrabold uppercase tracking-wider">
                            {plan.roleKey}
                          </span>
                        </div>
                        {plan.description && (
                          <p className="text-xs text-slate-600">
                            {plan.description}
                          </p>
                        )}
                      </div>

                      <div className="sm:text-right shrink-0">
                        <p className="text-lg font-black text-[#001558]">
                          {formatCurrency(plan.totalAmount, planCurrency)}
                        </p>
                        <p className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-600">
                          <Users className="w-3.5 h-3.5 text-[#FEB135]" />
                          <span>
                            {participantCount.toLocaleString('es-CL')}{' '}
                            participantes
                          </span>
                        </p>
                      </div>
                    </div>

                    {/* Installments Table */}
                    <div className="p-4 flex-1">
                      {installments.length === 0 ? (
                        <p className="text-xs text-slate-500 py-4 text-center">
                          Este plan no tiene cuotas definidas.
                        </p>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full text-left border-collapse text-xs">
                            <thead>
                              <tr className="border-b border-slate-200 text-[11px] font-extrabold text-slate-500 uppercase tracking-wider">
                                <th className="py-2 pr-3">Cuota</th>
                                <th className="py-2 pr-3">Título</th>
                                <th className="py-2 pr-3">Vencimiento</th>
                                <th className="py-2 pr-3 text-right">Monto</th>
                                <th className="py-2 text-right">Estado</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {installments.map((inst) => {
                                const badge = getInstallmentRelativeBadge(
                                  inst.dueDate,
                                  referenceNowMs
                                );
                                return (
                                  <tr key={inst.id}>
                                    <td className="py-2.5 pr-3 font-mono font-bold text-[#001558]">
                                      #{inst.installmentNumber}
                                    </td>
                                    <td className="py-2.5 pr-3 font-semibold text-slate-800">
                                      {inst.title}
                                    </td>
                                    <td className="py-2.5 pr-3 whitespace-nowrap text-slate-600">
                                      {new Date(
                                        inst.dueDate
                                      ).toLocaleDateString('es-CL')}
                                    </td>
                                    <td className="py-2.5 pr-3 text-right whitespace-nowrap font-bold text-[#001558]">
                                      {formatCurrency(
                                        inst.amount,
                                        planCurrency
                                      )}
                                    </td>
                                    <td className="py-2.5 text-right whitespace-nowrap">
                                      <span
                                        className={`inline-flex items-center px-2 py-0.5 rounded-md border text-[10px] font-bold ${badge.className}`}
                                      >
                                        {badge.label}
                                      </span>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Participant Detail Modal */}
      {selectedParticipantId && (
        <ParticipantDetailModal
          participantId={selectedParticipantId}
          currency={effectiveCurrency}
          permissions={permissions}
          initialTab="finance"
          onClose={() => setSelectedParticipantId(null)}
          onParticipantUpdated={handleReload}
        />
      )}
    </div>
  );
}

export default function FinanzasPage() {
  return (
    <AppShell>
      <FinanzasWorkspace />
    </AppShell>
  );
}
