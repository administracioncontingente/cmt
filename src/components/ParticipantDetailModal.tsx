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
  const [activeTab, setActiveTab] = useState<'finance' | 'profile'>('finance');
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

  // Fetch participant data
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

      // Reset form
      setAmount('');
      setTransactionReference('');
      setPaymentNotes('');
      // Update local data
      setData(resData.participant);
      onParticipantUpdated();
    } catch (err: any) {
      setPaymentError(err.message || 'Error al procesar el abono');
    } finally {
      setSubmittingPayment(false);
    }
  };

  const handleDeletePayment = async (paymentId: string) => {
    if (!confirm('¿Estás seguro de anular este abono? El saldo se recalculará automáticamente.')) {
      return;
    }

    try {
      setDeletingPaymentId(paymentId);
      const res = await fetch(
        `/api/participants/${participantId}/payments?paymentId=${paymentId}`,
        { method: 'DELETE' }
      );
      const resData = await res.json();
      if (!res.ok) {
        throw new Error(resData.error || 'Error al eliminar el abono');
      }
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
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 max-w-md w-full text-center">
          <Loader2 className="w-8 h-8 text-indigo-500 animate-spin mx-auto mb-3" />
          <p className="text-slate-300 text-sm">Cargando ficha del participante...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
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

  const roleBadgeStyles: Record<string, string> = {
    JOVEN: 'bg-indigo-950/80 text-indigo-300 border-indigo-700/50',
    DIRIGENTE: 'bg-amber-950/80 text-amber-300 border-amber-700/50',
    IST: 'bg-emerald-950/80 text-emerald-300 border-emerald-700/50',
    CMT: 'bg-purple-950/80 text-purple-300 border-purple-700/50',
  };

  const statusBadgeStyles: Record<string, string> = {
    CONFIRMADO: 'bg-emerald-950 text-emerald-400 border-emerald-800',
    PRE_INSCRITO: 'bg-blue-950 text-blue-400 border-blue-800',
    LISTA_ESPERA: 'bg-amber-950 text-amber-400 border-amber-800',
    RETIRADO: 'bg-red-950 text-red-400 border-red-800',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-3 sm:p-6 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-indigo-700 to-indigo-500 flex items-center justify-center text-white font-bold text-lg shadow-md">
              {data.firstName[0]}
              {data.lastName[0]}
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-bold text-white">
                  {data.firstName} {data.lastName}
                </h2>
                <span className="font-mono text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                  {data.rut}
                </span>
                <span
                  className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${
                    roleBadgeStyles[data.contingentRole] || 'bg-slate-800 text-slate-300'
                  }`}
                >
                  {data.contingentRole}
                </span>
                <span
                  className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${
                    statusBadgeStyles[data.status] || 'bg-slate-800 text-slate-300'
                  }`}
                >
                  {data.status.replace('_', ' ')}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                {data.scoutGroup ? `${data.scoutGroup} • ` : ''}
                {data.scoutZone ? `Zona ${data.scoutZone}` : 'Sin Zona asignada'}
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
            Control Financiero y Cuotas ({formatUSD(fin.totalPaid)} / {formatUSD(fin.totalRequired)})
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
            Ficha de Datos y Contacto
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {activeTab === 'finance' ? (
            <>
              {/* Financial Summary Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-slate-950/80 p-3.5 rounded-xl border border-slate-800">
                  <span className="text-[11px] font-medium text-slate-400 uppercase">
                    Total Cuota (USD)
                  </span>
                  <p className="text-xl font-bold text-white mt-1">
                    {formatUSD(fin.totalRequired)}
                  </p>
                  <p className="text-[10px] text-slate-500 mt-0.5">
                    {data.plan?.name || 'Plan por defecto'}
                  </p>
                </div>

                <div className="bg-slate-950/80 p-3.5 rounded-xl border border-slate-800">
                  <span className="text-[11px] font-medium text-slate-400 uppercase">
                    Total Abonado
                  </span>
                  <p className="text-xl font-bold text-emerald-400 mt-1">
                    {formatUSD(fin.totalPaid)}
                  </p>
                  <p className="text-[10px] text-slate-500 mt-0.5">
                    {fin.totalRequired > 0
                      ? `${Math.round((fin.totalPaid / fin.totalRequired) * 100)}% cubierto`
                      : '0%'}
                  </p>
                </div>

                <div className="bg-slate-950/80 p-3.5 rounded-xl border border-slate-800">
                  <span className="text-[11px] font-medium text-slate-400 uppercase">
                    Saldo Restante
                  </span>
                  <p className="text-xl font-bold text-slate-200 mt-1">
                    {formatUSD(fin.balanceRemaining)}
                  </p>
                  <p className="text-[10px] text-slate-500 mt-0.5">Por recaudar</p>
                </div>

                <div
                  className={`p-3.5 rounded-xl border ${
                    fin.isOverdue
                      ? 'bg-red-950/40 border-red-800/60'
                      : 'bg-emerald-950/30 border-emerald-800/50'
                  }`}
                >
                  <span className="text-[11px] font-medium uppercase text-slate-400">
                    Estado Actual
                  </span>
                  <div className="flex items-center gap-1.5 mt-1">
                    {fin.isFullyPaid ? (
                      <span className="text-emerald-400 font-bold text-base flex items-center gap-1">
                        <CheckCircle2 className="w-4 h-4" /> Pagado 100%
                      </span>
                    ) : fin.isOverdue ? (
                      <span className="text-red-400 font-bold text-base flex items-center gap-1">
                        <AlertCircle className="w-4 h-4" /> Mora: {formatUSD(fin.overdueAmount)}
                      </span>
                    ) : (
                      <span className="text-emerald-400 font-bold text-base flex items-center gap-1">
                        <CheckCircle2 className="w-4 h-4" /> Al día
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    {fin.isOverdue
                      ? `${fin.overdueCount} cuota(s) vencida(s)`
                      : 'Sin atrasos a la fecha'}
                  </p>
                </div>
              </div>

              {/* Installments Schedule Breakdown */}
              <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4">
                <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-indigo-400" />
                  Calendario Oficial de Cuotas Programadas (USD)
                </h3>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-400">
                        <th className="pb-2 font-medium">N°</th>
                        <th className="pb-2 font-medium">Concepto</th>
                        <th className="pb-2 font-medium">Vencimiento</th>
                        <th className="pb-2 font-medium">Monto</th>
                        <th className="pb-2 font-medium">Cubierto</th>
                        <th className="pb-2 font-medium">Estado</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {fin.breakdown.map((b) => {
                        const statusTag = {
                          PAGADA: (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-950 text-emerald-400 border border-emerald-700/60">
                              ✓ Pagada
                            </span>
                          ),
                          PARCIAL: (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-950 text-amber-400 border border-amber-700/60">
                              Parcial ({formatUSD(b.coveredAmount)})
                            </span>
                          ),
                          VENCIDA: (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-950 text-red-400 border border-red-700/60 animate-pulse">
                              ✕ Vencida
                            </span>
                          ),
                          PENDIENTE: (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 text-slate-400 border border-slate-700">
                              Pendiente
                            </span>
                          ),
                        }[b.status];

                        return (
                          <tr key={b.id} className="hover:bg-slate-900/50">
                            <td className="py-2.5 font-semibold text-slate-400">
                              Cuota {b.installmentNumber}
                            </td>
                            <td className="py-2.5 text-slate-200 font-medium">{b.title}</td>
                            <td className="py-2.5 text-slate-400 font-mono">
                              {new Date(b.dueDate).toLocaleDateString('es-CL')}
                            </td>
                            <td className="py-2.5 font-bold text-white font-mono">
                              {formatUSD(b.amount)}
                            </td>
                            <td className="py-2.5 font-mono text-emerald-400">
                              {formatUSD(b.coveredAmount)}
                            </td>
                            <td className="py-2.5">{statusTag}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Register New Payment Form */}
              <div className="bg-slate-950/80 border border-indigo-900/40 rounded-xl p-4 shadow-inner">
                <h3 className="text-xs font-semibold text-indigo-300 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <PlusCircle className="w-4 h-4 text-indigo-400" />
                  Registrar Nuevo Abono / Pago
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
                        placeholder="600.00"
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
                      <option value="OTRO">Otro</option>
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
                      placeholder="Ej: TRF-48291"
                      className="w-full px-2.5 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                    />
                  </div>

                  <div className="sm:col-span-3">
                    <label className="block text-[11px] font-medium text-slate-400 mb-1">
                      Notas / Observaciones del Pago
                    </label>
                    <input
                      type="text"
                      value={paymentNotes}
                      onChange={(e) => setPaymentNotes(e.target.value)}
                      placeholder="Ej: Pago Cuota 2 comprobante recibido por correo"
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
                  <div className="space-y-2">
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
                                  Ref: {p.transactionReference}
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
                              {p.notes && <span>• &quot;{p.notes}&quot;</span>}
                              {p.registeredBy && (
                                <span>• Registrado por: {p.registeredBy.name}</span>
                              )}
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
          ) : (
            /* Tab 2: Profile & Scout info */
            <div className="space-y-6">
              {/* Personal Data */}
              <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4">
                <h3 className="text-xs font-semibold text-indigo-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <User className="w-4 h-4" />
                  Datos Personales
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                  <div>
                    <span className="text-slate-500 block">RUT</span>
                    <span className="font-mono text-slate-200 font-semibold">{data.rut}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Nombres Completos</span>
                    <span className="text-slate-200 font-semibold">
                      {data.firstName} {data.lastName}
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
                </div>
              </div>

              {/* Scout Affiliation */}
              <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4">
                <h3 className="text-xs font-semibold text-emerald-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <Shield className="w-4 h-4" />
                  Afiliación Guías y Scouts de Chile (AGSCH)
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                  <div>
                    <span className="text-slate-500 block">Zona Scout</span>
                    <span className="text-slate-200 font-medium">
                      {data.scoutZone || 'Sin asignar'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Distrito Scout</span>
                    <span className="text-slate-200 font-medium">
                      {data.scoutDistrict || 'Sin asignar'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Grupo Guía y Scout</span>
                    <span className="text-slate-200 font-medium">
                      {data.scoutGroup || 'Sin asignar'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Rol Contingente</span>
                    <span className="text-indigo-400 font-bold">{data.contingentRole}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Unidad / Patrulla Asignada</span>
                    <span className="text-slate-200 font-medium">
                      {data.unitOrPatrol || 'Por asignar'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Estado de Registro</span>
                    <span className="text-slate-200 font-medium">{data.status}</span>
                  </div>
                </div>
              </div>

              {/* Guardian / Emergency Contact */}
              <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4">
                <h3 className="text-xs font-semibold text-amber-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <Phone className="w-4 h-4" />
                  Apoderado / Contacto de Emergencia
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div>
                    <span className="text-slate-500 block">Nombre del Apoderado</span>
                    <span className="text-slate-200 font-medium">
                      {data.guardianName || 'No registrado'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Parentesco</span>
                    <span className="text-slate-200 font-medium">
                      {data.guardianRelationship || 'No registrado'}
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

              {/* Medical and Dietary notes */}
              <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4">
                <h3 className="text-xs font-semibold text-purple-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  Salud, Dieta y Observaciones
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div>
                    <span className="text-slate-500 block">Restricciones Dietarias / Alergias</span>
                    <p className="text-slate-200 mt-1">
                      {data.dietaryRestrictions || 'Ninguna especificada'}
                    </p>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Condición o Notas Médicas</span>
                    <p className="text-slate-200 mt-1">
                      {data.medicalNotes || 'Sin observaciones médicas'}
                    </p>
                  </div>
                  {data.notes && (
                    <div className="sm:col-span-2 pt-2 border-t border-slate-800">
                      <span className="text-slate-500 block">Notas Internas de Organización</span>
                      <p className="text-slate-300 mt-1">{data.notes}</p>
                    </div>
                  )}
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
