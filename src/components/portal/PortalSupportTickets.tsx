'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Clock,
  LifeBuoy,
  Loader2,
  MessageSquare,
  Plus,
  RefreshCw,
  Send,
  User,
  Users,
} from 'lucide-react';
import { useToast } from '@/components/ui/ToastProvider';
import {
  PORTAL_TICKET_CATEGORIES,
  TICKET_MESSAGE_MAX,
  TICKET_SUBJECT_MAX,
  getTicketCategoryLabel,
  getTicketStatusMeta,
} from '@/lib/supportTicketMeta';
import type { PortalTicketDTO } from '@/types/domain';

interface PortalSupportTicketsProps {
  participantName: string;
  eventName: string;
}

const INPUT_CLASS =
  'w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs sm:text-sm text-slate-800 placeholder-slate-400 focus:border-[#001558] focus:ring-2 focus:ring-[#FEB135]/50 focus:outline-none transition-all';

const PORTAL_SIGNATURE_RE = /\n\n— Enviado desde el Portal del Participante \([^)]*\)$/;

function formatDateTime(value?: string | Date | null): string {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('es-CL', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

type View = { mode: 'list' } | { mode: 'new' } | { mode: 'detail'; ticketId: string };

export function PortalSupportTickets({ participantName, eventName }: PortalSupportTicketsProps) {
  const { toast } = useToast();
  const [tickets, setTickets] = useState<PortalTicketDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [view, setView] = useState<View>({ mode: 'list' });

  // New ticket form
  const [category, setCategory] = useState<string>('CONSULTA_GENERAL');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [isUrgent, setIsUrgent] = useState(false);
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Reply
  const [reply, setReply] = useState('');
  const [sendingReply, setSendingReply] = useState(false);

  const fetchTickets = useCallback(async () => {
    const res = await fetch('/api/portal/tickets', { cache: 'no-store' });
    const data = (await res.json().catch(() => ({}))) as {
      tickets?: PortalTicketDTO[];
      error?: string;
    };
    if (!res.ok) throw new Error(data.error || 'No se pudieron cargar tus tickets');
    return data.tickets || [];
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const list = await fetchTickets();
        if (!cancelled) {
          setTickets(list);
          setLoadError(null);
        }
      } catch (err: unknown) {
        if (!cancelled) {
          setLoadError(err instanceof Error ? err.message : 'Error cargando tickets');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [fetchTickets]);

  const handleRefresh = async () => {
    setLoading(true);
    try {
      setTickets(await fetchTickets());
      setLoadError(null);
    } catch (err: unknown) {
      setLoadError(err instanceof Error ? err.message : 'Error cargando tickets');
    } finally {
      setLoading(false);
    }
  };

  const upsertTicket = (ticket: PortalTicketDTO) => {
    setTickets((prev) => [ticket, ...prev.filter((t) => t.id !== ticket.id)]);
  };

  const selectedTicket = useMemo(
    () => (view.mode === 'detail' ? tickets.find((t) => t.id === view.ticketId) : undefined),
    [view, tickets]
  );

  const openCount = tickets.filter(
    (t) => t.status !== 'RESUELTA' && t.status !== 'CERRADA'
  ).length;
  const awaitingCount = tickets.filter((t) => t.status === 'ESPERANDO_RESPUESTA').length;
  const selectedCategoryHint = PORTAL_TICKET_CATEGORIES.find((c) => c.value === category)?.hint;

  const resetForm = () => {
    setCategory('CONSULTA_GENERAL');
    setTitle('');
    setDescription('');
    setIsUrgent(false);
    setFormError(null);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (title.trim().length < 5) {
      setFormError('El asunto debe tener al menos 5 caracteres.');
      return;
    }
    if (description.trim().length < 10) {
      setFormError('Describe tu solicitud con al menos 10 caracteres.');
      return;
    }

    setCreating(true);
    try {
      const res = await fetch('/api/portal/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category, title, description, isUrgent }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ticket?: PortalTicketDTO;
        message?: string;
        error?: string;
      };
      if (!res.ok || !data.ticket) {
        throw new Error(data.error || 'No se pudo crear el ticket');
      }
      upsertTicket(data.ticket);
      toast.success(data.message || 'Ticket creado', 'Soporte');
      resetForm();
      setView({ mode: 'detail', ticketId: data.ticket.id });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'No se pudo crear el ticket';
      setFormError(msg);
      toast.error(msg);
    } finally {
      setCreating(false);
    }
  };

  const handleReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTicket || reply.trim().length < 2) return;
    setSendingReply(true);
    try {
      const res = await fetch(
        `/api/portal/tickets/${encodeURIComponent(selectedTicket.id)}/messages`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: reply }),
        }
      );
      const data = (await res.json().catch(() => ({}))) as {
        ticket?: PortalTicketDTO;
        message?: string;
        error?: string;
      };
      if (!res.ok || !data.ticket) {
        throw new Error(data.error || 'No se pudo enviar el mensaje');
      }
      upsertTicket(data.ticket);
      setReply('');
      toast.success(data.message || 'Mensaje enviado');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'No se pudo enviar el mensaje');
    } finally {
      setSendingReply(false);
    }
  };

  // ---------- HEADER ----------
  const header = (
    <div className="bg-white border border-slate-200 border-t-4 border-t-[#001558] rounded-3xl p-5 sm:p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div>
        <h2 className="text-lg sm:text-xl font-black text-[#001558] flex items-center gap-2">
          <LifeBuoy className="w-5 h-5 text-[#FEB135]" />
          Soporte y Consultas
        </h2>
        <p className="text-xs text-slate-600 mt-0.5">
          Envía tus consultas al equipo organizador de {eventName} y haz seguimiento de las
          respuestas aquí mismo.
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2 shrink-0">
        <button
          type="button"
          onClick={() => void handleRefresh()}
          disabled={loading}
          title="Actualizar"
          className="inline-flex items-center justify-center p-2.5 rounded-xl bg-[#F5F6F8] hover:bg-slate-200 border border-slate-200 text-[#001558] cursor-pointer disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
        {view.mode !== 'new' && (
          <button
            type="button"
            onClick={() => {
              resetForm();
              setView({ mode: 'new' });
            }}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#FEB135] hover:bg-[#e59c22] text-[#001558] text-xs font-black cursor-pointer transition-colors shadow-xs"
          >
            <Plus className="w-4 h-4" />
            Nuevo Ticket
          </button>
        )}
      </div>
    </div>
  );

  // ---------- NEW TICKET ----------
  if (view.mode === 'new') {
    return (
      <div className="space-y-4">
        {header}
        <form
          onSubmit={handleCreate}
          className="bg-white border border-slate-200 rounded-3xl p-5 sm:p-6 shadow-xs space-y-5"
        >
          <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-200">
            <h3 className="text-sm font-black text-[#001558] uppercase tracking-wider">
              Nuevo ticket de soporte
            </h3>
            <button
              type="button"
              onClick={() => setView({ mode: 'list' })}
              className="inline-flex items-center gap-1 text-xs font-bold text-slate-600 hover:text-[#001558] cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Volver
            </button>
          </div>

          {formError && (
            <div
              role="alert"
              className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-bold flex items-start gap-2"
            >
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{formError}</span>
            </div>
          )}

          <div className="bg-[#F5F6F8] border border-slate-200 rounded-2xl p-3.5 text-xs text-slate-700 flex items-start gap-2">
            <User className="w-4 h-4 text-[#001558] shrink-0 mt-0.5" />
            <span>
              El ticket quedará asociado a <strong className="text-[#001558]">{participantName}</strong>.
              El equipo verá tus datos de inscripción, por lo que no necesitas repetir tu RUT.
            </span>
          </div>

          <fieldset className="space-y-2">
            <legend className="block text-xs font-bold text-[#001558] uppercase tracking-wider mb-1.5">
              Tema de la consulta *
            </legend>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {PORTAL_TICKET_CATEGORIES.map((c) => (
                <label
                  key={c.value}
                  className={`p-3 rounded-xl border cursor-pointer transition-colors ${
                    category === c.value
                      ? 'bg-[#EEF2FF] border-[#001558] text-[#001558]'
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <input
                    type="radio"
                    name="ticket-category"
                    value={c.value}
                    checked={category === c.value}
                    onChange={() => setCategory(c.value)}
                    className="sr-only"
                  />
                  <span className="block text-xs font-extrabold">{c.label}</span>
                  <span className="block text-[11px] opacity-80 mt-0.5">{c.hint}</span>
                </label>
              ))}
            </div>
            {selectedCategoryHint && (
              <p className="sr-only" aria-live="polite">
                {selectedCategoryHint}
              </p>
            )}
          </fieldset>

          <div>
            <label
              htmlFor="ticket-title"
              className="block text-xs font-bold text-[#001558] uppercase tracking-wider mb-1.5"
            >
              Asunto *
            </label>
            <input
              id="ticket-title"
              type="text"
              required
              maxLength={TICKET_SUBJECT_MAX}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ej: Mi abono de marzo no aparece en Mis Pagos"
              className={INPUT_CLASS}
            />
          </div>

          <div>
            <label
              htmlFor="ticket-description"
              className="block text-xs font-bold text-[#001558] uppercase tracking-wider mb-1.5"
            >
              Detalle de tu solicitud *
            </label>
            <textarea
              id="ticket-description"
              required
              rows={6}
              maxLength={TICKET_MESSAGE_MAX}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Cuéntanos qué necesitas. Incluye fechas, montos, números de operación u otros datos que ayuden a resolverlo más rápido."
              className={INPUT_CLASS}
            />
            <p className="text-[11px] text-slate-500 mt-1 text-right">
              {description.length}/{TICKET_MESSAGE_MAX}
            </p>
          </div>

          <label className="flex items-start gap-2.5 bg-[#FFFBF0] border border-[#FEB135]/70 rounded-xl px-3.5 py-3 cursor-pointer">
            <input
              type="checkbox"
              checked={isUrgent}
              onChange={(e) => setIsUrgent(e.target.checked)}
              className="w-4 h-4 mt-0.5 accent-[#001558]"
            />
            <span className="text-xs text-[#001558]">
              <strong className="font-extrabold">Es urgente</strong>
              <span className="block text-slate-600">
                Márcalo solo si tiene un plazo cercano (ej. vencimiento de pago o vuelo). Para
                emergencias médicas durante el evento, contacta directamente a tu dirigente.
              </span>
            </span>
          </label>

          <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={() => setView({ mode: 'list' })}
              disabled={creating}
              className="px-4 py-2.5 rounded-xl bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 text-xs font-bold cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={creating}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#001558] hover:bg-[#0b2370] text-white text-xs font-black uppercase tracking-wider shadow-sm disabled:opacity-50 cursor-pointer"
            >
              {creating ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4 text-[#FEB135]" />
              )}
              Enviar Ticket
            </button>
          </div>
        </form>
      </div>
    );
  }

  // ---------- DETAIL ----------
  if (view.mode === 'detail' && selectedTicket) {
    const statusMeta = getTicketStatusMeta(selectedTicket.status);
    const isClosed = selectedTicket.status === 'CERRADA';
    const cleanDescription = selectedTicket.description.replace(PORTAL_SIGNATURE_RE, '');

    return (
      <div className="space-y-4">
        {header}
        <section className="bg-white border border-slate-200 rounded-3xl shadow-xs overflow-hidden">
          <div className="p-5 sm:p-6 border-b border-slate-200 space-y-3">
            <button
              type="button"
              onClick={() => setView({ mode: 'list' })}
              className="inline-flex items-center gap-1 text-xs font-bold text-slate-600 hover:text-[#001558] cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Todos mis tickets
            </button>
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200 font-mono text-[11px] font-bold text-slate-700">
                {selectedTicket.ticketNumber}
              </span>
              <span
                className={`px-2.5 py-0.5 rounded-full text-[11px] font-black border ${statusMeta.className}`}
              >
                {statusMeta.label}
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold border bg-white border-slate-200 text-slate-600">
                {getTicketCategoryLabel(selectedTicket.category)}
              </span>
            </div>
            <h3 className="text-base sm:text-lg font-black text-[#001558]">
              {selectedTicket.title}
            </h3>
            <p className="text-xs text-slate-600">{statusMeta.participantHint}</p>
          </div>

          <div className="p-5 sm:p-6 bg-[#F5F6F8] space-y-3 max-h-[520px] overflow-y-auto">
            {/* Original request */}
            <div className="flex justify-end">
              <div className="max-w-[85%] bg-[#001558] text-white rounded-2xl rounded-tr-sm p-4 space-y-1.5 shadow-xs">
                <div className="flex items-center justify-between gap-4 text-[11px] text-slate-200">
                  <strong className="text-[#FEB135]">Tú</strong>
                  <span>{formatDateTime(selectedTicket.createdAt)}</span>
                </div>
                <p className="text-xs sm:text-sm whitespace-pre-wrap leading-relaxed">
                  {cleanDescription}
                </p>
              </div>
            </div>

            {selectedTicket.messages.map((m) =>
              m.fromParticipant ? (
                <div key={m.id} className="flex justify-end">
                  <div className="max-w-[85%] bg-[#001558] text-white rounded-2xl rounded-tr-sm p-4 space-y-1.5 shadow-xs">
                    <div className="flex items-center justify-between gap-4 text-[11px] text-slate-200">
                      <strong className="text-[#FEB135]">Tú</strong>
                      <span>{formatDateTime(m.createdAt)}</span>
                    </div>
                    <p className="text-xs sm:text-sm whitespace-pre-wrap leading-relaxed">
                      {m.content}
                    </p>
                  </div>
                </div>
              ) : (
                <div key={m.id} className="flex justify-start">
                  <div className="max-w-[85%] bg-white border border-slate-200 rounded-2xl rounded-tl-sm p-4 space-y-1.5 shadow-xs">
                    <div className="flex items-center justify-between gap-4 text-[11px] text-slate-500">
                      <strong className="text-[#001558] inline-flex items-center gap-1">
                        <Users className="w-3 h-3 text-[#FEB135]" />
                        {m.authorName}
                      </strong>
                      <span>{formatDateTime(m.createdAt)}</span>
                    </div>
                    <p className="text-xs sm:text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">
                      {m.content}
                    </p>
                  </div>
                </div>
              )
            )}

            {selectedTicket.messages.length === 0 && (
              <div className="text-center text-xs text-slate-500 py-2 flex items-center justify-center gap-1.5">
                <Clock className="w-3.5 h-3.5" />
                Aún no hay respuestas del equipo. Te responderemos por este medio.
              </div>
            )}

            {selectedTicket.resolutionNotes && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 text-xs text-emerald-900 space-y-1">
                <p className="font-extrabold flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  Resolución del equipo
                </p>
                <p className="whitespace-pre-wrap">{selectedTicket.resolutionNotes}</p>
              </div>
            )}
          </div>

          {isClosed ? (
            <div className="p-4 border-t border-slate-200 text-xs text-slate-600 bg-white flex flex-wrap items-center justify-between gap-2">
              <span>Este ticket está cerrado.</span>
              <button
                type="button"
                onClick={() => {
                  resetForm();
                  setView({ mode: 'new' });
                }}
                className="inline-flex items-center gap-1 font-extrabold text-[#001558] hover:underline cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                Crear un nuevo ticket
              </button>
            </div>
          ) : (
            <form
              onSubmit={handleReply}
              className="p-4 border-t border-slate-200 bg-white flex flex-col sm:flex-row gap-2"
            >
              <label htmlFor="ticket-reply" className="sr-only">
                Responder al equipo
              </label>
              <textarea
                id="ticket-reply"
                rows={2}
                maxLength={TICKET_MESSAGE_MAX}
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                placeholder={
                  selectedTicket.status === 'RESUELTA'
                    ? 'Escribe aquí si necesitas reabrir esta consulta...'
                    : 'Escribe una respuesta o información adicional...'
                }
                className={`${INPUT_CLASS} flex-1`}
              />
              <button
                type="submit"
                disabled={sendingReply || reply.trim().length < 2}
                className="inline-flex items-center justify-center gap-1.5 px-5 py-2.5 rounded-xl bg-[#001558] hover:bg-[#0b2370] text-white text-xs font-black disabled:opacity-50 cursor-pointer sm:self-stretch"
              >
                {sendingReply ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4 text-[#FEB135]" />
                )}
                Enviar
              </button>
            </form>
          )}
        </section>
      </div>
    );
  }

  // ---------- LIST ----------
  return (
    <div className="space-y-4">
      {header}

      {awaitingCount > 0 && (
        <div className="p-4 rounded-2xl bg-[#FFFBF0] border border-[#FEB135] text-[#001558] text-xs font-bold flex items-start gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-[#FEB135]" />
          <span>
            Tienes {awaitingCount} {awaitingCount === 1 ? 'ticket que requiere' : 'tickets que requieren'} tu
            respuesta.
          </span>
        </div>
      )}

      {loading && tickets.length === 0 ? (
        <div className="py-12 flex items-center justify-center gap-2 text-[#001558] text-xs font-bold">
          <Loader2 className="w-5 h-5 animate-spin" />
          Cargando tus tickets...
        </div>
      ) : loadError ? (
        <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-xs font-bold flex items-start gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{loadError}</span>
        </div>
      ) : tickets.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-3xl p-10 text-center space-y-3 shadow-xs">
          <div className="w-12 h-12 rounded-2xl bg-[#EEF2FF] border border-[#001558]/15 flex items-center justify-center mx-auto text-[#001558]">
            <MessageSquare className="w-6 h-6" />
          </div>
          <p className="text-sm font-extrabold text-[#001558]">Aún no has enviado consultas</p>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            Si tienes dudas sobre pagos, ficha médica, documentos o logística, crea un ticket y el
            equipo te responderá por aquí.
          </p>
          <button
            type="button"
            onClick={() => {
              resetForm();
              setView({ mode: 'new' });
            }}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#001558] hover:bg-[#0b2370] text-white text-xs font-extrabold cursor-pointer"
          >
            <Plus className="w-4 h-4 text-[#FEB135]" />
            Crear mi primer ticket
          </button>
        </div>
      ) : (
        <section className="bg-white border border-slate-200 rounded-3xl shadow-xs overflow-hidden">
          <div className="px-5 py-3 bg-[#F5F6F8] border-b border-slate-200 text-xs font-extrabold text-[#001558] uppercase tracking-wider">
            Mis tickets ({tickets.length}) • {openCount} {openCount === 1 ? 'activo' : 'activos'}
          </div>
          <ul className="divide-y divide-slate-100">
            {tickets.map((t) => {
              const statusMeta = getTicketStatusMeta(t.status);
              const lastStaffReply = [...t.messages].reverse().find((m) => !m.fromParticipant);
              return (
                <li key={t.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setReply('');
                      setView({ mode: 'detail', ticketId: t.id });
                    }}
                    className="w-full text-left px-5 py-4 hover:bg-[#FFFBF0]/60 transition-colors cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                  >
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="font-mono text-[11px] font-bold text-slate-500">
                          {t.ticketNumber}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-black border ${statusMeta.className}`}
                        >
                          {statusMeta.label}
                        </span>
                        <span className="text-[11px] text-slate-500">
                          {getTicketCategoryLabel(t.category)}
                        </span>
                      </div>
                      <p className="text-sm font-extrabold text-[#001558] truncate">{t.title}</p>
                      {lastStaffReply && (
                        <p className="text-[11px] text-slate-600 truncate">
                          Última respuesta del equipo: {lastStaffReply.content}
                        </p>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-500 shrink-0 flex items-center gap-2">
                      <span className="inline-flex items-center gap-1">
                        <MessageSquare className="w-3 h-3" />
                        {t.messages.length}
                      </span>
                      <span>{formatDateTime(t.updatedAt)}</span>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
