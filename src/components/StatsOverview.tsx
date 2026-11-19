'use client';

import React from 'react';
import { Users, DollarSign, AlertTriangle, Clock } from 'lucide-react';
import { formatUSD } from '@/lib/finance';

interface StatsOverviewProps {
  stats: {
    totalParticipants: number;
    totalProjectedUSD: number;
    totalCollectedUSD: number;
    totalOutstandingUSD: number;
    totalOverdueUSD: number;
    countAlDia: number;
    countEnMora: number;
    countCompletado: number;
    countBaja: number;
    roleCounts: {
      JOVEN: number;
      DIRIGENTE: number;
      IST: number;
      CMT: number;
    };
    statusCounts: {
      CONFIRMADO: number;
      PRE_INSCRITO: number;
      LISTA_ESPERA: number;
      RETIRADO: number;
    };
  } | null;
}

export function StatsOverview({ stats }: StatsOverviewProps) {
  if (!stats) return null;

  const percentageCollected = stats.totalProjectedUSD > 0
    ? Math.round((stats.totalCollectedUSD / stats.totalProjectedUSD) * 100)
    : 0;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
      {/* 1. Total Participantes */}
      <div className="bg-[#001558]/85 border border-[#0d349e] rounded-2xl p-5 shadow-lg relative overflow-hidden group hover:border-[#FEB135]/50 transition-all">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">
            Total Contingente
          </span>
          <div className="w-9 h-9 rounded-xl bg-[#000c33] border border-[#0d349e] text-[#FEB135] flex items-center justify-center">
            <Users className="w-4 h-4" />
          </div>
        </div>
        <div className="flex items-baseline gap-2 mb-2">
          <span className="text-3xl font-black text-white">
            {stats.totalParticipants.toLocaleString('es-CL')}
          </span>
          <span className="text-xs text-slate-300">inscritos</span>
        </div>
        <div className="flex items-center gap-2 text-[11px] text-slate-300 pt-2 border-t border-[#0d349e] flex-wrap">
          <span className="text-[#FEB135] font-bold">{stats.roleCounts.JOVEN} Jóvenes</span>
          <span>•</span>
          <span className="text-white font-medium">{stats.roleCounts.DIRIGENTE} Dirigentes</span>
          <span>•</span>
          <span className="text-emerald-300 font-medium">{stats.roleCounts.IST} IST</span>
          <span>•</span>
          <span className="text-purple-300 font-medium">{stats.roleCounts.CMT} CMT</span>
        </div>
      </div>

      {/* 2. Recaudación Real USD */}
      <div className="bg-[#001558]/85 border border-[#0d349e] rounded-2xl p-5 shadow-lg relative overflow-hidden group hover:border-[#FEB135]/50 transition-all">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">
            Recaudación Real
          </span>
          <div className="w-9 h-9 rounded-xl bg-[#000c33] border border-[#FEB135]/40 text-[#FEB135] flex items-center justify-center">
            <DollarSign className="w-4 h-4" />
          </div>
        </div>
        <div className="flex items-baseline gap-2 mb-2">
          <span className="text-3xl font-black text-[#FEB135]">
            {formatUSD(stats.totalCollectedUSD)}
          </span>
        </div>
        <div className="space-y-1.5 pt-2 border-t border-[#0d349e]">
          <div className="flex justify-between text-[11px] text-slate-300">
            <span>Meta: {formatUSD(stats.totalProjectedUSD)}</span>
            <span className="font-bold text-[#FEB135]">{percentageCollected}%</span>
          </div>
          <div className="w-full bg-[#000c33] rounded-full h-2 overflow-hidden border border-[#0d349e]">
            <div
              className="bg-[#FEB135] h-2 rounded-full transition-all duration-500 shadow-sm shadow-[#FEB135]/50"
              style={{ width: `${Math.min(100, percentageCollected)}%` }}
            />
          </div>
        </div>
      </div>

      {/* 3. Saldo por Recaudar */}
      <div className="bg-[#001558]/85 border border-[#0d349e] rounded-2xl p-5 shadow-lg relative overflow-hidden group hover:border-[#FEB135]/50 transition-all">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">
            Saldo por Recaudar
          </span>
          <div className="w-9 h-9 rounded-xl bg-[#000c33] border border-[#0d349e] text-blue-300 flex items-center justify-center">
            <Clock className="w-4 h-4" />
          </div>
        </div>
        <div className="flex items-baseline gap-2 mb-2">
          <span className="text-3xl font-black text-slate-100">
            {formatUSD(stats.totalOutstandingUSD)}
          </span>
        </div>
        <div className="flex items-center gap-2 text-[11px] text-slate-300 pt-2 border-t border-[#0d349e]">
          <span className="text-[#FEB135] font-bold">{stats.countCompletado} pagados 100%</span>
          <span>•</span>
          <span className="text-emerald-300 font-medium">{stats.countAlDia} al día</span>
        </div>
      </div>

      {/* 4. Alerta de Mora / Adeudo */}
      <div className={`border rounded-2xl p-5 shadow-lg relative overflow-hidden group transition-all ${
        stats.countEnMora > 0 ? 'bg-[#1a001a]/70 border-red-700/60' : 'bg-[#001558]/85 border-[#0d349e]'
      }`}>
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">
            Cuotas en Mora
          </span>
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center border ${
            stats.countEnMora > 0
              ? 'bg-red-950/80 border-red-600/60 text-red-300'
              : 'bg-[#000c33] border-[#0d349e] text-slate-400'
          }`}>
            <AlertTriangle className="w-4 h-4" />
          </div>
        </div>
        <div className="flex items-baseline gap-2 mb-2">
          <span className={`text-3xl font-black ${stats.countEnMora > 0 ? 'text-red-300' : 'text-slate-300'}`}>
            {formatUSD(stats.totalOverdueUSD)}
          </span>
        </div>
        <div className="flex items-center justify-between text-[11px] pt-2 border-t border-[#0d349e]/60">
          <span className="text-slate-300">Participantes con adeudo:</span>
          <span className={`font-bold px-2 py-0.5 rounded-full ${
            stats.countEnMora > 0 ? 'bg-red-950 text-red-200 border border-red-700/60' : 'bg-[#000c33] text-slate-300'
          }`}>
            {stats.countEnMora} personas
          </span>
        </div>
      </div>
    </div>
  );
}
