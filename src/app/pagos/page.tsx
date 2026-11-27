'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  Calendar,
  CheckCircle2,
  CreditCard,
  FileSpreadsheet,
  FileText,
  Heart,
  Link2,
  Loader2,
  Plus,
  Printer,
  ShieldCheck,
  Sparkles,
  Trash2,
  Upload,
  UserCheck,
  Users,
} from 'lucide-react';
import { useToast } from '@/components/ui/ToastProvider';
import { formatCurrency } from '@/lib/finance';
import { cleanRut, formatRut, validateRut } from '@/lib/rut';
import type { PublicEventDTO, PublicParticipantLookupDTO } from '@/types/domain';

type PaymentMode = 'INDIVIDUAL' | 'GROUP_SPLIT' | 'GROUP_EXCEL';

interface SplitAllocationRow {
  uid: string;
  rut: string;
  amount: string;
  groupName: string;
  lookupState: 'idle' | 'loading' | 'found' | 'not_found' | 'invalid_rut';
  lookupInfo: PublicParticipantLookupDTO | null;
}

interface SubmissionReceipt {
  success: boolean;
  mode: PaymentMode;
  reference: string;
  paymentDate: string;
  totalAmount: number;
  currency: string;
  eventName: string;
  receiptFileName?: string | null;
  createdCount: number;
  items: Array<{ rut: string; maskedName: string; amount: number }>;
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

export default function PagosPortalPage() {
  const params = useParams<{ eventCode?: string }>();
  const urlEventCode = params?.eventCode
    ? decodeURIComponent(params.eventCode).trim().toUpperCase()
    : '';

  const { toast } = useToast();

  // Events
  const [events, setEvents] = useState<PublicEventDTO[]>([]);
  const [selectedEventCode, setSelectedEventCode] = useState<string>(urlEventCode);
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [eventError, setEventError] = useState<string | null>(null);

  // Payer identification
  const [payerRut, setPayerRut] = useState('');
  const [payerLookupState, setPayerLookupState] = useState<
    'idle' | 'loading' | 'found' | 'not_found' | 'invalid_rut'
  >('idle');
  const [payerLookupInfo, setPayerLookupInfo] =
    useState<PublicParticipantLookupDTO | null>(null);

  // Deposit details
  const [todayIso, setTodayIso] = useState('');
  const [paymentDate, setPaymentDate] = useState('');
  const [transactionReference, setTransactionReference] = useState('');
  const [amount, setAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('TRANSFERENCIA');
  const [branch, setBranch] = useState('');
  const [comments, setComments] = useState('');

  // Receipt file / URL
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [receiptDragging, setReceiptDragging] = useState(false);
  const [showReceiptUrlInput, setShowReceiptUrlInput] = useState(false);
  const [receiptUrl, setReceiptUrl] = useState('');

  // Mode & Group split state
  const [mode, setMode] = useState<PaymentMode>('INDIVIDUAL');
  const rowSeqRef = useRef(2);
  const [splitRows, setSplitRows] = useState<SplitAllocationRow[]>([
    createEmptySplitRow('init_1'),
    createEmptySplitRow('init_2'),
  ]);

  // Group Excel / mass detail
  const [detailFile, setDetailFile] = useState<File | null>(null);
  const [detailDragging, setDetailDragging] = useState(false);
  const [detailNames, setDetailNames] = useState('');

  // Submission state
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitErrorDetails, setSubmitErrorDetails] = useState<string[]>([]);
  const [receiptResult, setReceiptResult] = useState<SubmissionReceipt | null>(
    null
  );

  const errorBannerRef = useRef<HTMLDivElement | null>(null);

  const activeEvent =
    events.find((ev) => ev.code.toUpperCase() === selectedEventCode) || null;
  const currency = activeEvent?.currency || 'USD';

  // Initialize current client date outside prerender
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

  // Load public active events
  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;

    async function loadEvents() {
      try {
        const res = await fetch('/api/public/events', {
          signal: controller.signal,
        });
        if (!res.ok) {
          throw new Error('No se pudieron cargar los eventos activos');
        }
        const data = (await res.json()) as { events?: PublicEventDTO[] };
        if (cancelled) return;

        const list = data.events || [];
        setEvents(list);

        if (list.length === 0) {
          setEventError('No hay eventos activos disponibles en este momento.');
          return;
        }

        if (urlEventCode) {
          const matched = list.find(
            (ev) => ev.code.toUpperCase() === urlEventCode
          );
          if (matched) {
            setSelectedEventCode(matched.code);
            setEventError(null);
          } else {
            setEventError(
              `El código de evento "${urlEventCode}" no está activo o no existe. Selecciona uno de la lista.`
            );
            const fallback = list.find((ev) => ev.isDefault) || list[0];
            setSelectedEventCode(fallback.code);
          }
        } else {
          const defaultEv = list.find((ev) => ev.isDefault) || list[0];
          setSelectedEventCode(defaultEv.code);
        }
      } catch (err: unknown) {
        if (
          !cancelled &&
          !(err instanceof DOMException && err.name === 'AbortError')
        ) {
          setEventError(
            err instanceof Error
              ? err.message
              : 'Error cargando eventos disponibles'
          );
        }
      } finally {
        if (!cancelled) {
          setLoadingEvents(false);
        }
      }
    }

    void loadEvents();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [urlEventCode]);

