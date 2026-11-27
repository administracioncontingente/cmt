'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Droplet,
  FilterX,
  HeartPulse,
  Loader2,
  Phone,
  QrCode,
  RefreshCw,
  Search,
  Share2,
  ShieldAlert,
  Snowflake,
  Stethoscope,
  Syringe,
} from 'lucide-react';
import { AppShell, useAppShell } from '@/components/AppShell';
import { ParticipantDetailModal } from '@/components/ParticipantDetailModal';
import { useToast } from '@/components/ui/ToastProvider';
import type {
  ParticipantDTO,
  ParticipantsListResponseDTO,
} from '@/types/domain';

type MedicalFilter =
  | 'ALL'
  | 'COMPLETED'
  | 'PENDING'
  | 'SEVERE_ALLERGY'
  | 'EPIPEN'
  | 'COLD_CHAIN';

const ROLE_OPTIONS = [
  { value: 'ALL', label: 'Todos los roles' },
  { value: 'JOVEN', label: 'Jóvenes / Participantes' },
  { value: 'DIRIGENTE', label: 'Dirigentes / Educadores' },
  { value: 'IST', label: 'IST' },
  { value: 'CMT', label: 'CMT' },
] as const;

const MEDICAL_FILTER_OPTIONS: { value: MedicalFilter; label: string }[] = [
  { value: 'ALL', label: 'Todos los estados clínicos' },
  { value: 'COMPLETED', label: 'Fichas Completadas' },
  { value: 'PENDING', label: 'Fichas Pendientes' },
  { value: 'SEVERE_ALLERGY', label: 'Alergias Severas' },
  { value: 'EPIPEN', label: 'Porta EpiPen' },
  { value: 'COLD_CHAIN', label: 'Cadena de Frío' },
];

function isMedicalCompleted(status?: string | null): boolean {
  return status === 'COMPLETED' || status === 'VERIFIED';
}

