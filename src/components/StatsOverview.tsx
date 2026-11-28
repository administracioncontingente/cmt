'use client';

import React from 'react';
import Link from 'next/link';
import {
  Users,
  DollarSign,
  AlertTriangle,
  Clock,
  HeartPulse,
  PieChart,
  ArrowRight,
  ShieldAlert,
  Syringe,
  Snowflake,
} from 'lucide-react';
import { formatCurrency } from '@/lib/finance';
import type { DashboardStatsDTO } from '@/types/domain';

export interface StatsQuickFilter {
  role?: string;
  health?: string;
  status?: string;
}

interface StatsOverviewProps {
  stats: DashboardStatsDTO['summary'] | null;
  currency?: string;
  statsData?: DashboardStatsDTO | null;
  loading?: boolean;
  activeRoleFilter?: string;
  activeHealthFilter?: string;
  activeStatusFilter?: string;
  onQuickFilter?: (filter: StatsQuickFilter) => void;
}

const ROLE_QUICK_FILTERS: Array<{
  key: 'JOVEN' | 'DIRIGENTE' | 'IST' | 'CMT';
  label: string;
  textColor: string;
}> = [
  { key: 'JOVEN', label: 'Jóvenes', textColor: 'text-[#001558]' },
  { key: 'DIRIGENTE', label: 'Dirigentes', textColor: 'text-slate-700' },
  { key: 'IST', label: 'IST', textColor: 'text-emerald-700' },
  { key: 'CMT', label: 'CMT', textColor: 'text-purple-700' },
];