  const lookupParticipant = useCallback(
    async (
      rutValue: string,
      eventCode: string
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
          body: JSON.stringify({ eventCode, rut: cleaned }),
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
    []
  );

  const handleVerifyPayer = useCallback(
    async (rawRut?: string) => {
      const targetRut = rawRut ?? payerRut;
      if (!targetRut.trim()) {
        setPayerLookupState('idle');
        setPayerLookupInfo(null);
        return;
      }

      const cleaned = cleanRut(targetRut);
      if (!cleaned || !validateRut(cleaned)) {
        setPayerLookupState('invalid_rut');
        setPayerLookupInfo({
          found: false,
          error: 'El RUT ingresado no es válido',
        });
        return;
      }

      setPayerRut(formatRut(cleaned));
      if (!selectedEventCode) return;

      setPayerLookupState('loading');
      const result = await lookupParticipant(cleaned, selectedEventCode);
      setPayerLookupState(result.state);
      setPayerLookupInfo(result.info);
    },
    [payerRut, selectedEventCode, lookupParticipant]
  );

  const handleEventSwitch = (newCode: string) => {
    setSelectedEventCode(newCode);
    setEventError(null);
    setPayerLookupState('idle');
    setPayerLookupInfo(null);
    setSplitRows((prev) =>
      prev.map((row) => ({ ...row, lookupState: 'idle', lookupInfo: null }))
    );
  };

  // File handlers
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

  // Split row handlers
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

    if (!selectedEventCode) return;
    const result = await lookupParticipant(cleaned, selectedEventCode);
    setSplitRows((prev) =>
      prev.map((r) =>
        r.uid === uid
          ? { ...r, lookupState: result.state, lookupInfo: result.info }
          : r
      )
    );
  };

  const handleIncludePayerInSplit = async () => {
    if (!payerRut.trim()) {
      toast.info('Primero ingresa tu RUT en el paso 1');
      return;
    }
    const payerClean = cleanRut(payerRut);
    const alreadyExists = splitRows.some(
      (r) => cleanRut(r.rut) === payerClean
    );
    if (alreadyExists) {
      toast.info('El titular ya está incluido en el desglose');
      return;
    }

    const formatted = formatRut(payerClean);
    const emptyIdx = splitRows.findIndex((r) => !r.rut.trim());
    if (emptyIdx >= 0) {
      const targetUid = splitRows[emptyIdx].uid;
      setSplitRows((prev) =>
        prev.map((r) =>
          r.uid === targetUid
            ? {
                ...r,
                rut: formatted,
                lookupState:
                  payerLookupState === 'found' ? 'found' : 'loading',
                lookupInfo: payerLookupInfo,
              }
            : r
        )
      );
      if (payerLookupState !== 'found') {
        await handleVerifySplitRow(targetUid, formatted);
      }
    } else {
      const newRow = createEmptySplitRow('payer');
      newRow.rut = formatted;
      newRow.lookupState =
        payerLookupState === 'found' ? 'found' : 'loading';
      newRow.lookupInfo = payerLookupInfo;
      setSplitRows((prev) => [newRow, ...prev]);
      if (payerLookupState !== 'found') {
        await handleVerifySplitRow(newRow.uid, formatted);
      }
    }
  };