function SaludWorkspace() {
  const {
    activeEvent,
    permissions,
    statsData,
    currency,
    eventVersion,
    refreshStats,
  } = useAppShell();
  const { toast } = useToast();

  const [participants, setParticipants] = useState<ParticipantDTO[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadTick, setReloadTick] = useState(0);

  // Filters
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [medicalFilter, setMedicalFilter] = useState<MedicalFilter>('ALL');

  // Detail modal
  const [selectedParticipantId, setSelectedParticipantId] = useState<
    string | null
  >(null);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchQuery(searchInput.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Fetch participants with medical filter and pagination
  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;

    const run = async () => {
      await Promise.resolve();
      if (cancelled) return;
      setLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams({
          page: String(page),
          limit: '50',
        });
        if (searchQuery) params.set('search', searchQuery);
        if (roleFilter !== 'ALL') params.set('role', roleFilter);
        if (medicalFilter !== 'ALL') params.set('medical', medicalFilter);

        const res = await fetch(`/api/participants?${params.toString()}`, {
          signal: controller.signal,
        });
        if (!res.ok) {
          const errBody = (await res.json().catch(() => ({}))) as {
            error?: string;
          };
          throw new Error(
            errBody.error || 'No se pudo cargar la nómina clínica'
          );
        }

        const data = (await res.json()) as ParticipantsListResponseDTO;
        if (cancelled) return;

        setParticipants(data.participants || []);
        setTotalPages(Math.max(1, data.totalPages || 1));
        setTotalCount(data.totalCount || 0);
      } catch (err: unknown) {
        if (
          !cancelled &&
          !(err instanceof DOMException && err.name === 'AbortError')
        ) {
          setError(
            err instanceof Error
              ? err.message
              : 'Error inesperado al cargar fichas médicas'
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void run();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [page, searchQuery, roleFilter, medicalFilter, eventVersion, reloadTick]);

  const toggleMedicalKpi = useCallback((target: MedicalFilter) => {
    setMedicalFilter((current) => (current === target ? 'ALL' : target));
    setPage(1);
  }, []);

  const handleClearFilters = useCallback(() => {
    setSearchInput('');
    setSearchQuery('');
    setRoleFilter('ALL');
    setMedicalFilter('ALL');
    setPage(1);
  }, []);

  const handleReload = useCallback(() => {
    setReloadTick((t) => t + 1);
    void refreshStats();
  }, [refreshStats]);

  const handleCopyMedicalLink = useCallback(
    async (participant: ParticipantDTO) => {
      const origin =
        typeof window !== 'undefined' ? window.location.origin : '';
      const path = `/ficha-medica/${encodeURIComponent(participant.rut)}`;
      const fullUrl = `${origin}${path}`;
      const eventLabel = activeEvent?.name || '26° World Scout Jamboree Polonia 2027';
      const whatsappMessage = `Hola, te enviamos el enlace directo para completar la Ficha Médica Oficial (${eventLabel}) de ${participant.firstName} ${participant.lastName} (RUT ${participant.rut}): ${fullUrl}`;

      try {
        await navigator.clipboard.writeText(whatsappMessage);
        toast.success(
          `Enlace WhatsApp de ${participant.firstName} ${participant.lastName} copiado al portapapeles.`,
          'Enlace Médico Copiado'
        );
      } catch {
        toast.error(
          'No se pudo copiar el enlace al portapapeles. Intenta nuevamente.',
          'Error al copiar'
        );
      }
    },
    [activeEvent?.name, toast]
  );

  const medicalSummary = statsData?.medicalSummary;
  const completedCount = medicalSummary?.completadas ?? 0;
  const pendingCount = medicalSummary?.pendientes ?? 0;
  const severeAllergyCount = medicalSummary?.alergiasSeveras ?? 0;
  const epiPenCount = medicalSummary?.portaEpiPen ?? 0;
  const coldChainCount = medicalSummary?.cadenaFrio ?? 0;

  const activeTotal =
    statsData?.summary?.totalParticipants ?? completedCount + pendingCount;
  const completedPct =
    activeTotal > 0 ? Math.round((completedCount / activeTotal) * 100) : 0;

  const hasActiveFilters =
    Boolean(searchInput.trim()) ||
    roleFilter !== 'ALL' ||
    medicalFilter !== 'ALL';

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-50 border border-red-200 text-red-600 flex items-center justify-center shrink-0">
              <HeartPulse className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-[#001558] tracking-tight">
                Panel Clínico y Preparación Médica WSJ
              </h1>
              <p className="text-xs sm:text-sm text-slate-600">
                {activeEvent
                  ? `${activeEvent.flagEmoji ? `${activeEvent.flagEmoji} ` : ''}${activeEvent.name} • Monitoreo de fichas clínicas, alergias y QR de emergencia`
                  : 'Seguimiento clínico integral del contingente'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleReload}
            className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-white hover:bg-[#FFFBF0] border border-slate-200 hover:border-[#FEB135] text-xs font-bold text-[#001558] transition-colors cursor-pointer shrink-0"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Actualizar Panel</span>
          </button>
        </div>
      </div>

      {/* 5 Interactive KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
        {/* 1. Fichas Completadas */}
        <button
          type="button"
          onClick={() => toggleMedicalKpi('COMPLETED')}
          className={`text-left rounded-2xl p-4 border transition-all cursor-pointer shadow-xs ${
            medicalFilter === 'COMPLETED'
              ? 'bg-emerald-50/70 border-emerald-500 ring-2 ring-emerald-200'
              : 'bg-white border-slate-200 hover:border-emerald-300'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Fichas Completadas
            </span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline justify-between gap-2 mb-2">
            <span className="text-2xl font-black text-[#001558]">
              {completedCount.toLocaleString('es-CL')}
            </span>
            <span className="text-xs font-extrabold text-emerald-700">
              {completedPct}%
            </span>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden border border-slate-200/70">
            <div
              className="bg-emerald-500 h-2 rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, completedPct)}%` }}
            />
          </div>
          <p className="text-[10px] text-slate-500 mt-1.5">
            Sobre {activeTotal.toLocaleString('es-CL')} activos
          </p>
        </button>

        {/* 2. Fichas Pendientes */}
        <button
          type="button"
          onClick={() => toggleMedicalKpi('PENDING')}
          className={`text-left rounded-2xl p-4 border transition-all cursor-pointer shadow-xs ${
            medicalFilter === 'PENDING'
              ? 'bg-[#FFF8E1] border-[#FEB135] ring-2 ring-[#FEB135]/40'
              : 'bg-white border-slate-200 hover:border-[#FEB135]'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Fichas Pendientes
            </span>
            <div className="w-8 h-8 rounded-xl bg-[#FFF8E1] border border-[#FEB135] text-[#001558] flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-[#001558]">
            {pendingCount.toLocaleString('es-CL')}
          </p>
          <p className="text-[10px] text-slate-500 mt-2">
            Clic para filtrar pendientes
          </p>
        </button>

        {/* 3. Alergias Severas */}
        <button
          type="button"
          onClick={() => toggleMedicalKpi('SEVERE_ALLERGY')}
          className={`text-left rounded-2xl p-4 border transition-all cursor-pointer shadow-xs ${
            medicalFilter === 'SEVERE_ALLERGY'
              ? 'bg-red-50 border-red-500 ring-2 ring-red-200'
              : 'bg-white border-slate-200 hover:border-red-300'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Alergias Severas
            </span>
            <div className="w-8 h-8 rounded-xl bg-red-50 border border-red-200 text-red-600 flex items-center justify-center">
              <ShieldAlert className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-red-700">
            {severeAllergyCount.toLocaleString('es-CL')}
          </p>
          <p className="text-[10px] text-slate-500 mt-2">
            Requieren alerta clínica
          </p>
        </button>

        {/* 4. Porta EpiPen */}
        <button
          type="button"
          onClick={() => toggleMedicalKpi('EPIPEN')}
          className={`text-left rounded-2xl p-4 border transition-all cursor-pointer shadow-xs ${
            medicalFilter === 'EPIPEN'
              ? 'bg-amber-50 border-amber-500 ring-2 ring-amber-200'
              : 'bg-white border-slate-200 hover:border-amber-300'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Porta EpiPen
            </span>
            <div className="w-8 h-8 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 flex items-center justify-center">
              <Syringe className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-[#001558]">
            {epiPenCount.toLocaleString('es-CL')}
          </p>
          <p className="text-[10px] text-slate-500 mt-2">
            Autoinyector de epinefrina
          </p>
        </button>

        {/* 5. Cadena de Frío */}
        <button
          type="button"
          onClick={() => toggleMedicalKpi('COLD_CHAIN')}
          className={`text-left rounded-2xl p-4 border transition-all cursor-pointer shadow-xs ${
            medicalFilter === 'COLD_CHAIN'
              ? 'bg-sky-50 border-sky-500 ring-2 ring-sky-200'
              : 'bg-white border-slate-200 hover:border-sky-300'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Cadena de Frío
            </span>
            <div className="w-8 h-8 rounded-xl bg-sky-50 border border-sky-200 text-sky-700 flex items-center justify-center">
              <Snowflake className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-[#001558]">
            {coldChainCount.toLocaleString('es-CL')}
          </p>
          <p className="text-[10px] text-slate-500 mt-2">
            Medicamentos refrigerados
          </p>
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <div className="sm:col-span-2 relative">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Buscar por participante, RUT, grupo o unidad..."
              className="w-full bg-white border border-slate-300 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-800 placeholder-slate-400 focus:border-[#001558] focus:ring-2 focus:ring-[#FEB135]/50 focus:outline-none"
            />
          </div>

          <select
            aria-label="Filtrar por rol"
            value={roleFilter}
            onChange={(e) => {
              setRoleFilter(e.target.value);
              setPage(1);
            }}
            className="bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-800 font-medium focus:border-[#001558] focus:ring-2 focus:ring-[#FEB135]/50 focus:outline-none"
          >
            {ROLE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>

          <select
            aria-label="Filtrar por estado clínico"
            value={medicalFilter}
            onChange={(e) => {
              setMedicalFilter(e.target.value as MedicalFilter);
              setPage(1);
            }}
            className="bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-800 font-medium focus:border-[#001558] focus:ring-2 focus:ring-[#FEB135]/50 focus:outline-none"
          >
            {MEDICAL_FILTER_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={handleClearFilters}
            disabled={!hasActiveFilters}
            className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-slate-300 bg-[#F5F6F8] hover:bg-slate-200/70 text-xs font-bold text-slate-700 disabled:opacity-45 transition-colors cursor-pointer"
          >
            <FilterX className="w-3.5 h-3.5" />
            <span>Limpiar filtros</span>
          </button>
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-2xl p-4 text-xs font-semibold">
          {error}
        </div>
      )}

      {/* Participants Table / Mobile Cards */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-12 flex items-center justify-center gap-2 text-xs font-semibold text-slate-500">
            <Loader2 className="w-5 h-5 animate-spin text-[#001558]" />
            <span>Cargando estado clínico de participantes...</span>
          </div>
        ) : participants.length === 0 ? (
          <div className="p-12 text-center space-y-2 text-slate-500">
            <Stethoscope className="w-9 h-9 mx-auto text-slate-300" />
            <p className="text-sm font-bold text-[#001558]">
              No hay participantes que coincidan con el filtro clínico
            </p>
            <p className="text-xs text-slate-500">
              Intenta limpiando los filtros o seleccionando otro indicador.
            </p>
          </div>
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[#F5F6F8] border-b border-slate-200 text-[11px] font-extrabold text-slate-600 uppercase tracking-wider">
                    <th className="py-3 px-4">Participante</th>
                    <th className="py-3 px-4">Estado Ficha</th>
                    <th className="py-3 px-4">Alertas Críticas</th>
                    <th className="py-3 px-4">Grupo Sanguíneo</th>
                    <th className="py-3 px-4">Contacto Emergencia</th>
                    <th className="py-3 px-4 text-right">Acciones Rápidas</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-xs">
                  {participants.map((p) => {
                    const med = p.medicalRecord;
                    const completed = isMedicalCompleted(med?.completionStatus);
                    const hasAllergy = Boolean(med?.hasSevereAllergies);
                    const hasEpiPen = Boolean(med?.carriesEpiPen);
                    const hasColdChain = Boolean(
                      med?.requiresColdChainMedication
                    );
                    const unitOrGroup =
                      p.unitName || p.scoutGroup || 'Sin unidad asignada';

                    return (
                      <tr
                        key={p.id}
                        className="hover:bg-[#FFFBF0]/60 transition-colors align-middle"
                      >
                        <td className="py-3.5 px-4">
                          <p className="font-bold text-[#001558]">
                            {p.firstName} {p.lastName}
                          </p>
                          <p className="text-[11px] text-slate-500 font-mono">
                            {p.rut}
                            {p.cupoCode ? ` • ${p.cupoCode}` : ''}
                          </p>
                          <p className="text-[11px] text-slate-600">
                            {unitOrGroup}
                          </p>
                        </td>

                        <td className="py-3.5 px-4 whitespace-nowrap">
                          {completed ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 text-[11px] font-bold">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                              {med?.completionStatus === 'VERIFIED'
                                ? 'Verificada'
                                : 'Completada'}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#FFF8E1] text-[#001558] border border-[#FEB135] text-[11px] font-bold">
                              <Clock className="w-3.5 h-3.5 text-[#FEB135]" />
                              Pendiente
                            </span>
                          )}
                        </td>

                        <td className="py-3.5 px-4">
                          <div className="flex flex-wrap gap-1.5">
                            {hasAllergy && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-red-50 text-red-700 border border-red-200 text-[10px] font-bold">
                                <AlertTriangle className="w-3 h-3" />
                                Alergia Severa
                              </span>
                            )}
                            {hasEpiPen && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200 text-[10px] font-bold">
                                <Syringe className="w-3 h-3" />
                                EpiPen
                              </span>
                            )}
                            {hasColdChain && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-sky-50 text-sky-800 border border-sky-200 text-[10px] font-bold">
                                <Snowflake className="w-3 h-3" />
                                Cadena Frío
                              </span>
                            )}
                            {!hasAllergy && !hasEpiPen && !hasColdChain && (
                              <span className="text-[11px] text-slate-400">
                                Sin alertas
                              </span>
                            )}
                          </div>
                        </td>

                        <td className="py-3.5 px-4 whitespace-nowrap">
                          {med?.bloodType ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-red-50/70 text-red-700 border border-red-200 font-mono font-bold text-[11px]">
                              <Droplet className="w-3 h-3" />
                              {med.bloodType}
                            </span>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>

                        <td className="py-3.5 px-4">
                          {med?.emergencyContactName ||
                          med?.emergencyContactPhone ? (
                            <div className="space-y-0.5">
                              <p className="font-semibold text-slate-800">
                                {med.emergencyContactName || 'Contacto'}
                              </p>
                              {med.emergencyContactPhone && (
                                <p className="inline-flex items-center gap-1 text-[11px] text-slate-500 font-mono">
                                  <Phone className="w-3 h-3" />
                                  {med.emergencyContactPhone}
                                </p>
                              )}
                            </div>
                          ) : (
                            <span className="text-slate-400">Sin registrar</span>
                          )}
                        </td>

                        <td className="py-3.5 px-4">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => setSelectedParticipantId(p.id)}
                              className="px-2.5 py-1.5 rounded-lg bg-[#EEF2FF] hover:bg-[#001558] text-[#001558] hover:text-white border border-[#001558]/20 text-[11px] font-bold transition-colors cursor-pointer whitespace-nowrap"
                            >
                              Ver Ficha
                            </button>

                            <button
                              type="button"
                              onClick={() => void handleCopyMedicalLink(p)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#FFFBF0] hover:bg-[#FFF8E1] text-[#001558] border border-[#FEB135] text-[11px] font-bold transition-colors cursor-pointer whitespace-nowrap"
                              title="Copiar mensaje WhatsApp con enlace directo"
                            >
                              <Share2 className="w-3 h-3" />
                              <span>Copiar Enlace</span>
                            </button>

                            {med?.qrAccessCode && (
                              <a
                                href={`/medico/${med.qrAccessCode}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#001558] hover:bg-[#0b2370] text-white text-[11px] font-bold transition-colors whitespace-nowrap"
                              >
                                <QrCode className="w-3 h-3 text-[#FEB135]" />
                                <span>QR Emergencia</span>
                              </a>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards */}
            <div className="md:hidden divide-y divide-slate-200">
              {participants.map((p) => {
                const med = p.medicalRecord;
                const completed = isMedicalCompleted(med?.completionStatus);
                const hasAllergy = Boolean(med?.hasSevereAllergies);
                const hasEpiPen = Boolean(med?.carriesEpiPen);
                const hasColdChain = Boolean(med?.requiresColdChainMedication);
                const unitOrGroup =
                  p.unitName || p.scoutGroup || 'Sin unidad asignada';

                return (
                  <div key={p.id} className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-bold text-[#001558]">
                          {p.firstName} {p.lastName}
                        </p>
                        <p className="text-[11px] text-slate-500 font-mono">
                          {p.rut}
                          {p.cupoCode ? ` • ${p.cupoCode}` : ''}
                        </p>
                        <p className="text-xs text-slate-600">{unitOrGroup}</p>
                      </div>

                      {completed ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] font-bold shrink-0">
                          <CheckCircle2 className="w-3 h-3" />
                          {med?.completionStatus === 'VERIFIED'
                            ? 'Verificada'
                            : 'Completada'}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#FFF8E1] text-[#001558] border border-[#FEB135] text-[10px] font-bold shrink-0">
                          <Clock className="w-3 h-3" />
                          Pendiente
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5">
                      {med?.bloodType && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-red-50/70 text-red-700 border border-red-200 font-mono font-bold text-[10px]">
                          <Droplet className="w-3 h-3" />
                          {med.bloodType}
                        </span>
                      )}
                      {hasAllergy && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-red-50 text-red-700 border border-red-200 text-[10px] font-bold">
                          <AlertTriangle className="w-3 h-3" />
                          Alergia Severa
                        </span>
                      )}
                      {hasEpiPen && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200 text-[10px] font-bold">
                          <Syringe className="w-3 h-3" />
                          EpiPen
                        </span>
                      )}
                      {hasColdChain && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-sky-50 text-sky-800 border border-sky-200 text-[10px] font-bold">
                          <Snowflake className="w-3 h-3" />
                          Cadena Frío
                        </span>
                      )}
                    </div>

                    {(med?.emergencyContactName || med?.emergencyContactPhone) && (
                      <div className="text-xs text-slate-600 bg-[#F5F6F8] rounded-xl px-3 py-2">
                        <span className="font-bold text-[#001558]">
                          Emergencia:{' '}
                        </span>
                        <span>{med.emergencyContactName || 'Contacto'}</span>
                        {med.emergencyContactPhone && (
                          <span className="font-mono text-slate-500">
                            {' '}
                            • {med.emergencyContactPhone}
                          </span>
                        )}
                      </div>
                    )}

                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setSelectedParticipantId(p.id)}
                        className="px-3 py-1.5 rounded-lg bg-[#EEF2FF] text-[#001558] border border-[#001558]/20 text-xs font-bold cursor-pointer"
                      >
                        Ver Ficha
                      </button>

                      <button
                        type="button"
                        onClick={() => void handleCopyMedicalLink(p)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#FFFBF0] text-[#001558] border border-[#FEB135] text-xs font-bold cursor-pointer"
                      >
                        <Share2 className="w-3.5 h-3.5" />
                        <span>Copiar Enlace</span>
                      </button>

                      {med?.qrAccessCode && (
                        <a
                          href={`/medico/${med.qrAccessCode}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#001558] text-white text-xs font-bold"
                        >
                          <QrCode className="w-3.5 h-3.5 text-[#FEB135]" />
                          <span>QR Emergencia</span>
                        </a>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* Pagination Footer */}
        <div className="px-4 py-3 bg-[#F5F6F8] border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs">
          <span className="text-slate-600 font-semibold">
            Página {page} de {totalPages} •{' '}
            {totalCount.toLocaleString('es-CL')} participantes
          </span>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={page <= 1 || loading}
              onClick={() => setPage((prev) => Math.max(1, prev - 1))}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white border border-slate-300 text-slate-700 font-bold hover:bg-slate-50 disabled:opacity-45 cursor-pointer"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>Anterior</span>
            </button>
            <button
              type="button"
              disabled={page >= totalPages || loading}
              onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white border border-slate-300 text-slate-700 font-bold hover:bg-slate-50 disabled:opacity-45 cursor-pointer"
            >
              <span>Siguiente</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Participant Detail Modal */}
      {selectedParticipantId && (
        <ParticipantDetailModal
          participantId={selectedParticipantId}
          currency={currency}
          permissions={permissions}
          onClose={() => setSelectedParticipantId(null)}
          onParticipantUpdated={handleReload}
        />
      )}
    </div>
  );
}

export default function SaludPage() {
  return (
    <AppShell>
      <SaludWorkspace />
    </AppShell>
  );
}
