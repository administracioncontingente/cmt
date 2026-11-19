'use client';

import React, { useState } from 'react';
import {
  X,
  CreditCard,
  User,
  Calendar,
  AlertCircle,
  CheckCircle2,
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
  QrCode,
  Share2,
  Printer,
  Globe,
  Droplet,
  Pill,
  Syringe,
  AlertTriangle,
  FileText,
} from 'lucide-react';
import { formatUSD, FinancialSummary } from '@/lib/finance';

interface ParticipantDetailModalProps {
  participantId: string;
  onClose: () => void;
  onParticipantUpdated: () => void;
}

export function ParticipantDetailModal({
  participantId,
  onClose,
  onParticipantUpdated,
}: ParticipantDetailModalProps) {
  const [activeTab, setActiveTab] = useState<'finance' | 'profile' | 'logistics' | 'medical'>('finance');
  const [medLang, setMedLang] = useState<'es' | 'en' | 'pl'>('es');
  const [copiedLink, setCopiedLink] = useState(false);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCalendarPreview, setShowCalendarPreview] = useState(false);

  // Form states for new payment
  const [submittingPayment, setSubmittingPayment] = useState(false);
  const [amount, setAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [paymentMethod, setPaymentMethod] = useState('TRANSFERENCIA');
  const [transactionReference, setTransactionReference] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [deletingPaymentId, setDeletingPaymentId] = useState<string | null>(null);

  const fetchDetail = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/participants/${participantId}`);
      if (!res.ok) throw new Error('Error al cargar datos del participante');
      const json = await res.json();
      setData(json.participant);
    } catch (err: any) {
      setError(err.message || 'Error inesperado');
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    fetchDetail();
  }, [participantId]);

  const handleRegisterPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setPaymentError(null);

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      setPaymentError('Por favor ingresa un monto válido mayor a 0 USD');
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

      const resData = await res.json();
      if (!res.ok) {
        throw new Error(resData.error || 'Error al registrar el abono');
      }

      setAmount('');
      setTransactionReference('');
      setPaymentNotes('');
      setData(resData.participant);
      onParticipantUpdated();
    } catch (err: any) {
      setPaymentError(err.message || 'Error al procesar el abono');
    } finally {
      setSubmittingPayment(false);
    }
  };

  const handleDeletePayment = async (paymentId: string) => {
    if (!confirm('¿Estás seguro de anular este abono? El saldo se actualizará automáticamente.')) {
      return;
    }

    try {
      setDeletingPaymentId(paymentId);
      const res = await fetch(
        `/api/participants/${participantId}/payments?paymentId=${paymentId}`,
        { method: 'DELETE' }
      );
      const resData = await res.json();
      if (!res.ok) throw new Error(resData.error || 'Error al anular abono');
      setData(resData.participant);
      onParticipantUpdated();
    } catch (err: any) {
      alert(err.message || 'Error al anular el abono');
    } finally {
      setDeletingPaymentId(null);
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
        <div className="bg-[#001558] border border-[#0d349e] rounded-2xl p-8 max-w-md w-full text-center shadow-2xl">
          <Loader2 className="w-8 h-8 text-[#FEB135] animate-spin mx-auto mb-3" />
          <p className="text-slate-200 text-sm font-medium">Cargando ficha oficial del participante...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
        <div className="bg-[#001558] border border-[#0d349e] rounded-2xl p-6 max-w-md w-full text-center shadow-2xl">
          <p className="text-red-300 text-sm mb-4">{error || 'No se encontró el participante'}</p>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-[#000c33] hover:bg-[#031c6a] text-white rounded-xl text-xs font-bold"
          >
            Cerrar
          </button>
        </div>
      </div>
    );
  }

  const fin: FinancialSummary = data.financial;
  const targetFee = data.targetFeeUSD || fin.totalRequired;
  const remainingFee = Math.max(0, targetFee - fin.totalPaid);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-3 sm:p-6 overflow-y-auto">
      <div className="bg-[#001558] border border-[#0d349e] rounded-2xl shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#0d349e] flex items-center justify-between bg-[#000c33]/70">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-[#000c33] border border-[#FEB135]/50 flex items-center justify-center text-[#FEB135] font-black text-lg shadow-md shrink-0">
              {data.firstName[0]}
              {data.lastName[0]}
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-black text-white tracking-tight">
                  {data.firstName} {data.lastName} {data.secondLastName || ''}
                </h2>
                {data.cupoCode && (
                  <span className="font-mono text-xs px-2 py-0.5 rounded bg-[#000c33] text-[#FEB135] border border-[#FEB135]/50 font-bold">
                    Cupo: {data.cupoCode}
                  </span>
                )}
                <span className="font-mono text-xs px-2 py-0.5 rounded bg-[#000c33] text-slate-200 border border-[#0d349e]">
                  {data.rut}
                </span>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-[#031c6a] text-indigo-200 border border-[#0d349e]">
                  {data.contingentRole}
                </span>
                {data.financialStatusSheet && (
                  <span
                    className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${
                      data.financialStatusSheet === 'Total Pagado'
                        ? 'bg-[#000c33] text-[#FEB135] border-[#FEB135]/60'
                        : data.financialStatusSheet === 'Adeuda'
                        ? 'bg-red-950 text-red-200 border-red-700'
                        : data.financialStatusSheet === 'BAJA'
                        ? 'bg-slate-800 text-slate-300 border-slate-700'
                        : 'bg-emerald-950 text-emerald-200 border-emerald-700'
                    }`}
                  >
                    {data.financialStatusSheet}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                {data.scoutGroup ? `${data.scoutGroup} • ` : ''}
                {data.scoutDistrict ? `Distrito ${data.scoutDistrict} • ` : ''}
                {data.scoutZone ? `Zona ${data.scoutZone}` : ''}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-[#000c33] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab navigation */}
        <div className="flex border-b border-[#0d349e] px-6 bg-[#000c33]/40">
          <button
            onClick={() => setActiveTab('finance')}
            className={`py-3 px-4 text-xs font-bold flex items-center gap-2 border-b-2 transition-colors cursor-pointer ${
              activeTab === 'finance'
                ? 'border-[#FEB135] text-[#FEB135]'
                : 'border-transparent text-slate-300 hover:text-white'
            }`}
          >
            <CreditCard className="w-4 h-4" />
            Finanzas y Abonos ({formatUSD(fin.totalPaid)} / {formatUSD(targetFee)})
          </button>
          <button
            onClick={() => setActiveTab('profile')}
            className={`py-3 px-4 text-xs font-bold flex items-center gap-2 border-b-2 transition-colors cursor-pointer ${
              activeTab === 'profile'
                ? 'border-[#FEB135] text-[#FEB135]'
                : 'border-transparent text-slate-300 hover:text-white'
            }`}
          >
            <User className="w-4 h-4" />
            Ficha Personal y Apoderado
          </button>
          <button
            onClick={() => setActiveTab('logistics')}
            className={`py-3 px-4 text-xs font-bold flex items-center gap-2 border-b-2 transition-colors cursor-pointer ${
              activeTab === 'logistics'
                ? 'border-[#FEB135] text-[#FEB135]'
                : 'border-transparent text-slate-300 hover:text-white'
            }`}
          >
            <Tent className="w-4 h-4" />
            Logística & Asignación
          </button>
          <button
            onClick={() => setActiveTab('medical')}
            className={`py-3 px-4 text-xs font-bold flex items-center gap-2 border-b-2 transition-colors cursor-pointer ${
              activeTab === 'medical'
                ? 'border-[#FEB135] text-[#FEB135]'
                : 'border-transparent text-slate-300 hover:text-white'
            }`}
          >
            <Heart className="w-4 h-4 text-red-400" />
            Ficha Médica WSJ
            {data.medicalRecord?.completionStatus === 'COMPLETED' ? (
              <span className="w-2 h-2 rounded-full bg-emerald-400" title="Ficha completada" />
            ) : (
              <span className="w-2 h-2 rounded-full bg-amber-400" title="Ficha pendiente" />
            )}
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-xs bg-[#001558]">
          {activeTab === 'finance' && (
            <>
              {/* Summary Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-[#000c33]/80 p-3.5 rounded-xl border border-[#0d349e]">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    Cuota Oficial Final
                  </span>
                  <p className="text-xl font-black text-white mt-1">
                    {formatUSD(targetFee)}
                  </p>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    {data.feeType || 'Cuota asignada'}
                  </p>
                </div>

                <div className="bg-[#000c33]/80 p-3.5 rounded-xl border border-[#0d349e]">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    Total Abonado Real
                  </span>
                  <p className="text-xl font-black text-[#FEB135] mt-1">
                    {formatUSD(fin.totalPaid)}
                  </p>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    {targetFee > 0
                      ? `${Math.round((fin.totalPaid / targetFee) * 100)}% de la meta`
                      : '0%'}
                  </p>
                </div>

                <div className="bg-[#000c33]/80 p-3.5 rounded-xl border border-[#0d349e]">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    Saldo Restante
                  </span>
                  <p className="text-xl font-black text-slate-200 mt-1">
                    {formatUSD(remainingFee)}
                  </p>
                  <p className="text-[10px] text-slate-400 mt-0.5">Por recaudar</p>
                </div>

                <div
                  className={`p-3.5 rounded-xl border ${
                    data.financialStatusSheet === 'Adeuda' || fin.isOverdue
                      ? 'bg-red-950/70 border-red-700'
                      : 'bg-[#000c33]/80 border-[#0d349e]'
                  }`}
                >
                  <span className="text-[11px] font-bold uppercase text-slate-400 tracking-wider">
                    Situación en Planilla
                  </span>
                  <div className="flex items-center gap-1.5 mt-1">
                    <span className="text-base font-black text-white">
                      {data.financialStatusSheet || (fin.isFullyPaid ? 'Total Pagado' : 'Al Día')}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-300 mt-0.5">
                    {data.debtToDateUSD && data.debtToDateUSD > 0
                      ? `Deuda a fecha: ${formatUSD(data.debtToDateUSD)}`
                      : 'Sin deudas vencidas'}
                  </p>
                </div>
              </div>

              {/* Fee Information & Calendar */}
              {(data.feeType || data.calendarUrl || data.overpaymentUSD > 0) && (
                <div className="space-y-3">
                  <div className="bg-[#000c33]/70 border border-[#0d349e] rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        Modalidad de Inscripción
                      </span>
                      <p className="text-white font-bold text-sm">
                        {data.feeEnrollmentType || data.feeType || 'Estándar'}
                      </p>
                      {data.overpaymentUSD > 0 && (
                        <p className="text-[#FEB135] text-xs mt-0.5 font-bold">
                          Sobrepago registrado: {formatUSD(data.overpaymentUSD)}
                        </p>
                      )}
                    </div>
                    {data.calendarUrl && (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setShowCalendarPreview(!showCalendarPreview)}
                          className="px-3.5 py-1.5 bg-[#FEB135] hover:bg-[#e59c22] text-[#001558] rounded-lg text-xs font-black flex items-center gap-1.5 shadow-sm cursor-pointer transition-colors"
                        >
                          <Calendar className="w-3.5 h-3.5" />
                          {showCalendarPreview ? 'Ocultar Calendario' : 'Ver Calendario Oficial'}
                        </button>
                        <a
                          href={data.calendarUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1.5 bg-[#001558] hover:bg-[#031c6a] text-slate-300 hover:text-white rounded-lg border border-[#0d349e] transition-colors"
                          title="Abrir imagen local en pestaña nueva"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      </div>
                    )}
                  </div>

                  {showCalendarPreview && data.calendarUrl && (
                    <div className="bg-[#000c33] border border-[#FEB135]/40 rounded-xl p-4 animate-in fade-in zoom-in-95 duration-150">
                      <div className="flex justify-between items-center mb-3 pb-2 border-b border-[#0d349e]">
                        <span className="text-xs font-bold text-[#FEB135] flex items-center gap-1.5">
                          <Calendar className="w-4 h-4" />
                          Calendario Oficial de Cuotas ({data.feeEnrollmentType || data.feeType || 'Participante'})
                        </span>
                        <div className="flex items-center gap-2">
                          <a
                            href={data.calendarUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[11px] text-[#FEB135] hover:underline flex items-center gap-1 mr-2"
                          >
                            <ExternalLink className="w-3 h-3" />
                            Pantalla completa
                          </a>
                          <button
                            type="button"
                            onClick={() => setShowCalendarPreview(false)}
                            className="text-slate-400 hover:text-white text-xs px-2 py-0.5 rounded bg-[#001558] cursor-pointer"
                          >
                            Cerrar ✕
                          </button>
                        </div>
                      </div>
                      <div className="flex justify-center p-2 bg-[#001558]/40 rounded-lg border border-[#0d349e]">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={data.calendarUrl}
                          alt="Calendario de Cuotas Oficial"
                          className="max-h-96 w-auto rounded object-contain shadow-lg"
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Form to Register New Payment */}
              <div className="bg-[#000c33]/90 border border-[#0d349e] rounded-xl p-4 shadow-inner">
                <h3 className="text-xs font-bold text-[#FEB135] uppercase tracking-wider mb-3 flex items-center gap-2">
                  <PlusCircle className="w-4 h-4 text-[#FEB135]" />
                  Registrar Nuevo Abono / Pago Bancario
                </h3>

                {paymentError && (
                  <div className="mb-3 p-2.5 rounded-lg bg-red-950/80 border border-red-700 text-red-200 text-xs">
                    {paymentError}
                  </div>
                )}

                <form onSubmit={handleRegisterPayment} className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-300 mb-1">
                      Monto Abono (USD)*
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
                        className="w-full pl-6 pr-2 py-2 bg-[#001558] border border-[#0d349e] rounded-lg text-white font-mono text-xs focus:ring-2 focus:ring-[#FEB135] focus:outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-300 mb-1">
                      Fecha del Pago*
                    </label>
                    <input
                      type="date"
                      required
                      value={paymentDate}
                      onChange={(e) => setPaymentDate(e.target.value)}
                      className="w-full px-2.5 py-2 bg-[#001558] border border-[#0d349e] rounded-lg text-white text-xs focus:ring-2 focus:ring-[#FEB135] focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-300 mb-1">
                      Método de Pago
                    </label>
                    <select
                      value={paymentMethod}
                      onChange={(e) => setPaymentMethod(e.target.value)}
                      className="w-full px-2.5 py-2 bg-[#001558] border border-[#0d349e] rounded-lg text-white text-xs focus:ring-2 focus:ring-[#FEB135] focus:outline-none font-medium"
                    >
                      <option value="TRANSFERENCIA">Transferencia Bancaria</option>
                      <option value="TARJETA">Tarjeta / Webpay</option>
                      <option value="DEPOSITO">Depósito</option>
                      <option value="EFECTIVO">Efectivo</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-300 mb-1">
                      N° Operación / Transf.
                    </label>
                    <input
                      type="text"
                      value={transactionReference}
                      onChange={(e) => setTransactionReference(e.target.value)}
                      placeholder="Ej: 546936"
                      className="w-full px-2.5 py-2 bg-[#001558] border border-[#0d349e] rounded-lg text-white text-xs focus:ring-2 focus:ring-[#FEB135] focus:outline-none"
                    />
                  </div>

                  <div className="sm:col-span-3">
                    <label className="block text-[11px] font-bold text-slate-300 mb-1">
                      Notas / Observaciones
                    </label>
                    <input
                      type="text"
                      value={paymentNotes}
                      onChange={(e) => setPaymentNotes(e.target.value)}
                      placeholder="Observaciones de comprobante bancario"
                      className="w-full px-2.5 py-2 bg-[#001558] border border-[#0d349e] rounded-lg text-white text-xs focus:ring-2 focus:ring-[#FEB135] focus:outline-none"
                    />
                  </div>

                  <div className="flex items-end">
                    <button
                      type="submit"
                      disabled={submittingPayment}
                      className="w-full py-2 px-4 rounded-lg bg-[#FEB135] hover:bg-[#e59c22] active:bg-[#cc8610] text-[#001558] font-black text-xs flex items-center justify-center gap-1.5 transition-all shadow-md shadow-[#FEB135]/20 disabled:opacity-50 cursor-pointer uppercase tracking-wider"
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

              {/* Payments History List */}
              <div>
                <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-[#FEB135]" />
                  Historial de Abonos Registrados ({data.payments?.length || 0})
                </h3>

                {(!data.payments || data.payments.length === 0) ? (
                  <div className="bg-[#000c33]/40 rounded-xl p-4 text-center border border-[#0d349e] text-xs text-slate-400">
                    No se han registrado abonos para este participante aún.
                  </div>
                ) : (
                  <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                    {data.payments.map((p: any) => (
                      <div
                        key={p.id}
                        className="bg-[#000c33]/80 border border-[#0d349e] rounded-xl p-3 flex items-center justify-between hover:border-[#FEB135]/40 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-[#001558] border border-[#FEB135]/40 text-[#FEB135] flex items-center justify-center font-black text-xs">
                            $
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-black text-[#FEB135] text-sm font-mono">
                                +{formatUSD(p.amount)}
                              </span>
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#001558] text-slate-200 font-semibold border border-[#0d349e]">
                                {p.paymentMethod}
                              </span>
                              {p.transactionReference && (
                                <span className="text-[10px] font-mono text-[#FEB135] bg-[#001558] px-1.5 py-0.5 rounded border border-[#0d349e]">
                                  Doc: {p.transactionReference}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 text-[11px] text-slate-300 mt-0.5">
                              <span>
                                {new Date(p.paymentDate).toLocaleDateString('es-CL', {
                                  year: 'numeric',
                                  month: 'short',
                                  day: 'numeric',
                                })}
                              </span>
                              {p.notes && <span>• {p.notes}</span>}
                            </div>
                          </div>
                        </div>

                        <button
                          onClick={() => handleDeletePayment(p.id)}
                          disabled={deletingPaymentId === p.id}
                          title="Anular abono"
                          className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-950/40 rounded-lg transition-colors cursor-pointer"
                        >
                          {deletingPaymentId === p.id ? (
                            <Loader2 className="w-4 h-4 animate-spin text-red-400" />
                          ) : (
                            <Trash2 className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

          {activeTab === 'profile' && (
            <div className="space-y-4">
              {/* Personal Data */}
              <div className="bg-[#000c33]/70 border border-[#0d349e] rounded-xl p-4">
                <h3 className="text-xs font-bold text-[#FEB135] uppercase tracking-wider mb-3 flex items-center gap-2">
                  <User className="w-4 h-4" />
                  Datos Personales
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <span className="text-slate-400 block text-[11px]">RUT</span>
                    <span className="font-mono text-white font-bold">{data.rut}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">Nombres y Apellidos</span>
                    <span className="text-white font-bold">
                      {data.firstName} {data.lastName} {data.secondLastName || ''}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">Correo Electrónico</span>
                    <span className="text-slate-200 flex items-center gap-1 font-medium">
                      <Mail className="w-3 h-3 text-slate-400" /> {data.email}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">Teléfono / WhatsApp</span>
                    <span className="text-slate-200 flex items-center gap-1 font-medium">
                      <Phone className="w-3 h-3 text-slate-400" /> {data.phone || 'No registrado'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">Fecha de Nacimiento</span>
                    <span className="text-slate-200 font-medium">
                      {data.birthDate
                        ? new Date(data.birthDate).toLocaleDateString('es-CL')
                        : 'No registrada'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">Género</span>
                    <span className="text-slate-200 font-medium">{data.gender || 'No registrado'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">Dirección</span>
                    <span className="text-slate-200 font-medium">{data.address || 'No registrada'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">Comuna / Ciudad</span>
                    <span className="text-slate-200 font-medium">
                      {data.commune ? `${data.commune}` : ''}
                      {data.city ? ` - ${data.city}` : ''}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">Nacionalidad</span>
                    <span className="text-slate-200 font-medium">{data.nationality || 'Chilena'}</span>
                  </div>
                </div>

                {data.idCardUrl && (
                  <div className="mt-3 pt-3 border-t border-[#0d349e] flex items-center justify-between">
                    <span className="text-slate-300 font-medium">Cédula de Identidad en Google Drive:</span>
                    <a
                      href={data.idCardUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-1.5 bg-[#001558] hover:bg-[#031c6a] text-[#FEB135] rounded-lg text-xs font-bold border border-[#FEB135]/40 flex items-center gap-1.5"
                    >
                      <ExternalLink className="w-3 h-3" />
                      Ver Cédula Digital
                    </a>
                  </div>
                )}
              </div>

              {/* Guardian Info */}
              <div className="bg-[#000c33]/70 border border-[#0d349e] rounded-xl p-4">
                <h3 className="text-xs font-bold text-[#FEB135] uppercase tracking-wider mb-3 flex items-center gap-2">
                  <Phone className="w-4 h-4" />
                  Apoderado / Contacto de Emergencia
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <span className="text-slate-400 block text-[11px]">Nombre del Apoderado</span>
                    <span className="text-white font-bold">
                      {data.guardianName || 'No registrado'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">Teléfono Apoderado</span>
                    <span className="text-slate-200 font-medium">
                      {data.guardianPhone || 'No registrado'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">Correo Apoderado</span>
                    <span className="text-slate-200 font-medium">
                      {data.guardianEmail || 'No registrado'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Previous Events */}
              {data.previousEvents && (
                <div className="bg-[#000c33]/70 border border-[#0d349e] rounded-xl p-4">
                  <h3 className="text-xs font-bold text-cyan-300 uppercase tracking-wider mb-2 flex items-center gap-2">
                    <Award className="w-4 h-4" />
                    Eventos Anteriores
                  </h3>
                  <p className="text-slate-200">{data.previousEvents}</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'logistics' && (
            <div className="space-y-4">
              {/* Contingent and Unit Allocation */}
              <div className="bg-[#000c33]/70 border border-[#0d349e] rounded-xl p-4">
                <h3 className="text-xs font-bold text-[#FEB135] uppercase tracking-wider mb-3 flex items-center gap-2">
                  <Tent className="w-4 h-4" />
                  Asignación en Contingente Polonia 2027
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <span className="text-slate-400 block text-[11px]">Código Único de Cupo</span>
                    <span className="font-mono text-[#FEB135] font-black text-sm">
                      {data.cupoCode || 'Sin cupo asignado'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">Territorio (Macro-zona)</span>
                    <span className="text-white font-bold">
                      {data.territorium || 'Por asignar'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">Talla de Indumentaria / Kit</span>
                    <span className="text-[#FEB135] font-black text-sm">
                      {data.uniformSize || 'No registrada'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">Unidad de Contingente</span>
                    <span className="text-white font-bold">
                      {data.unitName || data.unit || 'Por asignar'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">Patrulla de Contingente</span>
                    <span className="text-white font-bold">
                      {data.patrolName || data.patrol || 'Por asignar'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">Registro Oficial en Polonia</span>
                    <span className="text-slate-200 font-bold">
                      {data.polandRegistered || 'En proceso'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Scout Structure */}
              <div className="bg-[#000c33]/70 border border-[#0d349e] rounded-xl p-4">
                <h3 className="text-xs font-bold text-white uppercase tracking-wider mb-3 flex items-center gap-2">
                  <Shield className="w-4 h-4 text-[#FEB135]" />
                  Afiliación Institucional AGSCH
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <span className="text-slate-400 block text-[11px]">Zona Scout</span>
                    <span className="text-white font-bold">{data.scoutZone || 'Sin asignar'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">Distrito Scout</span>
                    <span className="text-white font-bold">{data.scoutDistrict || 'Sin asignar'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">Grupo Guía y Scout</span>
                    <span className="text-white font-bold">{data.scoutGroup || 'Sin asignar'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">Cargo Actual en el Grupo</span>
                    <span className="text-slate-200 font-medium">{data.scoutCurrentRole || 'No especificado'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">Nivel de Formación</span>
                    <span className="text-slate-200 font-medium">{data.scoutTrainingLevel || 'Sin nivel'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">Registro Nacional Vigente</span>
                    <span className="text-slate-200 font-medium">{data.activeRegistrations || 'No registrado'}</span>
                  </div>
                  <div className="sm:col-span-3 pt-2 border-t border-[#0d349e]">
                    <span className="text-slate-400 block text-[11px]">Contacto de Guiadora / Dirigente a cargo:</span>
                    <p className="text-slate-200 font-medium mt-0.5">
                      {data.groupLeaderName || 'No indicado'}
                      {data.groupLeaderEmail ? ` • ${data.groupLeaderEmail}` : ''}
                      {data.groupLeaderPhone ? ` • ${data.groupLeaderPhone}` : ''}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Tab 4: Ficha Médica WSJ 2027 */}
          {activeTab === 'medical' && (
            <div className="space-y-4 animate-in fade-in duration-200">
              {/* Banner de estado y acciones rápidas */}
              <div className="bg-[#000c33]/80 border border-[#0d349e] rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-red-950/80 border border-red-700/60 text-red-400 flex items-center justify-center shrink-0">
                    <Heart className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-white text-sm">Ficha Médica Polonia 2027</h3>
                      {data.medicalRecord?.completionStatus === 'COMPLETED' ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-950 text-emerald-300 border border-emerald-700">
                          ✓ Completada y Traducida
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-950 text-amber-300 border border-amber-700">
                          ⏳ Pendiente de Llenar
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-300">
                      {data.medicalRecord?.completionStatus === 'COMPLETED'
                        ? `Declarada por ${data.medicalRecord.declaredByName || 'Apoderado'} el ${data.medicalRecord.declaredAt ? new Date(data.medicalRecord.declaredAt).toLocaleDateString() : 'recientemente'}`
                        : 'El apoderado o participante aún no completa la ficha médica oficial'}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      const url = typeof window !== 'undefined' ? `${window.location.origin}/ficha-medica` : '/ficha-medica';
                      const text = `Hola, te enviamos el enlace para completar la Ficha Médica Oficial del Contingente Chileno para el 26° Jamboree Scout Mundial Polonia 2027 de ${data.firstName}. Ingresa con el RUT ${data.rut} aquí: ${url}`;
                      navigator.clipboard.writeText(text);
                      setCopiedLink(true);
                      setTimeout(() => setCopiedLink(false), 3000);
                    }}
                    className="px-3 py-1.5 rounded-lg bg-[#001558] hover:bg-[#031c6a] text-[#FEB135] text-xs font-bold border border-[#FEB135]/40 flex items-center gap-1.5 cursor-pointer transition-colors"
                  >
                    <Share2 className="w-3.5 h-3.5" />
                    {copiedLink ? '¡Mensaje Copiado!' : 'Copiar Enlace WhatsApp'}
                  </button>

                  {data.medicalRecord?.qrAccessCode ? (
                    <a
                      href={`/medico/${data.medicalRecord.qrAccessCode}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-1.5 rounded-lg bg-[#FEB135] hover:bg-[#e59c22] text-[#001558] text-xs font-black flex items-center gap-1.5 shadow-sm"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      Ver QR de Emergencia
                    </a>
                  ) : (
                    <a
                      href={`/ficha-medica`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-1.5 rounded-lg bg-[#FEB135] hover:bg-[#e59c22] text-[#001558] text-xs font-black flex items-center gap-1.5 shadow-sm"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      Llenar Ficha Ahora
                    </a>
                  )}
                </div>
              </div>

              {/* Si tiene ficha médica cargada */}
              {data.medicalRecord ? (
                <>
                  {/* Selector de idioma */}
                  <div className="flex items-center justify-between border-b border-[#0d349e] pb-2">
                    <div className="flex bg-[#000c33] border border-[#0d349e] rounded-lg p-1 text-xs font-bold">
                      <button
                        type="button"
                        onClick={() => setMedLang('es')}
                        className={`px-3 py-1 rounded transition-all ${
                          medLang === 'es' ? 'bg-[#FEB135] text-[#001558]' : 'text-slate-300'
                        }`}
                      >
                        🇨🇱 Español
                      </button>
                      <button
                        type="button"
                        onClick={() => setMedLang('en')}
                        className={`px-3 py-1 rounded transition-all ${
                          medLang === 'en' ? 'bg-[#FEB135] text-[#001558]' : 'text-slate-300'
                        }`}
                      >
                        🇬🇧 English (Medical)
                      </button>
                      <button
                        type="button"
                        onClick={() => setMedLang('pl')}
                        className={`px-3 py-1 rounded transition-all ${
                          medLang === 'pl' ? 'bg-[#FEB135] text-[#001558]' : 'text-slate-300'
                        }`}
                      >
                        🇵🇱 Polski (Medyczny)
                      </button>
                    </div>

                    <div className="flex items-center gap-3 text-xs">
                      <span className="font-bold text-[#FEB135] flex items-center gap-1">
                        <Droplet className="w-3.5 h-3.5 text-red-400" />
                        Grupo Sanguíneo: {data.medicalRecord.bloodType || 'No informado'}
                      </span>
                    </div>
                  </div>

                  {/* Resumen clínico en el idioma seleccionado */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div className="bg-[#000c33]/70 border border-[#0d349e] rounded-xl p-3 space-y-1">
                      <span className="text-[10px] font-bold text-red-300 uppercase flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3 text-red-400" />
                        {medLang === 'en' ? 'Allergies & Anaphylaxis' : medLang === 'pl' ? 'Alergie i Anafilaksja' : 'Alergias y Anafilaxia'}
                      </span>
                      <p className="text-white font-medium">
                        {medLang === 'en'
                          ? data.medicalRecord.allergiesEN || 'None reported'
                          : medLang === 'pl'
                          ? data.medicalRecord.allergiesPL || 'Brak'
                          : data.medicalRecord.allergiesES || 'Sin alergias registradas'}
                      </p>
                    </div>

                    <div className="bg-[#000c33]/70 border border-[#0d349e] rounded-xl p-3 space-y-1">
                      <span className="text-[10px] font-bold text-[#FEB135] uppercase flex items-center gap-1">
                        <Heart className="w-3 h-3 text-[#FEB135]" />
                        {medLang === 'en' ? 'Chronic Conditions' : medLang === 'pl' ? 'Choroby Przewlekłe' : 'Condiciones Crónicas'}
                      </span>
                      <p className="text-white font-medium">
                        {medLang === 'en'
                          ? data.medicalRecord.chronicConditionsEN || 'None reported'
                          : medLang === 'pl'
                          ? data.medicalRecord.chronicConditionsPL || 'Brak'
                          : data.medicalRecord.chronicConditionsES || 'Sin condiciones crónicas'}
                      </p>
                    </div>

                    <div className="bg-[#000c33]/70 border border-[#0d349e] rounded-xl p-3 space-y-1">
                      <span className="text-[10px] font-bold text-indigo-300 uppercase flex items-center gap-1">
                        <Pill className="w-3 h-3 text-indigo-400" />
                        {medLang === 'en' ? 'Medications' : medLang === 'pl' ? 'Leki' : 'Medicamentos Habituales'}
                      </span>
                      <p className="text-white font-medium">
                        {medLang === 'en'
                          ? data.medicalRecord.currentMedicationsEN || 'None'
                          : medLang === 'pl'
                          ? data.medicalRecord.currentMedicationsPL || 'Brak'
                          : data.medicalRecord.currentMedicationsES || 'Sin medicamentos habituales'}
                      </p>
                    </div>

                    <div className="bg-[#000c33]/70 border border-[#0d349e] rounded-xl p-3 space-y-1">
                      <span className="text-[10px] font-bold text-emerald-300 uppercase flex items-center gap-1">
                        <FileText className="w-3 h-3 text-emerald-400" />
                        {medLang === 'en' ? 'Dietary Restrictions' : medLang === 'pl' ? 'Dieta' : 'Régimen Alimentario'}
                      </span>
                      <p className="text-white font-medium">
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
                <div className="bg-[#000c33]/60 border border-[#0d349e] rounded-xl p-6 text-center space-y-3">
                  <Heart className="w-8 h-8 text-slate-500 mx-auto" />
                  <h4 className="text-sm font-bold text-white">Sin Ficha Médica Registrada Aún</h4>
                  <p className="text-xs text-slate-300 max-w-md mx-auto">
                    El apoderado puede ingresar al portal público con el RUT del participante y solicitar su código de verificación al correo para completarla y firmarla digitalmente.
                  </p>
                  <a
                    href="/ficha-medica"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#FEB135] text-[#001558] font-black text-xs shadow-md"
                  >
                    Abrir Portal Ficha Médica
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-[#0d349e] flex justify-end bg-[#000c33]">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-[#001558] hover:bg-[#031c6a] text-white rounded-xl text-xs font-bold transition-colors cursor-pointer border border-[#0d349e]"
          >
            Cerrar Ficha
          </button>
        </div>
      </div>
    </div>
  );
}
