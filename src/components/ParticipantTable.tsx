'use client';

import React, { useMemo, useState } from 'react';
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
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  X,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
} from 'lucide-react';
import { formatCurrency } from '@/lib/finance';
import { getRoleBadgeInfo } from '@/lib/roles';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useToast } from '@/components/ui/ToastProvider';
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
  totalCount?: number;
  page?: number;
  totalPages?: number;
  limit?: number;
  onPageChange?: (p: number) => void;
  onLimitChange?: (l: number) => void;
  medicalFilter?: string;
  setMedicalFilter?: (m: string) => void;
  sortBy?: string;
  setSortBy?: (s: string) => void;
  sortDir?: 'asc' | 'desc';
  setSortDir?: (d: 'asc' | 'desc') => void;
  onResetFilters?: () => void;
}

const ROLE_LABELS: Record<string, string> = {
  JOVEN: 'Jóvenes',
  DIRIGENTE: 'Dirigentes',
  IST: 'IST',
  CMT: 'CMT',
};

const STATUS_LABELS: Record<string, string> = {
  CONFIRMADO: 'Confirmados',
  PRE_INSCRITO: 'Preinscritos',
  RETIRADO: 'Bajas / Retirados',
};

const HEALTH_LABELS: Record<string, string> = {
  AL_DIA: 'Al Día',
  EN_MORA: 'En Mora',
  PAGADO_TOTAL: 'Total Pagado',
  BAJA: 'Baja',
};

const MEDICAL_LABELS: Record<string, string> = {
  COMPLETED: 'Ficha OK',
  PENDING: 'Ficha Pendiente',
  SEVERE_ALLERGY: 'Alergias Severas',
  EPIPEN: 'Porta EpiPen',
  COLD_CHAIN: 'Cadena de Frío',
};

