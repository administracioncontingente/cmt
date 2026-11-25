'use client';

import React, { useState, useEffect } from 'react';
import { ChevronDown, Calendar, Users, Settings, Plus, Check, Loader2 } from 'lucide-react';
import { EventManagerModal } from './EventManagerModal';

export interface EventItem {
  id: string;
  code: string;
  name: string;
  shortName?: string | null;
  country?: string | null;
  city?: string | null;
  flagEmoji?: string | null;
  currency: string;
  userRole: string;
  userTitle?: string | null;
  isActiveSelection: boolean;
  _count?: {
    participants: number;
    memberships: number;
  };
}

interface EventSelectorProps {
  currentUser: {
    id: string;
    email: string;
    name: string;
    role: string;
  } | null;
  onEventChange?: (event: EventItem) => void;
}

export function EventSelector({ currentUser, onEventChange }: EventSelectorProps) {
  const [events, setEvents] = useState<EventItem[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<EventItem | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [switching, setSwitching] = useState(false);

  const fetchEvents = async () => {
    try {
      const res = await fetch('/api/events');
      if (res.ok) {
        const data = await res.json();
        const evList: EventItem[] = data.events || [];
        setEvents(evList);

        // Encontrar evento activo
        const currentActive = evList.find((e) => e.id === data.activeEventId) || evList[0];
        if (currentActive) {
          setSelectedEvent(currentActive);
        }
      }
    } catch (err) {
      console.error('Error fetching events:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, []);

  const handleSelectEvent = async (event: EventItem) => {
    if (event.id === selectedEvent?.id) {
      setIsOpen(false);
      return;
    }

    setSwitching(true);
    try {
      const res = await fetch(`/api/events/${event.id}`, { method: 'POST' });
      if (res.ok) {
        setSelectedEvent(event);
        setIsOpen(false);
        if (onEventChange) onEventChange(event);
        // Recargar suavemente para sincronizar datos
        window.location.reload();
      }
    } catch (err) {
      console.error('Error switching event:', err);
    } finally {
      setSwitching(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#001040] border border-[#0d349e] text-xs text-slate-300">
        <Loader2 className="w-3.5 h-3.5 animate-spin text-[#FEB135]" />
        <span>Cargando eventos...</span>
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl bg-[#000c33]/80 hover:bg-[#000c33] border border-[#0d349e] text-left transition shadow-sm group"
      >
        <span className="text-xl sm:text-2xl leading-none">
          {selectedEvent?.flagEmoji || '🏕️'}
        </span>

        <div className="hidden sm:block text-left">
          <div className="flex items-center gap-1.5">
            <span className="font-extrabold text-xs text-white group-hover:text-[#FEB135] transition leading-tight">
              {selectedEvent?.shortName || selectedEvent?.name || 'Seleccionar Evento'}
            </span>
            <span className="text-[10px] px-1.5 py-0.2 rounded bg-[#0d349e] text-slate-200 font-bold">
              {selectedEvent?.currency || 'USD'}
            </span>
          </div>

          <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
            <span className="truncate max-w-[140px] text-emerald-400 font-semibold">
              Rol: {selectedEvent?.userRole || 'MIEMBRO'}
            </span>
          </div>
        </div>

        <ChevronDown className="w-3.5 h-3.5 text-slate-400 group-hover:text-white transition" />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />

          <div className="absolute left-0 sm:left-auto sm:right-0 mt-2 w-80 sm:w-96 bg-[#000c33] border border-[#0d349e] rounded-2xl shadow-2xl z-50 overflow-hidden divide-y divide-[#0d349e]">
            {/* Header */}
            <div className="px-4 py-3 bg-[#001558] flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block">
                  Eventos Nacionales e Internacionales
                </span>
                <span className="text-[10px] text-slate-400">
                  Selecciona el evento para gestionar su contingente
                </span>
              </div>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#FEB135] text-[#001558]">
                {events.length} Activos
              </span>
            </div>

            {/* Event List */}
            <div className="max-h-72 overflow-y-auto divide-y divide-[#0d349e]/40 p-1">
              {events.map((ev) => {
                const isCurrent = ev.id === selectedEvent?.id;
                return (
                  <button
                    key={ev.id}
                    onClick={() => handleSelectEvent(ev)}
                    disabled={switching}
                    className={`w-full p-3 rounded-xl flex items-start gap-3 text-left transition ${
                      isCurrent
                        ? 'bg-[#001558] border border-[#FEB135]/40 text-white'
                        : 'hover:bg-white/5 text-slate-300'
                    }`}
                  >
                    <span className="text-2xl mt-0.5">{ev.flagEmoji || '🏕️'}</span>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <span className="font-bold text-xs text-white truncate">
                          {ev.name}
                        </span>
                        {isCurrent && (
                          <Check className="w-4 h-4 text-[#FEB135] shrink-0" />
                        )}
                      </div>

                      <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-400">
                        <span>{ev.code}</span>
                        <span>•</span>
                        <span>{ev._count?.participants || 0} participantes</span>
                        <span>•</span>
                        <span className="font-semibold text-slate-300">{ev.currency}</span>
                      </div>

                      <div className="mt-1.5 flex items-center gap-2">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                            ev.userRole === 'SUPER_ADMIN'
                              ? 'bg-purple-500/20 text-purple-300 border-purple-500/30'
                              : ev.userRole === 'EVENT_ADMIN'
                              ? 'bg-[#FEB135]/20 text-[#FEB135] border-[#FEB135]/40'
                              : ev.userRole === 'TREASURER'
                              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                              : 'bg-blue-500/20 text-blue-300 border-blue-500/30'
                          }`}
                        >
                          Tu permiso: {ev.userRole}
                        </span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Footer Action: Settings / Manage Team */}
            <div className="p-2 bg-[#001040]">
              <button
                onClick={() => {
                  setIsOpen(false);
                  setIsModalOpen(true);
                }}
                className="w-full py-2 px-3 rounded-xl bg-[#001558] hover:bg-[#001d75] border border-[#0d349e] text-[#FEB135] hover:text-white text-xs font-bold transition flex items-center justify-center gap-2"
              >
                <Settings className="w-4 h-4 text-[#FEB135]" />
                Administrar Evento y Equipo de Permisos
              </button>
            </div>
          </div>
        </>
      )}

      {/* Modal de Gestión de Equipos y Eventos */}
      <EventManagerModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        activeEvent={selectedEvent}
        currentUser={currentUser}
        onEventCreated={() => {
          fetchEvents();
        }}
      />
    </div>
  );
}