  // Calculations for GROUP_SPLIT
  const totalAmountNum = Number.parseFloat(amount) || 0;
  const allocatedSum = splitRows.reduce((sum, r) => {
    const val = Number.parseFloat(r.amount);
    return sum + (Number.isFinite(val) && val > 0 ? val : 0);
  }, 0);
  const roundedAllocated = Math.round(allocatedSum * 100) / 100;
  const roundedTotal = Math.round(totalAmountNum * 100) / 100;
  const diffAmount = Math.round((roundedTotal - roundedAllocated) * 100) / 100;
  const isBalanced =
    roundedTotal > 0 && Math.abs(diffAmount) <= 0.01;

  const handleAssignRemainingToRow = (uid: string) => {
    if (roundedTotal <= 0) return;
    const row = splitRows.find((r) => r.uid === uid);
    if (!row) return;
    const currentVal = Number.parseFloat(row.amount) || 0;
    const nextVal = Math.max(0, Math.round((currentVal + diffAmount) * 100) / 100);
    setSplitRows((prev) =>
      prev.map((r) =>
        r.uid === uid ? { ...r, amount: nextVal > 0 ? String(nextVal) : '' } : r
      )
    );
  };

  const scrollToError = () => {
    setTimeout(() => {
      errorBannerRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }, 50);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    setSubmitErrorDetails([]);

    if (!selectedEventCode) {
      setSubmitError('Debes seleccionar un evento activo.');
      scrollToError();
      return;
    }

    const payerCleaned = cleanRut(payerRut);
    if (!payerCleaned || !validateRut(payerCleaned)) {
      setSubmitError('Ingresa un RUT válido en la sección de identificación.');
      scrollToError();
      return;
    }

    if (payerLookupState !== 'found') {
      const check = await lookupParticipant(payerCleaned, selectedEventCode);
      setPayerLookupState(check.state);
      setPayerLookupInfo(check.info);
      if (check.state !== 'found') {
        setSubmitError(
          check.info?.error ||
            'El RUT del titular debe estar inscrito en el evento seleccionado.'
        );
        scrollToError();
        return;
      }
    }

    if (!paymentDate) {
      setSubmitError('Indica la fecha en que realizaste el depósito o transferencia.');
      scrollToError();
      return;
    }

    if (!transactionReference.trim()) {
      setSubmitError('Ingresa el N° de comprobante u operación bancaria.');
      scrollToError();
      return;
    }

    if (roundedTotal <= 0) {
      setSubmitError(`Ingresa el monto total válido en ${currency}.`);
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
          const verified = await lookupParticipant(rClean, selectedEventCode);
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
        'Adjunta el archivo Excel/CSV/PDF con el desglose grupal o escribe el detalle de participantes y montos.'
      );
      scrollToError();
      return;
    }

    try {
      setSubmitting(true);
      const fd = new FormData();
      fd.set('eventCode', selectedEventCode);
      fd.set('mode', mode);
      fd.set('payerRut', formatRut(payerCleaned));
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

      const res = await fetch('/api/public/payments', {
        method: 'POST',
        body: fd,
      });

      const data = (await res.json()) as SubmissionReceipt & {
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

      setReceiptResult(data);
      toast.success(
        mode === 'GROUP_EXCEL'
          ? `Solicitud derivada con ticket ${data.ticketNumber}`
          : `${data.createdCount} abono(s) registrado(s) exitosamente`,
        'Comprobante recibido'
      );
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : 'Error de conexión al enviar pago';
      setSubmitError(msg);
      toast.error(msg);
      scrollToError();
    } finally {
      setSubmitting(false);
    }
  };