function StatsSkeleton() {
  return (
    <section className="space-y-4 mb-6" aria-busy="true" aria-label="Cargando estadísticas">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[0, 1, 2, 3].map((idx) => (
          <div
            key={idx}
            className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs animate-pulse"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="h-3 w-28 bg-slate-200 rounded" />
              <div className="w-9 h-9 rounded-xl bg-slate-100 border border-slate-200" />
            </div>
            <div className="h-8 w-32 bg-slate-200 rounded mb-3" />
            <div className="pt-2.5 border-t border-slate-100 flex items-center gap-2">
              <div className="h-3 w-20 bg-slate-100 rounded" />
              <div className="h-3 w-16 bg-slate-100 rounded" />
              <div className="h-3 w-12 bg-slate-100 rounded" />
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {[0, 1].map((idx) => (
          <div
            key={idx}
            className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-xs animate-pulse"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="h-3.5 w-40 bg-slate-200 rounded" />
              <div className="h-3 w-24 bg-slate-100 rounded" />
            </div>
            <div className="h-2.5 w-full bg-slate-100 rounded-full mb-3" />
            <div className="flex items-center gap-2">
              <div className="h-5 w-24 bg-slate-100 rounded-full" />
              <div className="h-5 w-24 bg-slate-100 rounded-full" />
              <div className="h-5 w-24 bg-slate-100 rounded-full" />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export function StatsOverview({
  stats,
  currency = 'USD',
  statsData,
  loading = false,
  activeRoleFilter = 'ALL',
  activeHealthFilter = 'ALL',
  activeStatusFilter = 'ALL',
  onQuickFilter,
}: StatsOverviewProps) {
  if (loading || !stats) {
    return <StatsSkeleton />;
  }

  const percentageCollected =
    stats.totalProjectedUSD > 0
      ? Math.round((stats.totalCollectedUSD / stats.totalProjectedUSD) * 100)
      : 0;

  const hasOverdue = stats.countEnMora > 0;
  const isInteractive = Boolean(onQuickFilter);
  const isBajaActive = activeStatusFilter === 'RETIRADO';
  const isPagadoTotalActive = activeHealthFilter === 'PAGADO_TOTAL';
  const isAlDiaActive = activeHealthFilter === 'AL_DIA';
  const isEnMoraActive = activeHealthFilter === 'EN_MORA';

  // Financial distribution for executive strip
  const completadoCount = statsData?.financialSummary?.completado ?? stats.countCompletado ?? 0;
  const alDiaCount = statsData?.financialSummary?.alDia ?? stats.countAlDia ?? 0;
  const enMoraCount = statsData?.financialSummary?.enMora ?? stats.countEnMora ?? 0;
  const totalFinancialActive = completadoCount + alDiaCount + enMoraCount;

  const pctCompletado =
    totalFinancialActive > 0 ? (completadoCount / totalFinancialActive) * 100 : 0;
  const pctAlDia = totalFinancialActive > 0 ? (alDiaCount / totalFinancialActive) * 100 : 0;
  const pctEnMora = totalFinancialActive > 0 ? (enMoraCount / totalFinancialActive) * 100 : 0;

  // Medical summary for WSJ readiness strip
  const medCompletadas = statsData?.medicalSummary?.completadas ?? 0;
  const medPendientes = statsData?.medicalSummary?.pendientes ?? 0;
  const medTotal = medCompletadas + medPendientes;
  const medPercent = medTotal > 0 ? Math.round((medCompletadas / medTotal) * 100) : 0;
  const alergiasSeveras = statsData?.medicalSummary?.alergiasSeveras ?? 0;
  const portaEpiPen = statsData?.medicalSummary?.portaEpiPen ?? 0;
  const cadenaFrio = statsData?.medicalSummary?.cadenaFrio ?? 0;

  const renderMoraCardInner = () => (
    <>
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
          Cuotas en Mora
        </span>
        <div
          className={`w-9 h-9 rounded-xl flex items-center justify-center border ${
            hasOverdue
              ? 'bg-red-100 border-red-200 text-red-700'
              : 'bg-slate-100 border-slate-200 text-slate-500'
          }`}
        >
          <AlertTriangle className="w-4 h-4" />
        </div>
      </div>
      <div className="flex items-baseline gap-2 mb-2">
        <span
          className={`text-3xl font-extrabold ${
            hasOverdue ? 'text-red-700' : 'text-[#001558]'
          }`}
        >
          {formatCurrency(stats.totalOverdueUSD, currency)}
        </span>
      </div>
      <div
        className={`flex items-center justify-between text-[11px] pt-2.5 border-t ${
          hasOverdue ? 'border-red-200/70' : 'border-slate-100'
        }`}
      >
        <span className="text-slate-600">Participantes con adeudo:</span>
        <span
          className={`font-bold px-2 py-0.5 rounded-full border ${
            hasOverdue
              ? 'bg-red-50 text-red-700 border-red-200'
              : 'bg-slate-100 text-slate-600 border-slate-200'
          }`}
        >
          {stats.countEnMora} personas
        </span>
      </div>
    </>
  );

  return (
    <section className="space-y-4 mb-6">
      {/* 4 KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 1. Total Participantes */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs hover:border-[#001558]/30 transition-all">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Total Contingente
            </span>
            <div className="w-9 h-9 rounded-xl bg-[#EEF2FF] border border-[#001558]/15 text-[#001558] flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2 mb-2 flex-wrap">
            <span className="text-3xl font-extrabold text-[#001558]">
              {stats.totalParticipants.toLocaleString('es-CL')}
            </span>
            <span
              className="text-xs text-slate-500 font-medium"
              title="Participantes inscritos confirmados (INSCRITO = SI)"
            >
              activos
            </span>
            {stats.countBaja > 0 &&
              (isInteractive ? (
                <button
                  type="button"
                  onClick={() =>
                    onQuickFilter?.({
                      status: isBajaActive ? 'ALL' : 'RETIRADO',
                    })
                  }
                  aria-pressed={isBajaActive}
                  title="Filtrar bajas / retirados"
                  className={`ml-auto px-2 py-0.5 rounded-full text-[10px] font-bold border transition-all cursor-pointer ${
                    isBajaActive
                      ? 'bg-[#001558] text-white border-[#001558] ring-2 ring-[#FEB135]'
                      : 'bg-slate-100 text-slate-600 border-slate-200 hover:border-[#001558]/40 hover:bg-slate-200/70'
                  }`}
                >
                  {stats.countBaja} bajas
                </button>
              ) : (
                <span className="ml-auto px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200 text-[10px] font-bold">
                  {stats.countBaja} bajas
                </span>
              ))}
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-slate-500 pt-2.5 border-t border-slate-100 flex-wrap">
            {ROLE_QUICK_FILTERS.map((roleItem, idx) => {
              const count = stats.roleCounts[roleItem.key] ?? 0;
              const isActive = activeRoleFilter === roleItem.key;

              return (
                <React.Fragment key={roleItem.key}>
                  {idx > 0 && !isInteractive && <span>•</span>}
                  {isInteractive ? (
                    <button
                      type="button"
                      onClick={() =>
                        onQuickFilter?.({
                          role: isActive ? 'ALL' : roleItem.key,
                        })
                      }
                      aria-pressed={isActive}
                      className={`px-1.5 py-0.5 rounded-md font-bold transition-all cursor-pointer border ${
                        isActive
                          ? 'bg-[#FFF8E1] text-[#001558] border-[#FEB135] ring-2 ring-[#001558]/20'
                          : `bg-transparent border-transparent hover:bg-slate-100 ${roleItem.textColor}`
                      }`}
                    >
                      {count} {roleItem.label}
                    </button>
                  ) : (
                    <span className={`${roleItem.textColor} font-bold`}>
                      {count} {roleItem.label}
                    </span>
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>

        {/* 2. Recaudación Real */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs hover:border-[#001558]/30 transition-all">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Recaudación Real
            </span>
            <div className="w-9 h-9 rounded-xl bg-[#FFFBF0] border border-[#FEB135]/50 text-[#001558] flex items-center justify-center">
              <DollarSign className="w-4 h-4 text-[#001558]" />
            </div>
          </div>
          <div className="flex items-baseline gap-2 mb-2">
            <span className="text-3xl font-extrabold text-[#001558]">
              {formatCurrency(stats.totalCollectedUSD, currency)}
            </span>
          </div>
          <div className="space-y-1.5 pt-2.5 border-t border-slate-100">
            <div className="flex justify-between text-[11px] text-slate-500">
              <span>Meta: {formatCurrency(stats.totalProjectedUSD, currency)}</span>
              <span className="font-bold text-[#001558]">{percentageCollected}%</span>
            </div>
            <div className="w-full bg-[#F1F5F9] rounded-full h-2 overflow-hidden border border-slate-200/70">
              <div
                className="bg-[#FEB135] h-2 rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, percentageCollected)}%` }}
              />
            </div>
            {(stats.bajaCollectedUSD ?? 0) > 0 && (
              <p className="text-[10px] text-slate-500 pt-0.5">
                Incluye en bajas: {formatCurrency(stats.bajaCollectedUSD ?? 0, currency)}
              </p>
            )}
          </div>
        </div>

        {/* 3. Saldo por Recaudar */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs hover:border-[#001558]/30 transition-all">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Saldo por Recaudar
            </span>
            <div className="w-9 h-9 rounded-xl bg-[#EEF2FF] border border-[#001558]/15 text-[#001558] flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2 mb-2">
            <span className="text-3xl font-extrabold text-[#001558]">
              {formatCurrency(stats.totalOutstandingUSD, currency)}
            </span>
          </div>
          <div className="flex items-center gap-2 text-[11px] text-slate-500 pt-2.5 border-t border-slate-100 flex-wrap">
            {isInteractive ? (
              <>
                <button
                  type="button"
                  onClick={() =>
                    onQuickFilter?.({
                      health: isPagadoTotalActive ? 'ALL' : 'PAGADO_TOTAL',
                    })
                  }
                  aria-pressed={isPagadoTotalActive}
                  className={`px-2 py-0.5 rounded-full bg-[#FFF8E1] text-[#001558] border border-[#FEB135] font-bold transition-all cursor-pointer ${
                    isPagadoTotalActive ? 'ring-2 ring-[#001558]' : 'hover:brightness-95'
                  }`}
                >
                  {stats.countCompletado} pagados 100%
                </button>
                <button
                  type="button"
                  onClick={() =>
                    onQuickFilter?.({
                      health: isAlDiaActive ? 'ALL' : 'AL_DIA',
                    })
                  }
                  aria-pressed={isAlDiaActive}
                  className={`px-2 py-0.5 rounded-full font-semibold border transition-all cursor-pointer ${
                    isAlDiaActive
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-500 ring-2 ring-[#001558]'
                      : 'bg-emerald-50/60 text-emerald-700 border-emerald-200 hover:bg-emerald-50'
                  }`}
                >
                  {stats.countAlDia} al día
                </button>
              </>
            ) : (
              <>
                <span className="px-2 py-0.5 rounded-full bg-[#FFF8E1] text-[#001558] border border-[#FEB135] font-bold">
                  {stats.countCompletado} pagados 100%
                </span>
                <span className="text-emerald-700 font-semibold">
                  {stats.countAlDia} al día
                </span>
              </>
            )}
          </div>
        </div>

        {/* 4. Alerta de Mora / Adeudo */}
        {isInteractive ? (
          <button
            type="button"
            onClick={() =>
              onQuickFilter?.({
                health: isEnMoraActive ? 'ALL' : 'EN_MORA',
              })
            }
            aria-pressed={isEnMoraActive}
            className={`w-full text-left rounded-2xl p-5 shadow-xs transition-all cursor-pointer ${
              hasOverdue
                ? 'bg-red-50/50 border border-red-200 border-l-4 border-l-red-500 hover:bg-red-50/80'
                : 'bg-white border border-slate-200 hover:border-[#001558]/30'
            } ${isEnMoraActive ? 'ring-2 ring-[#001558] border-[#001558]' : ''}`}
          >
            {renderMoraCardInner()}
          </button>
        ) : (
          <div
            className={`rounded-2xl p-5 shadow-xs transition-all ${
              hasOverdue
                ? 'bg-red-50/50 border border-red-200 border-l-4 border-l-red-500'
                : 'bg-white border border-slate-200'
            }`}
          >
            {renderMoraCardInner()}
          </div>
        )}
      </div>

      {/* Executive Summary Strip */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Left: Distribución Financiera */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-xs flex flex-col justify-between gap-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-[#FFFBF0] border border-[#FEB135]/60 text-[#001558] flex items-center justify-center shrink-0">
                <PieChart className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs font-extrabold text-[#001558] uppercase tracking-wider">
                  Distribución Financiera
                </h3>
                <p className="text-[11px] text-slate-500">
                  Estado de cuotas sobre {totalFinancialActive.toLocaleString('es-CL')} activos
                </p>
              </div>
            </div>
            <Link
              href="/finanzas"
              className="inline-flex items-center gap-1 text-xs font-bold text-[#001558] hover:text-[#0b2370] hover:underline shrink-0"
            >
              Ver Tesorería
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div
            className="w-full h-2.5 bg-[#F1F5F9] rounded-full overflow-hidden flex border border-slate-200/70"
            role="img"
            aria-label={`Total Pagado ${completadoCount}, Al Día ${alDiaCount}, En Mora ${enMoraCount}`}
          >
            {pctCompletado > 0 && (
              <div
                className="bg-[#FEB135] h-full transition-all duration-500"
                style={{ width: `${pctCompletado}%` }}
                title={`Total Pagado: ${completadoCount}`}
              />
            )}
            {pctAlDia > 0 && (
              <div
                className="bg-emerald-500 h-full transition-all duration-500"
                style={{ width: `${pctAlDia}%` }}
                title={`Al Día: ${alDiaCount}`}
              />
            )}
            {pctEnMora > 0 && (
              <div
                className="bg-red-500 h-full transition-all duration-500"
                style={{ width: `${pctEnMora}%` }}
                title={`En Mora: ${enMoraCount}`}
              />
            )}
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] text-slate-600">
            <span className="inline-flex items-center gap-1.5 font-semibold">
              <span className="w-2.5 h-2.5 rounded-full bg-[#FEB135] inline-block" />
              Total Pagado:{' '}
              <strong className="text-[#001558]">{completadoCount}</strong>
            </span>
            <span className="inline-flex items-center gap-1.5 font-semibold">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
              Al Día:{' '}
              <strong className="text-emerald-800">{alDiaCount}</strong>
            </span>
            <span className="inline-flex items-center gap-1.5 font-semibold">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block" />
              En Mora:{' '}
              <strong className="text-red-700">{enMoraCount}</strong>
            </span>
          </div>
        </div>

        {/* Right: Preparación Médica del Evento */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-xs flex flex-col justify-between gap-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center justify-center shrink-0">
                <HeartPulse className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs font-extrabold text-[#001558] uppercase tracking-wider">
                  Preparación Médica del Evento
                </h3>
                <p className="text-[11px] text-slate-500">
                  {medCompletadas} completadas / {medPendientes} pendientes ({medPercent}%)
                </p>
              </div>
            </div>
            <Link
              href="/salud"
              className="inline-flex items-center gap-1 text-xs font-bold text-[#001558] hover:text-[#0b2370] hover:underline shrink-0"
            >
              Panel de Salud
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="w-full h-2.5 bg-[#F1F5F9] rounded-full overflow-hidden border border-slate-200/70">
            <div
              className="bg-emerald-500 h-full rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, medPercent)}%` }}
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 text-[11px]">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-50 text-red-700 border border-red-200 font-bold">
              <ShieldAlert className="w-3 h-3" />
              Alergias Severas: {alergiasSeveras}
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#FFF8E1] text-[#001558] border border-[#FEB135] font-bold">
              <Syringe className="w-3 h-3" />
              EpiPen: {portaEpiPen}
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-sky-50 text-sky-800 border border-sky-200 font-bold">
              <Snowflake className="w-3 h-3" />
              Cadena de Frío: {cadenaFrio}
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
