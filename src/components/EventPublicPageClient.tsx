'use client';

import React, { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Calendar,
  CreditCard,
  ExternalLink,
  FileText,
  Globe,
  Heart,
  Info,
  Link2,
  Loader2,
  Mail,
  MapPin,
  Phone,
  ShieldCheck,
  Sparkles,
  UserCheck,
  Wallet,
} from 'lucide-react';
import { EventDocumentsList } from '@/components/EventDocumentsList';
import { useToast } from '@/components/ui/ToastProvider';
import {
  formatEventTypeLabel,
  safeHexColor,
} from '@/lib/eventDocuments';
import { formatCurrency } from '@/lib/finance';
import type { PublicEventPageDTO } from '@/types/domain';

function formatDateLong(value?: string | Date | null): string | null {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toLocaleDateString('es-CL', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

function formatDateShort(value?: string | Date | null): string {
  if (!value) return '—';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '—';
  return parsed.toLocaleDateString('es-CL', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function EventPublicPageClient() {
  const params = useParams<{ eventCode?: string }>();
  const rawEventCode = params?.eventCode
    ? decodeURIComponent(params.eventCode).trim()
    : '';
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<PublicEventPageDTO | null>(null);

  useEffect(() => {
    if (!rawEventCode) return;
    let cancelled = false;
    const controller = new AbortController();

    async function loadEventPage() {
      await Promise.resolve();
      if (cancelled) return;
      setLoading(true);
      setNotFound(false);
      setError(null);

      try {
        const res = await fetch(
          `/api/public/events/${encodeURIComponent(rawEventCode)}`,
          { signal: controller.signal }
        );
        if (res.status === 404) {
          if (!cancelled) setNotFound(true);
          return;
        }
        if (!res.ok) {
          const errBody = (await res.json().catch(() => ({}))) as {
            error?: string;
          };
          throw new Error(
            errBody.error || 'No se pudo cargar la página del evento'
          );
        }
        const json = (await res.json()) as PublicEventPageDTO;
        if (!cancelled) {
          setData(json);
        }
      } catch (err: unknown) {
        if (
          !cancelled &&
          !(err instanceof DOMException && err.name === 'AbortError')
        ) {
          setError(
            err instanceof Error
              ? err.message
              : 'Error cargando información del evento'
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadEventPage();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [rawEventCode]);

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast.success('Enlace de la página del evento copiado al portapapeles');
    } catch {
      toast.error('No se pudo copiar el enlace');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F5F6F8] flex flex-col items-center justify-center p-6 gap-3 text-[#001558]">
        <Loader2 className="w-9 h-9 animate-spin" />
        <p className="text-sm font-bold">
          Cargando información oficial y documentación del evento...
        </p>
      </div>
    );
  }

  if (notFound || error || !data) {
    return (
      <div className="min-h-screen bg-[#F5F6F8] flex flex-col justify-center items-center p-6">
        <div className="max-w-lg w-full bg-white border border-slate-200 border-t-4 border-t-[#001558] rounded-3xl p-8 text-center space-y-4 shadow-lg">
          <div className="w-12 h-12 rounded-2xl bg-red-50 border border-red-200 flex items-center justify-center mx-auto text-red-600">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <h1 className="text-xl font-black text-[#001558]">
            {notFound ? 'Evento no encontrado' : 'No pudimos cargar el evento'}
          </h1>
          <p className="text-xs text-slate-600 leading-relaxed">
            {error ||
              `No existe un evento activo con el código "${rawEventCode}" o la URL ingresada es incorrecta.`}
          </p>
          <div className="pt-2 flex flex-wrap items-center justify-center gap-2.5">
            <Link
              href="/eventos"
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#001558] text-white text-xs font-extrabold hover:bg-[#0b2370] transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Ver todos los eventos
            </Link>
            <Link
              href="/portal"
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#FFFBF0] border border-[#FEB135] text-[#001558] text-xs font-extrabold hover:bg-[#FFF8E1]"
            >
              Ir al Portal Participante
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const ev = data.event;
  const primaryColor = safeHexColor(ev.themeColor, '#001558');
  const accentColor = safeHexColor(ev.accentColor, '#FEB135');

  if (!data.published) {
    return (
      <div className="min-h-screen bg-[#F5F6F8] flex flex-col justify-center items-center p-6">
        <div className="max-w-lg w-full bg-white border border-slate-200 border-t-4 border-t-[#FEB135] rounded-3xl p-8 text-center space-y-4 shadow-lg">
          <div className="text-4xl">{ev.flagEmoji || '🏕️'}</div>
          <span className="inline-block px-3 py-1 rounded-full bg-[#FFFBF0] border border-[#FEB135] text-[#001558] text-[11px] font-black uppercase">
            Página en preparación
          </span>
          <h1 className="text-xl font-black text-[#001558]">{ev.name}</h1>
          <p className="text-xs text-slate-600 leading-relaxed">
            La página informativa pública de este evento aún se encuentra en
            modo borrador para el equipo organizador. Si ya eres participante,
            puedes ingresar directamente a tu Portal.
          </p>
          <div className="pt-2 flex flex-wrap items-center justify-center gap-2.5">
            <Link
              href="/eventos"
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Directorio de Eventos
            </Link>
            <Link
              href="/portal"
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#001558] hover:bg-[#0b2370] text-white text-xs font-extrabold"
            >
              <UserCheck className="w-3.5 h-3.5 text-[#FEB135]" />
              Portal del Participante
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const startFormatted = formatDateLong(ev.startDate);
  const endFormatted = formatDateLong(ev.endDate);
  const location = [ev.city, ev.country].filter(Boolean).join(', ');
  const documents = data.documents || [];
  const highlights = data.highlights || [];
  const plans = data.plans || [];
  const encodedCode = encodeURIComponent(ev.code);

  return (
    <div className="min-h-screen bg-[#F5F6F8] text-slate-800 flex flex-col font-sans">
      {/* Staff preview banner if page is draft */}
      {data.isStaffPreview && (
        <div className="bg-[#FFF8E1] border-b border-[#FEB135] px-4 py-2.5 text-xs text-[#001558]">
          <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 font-bold">
              <ShieldCheck className="w-4 h-4 text-[#001558] shrink-0" />
              <span>
                Vista previa de Staff: esta página pública está en estado{' '}
                <strong>Borrador</strong> (no visible aún para el público).
              </span>
            </div>
            <Link
              href="/documentos"
              className="inline-flex items-center gap-1 font-black underline hover:no-underline"
            >
              Editar y publicar en /documentos
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      )}

      {/* Top Navigation */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-20 shadow-2xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Link
              href="/eventos"
              className="relative w-32 sm:w-40 h-9 block shrink-0"
              aria-label="Directorio de Eventos AGSCH"
            >
              <Image
                src="/agsch-logo-color.svg"
                alt="Guías y Scouts de Chile"
                fill
                priority
                className="object-contain object-left"
              />
            </Link>
            <div className="hidden md:flex items-center gap-1.5 text-xs text-slate-500">
              <span>/</span>
              <Link
                href="/eventos"
                className="font-bold hover:text-[#001558] transition-colors"
              >
                Eventos
              </Link>
              <span>/</span>
              <span className="font-mono font-extrabold text-[#001558]">
                {ev.code}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleCopyLink}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#F5F6F8] hover:bg-slate-200 border border-slate-200 text-[#001558] text-xs font-bold transition-colors cursor-pointer"
            >
              <Link2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Copiar enlace</span>
            </button>
            <Link
              href={`/pagos/${encodedCode}`}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#FFFBF0] hover:bg-[#FFF8E1] border border-[#FEB135] text-[#001558] text-xs font-extrabold transition-colors"
            >
              <CreditCard className="w-3.5 h-3.5" />
              Informar Pago
            </Link>
            <Link
              href="/portal"
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#001558] hover:bg-[#0b2370] text-white text-xs font-extrabold transition-colors shadow-xs"
            >
              <UserCheck className="w-3.5 h-3.5 text-[#FEB135]" />
              Portal Participante
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section
        className="text-white border-b-4"
        style={{
          backgroundColor: primaryColor,
          borderBottomColor: accentColor,
          ...(ev.bannerUrl
            ? {
                backgroundImage: `linear-gradient(135deg, ${primaryColor}eb, ${primaryColor}c9), url(${ev.bannerUrl})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
              }
            : {}),
        }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-9 sm:py-12 space-y-6">
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/eventos"
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/15 hover:bg-white/25 text-white text-[11px] font-bold transition-colors"
            >
              <ArrowLeft className="w-3 h-3" />
              Todos los Eventos
            </Link>
            <span
              className="px-2.5 py-1 rounded-full text-[11px] font-black uppercase tracking-wider"
              style={{
                backgroundColor: accentColor,
                color: '#001558',
              }}
            >
              {formatEventTypeLabel(ev.type)}
            </span>
            <span className="px-2.5 py-1 rounded-md bg-white/15 text-white font-mono text-[11px] font-bold">
              {ev.code}
            </span>
          </div>

          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
            <div className="space-y-3 max-w-3xl">
              <div className="flex items-start gap-3 sm:gap-4">
                <span className="text-4xl sm:text-5xl leading-none shrink-0 mt-1">
                  {ev.flagEmoji || '🏕️'}
                </span>
                <div className="space-y-1.5">
                  <h1 className="text-2xl sm:text-4xl font-black text-white tracking-tight leading-tight">
                    {ev.name}
                  </h1>
                  {ev.publicHeadline && (
                    <p className="text-sm sm:text-lg font-semibold text-white/90 leading-snug">
                      {ev.publicHeadline}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-x-5 gap-y-2 pt-1 text-xs sm:text-sm text-white/90">
                {(startFormatted || endFormatted) && (
                  <span className="inline-flex items-center gap-1.5 font-semibold">
                    <Calendar className="w-4 h-4 text-[#FEB135]" />
                    {startFormatted && endFormatted
                      ? `${startFormatted} al ${endFormatted}`
                      : startFormatted || endFormatted}
                  </span>
                )}
                {location && (
                  <span className="inline-flex items-center gap-1.5 font-semibold">
                    <MapPin className="w-4 h-4 text-[#FEB135]" />
                    {location}
                  </span>
                )}
                <span className="inline-flex items-center gap-1.5 font-semibold">
                  <FileText className="w-4 h-4 text-[#FEB135]" />
                  {documents.length}{' '}
                  {documents.length === 1
                    ? 'documento oficial'
                    : 'documentos oficiales'}
                </span>
              </div>
            </div>

            {/* Hero CTAs */}
            <div className="flex flex-wrap items-center gap-2.5 shrink-0">
              <a
                href="#documentos"
                className="inline-flex items-center gap-2 px-5 py-3 rounded-xl font-black text-xs uppercase tracking-wider shadow-md transition-transform hover:-translate-y-0.5"
                style={{
                  backgroundColor: accentColor,
                  color: '#001558',
                }}
              >
                <FileText className="w-4 h-4" />
                Ver Documentos ({documents.length})
              </a>
              <Link
                href="/portal"
                className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-white/15 hover:bg-white/25 border border-white/25 text-white font-extrabold text-xs uppercase tracking-wider transition-colors"
              >
                <UserCheck className="w-4 h-4" />
                Mi Portal
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Content Grid */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Primary Column */}
          <div className="lg:col-span-8 space-y-6">
            {/* About Event */}
            {(ev.publicSummary || ev.description) && (
              <section className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs space-y-3">
                <h2 className="text-lg font-black text-[#001558] flex items-center gap-2">
                  <Info className="w-5 h-5 text-[#FEB135]" />
                  Acerca del Evento y Contingente
                </h2>
                <div className="text-sm text-slate-700 leading-relaxed whitespace-pre-line">
                  {ev.publicSummary || ev.description}
                </div>
              </section>
            )}

            {/* Highlights / Notices */}
            {highlights.length > 0 && (
              <section className="space-y-3">
                <h2 className="text-lg font-black text-[#001558] flex items-center gap-2 px-1">
                  <Sparkles className="w-5 h-5 text-[#FEB135]" />
                  Avisos e Hitos Destacados
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {highlights.map((hl) => (
                    <article
                      key={hl.id}
                      className="bg-white border border-slate-200 border-l-4 border-l-[#FEB135] rounded-2xl p-5 shadow-xs space-y-2"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        {hl.badge && (
                          <span className="px-2.5 py-0.5 rounded-full bg-[#FFF8E1] border border-[#FEB135] text-[#001558] text-[10px] font-black uppercase">
                            {hl.badge}
                          </span>
                        )}
                        {hl.dateLabel && (
                          <span className="text-[11px] font-bold text-slate-500 inline-flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {hl.dateLabel}
                          </span>
                        )}
                      </div>
                      <h3 className="text-sm font-black text-[#001558]">
                        {hl.title}
                      </h3>
                      <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-line">
                        {hl.content}
                      </p>
                    </article>
                  ))}
                </div>
              </section>
            )}

            {/* Official Documents */}
            <section id="documentos" className="space-y-4 scroll-mt-24">
              <div className="flex flex-wrap items-end justify-between gap-2 px-1">
                <div>
                  <h2 className="text-lg sm:text-xl font-black text-[#001558] flex items-center gap-2">
                    <FileText className="w-5 h-5 text-[#FEB135]" />
                    Documentación Oficial del Evento
                  </h2>
                  <p className="text-xs text-slate-600 mt-0.5">
                    Circulares, informativos, fichas, reglamentos y material de
                    apoyo para participantes y apoderados.
                  </p>
                </div>
              </div>

              <EventDocumentsList
                documents={documents}
                eventCode={ev.code}
                emptyMessage="El equipo coordinador de este evento aún no ha publicado circulares o documentos oficiales."
              />
            </section>
          </div>

          {/* Sidebar */}
          <aside className="lg:col-span-4 space-y-5">
            {/* Quick Fact Sheet */}
            <section className="bg-white border border-slate-200 border-t-4 border-t-[#001558] rounded-3xl p-5 shadow-xs space-y-4">
              <h3 className="text-sm font-black text-[#001558] uppercase tracking-wider flex items-center gap-2">
                <Globe className="w-4 h-4 text-[#FEB135]" />
                Ficha Rápida y Sede
              </h3>

              <dl className="space-y-3 text-xs">
                <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-2.5">
                  <dt className="text-slate-500 font-semibold">Código</dt>
                  <dd className="font-mono font-extrabold text-[#001558]">
                    {ev.code}
                  </dd>
                </div>
                {(startFormatted || endFormatted) && (
                  <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-2.5">
                    <dt className="text-slate-500 font-semibold">Fechas</dt>
                    <dd className="font-bold text-slate-800 text-right">
                      {startFormatted || 'Por definir'}
                      {endFormatted ? ` al ${endFormatted}` : ''}
                    </dd>
                  </div>
                )}
                {location && (
                  <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-2.5">
                    <dt className="text-slate-500 font-semibold">Ubicación</dt>
                    <dd className="font-bold text-slate-800 text-right">
                      {location}
                    </dd>
                  </div>
                )}
                {ev.currency && (
                  <div className="flex items-start justify-between gap-3">
                    <dt className="text-slate-500 font-semibold">
                      Moneda Oficial
                    </dt>
                    <dd className="px-2 py-0.5 rounded bg-[#EEF2FF] text-[#001558] font-extrabold">
                      {ev.currency}
                    </dd>
                  </div>
                )}
              </dl>

              {ev.venueDetails && (
                <div className="bg-[#F5F6F8] border border-slate-200 rounded-2xl p-3.5 text-xs text-slate-700 leading-relaxed whitespace-pre-line">
                  <span className="block font-extrabold text-[#001558] mb-1">
                    Detalles del lugar y logística
                  </span>
                  {ev.venueDetails}
                </div>
              )}
            </section>

            {/* Registration & Fee Plans */}
            {(ev.registrationInfo || plans.length > 0) && (
              <section className="bg-white border border-slate-200 rounded-3xl p-5 shadow-xs space-y-4">
                <h3 className="text-sm font-black text-[#001558] uppercase tracking-wider flex items-center gap-2">
                  <Wallet className="w-4 h-4 text-[#FEB135]" />
                  Inscripción y Cuotas
                </h3>

                {ev.registrationInfo && (
                  <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-line">
                    {ev.registrationInfo}
                  </p>
                )}

                {plans.length > 0 && (
                  <div className="space-y-2.5">
                    {plans.map((plan) => (
                      <div
                        key={plan.id}
                        className="bg-[#F5F6F8] border border-slate-200 rounded-2xl p-3.5 space-y-1.5"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <span className="text-[10px] font-black uppercase tracking-wider text-[#001558]/70 block">
                              {plan.roleKey}
                            </span>
                            <h4 className="text-xs font-extrabold text-[#001558]">
                              {plan.name}
                            </h4>
                          </div>
                          <span className="text-sm font-black text-[#001558] whitespace-nowrap">
                            {formatCurrency(
                              plan.totalAmount,
                              plan.currency || ev.currency || 'USD'
                            )}
                          </span>
                        </div>

                        {plan.description && (
                          <p className="text-[11px] text-slate-600">
                            {plan.description}
                          </p>
                        )}

                        {plan.installments && plan.installments.length > 0 && (
                          <details className="pt-1">
                            <summary className="text-[11px] font-bold text-[#001558] cursor-pointer hover:underline">
                              Ver calendario ({plan.installments.length}{' '}
                              {plan.installments.length === 1
                                ? 'cuota'
                                : 'cuotas'}
                              )
                            </summary>
                            <ul className="mt-2 space-y-1 border-t border-slate-200 pt-2">
                              {plan.installments.map((inst) => (
                                <li
                                  key={inst.id}
                                  className="flex items-center justify-between text-[11px] text-slate-600 gap-2"
                                >
                                  <span className="truncate">
                                    {inst.title} ({formatDateShort(inst.dueDate)})
                                  </span>
                                  <span className="font-mono font-bold text-[#001558] shrink-0">
                                    {formatCurrency(
                                      inst.amount,
                                      plan.currency || ev.currency || 'USD'
                                    )}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          </details>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </section>
            )}

            {/* Official Contact */}
            {(ev.contactEmail || ev.contactPhone || ev.officialWebsiteUrl) && (
              <section className="bg-white border border-slate-200 rounded-3xl p-5 shadow-xs space-y-3">
                <h3 className="text-sm font-black text-[#001558] uppercase tracking-wider flex items-center gap-2">
                  <Mail className="w-4 h-4 text-[#FEB135]" />
                  Contacto Oficial del Contingente
                </h3>
                <div className="space-y-2 text-xs">
                  {ev.contactEmail && (
                    <a
                      href={`mailto:${ev.contactEmail}`}
                      className="flex items-center gap-2 text-[#001558] font-bold hover:underline break-all"
                    >
                      <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      {ev.contactEmail}
                    </a>
                  )}
                  {ev.contactPhone && (
                    <a
                      href={`tel:${ev.contactPhone.replace(/[^+\d]/g, '')}`}
                      className="flex items-center gap-2 text-slate-700 font-semibold hover:text-[#001558]"
                    >
                      <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      {ev.contactPhone}
                    </a>
                  )}
                  {ev.officialWebsiteUrl && (
                    <a
                      href={ev.officialWebsiteUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-2 mt-1 rounded-xl bg-[#EEF2FF] hover:bg-[#dce4ff] text-[#001558] font-extrabold transition-colors"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      Sitio web oficial del evento
                    </a>
                  )}
                </div>
              </section>
            )}

            {/* Participant Actions */}
            <section className="bg-[#001558] text-white rounded-3xl p-5 border-t-4 border-t-[#FEB135] shadow-sm space-y-3">
              <h3 className="text-sm font-black text-white">
                ¿Ya eres parte del contingente?
              </h3>
              <p className="text-xs text-slate-200 leading-relaxed">
                Gestiona tus cuotas, actualiza tus datos personales, ficha
                médica, comprobantes y tallas del kit oficial.
              </p>
              <div className="space-y-2 pt-1">
                <Link
                  href="/portal"
                  className="w-full inline-flex items-center justify-between px-4 py-2.5 rounded-xl bg-[#FEB135] hover:bg-[#e59c22] text-[#001558] text-xs font-black transition-colors"
                >
                  <span>Ingresar al Portal del Participante</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
                <Link
                  href={`/pagos/${encodedCode}`}
                  className="w-full inline-flex items-center justify-between px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition-colors"
                >
                  <span className="inline-flex items-center gap-1.5">
                    <CreditCard className="w-3.5 h-3.5 text-[#FEB135]" />
                    Informar Comprobante de Pago
                  </span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
                <Link
                  href="/ficha-medica"
                  className="w-full inline-flex items-center justify-between px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition-colors"
                >
                  <span className="inline-flex items-center gap-1.5">
                    <Heart className="w-3.5 h-3.5 text-red-300" />
                    Ficha Médica por RUT
                  </span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </section>
          </aside>
        </div>
      </main>

      <footer className="border-t border-slate-200 bg-white py-5 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>
            Asociación de Guías y Scouts de Chile • {ev.name}
          </span>
          <div className="flex items-center gap-4">
            <Link href="/eventos" className="hover:text-[#001558] font-semibold">
              Otros Eventos
            </Link>
            <Link href="/login" className="text-[#001558] hover:underline font-bold">
              Acceso Staff
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