  const handleResetForm = () => {
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
    setSplitRows([createEmptySplitRow('init_1'), createEmptySplitRow('init_2')]);
    setPaymentDate(todayIso);
    setMode('INDIVIDUAL');
    setSubmitError(null);
    setSubmitErrorDetails([]);
  };

  return (
    <div className="min-h-screen bg-[#F5F6F8] text-slate-800 flex flex-col font-sans print:bg-white">
      {/* Header Institucional */}
      <header className="bg-white border-b border-slate-200 border-t-4 border-t-[#001558] py-3.5 px-4 sm:px-8 shadow-xs print:hidden">
        <div className="max-w-5xl mx-auto flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="relative w-40 sm:w-44 h-11">
              <Image
                src="/agsch-logo-color.svg"
                alt="Asociación de Guías y Scouts de Chile"
                fill
                priority
                className="object-contain object-left"
              />
            </div>
            <div className="hidden sm:block pl-3 border-l border-slate-200">
              <span className="font-black text-sm text-[#001558] block">
                Portal de Comprobantes de Pago
              </span>
              <p className="text-[11px] text-slate-500">
                Ingreso directo de abonos individuales y grupales • AGSCH
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/ficha-medica"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-50 hover:bg-red-100 border border-red-200 text-red-700 text-xs font-bold transition-colors"
            >
              <Heart className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Ficha Médica</span>
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#EEF2FF] hover:bg-[#001558] text-[#001558] hover:text-white border border-[#001558]/20 text-xs font-bold transition-colors"
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Acceso Equipo</span>
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {/* Pantalla de confirmación */}
        {receiptResult ? (
          <div className="bg-white border border-slate-200 border-t-4 border-t-emerald-600 rounded-3xl shadow-xl p-6 sm:p-8 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-200">
              <div className="flex items-start gap-3.5">
                <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-7 h-7" />
                </div>
                <div>
                  <span className="text-[11px] font-black uppercase tracking-wider text-emerald-700">
                    {receiptResult.mode === 'GROUP_EXCEL'
                      ? 'Nómina Grupal Derivada a Tesorería'
                      : 'Comprobante Acreditado en Sistema'}
                  </span>
                  <h1 className="text-xl sm:text-2xl font-black text-[#001558]">
                    {receiptResult.mode === 'GROUP_EXCEL'
                      ? `Caso CRM ${receiptResult.ticketNumber}`
                      : `¡${receiptResult.createdCount} pago(s) registrado(s)!`}
                  </h1>
                  <p className="text-xs text-slate-600 mt-0.5">
                    {receiptResult.eventName} • Comprobante N°{' '}
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
                  {formatCurrency(receiptResult.totalAmount, receiptResult.currency)}
                </span>
              </div>
              <div className="bg-[#F5F6F8] border border-slate-200 rounded-2xl p-4">
                <span className="text-[10px] font-bold uppercase text-slate-500 block">
                  Fecha del Depósito
                </span>
                <span className="text-base font-bold text-slate-800">
                  {new Date(receiptResult.paymentDate).toLocaleDateString('es-CL', {
                    day: '2-digit',
                    month: 'long',
                    year: 'numeric',
                  })}
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

            {receiptResult.mode === 'GROUP_EXCEL' ? (
              <div className="bg-[#FFFBF0] border border-[#FEB135]/60 rounded-2xl p-4 text-xs text-[#001558] space-y-1.5">
                <p className="font-extrabold">
                  Tu comprobante grupal y nómina fueron recibidos correctamente.
                </p>
                <p className="text-slate-700 leading-relaxed">
                  El equipo de Tesorería revisará tu archivo bajo el ticket{' '}
                  <span className="font-mono font-black">
                    {receiptResult.ticketNumber}
                  </span>{' '}
                  para imputar los montos a cada participante de tu grupo.
                </p>
              </div>
            ) : (
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
                        +{formatCurrency(item.amount, receiptResult.currency)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="pt-2 flex flex-wrap items-center justify-between gap-3 print:hidden">
              <button
                type="button"
                onClick={handleResetForm}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#FEB135] hover:bg-[#e59c22] text-[#001558] font-black text-xs cursor-pointer transition-colors shadow-xs"
              >
                <Plus className="w-4 h-4" />
                Informar Otro Comprobante
              </button>
              <Link
                href="/login"
                className="text-xs font-bold text-[#001558] hover:underline"
              >
                Volver al portal principal
              </Link>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Hero / Event Selector Card */}
            <div className="bg-white border border-slate-200 border-t-4 border-t-[#001558] rounded-3xl p-6 shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#FFF8E1] border border-[#FEB135] text-[#001558] text-[10px] font-black uppercase tracking-wider">
                    <Sparkles className="w-3 h-3" />
                    Ingreso Directo Sin Formularios Externos
                  </span>
                  <h1 className="text-xl sm:text-2xl font-black text-[#001558] tracking-tight">
                    Informar Comprobante de Pago
                  </h1>
                  <p className="text-xs text-slate-600">
                    Registra pagos individuales o depósitos grupales con desglose directo al saldo de cada participante.
                  </p>
                </div>

                {activeEvent && (
                  <div className="bg-[#EEF2FF] border border-[#001558]/20 rounded-2xl px-4 py-2.5 shrink-0 flex items-center gap-2.5">
                    <span className="text-2xl leading-none">
                      {activeEvent.flagEmoji || '🏕️'}
                    </span>
                    <div>
                      <span className="block text-[10px] font-bold uppercase text-slate-500">
                        Evento • Moneda
                      </span>
                      <span className="block text-xs font-black text-[#001558]">
                        {activeEvent.shortName || activeEvent.name} ({activeEvent.currency})
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {loadingEvents ? (
                <div className="flex items-center gap-2 text-xs text-slate-500 py-2">
                  <Loader2 className="w-4 h-4 animate-spin text-[#001558]" />
                  Cargando eventos disponibles...
                </div>
              ) : (
                <div className="space-y-2 pt-2 border-t border-slate-100">
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600">
                    Evento del Contingente *
                  </label>
                  <select
                    value={selectedEventCode}
                    onChange={(e) => handleEventSwitch(e.target.value)}
                    disabled={Boolean(urlEventCode && activeEvent && !eventError)}
                    className={`${INPUT_CLASS} font-bold text-[#001558]`}
                  >
                    {events.map((ev) => (
                      <option key={ev.id} value={ev.code}>
                        {ev.flagEmoji ? `${ev.flagEmoji} ` : ''}
                        {ev.name} ({ev.currency})
                      </option>
                    ))}
                  </select>
                  {eventError && (
                    <p className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 font-medium">
                      {eventError}
                    </p>
                  )}
                </div>
              )}
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

            {/* Paso 1: Identificación del Titular */}
            <section className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs space-y-4">
              <div className="flex items-center gap-2.5 pb-3 border-b border-slate-200">
                <span className="w-7 h-7 rounded-full bg-[#001558] text-[#FEB135] text-xs font-black flex items-center justify-center shrink-0">
                  1
                </span>
                <div>
                  <h2 className="text-sm font-extrabold text-[#001558]">
                    Identificación del Participante o Titular que Informa
                  </h2>
                  <p className="text-[11px] text-slate-500">
                    Si informas un depósito grupal, ingresa el RUT de quien realiza el envío (responsable, dirigente o participante titular).
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-start">
                <div className="sm:col-span-7">
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    RUT del Titular / Participante *
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={payerRut}
                      onChange={(e) => {
                        setPayerRut(e.target.value);
                        if (payerLookupState !== 'idle') {
                          setPayerLookupState('idle');
                          setPayerLookupInfo(null);
                        }
                      }}
                      onBlur={() => void handleVerifyPayer()}
                      placeholder="Ej: 21.345.678-4"
                      required
                      className={`${INPUT_CLASS} font-mono`}
                    />
                    <button
                      type="button"
                      onClick={() => void handleVerifyPayer()}
                      disabled={payerLookupState === 'loading' || !payerRut.trim()}
                      className="px-4 py-2.5 rounded-xl bg-[#001558] hover:bg-[#0b2370] text-white text-xs font-bold shrink-0 cursor-pointer disabled:opacity-50 transition-colors flex items-center gap-1.5"
                    >
                      {payerLookupState === 'loading' ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <UserCheck className="w-3.5 h-3.5 text-[#FEB135]" />
                      )}
                      Verificar
                    </button>
                  </div>
                </div>

                <div className="sm:col-span-5 sm:pt-6">
                  {payerLookupState === 'found' && payerLookupInfo && (
                    <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs space-y-0.5">
                      <div className="flex items-center gap-1.5 font-extrabold">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span>{payerLookupInfo.maskedName}</span>
                        {payerLookupInfo.cupoCode && (
                          <span className="px-1.5 py-0.5 rounded bg-white border border-emerald-300 font-mono text-[10px]">
                            {payerLookupInfo.cupoCode}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-emerald-800">
                        {payerLookupInfo.roleLabel}
                        {payerLookupInfo.scoutGroup
                          ? ` • ${payerLookupInfo.scoutGroup}`
                          : ''}
                      </p>
                    </div>
                  )}

                  {(payerLookupState === 'not_found' ||
                    payerLookupState === 'invalid_rut') && (
                    <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-start gap-1.5 font-medium">
                      <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                      <span>
                        {payerLookupInfo?.error || 'RUT no encontrado'}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </section>

            {/* Paso 2: Datos del Depósito y Comprobante */}
            <section className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs space-y-4">
              <div className="flex items-center gap-2.5 pb-3 border-b border-slate-200">
                <span className="w-7 h-7 rounded-full bg-[#001558] text-[#FEB135] text-xs font-black flex items-center justify-center shrink-0">
                  2
                </span>
                <div>
                  <h2 className="text-sm font-extrabold text-[#001558]">
                    Datos del Depósito o Transferencia
                  </h2>
                  <p className="text-[11px] text-slate-500">
                    Ingresa los datos exactos del comprobante bancario y adjunta la imagen o PDF de respaldo.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Fecha del Depósito *
                  </label>
                  <div className="relative">
                    <Calendar className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
                    <input
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
                  <label className="block font-bold text-slate-700 mb-1">
                    N° de Comprobante / Operación *
                  </label>
                  <input
                    type="text"
                    required
                    value={transactionReference}
                    onChange={(e) => setTransactionReference(e.target.value)}
                    placeholder="Ej: 98451234"
                    className={`${INPUT_CLASS} font-mono`}
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Monto Total ({currency}) *
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 font-bold">
                      $
                    </span>
                    <input
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
                  <label className="block font-bold text-slate-700 mb-1">
                    Método de Pago
                  </label>
                  <select
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
                  <label className="block font-bold text-slate-700 mb-1">
                    Banco / Sucursal (Opcional)
                  </label>
                  <input
                    type="text"
                    value={branch}
                    onChange={(e) => setBranch(e.target.value)}
                    placeholder="Ej: Banco de Chile / Transferencia Web"
                    className={INPUT_CLASS}
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Comentarios Adicionales (Opcional)
                  </label>
                  <input
                    type="text"
                    value={comments}
                    onChange={(e) => setComments(e.target.value)}
                    placeholder="Ej: Cuota #3 + abono kit"
                    className={INPUT_CLASS}
                  />
                </div>
              </div>

              {/* Comprobante File Dropzone */}
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
                    id="public-receipt-file"
                    type="file"
                    accept=".jpg,.jpeg,.png,.webp,.pdf"
                    onChange={(e) => {
                      const picked = e.target.files?.[0];
                      if (picked) handlePickReceiptFile(picked);
                    }}
                    className="hidden"
                  />
                  <label
                    htmlFor="public-receipt-file"
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
                        : 'Se almacena de forma privada y vinculada al abono'}
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
                      placeholder="https://drive.google.com/..."
                      className={INPUT_CLASS}
                    />
                  </div>
                )}
              </div>
            </section>

            {/* Paso 3: Modalidad de Imputación */}
            <section className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs space-y-5">
              <div className="flex items-center gap-2.5 pb-3 border-b border-slate-200">
                <span className="w-7 h-7 rounded-full bg-[#001558] text-[#FEB135] text-xs font-black flex items-center justify-center shrink-0">
                  3
                </span>
                <div>
                  <h2 className="text-sm font-extrabold text-[#001558]">
                    ¿A quién(es) corresponde este comprobante?
                  </h2>
                  <p className="text-[11px] text-slate-500">
                    Elige si es un pago individual o un depósito que cubre a varios participantes (sin usar subformularios externos).
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
                    El 100% del monto se abona al participante titular verificado arriba.
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
                    Ingresa cada RUT participante y asigna cuánto del comprobante va a cada uno.
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
                    Para grupos grandes: adjunta Excel o listado y crea un caso directo en Tesorería.
                  </p>
                </button>
              </div>

              {/* Modo 1: Individual */}
              {mode === 'INDIVIDUAL' && (
                <div className="bg-[#F5F6F8] border border-slate-200 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                  <div>
                    <span className="font-bold text-[#001558] block">
                      Acreditación directa al titular
                    </span>
                    <span className="text-slate-600">
                      {payerLookupState === 'found' && payerLookupInfo
                        ? `${payerLookupInfo.maskedName} (${formatRut(cleanRut(payerRut))})`
                        : payerRut.trim()
                          ? `RUT ${payerRut}`
                          : 'Pendiente ingresar RUT en el paso 1'}
                    </span>
                  </div>
                  <span className="font-mono font-black text-base text-[#001558]">
                    {roundedTotal > 0
                      ? formatCurrency(roundedTotal, currency)
                      : `0 ${currency}`}
                  </span>
                </div>
              )}

              {/* Modo 2: GROUP_SPLIT */}
              {mode === 'GROUP_SPLIT' && (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-extrabold text-[#001558]">
                      Participantes incluidos en el depósito ({splitRows.length})
                    </span>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => void handleIncludePayerInSplit()}
                        className="px-3 py-1.5 rounded-xl bg-[#EEF2FF] hover:bg-[#001558] text-[#001558] hover:text-white text-xs font-bold border border-[#001558]/20 cursor-pointer transition-colors"
                      >
                        + Incluir al titular
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
                                    r.uid === row.uid
                                      ? { ...r, groupName: val }
                                      : r
                                  )
                                );
                              }}
                              placeholder={
                                row.lookupInfo?.scoutGroup || 'Grupo Scout'
                              }
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

                        {/* Verification status pill */}
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

                  {/* Balance Reconciliation Bar */}
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

              {/* Modo 3: GROUP_EXCEL */}
              {mode === 'GROUP_EXCEL' && (
                <div className="space-y-4">
                  <div className="bg-[#FFFBF0] border border-[#FEB135]/60 border-l-4 border-l-[#FEB135] rounded-2xl p-3.5 text-xs text-[#001558]">
                    Esta opción crea un ticket prioritario de Tesorería con tu comprobante y archivo de desglose adjunto, ideal cuando el depósito incluye más de 15–20 personas.
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
                      id="public-detail-file"
                      type="file"
                      accept=".xlsx,.xls,.csv,.txt,.pdf"
                      onChange={(e) => {
                        const picked = e.target.files?.[0];
                        if (picked) handlePickDetailFile(picked);
                      }}
                      className="hidden"
                    />
                    <label
                      htmlFor="public-detail-file"
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
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Listado de Participantes y Montos (opcional si adjuntas Excel)
                    </label>
                    <textarea
                      rows={3}
                      value={detailNames}
                      onChange={(e) => setDetailNames(e.target.value)}
                      placeholder="Ej: 1) Juan Pérez (19.123.456-7) - 100 USD&#10;2) María Soto (20.456.789-K) - 100 USD"
                      className={INPUT_CLASS}
                    />
                  </div>
                </div>
              )}
            </section>

            {/* Submit Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
              <p className="text-[11px] text-slate-600">
                Los datos y comprobantes se registran directamente en la base oficial del evento seleccionado.
              </p>
              <button
                type="submit"
                disabled={submitting || loadingEvents}
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
        )}
      </main>
    </div>
  );
}
