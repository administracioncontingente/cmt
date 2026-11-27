'use client';

import React, { useState, useEffect, useCallback, useId } from 'react';
import {
  X,
  CreditCard,
  User,
  Calendar,
  Clock,
  PlusCircle,
  Trash2,
  Phone,
  Mail,
  Shield,
  Loader2,
  ExternalLink,
  Tent,
  Award,
  Heart,
  Share2,
  Droplet,
  Pill,
  AlertTriangle,
  FileText,
  Ticket,
  Pencil,
  ChevronDown,
  ChevronUp,
  Layers,
} from 'lucide-react';
import { formatCurrency, FinancialSummary } from '@/lib/finance';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useToast } from '@/components/ui/ToastProvider';
import type {
  DetailTab,
  ParticipantDTO,
  PaymentDTO,
  EmailMessageDTO,
  IncidentDTO,
  EventPermissions,
} from '@/types/domain';

export interface ParticipantDetailModalProps {
  participantId: string;
  currency?: string;
  permissions?: EventPermissions | null;
  initialTab?: DetailTab;
  onClose: () => void;
  onParticipantUpdated: () => void;
  onEditParticipant?: (participant: ParticipantDTO) => void;
}

function getPaymentSourceMeta(source?: string | null): {
  label: string;
  className: string;
} {
  switch (source) {
    case 'FILLOUT_MAIN':
      return {
        label: 'Fillout Principal',
        className: 'bg-indigo-50 text-indigo-800 border-indigo-200',
      };
    case 'FILLOUT_SUBFORM':
      return {
        label: 'Fillout Grupal',
        className: 'bg-purple-50 text-purple-800 border-purple-200',
      };
    case 'CSV_SHEET':
      return {
        label: 'Planilla / Sheet',
        className: 'bg-sky-50 text-sky-800 border-sky-200',
      };
    case 'MANUAL':
    default:
      return {
        label: 'Registro Manual',
        className: 'bg-slate-100 text-slate-700 border-slate-200',
      };
  }
}

function getInstallmentStatusBadge(
  status: 'PAGADA' | 'PARCIAL' | 'VENCIDA' | 'PENDIENTE'
): string {
  switch (status) {
    case 'PAGADA':
      return 'bg-emerald-50 text-emerald-800 border-emerald-200';
    case 'PARCIAL':
      return 'bg-[#FFF8E1] text-[#001558] border-[#FEB135]';
    case 'VENCIDA':
      return 'bg-red-50 text-red-700 border-red-200';
    case 'PENDIENTE':
    default:
      return 'bg-slate-100 text-slate-600 border-slate-200';
  }
}

