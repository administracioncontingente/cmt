'use client';

import React, { useEffect, useId, useState } from 'react';
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  CreditCard,
  Link2,
  Loader2,
  PlusCircle,
  Search,
  Trash2,
  Upload,
  Users,
  X,
} from 'lucide-react';
import { useToast } from '@/components/ui/ToastProvider';
import { formatCurrency } from '@/lib/finance';
import type { EventSummary, ParticipantDTO } from '@/types/domain';

interface DirectPaymentModalProps {
  isOpen: boolean;
  activeEvent: EventSummary | null;
  currency: string;
  onClose: () => void;
  onSuccess: () => void;
}

interface StaffGroupRow {
  participant: ParticipantDTO;
  amount: string;
  groupName: string;
}

const MAX_FILE_SIZE_BYTES = 4 * 1024 * 1024;
const ALLOWED_EXTS = ['.jpg', '.jpeg', '.png', '.webp', '.pdf'];

const INPUT_CLASS =
  'w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:border-[#001558] focus:ring-2 focus:ring-[#FEB135]/50 focus:outline-none transition-all';

export function DirectPaymentModal({
  isOpen,
  activeEvent,
  currency,
  onClose,
  onSuccess,
}: DirectPaymentModalProps) {
  const titleId = useId();
  const { toast } = useToast();

  const [mode, setMode] = useState<'INDIVIDUAL' | 'GROUP_SPLIT'>('INDIVIDUAL');

  // Shared deposit fields
  const [amount, setAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('TRANSFERENCIA');
  const [transactionReference, setTransactionReference] = useState('');
  const [branch, setBranch] = useState('');
  const [comments, setComments] = useState('');
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [receiptUrl, setReceiptUrl] = useState('');
  const [showUrlField, setShowUrlField] = useState(false);

  // Participant search
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [candidates, setCandidates] = useState<ParticipantDTO[]>([]);

  // Individual selection vs Group allocations
  const [selectedIndividual, setSelectedIndividual] =
    useState<ParticipantDTO | null>(null);
  const [groupRows, setGroupRows] = useState<StaffGroupRow[]>([]);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorDetails, setErrorDetails] = useState<string[]>([]);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    async function syncDefaultDate() {
      await Promise.resolve();
      if (cancelled) return;
      const today = new Date().toISOString().split('T')[0];
      setPaymentDate((prev) => prev || today);
    }
    void syncDefaultDate();

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !submitting) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => {
      cancelled = true;
      window.removeEventListener('keydown', handleKey);
    };
  }, [isOpen, submitting, onClose]);

  useEffect(() => {
    if (!isOpen || !activeEvent?.id) return;
    const trimmed = searchQuery.trim();
    if (trimmed.length < 2) {
      return;
    }

    const controller = new AbortController();
    let cancelled = false;
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(
          `/api/participants?eventId=${encodeURIComponent(activeEvent.id)}&search=${encodeURIComponent(trimmed)}&limit=8`,
          { signal: controller.signal }
        );
        if (!cancelled && res.ok) {
          const data = (await res.json()) as {
            participants?: ParticipantDTO[];
          };
          setCandidates(data.participants || []);
        }
      } catch (err: unknown) {
        if (
          !cancelled &&
          !(err instanceof DOMException && err.name === 'AbortError')
        ) {
          console.error('Error buscando participantes:', err);
        }
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 220);

    return () => {
      cancelled = true;
      clearTimeout(timer);
      controller.abort();
    };
  }, [isOpen, activeEvent?.id, searchQuery]);

  if (!isOpen) return null;

  const totalAmountNum = Math.round((Number.parseFloat(amount) || 0) * 100) / 100;
  const groupSum =
    Math.round(
      groupRows.reduce((acc, r) => {
        const n = Number.parseFloat(r.amount);
        return acc + (Number.isFinite(n) && n > 0 ? n : 0);
      }, 0) * 100
    ) / 100;
  const diffAmount = Math.round((totalAmountNum - groupSum) * 100) / 100;
  const isGroupBalanced = totalAmountNum > 0 && Math.abs(diffAmount) <= 0.01;

  const handlePickFile = (file: File) => {
    const lower = file.name.toLowerCase();
    if (!ALLOWED_EXTS.some((ext) => lower.endsWith(ext))) {
      toast.error('Sube una imagen (JPG, PNG, WebP) o PDF');
      return;
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      toast.error('El archivo supera los 4 MB permitidos');
      return;
    }
    setReceiptFile(file);
  };

  const handleAddCandidate = (p: ParticipantDTO) => {
    if (mode === 'INDIVIDUAL') {
      setSelectedIndividual(p);
      setSearchQuery('');
      setCandidates([]);
      return;
    }

    if (groupRows.some((r) => r.participant.id === p.id)) {
      toast.info(`${p.firstName} ${p.lastName} ya está en el desglose`);
      return;
    }

    setGroupRows((prev) => [
      ...prev,
      {
        participant: p,
        amount: '',
        groupName: p.scoutGroup || '',
      },
    ]);
    setSearchQuery('');
    setCandidates([]);
  };

  const handleSplitEqually = () => {
    if (groupRows.length === 0 || totalAmountNum <= 0) return;
    const count = groupRows.length;
    const baseEach = Math.floor((totalAmountNum / count) * 100) / 100;
    const remainder =
      Math.round((totalAmountNum - baseEach * count) * 100) / 100;

    setGroupRows((prev) =>
      prev.map((row, idx) => ({
        ...row,
        amount: String(
          idx === prev.length - 1
            ? Math.round((baseEach + remainder) * 100) / 100
            : baseEach
        ),
      }))
    );
  };

  const handleAssignRemaining = (participantId: string) => {
    if (totalAmountNum <= 0) return;
    const target = groupRows.find((r) => r.participant.id === participantId);
    if (!target) return;
    const current = Number.parseFloat(target.amount) || 0;
    const nextVal = Math.max(
      0,
      Math.round((current + diffAmount) * 100) / 100
    );
    setGroupRows((prev) =>
      prev.map((r) =>
        r.participant.id === participantId
          ? { ...r, amount: nextVal > 0 ? String(nextVal) : '' }
          : r
      )
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setErrorDetails([]);

    if (!activeEvent?.id) {
      setError('No hay evento activo seleccionado.');
      return;
    }

    if (totalAmountNum <= 0) {
      setError(`El monto debe ser mayor a 0 ${currency}.`);
      return;
    }

    if (mode === 'INDIVIDUAL' && !selectedIndividual) {
      setError('Busca y selecciona el participante al que corresponde el pago.');
      return;
    }

    if (mode === 'GROUP_SPLIT') {
      if (groupRows.length < 2) {
        setError('Un pago grupal requiere al menos 2 participantes.');
        return;
      }
      if (!isGroupBalanced) {
        setError(
          `El desglose (${formatCurrency(groupSum, currency)}) no coincide con el monto total (${formatCurrency(totalAmountNum, currency)}).`
        );
        return;
      }
    }

    try {
      setSubmitting(true);
      const fd = new FormData();
      fd.set('eventId', activeEvent.id);
      fd.set('mode', mode);
      fd.set('amount', String(totalAmountNum));
      fd.set('paymentDate', paymentDate);
      fd.set('paymentMethod', paymentMethod);
      if (transactionReference.trim()) {
        fd.set('transactionReference', transactionReference.trim());
      }
      if (branch.trim()) fd.set('branch', branch.trim());
      if (comments.trim()) fd.set('comments', comments.trim());
      if (receiptFile) fd.set('receiptFile', receiptFile);
      if (receiptUrl.trim()) fd.set('receiptUrl', receiptUrl.trim());

      if (mode === 'INDIVIDUAL' && selectedIndividual) {
        fd.set('participantId', selectedIndividual.id);
        fd.set('payerRut', selectedIndividual.rut);
      } else if (mode === 'GROUP_SPLIT') {
        fd.set(
          'allocations',
          JSON.stringify(
            groupRows.map((r) => ({
              participantId: r.participant.id,
              rut: r.participant.rut,
              amount: Number.parseFloat(r.amount),
              groupName: r.groupName.trim() || undefined,
            }))
          )
        );
      }

      const res = await fetch('/api/payments', {
        method: 'POST',
        body: fd,
      });

      const data = (await res.json()) as {
        success?: boolean;
        createdCount?: number;
        error?: string;
        details?: string[];
      };

      if (!res.ok) {
        setError(data.error || 'No se pudo registrar el pago');
        setErrorDetails(Array.isArray(data.details) ? data.details : []);
        return;
      }

      toast.success(
        `${data.createdCount || 1} pago(s) registrado(s) y saldos actualizados.`
      );
      onSuccess();
      onClose();
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : 'Error al registrar el pago'
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-[#001558]/40 backdrop-blur-xs overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget && !submitting) {
          onClose();
        }
      }}
    >
      <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 bg-[#001558] text-white border-b-4 border-b-[#FEB135] flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-[#FEB135] text-[#001558] flex items-center justify-center shrink-0">
              <PlusCircle className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 id={titleId} className="text-base font-extrabold truncate">
                Registrar Pago Directo (Tesorería)
              </h2>
              <p className="text-xs text-slate-200 truncate">
                {activeEvent?.name || 'Evento activo'} • Individual o grupal con comprobante
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => !submitting && onClose()}
            className="p-2 rounded-xl text-white/75 hover:text-white hover:bg-white/10 transition cursor-pointer"
            aria-label="Cerrar modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mode tabs */}
        <div className="px-6 py-3 bg-[#F5F6F8] border-b border-slate-200 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setMode('INDIVIDUAL')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition cursor-pointer ${
              mode === 'INDIVIDUAL'
                ? 'bg-[#001558] text-white shadow-xs'
                : 'bg-white text-slate-600 border border-slate-200 hover:text-[#001558]'
            }`}
          >
            <CreditCard className="w-3.5 h-3.5 text-[#FEB135]" />
            Pago Individual
          </button>
          <button
            type="button"
            onClick={() => setMode('GROUP_SPLIT')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition cursor-pointer ${
              mode === 'GROUP_SPLIT'
                ? 'bg-[#001558] text-white shadow-xs'
                : 'bg-white text-slate-600 border border-slate-200 hover:text-[#001558]'
            }`}
          >
            <Users className="w-3.5 h-3.5 text-[#FEB135]" />
            Pago Grupal (Desglose Múltiple)
          </button>
        </div>

        {/* Form Body */}
        <form
          onSubmit={handleSubmit}
          className="p-6 overflow-y-auto space-y-5 flex-1 text-xs"
        >
          {error && (
            <div
              role="alert"
              className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-800 space-y-1"
            >
              <div className="flex items-start gap-2 font-bold">
                <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
              {errorDetails.length > 0 && (
                <ul className="list-disc pl-6 text-[11px]">
                  {errorDetails.map((d, i) => (
                    <li key={i}>{d}</li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {/* Deposit details */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Monto Total ({currency}) *
              </label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="150.00"
                className={`${INPUT_CLASS} font-mono font-bold`}
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Fecha del Pago *
              </label>
              <div className="relative">
                <Calendar className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
                <input
                  type="date"
                  required
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                  className={`${INPUT_CLASS} pl-8`}
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
                <option value="TRANSFERENCIA">Transferencia</option>
                <option value="DEPOSITO">Depósito</option>
                <option value="TARJETA">Tarjeta / Webpay</option>
                <option value="EFECTIVO">Efectivo</option>
                <option value="TRASPASO">Traspaso</option>
                <option value="DEVOLUCION">Devolución</option>
                <option value="OTRO">Otro</option>
              </select>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">
                N° Operación / Comprobante
              </label>
              <input
                type="text"
                value={transactionReference}
                onChange={(e) => setTransactionReference(e.target.value)}
                placeholder="Ej: 546936"
                className={`${INPUT_CLASS} font-mono`}
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Sucursal / Banco
              </label>
              <input
                type="text"
                value={branch}
                onChange={(e) => setBranch(e.target.value)}
                placeholder="Opcional"
                className={INPUT_CLASS}
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Notas / Observaciones
              </label>
              <input
                type="text"
                value={comments}
                onChange={(e) => setComments(e.target.value)}
                placeholder="Observaciones internas"
                className={INPUT_CLASS}
              />
            </div>
          </div>

          {/* Participant search & assignment */}
          <div className="bg-[#F5F6F8] border border-slate-200 rounded-2xl p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className="font-extrabold text-[#001558] uppercase tracking-wider text-[11px]">
                {mode === 'INDIVIDUAL'
                  ? 'Participante a acreditar *'
                  : `Buscar y agregar participantes (${groupRows.length})`}
              </label>
              {mode === 'GROUP_SPLIT' && groupRows.length >= 2 && totalAmountNum > 0 && (
                <button
                  type="button"
                  onClick={handleSplitEqually}
                  className="px-2.5 py-1 rounded-lg bg-white hover:bg-[#FFFBF0] border border-[#FEB135] text-[#001558] text-[11px] font-bold cursor-pointer"
                >
                  Repartir partes iguales
                </button>
              )}
            </div>

            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  const val = e.target.value;
                  setSearchQuery(val);
                  if (val.trim().length < 2) {
                    setCandidates([]);
                  }
                }}
                placeholder="Buscar por nombre, RUT o código cupo (mín. 2 caracteres)..."
                className={`${INPUT_CLASS} pl-9`}
              />
              {searching && (
                <Loader2 className="w-4 h-4 animate-spin text-[#001558] absolute right-3 top-2.5" />
              )}
            </div>

            {candidates.length > 0 && (
              <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-100 max-h-44 overflow-y-auto shadow-sm">
                {candidates.map((p) => {
                  const paid = p.financial?.totalPaid ?? p.totalPaidSheet ?? 0;
                  const target =
                    p.targetFeeUSD ?? p.financial?.totalRequired ?? 0;
                  const rem = Math.max(0, target - paid);
                  return (
                    <button
                      type="button"
                      key={p.id}
                      onClick={() => handleAddCandidate(p)}
                      className="w-full px-3 py-2 text-left hover:bg-[#FFFBF0] flex items-center justify-between gap-2 cursor-pointer transition-colors"
                    >
                      <div className="min-w-0">
                        <span className="font-bold text-[#001558] block truncate">
                          {p.firstName} {p.lastName} {p.secondLastName || ''}
                        </span>
                        <span className="text-[11px] text-slate-500 font-mono">
                          {p.rut}
                          {p.cupoCode ? ` • ${p.cupoCode}` : ''}
                          {p.scoutGroup ? ` • ${p.scoutGroup}` : ''}
                        </span>
                      </div>
                      <span className="text-[11px] font-mono font-bold text-slate-600 shrink-0">
                        Saldo: {formatCurrency(rem, currency)}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Selected Individual */}
            {mode === 'INDIVIDUAL' && selectedIndividual && (
              <div className="bg-white border border-emerald-200 rounded-xl p-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <div>
                    <span className="font-bold text-[#001558] block">
                      {selectedIndividual.firstName} {selectedIndividual.lastName}
                    </span>
                    <span className="font-mono text-[11px] text-slate-500">
                      {selectedIndividual.rut}
                      {selectedIndividual.scoutGroup
                        ? ` • ${selectedIndividual.scoutGroup}`
                        : ''}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedIndividual(null)}
                  className="text-xs font-bold text-red-600 hover:underline cursor-pointer"
                >
                  Cambiar
                </button>
              </div>
            )}

            {/* Group Split Rows */}
            {mode === 'GROUP_SPLIT' && (
              <div className="space-y-2">
                {groupRows.length === 0 ? (
                  <p className="text-[11px] text-slate-500 py-2 text-center">
                    Usa el buscador de arriba para añadir 2 o más participantes al desglose.
                  </p>
                ) : (
                  groupRows.map((row) => (
                    <div
                      key={row.participant.id}
                      className="bg-white border border-slate-200 rounded-xl p-2.5 grid grid-cols-1 sm:grid-cols-12 gap-2 items-center"
                    >
                      <div className="sm:col-span-5 min-w-0">
                        <span className="font-bold text-[#001558] block truncate">
                          {row.participant.firstName} {row.participant.lastName}
                        </span>
                        <span className="font-mono text-[10px] text-slate-500">
                          {row.participant.rut}
                          {row.groupName ? ` • ${row.groupName}` : ''}
                        </span>
                      </div>
                      <div className="sm:col-span-4">
                        <input
                          type="number"
                          step="0.01"
                          min="0.01"
                          value={row.amount}
                          onChange={(e) => {
                            const val = e.target.value;
                            setGroupRows((prev) =>
                              prev.map((r) =>
                                r.participant.id === row.participant.id
                                  ? { ...r, amount: val }
                                  : r
                              )
                            );
                          }}
                          placeholder={`Monto ${currency}`}
                          className={`${INPUT_CLASS} font-mono font-bold py-1.5`}
                        />
                      </div>
                      <div className="sm:col-span-3 flex items-center justify-end gap-1.5">
                        {Math.abs(diffAmount) > 0.01 && totalAmountNum > 0 && (
                          <button
                            type="button"
                            onClick={() =>
                              handleAssignRemaining(row.participant.id)
                            }
                            className="px-2 py-1 rounded-lg bg-[#FFFBF0] border border-[#FEB135] text-[#001558] text-[10px] font-bold cursor-pointer"
                          >
                            Cuadrar
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() =>
                            setGroupRows((prev) =>
                              prev.filter(
                                (r) => r.participant.id !== row.participant.id
                              )
                            )
                          }
                          className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 cursor-pointer"
                          title="Quitar del desglose"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))
                )}

                {groupRows.length > 0 && (
                  <div
                    className={`rounded-xl px-3.5 py-2.5 border flex flex-wrap items-center justify-between gap-2 text-[11px] font-bold ${
                      isGroupBalanced
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                        : 'bg-[#FFFBF0] border-[#FEB135] text-[#001558]'
                    }`}
                  >
                    <span>
                      Asignado: {formatCurrency(groupSum, currency)} /{' '}
                      {formatCurrency(totalAmountNum, currency)}
                    </span>
                    <span>
                      {isGroupBalanced
                        ? '✓ Cuadratura exacta'
                        : `Diferencia: ${formatCurrency(diffAmount, currency)}`}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Optional Receipt Upload */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="font-bold text-slate-700">
                Comprobante Adjunto (Opcional • Máx. 4 MB)
              </label>
              <button
                type="button"
                onClick={() => setShowUrlField((v) => !v)}
                className="text-[11px] font-bold text-[#001558] hover:underline flex items-center gap-1 cursor-pointer"
              >
                <Link2 className="w-3 h-3" />
                {showUrlField ? 'Ocultar enlace' : 'Usar enlace HTTPS'}
              </button>
            </div>

            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragging(false);
                const f = e.dataTransfer.files?.[0];
                if (f) handlePickFile(f);
              }}
              className={`border-2 border-dashed rounded-xl p-3.5 text-center transition-colors ${
                isDragging
                  ? 'border-[#001558] bg-[#FFFBF0]'
                  : 'border-slate-300 bg-[#F5F6F8]'
              }`}
            >
              <input
                id="staff-receipt-upload"
                type="file"
                accept=".jpg,.jpeg,.png,.webp,.pdf"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handlePickFile(f);
                }}
                className="hidden"
              />
              <label
                htmlFor="staff-receipt-upload"
                className="cursor-pointer inline-flex items-center gap-2 text-xs font-bold text-[#001558]"
              >
                <Upload className="w-4 h-4 text-[#FEB135]" />
                {receiptFile
                  ? `${receiptFile.name} (${Math.max(1, Math.round(receiptFile.size / 1024))} KB)`
                  : 'Arrastra o haz clic para adjuntar comprobante (JPG, PNG, WebP, PDF)'}
              </label>
              {receiptFile && (
                <button
                  type="button"
                  onClick={() => setReceiptFile(null)}
                  className="ml-3 text-[11px] text-red-700 font-bold hover:underline cursor-pointer"
                >
                  Quitar
                </button>
              )}
            </div>

            {showUrlField && (
              <input
                type="url"
                value={receiptUrl}
                onChange={(e) => setReceiptUrl(e.target.value)}
                placeholder="https://..."
                className={INPUT_CLASS}
              />
            )}
          </div>

          {/* Footer Buttons */}
          <div className="pt-4 border-t border-slate-200 flex justify-end gap-2.5">
            <button
              type="button"
              onClick={() => !submitting && onClose()}
              className="px-4 py-2 rounded-xl bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 text-xs font-bold cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 rounded-xl bg-[#001558] hover:bg-[#0b2370] text-white text-xs font-extrabold flex items-center gap-1.5 shadow-xs disabled:opacity-50 cursor-pointer"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Guardando...
                </>
              ) : (
                <>
                  <PlusCircle className="w-4 h-4 text-[#FEB135]" />
                  {mode === 'GROUP_SPLIT'
                    ? 'Registrar Pago Grupal'
                    : 'Registrar Abono'}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
