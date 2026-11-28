'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  X,
  Mail,
  Ticket,
  RefreshCw,
  Search,
  CheckCircle2,
  AlertTriangle,
  User,
  PlusCircle,
  Link2,
  Send,
  Loader2,
  ArrowRight,
} from 'lucide-react';
import type {
  EmailMessageDTO,
  IncidentDTO,
  IncidentCommentDTO,
  ParticipantDTO,
  EventSummary,
  UserSessionDTO,
  EventPermissions,
} from '@/types/domain';

export interface CrmWorkspaceProps {
  activeEvent: EventSummary | null;
  currentUser: UserSessionDTO | null;
  permissions?: EventPermissions | null;
  onSelectParticipant?: (participantId: string) => void;
  embedded?: boolean;
  onClose?: () => void;
}

export interface InboxAndIncidentsModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeEvent: EventSummary | null;
  currentUser: UserSessionDTO | null;
  permissions?: EventPermissions | null;
  onSelectParticipant?: (participantId: string) => void;
}

interface InboxMetrics {
  total: number;
  associated: number;
  unassociated: number;
  tickets: number;
}

interface IncidentMetrics {
  total: number;
  ABIERTA: number;
  EN_PROCESO: number;
  RESUELTA: number;
  CERRADA: number;
}

const EMPTY_INBOX_METRICS: InboxMetrics = {
  total: 0,
  associated: 0,
  unassociated: 0,
  tickets: 0,
};

const EMPTY_INCIDENT_METRICS: IncidentMetrics = {
  total: 0,
  ABIERTA: 0,
  EN_PROCESO: 0,
  RESUELTA: 0,
  CERRADA: 0,
};

