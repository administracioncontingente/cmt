'use client';

import React, { useState } from 'react';
import {
  Search,
  UserPlus,
  FileSpreadsheet,
  Download,
  CreditCard,
  Edit2,
  Trash2,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Loader2,
} from 'lucide-react';
import { formatCurrency } from '@/lib/finance';
import { getRoleBadgeInfo } from '@/lib/roles';
import type { EventPermissions, ParticipantDTO } from '@/types/domain';

interface ParticipantTableProps {
  participants: ParticipantDTO[];
  loading: boolean;
  currency?: string;
  permissions?: EventPermissions | null;
  onRefresh: () => void;
  onSelectParticipant: (id: string) => void;
  onEditParticipant: (participant: ParticipantDTO) => void;
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
  currency = 'USD',
  permissions,
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

  const canEditParticipants = !permissions || permissions.canEditParticipants;
  const canDeleteParticipants = !permissions || permissions.isEventAdmin;

  const handleDelete = async (id: string, name: string) => {
    if (
      !confirm(
        `¿Estás seguro de eliminar al participante ${name}? Se borrarán también sus registros de pagos asociados.`
      )
    ) {
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
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Error al eliminar participante';
      alert(message);
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

  const getFinancialBadge = (p: ParticipantDTO) => {
    const sheetStatus = p.financialStatusSheet;
    const fin = p.financial;

    if (sheetStatus === 'Total Pagado' || fin?.isFullyPaid) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#FFF8E1] text-[#001558] border border-[#FEB135]">
          <CheckCircle2 className="w-3 h-3 text-[#001558]" />
          Total Pagado
        </span>
      );
    }

    if (sheetStatus === 'BAJA' || p.status === 'RETIRADO') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
          BAJA / Retirado
        </span>
      );
    }

    if (
      sheetStatus === 'Adeuda' ||
      fin?.isOverdue ||
      (p.debtToDateUSD && p.debtToDateUSD > 0)
    ) {
      const overdue = p.debtToDateUSD || fin?.overdueAmount || 0;
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-red-50 text-red-700 border border-red-200">
          <AlertCircle className="w-3 h-3 text-red-600" />
          Adeuda {overdue > 0 ? `(${formatCurrency(overdue, currency)})` : ''}
        </span>
      );
    }

    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
        Al Día
      </span>
    );
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
      {/* Control & Filter Bar */}
      <div className="p-4 sm:p-5 border-b border-slate-200 space-y-3 bg-white">
        {/* Top bar: Action Buttons */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-extrabold text-[#001558] flex items-center gap-2 tracking-tight">
              Nómina Oficial del Contingente
              <span className="px-2.5 py-0.5 rounded-full bg-[#EEF2FF] text-[#001558] border border-[#001558]/20 text-xs font-mono font-bold">
                {participants.length} personas
              </span>
            </h2>
            <button
              onClick={onRefresh}
              title="Recargar datos"
              className="p-1.5 rounded-lg text-slate-500 hover:text-[#001558] hover:bg-slate-100 transition-colors cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {canEditParticipants && (
              <button
                onClick={onOpenImport}
                className="px-3 py-2 bg-white hover:bg-[#FFFBF0] text-[#001558] rounded-xl text-xs font-bold flex items-center gap-1.5 border border-slate-300 hover:border-[#FEB135] transition-all cursor-pointer"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-[#FEB135]" />
                Importar Planilla
              </button>
            )}

            <button
              onClick={handleExport}
              className="px-3 py-2 bg-white hover:bg-slate-50 text-[#001558] rounded-xl text-xs font-bold flex items-center gap-1.5 border border-slate-300 transition-all cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-[#001558]" />
              Exportar Nómina
            </button>

            {canEditParticipants && (
              <button
                onClick={onNewParticipant}
                className="px-4 py-2 bg-[#FEB135] hover:bg-[#e59c22] active:bg-[#cc8610] text-[#001558] rounded-xl text-xs font-extrabold flex items-center gap-1.5 shadow-xs transition-all cursor-pointer uppercase tracking-wider"
              >
                <UserPlus className="w-3.5 h-3.5" />
                Nuevo Registro
              </button>
            )}
          </div>
        </div>

        {/* Bottom bar: Filters and Search */}
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 pt-1">
          {/* Search Input */}
          <div className="sm:col-span-5 relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
              <Search className="w-4 h-4" />
            </div>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por RUT, Nombre, Código Cupo (IST106), Grupo o Unidad..."
              className="w-full pl-9 pr-3 py-2 bg-white border border-slate-300 rounded-xl text-slate-800 placeholder-slate-400 text-xs focus:border-[#001558] focus:ring-2 focus:ring-[#FEB135]/50 focus:outline-none transition-all"
            />
          </div>

          {/* Role Filter */}
          <div className="sm:col-span-2">
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="w-full px-2.5 py-2 bg-white border border-slate-300 rounded-xl text-slate-800 text-xs focus:border-[#001558] focus:ring-2 focus:ring-[#FEB135]/50 focus:outline-none font-medium"
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
              className="w-full px-2.5 py-2 bg-white border border-slate-300 rounded-xl text-slate-800 text-xs focus:border-[#001558] focus:ring-2 focus:ring-[#FEB135]/50 focus:outline-none font-medium"
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
              className="w-full px-2.5 py-2 bg-white border border-slate-300 rounded-xl text-slate-800 text-xs focus:border-[#001558] focus:ring-2 focus:ring-[#FEB135]/50 focus:outline-none font-medium"
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
            <tr className="border-b border-slate-200 bg-[#F5F6F8] text-slate-600">
              <th className="py-3 px-4 font-bold uppercase tracking-wider text-[11px]">
                Participante
              </th>
              <th className="py-3 px-3 font-bold uppercase tracking-wider text-[11px]">
                Rol
              </th>
              <th className="py-3 px-3 font-bold uppercase tracking-wider text-[11px]">
                Grupo y Zona AGSCH
              </th>
              <th className="py-3 px-3 font-bold uppercase tracking-wider text-[11px]">
                Asignación / Unidad
              </th>
              <th className="py-3 px-3 font-bold uppercase tracking-wider text-[11px]">
                Cuota &amp; Abonos ({currency})
              </th>
              <th className="py-3 px-3 font-bold uppercase tracking-wider text-[11px]">
                Saldo Restante
              </th>
              <th className="py-3 px-3 font-bold uppercase tracking-wider text-[11px]">
                Situación Financiera
              </th>
              <th className="py-3 px-4 font-bold uppercase tracking-wider text-[11px] text-right">
                Acciones
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {loading ? (
              <tr>
                <td colSpan={8} className="py-12 text-center text-slate-500">
                  <Loader2 className="w-6 h-6 animate-spin text-[#001558] mx-auto mb-2" />
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
                const roleBadge = getRoleBadgeInfo(p.contingentRole);
                const totalPaid = fin?.totalPaid ?? p.totalPaidSheet ?? 0;
                const totalRequired = fin?.totalRequired ?? 0;

                const totalTarget =
                  p.targetFeeUSD && p.targetFeeUSD > 0 ? p.targetFeeUSD : totalRequired;

                const percentage =
                  totalTarget > 0
                    ? Math.min(100, Math.round((totalPaid / totalTarget) * 100))
                    : 0;

                const remaining = Math.max(0, totalTarget - totalPaid);
                const isMedCompleted =
                  p.medicalRecord?.completionStatus === 'COMPLETED' ||
                  p.medicalRecord?.completionStatus === 'VERIFIED';

                return (
                  <tr
                    key={p.id}
                    className="hover:bg-[#FFFBF0]/60 transition-colors group cursor-pointer"
                    onClick={() => onSelectParticipant(p.id)}
                  >
                    {/* Participant Details */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-[#001558] group-hover:text-[#0b2370] transition-colors">
                          {p.firstName} {p.lastName} {p.secondLastName || ''}
                        </span>
                        {p.cupoCode && (
                          <span className="px-1.5 py-0.5 rounded bg-[#FFF8E1] border border-[#FEB135] text-[#001558] font-mono text-[10px] font-bold">
                            {p.cupoCode}
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5 mt-1">
                        <span className="font-mono text-[11px] text-slate-700 font-semibold">
                          {p.rut}
                        </span>
                        {p.email && (
                          <span className="text-[11px] text-slate-500 truncate max-w-[150px]">
                            • {p.email}
                          </span>
                        )}
                        {isMedCompleted ? (
                          <span
                            className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded bg-emerald-50 border border-emerald-200 text-emerald-800 font-bold"
                            title="Ficha Médica Completada"
                          >
                            🩺 Ficha OK
                          </span>
                        ) : (
                          <span
                            className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200 text-slate-600 font-medium"
                            title="Ficha Médica Pendiente"
                          >
                            🩺 Pendiente
                          </span>
                        )}
                        {p.medicalRecord?.hasSevereAllergies && (
                          <span
                            className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded bg-red-50 border border-red-200 text-red-700 font-bold"
                            title="Alerta: Alergia Severa / Anafilaxia"
                          >
                            ⚠️ Alergia Severa
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Role */}
                    <td className="py-3.5 px-3">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${roleBadge.className}`}
                      >
                        {roleBadge.label}
                      </span>
                    </td>

                    {/* Scout Group / Zone */}
                    <td className="py-3.5 px-3">
                      <div className="text-slate-800 font-bold truncate max-w-[170px]">
                        {p.scoutGroup || 'Sin Grupo'}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        {p.scoutZone ? `Zona ${p.scoutZone}` : 'Sin Zona'}
                      </div>
                    </td>

                    {/* Unit / Territory */}
                    <td className="py-3.5 px-3">
                      <div className="text-slate-800 font-semibold truncate max-w-[170px]">
                        {p.unitName || p.unit || 'Por asignar'}
                      </div>
                      <div className="text-[11px] text-[#001558]/80 font-medium">
                        {p.patrolName ? `Patrulla ${p.patrolName}` : ''}
                        {p.territorium ? ` • Territorio ${p.territorium}` : ''}
                      </div>
                    </td>

                    {/* Progress / Paid */}
                    <td className="py-3.5 px-3">
                      <div className="flex items-baseline justify-between gap-2 text-[11px] mb-1">
                        <span className="font-extrabold font-mono text-[#001558]">
                          {formatCurrency(totalPaid, currency)}
                        </span>
                        <span className="text-slate-500 font-mono">
                          / {formatCurrency(totalTarget, currency)}
                        </span>
                      </div>
                      <div className="w-24 bg-[#F1F5F9] rounded-full h-2 overflow-hidden border border-slate-200">
                        <div
                          className="h-2 rounded-full bg-[#FEB135]"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </td>

                    {/* Pending Balance */}
                    <td className="py-3.5 px-3 font-mono font-bold text-slate-800">
                      {formatCurrency(remaining, currency)}
                    </td>

                    {/* Financial Badge */}
                    <td className="py-3.5 px-3">{getFinancialBadge(p)}</td>

                    {/* Actions */}
                    <td
                      className="py-3.5 px-4 text-right space-x-1 whitespace-nowrap"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        onClick={() => onSelectParticipant(p.id)}
                        title="Ver ficha y abonos"
                        className="p-1.5 text-slate-500 hover:text-[#001558] hover:bg-[#EEF2FF] rounded-lg transition-colors cursor-pointer"
                      >
                        <CreditCard className="w-4 h-4" />
                      </button>

                      {canEditParticipants && (
                        <button
                          onClick={() => onEditParticipant(p)}
                          title="Editar participante"
                          className="p-1.5 text-slate-500 hover:text-[#001558] hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                      )}

                      {canDeleteParticipants && (
                        <button
                          onClick={() =>
                            handleDelete(p.id, `${p.firstName} ${p.lastName}`)
                          }
                          disabled={deletingId === p.id}
                          title="Eliminar participante"
                          className="p-1.5 text-slate-400 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                        >
                          {deletingId === p.id ? (
                            <Loader2 className="w-4 h-4 animate-spin text-red-600" />
                          ) : (
                            <Trash2 className="w-4 h-4" />
                          )}
                        </button>
                      )}
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
