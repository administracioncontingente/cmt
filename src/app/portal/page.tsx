'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  Calendar,
  CheckCircle2,
  ClipboardList,
  CreditCard,
  ExternalLink,
  FileSpreadsheet,
  FileText,
  Heart,
  Layers,
  LifeBuoy,
  Link2,
  Loader2,
  LogOut,
  Mail,
  Plus,
  Printer,
  RefreshCw,
  Send,
  ShieldCheck,
  Shirt,
  Sparkles,
  Trash2,
  Upload,
  User,
  UserCheck,
  Users,
} from 'lucide-react';
import { KitSizingForm } from '@/components/portal/KitSizingForm';
import { ParticipantProfileForm } from '@/components/portal/ParticipantProfileForm';
import { PortalMedicalForm } from '@/components/portal/PortalMedicalForm';
import { EventDocumentsList } from '@/components/EventDocumentsList';
import { PortalSupportTickets } from '@/components/portal/PortalSupportTickets';
import { useToast } from '@/components/ui/ToastProvider';
import { formatCurrency, type FinancialSummary } from '@/lib/finance';
import { getRoleBadgeInfo } from '@/lib/roles';
import { cleanRut, formatRut, validateRut } from '@/lib/rut';
import type {
  ParticipantDTO,
  PaymentDTO,
  PortalMeResponseDTO,
  PublicEventDTO,
  PublicParticipantLookupDTO,
} from '@/types/domain';

type PortalTab =
  | 'resumen'
  | 'pagos'
  | 'informar_pago'
  | 'kit'
  | 'documentos'
  | 'soporte'
  | 'datos'
  | 'medica';

type PaymentMode = 'INDIVIDUAL' | 'GROUP_SPLIT' | 'GROUP_EXCEL';

interface SplitAllocationRow {
  uid: string;
  rut: string;
  amount: string;
  groupName: string;
  lookupState: 'idle' | 'loading' | 'found' | 'not_found' | 'invalid_rut';
  lookupInfo: PublicParticipantLookupDTO | null;
}

interface PortalPaymentReceipt {
  success?: boolean;
  mode?: PaymentMode;
  reference?: string;
  paymentDate?: string;
  totalAmount?: number;
  currency?: string;
  receiptFileName?: string | null;
  createdCount?: number;
  items?: Array<{ rut: string; maskedName: string; amount: number }>;
  ticketNumber?: string;
}

const MAX_FILE_SIZE_BYTES = 4 * 1024 * 1024;
const ALLOWED_RECEIPT_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.pdf'];
const ALLOWED_DETAIL_EXTENSIONS = ['.xlsx', '.xls', '.csv', '.txt', '.pdf'];

const INPUT_CLASS =
  'w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs sm:text-sm text-slate-800 placeholder-slate-400 focus:border-[#001558] focus:ring-2 focus:ring-[#FEB135]/50 focus:outline-none transition-all';

function hasAllowedExtension(fileName: string, allowedExts: string[]): boolean {
  const lower = fileName.toLowerCase();
  return allowedExts.some((ext) => lower.endsWith(ext));
}

function createEmptySplitRow(seed: string): SplitAllocationRow {
  return {
    uid: `row_${seed}`,
    rut: '',
    amount: '',
    groupName: '',
    lookupState: 'idle',
    lookupInfo: null,
  };
}

function formatSafeDate(
  value?: string | Date | null,
  monthFormat: 'short' | 'long' = 'short'
): string {
  if (!value) return 'Fecha N/R';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'Fecha N/R';
  return parsed.toLocaleDateString('es-CL', {
    day: '2-digit',
    month: monthFormat,
    year: 'numeric',
  });
}

function getInstallmentBadgeClass(
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

function getPaymentSourceMeta(source?: string | null): {
  label: string;
  className: string;
} {
  switch (source) {
    case 'PORTAL_FORM':
      return {
        label: 'Portal Participante',
        className: 'bg-[#FFF8E1] text-[#001558] border-[#FEB135]',
      };
    case 'PORTAL_GROUP_FORM':
      return {
        label: 'Portal Grupal',
        className: 'bg-sky-50 text-sky-900 border-sky-200',
      };
    case 'MANUAL_GROUP':
      return {
        label: 'Manual Grupal',
        className: 'bg-purple-50 text-purple-800 border-purple-200',
      };
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
        label: 'Planilla Oficial',
        className: 'bg-sky-50 text-sky-800 border-sky-200',
      };
    case 'MANUAL':
    default:
      return {
        label: 'Registro Tesorería',
        className: 'bg-slate-100 text-slate-700 border-slate-200',
      };
  }
}

function getFinancialFallback(participant: ParticipantDTO): FinancialSummary {
  if (participant.financial) return participant.financial;
  const totalRequired = participant.targetFeeUSD ?? 0;
  const totalPaid = participant.totalPaidSheet ?? 0;
  const balanceRemaining =
    participant.debtFinalUSD ?? Math.max(0, totalRequired - totalPaid);
  const overdueAmount = participant.debtToDateUSD ?? 0;
  return {
    totalRequired,
    totalPaid,
    balanceRemaining,
    isFullyPaid: totalRequired === 0 ? true : totalPaid >= totalRequired,
    dueToDate: participant.dueToDateUSD ?? 0,
    overdueAmount,
    isOverdue: overdueAmount > 0,
    overdueCount: 0,
    health:
      totalRequired > 0 && totalPaid >= totalRequired
        ? 'PAGADO_TOTAL'
        : overdueAmount > 0
          ? 'EN_MORA'
          : 'AL_DIA',
    breakdown: [],
  };
}

interface PortalPaymentSectionProps {
  participant: ParticipantDTO;
  event: PublicEventDTO | null;
  currency: string;
  onSuccessRefresh: () => Promise<void>;
  onGoToMyPayments: () => void;
}