export function ParticipantDetailModal({
  participantId,
  currency = 'USD',
  permissions,
  initialTab,
  onClose,
  onParticipantUpdated,
  onEditParticipant,
}: ParticipantDetailModalProps) {
  const { toast } = useToast();
  const titleId = useId();

  const [activeTab, setActiveTab] = useState<DetailTab>(initialTab ?? 'finance');
  const [medLang, setMedLang] = useState<'es' | 'en' | 'pl'>('es');
  const [copiedLink, setCopiedLink] = useState(false);
  const [data, setData] = useState<ParticipantDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCalendarPreview, setShowCalendarPreview] = useState(false);
  const [showInstallments, setShowInstallments] = useState(true);

  // Form states for new payment
  const [submittingPayment, setSubmittingPayment] = useState(false);
  const [amount, setAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [paymentMethod, setPaymentMethod] = useState('TRANSFERENCIA');
  const [transactionReference, setTransactionReference] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [deletingPaymentId, setDeletingPaymentId] = useState<string | null>(null);
  const [paymentToDeleteId, setPaymentToDeleteId] = useState<string | null>(null);

  const canManageFinance = !permissions || permissions.canManageFinance;
  const isBusy = submittingPayment || deletingPaymentId !== null;
  const isConfirmOpen = paymentToDeleteId !== null;

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isBusy && !isConfirmOpen) {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isBusy, isConfirmOpen, onClose]);

  const loadDetail = useCallback(async (id: string, signal?: AbortSignal) => {
    const res = await fetch(`/api/participants/${id}`, { signal });
    if (!res.ok) {
      throw new Error('Error al cargar datos del participante');
    }
    const json = (await res.json()) as { participant: ParticipantDTO };
    return json.participant;
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;

    const run = async () => {
      await Promise.resolve();
      if (cancelled) return;
      setLoading(true);
      setError(null);
      try {
        const participant = await loadDetail(participantId, controller.signal);
        if (!cancelled) {
          setData(participant);
        }
      } catch (err: unknown) {
        if (!cancelled && !(err instanceof DOMException && err.name === 'AbortError')) {
          setError(err instanceof Error ? err.message : 'Error inesperado');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void run();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [participantId, loadDetail]);

  const handleRegisterPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setPaymentError(null);

    const numAmount = parseFloat(amount);
    if (Number.isNaN(numAmount) || numAmount <= 0) {
      setPaymentError(`Por favor ingresa un monto válido mayor a 0 ${currency}`);
      return;
    }

    try {
      setSubmittingPayment(true);
      const res = await fetch(`/api/participants/${participantId}/payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: numAmount,
          paymentDate,
          paymentMethod,
          transactionReference,
          notes: paymentNotes,
        }),
      });

      const resData = (await res.json()) as { participant?: ParticipantDTO; error?: string };
      if (!res.ok || !resData.participant) {
        throw new Error(resData.error || 'Error al registrar el abono');
      }

      setAmount('');
      setTransactionReference('');
      setPaymentNotes('');
      setData(resData.participant);
      onParticipantUpdated();
      toast.success('Abono registrado correctamente');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al procesar el abono';
      setPaymentError(msg);
      toast.error(msg);
    } finally {
      setSubmittingPayment(false);
    }
  };

  const handleDeletePayment = (paymentId: string) => {
    setPaymentToDeleteId(paymentId);
  };

  const confirmDeletePayment = async () => {
    if (!paymentToDeleteId) return;
    const targetId = paymentToDeleteId;

    try {
      setDeletingPaymentId(targetId);
      const res = await fetch(
        `/api/participants/${participantId}/payments?paymentId=${targetId}`,
        { method: 'DELETE' }
      );
      const resData = (await res.json()) as { participant?: ParticipantDTO; error?: string };
      if (!res.ok || !resData.participant) {
        throw new Error(resData.error || 'Error al anular abono');
      }
      setData(resData.participant);
      setPaymentToDeleteId(null);
      onParticipantUpdated();
      toast.success('Abono anulado correctamente');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Error al anular el abono');
    } finally {
      setDeletingPaymentId(null);
    }
  };

  if (loading) {
    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-[#001558]/40 backdrop-blur-xs p-4"
        onClick={(e) => {
          if (e.target === e.currentTarget) {
            onClose();
          }
        }}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Cargando ficha del participante"
          className="bg-white border border-slate-200 rounded-2xl p-8 max-w-md w-full text-center shadow-2xl"
        >
          <Loader2 className="w-8 h-8 text-[#001558] animate-spin mx-auto mb-3" />
          <p className="text-[#001558] text-sm font-bold">Cargando ficha oficial del participante...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-[#001558]/40 backdrop-blur-xs p-4"
        onClick={(e) => {
          if (e.target === e.currentTarget) {
            onClose();
          }
        }}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Error al cargar participante"
          className="bg-white border border-slate-200 rounded-2xl p-6 max-w-md w-full text-center shadow-2xl space-y-4"
        >
          <div className="w-11 h-11 rounded-xl bg-red-50 border border-red-200 text-red-600 flex items-center justify-center mx-auto">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <p className="text-red-700 text-sm font-semibold">{error || 'No se encontró el participante'}</p>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-[#001558] hover:bg-[#0b2370] text-white rounded-xl text-xs font-bold cursor-pointer transition-colors"
          >
            Cerrar
          </button>
        </div>
      </div>
    );
  }

  const fin: FinancialSummary = data.financial ?? {
    totalRequired: data.targetFeeUSD ?? 3600,
    totalPaid: data.totalPaidSheet || 0,
    balanceRemaining: data.debtFinalUSD || 0,
    isFullyPaid: false,
    dueToDate: data.dueToDateUSD || 0,
    overdueAmount: data.debtToDateUSD || 0,
    isOverdue: (data.debtToDateUSD || 0) > 0,
    overdueCount: 0,
    health: 'AL_DIA',
    breakdown: [],
  };
  const targetFee =
    data.targetFeeUSD !== null && data.targetFeeUSD !== undefined
      ? data.targetFeeUSD
      : fin.totalRequired;
  const remainingFee = Math.max(0, targetFee - fin.totalPaid);

  const getFinancialBadgeClass = (status?: string | null) => {
    if (status === 'Total Pagado') {
      return 'bg-[#FFF8E1] text-[#001558] border-[#FEB135]';
    }
    if (status === 'Adeuda') {
      return 'bg-red-50 text-red-700 border-red-200';
    }
    if (status === 'BAJA') {
      return 'bg-slate-100 text-slate-600 border-slate-200';
    }
    return 'bg-emerald-50 text-emerald-800 border-emerald-200';
  };

  const getIncidentStatusBadge = (status: string) => {
    if (status === 'ABIERTA') {
      return 'bg-amber-50 text-amber-800 border-amber-200';
    }
    if (status === 'EN_PROCESO') {
      return 'bg-[#EEF2FF] text-[#001558] border-[#001558]/20';
    }
    if (status === 'RESUELTA') {
      return 'bg-emerald-50 text-emerald-800 border-emerald-200';
    }
    return 'bg-slate-100 text-slate-600 border-slate-200';
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#001558]/40 backdrop-blur-xs p-3 sm:p-6 overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isBusy && !isConfirmOpen) {
          onClose();
        }
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="bg-white border border-slate-200 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200"
      >
        {/* Header */}
        <div className="px-6 py-4 bg-[#001558] border-b-4 border-b-[#FEB135] flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-11 h-11 rounded-xl bg-[#FEB135] text-[#001558] flex items-center justify-center font-black text-lg shadow-sm shrink-0">
              {data.firstName?.[0] || ''}
              {data.lastName?.[0] || ''}
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 id={titleId} className="text-lg font-black text-white tracking-tight truncate">
                  {data.firstName} {data.lastName} {data.secondLastName || ''}
                </h2>
                {data.cupoCode && (
                  <span className="font-mono text-xs px-2 py-0.5 rounded bg-[#FEB135] text-[#001558] font-bold">
                    Cupo: {data.cupoCode}
                  </span>
                )}
                <span className="font-mono text-xs px-2 py-0.5 rounded bg-white/10 text-white border border-white/20">
                  {data.rut}
                </span>
                {data.contingentRole && (
                  <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-white/15 text-white border border-white/25">
                    {data.contingentRole}
                  </span>
                )}
                {data.financialStatusSheet && (
                  <span
                    className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${getFinancialBadgeClass(
                      data.financialStatusSheet
                    )}`}
                  >
                    {data.financialStatusSheet}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-200 mt-0.5 truncate">
                {data.scoutGroup ? `${data.scoutGroup} • ` : ''}
                {data.scoutDistrict ? `Distrito ${data.scoutDistrict} • ` : ''}
                {data.scoutZone ? `Zona ${data.scoutZone}` : ''}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {permissions?.canEditParticipants && onEditParticipant && (
              <button
                type="button"
                onClick={() => onEditParticipant(data)}
                className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white border border-white/20 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Pencil className="w-3.5 h-3.5 text-[#FEB135]" />
                <span>Editar Ficha</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-slate-200 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              aria-label="Cerrar modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tab navigation (scrollable horizontally) */}
        <div className="flex border-b border-slate-200 px-4 sm:px-6 bg-[#F5F6F8] overflow-x-auto whitespace-nowrap">
          <button
            onClick={() => setActiveTab('finance')}
            className={`py-3 px-4 text-xs font-bold flex items-center gap-2 border-b-2 transition-colors cursor-pointer shrink-0 ${
              activeTab === 'finance'
                ? 'border-[#001558] text-[#001558] bg-white'
                : 'border-transparent text-slate-600 hover:text-[#001558]'
            }`}
          >
            <CreditCard className="w-4 h-4" />
            Finanzas y Abonos ({formatCurrency(fin.totalPaid, currency)} / {formatCurrency(targetFee, currency)})
          </button>

          <button
            onClick={() => setActiveTab('profile')}
            className={`py-3 px-4 text-xs font-bold flex items-center gap-2 border-b-2 transition-colors cursor-pointer shrink-0 ${
              activeTab === 'profile'
                ? 'border-[#001558] text-[#001558] bg-white'
                : 'border-transparent text-slate-600 hover:text-[#001558]'
            }`}
          >
            <User className="w-4 h-4" />
            Ficha Personal y Apoderado
          </button>

          <button
            onClick={() => setActiveTab('logistics')}
            className={`py-3 px-4 text-xs font-bold flex items-center gap-2 border-b-2 transition-colors cursor-pointer shrink-0 ${
              activeTab === 'logistics'
                ? 'border-[#001558] text-[#001558] bg-white'
                : 'border-transparent text-slate-600 hover:text-[#001558]'
            }`}
          >
            <Tent className="w-4 h-4" />
            Logística & Asignación
          </button>

          <button
            onClick={() => setActiveTab('medical')}
            className={`py-3 px-4 text-xs font-bold flex items-center gap-2 border-b-2 transition-colors cursor-pointer shrink-0 ${
              activeTab === 'medical'
                ? 'border-[#001558] text-[#001558] bg-white'
                : 'border-transparent text-slate-600 hover:text-[#001558]'
            }`}
          >
            <Heart className="w-4 h-4 text-red-600" />
            Ficha Médica WSJ
            {data.medicalRecord?.completionStatus === 'COMPLETED' ? (
              <span className="w-2 h-2 rounded-full bg-emerald-500" title="Ficha completada" />
            ) : (
              <span className="w-2 h-2 rounded-full bg-amber-500" title="Ficha pendiente" />
            )}
          </button>

          <button
            onClick={() => setActiveTab('communications')}
            className={`py-3 px-4 text-xs font-bold flex items-center gap-2 border-b-2 transition-colors cursor-pointer shrink-0 ${
              activeTab === 'communications'
                ? 'border-[#001558] text-[#001558] bg-white'
                : 'border-transparent text-slate-600 hover:text-[#001558]'
            }`}
          >
            <Mail className="w-4 h-4 text-[#001558]" />
            Correos & Inbox ({data.emailMessages?.length || 0})
          </button>

          <button
            onClick={() => setActiveTab('incidents')}
            className={`py-3 px-4 text-xs font-bold flex items-center gap-2 border-b-2 transition-colors cursor-pointer shrink-0 ${
              activeTab === 'incidents'
                ? 'border-[#001558] text-[#001558] bg-white'
                : 'border-transparent text-slate-600 hover:text-[#001558]'
            }`}
          >
            <Ticket className="w-4 h-4 text-purple-700" />
            Incidencias CRM ({data.incidents?.length || 0})
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-xs bg-[#F5F6F8]">
          {/* TAB 1: FINANZAS */}
          {activeTab === 'finance' && (
            <>
              {/* Summary Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    Cuota Oficial Final
                  </span>
                  <p className="text-xl font-black text-[#001558] mt-1">
                    {formatCurrency(targetFee, currency)}
                  </p>
                  <p className="text-[10px] text-slate-500 mt-0.5">
                    {data.feeType || 'Cuota asignada'}
                  </p>
                </div>

                <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    Total Abonado Real
                  </span>
                  <p className="text-xl font-black text-emerald-700 mt-1">
                    {formatCurrency(fin.totalPaid, currency)}
                  </p>
                  <p className="text-[10px] text-slate-500 mt-0.5">
                    {targetFee > 0
                      ? `${Math.round((fin.totalPaid / targetFee) * 100)}% de la meta`
                      : data.status === 'RETIRADO'
                        ? 'Participante dado de baja'
                        : '100% (Exento / Becado)'}
                  </p>
                </div>

                <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    Saldo Restante
                  </span>
                  <p className="text-xl font-black text-slate-800 mt-1">
                    {formatCurrency(remainingFee, currency)}
                  </p>
                  <p className="text-[10px] text-slate-500 mt-0.5">Por recaudar</p>
                </div>

                <div
                  className={`p-3.5 rounded-xl border shadow-xs ${
                    data.financialStatusSheet === 'Adeuda' || fin.isOverdue
                      ? 'bg-red-50 border-red-200 border-l-4 border-l-red-500'
                      : 'bg-white border-slate-200'
                  }`}
                >
                  <span className="text-[11px] font-bold uppercase text-slate-500 tracking-wider">
                    Situación en Planilla
                  </span>
                  <div className="flex items-center gap-1.5 mt-1">
                    <span
                      className={`text-base font-black ${
                        data.financialStatusSheet === 'Adeuda' || fin.isOverdue
                          ? 'text-red-700'
                          : 'text-[#001558]'
                      }`}
                    >
                      {data.financialStatusSheet || (fin.isFullyPaid ? 'Total Pagado' : 'Al Día')}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-600 mt-0.5">
                    {data.debtToDateUSD && data.debtToDateUSD > 0
                      ? `Deuda a fecha: ${formatCurrency(data.debtToDateUSD, currency)}`
                      : 'Sin deudas vencidas'}
                  </p>
                </div>
              </div>

              {/* Fee Information & Calendar */}
              {(data.feeType || data.calendarUrl || (data.overpaymentUSD ?? 0) > 0) && (
                <div className="space-y-3">
                  <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
                    <div>
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                        Modalidad de Inscripción
                      </span>
                      <p className="text-[#001558] font-bold text-sm">
                        {data.feeEnrollmentType || data.feeType || 'Estándar'}
                      </p>
                      {(data.overpaymentUSD ?? 0) > 0 && (
                        <p className="mt-1 inline-block px-2.5 py-0.5 rounded bg-[#FFFBF0] border border-[#FEB135]/40 text-[#001558] text-xs font-bold">
                          Sobrepago registrado: {formatCurrency(data.overpaymentUSD || 0, currency)}
                        </p>
                      )}
                    </div>
                    {data.calendarUrl && (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setShowCalendarPreview(!showCalendarPreview)}
                          className="px-3.5 py-1.5 bg-[#FEB135] hover:bg-[#e59c22] text-[#001558] rounded-lg text-xs font-black flex items-center gap-1.5 shadow-xs cursor-pointer transition-colors"
                        >
                          <Calendar className="w-3.5 h-3.5" />
                          {showCalendarPreview ? 'Ocultar Calendario' : 'Ver Calendario Oficial'}
                        </button>
                        <a
                          href={data.calendarUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1.5 bg-white hover:bg-slate-100 text-[#001558] rounded-lg border border-slate-200 transition-colors"
                          title="Abrir imagen local en pestaña nueva"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      </div>
                    )}
                  </div>

                  {showCalendarPreview && data.calendarUrl && (
                    <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs animate-in fade-in zoom-in-95 duration-150">
                      <div className="flex justify-between items-center mb-3 pb-2 border-b border-slate-200">
                        <span className="text-xs font-bold text-[#001558] flex items-center gap-1.5">
                          <Calendar className="w-4 h-4 text-[#FEB135]" />
                          Calendario Oficial de Cuotas ({data.feeEnrollmentType || data.feeType || 'Participante'})
                        </span>
                        <div className="flex items-center gap-2">
                          <a
                            href={data.calendarUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[11px] text-[#001558] font-bold hover:underline flex items-center gap-1 mr-2"
                          >
                            <ExternalLink className="w-3 h-3" />
                            Pantalla completa
                          </a>
                          <button
                            type="button"
                            onClick={() => setShowCalendarPreview(false)}
                            className="text-slate-600 hover:text-[#001558] text-xs px-2 py-0.5 rounded bg-slate-100 cursor-pointer font-semibold"
                          >
                            Cerrar ✕
                          </button>
                        </div>
                      </div>
                      <div className="flex justify-center p-2 bg-[#F5F6F8] rounded-lg border border-slate-200">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={data.calendarUrl}
                          alt="Calendario de Cuotas Oficial"
                          className="max-h-96 w-auto rounded object-contain shadow-sm"
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Plan de Cuotas e Imputación */}
              {fin.breakdown.length > 0 && (
                <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setShowInstallments((prev) => !prev)}
                    className="w-full px-4 py-3 bg-[#F5F6F8] border-b border-slate-200 flex items-center justify-between gap-2 text-left cursor-pointer hover:bg-slate-100/70 transition-colors"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <Layers className="w-4 h-4 text-[#FEB135]" />
                      <h3 className="text-xs font-bold text-[#001558] uppercase tracking-wider">
                        Plan de Cuotas e Imputación ({fin.breakdown.length})
                      </h3>
                      {fin.overdueCount > 0 && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-50 text-red-700 border border-red-200">
                          {fin.overdueCount} vencida{fin.overdueCount > 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                    <span className="text-slate-500 flex items-center gap-1 text-[11px] font-semibold">
                      {showInstallments ? (
                        <>
                          Ocultar
                          <ChevronUp className="w-4 h-4" />
                        </>
                      ) : (
                        <>
                          Ver detalle
                          <ChevronDown className="w-4 h-4" />
                        </>
                      )}
                    </span>
                  </button>

                  {showInstallments && (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                            <th className="py-2.5 px-3">Cuota</th>
                            <th className="py-2.5 px-3">Vencimiento</th>
                            <th className="py-2.5 px-3 text-right">Monto</th>
                            <th className="py-2.5 px-3 text-right">Cubierto</th>
                            <th className="py-2.5 px-3 text-right">Pendiente</th>
                            <th className="py-2.5 px-3 text-center">Estado</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-xs">
                          {fin.breakdown.map((inst) => (
                            <tr key={inst.id} className="hover:bg-[#FFFBF0]/40 transition-colors">
                              <td className="py-2.5 px-3">
                                <span className="font-mono font-bold text-[#001558] mr-1.5">
                                  #{inst.installmentNumber}
                                </span>
                                <span className="font-semibold text-slate-800">{inst.title}</span>
                              </td>
                              <td className="py-2.5 px-3 text-slate-600 whitespace-nowrap">
                                {new Date(inst.dueDate).toLocaleDateString('es-CL', {
                                  year: 'numeric',
                                  month: 'short',
                                  day: '2-digit',
                                })}
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono font-semibold text-slate-700 whitespace-nowrap">
                                {formatCurrency(inst.amount, currency)}
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-700 whitespace-nowrap">
                                {formatCurrency(inst.coveredAmount, currency)}
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-800 whitespace-nowrap">
                                {formatCurrency(inst.remainingAmount, currency)}
                              </td>
                              <td className="py-2.5 px-3 text-center whitespace-nowrap">
                                <span
                                  className={`inline-block text-[10px] font-extrabold px-2 py-0.5 rounded-full border ${getInstallmentStatusBadge(
                                    inst.status
                                  )}`}
                                >
                                  {inst.status}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* Form to Register New Payment (hidden when !canManageFinance) */}
              {canManageFinance && (
                <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
                  <h3 className="text-xs font-bold text-[#001558] uppercase tracking-wider mb-3 flex items-center gap-2">
                    <PlusCircle className="w-4 h-4 text-[#FEB135]" />
                    Registrar Nuevo Abono / Pago Bancario
                  </h3>

                  {paymentError && (
                    <div className="mb-3 p-2.5 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs font-medium">
                      {paymentError}
                    </div>
                  )}

                  <form onSubmit={handleRegisterPayment} className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        Monto Abono ({currency})*
                      </label>
                      <div className="relative">
                        <span className="absolute inset-y-0 left-0 pl-2.5 flex items-center text-slate-400 font-bold">
                          $
                        </span>
                        <input
                          type="number"
                          step="0.01"
                          required
                          value={amount}
                          onChange={(e) => setAmount(e.target.value)}
                          placeholder="150.00"
                          className="w-full pl-6 pr-2 py-2 bg-white border border-slate-300 rounded-lg text-slate-800 placeholder-slate-400 font-mono text-xs focus:border-[#001558] focus:ring-2 focus:ring-[#FEB135]/50 focus:outline-none"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        Fecha del Pago*
                      </label>
                      <input
                        type="date"
                        required
                        value={paymentDate}
                        onChange={(e) => setPaymentDate(e.target.value)}
                        className="w-full px-2.5 py-2 bg-white border border-slate-300 rounded-lg text-slate-800 text-xs focus:border-[#001558] focus:ring-2 focus:ring-[#FEB135]/50 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        Método de Pago
                      </label>
                      <select
                        value={paymentMethod}
                        onChange={(e) => setPaymentMethod(e.target.value)}
                        className="w-full px-2.5 py-2 bg-white border border-slate-300 rounded-lg text-slate-800 text-xs focus:border-[#001558] focus:ring-2 focus:ring-[#FEB135]/50 focus:outline-none font-medium"
                      >
                        <option value="TRANSFERENCIA">Transferencia Bancaria</option>
                        <option value="TARJETA">Tarjeta / Webpay</option>
                        <option value="DEPOSITO">Depósito</option>
                        <option value="EFECTIVO">Efectivo</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        N° Operación / Transf.
                      </label>
                      <input
                        type="text"
                        value={transactionReference}
                        onChange={(e) => setTransactionReference(e.target.value)}
                        placeholder="Ej: 546936"
                        className="w-full px-2.5 py-2 bg-white border border-slate-300 rounded-lg text-slate-800 placeholder-slate-400 text-xs focus:border-[#001558] focus:ring-2 focus:ring-[#FEB135]/50 focus:outline-none"
                      />
                    </div>

                    <div className="sm:col-span-3">
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        Notas / Observaciones
                      </label>
                      <input
                        type="text"
                        value={paymentNotes}
                        onChange={(e) => setPaymentNotes(e.target.value)}
                        placeholder="Observaciones de comprobante bancario"
                        className="w-full px-2.5 py-2 bg-white border border-slate-300 rounded-lg text-slate-800 placeholder-slate-400 text-xs focus:border-[#001558] focus:ring-2 focus:ring-[#FEB135]/50 focus:outline-none"
                      />
                    </div>

                    <div className="flex items-end">
                      <button
                        type="submit"
                        disabled={submittingPayment}
                        className="w-full py-2 px-4 rounded-lg bg-[#001558] hover:bg-[#0b2370] text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-colors shadow-xs disabled:opacity-50 cursor-pointer uppercase tracking-wider"
                      >
                        {submittingPayment ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            Guardando...
                          </>
                        ) : (
                          <>
                            <PlusCircle className="w-3.5 h-3.5" />
                            Ingresar Abono
                          </>
                        )}
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* Payments History List */}
              <div>
                <h3 className="text-xs font-bold text-[#001558] uppercase tracking-wider mb-2 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-[#FEB135]" />
                  Historial de Abonos Registrados ({data.payments?.length || 0})
                </h3>

                {!data.payments || data.payments.length === 0 ? (
                  <div className="bg-white rounded-xl p-4 text-center border border-slate-200 text-xs text-slate-500">
                    No se han registrado abonos para este participante aún.
                  </div>
                ) : (
                  <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                    {data.payments.map((p: PaymentDTO) => {
                      const isNegative = p.amount < 0;
                      const sourceMeta = getPaymentSourceMeta(p.source);
                      return (
                        <div
                          key={p.id}
                          className="bg-white border border-slate-200 rounded-xl p-3 flex items-center justify-between hover:border-[#FEB135] transition-colors shadow-2xs"
                        >
                          <div className="flex items-center gap-3">
                            <div
                              className={`w-8 h-8 rounded-lg flex items-center justify-center font-black text-xs border ${
                                isNegative
                                  ? 'bg-red-50 border-red-200 text-red-700'
                                  : 'bg-[#FFF8E1] border-[#FEB135] text-[#001558]'
                              }`}
                            >
                              {isNegative ? '-' : '$'}
                            </div>
                            <div>
                              <div className="flex flex-wrap items-center gap-2">
                                <span
                                  className={`font-black text-sm font-mono ${
                                    isNegative ? 'text-red-700' : 'text-[#001558]'
                                  }`}
                                >
                                  {isNegative ? formatCurrency(p.amount, currency) : `+${formatCurrency(p.amount, currency)}`}
                                </span>
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#EEF2FF] text-[#001558] font-semibold border border-[#001558]/20">
                                  {p.paymentMethod}
                                </span>
                                <span
                                  className={`text-[10px] px-1.5 py-0.5 rounded font-semibold border ${sourceMeta.className}`}
                                  title={`Origen: ${sourceMeta.label}`}
                                >
                                  {sourceMeta.label}
                                </span>
                                {p.transactionReference && (
                                  <span className="text-[10px] font-mono text-[#001558] bg-[#FFFBF0] px-1.5 py-0.5 rounded border border-[#FEB135]/40">
                                    Doc: {p.transactionReference}
                                  </span>
                                )}
                              </div>
                              <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500 mt-0.5">
                                <span>
                                  {new Date(p.paymentDate).toLocaleDateString('es-CL', {
                                    year: 'numeric',
                                    month: 'short',
                                    day: 'numeric',
                                  })}
                                </span>
                                {p.notes && <span>• {p.notes}</span>}
                                {p.receiptUrl && (
                                  <a
                                    href={p.receiptUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 text-[#001558] hover:underline font-bold"
                                  >
                                    <ExternalLink className="w-3 h-3" />
                                    Ver Comprobante
                                  </a>
                                )}
                                {p.filloutSubmissionId && (
                                  <span
                                    title={`ID de envío Fillout: ${p.filloutSubmissionId}`}
                                    className="text-[10px] font-mono text-slate-500 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-200"
                                  >
                                    Fillout ID: {p.filloutSubmissionId.slice(0, 8)}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          {canManageFinance && (
                            <button
                              type="button"
                              onClick={() => handleDeletePayment(p.id)}
                              disabled={deletingPaymentId === p.id}
                              title="Anular abono"
                              className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                            >
                              {deletingPaymentId === p.id ? (
                                <Loader2 className="w-4 h-4 animate-spin text-red-600" />
                              ) : (
                                <Trash2 className="w-4 h-4" />
                              )}
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}

          {/* TAB 2: PERFIL PERSONAL */}
          {activeTab === 'profile' && (
            <div className="space-y-4">
              {/* Personal Data */}
              <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
                <h3 className="text-xs font-bold text-[#001558] uppercase tracking-wider mb-3 pb-2 border-b border-slate-200 flex items-center gap-2">
                  <User className="w-4 h-4 text-[#FEB135]" />
                  Datos Personales
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <span className="text-slate-500 block text-[11px]">RUT</span>
                    <span className="font-mono text-[#001558] font-bold">{data.rut}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[11px]">Nombres y Apellidos</span>
                    <span className="text-[#001558] font-bold">
                      {data.firstName} {data.lastName} {data.secondLastName || ''}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[11px]">Correo Electrónico</span>
                    <span className="text-slate-700 flex items-center gap-1 font-medium">
                      <Mail className="w-3 h-3 text-slate-400" /> {data.email || 'No registrado'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[11px]">Teléfono / WhatsApp</span>
                    <span className="text-slate-700 flex items-center gap-1 font-medium">
                      <Phone className="w-3 h-3 text-slate-400" /> {data.phone || 'No registrado'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[11px]">Fecha de Nacimiento</span>
                    <span className="text-slate-700 font-medium">
                      {data.birthDate
                        ? new Date(data.birthDate).toLocaleDateString('es-CL')
                        : 'No registrada'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[11px]">Género</span>
                    <span className="text-slate-700 font-medium">{data.gender || 'No registrado'}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[11px]">Dirección</span>
                    <span className="text-slate-700 font-medium">{data.address || 'No registrada'}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[11px]">Comuna / Ciudad</span>
                    <span className="text-slate-700 font-medium">
                      {data.commune ? data.commune : 'No registrada'}
                      {data.city ? ` - ${data.city}` : ''}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[11px]">Nacionalidad</span>
                    <span className="text-slate-700 font-medium">{data.nationality || 'Chilena'}</span>
                  </div>
                </div>

                {data.idCardUrl && (
                  <div className="mt-3 pt-3 border-t border-slate-200 flex items-center justify-between">
                    <span className="text-slate-600 font-medium">Cédula de Identidad en Google Drive:</span>
                    <a
                      href={data.idCardUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-1.5 bg-[#001558] hover:bg-[#0b2370] text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors"
                    >
                      <ExternalLink className="w-3 h-3" />
                      Ver Cédula Digital
                    </a>
                  </div>
                )}
              </div>

              {/* Guardian Info */}
              <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
                <h3 className="text-xs font-bold text-[#001558] uppercase tracking-wider mb-3 pb-2 border-b border-slate-200 flex items-center gap-2">
                  <Phone className="w-4 h-4 text-[#FEB135]" />
                  Apoderado / Contacto de Emergencia
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <span className="text-slate-500 block text-[11px]">Nombre del Apoderado</span>
                    <span className="text-[#001558] font-bold">
                      {data.guardianName || 'No registrado'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[11px]">Teléfono Apoderado</span>
                    <span className="text-slate-700 font-medium">
                      {data.guardianPhone || 'No registrado'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[11px]">Correo Apoderado</span>
                    <span className="text-slate-700 font-medium">
                      {data.guardianEmail || 'No registrado'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Previous Events */}
              {data.previousEvents && (
                <div className="bg-[#FFFBF0] border border-[#FEB135]/40 border-l-4 border-l-[#FEB135] rounded-xl p-4 text-[#001558]">
                  <h3 className="text-xs font-bold uppercase tracking-wider mb-1.5 flex items-center gap-2">
                    <Award className="w-4 h-4 text-[#FEB135]" />
                    Eventos Anteriores
                  </h3>
                  <p className="text-slate-700">{data.previousEvents}</p>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: LOGÍSTICA & ASIGNACIÓN */}
          {activeTab === 'logistics' && (
            <div className="space-y-4">
              {/* Contingent and Unit Allocation */}
              <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
                <h3 className="text-xs font-bold text-[#001558] uppercase tracking-wider mb-3 pb-2 border-b border-slate-200 flex items-center gap-2">
                  <Tent className="w-4 h-4 text-[#FEB135]" />
                  Asignación en Contingente Polonia 2027
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <span className="text-slate-500 block text-[11px]">Código Único de Cupo</span>
                    <span className="font-mono text-[#001558] font-black text-sm">
                      {data.cupoCode || 'Sin cupo asignado'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[11px]">Territorio (Macro-zona)</span>
                    <span className="text-slate-800 font-bold">
                      {data.territorium || 'Por asignar'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[11px]">Talla de Indumentaria / Kit</span>
                    <span className="text-[#001558] font-black text-sm">
                      {data.uniformSize || 'No registrada'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[11px]">Unidad de Contingente</span>
                    <span className="text-slate-800 font-bold">
                      {data.unitName || data.unit || 'Por asignar'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[11px]">Patrulla de Contingente</span>
                    <span className="text-slate-800 font-bold">
                      {data.patrolName || data.patrol || 'Por asignar'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[11px]">Registro Oficial en Polonia</span>
                    <span className="text-slate-700 font-bold">
                      {data.polandRegistered || 'En proceso'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Scout Structure */}
              <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
                <h3 className="text-xs font-bold text-[#001558] uppercase tracking-wider mb-3 pb-2 border-b border-slate-200 flex items-center gap-2">
                  <Shield className="w-4 h-4 text-[#FEB135]" />
                  Afiliación Institucional AGSCH
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <span className="text-slate-500 block text-[11px]">Zona Scout</span>
                    <span className="text-slate-800 font-bold">{data.scoutZone || 'Sin asignar'}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[11px]">Distrito Scout</span>
                    <span className="text-slate-800 font-bold">{data.scoutDistrict || 'Sin asignar'}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[11px]">Grupo Guía y Scout</span>
                    <span className="text-slate-800 font-bold">{data.scoutGroup || 'Sin asignar'}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[11px]">Cargo Actual en el Grupo</span>
                    <span className="text-slate-700 font-medium">{data.scoutCurrentRole || 'No especificado'}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[11px]">Nivel de Formación</span>
                    <span className="text-slate-700 font-medium">{data.scoutTrainingLevel || 'Sin nivel'}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[11px]">Registro Nacional Vigente</span>
                    <span className="text-slate-700 font-medium">{data.activeRegistrations || 'No registrado'}</span>
                  </div>
                  <div className="sm:col-span-3 pt-2 border-t border-slate-200">
                    <span className="text-slate-500 block text-[11px]">Contacto de Guiadora / Dirigente a cargo:</span>
                    <p className="text-slate-800 font-medium mt-0.5">
                      {data.groupLeaderName || 'No indicado'}
                      {data.groupLeaderEmail ? ` • ${data.groupLeaderEmail}` : ''}
                      {data.groupLeaderPhone ? ` • ${data.groupLeaderPhone}` : ''}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: FICHA MÉDICA WSJ 2027 */}
          {activeTab === 'medical' && (
            <div className="space-y-4 animate-in fade-in duration-200">
              {/* Banner de estado y acciones rápidas */}
              <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xs">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-red-50 border border-red-200 text-red-600 flex items-center justify-center shrink-0">
                    <Heart className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-bold text-[#001558] text-sm">Ficha Médica Polonia 2027</h3>
                      {data.medicalRecord?.completionStatus === 'COMPLETED' ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                          ✓ Completada y Traducida
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                          ⏳ Pendiente de Llenar
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-600 mt-0.5">
                      {data.medicalRecord?.completionStatus === 'COMPLETED'
                        ? `Declarada por ${data.medicalRecord.declaredByName || 'Apoderado'} el ${
                            data.medicalRecord.declaredAt
                              ? new Date(data.medicalRecord.declaredAt).toLocaleDateString('es-CL')
                              : 'recientemente'
                          }`
                        : 'El apoderado o participante aún no completa la ficha médica oficial'}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={async () => {
                      const url =
                        typeof window !== 'undefined'
                          ? `${window.location.origin}/ficha-medica`
                          : '/ficha-medica';
                      const text = `Hola, te enviamos el enlace para completar la Ficha Médica Oficial del Contingente Chileno para el 26° Jamboree Scout Mundial Polonia 2027 de ${data.firstName}. Ingresa con el RUT ${data.rut} aquí: ${url}`;
                      try {
                        await navigator.clipboard.writeText(text);
                        setCopiedLink(true);
                        toast.success('Enlace copiado para WhatsApp');
                        setTimeout(() => setCopiedLink(false), 3000);
                      } catch {
                        toast.error('No se pudo copiar el enlace al portapapeles');
                      }
                    }}
                    className="px-3 py-1.5 rounded-lg bg-[#FFFBF0] hover:bg-[#FFF8E1] text-[#001558] text-xs font-bold border border-[#FEB135] flex items-center gap-1.5 cursor-pointer transition-colors"
                  >
                    <Share2 className="w-3.5 h-3.5" />
                    {copiedLink ? '¡Mensaje Copiado!' : 'Copiar Enlace WhatsApp'}
                  </button>

                  {data.medicalRecord?.qrAccessCode ? (
                    <a
                      href={`/medico/${data.medicalRecord.qrAccessCode}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-1.5 rounded-lg bg-[#001558] hover:bg-[#0b2370] text-white text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      Ver QR de Emergencia
                    </a>
                  ) : (
                    <a
                      href={`/ficha-medica/${encodeURIComponent(data.rut)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-1.5 rounded-lg bg-[#FEB135] hover:bg-[#e59c22] text-[#001558] text-xs font-black flex items-center gap-1.5 shadow-xs transition-colors"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      Llenar Ficha Ahora
                    </a>
                  )}
                </div>
              </div>

              {data.medicalRecord ? (
                <>
                  {/* Selector de idioma */}
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2">
                    <div className="flex bg-white border border-slate-200 rounded-lg p-1 text-xs font-bold">
                      <button
                        type="button"
                        onClick={() => setMedLang('es')}
                        className={`px-3 py-1 rounded transition-all cursor-pointer ${
                          medLang === 'es'
                            ? 'bg-[#001558] text-white'
                            : 'text-slate-600 hover:text-[#001558]'
                        }`}
                      >
                        🇨🇱 Español
                      </button>
                      <button
                        type="button"
                        onClick={() => setMedLang('en')}
                        className={`px-3 py-1 rounded transition-all cursor-pointer ${
                          medLang === 'en'
                            ? 'bg-[#001558] text-white'
                            : 'text-slate-600 hover:text-[#001558]'
                        }`}
                      >
                        🇬🇧 English (Medical)
                      </button>
                      <button
                        type="button"
                        onClick={() => setMedLang('pl')}
                        className={`px-3 py-1 rounded transition-all cursor-pointer ${
                          medLang === 'pl'
                            ? 'bg-[#001558] text-white'
                            : 'text-slate-600 hover:text-[#001558]'
                        }`}
                      >
                        🇵🇱 Polski (Medyczny)
                      </button>
                    </div>

                    <div className="flex items-center gap-3 text-xs">
                      <span className="font-bold text-[#001558] bg-red-50 border border-red-200 px-2.5 py-1 rounded-lg flex items-center gap-1.5">
                        <Droplet className="w-3.5 h-3.5 text-red-600" />
                        Grupo Sanguíneo: {data.medicalRecord.bloodType || 'No informado'}
                      </span>
                    </div>
                  </div>

                  {/* Resumen clínico en el idioma seleccionado */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div className="bg-white border border-slate-200 rounded-xl p-3.5 space-y-1 shadow-2xs">
                      <span className="text-[10px] font-bold text-red-700 uppercase flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3 text-red-600" />
                        {medLang === 'en'
                          ? 'Allergies & Anaphylaxis'
                          : medLang === 'pl'
                          ? 'Alergie i Anafilaksja'
                          : 'Alergias y Anafilaxia'}
                      </span>
                      <p className="text-slate-800 font-medium">
                        {medLang === 'en'
                          ? data.medicalRecord.allergiesEN || 'None reported'
                          : medLang === 'pl'
                          ? data.medicalRecord.allergiesPL || 'Brak'
                          : data.medicalRecord.allergiesES || 'Sin alergias registradas'}
                      </p>
                    </div>

                    <div className="bg-white border border-slate-200 rounded-xl p-3.5 space-y-1 shadow-2xs">
                      <span className="text-[10px] font-bold text-[#001558] uppercase flex items-center gap-1">
                        <Heart className="w-3 h-3 text-[#FEB135]" />
                        {medLang === 'en'
                          ? 'Chronic Conditions'
                          : medLang === 'pl'
                          ? 'Choroby Przewlekłe'
                          : 'Condiciones Crónicas'}
                      </span>
                      <p className="text-slate-800 font-medium">
                        {medLang === 'en'
                          ? data.medicalRecord.chronicConditionsEN || 'None reported'
                          : medLang === 'pl'
                          ? data.medicalRecord.chronicConditionsPL || 'Brak'
                          : data.medicalRecord.chronicConditionsES || 'Sin condiciones crónicas'}
                      </p>
                    </div>

                    <div className="bg-white border border-slate-200 rounded-xl p-3.5 space-y-1 shadow-2xs">
                      <span className="text-[10px] font-bold text-[#001558] uppercase flex items-center gap-1">
                        <Pill className="w-3 h-3 text-indigo-600" />
                        {medLang === 'en'
                          ? 'Medications'
                          : medLang === 'pl'
                          ? 'Leki'
                          : 'Medicamentos Habituales'}
                      </span>
                      <p className="text-slate-800 font-medium">
                        {medLang === 'en'
                          ? data.medicalRecord.currentMedicationsEN || 'None'
                          : medLang === 'pl'
                          ? data.medicalRecord.currentMedicationsPL || 'Brak'
                          : data.medicalRecord.currentMedicationsES || 'Sin medicamentos habituales'}
                      </p>
                    </div>

                    <div className="bg-white border border-slate-200 rounded-xl p-3.5 space-y-1 shadow-2xs">
                      <span className="text-[10px] font-bold text-emerald-700 uppercase flex items-center gap-1">
                        <FileText className="w-3 h-3 text-emerald-600" />
                        {medLang === 'en'
                          ? 'Dietary Restrictions'
                          : medLang === 'pl'
                          ? 'Dieta'
                          : 'Régimen Alimentario'}
                      </span>
                      <p className="text-slate-800 font-medium">
                        {medLang === 'en'
                          ? data.medicalRecord.dietaryRestrictionsEN || 'Standard'
                          : medLang === 'pl'
                          ? data.medicalRecord.dietaryRestrictionsPL || 'Standardowa'
                          : data.medicalRecord.dietaryRestrictionsES || data.dietaryRestrictions || 'Normal'}
                      </p>
                    </div>
                  </div>
                </>
              ) : (
                <div className="bg-[#FFFBF0] border border-[#FEB135]/40 border-l-4 border-l-[#FEB135] rounded-xl p-6 text-center space-y-3 text-[#001558]">
                  <Heart className="w-8 h-8 text-[#FEB135] mx-auto" />
                  <h4 className="text-sm font-bold text-[#001558]">Sin Ficha Médica Registrada Aún</h4>
                  <p className="text-xs text-slate-600 max-w-md mx-auto">
                    El apoderado puede ingresar al portal público con el RUT del participante y solicitar su código de verificación al correo para completarla y firmarla digitalmente.
                  </p>
                  <a
                    href={`/ficha-medica/${encodeURIComponent(data.rut)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#001558] hover:bg-[#0b2370] text-white font-bold text-xs shadow-xs transition-colors"
                  >
                    Abrir Portal Ficha Médica
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              )}
            </div>
          )}

          {/* TAB 5: COMUNICACIONES & CORREOS (ÚNICA INSTANCIA) */}
          {activeTab === 'communications' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-bold text-[#001558] flex items-center gap-2">
                    <Mail className="w-4 h-4 text-[#001558]" />
                    Historial de Correos e Hilos de Gmail Asociados
                  </h4>
                  <p className="text-xs text-slate-600">
                    Mensajes vinculados automáticamente por correo, apoderado o RUT detectado
                  </p>
                </div>
              </div>

              {!data.emailMessages || data.emailMessages.length === 0 ? (
                <div className="bg-white border border-slate-200 rounded-xl p-8 text-center space-y-2 shadow-xs">
                  <Mail className="w-8 h-8 text-slate-400 mx-auto" />
                  <p className="text-xs text-slate-500">
                    No hay correos asociados a este participante todavía.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {data.emailMessages.map((msg: EmailMessageDTO) => (
                    <div
                      key={msg.id}
                      className="bg-white border border-slate-200 rounded-xl p-4 space-y-2 text-left shadow-xs"
                    >
                      <div className="flex items-center justify-between text-xs pb-2 border-b border-slate-200">
                        <div>
                          <strong className="text-[#001558] block">
                            {msg.senderName || msg.senderEmail}
                          </strong>
                          <span className="text-[11px] text-slate-500">&lt;{msg.senderEmail}&gt;</span>
                        </div>
                        <div className="text-right">
                          <span className="text-[11px] text-slate-500 block">
                            {new Date(msg.date).toLocaleDateString('es-CL', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                          {msg.googleMessageId && (
                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#EEF2FF] text-[#001558] font-mono border border-[#001558]/20">
                              ID: {msg.googleMessageId.slice(0, 16)}...
                            </span>
                          )}
                        </div>
                      </div>

                      <h5 className="text-xs font-bold text-[#001558]">{msg.subject}</h5>
                      <p className="text-xs text-slate-700 whitespace-pre-wrap leading-relaxed">
                        {msg.bodyText || msg.snippet}
                      </p>

                      <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-[10px]">
                        <span className="text-emerald-700 font-semibold">
                          ✓ Método de match: {msg.matchMethod || 'AUTOMATICO'}
                        </span>
                        {msg.googleThreadId && (
                          <span className="text-slate-500 font-mono">
                            Hilo Google: {msg.googleThreadId}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 6: INCIDENCIAS & TICKETS CRM (ÚNICA INSTANCIA) */}
          {activeTab === 'incidents' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-bold text-[#001558] flex items-center gap-2">
                    <Ticket className="w-4 h-4 text-purple-700" />
                    Casos e Incidencias Registradas para el Participante
                  </h4>
                  <p className="text-xs text-slate-600">
                    Seguimiento de problemas financieros, médicos, de visado o logística
                  </p>
                </div>
              </div>

              {!data.incidents || data.incidents.length === 0 ? (
                <div className="bg-white border border-slate-200 rounded-xl p-8 text-center space-y-2 shadow-xs">
                  <Ticket className="w-8 h-8 text-slate-400 mx-auto" />
                  <p className="text-xs text-slate-500">
                    No hay incidencias abiertas o históricas registradas para este participante.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {data.incidents.map((inc: IncidentDTO) => (
                    <div
                      key={inc.id}
                      className="bg-white border border-slate-200 rounded-xl p-4 space-y-2 text-left shadow-xs"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-black text-xs text-[#001558] bg-[#FFF8E1] border border-[#FEB135] px-2 py-0.5 rounded">
                            {inc.ticketNumber}
                          </span>
                          <span className="text-[10px] px-2 py-0.5 rounded bg-[#EEF2FF] text-[#001558] font-bold border border-[#001558]/20">
                            {inc.category}
                          </span>
                        </div>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded border ${getIncidentStatusBadge(
                            inc.status
                          )}`}
                        >
                          {inc.status}
                        </span>
                      </div>

                      <h5 className="text-xs font-bold text-[#001558]">{inc.title}</h5>
                      <p className="text-xs text-slate-700 whitespace-pre-wrap">{inc.description}</p>

                      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 text-[10px] text-slate-500">
                        <span>
                          Asignado a:{' '}
                          <strong className="text-[#001558]">
                            {inc.assignedTo?.name || 'Equipo General'}
                          </strong>
                        </span>
                        <span>
                          Prioridad:{' '}
                          <strong className="text-red-700">{inc.priority}</strong>
                        </span>
                        <span>Creado: {new Date(inc.createdAt).toLocaleDateString('es-CL')}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-200 flex justify-end bg-white">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-[#001558] hover:bg-[#0b2370] text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
          >
            Cerrar Ficha
          </button>
        </div>
      </div>

      <ConfirmDialog
        isOpen={paymentToDeleteId !== null}
        title="Anular abono registrado"
        description="¿Estás seguro de anular este abono? El saldo y el estado financiero del participante se actualizarán automáticamente."
        confirmLabel="Sí, anular abono"
        cancelLabel="Cancelar"
        variant="danger"
        loading={deletingPaymentId !== null}
        onCancel={() => setPaymentToDeleteId(null)}
        onConfirm={confirmDeletePayment}
      />
    </div>
  );
}
