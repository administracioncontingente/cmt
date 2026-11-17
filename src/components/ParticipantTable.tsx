'use client';

import React, { useState } from 'react';
import {
  Search,
  Filter,
  UserPlus,
  FileSpreadsheet,
  Download,
  CreditCard,
  Edit2,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Eye,
  RefreshCw,
  Loader2,
  Tag,
  Compass,
} from 'lucide-react';
import { formatUSD } from '@/lib/finance';

interface ParticipantTableProps {
  participants: any[];
  loading: boolean;
  onRefresh: () => void;
  onSelectParticipant: (id: string) => void;
  onEditParticipant: (participant: any) => void;
  onNewParticipant: () => void;
  onOpenImport: () => void;
  searchTerm: string;
  setSearchTerm: (s: string) => void;
  roleFilter: string;
  setRoleFilter: (r: string) => void;
  statusFilter: string;
  setStatusFilter: (s: string) => void;
  healthFilter: string;
  setHealthFilter: (h: string) => void;
}

export function ParticipantTable({
  participants,
  loading,
  onRefresh,
  onSelectParticipant,
  onEditParticipant,
  onNewParticipant,
  onOpenImport,
  searchTerm,
  setSearchTerm,
  roleFilter,
  setRoleFilter,
  statusFilter,
  setStatusFilter,
  healthFilter,
  setHealthFilter,
}: ParticipantTableProps) {
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`¿Estás seguro de eliminar al participante ${name}? Se borrarán también sus registros de pagos asociados.`)) {
      return;
    }

    try {
      setDeletingId(id);
      const res = await fetch(`/api/participants/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Error al eliminar');
      }
      onRefresh();
    } catch (err: any) {
      alert(err.message || 'Error al eliminar participante');
    } finally {
      setDeletingId(null);
    }
  };

  const handleExport = () => {
    const params = new URLSearchParams();
    if (searchTerm) params.append('search', searchTerm);
    if (roleFilter !== 'ALL') params.append('role', roleFilter);
    if (statusFilter !== 'ALL') params.append('status', statusFilter);
    if (healthFilter !== 'ALL') params.append('health', healthFilter);
    window.open(`/api/export?${params.toString()}`, '_blank');
  };

  const getRoleBadge = (role: string) => {
    const r = (role || '').toUpperCase();
    if (r.includes('RESPONSABLE') || r.includes('DIRIGENTE')) {
      return { label: 'Educador / Dirigente', class: 'bg-amber-950/80 text-amber-300 border-amber-700/50' };
    }
    if (r.includes('IST') || r.includes('SERVICIO')) {
      return { label: 'IST Servicio', class: 'bg-emerald-950/80 text-emerald-300 border-emerald-700/50' };
    }
    if (r.includes('CMT')) {
      return { label: 'CMT Gestión', class: 'bg-purple-950/80 text-purple-300 border-purple-700/50' };
    }
    if (r.includes('PATRULLA')) {
      return { label: 'Resp. Patrulla', class: 'bg-cyan-950/80 text-cyan-300 border-cyan-700/50' };
    }
    return { label: 'Joven Participante', class: 'bg-indigo-950/80 text-indigo-300 border-indigo-700/50' };
  };

  const getFinancialBadge = (p: any) => {
    const sheetStatus = p.financialStatusSheet;
    const fin = p.financial;

    if (sheetStatus === 'Total Pagado' || fin.isFullyPaid) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-950 text-blue-300 border border-blue-700/60">
          <CheckCircle2 className="w-3 h-3 text-blue-400" />
          Total Pagado
        </span>
      );
    }

    if (sheetStatus === 'BAJA' || p.status === 'RETIRADO') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 text-slate-400 border border-slate-700">
          BAJA / Retirado
        </span>
      );
    }

    if (sheetStatus === 'Adeuda' || fin.isOverdue || (p.debtToDateUSD && p.debtToDateUSD > 0)) {
      const overdue = p.debtToDateUSD || fin.overdueAmount;
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-950/80 text-red-300 border border-red-700/80">
          <AlertCircle className="w-3 h-3 text-red-400" />
          Adeuda {overdue > 0 ? `(${formatUSD(overdue)})` : ''}
        </span>
      );
    }

    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-950 text-emerald-300 border border-emerald-700/60">
        <CheckCircle2 className="w-3 h-3 text-emerald-400" />
        Al Día
      </span>
    );
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-sm overflow-hidden">
      {/* Control & Filter Bar */}
      <div className="p-4 sm:p-5 border-b border-slate-800 space-y-3">
        {/* Top bar: Action Buttons */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              Contingente Oficial AGSCH
              <span className="px-2 py-0.5 rounded-full bg-indigo-950 text-indigo-300 border border-indigo-700/50 text-xs font-mono font-medium">
                {participants.length} participantes
              </span>
            </h2>
            <button
              onClick={onRefresh}
              title="Recargar datos"
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={onOpenImport}
              className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-medium flex items-center gap-1.5 border border-slate-700 transition-all cursor-pointer"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
              Importar Planilla
            </button>

            <button
              onClick={handleExport}
              className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-medium flex items-center gap-1.5 border border-slate-700 transition-all cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-blue-400" />
              Exportar Nómina
            </button>

            <button
              onClick={onNewParticipant}
              className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white rounded-xl text-xs font-medium flex items-center gap-1.5 shadow-md shadow-indigo-600/20 transition-all cursor-pointer"
            >
              <UserPlus className="w-3.5 h-3.5" />
              Nuevo Registro
            </button>
          </div>
        </div>

        {/* Bottom bar: Filters and Search */}
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 pt-2">
          {/* Search Input */}
          <div className="sm:col-span-5 relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
              <Search className="w-4 h-4" />
            </div>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por RUT, Nombre, Código Cupo (IST106), Grupo, Unidad o Comuna..."
              className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-500 text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none"
            />
          </div>

          {/* Role Filter */}
          <div className="sm:col-span-2">
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="w-full px-2.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-300 text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none"
            >
              <option value="ALL">Todos los Roles</option>
              <option value="JOVEN">Jóvenes / Participantes</option>
              <option value="DIRIGENTE">Responsables / Educadores</option>
              <option value="IST">IST (Servicio)</option>
              <option value="CMT">CMT (Contingente)</option>
            </select>
          </div>

          {/* Status Filter */}
          <div className="sm:col-span-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-2.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-300 text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none"
            >
              <option value="ALL">Todos los Estados</option>
              <option value="CONFIRMADO">Confirmados</option>
              <option value="PRE_INSCRITO">Preinscritos</option>
              <option value="RETIRADO">Bajas / Retirados</option>
            </select>
          </div>

          {/* Health Filter */}
          <div className="sm:col-span-3">
            <select
              value={healthFilter}
              onChange={(e) => setHealthFilter(e.target.value)}
              className="w-full px-2.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-300 text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none"
            >
              <option value="ALL">Todas las Situaciones de Pago</option>
              <option value="AL_DIA">Al Día</option>
              <option value="EN_MORA">Adeuda / En Mora</option>
              <option value="PAGADO_TOTAL">Total Pagado</option>
              <option value="BAJA">Baja</option>
            </select>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="border-b border-slate-800 bg-slate-950/60 text-slate-400">
              <th className="py-3 px-4 font-semibold">Participante</th>
              <th className="py-3 px-3 font-semibold">Rol</th>
              <th className="py-3 px-3 font-semibold">Grupo y Zona</th>
              <th className="py-3 px-3 font-semibold">Unidad / Territorium</th>
              <th className="py-3 px-3 font-semibold">Cuota & Abonos (USD)</th>
              <th className="py-3 px-3 font-semibold">Saldo Restante</th>
              <th className="py-3 px-3 font-semibold">Situación Financiera</th>
              <th className="py-3 px-4 font-semibold text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {loading ? (
              <tr>
                <td colSpan={8} className="py-12 text-center text-slate-400">
                  <Loader2 className="w-6 h-6 animate-spin text-indigo-500 mx-auto mb-2" />
                  Cargando nómina oficial...
                </td>
              </tr>
            ) : participants.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-12 text-center text-slate-500">
                  No se encontraron registros que coincidan con los filtros aplicados.
                </td>
              </tr>
            ) : (
              participants.map((p) => {
                const fin = p.financial;
                const roleBadge = getRoleBadge(p.contingentRole);

                const totalTarget = p.targetFeeUSD && p.targetFeeUSD > 0
                  ? p.targetFeeUSD
                  : fin.totalRequired;

                const percentage = totalTarget > 0
                  ? Math.min(100, Math.round((fin.totalPaid / totalTarget) * 100))
                  : 0;

                const remaining = Math.max(0, totalTarget - fin.totalPaid);

                return (
                  <tr
                    key={p.id}
                    className="hover:bg-slate-800/40 transition-colors group cursor-pointer"
                    onClick={() => onSelectParticipant(p.id)}
                  >
                    {/* Participant Details */}
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white group-hover:text-indigo-300 transition-colors">
                          {p.firstName} {p.lastName} {p.secondLastName || ''}
                        </span>
                        {p.cupoCode && (
                          <span className="px-1.5 py-0.2 rounded bg-indigo-950 border border-indigo-700/50 text-indigo-300 font-mono text-[9px] font-bold">
                            {p.cupoCode}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="font-mono text-[11px] text-slate-400 font-medium">
                          {p.rut}
                        </span>
                        <span className="text-[11px] text-slate-500 truncate max-w-[180px]">
                          • {p.email}
                        </span>
                      </div>
                    </td>

                    {/* Role */}
                    <td className="py-3 px-3">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold border ${roleBadge.class}`}
                      >
                        {roleBadge.label}
                      </span>
                    </td>

                    {/* Scout Group / Zone */}
                    <td className="py-3 px-3">
                      <div className="text-slate-300 font-medium truncate max-w-[170px]">
                        {p.scoutGroup || 'Sin Grupo'}
                      </div>
                      <div className="text-[10px] text-slate-500">
                        {p.scoutZone ? `Zona ${p.scoutZone}` : 'Sin Zona'}
                      </div>
                    </td>

                    {/* Unit / Territory */}
                    <td className="py-3 px-3">
                      <div className="text-slate-300 font-medium truncate max-w-[170px]">
                        {p.unitName || p.unit || 'Por asignar'}
                      </div>
                      <div className="text-[10px] text-slate-500">
                        {p.patrolName ? `Patrulla ${p.patrolName}` : ''}
                        {p.territorium ? ` • Territorio ${p.territorium}` : ''}
                      </div>
                    </td>

                    {/* Progress / Paid USD */}
                    <td className="py-3 px-3">
                      <div className="flex items-baseline justify-between text-[11px] mb-1">
                        <span className="font-bold font-mono text-emerald-400">
                          {formatUSD(fin.totalPaid)}
                        </span>
                        <span className="text-slate-400 font-mono">
                          / {formatUSD(totalTarget)}
                        </span>
                      </div>
                      <div className="w-24 bg-slate-800 rounded-full h-1.5 overflow-hidden">
                        <div
                          className={`h-1.5 rounded-full ${
                            percentage >= 100 ? 'bg-blue-500' : 'bg-emerald-500'
                          }`}
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </td>

                    {/* Pending Balance */}
                    <td className="py-3 px-3 font-mono font-bold text-slate-300">
                      {formatUSD(remaining)}
                    </td>

                    {/* Financial Badge */}
                    <td className="py-3 px-3">
                      {getFinancialBadge(p)}
                    </td>

                    {/* Actions */}
                    <td
                      className="py-3 px-4 text-right space-x-1"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        onClick={() => onSelectParticipant(p.id)}
                        title="Ver ficha y abonos"
                        className="p-1.5 text-slate-400 hover:text-indigo-400 hover:bg-indigo-950/40 rounded-lg transition-colors cursor-pointer"
                      >
                        <CreditCard className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => onEditParticipant(p)}
                        title="Editar participante"
                        className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() =>
                          handleDelete(p.id, `${p.firstName} ${p.lastName}`)
                        }
                        disabled={deletingId === p.id}
                        title="Eliminar participante"
                        className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-950/40 rounded-lg transition-colors cursor-pointer"
                      >
                        {deletingId === p.id ? (
                          <Loader2 className="w-4 h-4 animate-spin text-red-400" />
                        ) : (
                          <Trash2 className="w-4 h-4" />
                        )}
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