function PortalPaymentSection({
  participant,
  event,
  currency,
  onSuccessRefresh,
  onGoToMyPayments,
}: PortalPaymentSectionProps) {
  const { toast } = useToast();
  const errorBannerRef = useRef<HTMLDivElement | null>(null);
  const rowSeqRef = useRef(2);

  const [todayIso, setTodayIso] = useState('');
  const [paymentDate, setPaymentDate] = useState('');
  const [transactionReference, setTransactionReference] = useState('');
  const [amount, setAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('TRANSFERENCIA');
  const [branch, setBranch] = useState('');
  const [comments, setComments] = useState('');

  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [receiptDragging, setReceiptDragging] = useState(false);
  const [showReceiptUrlInput, setShowReceiptUrlInput] = useState(false);
  const [receiptUrl, setReceiptUrl] = useState('');

  const [mode, setMode] = useState<PaymentMode>('INDIVIDUAL');
  const [splitRows, setSplitRows] = useState<SplitAllocationRow[]>([
    createEmptySplitRow('init_1'),
    createEmptySplitRow('init_2'),
  ]);

  const [detailFile, setDetailFile] = useState<File | null>(null);
  const [detailDragging, setDetailDragging] = useState(false);
  const [detailNames, setDetailNames] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitErrorDetails, setSubmitErrorDetails] = useState<string[]>([]);
  const [receiptResult, setReceiptResult] =
    useState<PortalPaymentReceipt | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function initToday() {
      await Promise.resolve();
      if (cancelled) return;
      const today = new Date().toISOString().split('T')[0];
      setTodayIso(today);
      setPaymentDate((prev) => prev || today);
    }
    void initToday();
    return () => {
      cancelled = true;
    };
  }, []);

  const eventCode = event?.code || '';

  const lookupParticipant = useCallback(
    async (
      rutValue: string
    ): Promise<{
      state: 'found' | 'not_found' | 'invalid_rut';
      info: PublicParticipantLookupDTO | null;
    }> => {
      const cleaned = cleanRut(rutValue);
      if (!cleaned || !validateRut(cleaned)) {
        return {
          state: 'invalid_rut',
          info: { found: false, error: 'RUT con dígito verificador inválido' },
        };
      }

      try {
        const res = await fetch('/api/public/payments/lookup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            eventCode: eventCode || undefined,
            rut: cleaned,
          }),
        });
        const data = (await res.json()) as PublicParticipantLookupDTO;
        if (res.ok && data.found) {
          return { state: 'found', info: data };
        }
        return {
          state: 'not_found',
          info: {
            found: false,
            error: data.error || 'RUT no inscrito en este evento',
          },
        };
      } catch {
        return {
          state: 'not_found',
          info: { found: false, error: 'Error de red verificando RUT' },
        };
      }
    },
    [eventCode]
  );

  const handlePickReceiptFile = (file: File) => {
    if (!hasAllowedExtension(file.name, ALLOWED_RECEIPT_EXTENSIONS)) {
      toast.error(
        'Formato no compatible. Sube una imagen (JPG, PNG, WebP) o PDF.',
        'Archivo no válido'
      );
      return;
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      toast.error(
        'El comprobante supera el tamaño máximo de 4 MB.',
        'Archivo muy pesado'
      );
      return;
    }
    setReceiptFile(file);
  };

  const handlePickDetailFile = (file: File) => {
    if (!hasAllowedExtension(file.name, ALLOWED_DETAIL_EXTENSIONS)) {
      toast.error(
        'Formato no compatible. Sube Excel (.xlsx/.xls), CSV, TXT o PDF.',
        'Archivo no válido'
      );
      return;
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      toast.error(
        'El archivo de detalle supera el tamaño máximo de 4 MB.',
        'Archivo muy pesado'
      );
      return;
    }
    setDetailFile(file);
  };

  const handleVerifySplitRow = async (uid: string, rawRut: string) => {
    if (!rawRut.trim()) {
      setSplitRows((prev) =>
        prev.map((r) =>
          r.uid === uid ? { ...r, lookupState: 'idle', lookupInfo: null } : r
        )
      );
      return;
    }

    const cleaned = cleanRut(rawRut);
    const formatted = cleaned.length >= 2 ? formatRut(cleaned) : rawRut;

    setSplitRows((prev) =>
      prev.map((r) =>
        r.uid === uid
          ? { ...r, rut: formatted, lookupState: 'loading', lookupInfo: null }
          : r
      )
    );

    const result = await lookupParticipant(cleaned);
    setSplitRows((prev) =>
      prev.map((r) =>
        r.uid === uid
          ? { ...r, lookupState: result.state, lookupInfo: result.info }
          : r
      )
    );
  };

  const handleIncludeSelfInSplit = () => {
    const selfClean = cleanRut(participant.rut);
    const alreadyExists = splitRows.some(
      (r) => cleanRut(r.rut) === selfClean
    );
    if (alreadyExists) {
      toast.info('El participante titular ya está incluido en el desglose.');
      return;
    }

    const formatted = formatRut(selfClean);
    const selfInfo: PublicParticipantLookupDTO = {
      found: true,
      maskedName: `${participant.firstName} ${participant.lastName}`,
      scoutGroup: participant.scoutGroup,
      unitName: participant.unitName,
      cupoCode: participant.cupoCode,
      roleLabel: getRoleBadgeInfo(participant.contingentRole).label,
    };

    const emptyIdx = splitRows.findIndex((r) => !r.rut.trim());
    if (emptyIdx >= 0) {
      const targetUid = splitRows[emptyIdx].uid;
      setSplitRows((prev) =>
        prev.map((r) =>
          r.uid === targetUid
            ? {
                ...r,
                rut: formatted,
                groupName: r.groupName || participant.scoutGroup || '',
                lookupState: 'found',
                lookupInfo: selfInfo,
              }
            : r
        )
      );
    } else {
      rowSeqRef.current += 1;
      const newRow = createEmptySplitRow(String(rowSeqRef.current));
      newRow.rut = formatted;
      newRow.groupName = participant.scoutGroup || '';
      newRow.lookupState = 'found';
      newRow.lookupInfo = selfInfo;
      setSplitRows((prev) => [newRow, ...prev]);
    }
  };

  const totalAmountNum = Number.parseFloat(amount) || 0;
  const allocatedSum = splitRows.reduce((sum, r) => {
    const val = Number.parseFloat(r.amount);
    return sum + (Number.isFinite(val) && val > 0 ? val : 0);
  }, 0);
  const roundedAllocated = Math.round(allocatedSum * 100) / 100;
  const roundedTotal = Math.round(totalAmountNum * 100) / 100;
  const diffAmount = Math.round((roundedTotal - roundedAllocated) * 100) / 100;
  const isBalanced = roundedTotal > 0 && Math.abs(diffAmount) <= 0.01;

  const handleAssignRemainingToRow = (uid: string) => {
    if (roundedTotal <= 0) return;
    const row = splitRows.find((r) => r.uid === uid);
    if (!row) return;
    const currentVal = Number.parseFloat(row.amount) || 0;
    const nextVal = Math.max(
      0,
      Math.round((currentVal + diffAmount) * 100) / 100
    );
    setSplitRows((prev) =>
      prev.map((r) =>
        r.uid === uid ? { ...r, amount: nextVal > 0 ? String(nextVal) : '' } : r
      )
    );
  };

  const scrollToError = () => {
    requestAnimationFrame(() => {
      errorBannerRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    });
  };

  const handleReset = () => {
    setReceiptResult(null);
    setTransactionReference('');
    setAmount('');
    setBranch('');
    setComments('');
    setReceiptFile(null);
    setReceiptUrl('');
    setShowReceiptUrlInput(false);
    setDetailFile(null);
    setDetailNames('');
    rowSeqRef.current = 2;
    setSplitRows([
      createEmptySplitRow('init_1'),
      createEmptySplitRow('init_2'),
    ]);
    setPaymentDate(todayIso);
    setMode('INDIVIDUAL');
    setSubmitError(null);
    setSubmitErrorDetails([]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    setSubmitErrorDetails([]);

    if (!paymentDate) {
      setSubmitError(
        'Indica la fecha en que realizaste el depósito o transferencia.'
      );
      scrollToError();
      return;
    }

    if (!transactionReference.trim()) {
      setSubmitError('Ingresa el N° de comprobante u operación bancaria.');
      scrollToError();
      return;
    }

    if (roundedTotal <= 0) {
      setSubmitError(`Ingresa un monto total válido en ${currency}.`);
      scrollToError();
      return;
    }

    if (!receiptFile && !receiptUrl.trim()) {
      setSubmitError(
        'Debes adjuntar el archivo del comprobante (imagen o PDF) o pegar un enlace HTTPS válido.'
      );
      scrollToError();
      return;
    }

    if (mode === 'GROUP_SPLIT') {
      if (splitRows.length < 2) {
        setSubmitError(
          'El desglose grupal requiere al menos 2 participantes.'
        );
        scrollToError();
        return;
      }

      const rowProblems: string[] = [];
      const seenRuts = new Set<string>();
      const updatedRows = [...splitRows];

      for (let i = 0; i < updatedRows.length; i++) {
        const row = updatedRows[i];
        const rClean = cleanRut(row.rut);
        const rAmt = Number.parseFloat(row.amount);

        if (!rClean || !validateRut(rClean)) {
          rowProblems.push(`Participante ${i + 1}: RUT inválido.`);
          continue;
        }
        if (seenRuts.has(rClean)) {
          rowProblems.push(
            `Participante ${i + 1}: el RUT ${formatRut(rClean)} está repetido.`
          );
          continue;
        }
        seenRuts.add(rClean);

        if (!Number.isFinite(rAmt) || rAmt <= 0) {
          rowProblems.push(
            `Participante ${i + 1}: ingresa un monto asignado mayor a 0.`
          );
        }

        if (row.lookupState !== 'found') {
          const verified = await lookupParticipant(rClean);
          updatedRows[i] = {
            ...row,
            rut: formatRut(rClean),
            lookupState: verified.state,
            lookupInfo: verified.info,
          };
          if (verified.state !== 'found') {
            rowProblems.push(
              `Participante ${i + 1} (${formatRut(rClean)}): no está inscrito en este evento.`
            );
          }
        }
      }

      setSplitRows(updatedRows);

      if (rowProblems.length > 0) {
        setSubmitError('Revisa los participantes del desglose grupal:');
        setSubmitErrorDetails(rowProblems);
        scrollToError();
        return;
      }

      if (!isBalanced) {
        setSubmitError(
          `La suma asignada (${formatCurrency(roundedAllocated, currency)}) debe coincidir exactamente con el total del comprobante (${formatCurrency(roundedTotal, currency)}). Diferencia: ${formatCurrency(diffAmount, currency)}.`
        );
        scrollToError();
        return;
      }
    }

    if (mode === 'GROUP_EXCEL' && !detailFile && !detailNames.trim()) {
      setSubmitError(
        'Adjunta el archivo Excel/CSV/PDF con el desglose grupal o escribe el listado de participantes y montos.'
      );
      scrollToError();
      return;
    }

    try {
      setSubmitting(true);
      const fd = new FormData();
      fd.set('mode', mode);
      fd.set('amount', String(roundedTotal));
      fd.set('paymentDate', paymentDate);
      fd.set('paymentMethod', paymentMethod);
      fd.set('transactionReference', transactionReference.trim());
      if (branch.trim()) fd.set('branch', branch.trim());
      if (comments.trim()) fd.set('comments', comments.trim());
      if (receiptFile) fd.set('receiptFile', receiptFile);
      if (receiptUrl.trim()) fd.set('receiptUrl', receiptUrl.trim());

      if (mode === 'GROUP_SPLIT') {
        fd.set(
          'allocations',
          JSON.stringify(
            splitRows.map((r) => ({
              rut: formatRut(cleanRut(r.rut)),
              amount: Number.parseFloat(r.amount),
              groupName: r.groupName.trim() || r.lookupInfo?.scoutGroup || '',
            }))
          )
        );
      } else if (mode === 'GROUP_EXCEL') {
        if (detailFile) fd.set('detailFile', detailFile);
        if (detailNames.trim()) fd.set('detailNames', detailNames.trim());
      }

      const res = await fetch('/api/portal/payments', {
        method: 'POST',
        body: fd,
      });

      const data = (await res.json().catch(() => ({}))) as PortalPaymentReceipt & {
        error?: string;
        details?: string[];
      };

      if (!res.ok) {
        setSubmitError(data.error || 'No se pudo registrar el comprobante');
        setSubmitErrorDetails(Array.isArray(data.details) ? data.details : []);
        toast.error(data.error || 'Error al registrar comprobante');
        scrollToError();
        return;
      }

      setReceiptResult({
        ...data,
        mode: data.mode || mode,
        reference: data.reference || transactionReference.trim(),
        paymentDate: data.paymentDate || paymentDate,
        totalAmount: data.totalAmount ?? roundedTotal,
        currency: data.currency || currency,
        receiptFileName:
          data.receiptFileName ?? (receiptFile ? receiptFile.name : null),
      });

      toast.success(
        mode === 'GROUP_EXCEL'
          ? `Nómina enviada bajo ticket ${data.ticketNumber || 'CRM'}`
          : `${data.createdCount ?? 1} abono(s) acreditado(s) en tu historial`,
        'Comprobante recibido'
      );

      await onSuccessRefresh();
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : 'Error de conexión al enviar el comprobante';
      setSubmitError(msg);
      toast.error(msg);
      scrollToError();
    } finally {
      setSubmitting(false);
    }
  };

  if (receiptResult) {
    const isExcel = receiptResult.mode === 'GROUP_EXCEL';
    return (
      <div className="bg-white border border-slate-200 border-t-4 border-t-emerald-600 rounded-3xl shadow-sm p-6 sm:p-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-200">
          <div className="flex items-start gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-7 h-7" />
            </div>
            <div>
              <span className="text-[11px] font-black uppercase tracking-wider text-emerald-700">
                {isExcel
                  ? 'Nómina Grupal Derivada a Tesorería'
                  : 'Comprobante Acreditado en tu Cuenta'}
              </span>
              <h2 className="text-xl sm:text-2xl font-black text-[#001558]">
                {isExcel
                  ? `Caso CRM ${receiptResult.ticketNumber || ''}`
                  : `¡${receiptResult.createdCount || 1} abono(s) registrado(s)!`}
              </h2>
              <p className="text-xs text-slate-600 mt-0.5">
                {event?.name || 'Evento AGSCH'} • Comprobante N°{' '}
                <span className="font-mono font-bold text-[#001558]">
                  {receiptResult.reference}
                </span>
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-white hover:bg-slate-50 border border-slate-300 text-xs font-bold text-[#001558] cursor-pointer print:hidden"
          >
            <Printer className="w-4 h-4" />
            Imprimir Respaldo
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <div className="bg-[#F5F6F8] border border-slate-200 rounded-2xl p-4">
            <span className="text-[10px] font-bold uppercase text-slate-500 block">
              Monto Total Informado
            </span>
            <span className="text-xl font-black text-[#001558]">
              {formatCurrency(
                receiptResult.totalAmount ?? roundedTotal,
                receiptResult.currency || currency
              )}
            </span>
          </div>
          <div className="bg-[#F5F6F8] border border-slate-200 rounded-2xl p-4">
            <span className="text-[10px] font-bold uppercase text-slate-500 block">
              Fecha del Depósito
            </span>
            <span className="text-base font-bold text-slate-800">
              {formatSafeDate(receiptResult.paymentDate, 'long')}
            </span>
          </div>
          <div className="bg-[#F5F6F8] border border-slate-200 rounded-2xl p-4">
            <span className="text-[10px] font-bold uppercase text-slate-500 block">
              Respaldo Adjunto
            </span>
            <span className="text-xs font-bold text-emerald-700 break-all">
              {receiptResult.receiptFileName || 'Enlace / Comprobante guardado'}
            </span>
          </div>
        </div>

        {isExcel ? (
          <div className="bg-[#FFFBF0] border border-[#FEB135]/60 rounded-2xl p-4 text-xs text-[#001558] space-y-1">
            <p className="font-extrabold">
              Tu comprobante grupal y nómina fueron recibidos correctamente.
            </p>
            <p className="text-slate-700">
              Tesorería procesará el archivo bajo el ticket{' '}
              <span className="font-mono font-black">
                {receiptResult.ticketNumber}
              </span>{' '}
              para acreditar cada monto.
            </p>
          </div>
        ) : (
          receiptResult.items &&
          receiptResult.items.length > 0 && (
            <div className="border border-slate-200 rounded-2xl overflow-hidden">
              <div className="px-4 py-2.5 bg-[#F5F6F8] border-b border-slate-200 text-xs font-extrabold text-[#001558] uppercase tracking-wider">
                Detalle de Participantes Acreditados
              </div>
              <div className="divide-y divide-slate-100">
                {receiptResult.items.map((item, idx) => (
                  <div
                    key={`${item.rut}-${idx}`}
                    className="px-4 py-3 flex items-center justify-between text-xs"
                  >
                    <div>
                      <span className="font-bold text-[#001558]">
                        {item.maskedName}
                      </span>
                      <span className="ml-2 font-mono text-slate-500">
                        {item.rut}
                      </span>
                    </div>
                    <span className="font-mono font-black text-emerald-700">
                      +
                      {formatCurrency(
                        item.amount,
                        receiptResult.currency || currency
                      )}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )
        )}

        <div className="pt-2 flex flex-wrap items-center justify-between gap-3 print:hidden">
          <button
            type="button"
            onClick={handleReset}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#FEB135] hover:bg-[#e59c22] text-[#001558] font-black text-xs cursor-pointer transition-colors shadow-xs"
          >
            <Plus className="w-4 h-4" />
            Informar Otro Comprobante
          </button>
          <button
            type="button"
            onClick={onGoToMyPayments}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#001558] hover:bg-[#0b2370] text-white font-bold text-xs cursor-pointer transition-colors"
          >
            Ver Mis Pagos Actualizados
            <ArrowRight className="w-3.5 h-3.5 text-[#FEB135]" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="bg-white border border-slate-200 border-t-4 border-t-[#001558] rounded-3xl p-5 sm:p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg sm:text-xl font-black text-[#001558] flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-[#FEB135]" />
            Informar Comprobante de Pago
          </h2>
          <p className="text-xs text-slate-600 mt-0.5">
            Registra abonos directos para{' '}
            <strong className="text-[#001558]">
              {participant.firstName} {participant.lastName}
            </strong>{' '}
            ({participant.rut}) o pagos grupales del mismo comprobante.
          </p>
        </div>
        <span className="px-3 py-1.5 rounded-xl bg-[#EEF2FF] border border-[#001558]/20 text-[#001558] text-xs font-extrabold shrink-0">
          Moneda: {currency}
        </span>
      </div>

      {submitError && (
        <div
          ref={errorBannerRef}
          role="alert"
          className="p-4 rounded-2xl bg-red-50 border border-red-200 text-red-800 text-xs space-y-1.5 shadow-xs"
        >
          <div className="flex items-start gap-2 font-bold">
            <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
            <span>{submitError}</span>
          </div>
          {submitErrorDetails.length > 0 && (
            <ul className="list-disc pl-6 space-y-0.5 text-[11px] text-red-700">
              {submitErrorDetails.map((d, idx) => (
                <li key={idx}>{d}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Paso 1: Datos del depósito y comprobante */}
      <section className="bg-white border border-slate-200 rounded-3xl p-5 sm:p-6 shadow-xs space-y-4">
        <div className="flex items-center gap-2.5 pb-3 border-b border-slate-200">
          <span className="w-7 h-7 rounded-full bg-[#001558] text-[#FEB135] text-xs font-black flex items-center justify-center shrink-0">
            1
          </span>
          <div>
            <h3 className="text-sm font-extrabold text-[#001558]">
              Datos del Depósito o Transferencia
            </h3>
            <p className="text-[11px] text-slate-500">
              Ingresa la información bancaria exacta y adjunta la imagen o PDF
              de respaldo.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
          <div>
            <label
              htmlFor="portal-pay-date"
              className="block font-bold text-slate-700 mb-1"
            >
              Fecha del Depósito *
            </label>
            <div className="relative">
              <Calendar className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
              <input
                id="portal-pay-date"
                type="date"
                required
                max={todayIso || undefined}
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
                className={`${INPUT_CLASS} pl-9`}
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="portal-pay-ref"
              className="block font-bold text-slate-700 mb-1"
            >
              N° de Comprobante / Operación *
            </label>
            <input
              id="portal-pay-ref"
              type="text"
              required
              value={transactionReference}
              onChange={(e) => setTransactionReference(e.target.value)}
              placeholder="Ej: 98451234"
              className={`${INPUT_CLASS} font-mono`}
            />
          </div>

          <div>
            <label
              htmlFor="portal-pay-amount"
              className="block font-bold text-slate-700 mb-1"
            >
              Monto Total ({currency}) *
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 font-bold">
                $
              </span>
              <input
                id="portal-pay-amount"
                type="number"
                step="0.01"
                min="0.01"
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="150.00"
                className={`${INPUT_CLASS} pl-7 font-mono font-bold`}
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="portal-pay-method"
              className="block font-bold text-slate-700 mb-1"
            >
              Método de Pago
            </label>
            <select
              id="portal-pay-method"
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              className={INPUT_CLASS}
            >
              <option value="TRANSFERENCIA">Transferencia Bancaria</option>
              <option value="DEPOSITO">Depósito en Caja / Sucursal</option>
              <option value="TARJETA">Tarjeta / Webpay</option>
              <option value="EFECTIVO">Efectivo</option>
              <option value="OTRO">Otro</option>
            </select>
          </div>

          <div>
            <label
              htmlFor="portal-pay-branch"
              className="block font-bold text-slate-700 mb-1"
            >
              Banco / Sucursal (Opcional)
            </label>
            <input
              id="portal-pay-branch"
              type="text"
              value={branch}
              onChange={(e) => setBranch(e.target.value)}
              placeholder="Ej: Banco de Chile / Transferencia Web"
              className={INPUT_CLASS}
            />
          </div>

          <div>
            <label
              htmlFor="portal-pay-comments"
              className="block font-bold text-slate-700 mb-1"
            >
              Comentarios Adicionales (Opcional)
            </label>
            <input
              id="portal-pay-comments"
              type="text"
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              placeholder="Ej: Cuota #3"
              className={INPUT_CLASS}
            />
          </div>
        </div>

        {/* Dropzone de comprobante */}
        <div className="space-y-2.5 pt-2">
          <div className="flex items-center justify-between gap-2">
            <label className="text-xs font-bold text-slate-700">
              Comprobante de Pago (JPG, PNG, WebP o PDF • Máx. 4 MB) *
            </label>
            <button
              type="button"
              onClick={() => setShowReceiptUrlInput((v) => !v)}
              className="text-[11px] font-bold text-[#001558] hover:underline flex items-center gap-1 cursor-pointer"
            >
              <Link2 className="w-3 h-3" />
              {showReceiptUrlInput
                ? 'Ocultar campo de enlace'
                : '¿Prefieres pegar un enlace?'}
            </button>
          </div>

          <div
            onDragOver={(e) => {
              e.preventDefault();
              setReceiptDragging(true);
            }}
            onDragLeave={() => setReceiptDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setReceiptDragging(false);
              const dropped = e.dataTransfer.files?.[0];
              if (dropped) handlePickReceiptFile(dropped);
            }}
            className={`border-2 border-dashed rounded-2xl p-5 text-center transition-colors ${
              receiptDragging
                ? 'border-[#001558] bg-[#FFFBF0]'
                : 'border-slate-300 bg-[#F5F6F8] hover:border-[#001558]/70'
            }`}
          >
            <input
              id="portal-receipt-file"
              type="file"
              accept=".jpg,.jpeg,.png,.webp,.pdf"
              onChange={(e) => {
                const picked = e.target.files?.[0];
                if (picked) handlePickReceiptFile(picked);
              }}
              className="hidden"
            />
            <label
              htmlFor="portal-receipt-file"
              className="cursor-pointer flex flex-col items-center gap-1.5"
            >
              <div className="w-10 h-10 rounded-xl bg-white border border-[#FEB135] text-[#001558] flex items-center justify-center shadow-2xs">
                <Upload className="w-5 h-5" />
              </div>
              <p className="text-xs font-bold text-[#001558]">
                {receiptFile
                  ? receiptFile.name
                  : 'Arrastra aquí tu comprobante o haz clic para seleccionarlo'}
              </p>
              <p className="text-[11px] text-slate-500">
                {receiptFile
                  ? `${Math.max(1, Math.round(receiptFile.size / 1024))} KB listo para subir`
                  : 'Se almacena de forma privada en tu historial de pagos'}
              </p>
            </label>
            {receiptFile && (
              <button
                type="button"
                onClick={() => setReceiptFile(null)}
                className="mt-2 inline-flex items-center gap-1 text-[11px] text-red-700 font-bold hover:underline cursor-pointer"
              >
                <Trash2 className="w-3 h-3" />
                Quitar archivo
              </button>
            )}
          </div>

          {showReceiptUrlInput && (
            <div className="pt-1">
              <input
                type="url"
                value={receiptUrl}
                onChange={(e) => setReceiptUrl(e.target.value)}
                placeholder="https://..."
                className={INPUT_CLASS}
              />
            </div>
          )}
        </div>
      </section>

      {/* Paso 2: Modalidad de Imputación */}
      <section className="bg-white border border-slate-200 rounded-3xl p-5 sm:p-6 shadow-xs space-y-5">
        <div className="flex items-center gap-2.5 pb-3 border-b border-slate-200">
          <span className="w-7 h-7 rounded-full bg-[#001558] text-[#FEB135] text-xs font-black flex items-center justify-center shrink-0">
            2
          </span>
          <div>
            <h3 className="text-sm font-extrabold text-[#001558]">
              ¿A quién(es) corresponde este comprobante?
            </h3>
            <p className="text-[11px] text-slate-500">
              Acredita tu pago individual o distribuye un depósito grupal entre
              varios participantes.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <button
            type="button"
            onClick={() => setMode('INDIVIDUAL')}
            className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
              mode === 'INDIVIDUAL'
                ? 'bg-[#FFFBF0] border-[#001558] ring-2 ring-[#FEB135]/60'
                : 'bg-white border-slate-200 hover:border-slate-300'
            }`}
          >
            <div className="flex items-center gap-2 font-black text-xs text-[#001558]">
              <CreditCard className="w-4 h-4 text-[#FEB135]" />
              Pago Individual
            </div>
            <p className="text-[11px] text-slate-600 mt-1">
              El 100% del monto se abona directamente a tu ficha actual.
            </p>
          </button>

          <button
            type="button"
            onClick={() => setMode('GROUP_SPLIT')}
            className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
              mode === 'GROUP_SPLIT'
                ? 'bg-[#FFFBF0] border-[#001558] ring-2 ring-[#FEB135]/60'
                : 'bg-white border-slate-200 hover:border-slate-300'
            }`}
          >
            <div className="flex items-center gap-2 font-black text-xs text-[#001558]">
              <Users className="w-4 h-4 text-[#FEB135]" />
              Pago Grupal (Desglose)
            </div>
            <p className="text-[11px] text-slate-600 mt-1">
              Ingresa los RUT participantes y asigna cuánto corresponde a cada
              uno.
            </p>
          </button>

          <button
            type="button"
            onClick={() => setMode('GROUP_EXCEL')}
            className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
              mode === 'GROUP_EXCEL'
                ? 'bg-[#FFFBF0] border-[#001558] ring-2 ring-[#FEB135]/60'
                : 'bg-white border-slate-200 hover:border-slate-300'
            }`}
          >
            <div className="flex items-center gap-2 font-black text-xs text-[#001558]">
              <FileSpreadsheet className="w-4 h-4 text-[#FEB135]" />
              Nómina Masiva / Excel
            </div>
            <p className="text-[11px] text-slate-600 mt-1">
              Adjunta Excel/CSV o listado para depósitos de grupos numerosos.
            </p>
          </button>
        </div>

        {mode === 'INDIVIDUAL' && (
          <div className="bg-[#F5F6F8] border border-slate-200 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
            <div>
              <span className="font-bold text-[#001558] block">
                Acreditación directa al participante conectado
              </span>
              <span className="text-slate-600">
                {participant.firstName} {participant.lastName} ({participant.rut})
              </span>
            </div>
            <span className="font-mono font-black text-base text-[#001558]">
              {roundedTotal > 0
                ? formatCurrency(roundedTotal, currency)
                : `0 ${currency}`}
            </span>
          </div>
        )}

        {mode === 'GROUP_SPLIT' && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-extrabold text-[#001558]">
                Participantes incluidos en el depósito ({splitRows.length})
              </span>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleIncludeSelfInSplit}
                  className="px-3 py-1.5 rounded-xl bg-[#EEF2FF] hover:bg-[#001558] text-[#001558] hover:text-white text-xs font-bold border border-[#001558]/20 cursor-pointer transition-colors"
                >
                  + Incluir mis datos
                </button>
                <button
                  type="button"
                  onClick={() => {
                    rowSeqRef.current += 1;
                    setSplitRows((prev) => [
                      ...prev,
                      createEmptySplitRow(String(rowSeqRef.current)),
                    ]);
                  }}
                  className="px-3 py-1.5 rounded-xl bg-[#FEB135] hover:bg-[#e59c22] text-[#001558] text-xs font-black cursor-pointer transition-colors flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Agregar Participante
                </button>
              </div>
            </div>

            <div className="space-y-2.5">
              {splitRows.map((row, idx) => (
                <div
                  key={row.uid}
                  className="p-3.5 rounded-2xl bg-[#F5F6F8] border border-slate-200 space-y-2"
                >
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-end">
                    <div className="sm:col-span-4">
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">
                        #{idx + 1} RUT Participante *
                      </label>
                      <input
                        type="text"
                        value={row.rut}
                        onChange={(e) => {
                          const val = e.target.value;
                          setSplitRows((prev) =>
                            prev.map((r) =>
                              r.uid === row.uid
                                ? {
                                    ...r,
                                    rut: val,
                                    lookupState: 'idle',
                                    lookupInfo: null,
                                  }
                                : r
                            )
                          );
                        }}
                        onBlur={(e) =>
                          void handleVerifySplitRow(row.uid, e.target.value)
                        }
                        placeholder="12.345.678-5"
                        className={`${INPUT_CLASS} font-mono py-2`}
                      />
                    </div>

                    <div className="sm:col-span-3">
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">
                        Monto ({currency}) *
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0.01"
                        value={row.amount}
                        onChange={(e) => {
                          const val = e.target.value;
                          setSplitRows((prev) =>
                            prev.map((r) =>
                              r.uid === row.uid ? { ...r, amount: val } : r
                            )
                          );
                        }}
                        placeholder="100.00"
                        className={`${INPUT_CLASS} font-mono font-bold py-2`}
                      />
                    </div>

                    <div className="sm:col-span-3">
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">
                        Grupo / Patrulla (Opcional)
                      </label>
                      <input
                        type="text"
                        value={row.groupName}
                        onChange={(e) => {
                          const val = e.target.value;
                          setSplitRows((prev) =>
                            prev.map((r) =>
                              r.uid === row.uid ? { ...r, groupName: val } : r
                            )
                          );
                        }}
                        placeholder={row.lookupInfo?.scoutGroup || 'Grupo Scout'}
                        className={`${INPUT_CLASS} py-2`}
                      />
                    </div>

                    <div className="sm:col-span-2 flex items-center justify-end gap-1.5">
                      {Math.abs(diffAmount) > 0.01 && roundedTotal > 0 && (
                        <button
                          type="button"
                          onClick={() => handleAssignRemainingToRow(row.uid)}
                          className="px-2.5 py-2 rounded-xl bg-white hover:bg-[#FFFBF0] border border-[#FEB135] text-[#001558] text-[10px] font-bold cursor-pointer whitespace-nowrap"
                          title="Ajustar este monto con la diferencia pendiente"
                        >
                          Cuadrar
                        </button>
                      )}
                      {splitRows.length > 2 && (
                        <button
                          type="button"
                          onClick={() =>
                            setSplitRows((prev) =>
                              prev.filter((r) => r.uid !== row.uid)
                            )
                          }
                          className="p-2 rounded-xl text-slate-400 hover:text-red-700 hover:bg-red-50 cursor-pointer"
                          title="Quitar participante"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="text-[11px]">
                    {row.lookupState === 'loading' && (
                      <span className="inline-flex items-center gap-1 text-slate-500">
                        <Loader2 className="w-3 h-3 animate-spin" />
                        Verificando RUT en el evento...
                      </span>
                    )}
                    {row.lookupState === 'found' && row.lookupInfo && (
                      <span className="inline-flex items-center gap-1.5 text-emerald-800 font-bold">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        {row.lookupInfo.maskedName}
                        {row.lookupInfo.scoutGroup
                          ? ` • ${row.lookupInfo.scoutGroup}`
                          : ''}
                        {row.lookupInfo.cupoCode
                          ? ` • ${row.lookupInfo.cupoCode}`
                          : ''}
                      </span>
                    )}
                    {(row.lookupState === 'not_found' ||
                      row.lookupState === 'invalid_rut') && (
                      <span className="inline-flex items-center gap-1 text-red-700 font-bold">
                        <AlertCircle className="w-3.5 h-3.5" />
                        {row.lookupInfo?.error || 'RUT inválido'}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div
              className={`rounded-2xl p-4 border flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs ${
                isBalanced
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                  : 'bg-[#FFFBF0] border-[#FEB135] text-[#001558]'
              }`}
            >
              <div className="flex flex-wrap items-center gap-4">
                <div>
                  <span className="block text-[10px] font-bold uppercase opacity-75">
                    Total Comprobante
                  </span>
                  <span className="font-mono font-black text-sm">
                    {formatCurrency(roundedTotal, currency)}
                  </span>
                </div>
                <div>
                  <span className="block text-[10px] font-bold uppercase opacity-75">
                    Total Asignado
                  </span>
                  <span className="font-mono font-black text-sm">
                    {formatCurrency(roundedAllocated, currency)}
                  </span>
                </div>
                <div>
                  <span className="block text-[10px] font-bold uppercase opacity-75">
                    Diferencia
                  </span>
                  <span
                    className={`font-mono font-black text-sm ${
                      isBalanced ? 'text-emerald-700' : 'text-red-700'
                    }`}
                  >
                    {formatCurrency(diffAmount, currency)}
                  </span>
                </div>
              </div>

              <div className="font-bold">
                {isBalanced ? (
                  <span className="inline-flex items-center gap-1.5 text-emerald-800">
                    <CheckCircle2 className="w-4 h-4" />
                    Cuadratura exacta lista para enviar
                  </span>
                ) : (
                  <span>
                    La suma asignada debe igualar al total del comprobante
                  </span>
                )}
              </div>
            </div>
          </div>
        )}

        {mode === 'GROUP_EXCEL' && (
          <div className="space-y-4">
            <div className="bg-[#FFFBF0] border border-[#FEB135]/60 border-l-4 border-l-[#FEB135] rounded-2xl p-3.5 text-xs text-[#001558]">
              Esta opción crea un ticket prioritario de Tesorería con tu
              comprobante y archivo de desglose adjunto, ideal para grupos
              grandes.
            </div>

            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDetailDragging(true);
              }}
              onDragLeave={() => setDetailDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDetailDragging(false);
                const dropped = e.dataTransfer.files?.[0];
                if (dropped) handlePickDetailFile(dropped);
              }}
              className={`border-2 border-dashed rounded-2xl p-5 text-center transition-colors ${
                detailDragging
                  ? 'border-[#001558] bg-[#FFFBF0]'
                  : 'border-slate-300 bg-[#F5F6F8]'
              }`}
            >
              <input
                id="portal-detail-file"
                type="file"
                accept=".xlsx,.xls,.csv,.txt,.pdf"
                onChange={(e) => {
                  const picked = e.target.files?.[0];
                  if (picked) handlePickDetailFile(picked);
                }}
                className="hidden"
              />
              <label
                htmlFor="portal-detail-file"
                className="cursor-pointer flex flex-col items-center gap-1.5"
              >
                <FileText className="w-7 h-7 text-[#001558]" />
                <p className="text-xs font-bold text-[#001558]">
                  {detailFile
                    ? detailFile.name
                    : 'Adjuntar planilla Excel, CSV o PDF con nombres, RUT y montos'}
                </p>
                <p className="text-[11px] text-slate-500">
                  Máximo 4 MB (.xlsx, .xls, .csv, .txt, .pdf)
                </p>
              </label>
              {detailFile && (
                <button
                  type="button"
                  onClick={() => setDetailFile(null)}
                  className="mt-2 inline-flex items-center gap-1 text-[11px] text-red-700 font-bold hover:underline cursor-pointer"
                >
                  <Trash2 className="w-3 h-3" />
                  Quitar archivo de nómina
                </button>
              )}
            </div>

            <div>
              <label
                htmlFor="portal-detail-names"
                className="block text-xs font-bold text-slate-700 mb-1"
              >
                Listado de Participantes y Montos (opcional si adjuntas Excel)
              </label>
              <textarea
                id="portal-detail-names"
                rows={3}
                value={detailNames}
                onChange={(e) => setDetailNames(e.target.value)}
                placeholder="Ej: 1) Juan Pérez (19.123.456-7) - 100&#10;2) María Soto (20.456.789-K) - 100"
                className={INPUT_CLASS}
              />
            </div>
          </div>
        )}
      </section>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
        <p className="text-[11px] text-slate-600">
          El comprobante quedará vinculado inmediatamente a tu ficha del evento.
        </p>
        <button
          type="submit"
          disabled={submitting}
          className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-[#001558] hover:bg-[#0b2370] text-white font-black text-xs uppercase tracking-wider shadow-md disabled:opacity-50 cursor-pointer transition-all shrink-0"
        >
          {submitting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Registrando comprobante...
            </>
          ) : (
            <>
              {mode === 'GROUP_EXCEL'
                ? 'Enviar Nómina a Tesorería'
                : 'Registrar Comprobante de Pago'}
              <ArrowRight className="w-4 h-4 text-[#FEB135]" />
            </>
          )}
        </button>
      </div>
    </form>
  );
}

export default function PortalParticipantePage() {
  const { toast } = useToast();

  const [authState, setAuthState] = useState<
    'loading' | 'unauthenticated' | 'authenticated'
  >('loading');
  const [portalData, setPortalData] = useState<PortalMeResponseDTO | null>(
    null
  );
  const [loadError, setLoadError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<PortalTab>('resumen');
  const [showCalendarPreview, setShowCalendarPreview] = useState(false);

  // Unauthenticated login request form state
  const [emailInput, setEmailInput] = useState('');
  const [rutInput, setRutInput] = useState('');
  const [requestingLink, setRequestingLink] = useState(false);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [requestSentInfo, setRequestSentInfo] = useState<{
    message: string;
    email: string;
    previewUrl?: string;
  } | null>(null);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);

  // Household switching & logout state
  const [switchingParticipant, setSwitchingParticipant] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const fetchPortalMe = useCallback(async (signal?: AbortSignal) => {
    const res = await fetch('/api/portal/me', {
      cache: 'no-store',
      signal,
    });

    if (res.status === 401) {
      return { unauthenticated: true as const, data: null };
    }

    const body = (await res.json().catch(() => ({}))) as PortalMeResponseDTO & {
      error?: string;
    };

    if (!res.ok) {
      throw new Error(body.error || 'No se pudo cargar tu portal');
    }

    return { unauthenticated: false as const, data: body };
  }, []);

  const refreshPortalMe = useCallback(async () => {
    try {
      const result = await fetchPortalMe();
      if (result.unauthenticated) {
        setPortalData(null);
        setAuthState('unauthenticated');
        return;
      }
      setPortalData(result.data);
      setAuthState('authenticated');
      setLoadError(null);
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : 'Error al recargar información';
      toast.error(msg);
    }
  }, [fetchPortalMe, toast]);

  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;

    async function loadInitialSession() {
      await Promise.resolve();
      if (cancelled) return;

      try {
        const result = await fetchPortalMe(controller.signal);
        if (cancelled) return;

        if (result.unauthenticated) {
          setPortalData(null);
          setAuthState('unauthenticated');
          setLoadError(null);
        } else {
          setPortalData(result.data);
          setAuthState('authenticated');
          setLoadError(null);
        }
      } catch (err: unknown) {
        if (
          !cancelled &&
          !(err instanceof DOMException && err.name === 'AbortError')
        ) {
          setLoadError(
            err instanceof Error
              ? err.message
              : 'Error de conexión al cargar el portal'
          );
          setAuthState('unauthenticated');
        }
      }
    }

    void loadInitialSession();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [fetchPortalMe]);

  useEffect(() => {
    if (cooldownSeconds <= 0) return;
    const timer = setInterval(() => {
      setCooldownSeconds((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldownSeconds]);

  const handleRequestMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setRequestError(null);

    const trimmedEmail = emailInput.trim().toLowerCase();
    if (!trimmedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setRequestError('Ingresa un correo electrónico válido.');
      return;
    }

    const trimmedRut = rutInput.trim();
    if (trimmedRut) {
      const cleaned = cleanRut(trimmedRut);
      if (!cleaned || !validateRut(cleaned)) {
        setRequestError(
          'El RUT ingresado no es válido. Déjalo vacío o corrige el dígito verificador.'
        );
        return;
      }
    }

    try {
      setRequestingLink(true);
      const res = await fetch('/api/portal/auth/request-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: trimmedEmail,
          rut: trimmedRut ? formatRut(cleanRut(trimmedRut)) : undefined,
        }),
      });

      const data = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        message?: string;
        emailDelivered?: boolean;
        previewUrl?: string;
        error?: string;
      };

      if (res.status === 429) {
        setCooldownSeconds(45);
        const msg =
          data.error ||
          'Debes esperar 45 segundos antes de solicitar un nuevo enlace.';
        setRequestError(msg);
        toast.info(msg);
        return;
      }

      if (!res.ok) {
        throw new Error(data.error || 'No se pudo enviar el enlace de acceso');
      }

      setCooldownSeconds(45);
      setRequestSentInfo({
        message:
          data.message ||
          'Revisa tu bandeja de entrada o carpeta de spam. El enlace expira en 15 minutos y es de un solo uso.',
        email: trimmedEmail,
        previewUrl: data.previewUrl,
      });
      toast.success(
        'Solicitud procesada. Revisa tu correo electrónico.',
        'Enlace enviado'
      );
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : 'Error al solicitar enlace de acceso';
      setRequestError(msg);
      toast.error(msg);
    } finally {
      setRequestingLink(false);
    }
  };

  const handleSwitchParticipant = async (targetParticipantId: string) => {
    if (
      !targetParticipantId ||
      targetParticipantId === portalData?.participant.id
    ) {
      return;
    }

    try {
      setSwitchingParticipant(true);
      const res = await fetch('/api/portal/auth/switch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ participantId: targetParticipantId }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        error?: string;
      };
      if (!res.ok) {
        throw new Error(data.error || 'No se pudo cambiar de participante');
      }
      await refreshPortalMe();
      setShowCalendarPreview(false);
      toast.success('Participante activo actualizado');
    } catch (err: unknown) {
      toast.error(
        err instanceof Error ? err.message : 'Error al cambiar participante'
      );
    } finally {
      setSwitchingParticipant(false);
    }
  };

  const handleLogout = async () => {
    try {
      setLoggingOut(true);
      await fetch('/api/portal/auth/logout', { method: 'POST' });
      setPortalData(null);
      setAuthState('unauthenticated');
      setActiveTab('resumen');
      setRequestSentInfo(null);
      toast.info('Has cerrado tu sesión en el Portal del Participante');
    } catch {
      toast.error('Error al cerrar sesión');
    } finally {
      setLoggingOut(false);
    }
  };

  // Derived metrics for authenticated view
  const authenticatedMetrics = useMemo(() => {
    if (!portalData) return null;
    const { participant, kitItems, kitSizes } = portalData;
    const fin = getFinancialFallback(participant);
    const targetFee =
      participant.targetFeeUSD !== null &&
      participant.targetFeeUSD !== undefined
        ? participant.targetFeeUSD
        : fin.totalRequired;
    const remainingFee = Math.max(0, targetFee - fin.totalPaid);
    const feePct =
      targetFee > 0
        ? Math.min(100, Math.round((fin.totalPaid / targetFee) * 100))
        : 100;

    const activeKitItems = kitItems.filter((item) => item.isActive);
    const requiredKitItems = activeKitItems.filter((item) => item.isRequired);
    const selectedKitIds = new Set(
      kitSizes
        .filter((sel) => Boolean(sel.size?.trim()))
        .map((sel) => sel.kitItemId)
    );
    const requiredKitSelectedCount = requiredKitItems.filter((item) =>
      selectedKitIds.has(item.id)
    ).length;
    const kitComplete =
      requiredKitItems.length > 0
        ? requiredKitSelectedCount === requiredKitItems.length
        : selectedKitIds.size > 0;

    const medicalCompleted =
      participant.medicalRecord?.completionStatus === 'COMPLETED' ||
      participant.medicalRecord?.completionStatus === 'VERIFIED';

    const profileMissingItems: string[] = [];
    if (!participant.phone?.trim()) profileMissingItems.push('teléfono');
    if (!participant.birthDate) profileMissingItems.push('fecha de nacimiento');
    if (
      !participant.guardianName?.trim() ||
      !participant.guardianPhone?.trim()
    ) {
      profileMissingItems.push('contacto de emergencia/apoderado');
    }
    if (!participant.scoutGroup?.trim()) {
      profileMissingItems.push('grupo scout');
    }

    return {
      fin,
      targetFee,
      remainingFee,
      feePct,
      activeKitItems,
      requiredKitItems,
      requiredKitSelectedCount,
      kitComplete,
      medicalCompleted,
      profileMissingItems,
      profileComplete: profileMissingItems.length === 0,
    };
  }, [portalData]);

  // Loading state
  if (authState === 'loading') {
    return (
      <div className="min-h-screen bg-[#F5F6F8] flex flex-col items-center justify-center p-4 text-center">
        <Loader2 className="w-10 h-10 text-[#001558] animate-spin mb-3" />
        <p className="text-sm font-black text-[#001558]">
          Cargando Portal del Participante AGSCH...
        </p>
        <p className="text-xs text-slate-500 mt-1">
          Verificando tu sesión segura
        </p>
      </div>
    );
  }

  // Unauthenticated view (Magic-link login)
  if (authState === 'unauthenticated' || !portalData || !authenticatedMetrics) {
    return (
      <div className="min-h-screen bg-[#F5F6F8] flex flex-col justify-center items-center px-4 py-8 sm:py-12 relative overflow-hidden">
        <div className="fixed top-0 inset-x-0 h-1.5 bg-[#001558] z-20">
          <div className="h-full w-1/3 bg-[#FEB135]" />
        </div>

        <div className="w-full max-w-5xl relative z-10 space-y-4">
          {loadError && (
            <div
              role="alert"
              className="bg-red-50 border border-red-200 rounded-2xl p-4 text-xs text-red-800 flex items-center justify-between gap-3 shadow-xs"
            >
              <div className="flex items-center gap-2 font-bold">
                <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                <span>{loadError}</span>
              </div>
              <button
                type="button"
                onClick={() => void refreshPortalMe()}
                className="px-3 py-1.5 rounded-xl bg-white border border-red-200 font-bold hover:bg-red-100 cursor-pointer inline-flex items-center gap-1"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Reintentar
              </button>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
            {/* Columna Izquierda Institucional */}
            <aside className="lg:col-span-5 bg-[#001558] text-white rounded-3xl border-t-4 border-t-[#FEB135] shadow-xl p-7 sm:p-8 flex flex-col justify-between">
              <div className="space-y-6">
                <div className="flex items-center justify-between gap-3">
                  <div className="relative w-44 h-12">
                    <Image
                      src="/agsch-logo-white.svg"
                      alt="Asociación de Guías y Scouts de Chile"
                      fill
                      priority
                      className="object-contain object-left"
                    />
                  </div>
                  <span className="px-2.5 py-1 rounded-full bg-[#FEB135] text-[#001558] text-[10px] font-black uppercase tracking-wider shrink-0">
                    Autogestión
                  </span>
                </div>

                <div className="space-y-2 pt-2 border-t border-white/15">
                  <p className="text-[11px] font-bold uppercase tracking-widest text-[#FEB135]">
                    Asociación de Guías y Scouts de Chile
                  </p>
                  <h2 className="text-xl sm:text-2xl font-black leading-tight text-white">
                    Tu espacio personal para cada evento
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-200 leading-relaxed">
                    Sin contraseñas que recordar: ingresa con un enlace seguro
                    de un solo uso enviado directo a tu correo registrado.
                  </p>
                </div>

                <ul className="space-y-3 pt-1 text-xs text-slate-100">
                  <li className="flex items-start gap-3">
                    <div className="w-7 h-7 rounded-lg bg-white/10 border border-[#FEB135]/40 flex items-center justify-center shrink-0 mt-0.5">
                      <CreditCard className="w-3.5 h-3.5 text-[#FEB135]" />
                    </div>
                    <div>
                      <p className="font-bold text-white">
                        Cuotas e Historial de Pagos
                      </p>
                      <p className="text-slate-300 text-[11px]">
                        Revisa tu plan de cuotas, descarga comprobantes e
                        informa nuevos abonos.
                      </p>
                    </div>
                  </li>
                  <li className="flex items-start gap-3">
                    <div className="w-7 h-7 rounded-lg bg-white/10 border border-[#FEB135]/40 flex items-center justify-center shrink-0 mt-0.5">
                      <Shirt className="w-3.5 h-3.5 text-[#FEB135]" />
                    </div>
                    <div>
                      <p className="font-bold text-white">
                        Tallas del Kit Oficial
                      </p>
                      <p className="text-slate-300 text-[11px]">
                        Elige talla y corte de cada prenda con guía de medidas
                        en centímetros.
                      </p>
                    </div>
                  </li>
                  <li className="flex items-start gap-3">
                    <div className="w-7 h-7 rounded-lg bg-white/10 border border-[#FEB135]/40 flex items-center justify-center shrink-0 mt-0.5">
                      <Heart className="w-3.5 h-3.5 text-[#FEB135]" />
                    </div>
                    <div>
                      <p className="font-bold text-white">
                        Ficha Médica Trilingüe y Datos
                      </p>
                      <p className="text-slate-300 text-[11px]">
                        Mantén al día tu ficha de salud, QR de emergencia y
                        datos de contacto.
                      </p>
                    </div>
                  </li>
                </ul>
              </div>

              <div className="mt-8 pt-4 border-t border-white/15 flex items-center justify-between text-[11px] text-slate-300">
                <span>Acceso Seguro sin Contraseña</span>
                <span className="font-bold text-[#FEB135]">AGSCH • Portal</span>
              </div>
            </aside>

            {/* Columna Derecha: Solicitud de Magic Link */}
            <div className="lg:col-span-7 flex flex-col justify-between gap-4">
              <div className="bg-white border border-slate-200 border-t-4 border-t-[#001558] rounded-3xl shadow-xl p-6 sm:p-8 flex-1 flex flex-col justify-center space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-200">
                  <div className="relative w-48 h-12 shrink-0">
                    <Image
                      src="/agsch-logo-color.svg"
                      alt="Asociación de Guías y Scouts de Chile"
                      fill
                      priority
                      className="object-contain object-left"
                    />
                  </div>
                  <div className="sm:text-right">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FFFBF0] border border-[#FEB135] text-[#001558] text-[11px] font-bold">
                      <Sparkles className="w-3.5 h-3.5 text-[#001558]" />
                      Acceso por Enlace Seguro
                    </span>
                  </div>
                </div>

                <div className="space-y-1">
                  <h1 className="text-xl sm:text-2xl font-black text-[#001558] tracking-tight">
                    Portal del Participante AGSCH
                  </h1>
                  <p className="text-xs sm:text-sm text-slate-600">
                    Accede con un enlace seguro enviado a tu correo electrónico
                    (sin contraseña)
                  </p>
                </div>

                {requestError && (
                  <div
                    role="alert"
                    className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-start gap-2 font-semibold"
                  >
                    <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                    <span>{requestError}</span>
                  </div>
                )}

                {requestSentInfo && (
                  <div className="space-y-3">
                    <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs space-y-1.5">
                      <div className="flex items-start gap-2 font-extrabold">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                        <span>
                          Enlace solicitado para{' '}
                          <span className="font-mono">{requestSentInfo.email}</span>
                        </span>
                      </div>
                      <p className="text-emerald-800 leading-relaxed pl-6">
                        Revisa tu bandeja de entrada o carpeta de spam. El enlace
                        expira en 15 minutos y es de un solo uso.
                      </p>
                    </div>

                    {requestSentInfo.previewUrl && (
                      <div className="p-4 rounded-2xl bg-[#FFFBF0] border-2 border-[#FEB135] text-[#001558] text-xs space-y-2.5 shadow-2xs">
                        <div className="font-black uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                          <Sparkles className="w-4 h-4 text-[#FEB135]" />
                          Acceso directo (modo desarrollo / sin SMTP configurado)
                        </div>
                        <p className="text-slate-700 text-[11px]">
                          El servidor no tiene proveedor SMTP activo en este
                          entorno. Usa este enlace directo para continuar las
                          pruebas:
                        </p>
                        <a
                          href={requestSentInfo.previewUrl}
                          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#001558] hover:bg-[#0b2370] text-white font-black text-xs transition-colors shadow-xs"
                        >
                          Ingresar con enlace generado
                          <ArrowRight className="w-3.5 h-3.5 text-[#FEB135]" />
                        </a>
                      </div>
                    )}
                  </div>
                )}

                <form onSubmit={handleRequestMagicLink} className="space-y-4">
                  <div>
                    <label
                      htmlFor="portal-auth-email"
                      className="block text-xs font-bold text-[#001558] uppercase tracking-wider mb-1.5"
                    >
                      Correo electrónico registrado *
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5 pointer-events-none" />
                      <input
                        id="portal-auth-email"
                        type="email"
                        required
                        autoComplete="email"
                        value={emailInput}
                        onChange={(e) => setEmailInput(e.target.value)}
                        placeholder="participante@ejemplo.cl o apoderado@ejemplo.cl"
                        className={`${INPUT_CLASS} pl-10`}
                      />
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1">
                      Puede ser el correo del participante o el correo del
                      apoderado registrado en la ficha.
                    </p>
                  </div>

                  <div>
                    <label
                      htmlFor="portal-auth-rut"
                      className="block text-xs font-bold text-[#001558] uppercase tracking-wider mb-1.5"
                    >
                      RUT del Participante (Opcional)
                    </label>
                    <input
                      id="portal-auth-rut"
                      type="text"
                      value={rutInput}
                      onChange={(e) => setRutInput(e.target.value)}
                      onBlur={() => {
                        if (rutInput.trim()) {
                          setRutInput(formatRut(rutInput));
                        }
                      }}
                      placeholder="Ej: 21.345.678-4"
                      className={`${INPUT_CLASS} font-mono`}
                    />
                    <p className="text-[11px] text-slate-500 mt-1">
                      Útil para elegir directamente un participante cuando un
                      apoderado inscribe a más de uno con el mismo correo.
                    </p>
                  </div>

                  <button
                    type="submit"
                    disabled={requestingLink || cooldownSeconds > 0}
                    className="w-full flex items-center justify-center gap-2 py-3.5 px-5 rounded-xl bg-[#001558] hover:bg-[#0b2370] text-white font-black text-xs uppercase tracking-wider shadow-md disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer transition-all"
                  >
                    {requestingLink ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Enviando enlace...
                      </>
                    ) : cooldownSeconds > 0 ? (
                      <>
                        <Mail className="w-4 h-4 text-[#FEB135]" />
                        Reenviar disponible en {cooldownSeconds}s
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4 text-[#FEB135]" />
                        Enviar enlace de acceso a mi correo
                      </>
                    )}
                  </button>
                </form>

                {/* Enlaces útiles inferiores */}
                <div className="pt-4 border-t border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <Link
                    href="/pagos"
                    className="flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-2xl bg-[#EEF2FF] hover:bg-[#dfe6ff] border border-[#001558]/15 text-[#001558] text-xs font-bold transition-colors"
                  >
                    <span className="inline-flex items-center gap-2">
                      <CreditCard className="w-4 h-4 shrink-0" />
                      Informar comprobante rápido (/pagos)
                    </span>
                    <ArrowRight className="w-3.5 h-3.5 shrink-0" />
                  </Link>

                  <Link
                    href="/login"
                    className="flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-2xl bg-[#F5F6F8] hover:bg-slate-200/70 border border-slate-200 text-slate-700 text-xs font-bold transition-colors"
                  >
                    <span className="inline-flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-[#001558] shrink-0" />
                      Acceso Equipo Organizador
                    </span>
                    <ArrowRight className="w-3.5 h-3.5 shrink-0" />
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Authenticated portal view
  const {
    participant,
    event,
    household,
    kitItems,
    kitSizes,
    eventDocuments = [],
    qrEmergencyUrl,
    qrDataUrl,
    sessionEmail,
  } = portalData;
  const currency = event?.currency || 'USD';
  const eventName = event?.name || 'Evento AGSCH';
  const roleBadge = getRoleBadgeInfo(participant.contingentRole);
  const {
    fin,
    targetFee,
    remainingFee,
    feePct,
    requiredKitItems,
    requiredKitSelectedCount,
    kitComplete,
    medicalCompleted,
    profileMissingItems,
    profileComplete,
  } = authenticatedMetrics;

  const tabs: Array<{
    id: PortalTab;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    badge?: string;
    badgeTone?: 'success' | 'warn';
  }> = [
    { id: 'resumen', label: 'Resumen', icon: ClipboardList },
    { id: 'pagos', label: 'Mis Pagos', icon: CreditCard },
    { id: 'informar_pago', label: 'Informar Pago', icon: Upload },
    {
      id: 'kit',
      label: 'Tallas del Kit',
      icon: Shirt,
      badge: kitComplete
        ? 'OK'
        : `${requiredKitSelectedCount}/${requiredKitItems.length}`,
      badgeTone: kitComplete ? 'success' : 'warn',
    },
    {
      id: 'documentos',
      label: 'Documentos',
      icon: FileText,
      badge:
        eventDocuments.length > 0 ? String(eventDocuments.length) : undefined,
    },
    { id: 'datos', label: 'Mis Datos', icon: User },
    {
      id: 'medica',
      label: 'Ficha Médica',
      icon: Heart,
      badge: medicalCompleted ? 'OK' : 'Pend.',
      badgeTone: medicalCompleted ? 'success' : 'warn',
    },
    { id: 'soporte', label: 'Soporte', icon: LifeBuoy },
  ];

  const pendingActions: Array<{
    id: string;
    title: string;
    description: string;
    buttonLabel: string;
    tab: PortalTab;
    tone: 'warn' | 'info';
  }> = [];

  if (fin.isOverdue || remainingFee > 0) {
    pendingActions.push({
      id: 'payments',
      title: fin.isOverdue
        ? `Tienes cuotas vencidas por ${formatCurrency(fin.overdueAmount, currency)}`
        : `Saldo restante de cuota: ${formatCurrency(remainingFee, currency)}`,
      description:
        'Revisa el calendario de cuotas e imputación o informa un nuevo comprobante de transferencia.',
      buttonLabel: fin.isOverdue ? 'Informar Pago Ahora' : 'Ver Mis Pagos',
      tab: fin.isOverdue ? 'informar_pago' : 'pagos',
      tone: fin.isOverdue ? 'warn' : 'info',
    });
  }

  if (!kitComplete && requiredKitItems.length > 0) {
    pendingActions.push({
      id: 'kit',
      title: `Falta confirmar tallas del kit (${requiredKitSelectedCount} de ${requiredKitItems.length} obligatorias)`,
      description:
        'Revisa la guía de medidas en centímetros y selecciona tu talla y corte para cada prenda.',
      buttonLabel: 'Elegir Tallas del Kit',
      tab: 'kit',
      tone: 'warn',
    });
  }

  if (!medicalCompleted) {
    pendingActions.push({
      id: 'medical',
      title: 'Ficha médica oficial pendiente de completar y firmar',
      description:
        'Completa tus antecedentes clínicos en español; el sistema generará las versiones en inglés y polaco junto al QR de emergencia.',
      buttonLabel: 'Completar Ficha Médica',
      tab: 'medica',
      tone: 'warn',
    });
  }

  if (!profileComplete) {
    pendingActions.push({
      id: 'profile',
      title: `Datos de contacto por revisar (${profileMissingItems.join(', ')})`,
      description:
        'Mantén actualizados tus teléfonos, contacto de emergencia y grupo scout.',
      buttonLabel: 'Actualizar Mis Datos',
      tab: 'datos',
      tone: 'info',
    });
  }

  return (
    <div className="min-h-screen bg-[#F5F6F8] text-slate-800 flex flex-col font-sans print:bg-white">
      {/* Header Institucional */}
      <header className="bg-white border-b border-slate-200 border-t-4 border-t-[#001558] shadow-xs print:hidden">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3.5 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="relative w-36 sm:w-44 h-10 shrink-0">
                <Image
                  src="/agsch-logo-color.svg"
                  alt="Asociación de Guías y Scouts de Chile"
                  fill
                  priority
                  className="object-contain object-left"
                />
              </div>

              {event && (
                <Link
                  href={`/eventos/${encodeURIComponent(event.code)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Ver página informativa pública del evento"
                  className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-2xl bg-[#EEF2FF] hover:bg-[#dce4ff] border border-[#001558]/15 transition-colors"
                >
                  <span className="text-lg leading-none">
                    {event.flagEmoji || '🏕️'}
                  </span>
                  <div className="min-w-0">
                    <span className="block text-[10px] font-bold uppercase text-slate-500 leading-none">
                      Evento Activo • Ver Info
                    </span>
                    <span className="block text-xs font-black text-[#001558] truncate max-w-[240px]">
                      {event.name}
                    </span>
                  </div>
                </Link>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {household.length > 1 && (
                <div className="flex items-center gap-1.5 bg-[#FFFBF0] border border-[#FEB135] rounded-xl px-2.5 py-1">
                  <label
                    htmlFor="portal-household-switch"
                    className="text-[11px] font-extrabold text-[#001558] whitespace-nowrap"
                  >
                    Cambiar Participante:
                  </label>
                  <select
                    id="portal-household-switch"
                    value={participant.id}
                    disabled={switchingParticipant}
                    onChange={(e) =>
                      void handleSwitchParticipant(e.target.value)
                    }
                    className="bg-transparent text-xs font-black text-[#001558] focus:outline-none cursor-pointer max-w-[200px]"
                  >
                    {household.map((member) => (
                      <option key={member.id} value={member.id}>
                        {member.firstName} {member.lastName} ({member.rut})
                        {member.eventName ? ` • ${member.eventName}` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <button
                type="button"
                onClick={() => void handleLogout()}
                disabled={loggingOut}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white hover:bg-red-50 border border-slate-300 hover:border-red-300 text-slate-700 hover:text-red-700 text-xs font-bold transition-colors cursor-pointer disabled:opacity-50"
              >
                {loggingOut ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <LogOut className="w-3.5 h-3.5" />
                )}
                <span>Cerrar Sesión</span>
              </button>
            </div>
          </div>

          {/* Participant identity bar */}
          <div className="pt-2.5 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-black text-sm text-[#001558]">
                {participant.firstName} {participant.lastName}{' '}
                {participant.secondLastName || ''}
              </span>
              <span className="font-mono text-[11px] px-2 py-0.5 rounded-lg bg-[#F5F6F8] border border-slate-200 font-bold text-[#001558]">
                {participant.rut}
              </span>
              {participant.cupoCode && (
                <span className="font-mono text-[11px] px-2 py-0.5 rounded-lg bg-[#FFF8E1] border border-[#FEB135] font-bold text-[#001558]">
                  Cupo: {participant.cupoCode}
                </span>
              )}
              <span
                className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${roleBadge.className}`}
              >
                {roleBadge.label}
              </span>
              {event && (
                <span className="md:hidden text-[11px] font-bold text-[#001558]">
                  {event.flagEmoji ? `${event.flagEmoji} ` : ''}
                  {event.shortName || event.name}
                </span>
              )}
            </div>

            <span className="text-[11px] text-slate-500">
              Sesión: <span className="font-mono">{sessionEmail}</span>
            </span>
          </div>
        </div>

        {/* Barra de 6 pestañas (scroll horizontal en móvil) */}
        <div className="border-t border-slate-200 bg-[#F5F6F8]">
          <div
            role="tablist"
            aria-label="Secciones del Portal del Participante"
            className="max-w-6xl mx-auto px-4 sm:px-6 flex overflow-x-auto whitespace-nowrap gap-1"
          >
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => setActiveTab(tab.id)}
                  className={`py-3 px-4 text-xs font-bold flex items-center gap-2 border-b-2 transition-colors cursor-pointer shrink-0 ${
                    isActive
                      ? 'border-[#001558] text-[#001558] bg-white font-black'
                      : 'border-transparent text-slate-600 hover:text-[#001558] hover:bg-white/60'
                  }`}
                >
                  <Icon
                    className={`w-4 h-4 ${
                      tab.id === 'medica'
                        ? 'text-red-600'
                        : isActive
                          ? 'text-[#001558]'
                          : 'text-slate-500'
                    }`}
                  />
                  <span>{tab.label}</span>
                  {tab.badge && (
                    <span
                      className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded-full border ${
                        tab.badgeTone === 'success'
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : 'bg-[#FFF8E1] text-[#001558] border-[#FEB135]'
                      }`}
                    >
                      {tab.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {/* TAB 1: RESUMEN */}
        {activeTab === 'resumen' && (
          <div className="space-y-6">
            {/* 4 KPI cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* KPI 1: Estado de Cuotas */}
              <button
                type="button"
                onClick={() => setActiveTab('pagos')}
                className="text-left bg-white border border-slate-200 hover:border-[#001558] rounded-3xl p-5 shadow-xs transition-all cursor-pointer space-y-2.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
                    Estado de Cuotas
                  </span>
                  <CreditCard className="w-4 h-4 text-[#FEB135]" />
                </div>
                <p className="text-xl font-black text-[#001558]">
                  {formatCurrency(fin.totalPaid, currency)}
                </p>
                <div className="w-full h-2 rounded-full bg-[#F5F6F8] overflow-hidden border border-slate-200">
                  <div
                    className={`h-full ${
                      fin.isFullyPaid ? 'bg-emerald-600' : 'bg-[#001558]'
                    }`}
                    style={{ width: `${feePct}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-600">
                    Meta: {formatCurrency(targetFee, currency)}
                  </span>
                  <span
                    className={`font-extrabold ${
                      fin.isOverdue
                        ? 'text-red-700'
                        : fin.isFullyPaid
                          ? 'text-emerald-700'
                          : 'text-[#001558]'
                    }`}
                  >
                    {participant.financialStatusSheet ||
                      (fin.isFullyPaid
                        ? 'Total Pagado'
                        : fin.isOverdue
                          ? 'Adeuda'
                          : 'Al Día')}
                  </span>
                </div>
              </button>

              {/* KPI 2: Tallas del Kit */}
              <button
                type="button"
                onClick={() => setActiveTab('kit')}
                className="text-left bg-white border border-slate-200 hover:border-[#001558] rounded-3xl p-5 shadow-xs transition-all cursor-pointer space-y-2.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
                    Tallas del Kit
                  </span>
                  <Shirt className="w-4 h-4 text-[#001558]" />
                </div>
                <p className="text-xl font-black text-[#001558]">
                  {requiredKitSelectedCount} de {requiredKitItems.length}
                </p>
                <p className="text-[11px] text-slate-600">
                  Prendas obligatorias confirmadas
                </p>
                <span
                  className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-extrabold border ${
                    kitComplete
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                      : 'bg-[#FFF8E1] text-[#001558] border-[#FEB135]'
                  }`}
                >
                  {kitComplete ? 'Confirmado' : 'Pendiente'}
                </span>
              </button>

              {/* KPI 3: Ficha Médica */}
              <button
                type="button"
                onClick={() => setActiveTab('medica')}
                className="text-left bg-white border border-slate-200 hover:border-[#001558] rounded-3xl p-5 shadow-xs transition-all cursor-pointer space-y-2.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
                    Ficha Médica
                  </span>
                  <Heart className="w-4 h-4 text-red-600" />
                </div>
                <p className="text-xl font-black text-[#001558]">
                  {medicalCompleted ? 'Completa' : 'Pendiente'}
                </p>
                <p className="text-[11px] text-slate-600">
                  {medicalCompleted
                    ? 'Traducida y con QR de emergencia activo'
                    : 'Requiere firma de consentimiento y datos'}
                </p>
                <span
                  className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-extrabold border ${
                    medicalCompleted
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                      : 'bg-amber-50 text-amber-800 border-amber-200'
                  }`}
                >
                  {medicalCompleted ? 'Completada' : 'Por completar'}
                </span>
              </button>

              {/* KPI 4: Datos de Contacto */}
              <button
                type="button"
                onClick={() => setActiveTab('datos')}
                className="text-left bg-white border border-slate-200 hover:border-[#001558] rounded-3xl p-5 shadow-xs transition-all cursor-pointer space-y-2.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
                    Datos de Contacto
                  </span>
                  <UserCheck className="w-4 h-4 text-[#001558]" />
                </div>
                <p className="text-base font-black text-[#001558] truncate">
                  {participant.phone || 'Sin teléfono'}
                </p>
                <p className="text-[11px] text-slate-600 truncate">
                  Apoderado: {participant.guardianName || 'Por completar'}
                </p>
                <span
                  className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-extrabold border ${
                    profileComplete
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                      : 'bg-[#FFF8E1] text-[#001558] border-[#FEB135]'
                  }`}
                >
                  {profileComplete ? 'Completos' : 'Por revisar'}
                </span>
              </button>
            </div>

            {/* Lista de acciones pendientes */}
            <section className="bg-white border border-slate-200 rounded-3xl p-5 sm:p-6 shadow-xs space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-200">
                <div>
                  <h2 className="text-sm font-black text-[#001558] uppercase tracking-wider">
                    Acciones Pendientes y Próximos Pasos
                  </h2>
                  <p className="text-xs text-slate-500">
                    Completa estos pasos para mantener tu participación 100% al
                    día en {eventName}.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab('informar_pago')}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#FEB135] hover:bg-[#e59c22] text-[#001558] text-xs font-black cursor-pointer transition-colors"
                >
                  <Upload className="w-3.5 h-3.5" />
                  Informar Pago
                </button>
              </div>

              {pendingActions.length === 0 ? (
                <div className="p-5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-black">
                        ¡Todo al día para {eventName}!
                      </p>
                      <p className="text-xs text-emerald-800 mt-0.5">
                        Tus cuotas, tallas del kit, ficha médica y datos de
                        contacto se encuentran completos.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveTab('kit')}
                    className="px-4 py-2 rounded-xl bg-white border border-emerald-300 text-emerald-900 text-xs font-bold hover:bg-emerald-100 cursor-pointer shrink-0"
                  >
                    Revisar mis tallas
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {pendingActions.map((action) => (
                    <div
                      key={action.id}
                      className={`p-4 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                        action.tone === 'warn'
                          ? 'bg-[#FFFBF0] border-[#FEB135]/70'
                          : 'bg-[#F5F6F8] border-slate-200'
                      }`}
                    >
                      <div className="space-y-0.5">
                        <p className="text-xs sm:text-sm font-black text-[#001558]">
                          {action.title}
                        </p>
                        <p className="text-xs text-slate-600">
                          {action.description}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setActiveTab(action.tab)}
                        className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#001558] hover:bg-[#0b2370] text-white text-xs font-extrabold transition-colors cursor-pointer shrink-0"
                      >
                        {action.buttonLabel}
                        <ArrowRight className="w-3.5 h-3.5 text-[#FEB135]" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}

        {/* TAB 2: MIS PAGOS */}
        {activeTab === 'pagos' && (
          <div className="space-y-6">
            {/* 4 KPIs Financieros */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  Cuota Oficial
                </span>
                <p className="text-xl font-black text-[#001558] mt-1">
                  {formatCurrency(targetFee, currency)}
                </p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  {participant.feeEnrollmentType ||
                    participant.feeType ||
                    'Plan asignado'}
                </p>
              </div>

              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  Total Abonado
                </span>
                <p className="text-xl font-black text-emerald-700 mt-1">
                  {formatCurrency(fin.totalPaid, currency)}
                </p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  {feePct}% cubierto
                </p>
              </div>

              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  Saldo Restante
                </span>
                <p className="text-xl font-black text-slate-800 mt-1">
                  {formatCurrency(remainingFee, currency)}
                </p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Por completar
                </p>
              </div>

              <div
                className={`p-4 rounded-2xl border shadow-xs ${
                  fin.isOverdue || participant.financialStatusSheet === 'Adeuda'
                    ? 'bg-red-50 border-red-200 border-l-4 border-l-red-500'
                    : 'bg-white border-slate-200'
                }`}
              >
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  Situación
                </span>
                <p
                  className={`text-lg font-black mt-1 ${
                    fin.isOverdue ||
                    participant.financialStatusSheet === 'Adeuda'
                      ? 'text-red-700'
                      : 'text-[#001558]'
                  }`}
                >
                  {participant.financialStatusSheet ||
                    (fin.isFullyPaid
                      ? 'Total Pagado'
                      : fin.isOverdue
                        ? 'Adeuda'
                        : 'Al Día')}
                </p>
                <p className="text-[11px] text-slate-600 mt-0.5">
                  {fin.overdueAmount > 0
                    ? `Vencido: ${formatCurrency(fin.overdueAmount, currency)}`
                    : 'Sin cuotas vencidas'}
                </p>
              </div>
            </div>

            {/* Action bar + optional calendar */}
            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs flex flex-wrap items-center justify-between gap-3">
              <div className="text-xs">
                <p className="font-black text-[#001558]">
                  ¿Realizaste una nueva transferencia o depósito?
                </p>
                <p className="text-slate-600">
                  Sube tu comprobante directo sin salir del portal.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {participant.calendarUrl && (
                  <button
                    type="button"
                    onClick={() => setShowCalendarPreview((v) => !v)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white hover:bg-slate-50 border border-slate-300 text-[#001558] text-xs font-bold cursor-pointer"
                  >
                    <Calendar className="w-3.5 h-3.5 text-[#FEB135]" />
                    {showCalendarPreview
                      ? 'Ocultar Calendario'
                      : 'Ver Calendario Oficial'}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setActiveTab('informar_pago')}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#001558] hover:bg-[#0b2370] text-white text-xs font-black cursor-pointer shadow-xs"
                >
                  <Plus className="w-4 h-4 text-[#FEB135]" />
                  Informar Nuevo Pago
                </button>
              </div>
            </div>

            {showCalendarPreview && participant.calendarUrl && (
              <div className="bg-white border border-slate-200 rounded-3xl p-4 shadow-xs space-y-3">
                <div className="flex items-center justify-between border-b border-slate-200 pb-2 text-xs">
                  <span className="font-black text-[#001558]">
                    Calendario Oficial de Cuotas
                  </span>
                  <a
                    href={participant.calendarUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 font-bold text-[#001558] hover:underline"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    Abrir en pestaña nueva
                  </a>
                </div>
                <div className="flex justify-center bg-[#F5F6F8] rounded-2xl p-3 border border-slate-200">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={participant.calendarUrl}
                    alt="Calendario oficial de cuotas"
                    className="max-h-96 w-auto rounded-lg object-contain"
                  />
                </div>
              </div>
            )}

            {/* Plan de Cuotas e Imputación */}
            <section className="bg-white border border-slate-200 rounded-3xl shadow-xs overflow-hidden">
              <div className="px-5 py-3.5 bg-[#F5F6F8] border-b border-slate-200 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Layers className="w-4 h-4 text-[#FEB135]" />
                  <h2 className="text-xs font-black text-[#001558] uppercase tracking-wider">
                    Plan de Cuotas e Imputación ({fin.breakdown.length})
                  </h2>
                </div>
                {fin.overdueCount > 0 && (
                  <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-red-50 text-red-700 border border-red-200">
                    {fin.overdueCount} vencida{fin.overdueCount > 1 ? 's' : ''}
                  </span>
                )}
              </div>

              {fin.breakdown.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-500">
                  No hay calendario de cuotas asignado para este participante.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-black text-slate-500 uppercase tracking-wider">
                        <th className="py-3 px-4">Cuota</th>
                        <th className="py-3 px-4">Vencimiento</th>
                        <th className="py-3 px-4 text-right">Monto</th>
                        <th className="py-3 px-4 text-right">Cubierto</th>
                        <th className="py-3 px-4 text-right">Pendiente</th>
                        <th className="py-3 px-4 text-center">Estado</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs">
                      {fin.breakdown.map((inst) => (
                        <tr
                          key={inst.id}
                          className="hover:bg-[#FFFBF0]/50 transition-colors"
                        >
                          <td className="py-3 px-4">
                            <span className="font-mono font-black text-[#001558] mr-1.5">
                              #{inst.installmentNumber}
                            </span>
                            <span className="font-semibold text-slate-800">
                              {inst.title}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-slate-600 whitespace-nowrap">
                            {formatSafeDate(inst.dueDate, 'short')}
                          </td>
                          <td className="py-3 px-4 text-right font-mono font-semibold text-slate-700 whitespace-nowrap">
                            {formatCurrency(inst.amount, currency)}
                          </td>
                          <td className="py-3 px-4 text-right font-mono font-bold text-emerald-700 whitespace-nowrap">
                            {formatCurrency(inst.coveredAmount, currency)}
                          </td>
                          <td className="py-3 px-4 text-right font-mono font-bold text-slate-800 whitespace-nowrap">
                            {formatCurrency(inst.remainingAmount, currency)}
                          </td>
                          <td className="py-3 px-4 text-center whitespace-nowrap">
                            <span
                              className={`inline-block text-[10px] font-extrabold px-2.5 py-0.5 rounded-full border ${getInstallmentBadgeClass(
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
            </section>

            {/* Historial de Abonos */}
            <section className="bg-white border border-slate-200 rounded-3xl p-5 sm:p-6 shadow-xs space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-200">
                <h2 className="text-xs font-black text-[#001558] uppercase tracking-wider">
                  Historial de Abonos ({participant.payments?.length || 0})
                </h2>
              </div>

              {!participant.payments || participant.payments.length === 0 ? (
                <div className="p-6 text-center bg-[#F5F6F8] border border-slate-200 rounded-2xl text-xs text-slate-500">
                  Aún no registras abonos en este evento.
                </div>
              ) : (
                <div className="space-y-2.5">
                  {participant.payments.map((p: PaymentDTO) => {
                    const isNegative = p.amount < 0;
                    const sourceMeta = getPaymentSourceMeta(p.source);
                    return (
                      <div
                        key={p.id}
                        className="p-4 rounded-2xl bg-[#F5F6F8] border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                      >
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span
                              className={`font-mono font-black text-base ${
                                isNegative ? 'text-red-700' : 'text-[#001558]'
                              }`}
                            >
                              {isNegative
                                ? formatCurrency(p.amount, currency)
                                : `+${formatCurrency(p.amount, currency)}`}
                            </span>
                            <span className="text-[10px] px-2 py-0.5 rounded bg-white text-[#001558] font-bold border border-[#001558]/20">
                              {p.paymentMethod}
                            </span>
                            <span
                              className={`text-[10px] px-2 py-0.5 rounded font-bold border ${sourceMeta.className}`}
                            >
                              {sourceMeta.label}
                            </span>
                            {p.transactionReference && (
                              <span className="text-[10px] font-mono text-[#001558] bg-[#FFFBF0] px-2 py-0.5 rounded border border-[#FEB135]/50 font-bold">
                                Doc: {p.transactionReference}
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-600 flex flex-wrap items-center gap-2">
                            <span>{formatSafeDate(p.paymentDate, 'short')}</span>
                            {p.notes && <span>• {p.notes}</span>}
                          </div>
                        </div>

                        {p.receiptUrl && (
                          <a
                            href={p.receiptUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-white hover:bg-[#EEF2FF] border border-[#001558]/20 text-[#001558] text-xs font-extrabold transition-colors shrink-0"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                            Ver Comprobante
                          </a>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </div>
        )}

        {/* TAB 3: INFORMAR PAGO */}
        {activeTab === 'informar_pago' && (
          <PortalPaymentSection
            key={participant.id}
            participant={participant}
            event={event}
            currency={currency}
            onSuccessRefresh={refreshPortalMe}
            onGoToMyPayments={() => setActiveTab('pagos')}
          />
        )}

        {/* TAB 4: TALLAS DEL KIT */}
        {activeTab === 'kit' && (
          <KitSizingForm
            key={participant.id}
            kitItems={kitItems}
            initialSelections={kitSizes}
            participantName={`${participant.firstName} ${participant.lastName}`}
            eventName={eventName}
            onSaved={refreshPortalMe}
          />
        )}

        {/* TAB: DOCUMENTOS OFICIALES DEL EVENTO */}
        {activeTab === 'documentos' && (
          <div className="space-y-4">
            <div className="bg-white border border-slate-200 border-t-4 border-t-[#001558] rounded-3xl p-5 sm:p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-lg sm:text-xl font-black text-[#001558] flex items-center gap-2">
                  <FileText className="w-5 h-5 text-[#FEB135]" />
                  Documentación Oficial — {eventName}
                </h2>
                <p className="text-xs text-slate-600 mt-0.5">
                  Circulares, informativos, fichas de autorización, reglamentos
                  y guías oficiales publicadas para tu evento.
                </p>
              </div>
              {event?.code && (
                <Link
                  href={`/eventos/${encodeURIComponent(event.code)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#001558] hover:bg-[#0b2370] text-white text-xs font-extrabold transition-colors shadow-xs shrink-0"
                >
                  <ExternalLink className="w-3.5 h-3.5 text-[#FEB135]" />
                  Ver Página Pública del Evento
                </Link>
              )}
            </div>

            <EventDocumentsList
              documents={eventDocuments}
              eventCode={event?.code}
              compact
              emptyMessage="Aún no hay circulares o fichas publicadas para este evento."
            />
          </div>
        )}

        {/* TAB 5: MIS DATOS */}
        {activeTab === 'datos' && (
          <ParticipantProfileForm
            key={participant.id}
            participant={participant}
            onSaved={refreshPortalMe}
          />
        )}

        {/* TAB 6: FICHA MÉDICA */}
        {activeTab === 'medica' && (
          <PortalMedicalForm
            key={participant.id}
            participant={participant}
            medicalRecord={participant.medicalRecord || null}
            qrEmergencyUrl={qrEmergencyUrl}
            qrDataUrl={qrDataUrl}
            onSaved={refreshPortalMe}
          />
        )}

        {/* TAB 7: SOPORTE / TICKETS */}
        {activeTab === 'soporte' && (
          <PortalSupportTickets
            key={participant.id}
            participantName={`${participant.firstName} ${participant.lastName}`}
            eventName={eventName}
          />
        )}
      </main>
    </div>
  );
}
