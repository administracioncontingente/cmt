'use client';

import React from 'react';
import { Users, DollarSign, AlertTriangle, CheckCircle, TrendingUp, Clock } from 'lucide-react';
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
    roleCounts: {
      JOVEN: number;
      DIRIGENTE: number;
      IST: number;
      CMT: number;
    };
    statusCounts: {
      PRE_INSCRITO: number;
      CONFIRMADO: number;
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
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm relative overflow-hidden group hover:border-slate-700 transition-all">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Total Contingente
          </span>
          <div className="w-9 h-9 rounded-xl bg-indigo-950/80 border border-indigo-700/40 text-indigo-400 flex items-center justify-center">
            <Users className="w-4 h-4" />
          </div>
        </div>
        <div className="flex items-baseline gap-2 mb-2">
          <span className="text-3xl font-extrabold text-white">
            {stats.totalParticipants}
          </span>
          <span className="text-xs text-slate-400">inscritos</span>
        </div>
        <div className="flex items-center gap-2 text-[11px] text-slate-400 pt-2 border-t border-slate-800/80">
          <span className="text-indigo-400 font-semibold">{stats.roleCounts.JOVEN} Jóvenes</span>
          <span>•</span>
          <span className="text-amber-400 font-semibold">{stats.roleCounts.DIRIGENTE} Dir.</span>
          <span>•</span>
          <span className="text-emerald-400 font-semibold">{stats.roleCounts.IST} IST</span>
          <span>•</span>
          <span className="text-purple-400 font-semibold">{stats.roleCounts.CMT} CMT</span>
        </div>
      </div>

      {/* 2. Recaudación Total USD */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm relative overflow-hidden group hover:border-slate-700 transition-all">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Recaudación Total
          </span>
          <div className="w-9 h-9 rounded-xl bg-emerald-950/80 border border-emerald-700/40 text-emerald-400 flex items-center justify-center">
            <DollarSign className="w-4 h-4" />
          </div>
        </div>
        <div className="flex items-baseline gap-2 mb-2">
          <span className="text-3xl font-extrabold text-emerald-400">
            {formatUSD(stats.totalCollectedUSD)}
          </span>
        </div>
        <div className="space-y-1 pt-2 border-t border-slate-800/80">
          <div className="flex justify-between text-[11px] text-slate-400">
            <span>Meta: {formatUSD(stats.totalProjectedUSD)}</span>
            <span className="font-semibold text-emerald-400">{percentageCollected}%</span>
          </div>
          <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
            <div
              className="bg-emerald-500 h-1.5 rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, percentageCollected)}%` }}
            />
          </div>
        </div>
      </div>

      {/* 3. Saldo por Cobrar USD */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm relative overflow-hidden group hover:border-slate-700 transition-all">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Saldo por Recaudar
          </span>
          <div className="w-9 h-9 rounded-xl bg-blue-950/80 border border-blue-700/40 text-blue-400 flex items-center justify-center">
            <Clock className="w-4 h-4" />
          </div>
        </div>
        <div className="flex items-baseline gap-2 mb-2">
          <span className="text-3xl font-extrabold text-slate-200">
            {formatUSD(stats.totalOutstandingUSD)}
          </span>
        </div>
        <div className="flex items-center gap-2 text-[11px] text-slate-400 pt-2 border-t border-slate-800/80">
          <span className="text-emerald-400 font-semibold">{stats.countCompletado} pagados 100%</span>
          <span>•</span>
          <span className="text-blue-400 font-semibold">{stats.countAlDia} al día</span>
        </div>
      </div>

      {/* 4. Alerta de Mora */}
      <div className={`bg-slate-900 border rounded-2xl p-5 shadow-sm relative overflow-hidden group transition-all ${
        stats.countEnMora > 0 ? 'border-red-900/60 bg-red-950/10' : 'border-slate-800'
      }`}>
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Cuotas en Mora
          </span>
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center border ${
            stats.countEnMora > 0
              ? 'bg-red-950/80 border-red-700/50 text-red-400'
              : 'bg-slate-800 border-slate-700 text-slate-400'
          }`}>
            <AlertTriangle className="w-4 h-4" />
          </div>
        </div>
        <div className="flex items-baseline gap-2 mb-2">
          <span className={`text-3xl font-extrabold ${stats.countEnMora > 0 ? 'text-red-400' : 'text-slate-400'}`}>
            {formatUSD(stats.totalOverdueUSD)}
          </span>
        </div>
        <div className="flex items-center justify-between text-[11px] pt-2 border-t border-slate-800/80">
          <span className="text-slate-400">Participantes retrasados:</span>
          <span className={`font-bold px-2 py-0.5 rounded-full ${
            stats.countEnMora > 0 ? 'bg-red-900/50 text-red-300' : 'bg-slate-800 text-slate-400'
          }`}>
            {stats.countEnMora} personas
          </span>
        </div>
      </div>
    </div>
  );
}
