'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  Mail,
  Ticket,
  RefreshCw,
  Search,
  CheckCircle2,
  Clock,
  AlertTriangle,
  User,
  PlusCircle,
  ExternalLink,
  MessageSquare,
  Link2,
  Send,
  Loader2,
  ArrowRight,
  ShieldAlert,
} from 'lucide-react';

interface InboxAndIncidentsModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeEvent: {
    id: string;
    code: string;
    name: string;
    shortName?: string | null;
    flagEmoji?: string | null;
  } | null;
  currentUser: any;
  onSelectParticipant?: (participantId: string) => void;
}

export function InboxAndIncidentsModal({
  isOpen,
  onClose,
  activeEvent,
  currentUser,
  onSelectParticipant,
}: InboxAndIncidentsModalProps) {
  const [activeTab, setActiveTab] = useState<'inbox' | 'incidents'>('inbox');
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);

  // Inbox state
  const [messages, setMessages] = useState<any[]>([]);
  const [inboxFilter, setInboxFilter] = useState<'all' | 'associated' | 'unassociated' | 'tickets'>('all');
  const [inboxSearch, setInboxSearch] = useState('');
  const [selectedMessage, setSelectedMessage] = useState<any | null>(null);
  const [threadMessages, setThreadMessages] = useState<any[]>([]);

  // Incidents state
  const [incidents, setIncidents] = useState<any[]>([]);
  const [incidentFilterStatus, setIncidentFilterStatus] = useState('ALL');
  const [incidentFilterCategory, setIncidentFilterCategory] = useState('ALL');
  const [incidentSearch, setIncidentSearch] = useState('');
  const [selectedIncident, setSelectedIncident] = useState<any | null>(null);

  // New ticket modal state
  const [showNewTicketModal, setShowNewTicketModal] = useState(false);
  const [ticketFromMessage, setTicketFromMessage] = useState<any | null>(null);
  const [newTicketTitle, setNewTicketTitle] = useState('');
  const [newTicketCategory, setNewTicketCategory] = useState('CONSULTA_GENERAL');
  const [newTicketPriority, setNewTicketPriority] = useState('MEDIA');
  const [newTicketDescription, setNewTicketDescription] = useState('');
  const [newTicketParticipantId, setNewTicketParticipantId] = useState('');

  // Comment state
  const [newComment, setNewComment] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);

  // Manual Association state
  const [showAssociateModal, setShowAssociateModal] = useState(false);
  const [messageToAssociate, setMessageToAssociate] = useState<any | null>(null);
  const [participantSearch, setParticipantSearch] = useState('');
  const [participantCandidates, setParticipantCandidates] = useState<any[]>([]);
  const [searchingCandidates, setSearchingCandidates] = useState(false);

  const [notification, setNotification] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Cargar datos
  const loadMessages = async () => {
    if (!activeEvent?.id) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ eventId: activeEvent.id });
      if (inboxFilter !== 'all') params.append('filter', inboxFilter);
      if (inboxSearch) params.append('search', inboxSearch);

      const res = await fetch(`/api/inbox?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setMessages(data.messages || []);
      }
    } catch (err) {
      console.error('Error loading messages:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadIncidents = async () => {
    if (!activeEvent?.id) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ eventId: activeEvent.id });
      if (incidentFilterStatus !== 'ALL') params.append('status', incidentFilterStatus);
      if (incidentFilterCategory !== 'ALL') params.append('category', incidentFilterCategory);
      if (incidentSearch) params.append('search', incidentSearch);

      const res = await fetch(`/api/incidents?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setIncidents(data.incidents || []);
      }
    } catch (err) {
      console.error('Error loading incidents:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && activeEvent?.id) {
      if (activeTab === 'inbox') loadMessages();
      else loadIncidents();
    }
  }, [isOpen, activeEvent?.id, activeTab, inboxFilter, incidentFilterStatus, incidentFilterCategory]);

  // Sincronizar correos desde Gmail / Simulación
  const handleSyncInbox = async () => {
    if (!activeEvent?.id) return;
    setSyncing(true);
    setNotification(null);
    try {
      const res = await fetch('/api/inbox', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId: activeEvent.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al sincronizar');

      setNotification({ type: 'success', text: data.message });
      loadMessages();
    } catch (err: any) {
      setNotification({ type: 'error', text: err.message });
    } finally {
      setSyncing(false);
    }
  };

  // Ver detalle de mensaje e hilo
  const handleSelectMessage = async (msg: any) => {
    setSelectedMessage(msg);
    try {
      const res = await fetch(`/api/inbox/${msg.id}`);
      if (res.ok) {
        const data = await res.json();
        setThreadMessages(data.threadMessages || [msg]);
      }
    } catch {
      setThreadMessages([msg]);
    }
  };

  // Convertir correo en Ticket
  const handleOpenTicketFromMessage = (msg: any) => {
    setTicketFromMessage(msg);
    setNewTicketTitle(msg.subject);
    setNewTicketDescription(msg.bodyText || msg.snippet || '');
    setNewTicketParticipantId(msg.participantId || '');
    setNewTicketCategory(
      msg.subject.toLowerCase().includes('cuota') || msg.subject.toLowerCase().includes('pago')
        ? 'FINANZAS'
        : msg.subject.toLowerCase().includes('médic') || msg.subject.toLowerCase().includes('salud')
        ? 'FICHA_MEDICA'
        : 'CONSULTA_GENERAL'
    );
    setShowNewTicketModal(true);
  };

  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeEvent?.id || !newTicketParticipantId) return;
    setLoading(true);

    try {
      let res;
      if (ticketFromMessage) {
        res = await fetch(`/api/inbox/${ticketFromMessage.id}/ticket`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: newTicketTitle,
            category: newTicketCategory,
            priority: newTicketPriority,
            customNotes: newTicketDescription,
          }),
        });
      } else {
        res = await fetch('/api/incidents', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            eventId: activeEvent.id,
            participantId: newTicketParticipantId,
            title: newTicketTitle,
            description: newTicketDescription,
            category: newTicketCategory,
            priority: newTicketPriority,
          }),
        });
      }

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al crear incidencia');

      setNotification({ type: 'success', text: data.message });
      setShowNewTicketModal(false);
      setTicketFromMessage(null);
      if (activeTab === 'inbox') loadMessages();
      else loadIncidents();
    } catch (err: any) {
      setNotification({ type: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  };

  // Buscar participantes para asociar manualmente
  const searchCandidates = async (query: string) => {
    setParticipantSearch(query);
    if (!query || query.length < 2 || !activeEvent?.id) {
      setParticipantCandidates([]);
      return;
    }
    setSearchingCandidates(true);
    try {
      const res = await fetch(`/api/participants?eventId=${activeEvent.id}&search=${encodeURIComponent(query)}&limit=6`);
      if (res.ok) {
        const data = await res.json();
        setParticipantCandidates(data.participants || []);
      }
    } finally {
      setSearchingCandidates(false);
    }
  };

  const handleAssociateParticipant = async (participantId: string) => {
    if (!messageToAssociate?.id) return;
    try {
      const res = await fetch(`/api/inbox/${messageToAssociate.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ participantId }),
      });
      if (res.ok) {
        setShowAssociateModal(false);
        setMessageToAssociate(null);
        setNotification({ type: 'success', text: 'Correo asociado exitosamente al participante.' });
        loadMessages();
      }
    } catch (err: any) {
      setNotification({ type: 'error', text: err.message });
    }
  };

  // Agregar comentario a incidencia
  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedIncident?.id || !newComment.trim()) return;
    setSubmittingComment(true);

    try {
      const res = await fetch(`/api/incidents/${selectedIncident.id}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: newComment, isInternal: true }),
      });
      if (res.ok) {
        const data = await res.json();
        setSelectedIncident({
          ...selectedIncident,
          comments: [...(selectedIncident.comments || []), data.comment],
        });
        setNewComment('');
      }
    } finally {
      setSubmittingComment(false);
    }
  };

  // Actualizar estado de incidencia
  const handleUpdateIncidentStatus = async (status: string, notes?: string) => {
    if (!selectedIncident?.id) return;
    try {
      const res = await fetch(`/api/incidents/${selectedIncident.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, resolutionNotes: notes }),
      });
      if (res.ok) {
        const data = await res.json();
        setSelectedIncident(data.incident);
        loadIncidents();
      }
    } catch (err) {
      console.error(err);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-sm">
      <div className="bg-[#000c33] border border-[#0d349e] w-full max-w-6xl rounded-2xl shadow-2xl overflow-hidden flex flex-col h-[92vh]">
        {/* Header */}
        <div className="bg-[#001558] px-6 py-4 border-b border-[#0d349e] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#000c33] border border-[#0d349e] flex items-center justify-center text-[#FEB135]">
              {activeTab === 'inbox' ? <Mail className="w-5 h-5" /> : <Ticket className="w-5 h-5" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-black text-white">
                  Centro de Comunicaciones & Incidencias CRM
                </h2>
                <span className="px-2 py-0.5 rounded text-[10px] font-black bg-[#FEB135] text-[#001558]">
                  {activeEvent?.shortName || activeEvent?.name}
                </span>
              </div>
              <p className="text-xs text-slate-300">
                Lectura de correos, asociación automática a participantes y seguimiento de casos
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleSyncInbox}
              disabled={syncing}
              className="px-3.5 py-1.5 rounded-xl bg-[#000c33] hover:bg-[#001040] border border-[#FEB135]/40 text-[#FEB135] hover:text-white text-xs font-bold transition flex items-center gap-2 shadow-sm disabled:opacity-50"
              title="Sincronizar correos de Gmail o generar muestra"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Sincronizar Inbox</span>
            </button>

            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white p-2 rounded-lg hover:bg-white/10 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center justify-between px-6 bg-[#001040] border-b border-[#0d349e]">
          <div className="flex gap-2">
            <button
              onClick={() => { setActiveTab('inbox'); setSelectedMessage(null); }}
              className={`flex items-center gap-2 px-5 py-3 text-xs font-bold uppercase tracking-wider transition border-b-2 ${
                activeTab === 'inbox'
                  ? 'border-[#FEB135] text-[#FEB135] bg-[#001558]'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Mail className="w-4 h-4" />
              Bandeja de Entrada & Correos ({messages.length})
            </button>

            <button
              onClick={() => { setActiveTab('incidents'); setSelectedIncident(null); }}
              className={`flex items-center gap-2 px-5 py-3 text-xs font-bold uppercase tracking-wider transition border-b-2 ${
                activeTab === 'incidents'
                  ? 'border-[#FEB135] text-[#FEB135] bg-[#001558]'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Ticket className="w-4 h-4" />
              Incidencias & Casos CRM ({incidents.length})
            </button>
          </div>

          {activeTab === 'incidents' && (
            <button
              onClick={() => {
                setTicketFromMessage(null);
                setNewTicketTitle('');
                setNewTicketDescription('');
                setNewTicketParticipantId('');
                setShowNewTicketModal(true);
              }}
              className="px-3 py-1.5 rounded-lg bg-[#FEB135] text-[#001558] hover:bg-[#ffbe4f] text-xs font-bold transition flex items-center gap-1.5 shadow-md"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              Nueva Incidencia
            </button>
          )}
        </div>

        {/* Status Notification */}
        {notification && (
          <div
            className={`px-6 py-2.5 text-xs flex items-center justify-between ${
              notification.type === 'success'
                ? 'bg-emerald-950/90 text-emerald-300 border-b border-emerald-500/30'
                : 'bg-red-950/90 text-red-300 border-b border-red-500/30'
            }`}
          >
            <div className="flex items-center gap-2">
              {notification.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-red-400" />
              )}
              <span>{notification.text}</span>
            </div>
            <button onClick={() => setNotification(null)} className="text-slate-400 hover:text-white">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Main Content Area */}
        <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
          {/* TAB 1: INBOX */}
          {activeTab === 'inbox' && (
            <>
              {/* Left Column: Messages List */}
              <div className="w-full md:w-1/2 border-r border-[#0d349e] flex flex-col overflow-hidden bg-[#000c33]/50">
                {/* Filters & Search */}
                <div className="p-3 border-b border-[#0d349e] space-y-2 bg-[#001558]/40">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Buscar por asunto, remitente o RUT..."
                      value={inboxSearch}
                      onChange={(e) => setInboxSearch(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && loadMessages()}
                      className="w-full bg-[#000c33] border border-[#0d349e] rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-[#FEB135]"
                    />
                  </div>

                  <div className="flex items-center gap-1.5 overflow-x-auto text-[11px]">
                    <button
                      onClick={() => setInboxFilter('all')}
                      className={`px-2.5 py-1 rounded-lg font-bold transition whitespace-nowrap ${
                        inboxFilter === 'all'
                          ? 'bg-[#FEB135] text-[#001558]'
                          : 'bg-[#000c33] text-slate-300 hover:bg-white/5'
                      }`}
                    >
                      Todos ({messages.length})
                    </button>
                    <button
                      onClick={() => setInboxFilter('associated')}
                      className={`px-2.5 py-1 rounded-lg font-bold transition whitespace-nowrap ${
                        inboxFilter === 'associated'
                          ? 'bg-emerald-500 text-white'
                          : 'bg-[#000c33] text-slate-300 hover:bg-white/5'
                      }`}
                    >
                      Asociados
                    </button>
                    <button
                      onClick={() => setInboxFilter('unassociated')}
                      className={`px-2.5 py-1 rounded-lg font-bold transition whitespace-nowrap ${
                        inboxFilter === 'unassociated'
                          ? 'bg-amber-500 text-[#001558]'
                          : 'bg-[#000c33] text-slate-300 hover:bg-white/5'
                      }`}
                    >
                      Pendientes
                    </button>
                    <button
                      onClick={() => setInboxFilter('tickets')}
                      className={`px-2.5 py-1 rounded-lg font-bold transition whitespace-nowrap ${
                        inboxFilter === 'tickets'
                          ? 'bg-purple-500 text-white'
                          : 'bg-[#000c33] text-slate-300 hover:bg-white/5'
                      }`}
                    >
                      Con Ticket
                    </button>
                  </div>
                </div>

                {/* List */}
                <div className="flex-1 overflow-y-auto divide-y divide-[#0d349e]/40">
                  {loading ? (
                    <div className="p-8 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin text-[#FEB135]" />
                      <span>Cargando mensajes...</span>
                    </div>
                  ) : messages.length === 0 ? (
                    <div className="p-8 text-center text-xs text-slate-400 space-y-3">
                      <Mail className="w-8 h-8 mx-auto text-slate-500 stroke-1" />
                      <p>No se encontraron correos con los filtros actuales.</p>
                      <button
                        onClick={handleSyncInbox}
                        className="px-4 py-2 rounded-xl bg-[#FEB135] text-[#001558] font-bold text-xs"
                      >
                        Sincronizar Correos de Muestra
                      </button>
                    </div>
                  ) : (
                    messages.map((msg) => {
                      const isSelected = selectedMessage?.id === msg.id;
                      return (
                        <div
                          key={msg.id}
                          onClick={() => handleSelectMessage(msg)}
                          className={`p-3.5 transition cursor-pointer text-left ${
                            isSelected
                              ? 'bg-[#001558] border-l-4 border-l-[#FEB135]'
                              : 'hover:bg-white/[0.03]'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <span className="font-bold text-xs text-white truncate">
                              {msg.senderName || msg.senderEmail}
                            </span>
                            <span className="text-[10px] text-slate-400 whitespace-nowrap">
                              {new Date(msg.date).toLocaleDateString('es-CL', {
                                day: '2-digit',
                                month: 'short',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                          </div>

                          <p className="text-xs font-semibold text-slate-200 line-clamp-1 mb-1">
                            {msg.subject}
                          </p>

                          <p className="text-[11px] text-slate-400 line-clamp-2 mb-2">
                            {msg.snippet || msg.bodyText}
                          </p>

                          {/* Badges */}
                          <div className="flex items-center justify-between gap-2 text-[10px] flex-wrap">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {msg.participant ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-950 text-emerald-300 border border-emerald-500/40 font-semibold">
                                  <User className="w-3 h-3 text-emerald-400" />
                                  {msg.participant.firstName} {msg.participant.lastName} ({msg.participant.rut})
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-950 text-amber-300 border border-amber-500/40 font-semibold">
                                  <AlertTriangle className="w-3 h-3 text-amber-400" />
                                  Sin Asociar
                                </span>
                              )}

                              {msg.ticket && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-purple-950 text-purple-300 border border-purple-500/40 font-bold">
                                  <Ticket className="w-3 h-3" />
                                  {msg.ticket.ticketNumber}
                                </span>
                              )}
                            </div>

                            <span className="text-slate-500 font-mono text-[9px]">
                              {msg.googleThreadId ? `Hilo: ${msg.googleThreadId.slice(0, 10)}...` : ''}
                            </span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Right Column: Message Detail & Thread Reader */}
              <div className="w-full md:w-1/2 flex flex-col overflow-hidden bg-[#000c33]">
                {selectedMessage ? (
                  <div className="flex-1 flex flex-col overflow-hidden">
                    {/* Message Header & Action Toolbar */}
                    <div className="p-4 bg-[#001558] border-b border-[#0d349e] space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h3 className="text-sm font-black text-white leading-snug">
                            {selectedMessage.subject}
                          </h3>
                          <div className="text-xs text-slate-300 mt-1 flex items-center gap-2">
                            <span>De: <strong className="text-white">{selectedMessage.senderName || selectedMessage.senderEmail}</strong></span>
                            <span>&lt;{selectedMessage.senderEmail}&gt;</span>
                          </div>
                          <div className="text-[11px] text-slate-400 mt-0.5 font-mono">
                            ID Mensaje Google: {selectedMessage.googleMessageId}
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-2 shrink-0">
                          {selectedMessage.participantId ? (
                            !selectedMessage.ticketId && (
                              <button
                                onClick={() => handleOpenTicketFromMessage(selectedMessage)}
                                className="px-3 py-1.5 rounded-xl bg-[#FEB135] text-[#001558] hover:bg-[#ffbe4f] text-xs font-bold transition flex items-center gap-1.5 shadow-md"
                              >
                                <Ticket className="w-3.5 h-3.5" />
                                <span>Crear Incidencia</span>
                              </button>
                            )
                          ) : (
                            <button
                              onClick={() => {
                                setMessageToAssociate(selectedMessage);
                                setParticipantCandidates([]);
                                setParticipantSearch('');
                                setShowAssociateModal(true);
                              }}
                              className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-md"
                            >
                              <Link2 className="w-3.5 h-3.5" />
                              <span>Asociar a Participante</span>
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Participant Link Card */}
                      {selectedMessage.participant && (
                        <div className="bg-[#000c33] border border-[#0d349e] p-2.5 rounded-xl flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2.5">
                            <div className="w-7 h-7 rounded-lg bg-[#001558] border border-emerald-500/40 flex items-center justify-center text-emerald-400 font-bold">
                              ✓
                            </div>
                            <div>
                              <span className="font-bold text-white block">
                                {selectedMessage.participant.firstName} {selectedMessage.participant.lastName}
                              </span>
                              <span className="text-[11px] text-slate-400">
                                RUT: {selectedMessage.participant.rut} • Unidad: {selectedMessage.participant.unitName || 'Sin asignar'} • Método: {selectedMessage.matchMethod}
                              </span>
                            </div>
                          </div>

                          {onSelectParticipant && (
                            <button
                              onClick={() => onSelectParticipant(selectedMessage.participant.id)}
                              className="text-xs font-bold text-[#FEB135] hover:underline flex items-center gap-1"
                            >
                              <span>Ver Ficha</span>
                              <ArrowRight className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Thread History / Message Body */}
                    <div className="flex-1 p-5 overflow-y-auto space-y-4">
                      {threadMessages.map((msg, idx) => (
                        <div key={msg.id} className="bg-[#001558]/50 border border-[#0d349e] rounded-xl p-4 space-y-2">
                          <div className="flex items-center justify-between text-xs pb-2 border-b border-[#0d349e]/50">
                            <span className="font-bold text-white">
                              #{idx + 1} {msg.senderName || msg.senderEmail}
                            </span>
                            <span className="text-slate-400">
                              {new Date(msg.date).toLocaleString('es-CL')}
                            </span>
                          </div>

                          <div className="text-xs text-slate-200 whitespace-pre-wrap leading-relaxed font-sans">
                            {msg.bodyText || msg.snippet}
                          </div>

                          {msg.hasAttachments && (
                            <div className="pt-2 text-[11px] text-[#FEB135] flex items-center gap-1.5">
                              <span>📎 Contiene archivos adjuntos (comprobante/documento)</span>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-400 space-y-2">
                    <Mail className="w-10 h-10 text-slate-600 stroke-1" />
                    <p className="text-xs">Selecciona un mensaje de la lista para ver el hilo completo y las opciones de gestión.</p>
                  </div>
                )}
              </div>
            </>
          )}

          {/* TAB 2: INCIDENTS / TICKETS */}
          {activeTab === 'incidents' && (
            <>
              {/* Left Column: Incidents List */}
              <div className="w-full md:w-1/2 border-r border-[#0d349e] flex flex-col overflow-hidden bg-[#000c33]/50">
                {/* Filters */}
                <div className="p-3 border-b border-[#0d349e] space-y-2 bg-[#001558]/40">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Buscar por N° ticket, título, participante o RUT..."
                      value={incidentSearch}
                      onChange={(e) => setIncidentSearch(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && loadIncidents()}
                      className="w-full bg-[#000c33] border border-[#0d349e] rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-[#FEB135]"
                    />
                  </div>

                  <div className="flex items-center gap-2 text-xs">
                    <select
                      value={incidentFilterStatus}
                      onChange={(e) => setIncidentFilterStatus(e.target.value)}
                      className="bg-[#000c33] border border-[#0d349e] rounded-lg px-2.5 py-1 text-[11px] text-white focus:outline-none focus:border-[#FEB135]"
                    >
                      <option value="ALL">Todos los Estados</option>
                      <option value="ABIERTA">Abierta</option>
                      <option value="EN_PROCESO">En Proceso</option>
                      <option value="RESUELTA">Resuelta</option>
                      <option value="CERRADA">Cerrada</option>
                    </select>

                    <select
                      value={incidentFilterCategory}
                      onChange={(e) => setIncidentFilterCategory(e.target.value)}
                      className="bg-[#000c33] border border-[#0d349e] rounded-lg px-2.5 py-1 text-[11px] text-white focus:outline-none focus:border-[#FEB135]"
                    >
                      <option value="ALL">Todas las Categorías</option>
                      <option value="FINANZAS">Finanzas / Pagos</option>
                      <option value="FICHA_MEDICA">Ficha Médica</option>
                      <option value="PASAJES_LOGISTICA">Pasajes / Logística</option>
                      <option value="CEDULA_LEGAL">Cédula / Documentos</option>
                      <option value="CONSULTA_GENERAL">Consulta General</option>
                    </select>
                  </div>
                </div>

                {/* Tickets List */}
                <div className="flex-1 overflow-y-auto divide-y divide-[#0d349e]/40">
                  {incidents.length === 0 ? (
                    <div className="p-8 text-center text-xs text-slate-400">
                      No hay incidencias registradas con estos filtros.
                    </div>
                  ) : (
                    incidents.map((inc) => {
                      const isSelected = selectedIncident?.id === inc.id;
                      return (
                        <div
                          key={inc.id}
                          onClick={() => setSelectedIncident(inc)}
                          className={`p-3.5 transition cursor-pointer text-left ${
                            isSelected
                              ? 'bg-[#001558] border-l-4 border-l-[#FEB135]'
                              : 'hover:bg-white/[0.03]'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <span className="font-mono font-bold text-xs text-[#FEB135]">
                              {inc.ticketNumber}
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                inc.status === 'ABIERTA'
                                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                  : inc.status === 'EN_PROCESO'
                                  ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                                  : inc.status === 'RESUELTA'
                                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                  : 'bg-slate-500/20 text-slate-300'
                              }`}
                            >
                              {inc.status}
                            </span>
                          </div>

                          <h4 className="text-xs font-bold text-white mb-1 line-clamp-1">
                            {inc.title}
                          </h4>

                          <p className="text-[11px] text-slate-300 mb-2">
                            Participante: <strong>{inc.participant?.firstName} {inc.participant?.lastName}</strong> ({inc.participant?.rut})
                          </p>

                          <div className="flex items-center justify-between text-[10px] text-slate-400">
                            <span className="px-2 py-0.5 rounded bg-[#000c33] border border-[#0d349e] font-semibold">
                              {inc.category}
                            </span>
                            <span className="font-bold text-red-400">
                              Prioridad: {inc.priority}
                            </span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Right Column: Incident Detail & Comments */}
              <div className="w-full md:w-1/2 flex flex-col overflow-hidden bg-[#000c33]">
                {selectedIncident ? (
                  <div className="flex-1 flex flex-col overflow-hidden">
                    {/* Incident Header */}
                    <div className="p-4 bg-[#001558] border-b border-[#0d349e] space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-black text-sm text-[#FEB135]">
                              {selectedIncident.ticketNumber}
                            </span>
                            <span className="text-xs px-2 py-0.5 rounded bg-[#0d349e] text-white font-bold">
                              {selectedIncident.category}
                            </span>
                          </div>
                          <h3 className="text-sm font-black text-white mt-1">
                            {selectedIncident.title}
                          </h3>
                        </div>

                        {/* Status Switcher */}
                        <div className="flex items-center gap-1.5">
                          {selectedIncident.status !== 'RESUELTA' && (
                            <button
                              onClick={() => handleUpdateIncidentStatus('RESUELTA', 'Resuelto satisfactoriamente por el equipo.')}
                              className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition"
                            >
                              Marcar Resuelta
                            </button>
                          )}
                          {selectedIncident.status === 'ABIERTA' && (
                            <button
                              onClick={() => handleUpdateIncidentStatus('EN_PROCESO')}
                              className="px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs transition"
                            >
                              Tomar Caso
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Participant Snapshot */}
                      <div className="bg-[#000c33] p-2.5 rounded-xl border border-[#0d349e] text-xs flex items-center justify-between">
                        <div>
                          <span className="font-bold text-white block">
                            {selectedIncident.participant?.firstName} {selectedIncident.participant?.lastName}
                          </span>
                          <span className="text-[11px] text-slate-400">
                            RUT: {selectedIncident.participant?.rut} • Contacto: {selectedIncident.participant?.email}
                          </span>
                        </div>
                        {onSelectParticipant && (
                          <button
                            onClick={() => onSelectParticipant(selectedIncident.participant.id)}
                            className="text-xs font-bold text-[#FEB135] hover:underline"
                          >
                            Ver Ficha
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Incident Timeline & Comments */}
                    <div className="flex-1 p-4 overflow-y-auto space-y-4">
                      {/* Original Description */}
                      <div className="bg-[#001558]/60 border border-[#0d349e] p-3.5 rounded-xl text-xs space-y-2">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                          Descripción Inicial del Caso
                        </span>
                        <p className="text-slate-200 whitespace-pre-wrap leading-relaxed">
                          {selectedIncident.description}
                        </p>
                      </div>

                      {/* Timeline Comments */}
                      <div className="space-y-3">
                        <span className="text-xs font-bold text-[#FEB135] uppercase tracking-wider block">
                          Bitácora y Comentarios Internos
                        </span>

                        {(selectedIncident.comments || []).map((c: any) => (
                          <div key={c.id} className="bg-[#001558]/40 border border-[#0d349e]/60 p-3 rounded-xl text-xs space-y-1">
                            <div className="flex items-center justify-between text-[11px] text-slate-400">
                              <strong className="text-white">{c.authorName}</strong>
                              <span>{new Date(c.createdAt).toLocaleString('es-CL')}</span>
                            </div>
                            <p className="text-slate-200">{c.content}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* New Comment Input */}
                    <form onSubmit={handleAddComment} className="p-3 bg-[#001558] border-t border-[#0d349e] flex gap-2">
                      <input
                        type="text"
                        placeholder="Escribir nota o actualización de la incidencia..."
                        value={newComment}
                        onChange={(e) => setNewComment(e.target.value)}
                        className="flex-1 bg-[#000c33] border border-[#0d349e] rounded-xl px-3 py-2 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-[#FEB135]"
                      />
                      <button
                        type="submit"
                        disabled={submittingComment || !newComment.trim()}
                        className="bg-[#FEB135] text-[#001558] hover:bg-[#ffbe4f] font-bold text-xs px-4 py-2 rounded-xl transition flex items-center gap-1.5 disabled:opacity-50"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>Agregar</span>
                      </button>
                    </form>
                  </div>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-400 space-y-2">
                    <Ticket className="w-10 h-10 text-slate-600 stroke-1" />
                    <p className="text-xs">Selecciona una incidencia para ver los detalles, notas internas y gestionar su resolución.</p>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Modal para Crear / Convertir en Incidencia */}
      {showNewTicketModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80">
          <div className="bg-[#000c33] border border-[#0d349e] w-full max-w-lg rounded-2xl shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#0d349e]">
              <h3 className="text-sm font-black text-white flex items-center gap-2">
                <Ticket className="w-4 h-4 text-[#FEB135]" />
                {ticketFromMessage ? 'Convertir Correo en Incidencia' : 'Nueva Incidencia CRM'}
              </h3>
              <button onClick={() => setShowNewTicketModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateTicket} className="space-y-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-300 mb-1">Título del Caso *</label>
                <input
                  type="text"
                  required
                  value={newTicketTitle}
                  onChange={(e) => setNewTicketTitle(e.target.value)}
                  className="w-full bg-[#001558] border border-[#0d349e] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-[#FEB135]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-300 mb-1">Categoría</label>
                  <select
                    value={newTicketCategory}
                    onChange={(e) => setNewTicketCategory(e.target.value)}
                    className="w-full bg-[#001558] border border-[#0d349e] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-[#FEB135]"
                  >
                    <option value="FINANZAS">Finanzas / Pagos</option>
                    <option value="FICHA_MEDICA">Ficha Médica</option>
                    <option value="PASAJES_LOGISTICA">Pasajes / Logística</option>
                    <option value="CEDULA_LEGAL">Cédula / Documentos</option>
                    <option value="CONSULTA_GENERAL">Consulta General</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-300 mb-1">Prioridad</label>
                  <select
                    value={newTicketPriority}
                    onChange={(e) => setNewTicketPriority(e.target.value)}
                    className="w-full bg-[#001558] border border-[#0d349e] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-[#FEB135]"
                  >
                    <option value="BAJA">Baja</option>
                    <option value="MEDIA">Media</option>
                    <option value="ALTA">Alta</option>
                    <option value="URGENTE">Urgente</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-300 mb-1">Descripción / Notas</label>
                <textarea
                  rows={4}
                  value={newTicketDescription}
                  onChange={(e) => setNewTicketDescription(e.target.value)}
                  className="w-full bg-[#001558] border border-[#0d349e] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-[#FEB135]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-[#0d349e]">
                <button
                  type="button"
                  onClick={() => setShowNewTicketModal(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-300 hover:bg-white/5 rounded-lg"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-5 py-2 bg-[#FEB135] text-[#001558] font-bold text-xs rounded-lg hover:bg-[#ffbe4f] transition flex items-center gap-1.5"
                >
                  {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Guardar Incidencia</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Asociación Manual de Correo a Participante */}
      {showAssociateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80">
          <div className="bg-[#000c33] border border-[#0d349e] w-full max-w-lg rounded-2xl shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#0d349e]">
              <h3 className="text-sm font-black text-white flex items-center gap-2">
                <Link2 className="w-4 h-4 text-emerald-400" />
                Asociar Correo a un Participante
              </h3>
              <button onClick={() => setShowAssociateModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <p className="text-xs text-slate-300">
                Correo remitente: <strong className="text-white">{messageToAssociate?.senderEmail}</strong>
              </p>

              <div>
                <label className="block text-[11px] font-bold text-slate-300 mb-1">
                  Buscar Participante por RUT, Nombre o Apellido:
                </label>
                <input
                  type="text"
                  placeholder="Ej: 21.345.678-4 o Sepúlveda..."
                  value={participantSearch}
                  onChange={(e) => searchCandidates(e.target.value)}
                  className="w-full bg-[#001558] border border-[#0d349e] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-[#FEB135]"
                />
              </div>

              {/* Candidates List */}
              <div className="max-h-48 overflow-y-auto divide-y divide-[#0d349e] border border-[#0d349e] rounded-xl bg-[#001558]/40">
                {searchingCandidates ? (
                  <div className="p-4 text-center text-xs text-slate-400">Buscando...</div>
                ) : participantCandidates.length === 0 ? (
                  <div className="p-4 text-center text-xs text-slate-400">
                    {participantSearch.length >= 2 ? 'No se encontraron participantes' : 'Ingresa al menos 2 caracteres'}
                  </div>
                ) : (
                  participantCandidates.map((p) => (
                    <div
                      key={p.id}
                      onClick={() => handleAssociateParticipant(p.id)}
                      className="p-3 hover:bg-[#001558] cursor-pointer flex items-center justify-between text-xs transition"
                    >
                      <div>
                        <strong className="text-white block">{p.firstName} {p.lastName}</strong>
                        <span className="text-[11px] text-slate-400">RUT: {p.rut} • {p.email}</span>
                      </div>
                      <button className="px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[10px]">
                        Vincular
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
