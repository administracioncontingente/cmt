'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {
  ArrowRight,
  Calendar,
  CreditCard,
  FileText,
  Globe,
  Heart,
  Loader2,
  MapPin,
  Search,
  ShieldCheck,
  UserCheck,
} from 'lucide-react';
import { formatEventTypeLabel, safeHexColor } from '@/lib/eventDocuments';
import type { PublicEventListItemDTO } from '@/types/domain';

function formatDateRange(
  start?: string | Date | null,
  end?: string | Date | null
): string | null {
  if (!start && !end) return null;
  const fmt = (val: string | Date) => {
    const d = new Date(val);
    if (Number.isNaN(d.getTime())) return null;
    return d.toLocaleDateString('es-CL', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };
  const s = start ? fmt(start) : null;
  const e = end ? fmt(end) : null;
  if (s && e) return `${s} – ${e}`;
  return s || e;
}

export default function EventosDirectoryPage() {
  const [events, setEvents] = useState<PublicEventListItemDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('ALL');

  useEffect(() => {
    let cancelled = false;

    async function loadEvents() {
      await Promise.resolve();
      if (cancelled) return;
      try {
        const res = await fetch('/api/public/events?publishedOnly=1');
        if (!res.ok) {
          throw new Error('No se pudieron cargar los eventos disponibles');
        }
        const data = (await res.json()) as {
          events?: PublicEventListItemDTO[];
        };
        if (!cancelled) {
          setEvents(data.events || []);
        }
      } catch (err: unknown) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : 'Error cargando eventos institucionales'
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadEvents();
    return () => {
      cancelled = true;
    };
  }, []);

  const availableTypes = useMemo(() => {
    const set = new Set<string>();
    for (const ev of events) {
      if (ev.type) set.add(ev.type);
    }
    return Array.from(set);
  }, [events]);

  const filteredEvents = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return events.filter((ev) => {
      if (typeFilter !== 'ALL' && ev.type !== typeFilter) return false;
      if (!q) return true;
      return (
        ev.name.toLowerCase().includes(q) ||
        ev.code.toLowerCase().includes(q) ||
        (ev.shortName || '').toLowerCase().includes(q) ||
        (ev.country || '').toLowerCase().includes(q) ||
        (ev.city || '').toLowerCase().includes(q) ||
        (ev.publicHeadline || '').toLowerCase().includes(q) ||
        (ev.description || '').toLowerCase().includes(q)
      );
    });
  }, [events, searchTerm, typeFilter]);

  return (
    <div className="min-h-screen bg-[#F5F6F8] text-slate-800 flex flex-col font-sans">
      {/* Institutional Navbar */}
      <header className="bg-white border-b border-slate-200 border-t-4 border-t-[#001558] shadow-xs sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link
              href="/eventos"
              className="relative w-36 sm:w-44 h-10 block shrink-0"
              aria-label="Inicio Eventos AGSCH"
            >
              <Image
                src="/agsch-logo-color.svg"
                alt="Asociación de Guías y Scouts de Chile"
                fill
                priority
                className="object-contain object-left"
              />
            </Link>
            <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#EEF2FF] border border-[#001558]/15 text-[#001558] text-[11px] font-extrabold">
              <Globe className="w-3.5 h-3.5 text-[#FEB135]" />
              Eventos y Documentación Oficial
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/portal"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#001558] hover:bg-[#0b2370] text-white text-xs font-extrabold transition-colors shadow-xs"
            >
              <UserCheck className="w-3.5 h-3.5 text-[#FEB135]" />
              Portal Participante
            </Link>
            <Link
              href="/pagos"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#FFFBF0] hover:bg-[#FFF8E1] border border-[#FEB135] text-[#001558] text-xs font-extrabold transition-colors"
            >
              <CreditCard className="w-3.5 h-3.5 text-[#001558]" />
              <span className="hidden sm:inline">Informar Pago</span>
            </Link>
            <Link
              href="/ficha-medica"
              className="hidden md:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-50 hover:bg-red-100 border border-red-200 text-red-700 text-xs font-bold transition-colors"
            >
              <Heart className="w-3.5 h-3.5" />
              Ficha Médica
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs font-bold transition-colors"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-[#001558]" />
              Staff
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Banner */}
      <section className="bg-[#001558] text-white border-b-4 border-b-[#FEB135]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-12 space-y-6">
          <div className="max-w-3xl space-y-2.5">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FEB135] text-[#001558] text-[11px] font-black uppercase tracking-wider">
              Asociación de Guías y Scouts de Chile
            </span>
            <h1 className="text-2xl sm:text-4xl font-black tracking-tight text-white">
              Eventos, Contingentes y Documentación Oficial
            </h1>
            <p className="text-sm sm:text-base text-slate-200 leading-relaxed">
              Consulta información oficial, fechas, sedes, circulares,
              informativos, fichas de autorización y guías publicadas para
              cada encuentro nacional e internacional.
            </p>
          </div>

          {/* Search & Type Filter */}
          <div className="bg-white/10 backdrop-blur-xs border border-white/15 rounded-2xl p-3 sm:p-4 flex flex-col md:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-300 absolute left-3.5 top-3 pointer-events-none" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar evento por nombre, código, país o ciudad..."
                aria-label="Buscar eventos"
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white text-slate-800 placeholder-slate-400 text-xs sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#FEB135]"
              />
            </div>

            {availableTypes.length > 1 && (
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setTypeFilter('ALL')}
                  className={`px-3 py-2 rounded-xl text-xs font-extrabold transition-colors cursor-pointer ${
                    typeFilter === 'ALL'
                      ? 'bg-[#FEB135] text-[#001558]'
                      : 'bg-white/10 text-white hover:bg-white/20'
                  }`}
                >
                  Todos
                </button>
                {availableTypes.map((typeKey) => (
                  <button
                    type="button"
                    key={typeKey}
                    onClick={() => setTypeFilter(typeKey)}
                    className={`px-3 py-2 rounded-xl text-xs font-extrabold transition-colors cursor-pointer ${
                      typeFilter === typeKey
                        ? 'bg-[#FEB135] text-[#001558]'
                        : 'bg-white/10 text-white hover:bg-white/20'
                    }`}
                  >
                    {formatEventTypeLabel(typeKey)}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {loading ? (
          <div className="py-16 flex flex-col items-center justify-center gap-3 text-[#001558]">
            <Loader2 className="w-8 h-8 animate-spin" />
            <p className="text-sm font-bold">
              Cargando eventos e informativos oficiales...
            </p>
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-center text-red-700 text-sm font-bold">
            {error}
          </div>
        ) : filteredEvents.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-3xl p-10 text-center space-y-2 shadow-xs">
            <Globe className="w-10 h-10 text-[#001558]/40 mx-auto" />
            <h2 className="text-lg font-extrabold text-[#001558]">
              No hay eventos publicados que coincidan con tu búsqueda
            </h2>
            <p className="text-xs text-slate-500">
              Intenta limpiar los filtros o revisa nuevamente más adelante.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredEvents.map((ev) => {
              const primaryColor = safeHexColor(ev.themeColor, '#001558');
              const accentColor = safeHexColor(ev.accentColor, '#FEB135');
              const dateRange = formatDateRange(ev.startDate, ev.endDate);
              const location = [ev.city, ev.country].filter(Boolean).join(', ');
              const summaryText =
                ev.publicHeadline ||
                ev.publicSummary ||
                ev.description ||
                'Consulta información oficial, fechas y documentación publicada para este contingente.';

              return (
                <article
                  key={ev.id}
                  className="bg-white border border-slate-200 rounded-3xl shadow-xs hover:shadow-lg transition-all overflow-hidden flex flex-col"
                >
                  {/* Event Color Banner Header */}
                  <div
                    className="relative px-6 py-5 text-white border-b-4"
                    style={{
                      backgroundColor: primaryColor,
                      borderBottomColor: accentColor,
                      ...(ev.bannerUrl
                        ? {
                            backgroundImage: `linear-gradient(135deg, ${primaryColor}ee, ${primaryColor}cc), url(${ev.bannerUrl})`,
                            backgroundSize: 'cover',
                            backgroundPosition: 'center',
                          }
                        : {}),
                    }}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <span className="text-3xl leading-none">
                        {ev.flagEmoji || '🏕️'}
                      </span>
                      <div className="flex flex-wrap items-center justify-end gap-1.5">
                        <span className="px-2 py-0.5 rounded-md bg-white/15 text-white font-mono text-[10px] font-bold">
                          {ev.code}
                        </span>
                        <span
                          className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider"
                          style={{
                            backgroundColor: accentColor,
                            color: '#001558',
                          }}
                        >
                          {ev.currency}
                        </span>
                      </div>
                    </div>

                    <div className="mt-3 space-y-1">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-white/80">
                        {formatEventTypeLabel(ev.type)}
                      </p>
                      <h2 className="text-lg font-black text-white leading-snug">
                        {ev.name}
                      </h2>
                    </div>
                  </div>

                  {/* Body */}
                  <div className="p-6 flex-1 flex flex-col justify-between space-y-4">
                    <div className="space-y-3">
                      <div className="space-y-1.5 text-xs text-slate-600">
                        {dateRange && (
                          <div className="flex items-center gap-2">
                            <Calendar className="w-3.5 h-3.5 text-[#001558] shrink-0" />
                            <span className="font-semibold">{dateRange}</span>
                          </div>
                        )}
                        {location && (
                          <div className="flex items-center gap-2">
                            <MapPin className="w-3.5 h-3.5 text-[#001558] shrink-0" />
                            <span>{location}</span>
                          </div>
                        )}
                        <div className="flex items-center gap-2">
                          <FileText className="w-3.5 h-3.5 text-[#FEB135] shrink-0" />
                          <span className="font-bold text-[#001558]">
                            {ev.publishedDocumentsCount}{' '}
                            {ev.publishedDocumentsCount === 1
                              ? 'documento publicado'
                              : 'documentos publicados'}
                          </span>
                        </div>
                      </div>

                      <p className="text-xs text-slate-600 leading-relaxed line-clamp-3">
                        {summaryText}
                      </p>
                    </div>

                    <div className="pt-3 border-t border-slate-100 space-y-2">
                      <Link
                        href={`/eventos/${encodeURIComponent(ev.code)}`}
                        className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#001558] hover:bg-[#0b2370] text-white font-extrabold text-xs transition-colors shadow-xs"
                      >
                        Ver Información y Documentos
                        <ArrowRight className="w-3.5 h-3.5 text-[#FEB135]" />
                      </Link>
                      <div className="grid grid-cols-2 gap-2">
                        <Link
                          href={`/pagos/${encodeURIComponent(ev.code)}`}
                          className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-[#F5F6F8] hover:bg-[#EEF2FF] border border-slate-200 text-[#001558] text-[11px] font-bold transition-colors"
                        >
                          <CreditCard className="w-3.5 h-3.5" />
                          Informar Pago
                        </Link>
                        <Link
                          href="/portal"
                          className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-[#FFFBF0] hover:bg-[#FFF8E1] border border-[#FEB135]/60 text-[#001558] text-[11px] font-bold transition-colors"
                        >
                          <UserCheck className="w-3.5 h-3.5" />
                          Portal
                        </Link>
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </main>

      <footer className="border-t border-slate-200 bg-white py-5 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>
            Asociación de Guías y Scouts de Chile • Directorio Oficial de Eventos
          </span>
          <Link
            href="/login"
            className="text-[#001558] hover:underline font-bold"
          >
            Acceso Equipo Organizador
          </Link>
        </div>
      </footer>
    </div>
  );
}
