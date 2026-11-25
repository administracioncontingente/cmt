'use client';

import React from 'react';
import { Users, DollarSign, AlertTriangle, Clock } from 'lucide-react';
import { formatCurrency } from '@/lib/finance';
import type { DashboardStatsDTO } from '@/types/domain';

interface StatsOverviewProps {
  stats: DashboardStatsDTO['summary'] | null;
  currency?: string;
}

export function StatsOverview({ stats, currency = 'USD' }: StatsOverviewProps) {
  if (!stats) return null;

  const percentageCollected =
    stats.totalProjectedUSD > 0
      ? Math.round((stats.totalCollectedUSD / stats.totalProjectedUSD) * 100)
      : 0;

  const hasOverdue = stats.countEnMora > 0;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
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
          <span className="text-xs text-slate-500 font-medium">activos</span>
          {stats.countBaja > 0 && (
            <span className="ml-auto px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200 text-[10px] font-bold">
              {stats.countBaja} bajas
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 text-[11px] text-slate-500 pt-2.5 border-t border-slate-100 flex-wrap">
          <span className="text-[#001558] font-bold">
            {stats.roleCounts.JOVEN ?? 0} Jóvenes
          </span>
          <span>•</span>
          <span className="text-slate-700 font-semibold">
            {stats.roleCounts.DIRIGENTE ?? 0} Dirigentes
          </span>
          <span>•</span>
          <span className="text-emerald-700 font-semibold">
            {stats.roleCounts.IST ?? 0} IST
          </span>
          <span>•</span>
          <span className="text-purple-700 font-semibold">
            {stats.roleCounts.CMT ?? 0} CMT
          </span>
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
              Saldo neto en bajas: {formatCurrency(stats.bajaCollectedUSD ?? 0, currency)}
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
          <span className="px-2 py-0.5 rounded-full bg-[#FFF8E1] text-[#001558] border border-[#FEB135] font-bold">
            {stats.countCompletado} pagados 100%
          </span>
          <span className="text-emerald-700 font-semibold">
            {stats.countAlDia} al día
          </span>
        </div>
      </div>

      {/* 4. Alerta de Mora / Adeudo */}
      <div
        className={`rounded-2xl p-5 shadow-xs transition-all ${
          hasOverdue
            ? 'bg-red-50/50 border border-red-200 border-l-4 border-l-red-500'
            : 'bg-white border border-slate-200'
        }`}
      >
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
      </div>
    </div>
  );
}
