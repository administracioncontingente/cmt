'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronDown, Settings, Check, Loader2, ExternalLink } from 'lucide-react';
import { EventManagerModal } from './EventManagerModal';
import type { EventSummary, UserSessionDTO } from '@/types/domain';

export type EventItem = EventSummary;

interface EventSelectorProps {
  currentUser: UserSessionDTO | null;
  onEventChange?: (event: EventSummary) => void;
}

export function EventSelector({ currentUser, onEventChange }: EventSelectorProps) {
  const router = useRouter();
  const [events, setEvents] = useState<EventSummary[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<EventSummary | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [switching, setSwitching] = useState(false);

  const fetchEvents = useCallback(async () => {
    try {
      const res = await fetch('/api/events');
      if (res.ok) {
        const data = await res.json();
        const evList: EventSummary[] = data.events || [];
        setEvents(evList);

        const currentActive =
          evList.find((e) => e.id === data.activeEventId) || evList[0] || null;
        if (currentActive) {
          setSelectedEvent(currentActive);
        }
      }
    } catch (err) {
      console.error('Error fetching events:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadInitialEvents() {
      try {
        const res = await fetch('/api/events');
        if (!cancelled && res.ok) {
          const data = await res.json();
          const evList: EventSummary[] = data.events || [];
          setEvents(evList);

          const currentActive =
            evList.find((e) => e.id === data.activeEventId) || evList[0] || null;
          if (currentActive) {
            setSelectedEvent(currentActive);
          }
        }
      } catch (err) {
        console.error('Error fetching events:', err);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadInitialEvents();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSelectEvent = async (event: EventSummary) => {
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
        if (onEventChange) {
          onEventChange(event);
        } else {
          router.refresh();
        }
      }
    } catch (err) {
      console.error('Error switching event:', err);
    } finally {
      setSwitching(false);
    }
  };

  const getRoleBadgeStyle = (role?: string) => {
    if (role === 'SUPER_ADMIN') {
      return 'bg-purple-50 text-purple-800 border-purple-200';
    }
    if (role === 'EVENT_ADMIN') {
      return 'bg-[#FFF8E1] text-[#001558] border-[#FEB135]';
    }
    if (role === 'TREASURER') {
      return 'bg-emerald-50 text-emerald-800 border-emerald-200';
    }
    return 'bg-[#EEF2FF] text-[#001558] border-[#001558]/20';
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#F5F6F8] border border-slate-200 text-xs text-slate-600">
        <Loader2 className="w-3.5 h-3.5 animate-spin text-[#001558]" />
        <span>Cargando eventos...</span>
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl bg-[#F5F6F8] hover:bg-slate-100 border border-slate-200 text-[#001558] text-left transition shadow-xs group cursor-pointer"
      >
        <span className="text-xl sm:text-2xl leading-none">
          {selectedEvent?.flagEmoji || '🏕️'}
        </span>

        <div className="hidden sm:block text-left">
          <div className="flex items-center gap-1.5">
            <span className="font-extrabold text-xs text-[#001558] transition leading-tight">
              {selectedEvent?.shortName ||
                selectedEvent?.name ||
                'Seleccionar Evento'}
            </span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#EEF2FF] text-[#001558] border border-[#001558]/20 font-bold">
              {selectedEvent?.currency || 'USD'}
            </span>
          </div>

          <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
            <span className="truncate max-w-[150px] text-emerald-700 font-semibold">
              Rol: {selectedEvent?.userRole || 'MIEMBRO'}
            </span>
          </div>
        </div>

        <ChevronDown className="w-3.5 h-3.5 text-slate-500 group-hover:text-[#001558] transition" />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />

          <div className="absolute left-0 sm:left-auto sm:right-0 mt-2 w-80 sm:w-96 bg-white border border-slate-200 rounded-2xl shadow-xl z-50 overflow-hidden divide-y divide-slate-200">
            {/* Header */}
            <div className="px-4 py-3 bg-[#001558] text-white flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold text-white uppercase tracking-wider block">
                  Eventos Nacionales e Internacionales
                </span>
                <span className="text-[10px] text-slate-200">
                  Selecciona el evento para gestionar su contingente
                </span>
              </div>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#FEB135] text-[#001558] shrink-0">
                {events.length} Activos
              </span>
            </div>

            {/* Event List */}
            <div className="max-h-72 overflow-y-auto divide-y divide-slate-100 p-1.5 bg-white">
              {events.map((ev) => {
                const isCurrent = ev.id === selectedEvent?.id;
                return (
                  <button
                    type="button"
                    key={ev.id}
                    onClick={() => handleSelectEvent(ev)}
                    disabled={switching}
                    className={`w-full p-3 rounded-xl flex items-start gap-3 text-left transition cursor-pointer ${
                      isCurrent
                        ? 'bg-[#FFFBF0] border border-[#FEB135] text-[#001558]'
                        : 'hover:bg-[#F5F6F8] text-slate-700 border border-transparent'
                    }`}
                  >
                    <span className="text-2xl mt-0.5">
                      {ev.flagEmoji || '🏕️'}
                    </span>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <span className="font-bold text-xs text-[#001558] truncate">
                          {ev.name}
                        </span>
                        {isCurrent && (
                          <Check className="w-4 h-4 text-[#001558] shrink-0" />
                        )}
                      </div>

                      <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-500">
                        <span className="font-mono">{ev.code}</span>
                        <span>•</span>
                        <span>{ev._count?.participants || 0} participantes</span>
                        <span>•</span>
                        <span className="font-bold text-slate-700">
                          {ev.currency}
                        </span>
                      </div>

                      <div className="mt-1.5 flex items-center gap-2">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${getRoleBadgeStyle(
                            ev.userRole
                          )}`}
                        >
                          Tu permiso: {ev.userRole || 'MIEMBRO'}
                        </span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Footer Action: Public Page & Settings / Manage Team */}
            <div className="p-2 bg-[#F5F6F8] space-y-1.5">
              {selectedEvent?.code && (
                <Link
                  href={`/eventos/${encodeURIComponent(selectedEvent.code)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setIsOpen(false)}
                  className="w-full py-2 px-3 rounded-xl bg-[#EEF2FF] hover:bg-[#dce4ff] border border-[#001558]/20 text-[#001558] text-xs font-extrabold transition flex items-center justify-center gap-2"
                >
                  <ExternalLink className="w-3.5 h-3.5 text-[#001558]" />
                  Ver página pública del evento
                </Link>
              )}
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  setIsModalOpen(true);
                }}
                className="w-full py-2 px-3 rounded-xl bg-white hover:bg-[#EEF2FF] border border-slate-200 text-[#001558] text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer"
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