export function CrmWorkspace({
  activeEvent,
  currentUser,
  permissions,
  onSelectParticipant,
  embedded = false,
  onClose,
}: CrmWorkspaceProps) {
  const [activeTab, setActiveTab] = useState<'inbox' | 'incidents'>('inbox');
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);

  // Inbox state
  const [messages, setMessages] = useState<EmailMessageDTO[]>([]);
  const [inboxMetrics, setInboxMetrics] = useState<InboxMetrics>(EMPTY_INBOX_METRICS);
  const [inboxFilter, setInboxFilter] = useState<'all' | 'associated' | 'unassociated' | 'tickets'>('all');
  const [inboxSearch, setInboxSearch] = useState('');
  const [selectedMessage, setSelectedMessage] = useState<EmailMessageDTO | null>(null);
  const [threadMessages, setThreadMessages] = useState<EmailMessageDTO[]>([]);

  // Incidents state
  const [incidents, setIncidents] = useState<IncidentDTO[]>([]);
  const [incidentMetrics, setIncidentMetrics] = useState<IncidentMetrics>(EMPTY_INCIDENT_METRICS);
  const [incidentFilterStatus, setIncidentFilterStatus] = useState('ALL');
  const [incidentFilterCategory, setIncidentFilterCategory] = useState('ALL');
  const [incidentSearch, setIncidentSearch] = useState('');
  const [selectedIncident, setSelectedIncident] = useState<IncidentDTO | null>(null);
  const [loadingIncidentDetail, setLoadingIncidentDetail] = useState(false);

  // New ticket modal state
  const [showNewTicketModal, setShowNewTicketModal] = useState(false);
  const [ticketFromMessage, setTicketFromMessage] = useState<EmailMessageDTO | null>(null);
  const [newTicketTitle, setNewTicketTitle] = useState('');
  const [newTicketCategory, setNewTicketCategory] = useState('CONSULTA_GENERAL');
  const [newTicketPriority, setNewTicketPriority] = useState('MEDIA');
  const [newTicketDescription, setNewTicketDescription] = useState('');
  const [newTicketParticipantId, setNewTicketParticipantId] = useState('');
  const [selectedNewTicketParticipant, setSelectedNewTicketParticipant] = useState<ParticipantDTO | null>(null);
  const [newTicketParticipantQuery, setNewTicketParticipantQuery] = useState('');
  const [newTicketParticipantCandidates, setNewTicketParticipantCandidates] = useState<ParticipantDTO[]>([]);
  const [searchingTicketCandidates, setSearchingTicketCandidates] = useState(false);
  const [newTicketError, setNewTicketError] = useState<string | null>(null);

  // Comment state
  const [newComment, setNewComment] = useState('');
  const [commentIsPublic, setCommentIsPublic] = useState(false);
  const [submittingComment, setSubmittingComment] = useState(false);

  // Manual Association state
  const [showAssociateModal, setShowAssociateModal] = useState(false);
  const [messageToAssociate, setMessageToAssociate] = useState<EmailMessageDTO | null>(null);
  const [participantSearch, setParticipantSearch] = useState('');
  const [participantCandidates, setParticipantCandidates] = useState<ParticipantDTO[]>([]);
  const [searchingCandidates, setSearchingCandidates] = useState(false);

  const [notification, setNotification] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const canManageCrm = !permissions || permissions.canManageCrm;
  const activeEventId = activeEvent?.id;

  const loadMessages = useCallback(async () => {
    if (!activeEventId) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ eventId: activeEventId });
      if (inboxFilter !== 'all') params.append('filter', inboxFilter);
      if (inboxSearch) params.append('search', inboxSearch);

      const res = await fetch(`/api/inbox?${params.toString()}`);
      if (res.ok) {
        const data = (await res.json()) as {
          messages?: EmailMessageDTO[];
          metrics?: InboxMetrics;
        };
        setMessages(data.messages || []);
        if (data.metrics) {
          setInboxMetrics(data.metrics);
        }
      }
    } catch (err: unknown) {
      console.error('Error loading messages:', err);
    } finally {
      setLoading(false);
    }
  }, [activeEventId, inboxFilter, inboxSearch]);

  const loadIncidents = useCallback(async () => {
    if (!activeEventId) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ eventId: activeEventId });
      if (incidentFilterStatus !== 'ALL') params.append('status', incidentFilterStatus);
      if (incidentFilterCategory !== 'ALL') params.append('category', incidentFilterCategory);
      if (incidentSearch) params.append('search', incidentSearch);

      const res = await fetch(`/api/incidents?${params.toString()}`);
      if (res.ok) {
        const data = (await res.json()) as {
          incidents?: IncidentDTO[];
          metrics?: IncidentMetrics;
        };
        setIncidents(data.incidents || []);
        if (data.metrics) {
          setIncidentMetrics(data.metrics);
        }
      }
    } catch (err: unknown) {
      console.error('Error loading incidents:', err);
    } finally {
      setLoading(false);
    }
  }, [activeEventId, incidentFilterStatus, incidentFilterCategory, incidentSearch]);

  useEffect(() => {
    if (!activeEventId) return;
    let cancelled = false;

    const run = async () => {
      await Promise.resolve();
      if (cancelled) return;
      await loadMessages();
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [activeEventId, loadMessages]);

  useEffect(() => {
    if (!activeEventId) return;
    let cancelled = false;

    const run = async () => {
      await Promise.resolve();
      if (cancelled) return;
      await loadIncidents();
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [activeEventId, loadIncidents]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (showAssociateModal) {
        setShowAssociateModal(false);
        return;
      }
      if (showNewTicketModal) {
        setShowNewTicketModal(false);
        return;
      }
      if (!embedded && onClose) {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [embedded, onClose, showAssociateModal, showNewTicketModal]);

  // Sincronizar correos desde Gmail / Simulación
  const handleSyncInbox = async () => {
    if (!activeEvent?.id || !canManageCrm) return;
    setSyncing(true);
    setNotification(null);
    try {
      const res = await fetch('/api/inbox', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId: activeEvent.id }),
      });
      const data = (await res.json()) as { message?: string; error?: string };
      if (!res.ok) throw new Error(data.error || 'Error al sincronizar');

      setNotification({ type: 'success', text: data.message || 'Inbox sincronizado con éxito.' });
      await loadMessages();
    } catch (err: unknown) {
      setNotification({
        type: 'error',
        text: err instanceof Error ? err.message : 'Error al sincronizar correos',
      });
    } finally {
      setSyncing(false);
    }
  };

  // Ver detalle de mensaje e hilo
  const handleSelectMessage = async (msg: EmailMessageDTO) => {
    setSelectedMessage(msg);
    setThreadMessages([msg]);
    try {
      const res = await fetch(`/api/inbox/${msg.id}`);
      if (res.ok) {
        const data = (await res.json()) as {
          message?: EmailMessageDTO;
          threadMessages?: EmailMessageDTO[];
        };
        if (data.message) {
          setSelectedMessage(data.message);
        }
        setThreadMessages(data.threadMessages && data.threadMessages.length > 0 ? data.threadMessages : [msg]);
      }
    } catch {
      setThreadMessages([msg]);
    }
  };

  // Cargar detalle completo de incidencia (comentarios + correos vinculados)
  const handleSelectIncident = async (inc: IncidentDTO) => {
    setSelectedIncident(inc);
    setLoadingIncidentDetail(true);
    try {
      const res = await fetch(`/api/incidents/${inc.id}`);
      if (res.ok) {
        const data = (await res.json()) as { incident?: IncidentDTO };
        if (data.incident) {
          setSelectedIncident(data.incident);
        }
      }
    } catch (err: unknown) {
      console.error('Error loading incident detail:', err);
    } finally {
      setLoadingIncidentDetail(false);
    }
  };

  // Convertir correo en Ticket
  const handleOpenTicketFromMessage = (msg: EmailMessageDTO) => {
    setTicketFromMessage(msg);
    setNewTicketTitle(msg.subject);
    setNewTicketDescription(msg.bodyText || msg.snippet || '');
    setNewTicketParticipantId(msg.participantId || '');
    setSelectedNewTicketParticipant(null);
    setNewTicketParticipantQuery('');
    setNewTicketParticipantCandidates([]);
    setNewTicketError(null);
    setNewTicketCategory(
      msg.subject.toLowerCase().includes('cuota') || msg.subject.toLowerCase().includes('pago')
        ? 'FINANZAS'
        : msg.subject.toLowerCase().includes('médic') || msg.subject.toLowerCase().includes('salud')
        ? 'FICHA_MEDICA'
        : 'CONSULTA_GENERAL'
    );
    setShowNewTicketModal(true);
  };

  // Abrir modal de Nueva Incidencia independiente
  const handleOpenStandaloneTicketModal = () => {
    setTicketFromMessage(null);
    setNewTicketTitle('');
    setNewTicketDescription('');
    setNewTicketCategory('CONSULTA_GENERAL');
    setNewTicketPriority('MEDIA');
    setNewTicketParticipantId('');
    setSelectedNewTicketParticipant(null);
    setNewTicketParticipantQuery('');
    setNewTicketParticipantCandidates([]);
    setNewTicketError(null);
    setShowNewTicketModal(true);
  };

  // Buscar participantes para Nueva Incidencia independiente
  const searchNewTicketCandidates = async (query: string) => {
    setNewTicketParticipantQuery(query);
    setNewTicketError(null);
    if (!query || query.trim().length < 2 || !activeEvent?.id) {
      setNewTicketParticipantCandidates([]);
      return;
    }
    setSearchingTicketCandidates(true);
    try {
      const res = await fetch(
        `/api/participants?eventId=${activeEvent.id}&search=${encodeURIComponent(query.trim())}&limit=6`
      );
      if (res.ok) {
        const data = (await res.json()) as { participants?: ParticipantDTO[] };
        setNewTicketParticipantCandidates(data.participants || []);
      }
    } finally {
      setSearchingTicketCandidates(false);
    }
  };

  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    setNewTicketError(null);

    if (!activeEvent?.id) return;

    if (!newTicketParticipantId) {
      setNewTicketError('Debes buscar y seleccionar un participante antes de guardar la incidencia.');
      return;
    }

    setLoading(true);
    try {
      let res: Response;
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

      const data = (await res.json()) as { message?: string; error?: string };
      if (!res.ok) throw new Error(data.error || 'Error al crear incidencia');

      setNotification({ type: 'success', text: data.message || 'Incidencia creada con éxito.' });
      setShowNewTicketModal(false);
      setTicketFromMessage(null);
      if (activeTab === 'inbox') {
        await loadMessages();
      } else {
        await loadIncidents();
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error al crear incidencia';
      setNewTicketError(message);
      setNotification({ type: 'error', text: message });
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
      const res = await fetch(
        `/api/participants?eventId=${activeEvent.id}&search=${encodeURIComponent(query)}&limit=6`
      );
      if (res.ok) {
        const data = (await res.json()) as { participants?: ParticipantDTO[] };
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
      const data = (await res.json()) as { updated?: EmailMessageDTO; error?: string };
      if (!res.ok) {
        throw new Error(data.error || 'Error al asociar el correo');
      }

      if (data.updated && selectedMessage?.id === messageToAssociate.id) {
        setSelectedMessage((prev) => (prev ? { ...prev, ...data.updated } : data.updated || null));
      }

      setShowAssociateModal(false);
      setMessageToAssociate(null);
      setNotification({ type: 'success', text: 'Correo asociado exitosamente al participante.' });
      await loadMessages();
    } catch (err: unknown) {
      setNotification({
        type: 'error',
        text: err instanceof Error ? err.message : 'Error al asociar el correo',
      });
    }
  };

  // Agregar comentario a incidencia
  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedIncident?.id || !newComment.trim() || !canManageCrm) return;
    setSubmittingComment(true);

    try {
      const res = await fetch(`/api/incidents/${selectedIncident.id}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: newComment, isInternal: !commentIsPublic }),
      });
      if (res.ok) {
        const data = (await res.json()) as { comment: IncidentCommentDTO };
        setSelectedIncident({
          ...selectedIncident,
          comments: [...(selectedIncident.comments || []), data.comment],
        });
        setNewComment('');
        setCommentIsPublic(false);
      }
    } finally {
      setSubmittingComment(false);
    }
  };

  // Actualizar estado de incidencia
  const handleUpdateIncidentStatus = async (status: string, notes?: string) => {
    if (!selectedIncident?.id || !canManageCrm) return;
    try {
      const res = await fetch(`/api/incidents/${selectedIncident.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, resolutionNotes: notes }),
      });
      if (res.ok) {
        const data = (await res.json()) as { incident: IncidentDTO };
        setSelectedIncident((prev) =>
          prev
            ? {
                ...prev,
                ...data.incident,
                comments: data.incident.comments ?? prev.comments,
                messages: data.incident.messages ?? prev.messages,
              }
            : data.incident
        );
        await loadIncidents();
      }
    } catch (err: unknown) {
      console.error(err);
    }
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

  const openCasesCount = incidentMetrics.ABIERTA + incidentMetrics.EN_PROCESO;

  const workspaceCard = (
    <div
      className={
        embedded
          ? 'bg-white border border-slate-200 w-full rounded-2xl shadow-xs overflow-hidden flex flex-col'
          : 'bg-white border border-slate-200 w-full max-w-6xl rounded-2xl shadow-2xl overflow-hidden flex flex-col h-[92vh]'
      }
    >
      {/* Header */}
      <div className="bg-[#001558] px-6 py-4 border-b-4 border-b-[#FEB135] flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-[#FEB135] text-[#001558] flex items-center justify-center shrink-0">
            {activeTab === 'inbox' ? <Mail className="w-5 h-5" /> : <Ticket className="w-5 h-5" />}
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base sm:text-lg font-black text-white truncate">
                Centro de Comunicaciones & Incidencias CRM
              </h2>
              {activeEvent && (
                <span className="px-2 py-0.5 rounded text-[10px] font-black bg-[#FEB135] text-[#001558]">
                  {activeEvent.shortName || activeEvent.name}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-200 truncate">
              Lectura de correos, asociación a participantes y seguimiento de casos
              {currentUser?.name ? ` • Operador: ${currentUser.name}` : ''}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {canManageCrm && (
            <button
              onClick={handleSyncInbox}
              disabled={syncing}
              className="px-3.5 py-1.5 rounded-xl bg-[#FEB135] hover:bg-[#e59c22] text-[#001558] text-xs font-black transition flex items-center gap-2 shadow-xs disabled:opacity-50 cursor-pointer"
              title="Sincronizar correos de Gmail o generar muestra"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Sincronizar Inbox</span>
            </button>
          )}

          {!embedded && onClose && (
            <button
              onClick={onClose}
              className="text-slate-200 hover:text-white p-2 rounded-lg hover:bg-white/10 transition cursor-pointer"
              aria-label="Cerrar centro CRM"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

        {/* Tab Navigation */}
        <div className="flex items-center justify-between px-4 sm:px-6 bg-[#F5F6F8] border-b border-slate-200 overflow-x-auto">
          <div className="flex gap-1">
            <button
              onClick={() => {
                setActiveTab('inbox');
                setSelectedMessage(null);
              }}
              className={`flex items-center gap-2 px-4 sm:px-5 py-3 text-xs font-bold uppercase tracking-wider transition border-b-2 whitespace-nowrap cursor-pointer ${
                activeTab === 'inbox'
                  ? 'border-[#001558] text-[#001558] bg-white'
                  : 'border-transparent text-slate-600 hover:text-[#001558]'
              }`}
            >
              <Mail className="w-4 h-4" />
              Bandeja de Entrada & Correos ({messages.length})
            </button>

            <button
              onClick={() => {
                setActiveTab('incidents');
                setSelectedIncident(null);
              }}
              className={`flex items-center gap-2 px-4 sm:px-5 py-3 text-xs font-bold uppercase tracking-wider transition border-b-2 whitespace-nowrap cursor-pointer ${
                activeTab === 'incidents'
                  ? 'border-[#001558] text-[#001558] bg-white'
                  : 'border-transparent text-slate-600 hover:text-[#001558]'
              }`}
            >
              <Ticket className="w-4 h-4" />
              Incidencias & Casos CRM ({incidents.length})
            </button>
          </div>

          {activeTab === 'incidents' && canManageCrm && (
            <button
              onClick={handleOpenStandaloneTicketModal}
              className="px-3 py-1.5 rounded-lg bg-[#001558] hover:bg-[#0b2370] text-white text-xs font-bold transition flex items-center gap-1.5 shadow-xs whitespace-nowrap cursor-pointer shrink-0 ml-2"
            >
              <PlusCircle className="w-3.5 h-3.5 text-[#FEB135]" />
              Nueva Incidencia
            </button>
          )}
        </div>

        {/* Status Notification */}
        {notification && (
          <div
            className={`px-6 py-2.5 text-xs flex items-center justify-between border-b ${
              notification.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : 'bg-red-50 text-red-700 border-red-200'
            }`}
          >
            <div className="flex items-center gap-2 font-medium">
              {notification.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
              )}
              <span>{notification.text}</span>
            </div>
            <button
              onClick={() => setNotification(null)}
              className="text-slate-500 hover:text-slate-800 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Main Content Area */}
        <div
          className={
            embedded
              ? 'flex-1 flex flex-col md:flex-row min-h-[540px]'
              : 'flex-1 overflow-hidden flex flex-col md:flex-row'
          }
        >
          {/* TAB 1: INBOX */}
          {activeTab === 'inbox' && (
            <>
              {/* Left Column: Messages List */}
              <div className="w-full md:w-1/2 border-r border-slate-200 flex flex-col overflow-hidden bg-white">
                {/* Filters & Search */}
                <div className="p-3 border-b border-slate-200 space-y-2 bg-[#F5F6F8]">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Buscar por asunto, remitente o RUT..."
                      value={inboxSearch}
                      onChange={(e) => setInboxSearch(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && void loadMessages()}
                      className="w-full bg-white border border-slate-300 rounded-xl pl-9 pr-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:border-[#001558] focus:ring-2 focus:ring-[#FEB135]/50 focus:outline-none"
                    />
                  </div>

                  <div className="flex items-center gap-1.5 overflow-x-auto text-[11px]">
                    <button
                      onClick={() => setInboxFilter('all')}
                      className={`px-2.5 py-1 rounded-lg font-bold transition whitespace-nowrap cursor-pointer border ${
                        inboxFilter === 'all'
                          ? 'bg-[#001558] text-white border-[#001558]'
                          : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      Todos ({messages.length})
                    </button>
                    <button
                      onClick={() => setInboxFilter('associated')}
                      className={`px-2.5 py-1 rounded-lg font-bold transition whitespace-nowrap cursor-pointer border ${
                        inboxFilter === 'associated'
                          ? 'bg-emerald-600 text-white border-emerald-600'
                          : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      Asociados
                    </button>
                    <button
                      onClick={() => setInboxFilter('unassociated')}
                      className={`px-2.5 py-1 rounded-lg font-bold transition whitespace-nowrap cursor-pointer border ${
                        inboxFilter === 'unassociated'
                          ? 'bg-[#FEB135] text-[#001558] border-[#FEB135]'
                          : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      Pendientes
                    </button>
                    <button
                      onClick={() => setInboxFilter('tickets')}
                      className={`px-2.5 py-1 rounded-lg font-bold transition whitespace-nowrap cursor-pointer border ${
                        inboxFilter === 'tickets'
                          ? 'bg-purple-700 text-white border-purple-700'
                          : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      Con Ticket
                    </button>
                  </div>
                </div>

                {/* List */}
                <div className="flex-1 overflow-y-auto divide-y divide-slate-200">
                  {loading ? (
                    <div className="p-8 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin text-[#001558]" />
                      <span>Cargando mensajes...</span>
                    </div>
                  ) : messages.length === 0 ? (
                    <div className="p-8 text-center text-xs text-slate-500 space-y-3">
                      <Mail className="w-8 h-8 mx-auto text-slate-400 stroke-1" />
                      <p>No se encontraron correos con los filtros actuales.</p>
                      {canManageCrm && (
                        <button
                          onClick={handleSyncInbox}
                          className="px-4 py-2 rounded-xl bg-[#001558] hover:bg-[#0b2370] text-white font-bold text-xs cursor-pointer transition-colors"
                        >
                          Sincronizar Correos de Muestra
                        </button>
                      )}
                    </div>
                  ) : (
                    messages.map((msg) => {
                      const isSelected = selectedMessage?.id === msg.id;
                      return (
                        <div
                          key={msg.id}
                          onClick={() => void handleSelectMessage(msg)}
                          className={`p-3.5 transition cursor-pointer text-left ${
                            isSelected
                              ? 'bg-[#FFFBF0] border-l-4 border-l-[#FEB135]'
                              : 'hover:bg-slate-50'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <span className="font-bold text-xs text-[#001558] truncate">
                              {msg.senderName || msg.senderEmail}
                            </span>
                            <span className="text-[10px] text-slate-500 whitespace-nowrap">
                              {new Date(msg.date).toLocaleDateString('es-CL', {
                                day: '2-digit',
                                month: 'short',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                          </div>

                          <p className="text-xs font-bold text-slate-800 line-clamp-1 mb-1">
                            {msg.subject}
                          </p>

                          <p className="text-[11px] text-slate-600 line-clamp-2 mb-2">
                            {msg.snippet || msg.bodyText}
                          </p>

                          {/* Badges */}
                          <div className="flex items-center justify-between gap-2 text-[10px] flex-wrap">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {msg.participant ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200 font-semibold">
                                  <User className="w-3 h-3 text-emerald-600" />
                                  {msg.participant.firstName} {msg.participant.lastName} ({msg.participant.rut})
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200 font-semibold">
                                  <AlertTriangle className="w-3 h-3 text-amber-600" />
                                  Sin Asociar
                                </span>
                              )}

                              {msg.ticket && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#EEF2FF] text-[#001558] border border-[#001558]/20 font-bold">
                                  <Ticket className="w-3 h-3" />
                                  {msg.ticket.ticketNumber}
                                </span>
                              )}
                            </div>

                            <span className="text-slate-400 font-mono text-[9px]">
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
              <div className="w-full md:w-1/2 flex flex-col overflow-hidden bg-[#F5F6F8]">
                {selectedMessage ? (
                  <div className="flex-1 flex flex-col overflow-hidden">
                    {/* Message Header & Action Toolbar */}
                    <div className="p-4 bg-white border-b border-slate-200 space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h3 className="text-sm font-black text-[#001558] leading-snug">
                            {selectedMessage.subject}
                          </h3>
                          <div className="text-xs text-slate-600 mt-1 flex flex-wrap items-center gap-1.5">
                            <span>
                              De:{' '}
                              <strong className="text-[#001558]">
                                {selectedMessage.senderName || selectedMessage.senderEmail}
                              </strong>
                            </span>
                            <span className="text-slate-500">&lt;{selectedMessage.senderEmail}&gt;</span>
                          </div>
                          {selectedMessage.googleMessageId && (
                            <div className="text-[11px] text-slate-400 mt-0.5 font-mono">
                              ID Mensaje Google: {selectedMessage.googleMessageId}
                            </div>
                          )}
                        </div>

                        {/* Actions */}
                        {canManageCrm && (
                          <div className="flex items-center gap-2 shrink-0">
                            {selectedMessage.participantId ? (
                              !selectedMessage.ticketId && (
                                <button
                                  onClick={() => handleOpenTicketFromMessage(selectedMessage)}
                                  className="px-3 py-1.5 rounded-xl bg-[#FEB135] hover:bg-[#e59c22] text-[#001558] text-xs font-black transition flex items-center gap-1.5 shadow-xs cursor-pointer"
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
                                className="px-3 py-1.5 rounded-xl bg-[#001558] hover:bg-[#0b2370] text-white text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer"
                              >
                                <Link2 className="w-3.5 h-3.5 text-[#FEB135]" />
                                <span>Asociar a Participante</span>
                              </button>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Participant Link Card */}
                      {selectedMessage.participant && (
                        <div className="bg-[#FFFBF0] border border-[#FEB135]/40 border-l-4 border-l-[#FEB135] p-2.5 rounded-xl flex items-center justify-between text-xs text-[#001558]">
                          <div className="flex items-center gap-2.5">
                            <div className="w-7 h-7 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700 font-bold shrink-0">
                              ✓
                            </div>
                            <div>
                              <span className="font-bold text-[#001558] block">
                                {selectedMessage.participant.firstName} {selectedMessage.participant.lastName}
                              </span>
                              <span className="text-[11px] text-slate-600">
                                RUT: {selectedMessage.participant.rut} • Unidad:{' '}
                                {selectedMessage.participant.unitName || 'Sin asignar'} • Método:{' '}
                                {selectedMessage.matchMethod || 'MANUAL'}
                              </span>
                            </div>
                          </div>

                          {onSelectParticipant && selectedMessage.participant.id && (
                            <button
                              onClick={() => onSelectParticipant(selectedMessage.participant!.id)}
                              className="text-xs font-bold text-[#001558] hover:underline flex items-center gap-1 cursor-pointer shrink-0"
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
                        <div
                          key={msg.id}
                          className="bg-white border border-slate-200 rounded-xl p-4 space-y-2 shadow-2xs"
                        >
                          <div className="flex items-center justify-between text-xs pb-2 border-b border-slate-200">
                            <span className="font-bold text-[#001558]">
                              #{idx + 1} {msg.senderName || msg.senderEmail}
                            </span>
                            <span className="text-slate-500">
                              {new Date(msg.date).toLocaleString('es-CL')}
                            </span>
                          </div>

                          <div className="text-xs text-slate-700 whitespace-pre-wrap leading-relaxed font-sans">
                            {msg.bodyText || msg.snippet}
                          </div>

                          {msg.hasAttachments && (
                            <div className="pt-2 text-[11px] text-[#001558] font-semibold flex items-center gap-1.5">
                              <span>📎 Contiene archivos adjuntos (comprobante/documento)</span>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-500 space-y-2">
                    <Mail className="w-10 h-10 text-slate-400 stroke-1" />
                    <p className="text-xs">
                      Selecciona un mensaje de la lista para ver el hilo completo y las opciones de gestión.
                    </p>
                  </div>
                )}
              </div>
            </>
          )}

          {/* TAB 2: INCIDENTS / TICKETS */}
          {activeTab === 'incidents' && (
            <>
              {/* Left Column: Incidents List */}
              <div className="w-full md:w-1/2 border-r border-slate-200 flex flex-col overflow-hidden bg-white">
                {/* Filters */}
                <div className="p-3 border-b border-slate-200 space-y-2 bg-[#F5F6F8]">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Buscar por N° ticket, título, participante o RUT..."
                      value={incidentSearch}
                      onChange={(e) => setIncidentSearch(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && void loadIncidents()}
                      className="w-full bg-white border border-slate-300 rounded-xl pl-9 pr-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:border-[#001558] focus:ring-2 focus:ring-[#FEB135]/50 focus:outline-none"
                    />
                  </div>

                  <div className="flex items-center gap-2 text-xs">
                    <select
                      value={incidentFilterStatus}
                      onChange={(e) => setIncidentFilterStatus(e.target.value)}
                      className="bg-white border border-slate-300 rounded-lg px-2.5 py-1 text-[11px] text-slate-800 focus:border-[#001558] focus:ring-2 focus:ring-[#FEB135]/50 focus:outline-none font-medium"
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
                      className="bg-white border border-slate-300 rounded-lg px-2.5 py-1 text-[11px] text-slate-800 focus:border-[#001558] focus:ring-2 focus:ring-[#FEB135]/50 focus:outline-none font-medium"
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
                <div className="flex-1 overflow-y-auto divide-y divide-slate-200">
                  {loading ? (
                    <div className="p-8 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin text-[#001558]" />
                      <span>Cargando incidencias...</span>
                    </div>
                  ) : incidents.length === 0 ? (
                    <div className="p-8 text-center text-xs text-slate-500">
                      No hay incidencias registradas con estos filtros.
                    </div>
                  ) : (
                    incidents.map((inc) => {
                      const isSelected = selectedIncident?.id === inc.id;
                      return (
                        <div
                          key={inc.id}
                          onClick={() => void handleSelectIncident(inc)}
                          className={`p-3.5 transition cursor-pointer text-left ${
                            isSelected
                              ? 'bg-[#FFFBF0] border-l-4 border-l-[#FEB135]'
                              : 'hover:bg-slate-50'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <span className="font-mono font-bold text-xs text-[#001558] bg-[#FFF8E1] border border-[#FEB135] px-2 py-0.5 rounded">
                              {inc.ticketNumber}
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold border ${getIncidentStatusBadge(
                                inc.status
                              )}`}
                            >
                              {inc.status}
                            </span>
                          </div>

                          <h4 className="text-xs font-bold text-[#001558] mb-1 line-clamp-1">
                            {inc.title}
                          </h4>

                          <p className="text-[11px] text-slate-600 mb-2">
                            Participante:{' '}
                            <strong className="text-slate-800">
                              {inc.participant?.firstName} {inc.participant?.lastName}
                            </strong>{' '}
                            ({inc.participant?.rut})
                          </p>

                          <div className="flex items-center justify-between text-[10px] text-slate-500">
                            <span className="px-2 py-0.5 rounded bg-[#EEF2FF] text-[#001558] border border-[#001558]/20 font-semibold">
                              {inc.category}
                            </span>
                            <span className="font-bold text-red-700">Prioridad: {inc.priority}</span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Right Column: Incident Detail, Linked Messages & Comments */}
              <div className="w-full md:w-1/2 flex flex-col overflow-hidden bg-[#F5F6F8]">
                {selectedIncident ? (
                  <div className="flex-1 flex flex-col overflow-hidden">
                    {/* Incident Header */}
                    <div className="p-4 bg-white border-b border-slate-200 space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-mono font-black text-xs px-2 py-0.5 rounded bg-[#FFF8E1] border border-[#FEB135] text-[#001558]">
                              {selectedIncident.ticketNumber}
                            </span>
                            <span className="text-xs px-2 py-0.5 rounded bg-[#EEF2FF] text-[#001558] font-bold border border-[#001558]/20">
                              {selectedIncident.category}
                            </span>
                            <span
                              className={`text-[10px] px-2 py-0.5 rounded font-bold border ${getIncidentStatusBadge(
                                selectedIncident.status
                              )}`}
                            >
                              {selectedIncident.status}
                            </span>
                          </div>
                          <h3 className="text-sm font-black text-[#001558] mt-1.5">
                            {selectedIncident.title}
                          </h3>
                        </div>

                        {/* Status Switcher */}
                        {canManageCrm && (
                          <div className="flex items-center gap-1.5 shrink-0">
                            {selectedIncident.status !== 'RESUELTA' && (
                              <button
                                onClick={() =>
                                  void handleUpdateIncidentStatus(
                                    'RESUELTA',
                                    'Resuelto satisfactoriamente por el equipo.'
                                  )
                                }
                                className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition cursor-pointer"
                              >
                                Marcar Resuelta
                              </button>
                            )}
                            {selectedIncident.status === 'ABIERTA' && (
                              <button
                                onClick={() => void handleUpdateIncidentStatus('EN_PROCESO')}
                                className="px-2.5 py-1 rounded-lg bg-[#001558] hover:bg-[#0b2370] text-white font-bold text-xs transition cursor-pointer"
                              >
                                Tomar Caso
                              </button>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Participant Snapshot */}
                      {selectedIncident.participant && (
                        <div className="bg-[#FFFBF0] p-2.5 rounded-xl border border-[#FEB135]/40 border-l-4 border-l-[#FEB135] text-xs flex items-center justify-between">
                          <div>
                            <span className="font-bold text-[#001558] block">
                              {selectedIncident.participant.firstName} {selectedIncident.participant.lastName}
                            </span>
                            <span className="text-[11px] text-slate-600">
                              RUT: {selectedIncident.participant.rut}
                              {selectedIncident.participant.email
                                ? ` • Contacto: ${selectedIncident.participant.email}`
                                : ''}
                            </span>
                          </div>
                          {onSelectParticipant && selectedIncident.participant.id && (
                            <button
                              onClick={() => onSelectParticipant(selectedIncident.participant!.id)}
                              className="text-xs font-bold text-[#001558] hover:underline flex items-center gap-1 cursor-pointer shrink-0"
                            >
                              <span>Ver Ficha</span>
                              <ArrowRight className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Incident Timeline, Linked Emails & Comments */}
                    <div className="flex-1 p-4 overflow-y-auto space-y-4">
                      {/* Original Description */}
                      <div className="bg-white border border-slate-200 p-3.5 rounded-xl text-xs space-y-2 shadow-2xs">
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                          Descripción Inicial del Caso
                        </span>
                        <p className="text-slate-700 whitespace-pre-wrap leading-relaxed">
                          {selectedIncident.description}
                        </p>
                      </div>

                      {loadingIncidentDetail && (
                        <div className="flex items-center gap-2 text-xs text-slate-500 py-1">
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-[#001558]" />
                          <span>Cargando correos vinculados y bitácora...</span>
                        </div>
                      )}

                      {/* Linked Emails */}
                      {selectedIncident.messages && selectedIncident.messages.length > 0 && (
                        <div className="space-y-2">
                          <span className="text-xs font-bold text-[#001558] uppercase tracking-wider flex items-center gap-1.5">
                            <Mail className="w-3.5 h-3.5 text-[#FEB135]" />
                            Correos Vinculados al Caso ({selectedIncident.messages.length})
                          </span>
                          {selectedIncident.messages.map((msg) => (
                            <div
                              key={msg.id}
                              className="bg-white border border-slate-200 p-3 rounded-xl text-xs space-y-1.5 shadow-2xs"
                            >
                              <div className="flex items-center justify-between text-[11px] text-slate-500 pb-1 border-b border-slate-100">
                                <strong className="text-[#001558]">
                                  {msg.senderName || msg.senderEmail}
                                </strong>
                                <span>{new Date(msg.date).toLocaleString('es-CL')}</span>
                              </div>
                              <p className="font-bold text-slate-800">{msg.subject}</p>
                              <p className="text-slate-700 whitespace-pre-wrap leading-relaxed">
                                {msg.bodyText || msg.snippet}
                              </p>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Timeline Comments */}
                      <div className="space-y-2.5">
                        <span className="text-xs font-bold text-[#001558] uppercase tracking-wider block">
                          Bitácora, Notas y Mensajes ({selectedIncident.comments?.length || 0})
                        </span>

                        {!selectedIncident.comments || selectedIncident.comments.length === 0 ? (
                          <p className="text-xs text-slate-500 bg-white border border-slate-200 rounded-xl p-3">
                            Aún no hay comentarios registrados en este caso.
                          </p>
                        ) : (
                          selectedIncident.comments.map((c: IncidentCommentDTO) => {
                            const fromParticipant = !c.userId && !c.isInternal;
                            const isPublicReply = Boolean(c.userId) && !c.isInternal;
                            return (
                              <div
                                key={c.id}
                                className={`border p-3 rounded-xl text-xs space-y-1 shadow-2xs ${
                                  fromParticipant
                                    ? 'bg-[#FFFBF0] border-[#FEB135]/70'
                                    : isPublicReply
                                      ? 'bg-[#EEF2FF] border-[#001558]/20'
                                      : 'bg-white border-slate-200'
                                }`}
                              >
                                <div className="flex items-center justify-between gap-2 text-[11px] text-slate-500">
                                  <span className="flex items-center gap-1.5 min-w-0">
                                    <strong className="text-[#001558] truncate">{c.authorName}</strong>
                                    <span
                                      className={`px-1.5 py-0.5 rounded text-[9px] font-black uppercase border shrink-0 ${
                                        fromParticipant
                                          ? 'bg-[#FEB135] text-[#001558] border-[#FEB135]'
                                          : isPublicReply
                                            ? 'bg-[#001558] text-white border-[#001558]'
                                            : 'bg-slate-100 text-slate-600 border-slate-200'
                                      }`}
                                    >
                                      {fromParticipant
                                        ? 'Participante (Portal)'
                                        : isPublicReply
                                          ? 'Respuesta visible'
                                          : 'Nota interna'}
                                    </span>
                                  </span>
                                  <span className="shrink-0">{new Date(c.createdAt).toLocaleString('es-CL')}</span>
                                </div>
                                <p className="text-slate-700 whitespace-pre-wrap">{c.content}</p>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>

                    {/* New Comment Input */}
                    {canManageCrm && (
                      <form
                        onSubmit={handleAddComment}
                        className="p-3 bg-white border-t border-slate-200 space-y-2"
                      >
                        <div className="flex gap-2">
                          <input
                            type="text"
                            placeholder={
                              commentIsPublic
                                ? 'Respuesta que verá el participante en su portal...'
                                : 'Escribir nota interna del equipo...'
                            }
                            value={newComment}
                            onChange={(e) => setNewComment(e.target.value)}
                            className="flex-1 bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-800 placeholder-slate-400 focus:border-[#001558] focus:ring-2 focus:ring-[#FEB135]/50 focus:outline-none"
                          />
                          <button
                            type="submit"
                            disabled={submittingComment || !newComment.trim()}
                            className="bg-[#001558] hover:bg-[#0b2370] text-white font-bold text-xs px-4 py-2 rounded-xl transition flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                          >
                            <Send className="w-3.5 h-3.5 text-[#FEB135]" />
                            <span>{commentIsPublic ? 'Responder' : 'Agregar'}</span>
                          </button>
                        </div>
                        <label className="inline-flex items-center gap-2 text-[11px] text-slate-600 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={commentIsPublic}
                            onChange={(e) => setCommentIsPublic(e.target.checked)}
                            className="w-3.5 h-3.5 accent-[#001558]"
                          />
                          Visible para el participante en su Portal (si no, queda como nota interna)
                        </label>
                      </form>
                    )}
                  </div>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-500 space-y-2">
                    <Ticket className="w-10 h-10 text-slate-400 stroke-1" />
                    <p className="text-xs">
                      Selecciona una incidencia para ver los detalles, correos vinculados, notas internas y gestionar su resolución.
                    </p>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
  );

  return (
    <>
      {embedded ? (
        <div className="space-y-4">
          {/* Franja superior compacta con 4 mini KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="bg-white border border-slate-200 rounded-2xl px-4 py-3 shadow-xs flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  Correos cargados
                </p>
                <p className="text-xl font-black text-[#001558] mt-0.5">
                  {inboxMetrics.total.toLocaleString('es-CL')}
                </p>
              </div>
              <div className="w-9 h-9 rounded-xl bg-[#EEF2FF] border border-[#001558]/15 text-[#001558] flex items-center justify-center shrink-0">
                <Mail className="w-4 h-4" />
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl px-4 py-3 shadow-xs flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  Correos sin vincular
                </p>
                <p className="text-xl font-black text-[#001558] mt-0.5">
                  {inboxMetrics.unassociated.toLocaleString('es-CL')}
                </p>
              </div>
              <div className="w-9 h-9 rounded-xl bg-[#FFF8E1] border border-[#FEB135] text-[#001558] flex items-center justify-center shrink-0">
                <AlertTriangle className="w-4 h-4" />
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl px-4 py-3 shadow-xs flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  Casos abiertos / en proceso
                </p>
                <p className="text-xl font-black text-[#001558] mt-0.5">
                  {openCasesCount.toLocaleString('es-CL')}
                </p>
              </div>
              <div className="w-9 h-9 rounded-xl bg-[#EEF2FF] border border-[#001558]/15 text-[#001558] flex items-center justify-center shrink-0">
                <Ticket className="w-4 h-4" />
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl px-4 py-3 shadow-xs flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  Casos resueltos
                </p>
                <p className="text-xl font-black text-emerald-700 mt-0.5">
                  {incidentMetrics.RESUELTA.toLocaleString('es-CL')}
                </p>
              </div>
              <div className="w-9 h-9 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-4 h-4" />
              </div>
            </div>
          </div>

          {workspaceCard}
        </div>
      ) : (
        workspaceCard
      )}

      {/* Modal para Crear / Convertir en Incidencia */}
      {showNewTicketModal && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#001558]/40 backdrop-blur-xs"
        >
          <div className="bg-white border border-slate-200 w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden">
            <div className="bg-[#001558] px-6 py-4 border-b-4 border-b-[#FEB135] flex items-center justify-between">
              <h3 className="text-sm font-black text-white flex items-center gap-2">
                <Ticket className="w-4 h-4 text-[#FEB135]" />
                {ticketFromMessage ? 'Convertir Correo en Incidencia' : 'Nueva Incidencia CRM'}
              </h3>
              <button
                onClick={() => setShowNewTicketModal(false)}
                className="text-slate-200 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateTicket} className="p-6 space-y-3">
              {newTicketError && (
                <div className="p-2.5 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs font-medium flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                  <span>{newTicketError}</span>
                </div>
              )}

              {/* Selector obligatorio de participante cuando es incidencia independiente */}
              {!ticketFromMessage && (
                <div className="space-y-2">
                  <label className="block text-[11px] font-bold text-slate-700">
                    Participante Asociado *
                  </label>
                  {selectedNewTicketParticipant ? (
                    <div className="bg-[#FFFBF0] border border-[#FEB135]/40 border-l-4 border-l-[#FEB135] rounded-xl p-3 flex items-center justify-between text-xs">
                      <div>
                        <strong className="text-[#001558] block">
                          {selectedNewTicketParticipant.firstName} {selectedNewTicketParticipant.lastName}
                        </strong>
                        <span className="text-[11px] text-slate-600 font-mono">
                          RUT: {selectedNewTicketParticipant.rut}
                          {selectedNewTicketParticipant.email ? ` • ${selectedNewTicketParticipant.email}` : ''}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedNewTicketParticipant(null);
                          setNewTicketParticipantId('');
                          setNewTicketParticipantQuery('');
                          setNewTicketParticipantCandidates([]);
                        }}
                        className="px-2.5 py-1 rounded-lg bg-white border border-slate-300 text-[#001558] hover:bg-slate-50 font-bold text-[11px] cursor-pointer"
                      >
                        Cambiar
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      <div className="relative">
                        <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
                        <input
                          type="text"
                          placeholder="Buscar participante por nombre, apellido o RUT..."
                          value={newTicketParticipantQuery}
                          onChange={(e) => void searchNewTicketCandidates(e.target.value)}
                          className="w-full bg-white border border-slate-300 rounded-lg pl-9 pr-3 py-2 text-xs text-slate-800 placeholder-slate-400 focus:border-[#001558] focus:ring-2 focus:ring-[#FEB135]/50 focus:outline-none"
                        />
                      </div>
                      {(searchingTicketCandidates || newTicketParticipantQuery.trim().length >= 2) && (
                        <div className="max-h-40 overflow-y-auto divide-y divide-slate-200 border border-slate-200 rounded-xl bg-[#F5F6F8]">
                          {searchingTicketCandidates ? (
                            <div className="p-3 text-center text-xs text-slate-500">Buscando participantes...</div>
                          ) : newTicketParticipantCandidates.length === 0 ? (
                            <div className="p-3 text-center text-xs text-slate-500">
                              No se encontraron participantes
                            </div>
                          ) : (
                            newTicketParticipantCandidates.map((p) => (
                              <button
                                key={p.id}
                                type="button"
                                onClick={() => {
                                  setSelectedNewTicketParticipant(p);
                                  setNewTicketParticipantId(p.id);
                                  setNewTicketParticipantCandidates([]);
                                  setNewTicketError(null);
                                }}
                                className="w-full p-2.5 hover:bg-white cursor-pointer flex items-center justify-between text-left text-xs transition"
                              >
                                <div>
                                  <strong className="text-[#001558] block">
                                    {p.firstName} {p.lastName}
                                  </strong>
                                  <span className="text-[11px] text-slate-500">
                                    RUT: {p.rut} {p.email ? `• ${p.email}` : ''}
                                  </span>
                                </div>
                                <span className="px-2 py-0.5 rounded bg-[#001558] text-white font-bold text-[10px]">
                                  Seleccionar
                                </span>
                              </button>
                            ))
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Título del Caso *
                </label>
                <input
                  type="text"
                  required
                  value={newTicketTitle}
                  onChange={(e) => setNewTicketTitle(e.target.value)}
                  placeholder="Ej: Consulta sobre estado de cuota o ficha médica"
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-800 placeholder-slate-400 focus:border-[#001558] focus:ring-2 focus:ring-[#FEB135]/50 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Categoría</label>
                  <select
                    value={newTicketCategory}
                    onChange={(e) => setNewTicketCategory(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-800 focus:border-[#001558] focus:ring-2 focus:ring-[#FEB135]/50 focus:outline-none"
                  >
                    <option value="FINANZAS">Finanzas / Pagos</option>
                    <option value="FICHA_MEDICA">Ficha Médica</option>
                    <option value="PASAJES_LOGISTICA">Pasajes / Logística</option>
                    <option value="CEDULA_LEGAL">Cédula / Documentos</option>
                    <option value="CONSULTA_GENERAL">Consulta General</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Prioridad</label>
                  <select
                    value={newTicketPriority}
                    onChange={(e) => setNewTicketPriority(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-800 focus:border-[#001558] focus:ring-2 focus:ring-[#FEB135]/50 focus:outline-none"
                  >
                    <option value="BAJA">Baja</option>
                    <option value="MEDIA">Media</option>
                    <option value="ALTA">Alta</option>
                    <option value="URGENTE">Urgente</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Descripción / Notas
                </label>
                <textarea
                  rows={4}
                  value={newTicketDescription}
                  onChange={(e) => setNewTicketDescription(e.target.value)}
                  placeholder="Detalle del caso o solicitud..."
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-800 placeholder-slate-400 focus:border-[#001558] focus:ring-2 focus:ring-[#FEB135]/50 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowNewTicketModal(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-5 py-2 bg-[#001558] hover:bg-[#0b2370] text-white font-bold text-xs rounded-lg transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
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
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#001558]/40 backdrop-blur-xs"
        >
          <div className="bg-white border border-slate-200 w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden">
            <div className="bg-[#001558] px-6 py-4 border-b-4 border-b-[#FEB135] flex items-center justify-between">
              <h3 className="text-sm font-black text-white flex items-center gap-2">
                <Link2 className="w-4 h-4 text-[#FEB135]" />
                Asociar Correo a un Participante
              </h3>
              <button
                onClick={() => setShowAssociateModal(false)}
                className="text-slate-200 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-3">
              <p className="text-xs text-slate-600">
                Correo remitente:{' '}
                <strong className="text-[#001558]">{messageToAssociate?.senderEmail}</strong>
              </p>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Buscar Participante por RUT, Nombre o Apellido:
                </label>
                <input
                  type="text"
                  placeholder="Ej: 21.345.678-4 o Sepúlveda..."
                  value={participantSearch}
                  onChange={(e) => void searchCandidates(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-800 placeholder-slate-400 focus:border-[#001558] focus:ring-2 focus:ring-[#FEB135]/50 focus:outline-none"
                />
              </div>

              {/* Candidates List */}
              <div className="max-h-48 overflow-y-auto divide-y divide-slate-200 border border-slate-200 rounded-xl bg-[#F5F6F8]">
                {searchingCandidates ? (
                  <div className="p-4 text-center text-xs text-slate-500">Buscando...</div>
                ) : participantCandidates.length === 0 ? (
                  <div className="p-4 text-center text-xs text-slate-500">
                    {participantSearch.length >= 2
                      ? 'No se encontraron participantes'
                      : 'Ingresa al menos 2 caracteres'}
                  </div>
                ) : (
                  participantCandidates.map((p) => (
                    <div
                      key={p.id}
                      onClick={() => void handleAssociateParticipant(p.id)}
                      className="p-3 hover:bg-white cursor-pointer flex items-center justify-between text-xs transition"
                    >
                      <div>
                        <strong className="text-[#001558] block">
                          {p.firstName} {p.lastName}
                        </strong>
                        <span className="text-[11px] text-slate-500">
                          RUT: {p.rut} {p.email ? `• ${p.email}` : ''}
                        </span>
                      </div>
                      <button
                        type="button"
                        className="px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] cursor-pointer"
                      >
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
    </>
  );
}

export function InboxAndIncidentsModal({
  isOpen,
  onClose,
  activeEvent,
  currentUser,
  permissions,
  onSelectParticipant,
}: InboxAndIncidentsModalProps) {
  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Centro de Comunicaciones e Incidencias CRM"
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-[#001558]/40 backdrop-blur-xs"
    >
      <CrmWorkspace
        activeEvent={activeEvent}
        currentUser={currentUser}
        permissions={permissions}
        onSelectParticipant={onSelectParticipant}
        embedded={false}
        onClose={onClose}
      />
    </div>
  );
}
