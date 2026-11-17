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
  DollarSign,
  PlusCircle,
  Trash2,
  FileText,
  Phone,
  Mail,
  Shield,
  Loader2,
  ExternalLink,
  MapPin,
  Tent,
  Shirt,
  Award,
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
  const [activeTab, setActiveTab] = useState<'finance' | 'profile' | 'logistics'>('finance');
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 max-w-md w-full text-center">
          <Loader2 className="w-8 h-8 text-indigo-500 animate-spin mx-auto mb-3" />
          <p className="text-slate-300 text-sm">Cargando ficha oficial del participante...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-md w-full text-center">
          <p className="text-red-400 text-sm mb-4">{error || 'No se encontró el participante'}</p>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-sm"
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-3 sm:p-6 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-indigo-700 to-indigo-500 flex items-center justify-center text-white font-bold text-lg shadow-md shrink-0">
              {data.firstName[0]}
              {data.lastName[0]}
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-bold text-white">
                  {data.firstName} {data.lastName} {data.secondLastName || ''}
                </h2>
                {data.cupoCode && (
                  <span className="font-mono text-xs px-2 py-0.5 rounded bg-indigo-950 text-indigo-300 border border-indigo-700/60 font-bold">
                    Cupo: {data.cupoCode}
                  </span>
                )}
                <span className="font-mono text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                  {data.rut}
                </span>
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-indigo-950/80 text-indigo-300 border border-indigo-700/50">
                  {data.contingentRole}
                </span>
                {data.financialStatusSheet && (
                  <span
                    className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${
                      data.financialStatusSheet === 'Total Pagado'
                        ? 'bg-blue-950 text-blue-300 border-blue-700'
                        : data.financialStatusSheet === 'Adeuda'
                        ? 'bg-red-950 text-red-300 border-red-700'
                        : data.financialStatusSheet === 'BAJA'
                        ? 'bg-slate-800 text-slate-400 border-slate-700'
                        : 'bg-emerald-950 text-emerald-300 border-emerald-700'
                    }`}
                  >
                    {data.financialStatusSheet}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                {data.scoutGroup ? `${data.scoutGroup} • ` : ''}
                {data.scoutDistrict ? `Distrito ${data.scoutDistrict} • ` : ''}
                {data.scoutZone ? `Zona ${data.scoutZone}` : ''}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab navigation */}
        <div className="flex border-b border-slate-800 px-6 bg-slate-900/50">
          <button
            onClick={() => setActiveTab('finance')}
            className={`py-3 px-4 text-xs font-semibold flex items-center gap-2 border-b-2 transition-colors cursor-pointer ${
              activeTab === 'finance'
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <CreditCard className="w-4 h-4" />
            Finanzas y Abonos ({formatUSD(fin.totalPaid)} / {formatUSD(targetFee)})
          </button>
          <button
            onClick={() => setActiveTab('profile')}
            className={`py-3 px-4 text-xs font-semibold flex items-center gap-2 border-b-2 transition-colors cursor-pointer ${
              activeTab === 'profile'
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <User className="w-4 h-4" />
            Ficha Personal y Apoderado
          </button>
          <button
            onClick={() => setActiveTab('logistics')}
            className={`py-3 px-4 text-xs font-semibold flex items-center gap-2 border-b-2 transition-colors cursor-pointer ${
              activeTab === 'logistics'
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Tent className="w-4 h-4" />
            Logística & Asignación
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-xs">
          {activeTab === 'finance' && (
            <>
              {/* Summary Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-slate-950/80 p-3.5 rounded-xl border border-slate-800">
                  <span className="text-[11px] font-medium text-slate-400 uppercase">
                    Cuota Oficial Final
                  </span>
                  <p className="text-xl font-bold text-white mt-1">
                    {formatUSD(targetFee)}
                  </p>
                  <p className="text-[10px] text-slate-500 mt-0.5">
                    {data.feeType || 'Cuota asignada'}
                  </p>
                </div>

                <div className="bg-slate-950/80 p-3.5 rounded-xl border border-slate-800">
                  <span className="text-[11px] font-medium text-slate-400 uppercase">
                    Total Abonado Real
                  </span>
                  <p className="text-xl font-bold text-emerald-400 mt-1">
                    {formatUSD(fin.totalPaid)}
                  </p>
                  <p className="text-[10px] text-slate-500 mt-0.5">
                    {targetFee > 0
                      ? `${Math.round((fin.totalPaid / targetFee) * 100)}% de la meta`
                      : '0%'}
                  </p>
                </div>

                <div className="bg-slate-950/80 p-3.5 rounded-xl border border-slate-800">
                  <span className="text-[11px] font-medium text-slate-400 uppercase">
                    Saldo Restante
                  </span>
                  <p className="text-xl font-bold text-slate-200 mt-1">
                    {formatUSD(remainingFee)}
                  </p>
                  <p className="text-[10px] text-slate-500 mt-0.5">Por recaudar</p>
                </div>

                <div
                  className={`p-3.5 rounded-xl border ${
                    data.financialStatusSheet === 'Adeuda' || fin.isOverdue
                      ? 'bg-red-950/40 border-red-800/60'
                      : 'bg-emerald-950/30 border-emerald-800/50'
                  }`}
                >
                  <span className="text-[11px] font-medium uppercase text-slate-400">
                    Situación en Planilla
                  </span>
                  <div className="flex items-center gap-1.5 mt-1">
                    <span className="text-base font-bold text-white">
                      {data.financialStatusSheet || (fin.isFullyPaid ? 'Total Pagado' : 'Al Día')}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    {data.debtToDateUSD && data.debtToDateUSD > 0
                      ? `Deuda a fecha: ${formatUSD(data.debtToDateUSD)}`
                      : 'Sin deudas vencidas'}
                  </p>
                </div>
              </div>

              {/* Fee Information & Calendar */}
              {(data.feeType || data.calendarUrl || data.overpaymentUSD > 0) && (
                <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <span className="text-[10px] font-semibold text-slate-400 uppercase">
                      Modalidad de Inscripción
                    </span>
                    <p className="text-slate-200 font-medium text-sm">
                      {data.feeEnrollmentType || data.feeType || 'Estándar'}
                    </p>
                    {data.overpaymentUSD > 0 && (
                      <p className="text-indigo-400 text-xs mt-0.5 font-semibold">
                        Sobrepago registrado: {formatUSD(data.overpaymentUSD)}
                      </p>
                    )}
                  </div>
                  {data.calendarUrl && (
                    <a
                      href={data.calendarUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-indigo-300 rounded-lg text-xs font-medium flex items-center gap-1.5 border border-slate-700 shrink-0 w-fit"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      Ver Calendario Oficial de Cuotas
                    </a>
                  )}
                </div>
              )}

              {/* Form to Register New Payment */}
              <div className="bg-slate-950/80 border border-indigo-900/40 rounded-xl p-4 shadow-inner">
                <h3 className="text-xs font-semibold text-indigo-300 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <PlusCircle className="w-4 h-4 text-indigo-400" />
                  Registrar Nuevo Abono / Pago Bancario
                </h3>

                {paymentError && (
                  <div className="mb-3 p-2.5 rounded-lg bg-red-950/60 border border-red-800 text-red-300 text-xs">
                    {paymentError}
                  </div>
                )}

                <form onSubmit={handleRegisterPayment} className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-[11px] font-medium text-slate-400 mb-1">
                      Monto Abono (USD)*
                    </label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 pl-2.5 flex items-center text-slate-500 font-bold">
                        $
                      </span>
                      <input
                        type="number"
                        step="0.01"
                        required
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        placeholder="150.00"
                        className="w-full pl-6 pr-2 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white font-mono text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-slate-400 mb-1">
                      Fecha del Pago*
                    </label>
                    <input
                      type="date"
                      required
                      value={paymentDate}
                      onChange={(e) => setPaymentDate(e.target.value)}
                      className="w-full px-2.5 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-slate-400 mb-1">
                      Método de Pago
                    </label>
                    <select
                      value={paymentMethod}
                      onChange={(e) => setPaymentMethod(e.target.value)}
                      className="w-full px-2.5 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                    >
                      <option value="TRANSFERENCIA">Transferencia Bancaria</option>
                      <option value="TARJETA">Tarjeta / Webpay</option>
                      <option value="DEPOSITO">Depósito</option>
                      <option value="EFECTIVO">Efectivo</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-slate-400 mb-1">
                      N° Operación / Transf.
                    </label>
                    <input
                      type="text"
                      value={transactionReference}
                      onChange={(e) => setTransactionReference(e.target.value)}
                      placeholder="Ej: 546936"
                      className="w-full px-2.5 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                    />
                  </div>

                  <div className="sm:col-span-3">
                    <label className="block text-[11px] font-medium text-slate-400 mb-1">
                      Notas / Observaciones
                    </label>
                    <input
                      type="text"
                      value={paymentNotes}
                      onChange={(e) => setPaymentNotes(e.target.value)}
                      placeholder="Observaciones de comprobante bancario"
                      className="w-full px-2.5 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                    />
                  </div>

                  <div className="flex items-end">
                    <button
                      type="submit"
                      disabled={submittingPayment}
                      className="w-full py-2 px-4 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs flex items-center justify-center gap-1.5 transition-all shadow-md shadow-indigo-600/20 disabled:opacity-50 cursor-pointer"
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
                <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-emerald-400" />
                  Historial de Abonos Registrados ({data.payments?.length || 0})
                </h3>

                {(!data.payments || data.payments.length === 0) ? (
                  <div className="bg-slate-950/40 rounded-xl p-4 text-center border border-slate-800 text-xs text-slate-500">
                    No se han registrado abonos para este participante aún.
                  </div>
                ) : (
                  <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                    {data.payments.map((p: any) => (
                      <div
                        key={p.id}
                        className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-3 flex items-center justify-between hover:border-slate-700 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-emerald-950/80 border border-emerald-700/40 text-emerald-400 flex items-center justify-center font-bold text-xs">
                            $
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-emerald-400 text-sm font-mono">
                                +{formatUSD(p.amount)}
                              </span>
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">
                                {p.paymentMethod}
                              </span>
                              {p.transactionReference && (
                                <span className="text-[10px] font-mono text-indigo-300 bg-indigo-950/70 px-1.5 py-0.5 rounded border border-indigo-800/40">
                                  Doc: {p.transactionReference}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5">
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
                          className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-950/30 rounded-lg transition-colors cursor-pointer"
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
              <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4">
                <h3 className="text-xs font-semibold text-indigo-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <User className="w-4 h-4" />
                  Datos Personales
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <span className="text-slate-500 block">RUT</span>
                    <span className="font-mono text-slate-200 font-semibold">{data.rut}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Nombres y Apellidos</span>
                    <span className="text-slate-200 font-semibold">
                      {data.firstName} {data.lastName} {data.secondLastName || ''}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Correo Electrónico</span>
                    <span className="text-slate-200 flex items-center gap-1">
                      <Mail className="w-3 h-3 text-slate-400" /> {data.email}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Teléfono / WhatsApp</span>
                    <span className="text-slate-200 flex items-center gap-1">
                      <Phone className="w-3 h-3 text-slate-400" /> {data.phone || 'No registrado'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Fecha de Nacimiento</span>
                    <span className="text-slate-200">
                      {data.birthDate
                        ? new Date(data.birthDate).toLocaleDateString('es-CL')
                        : 'No registrada'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Género</span>
                    <span className="text-slate-200">{data.gender || 'No registrado'}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Dirección</span>
                    <span className="text-slate-200">{data.address || 'No registrada'}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Comuna / Ciudad</span>
                    <span className="text-slate-200">
                      {data.commune ? `${data.commune}` : ''}
                      {data.city ? ` - ${data.city}` : ''}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Nacionalidad</span>
                    <span className="text-slate-200">{data.nationality || 'Chilena'}</span>
                  </div>
                </div>

                {data.idCardUrl && (
                  <div className="mt-3 pt-3 border-t border-slate-800 flex items-center justify-between">
                    <span className="text-slate-400">Cédula de Identidad subida:</span>
                    <a
                      href={data.idCardUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-1 bg-indigo-950/80 hover:bg-indigo-900 text-indigo-300 rounded-lg text-xs font-medium border border-indigo-700/50 flex items-center gap-1"
                    >
                      <ExternalLink className="w-3 h-3" />
                      Ver Cédula en Drive
                    </a>
                  </div>
                )}
              </div>

              {/* Guardian Info */}
              <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4">
                <h3 className="text-xs font-semibold text-amber-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <Phone className="w-4 h-4" />
                  Apoderado / Contacto de Emergencia
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <span className="text-slate-500 block">Nombre del Apoderado</span>
                    <span className="text-slate-200 font-medium">
                      {data.guardianName || 'No registrado'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Teléfono Apoderado</span>
                    <span className="text-slate-200 font-medium">
                      {data.guardianPhone || 'No registrado'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Correo Apoderado</span>
                    <span className="text-slate-200 font-medium">
                      {data.guardianEmail || 'No registrado'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Previous Events */}
              {data.previousEvents && (
                <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4">
                  <h3 className="text-xs font-semibold text-cyan-400 uppercase tracking-wider mb-2 flex items-center gap-2">
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
              <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4">
                <h3 className="text-xs font-semibold text-emerald-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <Tent className="w-4 h-4" />
                  Asignación en Contingente Polonia 2027
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <span className="text-slate-500 block">Código Único de Cupo</span>
                    <span className="font-mono text-indigo-400 font-bold text-sm">
                      {data.cupoCode || 'Sin cupo asignado'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Territorio (Macro-zona)</span>
                    <span className="text-slate-200 font-semibold">
                      {data.territorium || 'Por asignar'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Talla de Indumentaria / Kit</span>
                    <span className="text-emerald-400 font-bold">
                      {data.uniformSize || 'No registrada'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Unidad de Contingente</span>
                    <span className="text-slate-200 font-medium">
                      {data.unitName || data.unit || 'Por asignar'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Patrulla de Contingente</span>
                    <span className="text-slate-200 font-medium">
                      {data.patrolName || data.patrol || 'Por asignar'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Registro Oficial en Polonia</span>
                    <span className="text-slate-200 font-medium">
                      {data.polandRegistered || 'En proceso'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Scout Structure */}
              <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4">
                <h3 className="text-xs font-semibold text-indigo-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <Shield className="w-4 h-4" />
                  Afiliación Institucional AGSCH
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <span className="text-slate-500 block">Zona Scout</span>
                    <span className="text-slate-200 font-medium">{data.scoutZone || 'Sin asignar'}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Distrito Scout</span>
                    <span className="text-slate-200 font-medium">{data.scoutDistrict || 'Sin asignar'}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Grupo Guía y Scout</span>
                    <span className="text-slate-200 font-medium">{data.scoutGroup || 'Sin asignar'}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Rol Actual en el Grupo</span>
                    <span className="text-slate-200">{data.scoutCurrentRole || 'No especificado'}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Nivel de Formación</span>
                    <span className="text-slate-200">{data.scoutTrainingLevel || 'Sin nivel'}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Registro Nacional Vigente</span>
                    <span className="text-slate-200">{data.activeRegistrations || 'No registrado'}</span>
                  </div>
                  <div className="sm:col-span-3 pt-2 border-t border-slate-800">
                    <span className="text-slate-500 block">Contacto de Guiadora / Dirigente a cargo:</span>
                    <p className="text-slate-300 mt-0.5">
                      {data.groupLeaderName || 'No indicado'}
                      {data.groupLeaderEmail ? ` • ${data.groupLeaderEmail}` : ''}
                      {data.groupLeaderPhone ? ` • ${data.groupLeaderPhone}` : ''}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-800 flex justify-end bg-slate-950/80">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-medium transition-colors cursor-pointer"
          >
            Cerrar Ficha
          </button>
        </div>
      </div>
    </div>
  );
}