function buildPageNumbers(current: number, total: number): Array<number | 'ellipsis'> {
  if (total <= 7) {
    return Array.from({ length: total }, (_, idx) => idx + 1);
  }

  const pages: Array<number | 'ellipsis'> = [1];
  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);

  if (start > 2) {
    pages.push('ellipsis');
  }

  for (let p = start; p <= end; p++) {
    pages.push(p);
  }

  if (end < total - 1) {
    pages.push('ellipsis');
  }

  pages.push(total);
  return pages;
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
  totalCount,
  page = 1,
  totalPages = 1,
  limit = 50,
  onPageChange,
  onLimitChange,
  medicalFilter = 'ALL',
  setMedicalFilter,
  sortBy = 'name',
  setSortBy,
  sortDir = 'asc',
  setSortDir,
  onResetFilters,
}: ParticipantTableProps) {
  const { toast } = useToast();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteTarget, setConfirmDeleteTarget] = useState<{
    id: string;
    name: string;
  } | null>(null);

  const canEditParticipants = !permissions || permissions.canEditParticipants;
  const canDeleteParticipants =
    !permissions || permissions.canDeleteParticipants || permissions.isEventAdmin;

  const effectiveTotal = totalCount ?? participants.length;
  const effectiveTotalPages = Math.max(1, totalPages);
  const effectivePage = Math.min(Math.max(1, page), effectiveTotalPages);
  const rangeStart =
    effectiveTotal === 0 || participants.length === 0
      ? 0
      : (effectivePage - 1) * limit + 1;
  const rangeEnd =
    effectiveTotal === 0 || participants.length === 0
      ? 0
      : Math.min(effectiveTotal, rangeStart + participants.length - 1);

  const hasActiveFilters =
    searchTerm.trim() !== '' ||
    roleFilter !== 'ALL' ||
    statusFilter !== 'ALL' ||
    healthFilter !== 'ALL' ||
    medicalFilter !== 'ALL';

  const activeChips = useMemo(() => {
    const chips: Array<{ key: string; label: string; onClear: () => void }> = [];
    if (searchTerm.trim()) {
      chips.push({
        key: 'search',
        label: `Búsqueda: "${searchTerm.trim()}"`,
        onClear: () => setSearchTerm(''),
      });
    }
    if (roleFilter !== 'ALL') {
      chips.push({
        key: 'role',
        label: `Rol: ${ROLE_LABELS[roleFilter] || roleFilter}`,
        onClear: () => setRoleFilter('ALL'),
      });
    }
    if (statusFilter !== 'ALL') {
      chips.push({
        key: 'status',
        label: `Estado: ${STATUS_LABELS[statusFilter] || statusFilter}`,
        onClear: () => setStatusFilter('ALL'),
      });
    }
    if (healthFilter !== 'ALL') {
      chips.push({
        key: 'health',
        label: `Finanzas: ${HEALTH_LABELS[healthFilter] || healthFilter}`,
        onClear: () => setHealthFilter('ALL'),
      });
    }
    if (medicalFilter !== 'ALL' && setMedicalFilter) {
      chips.push({
        key: 'medical',
        label: `Médico: ${MEDICAL_LABELS[medicalFilter] || medicalFilter}`,
        onClear: () => setMedicalFilter('ALL'),
      });
    }
    return chips;
  }, [
    searchTerm,
    roleFilter,
    statusFilter,
    healthFilter,
    medicalFilter,
    setSearchTerm,
    setRoleFilter,
    setStatusFilter,
    setHealthFilter,
    setMedicalFilter,
  ]);

  const handleClearAllFilters = () => {
    if (onResetFilters) {
      onResetFilters();
      return;
    }
    setSearchTerm('');
    setRoleFilter('ALL');
    setStatusFilter('ALL');
    setHealthFilter('ALL');
    setMedicalFilter?.('ALL');
  };

  const handleSort = (column: 'name' | 'paid' | 'remaining') => {
    if (!setSortBy || !setSortDir) return;
    if (sortBy === column) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortDir(column === 'name' ? 'asc' : 'desc');
    }
  };

  const renderSortIcon = (column: 'name' | 'paid' | 'remaining') => {
    if (sortBy !== column) {
      return <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />;
    }
    return sortDir === 'asc' ? (
      <ArrowUp className="w-3.5 h-3.5 text-[#001558]" />
    ) : (
      <ArrowDown className="w-3.5 h-3.5 text-[#001558]" />
    );
  };

  const executeDelete = async () => {
    if (!confirmDeleteTarget) return;
    const { id, name } = confirmDeleteTarget;

    try {
      setDeletingId(id);
      const res = await fetch(`/api/participants/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(
          typeof data.error === 'string' ? data.error : 'Error al eliminar participante'
        );
      }
      toast.success(`Participante ${name} eliminado correctamente.`);
      setConfirmDeleteTarget(null);
      onRefresh();
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Error al eliminar participante';
      toast.error(message, 'No se pudo eliminar');
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
    if (medicalFilter !== 'ALL') params.append('medical', medicalFilter);
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

  const computeParticipantMetrics = (p: ParticipantDTO) => {
    const fin = p.financial;
    const totalPaid = fin?.totalPaid ?? p.totalPaidSheet ?? 0;
    const totalRequired = fin?.totalRequired ?? 0;

    const totalTarget =
      p.targetFeeUSD !== null && p.targetFeeUSD !== undefined
        ? p.targetFeeUSD
        : totalRequired;

    const percentage =
      totalTarget > 0
        ? Math.min(100, Math.round((totalPaid / totalTarget) * 100))
        : p.status === 'RETIRADO'
          ? 0
          : 100;

    const remaining = Math.max(0, totalTarget - totalPaid);
    const isMedCompleted =
      p.medicalRecord?.completionStatus === 'COMPLETED' ||
      p.medicalRecord?.completionStatus === 'VERIFIED';

    return { totalPaid, totalTarget, percentage, remaining, isMedCompleted };
  };

  const pageNumbers = useMemo(
    () => buildPageNumbers(effectivePage, effectiveTotalPages),
    [effectivePage, effectiveTotalPages]
  );

  return (
    <>
      <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
        {/* Control & Filter Bar */}
        <div className="p-4 sm:p-5 border-b border-slate-200 space-y-3 bg-white">
          {/* Top bar: Title, Count, Range & Action Buttons */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base font-extrabold text-[#001558] flex items-center gap-2 tracking-tight">
                  Nómina Oficial del Contingente
                  <span className="px-2.5 py-0.5 rounded-full bg-[#EEF2FF] text-[#001558] border border-[#001558]/20 text-xs font-mono font-bold">
                    {effectiveTotal.toLocaleString('es-CL')} personas
                  </span>
                </h2>
                <button
                  type="button"
                  onClick={onRefresh}
                  title="Recargar datos"
                  aria-label="Recargar datos"
                  className="p-1.5 rounded-lg text-slate-500 hover:text-[#001558] hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                </button>
              </div>
              <p className="text-[11px] text-slate-500">
                Mostrando {rangeStart}–{rangeEnd} de{' '}
                {effectiveTotal.toLocaleString('es-CL')} participantes
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {canEditParticipants && (
                <button
                  type="button"
                  onClick={onOpenImport}
                  className="px-3 py-2 bg-white hover:bg-[#FFFBF0] text-[#001558] rounded-xl text-xs font-bold flex items-center gap-1.5 border border-slate-300 hover:border-[#FEB135] transition-all cursor-pointer"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-[#FEB135]" />
                  Importar Planilla
                </button>
              )}

              <button
                type="button"
                onClick={handleExport}
                className="px-3 py-2 bg-white hover:bg-slate-50 text-[#001558] rounded-xl text-xs font-bold flex items-center gap-1.5 border border-slate-300 transition-all cursor-pointer"
              >
                <Download className="w-3.5 h-3.5 text-[#001558]" />
                Exportar Nómina
              </button>

              {canEditParticipants && (
                <button
                  type="button"
                  onClick={onNewParticipant}
                  className="px-4 py-2 bg-[#FEB135] hover:bg-[#e59c22] active:bg-[#cc8610] text-[#001558] rounded-xl text-xs font-extrabold flex items-center gap-1.5 shadow-xs transition-all cursor-pointer uppercase tracking-wider"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  Nuevo Registro
                </button>
              )}
            </div>
          </div>

          {/* Filter Inputs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-2.5 pt-1">
            {/* Search Input */}
            <div className="sm:col-span-2 lg:col-span-4 relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <Search className="w-4 h-4" />
              </div>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar RUT, Nombre, Cupo (IST106), Grupo..."
                className="w-full pl-9 pr-8 py-2 bg-white border border-slate-300 rounded-xl text-slate-800 placeholder-slate-400 text-xs focus:border-[#001558] focus:ring-2 focus:ring-[#FEB135]/50 focus:outline-none transition-all"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  aria-label="Limpiar búsqueda"
                  className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Role Filter */}
            <div className="lg:col-span-2">
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                aria-label="Filtrar por rol"
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
            <div className="lg:col-span-2">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                aria-label="Filtrar por estado"
                className="w-full px-2.5 py-2 bg-white border border-slate-300 rounded-xl text-slate-800 text-xs focus:border-[#001558] focus:ring-2 focus:ring-[#FEB135]/50 focus:outline-none font-medium"
              >
                <option value="ALL">Todos los Estados</option>
                <option value="CONFIRMADO">Confirmados</option>
                <option value="PRE_INSCRITO">Preinscritos</option>
                <option value="RETIRADO">Bajas / Retirados</option>
              </select>
            </div>

            {/* Financial Health Filter */}
            <div className="lg:col-span-2">
              <select
                value={healthFilter}
                onChange={(e) => setHealthFilter(e.target.value)}
                aria-label="Filtrar por situación de pago"
                className="w-full px-2.5 py-2 bg-white border border-slate-300 rounded-xl text-slate-800 text-xs focus:border-[#001558] focus:ring-2 focus:ring-[#FEB135]/50 focus:outline-none font-medium"
              >
                <option value="ALL">Situación de Pago</option>
                <option value="AL_DIA">Al Día</option>
                <option value="EN_MORA">Adeuda / En Mora</option>
                <option value="PAGADO_TOTAL">Total Pagado</option>
                <option value="BAJA">Baja</option>
              </select>
            </div>

            {/* Medical Filter */}
            <div className="lg:col-span-2">
              <select
                value={medicalFilter}
                onChange={(e) => setMedicalFilter?.(e.target.value)}
                disabled={!setMedicalFilter}
                aria-label="Filtrar por ficha médica"
                className="w-full px-2.5 py-2 bg-white border border-slate-300 rounded-xl text-slate-800 text-xs focus:border-[#001558] focus:ring-2 focus:ring-[#FEB135]/50 focus:outline-none font-medium disabled:opacity-60"
              >
                <option value="ALL">Todas las fichas médicas</option>
                <option value="COMPLETED">Ficha OK</option>
                <option value="PENDING">Ficha Pendiente</option>
                <option value="SEVERE_ALLERGY">Alergias Severas</option>
                <option value="EPIPEN">Porta EpiPen</option>
                <option value="COLD_CHAIN">Cadena de Frío</option>
              </select>
            </div>
          </div>

          {/* Active filter chips & Reset button */}
          {hasActiveFilters && (
            <div className="flex flex-wrap items-center gap-2 pt-1">
              {activeChips.map((chip) => (
                <span
                  key={chip.key}
                  className="inline-flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 rounded-full bg-[#FFF8E1] border border-[#FEB135] text-[#001558] text-[11px] font-bold"
                >
                  <span>{chip.label}</span>
                  <button
                    type="button"
                    onClick={chip.onClear}
                    aria-label={`Quitar filtro ${chip.label}`}
                    className="p-0.5 rounded-full hover:bg-[#FEB135]/30 text-[#001558] transition-colors cursor-pointer"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}

              <button
                type="button"
                onClick={handleClearAllFilters}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                Limpiar filtros
              </button>
            </div>
          )}
        </div>

        {/* Mobile Card View (< md) */}
        <div className="md:hidden divide-y divide-slate-200">
          {loading ? (
            <div className="p-4 space-y-3" aria-busy="true">
              {[0, 1, 2, 3].map((idx) => (
                <div
                  key={idx}
                  className="p-4 rounded-xl border border-slate-200 bg-white space-y-3 animate-pulse"
                >
                  <div className="flex justify-between gap-2">
                    <div className="h-4 w-40 bg-slate-200 rounded" />
                    <div className="h-5 w-20 bg-slate-100 rounded-full" />
                  </div>
                  <div className="h-3 w-32 bg-slate-100 rounded" />
                  <div className="h-2 w-full bg-slate-100 rounded-full" />
                </div>
              ))}
            </div>
          ) : participants.length === 0 ? (
            <div className="py-12 px-4 text-center text-xs text-slate-500">
              No se encontraron registros que coincidan con los filtros aplicados.
            </div>
          ) : (
            participants.map((p) => {
              const roleBadge = getRoleBadgeInfo(p.contingentRole);
              const { totalPaid, totalTarget, percentage, remaining, isMedCompleted } =
                computeParticipantMetrics(p);

              return (
                <div
                  key={p.id}
                  onClick={() => onSelectParticipant(p.id)}
                  className="p-4 hover:bg-[#FFFBF0]/60 transition-colors cursor-pointer space-y-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-extrabold text-sm text-[#001558]">
                          {p.firstName} {p.lastName} {p.secondLastName || ''}
                        </span>
                        {p.cupoCode && (
                          <span className="px-1.5 py-0.5 rounded bg-[#FFF8E1] border border-[#FEB135] text-[#001558] font-mono text-[10px] font-bold">
                            {p.cupoCode}
                          </span>
                        )}
                      </div>
                      <p className="font-mono text-[11px] text-slate-600 mt-0.5">
                        {p.rut}
                        {p.email ? ` • ${p.email}` : ''}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold border ${roleBadge.className}`}
                    >
                      {roleBadge.label}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    {getFinancialBadge(p)}
                    {isMedCompleted ? (
                      <span className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded bg-emerald-50 border border-emerald-200 text-emerald-800 font-bold">
                        🩺 Ficha OK
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200 text-slate-600 font-medium">
                        🩺 Pendiente
                      </span>
                    )}
                    {p.medicalRecord?.hasSevereAllergies && (
                      <span className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded bg-red-50 border border-red-200 text-red-700 font-bold">
                        ⚠️ Alergia Severa
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[11px] bg-[#F5F6F8] rounded-xl p-2.5 border border-slate-200/70">
                    <div>
                      <span className="text-slate-500 block text-[10px]">Grupo / Zona</span>
                      <span className="font-bold text-slate-800 truncate block">
                        {p.scoutGroup || 'Sin Grupo'}
                      </span>
                      <span className="text-slate-500 text-[10px]">
                        {p.scoutZone ? `Zona ${p.scoutZone}` : 'Sin Zona'}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[10px]">Unidad</span>
                      <span className="font-semibold text-slate-800 truncate block">
                        {p.unitName || p.unit || 'Por asignar'}
                      </span>
                      {p.patrolName && (
                        <span className="text-[#001558]/80 text-[10px]">
                          Patrulla {p.patrolName}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-mono font-extrabold text-[#001558]">
                        {formatCurrency(totalPaid, currency)}{' '}
                        <span className="font-normal text-slate-500">
                          / {formatCurrency(totalTarget, currency)}
                        </span>
                      </span>
                      <span className="font-mono text-[11px] font-bold text-slate-700">
                        Saldo: {formatCurrency(remaining, currency)}
                      </span>
                    </div>
                    <div className="w-full bg-[#F1F5F9] rounded-full h-2 overflow-hidden border border-slate-200">
                      <div
                        className="h-2 rounded-full bg-[#FEB135]"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>

                  <div
                    className="flex items-center justify-end gap-2 pt-1"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      type="button"
                      onClick={() => onSelectParticipant(p.id)}
                      className="px-2.5 py-1.5 rounded-lg bg-[#EEF2FF] text-[#001558] text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                    >
                      <CreditCard className="w-3.5 h-3.5" />
                      Ver ficha
                    </button>
                    {canEditParticipants && (
                      <button
                        type="button"
                        onClick={() => onEditParticipant(p)}
                        className="px-2.5 py-1.5 rounded-lg bg-slate-100 text-slate-700 text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                        Editar
                      </button>
                    )}
                    {canDeleteParticipants && (
                      <button
                        type="button"
                        onClick={() =>
                          setConfirmDeleteTarget({
                            id: p.id,
                            name: `${p.firstName} ${p.lastName}`,
                          })
                        }
                        disabled={deletingId === p.id}
                        aria-label={`Eliminar a ${p.firstName} ${p.lastName}`}
                        className="p-1.5 rounded-lg text-red-600 hover:bg-red-50 cursor-pointer disabled:opacity-50"
                      >
                        {deletingId === p.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Trash2 className="w-4 h-4" />
                        )}
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Desktop Table View (>= md) */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-[#F5F6F8] text-slate-600">
                <th
                  className="py-3 px-4 font-bold uppercase tracking-wider text-[11px]"
                  aria-sort={
                    sortBy === 'name'
                      ? sortDir === 'asc'
                        ? 'ascending'
                        : 'descending'
                      : 'none'
                  }
                >
                  <button
                    type="button"
                    onClick={() => handleSort('name')}
                    className="inline-flex items-center gap-1.5 hover:text-[#001558] transition-colors cursor-pointer uppercase"
                  >
                    <span>Participante</span>
                    {renderSortIcon('name')}
                  </button>
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
                <th
                  className="py-3 px-3 font-bold uppercase tracking-wider text-[11px]"
                  aria-sort={
                    sortBy === 'paid'
                      ? sortDir === 'asc'
                        ? 'ascending'
                        : 'descending'
                      : 'none'
                  }
                >
                  <button
                    type="button"
                    onClick={() => handleSort('paid')}
                    className="inline-flex items-center gap-1.5 hover:text-[#001558] transition-colors cursor-pointer uppercase"
                  >
                    <span>Cuota &amp; Abonos ({currency})</span>
                    {renderSortIcon('paid')}
                  </button>
                </th>
                <th
                  className="py-3 px-3 font-bold uppercase tracking-wider text-[11px]"
                  aria-sort={
                    sortBy === 'remaining'
                      ? sortDir === 'asc'
                        ? 'ascending'
                        : 'descending'
                      : 'none'
                  }
                >
                  <button
                    type="button"
                    onClick={() => handleSort('remaining')}
                    className="inline-flex items-center gap-1.5 hover:text-[#001558] transition-colors cursor-pointer uppercase"
                  >
                    <span>Saldo Restante</span>
                    {renderSortIcon('remaining')}
                  </button>
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
                Array.from({ length: 6 }).map((_, idx) => (
                  <tr key={idx} className="animate-pulse">
                    <td className="py-3.5 px-4">
                      <div className="h-3.5 w-40 bg-slate-200 rounded mb-1.5" />
                      <div className="h-3 w-28 bg-slate-100 rounded" />
                    </td>
                    <td className="py-3.5 px-3">
                      <div className="h-5 w-24 bg-slate-100 rounded-full" />
                    </td>
                    <td className="py-3.5 px-3">
                      <div className="h-3.5 w-28 bg-slate-200 rounded mb-1" />
                      <div className="h-2.5 w-20 bg-slate-100 rounded" />
                    </td>
                    <td className="py-3.5 px-3">
                      <div className="h-3.5 w-24 bg-slate-200 rounded mb-1" />
                      <div className="h-2.5 w-16 bg-slate-100 rounded" />
                    </td>
                    <td className="py-3.5 px-3">
                      <div className="h-3 w-24 bg-slate-200 rounded mb-1.5" />
                      <div className="h-2 w-24 bg-slate-100 rounded-full" />
                    </td>
                    <td className="py-3.5 px-3">
                      <div className="h-3.5 w-16 bg-slate-200 rounded" />
                    </td>
                    <td className="py-3.5 px-3">
                      <div className="h-5 w-24 bg-slate-100 rounded-full" />
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="h-6 w-20 bg-slate-100 rounded ml-auto" />
                    </td>
                  </tr>
                ))
              ) : participants.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-500">
                    No se encontraron registros que coincidan con los filtros aplicados.
                  </td>
                </tr>
              ) : (
                participants.map((p) => {
                  const roleBadge = getRoleBadgeInfo(p.contingentRole);
                  const { totalPaid, totalTarget, percentage, remaining, isMedCompleted } =
                    computeParticipantMetrics(p);

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
                          type="button"
                          onClick={() => onSelectParticipant(p.id)}
                          title="Ver ficha y abonos"
                          className="p-1.5 text-slate-500 hover:text-[#001558] hover:bg-[#EEF2FF] rounded-lg transition-colors cursor-pointer"
                        >
                          <CreditCard className="w-4 h-4" />
                        </button>

                        {canEditParticipants && (
                          <button
                            type="button"
                            onClick={() => onEditParticipant(p)}
                            title="Editar participante"
                            className="p-1.5 text-slate-500 hover:text-[#001558] hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                        )}

                        {canDeleteParticipants && (
                          <button
                            type="button"
                            onClick={() =>
                              setConfirmDeleteTarget({
                                id: p.id,
                                name: `${p.firstName} ${p.lastName}`,
                              })
                            }
                            disabled={deletingId === p.id}
                            title="Eliminar participante"
                            className="p-1.5 text-slate-400 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
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

        {/* Pagination Footer */}
        <div className="px-4 sm:px-5 py-3.5 bg-[#F5F6F8] border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-3 text-slate-600">
            <span>
              Mostrando <strong className="text-[#001558]">{rangeStart}</strong>–
              <strong className="text-[#001558]">{rangeEnd}</strong> de{' '}
              <strong className="text-[#001558]">
                {effectiveTotal.toLocaleString('es-CL')}
              </strong>{' '}
              participantes
            </span>

            {onLimitChange && (
              <label className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-600">
                <span>Filas:</span>
                <select
                  value={limit}
                  onChange={(e) => onLimitChange(Number(e.target.value))}
                  aria-label="Filas por página"
                  className="px-2 py-1 bg-white border border-slate-300 rounded-lg text-xs font-bold text-[#001558] focus:border-[#001558] focus:outline-none"
                >
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </label>
            )}
          </div>

          {onPageChange && (
            <div className="flex items-center gap-1 flex-wrap">
              <button
                type="button"
                onClick={() => onPageChange(effectivePage - 1)}
                disabled={effectivePage <= 1 || loading}
                className="px-2.5 py-1.5 rounded-lg bg-white border border-slate-300 text-slate-700 font-bold text-[11px] inline-flex items-center gap-1 hover:bg-slate-100 disabled:opacity-45 disabled:cursor-not-allowed cursor-pointer transition-colors"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                Anterior
              </button>

              {pageNumbers.map((item, idx) =>
                item === 'ellipsis' ? (
                  <span key={`ellipsis-${idx}`} className="px-1.5 text-slate-400 font-bold">
                    …
                  </span>
                ) : (
                  <button
                    key={item}
                    type="button"
                    onClick={() => onPageChange(item)}
                    disabled={loading}
                    aria-current={item === effectivePage ? 'page' : undefined}
                    className={`min-w-7 h-7 px-2 rounded-lg text-[11px] font-bold border transition-colors cursor-pointer ${
                      item === effectivePage
                        ? 'bg-[#001558] text-white border-[#001558]'
                        : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                    }`}
                  >
                    {item}
                  </button>
                )
              )}

              <button
                type="button"
                onClick={() => onPageChange(effectivePage + 1)}
                disabled={effectivePage >= effectiveTotalPages || loading}
                className="px-2.5 py-1.5 rounded-lg bg-white border border-slate-300 text-slate-700 font-bold text-[11px] inline-flex items-center gap-1 hover:bg-slate-100 disabled:opacity-45 disabled:cursor-not-allowed cursor-pointer transition-colors"
              >
                Siguiente
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>

      <ConfirmDialog
        isOpen={Boolean(confirmDeleteTarget)}
        variant="danger"
        title="Eliminar participante"
        description={
          confirmDeleteTarget
            ? `¿Estás seguro de eliminar a ${confirmDeleteTarget.name}? Se borrarán también sus registros de pagos y ficha asociada.`
            : ''
        }
        confirmLabel="Eliminar"
        cancelLabel="Cancelar"
        loading={deletingId !== null}
        onConfirm={executeDelete}
        onCancel={() => {
          if (!deletingId) {
            setConfirmDeleteTarget(null);
          }
        }}
      />
    </>
  );
}
