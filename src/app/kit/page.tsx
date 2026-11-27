'use client';

import React, { useCallback, useEffect, useId, useMemo, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardCopy,
  Clock,
  Download,
  FilterX,
  Layers,
  Loader2,
  PackageCheck,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Shirt,
  Users,
  X,
} from 'lucide-react';
import { AppShell, useAppShell } from '@/components/AppShell';
import { ParticipantDetailModal } from '@/components/ParticipantDetailModal';
import { useToast } from '@/components/ui/ToastProvider';
import type {
  EventKitItemDTO,
  KitItemSummaryDTO,
  KitMatrixCellDTO,
  KitMatrixSummaryDTO,
  KitParticipantRowDTO,
} from '@/types/domain';

type KitPageTab = 'supplier' | 'participants';
type KitStatusFilter = 'ALL' | 'COMPLETED' | 'PARTIAL' | 'PENDING';
type KitCategory = 'SUPERIOR' | 'ABRIGO' | 'INFERIOR' | 'ACCESORIO';

const PAGE_SIZE = 50;

const EMPTY_SUMMARY: KitMatrixSummaryDTO = {
  items: [],
  totalsByItem: [],
  completedParticipants: 0,
  partialParticipants: 0,
  pendingParticipants: 0,
  totalActiveParticipants: 0,
  participants: [],
};

const STANDARD_SIZE_ORDER = [
  'XXS',
  'XS',
  'S',
  'M',
  'L',
  'XL',
  '2XL',
  'XXL',
  '3XL',
  'XXXL',
  '4XL',
  'S/M (55-57 cm)',
  'L/XL (58-61 cm)',
];

const FIT_ORDER = ['Unisex / Recto', 'Entallado', 'Estándar'];

const CATEGORY_OPTIONS: { value: KitCategory; label: string }[] = [
  { value: 'SUPERIOR', label: 'Superior (Poleras, Camisas)' },
  { value: 'ABRIGO', label: 'Abrigo (Polerones, Chaquetas)' },
  { value: 'INFERIOR', label: 'Inferior (Pantalones, Shorts)' },
  { value: 'ACCESORIO', label: 'Accesorio (Gorros, Otros)' },
];

const CATEGORY_META: Record<string, { label: string; className: string }> = {
  SUPERIOR: {
    label: 'Superior',
    className: 'bg-[#EEF2FF] text-[#001558] border-[#001558]/20',
  },
  ABRIGO: {
    label: 'Abrigo',
    className: 'bg-sky-50 text-sky-800 border-sky-200',
  },
  INFERIOR: {
    label: 'Inferior',
    className: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  },
  ACCESORIO: {
    label: 'Accesorio',
    className: 'bg-[#FFF8E1] text-[#001558] border-[#FEB135]',
  },
};

const STATUS_FILTER_OPTIONS: { value: KitStatusFilter; label: string }[] = [
  { value: 'ALL', label: 'Todos los estados' },
  { value: 'COMPLETED', label: 'Tallas Completas' },
  { value: 'PARTIAL', label: 'Parciales' },
  { value: 'PENDING', label: 'Pendientes' },
];

const KIT_STATUS_META: Record<
  KitParticipantRowDTO['kitStatus'],
  { label: string; className: string }
> = {
  COMPLETED: {
    label: 'Tallas Completas',
    className: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  },
  PARTIAL: {
    label: 'Parcial',
    className: 'bg-[#FFF8E1] text-[#001558] border-[#FEB135]',
  },
  PENDING: {
    label: 'Pendiente',
    className: 'bg-slate-100 text-slate-600 border-slate-200',
  },
};

function getSizeRank(size: string, availableSizes: string[]): number {
  const itemIdx = availableSizes.indexOf(size);
  if (itemIdx !== -1) return itemIdx;
  const stdIdx = STANDARD_SIZE_ORDER.indexOf(size.toUpperCase());
  if (stdIdx !== -1) return 100 + stdIdx;
  return 1000;
}

function getFitRank(fit: string): number {
  const normalized = fit || 'Estándar';
  const idx = FIT_ORDER.indexOf(normalized);
  return idx !== -1 ? idx : 100;
}

function sortBreakdownRows(
  breakdown: KitMatrixCellDTO[],
  availableSizes: string[]
): KitMatrixCellDTO[] {
  return [...breakdown].sort((a, b) => {
    const sizeDiff =
      getSizeRank(a.size, availableSizes) - getSizeRank(b.size, availableSizes);
    if (sizeDiff !== 0) return sizeDiff;
    const sizeLabelDiff = a.size.localeCompare(b.size, 'es');
    if (sizeLabelDiff !== 0) return sizeLabelDiff;

    const fitA = a.fit || 'Estándar';
    const fitB = b.fit || 'Estándar';
    const fitDiff = getFitRank(fitA) - getFitRank(fitB);
    if (fitDiff !== 0) return fitDiff;
    return fitA.localeCompare(fitB, 'es');
  });
}

function parseCommaList(raw: string): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const part of raw.split(',')) {
    const trimmed = part.trim();
    if (trimmed && !seen.has(trimmed)) {
      seen.add(trimmed);
      result.push(trimmed);
    }
  }
  return result;
}

function escapeCsvCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '';
  let str = String(value);
  if (typeof value === 'string' && /^[=+\-@\t\r]/.test(str)) {
    str = `'${str}`;
  }
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function normalizeKitResponse(
  raw: KitMatrixSummaryDTO | { summary?: KitMatrixSummaryDTO }
): KitMatrixSummaryDTO {
  if (raw && typeof raw === 'object' && 'totalsByItem' in raw && Array.isArray(raw.totalsByItem)) {
    return raw;
  }
  if (raw && typeof raw === 'object' && 'summary' in raw && raw.summary) {
    return raw.summary;
  }
  return EMPTY_SUMMARY;
}

function KitWorkspace() {
  const { activeEvent, permissions, currency, eventVersion, refreshStats } =
    useAppShell();
  const { toast } = useToast();
  const modalTitleId = useId();

  const [summary, setSummary] = useState<KitMatrixSummaryDTO>(EMPTY_SUMMARY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadTick, setReloadTick] = useState(0);
  const [includeInactive, setIncludeInactive] = useState(false);

  const [activeTab, setActiveTab] = useState<KitPageTab>('supplier');
  const [searchInput, setSearchInput] = useState('');
  const [statusFilter, setStatusFilter] = useState<KitStatusFilter>('ALL');
  const [page, setPage] = useState(1);

  const [selectedParticipantId, setSelectedParticipantId] = useState<string | null>(null);

  // Modal state for creating/editing kit items
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<EventKitItemDTO | null>(null);
  const [formCode, setFormCode] = useState('');
  const [formName, setFormName] = useState('');
  const [formCategory, setFormCategory] = useState<KitCategory>('SUPERIOR');
  const [formDescription, setFormDescription] = useState('');
  const [formSizes, setFormSizes] = useState('XS, S, M, L, XL, 2XL, 3XL');
  const [formFits, setFormFits] = useState('Unisex / Recto, Entallado');
  const [formIncludedQty, setFormIncludedQty] = useState('1');
  const [formIsRequired, setFormIsRequired] = useState(true);
  const [formIsActive, setFormIsActive] = useState(true);
  const [formSortOrder, setFormSortOrder] = useState('1');
  const [savingItem, setSavingItem] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  const canManageKit = Boolean(
    permissions?.isEventAdmin || permissions?.canEditParticipants
  );

  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;

    const run = async () => {
      await Promise.resolve();
      if (cancelled) return;
      setLoading(true);
      setError(null);

      try {
        const url = includeInactive
          ? '/api/kit?includeInactive=true'
          : '/api/kit';
        const res = await fetch(url, { signal: controller.signal });
        if (!res.ok) {
          const errBody = (await res.json().catch(() => ({}))) as {
            error?: string;
          };
          throw new Error(
            errBody.error || 'No se pudo cargar la matriz de tallas del kit'
          );
        }

        const raw = (await res.json()) as
          | KitMatrixSummaryDTO
          | { summary?: KitMatrixSummaryDTO };
        if (cancelled) return;

        setSummary(normalizeKitResponse(raw));
      } catch (err: unknown) {
        if (
          !cancelled &&
          !(err instanceof DOMException && err.name === 'AbortError')
        ) {
          setError(
            err instanceof Error
              ? err.message
              : 'Error inesperado al cargar la información del kit'
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
  }, [eventVersion, reloadTick, includeInactive]);

  const handleCloseModal = useCallback(() => {
    if (savingItem) return;
    setModalOpen(false);
    setEditingItem(null);
    setModalError(null);
  }, [savingItem]);

  useEffect(() => {
    if (!modalOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !savingItem) {
        handleCloseModal();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [modalOpen, savingItem, handleCloseModal]);

  const handleReload = useCallback(() => {
    setReloadTick((t) => t + 1);
    void refreshStats();
  }, [refreshStats]);

  const handleCopyPortalLink = useCallback(async () => {
    const origin =
      typeof window !== 'undefined' ? window.location.origin : '';
    const portalUrl = `${origin}/portal`;
    try {
      await navigator.clipboard.writeText(portalUrl);
      toast.success(
        `Enlace ${portalUrl} copiado al portapapeles para difundir a participantes.`,
        'Enlace Portal Copiado'
      );
    } catch {
      toast.error(
        'No se pudo copiar el enlace al portapapeles. Intenta nuevamente.',
        'Error al copiar'
      );
    }
  }, [toast]);

  const openCreateModal = useCallback(() => {
    setEditingItem(null);
    setFormCode('');
    setFormName('');
    setFormCategory('SUPERIOR');
    setFormDescription('');
    setFormSizes('XS, S, M, L, XL, 2XL, 3XL');
    setFormFits('Unisex / Recto, Entallado');
    setFormIncludedQty('1');
    setFormIsRequired(true);
    setFormIsActive(true);
    setFormSortOrder(String(summary.items.length + 1));
    setModalError(null);
    setModalOpen(true);
  }, [summary.items.length]);

  const openEditModal = useCallback((item: EventKitItemDTO) => {
    const normalizedCategory = (item.category || 'SUPERIOR').toUpperCase();
    const safeCategory: KitCategory =
      normalizedCategory === 'ABRIGO' ||
      normalizedCategory === 'INFERIOR' ||
      normalizedCategory === 'ACCESORIO'
        ? normalizedCategory
        : 'SUPERIOR';

    setEditingItem(item);
    setFormCode(item.code);
    setFormName(item.name);
    setFormCategory(safeCategory);
    setFormDescription(item.description || '');
    setFormSizes(item.availableSizes.join(', '));
    setFormFits(item.availableFits.join(', '));
    setFormIncludedQty(String(item.includedQuantity || 1));
    setFormIsRequired(Boolean(item.isRequired));
    setFormIsActive(Boolean(item.isActive));
    setFormSortOrder(String(item.sortOrder ?? 1));
    setModalError(null);
    setModalOpen(true);
  }, []);

  const handleSaveItem = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError(null);

    const code = formCode.trim().toUpperCase();
    const name = formName.trim();
    const availableSizes = parseCommaList(formSizes);
    const availableFits = parseCommaList(formFits);
    const includedQuantity = Number.parseInt(formIncludedQty, 10);
    const sortOrder = Number.parseInt(formSortOrder, 10);

    if (!code) {
      setModalError('El código interno de la prenda es obligatorio.');
      return;
    }
    if (!name) {
      setModalError('El nombre de la prenda es obligatorio.');
      return;
    }
    if (availableSizes.length === 0) {
      setModalError('Debes indicar al menos una talla disponible separada por coma.');
      return;
    }
    if (!Number.isFinite(includedQuantity) || includedQuantity < 1) {
      setModalError('La cantidad incluida por participante debe ser mayor o igual a 1.');
      return;
    }

    setSavingItem(true);
    try {
      const payload = {
        ...(editingItem
          ? { id: editingItem.id, sizeGuide: editingItem.sizeGuide }
          : {}),
        code,
        name,
        category: formCategory,
        description: formDescription.trim() || null,
        availableSizes,
        availableFits,
        includedQuantity,
        isRequired: formIsRequired,
        isActive: formIsActive,
        sortOrder: Number.isFinite(sortOrder) ? sortOrder : 1,
      };

      const res = await fetch('/api/kit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const body = (await res.json().catch(() => ({}))) as {
        error?: string;
        item?: EventKitItemDTO;
      };

      if (!res.ok) {
        throw new Error(body.error || 'No se pudo guardar la configuración de la prenda');
      }

      toast.success(
        editingItem
          ? `Prenda "${name}" actualizada correctamente.`
          : `Prenda "${name}" agregada al catálogo del evento.`,
        'Catálogo del Kit'
      );

      setModalOpen(false);
      setEditingItem(null);
      setReloadTick((t) => t + 1);
      void refreshStats();
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : 'Error al guardar la prenda del kit';
      setModalError(msg);
      toast.error(msg, 'Error al guardar');
    } finally {
      setSavingItem(false);
    }
  };

  const supplierItems = useMemo<KitItemSummaryDTO[]>(() => {
    const byId = new Map<string, KitItemSummaryDTO>();
    for (const entry of summary.totalsByItem) {
      byId.set(entry.item.id, entry);
    }
    const merged: KitItemSummaryDTO[] = [...summary.totalsByItem];
    for (const item of summary.items) {
      if (!byId.has(item.id)) {
        merged.push({
          item,
          totalConfirmedParticipants: 0,
          totalUnits: 0,
          breakdown: [],
        });
      }
    }
    return merged.sort((a, b) => a.item.sortOrder - b.item.sortOrder);
  }, [summary.totalsByItem, summary.items]);

  const totalUnitsAllItems = useMemo(
    () =>
      supplierItems.reduce((acc, entry) => acc + (entry.totalUnits || 0), 0),
    [supplierItems]
  );

  const handleExportCsv = useCallback(() => {
    if (supplierItems.length === 0 && summary.participants.length === 0) {
      toast.info('No hay datos de kit disponibles para exportar.');
      return;
    }

    const rows: Array<Array<string | number>> = [];

    // Section 1: Consolidado por Prenda x Talla x Corte
    rows.push(['CONSOLIDADO PARA PROVEEDOR (PRENDA × TALLA × CORTE)']);
    rows.push([
      'Código Prenda',
      'Prenda',
      'Categoría',
      'Cantidad por Participante',
      'Talla',
      'Corte / Fit',
      'Participantes Confirmados',
      'Unidades a Encargar',
    ]);

    for (const entry of supplierItems) {
      const sortedCells = sortBreakdownRows(
        entry.breakdown,
        entry.item.availableSizes
      );

      if (sortedCells.length === 0) {
        rows.push([
          entry.item.code,
          entry.item.name,
          entry.item.category,
          entry.item.includedQuantity,
          'Sin registros',
          '-',
          0,
          0,
        ]);
      } else {
        for (const cell of sortedCells) {
          rows.push([
            entry.item.code,
            entry.item.name,
            entry.item.category,
            entry.item.includedQuantity,
            cell.size,
            cell.fit || 'Estándar',
            cell.count,
            cell.units,
          ]);
        }
      }

      rows.push([
        entry.item.code,
        `${entry.item.name} (SUBTOTAL)`,
        entry.item.category,
        entry.item.includedQuantity,
        'TODAS',
        'TODOS',
        entry.totalConfirmedParticipants,
        entry.totalUnits,
      ]);
    }

    rows.push([]);
    rows.push(['NÓMINA DE PARTICIPANTES Y TALLAS SELECCIONADAS']);
    rows.push([
      'RUT',
      'Nombres',
      'Apellidos',
      'Rol Contingente',
      'Grupo Scout',
      'Unidad',
      'Cupo',
      'Estado Kit',
      ...summary.items.map(
        (it) => `${it.name} [${it.code}] (x${it.includedQuantity})`
      ),
      'Talla Referencia Heredada',
    ]);

    for (const p of summary.participants) {
      const byItemId = new Map(p.selections.map((s) => [s.kitItemId, s]));
      const byCode = new Map(
        p.selections
          .filter((s) => s.kitItem?.code)
          .map((s) => [s.kitItem!.code, s])
      );

      const itemCols = summary.items.map((it) => {
        const sel = byItemId.get(it.id) || byCode.get(it.code);
        if (!sel) return '';
        const fitSuffix = sel.fit ? ` (${sel.fit})` : '';
        const noteSuffix = sel.notes ? ` — ${sel.notes}` : '';
        return `${sel.size}${fitSuffix}${noteSuffix}`;
      });

      rows.push([
        p.rut,
        p.firstName,
        [p.lastName, p.secondLastName].filter(Boolean).join(' '),
        p.contingentRole,
        p.scoutGroup || '',
        p.unitName || '',
        p.cupoCode || '',
        KIT_STATUS_META[p.kitStatus].label,
        ...itemCols,
        p.uniformSize || '',
      ]);
    }

    const csvContent = rows
      .map((row) => row.map((cell) => escapeCsvCell(cell)).join(','))
      .join('\r\n');

    const blob = new Blob([`\uFEFF${csvContent}`], {
      type: 'text/csv;charset=utf-8;',
    });
    const url = URL.createObjectURL(blob);
    const eventSlug = (activeEvent?.code || 'EVENTO').replace(
      /[^a-zA-Z0-9_-]/g,
      '_'
    );
    const todayStr = new Date().toISOString().slice(0, 10);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Matriz_Kit_AGSCH_${eventSlug}_${todayStr}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast.success(
      'Matriz de proveedor y nómina de tallas descargadas en CSV UTF-8.',
      'Exportación Lista'
    );
  }, [activeEvent?.code, summary.items, summary.participants, supplierItems, toast]);

  const handleKpiClick = useCallback((target: KitStatusFilter) => {
    setActiveTab('participants');
    setStatusFilter((current) => {
      if (target === 'ALL') return 'ALL';
      return current === target ? 'ALL' : target;
    });
    setPage(1);
  }, []);

  const filteredParticipants = useMemo(() => {
    const query = searchInput.trim().toLowerCase();
    return summary.participants.filter((p) => {
      if (statusFilter !== 'ALL' && p.kitStatus !== statusFilter) {
        return false;
      }
      if (!query) return true;

      const haystack = [
        p.rut,
        p.firstName,
        p.lastName,
        p.secondLastName,
        p.cupoCode,
        p.unitName,
        p.scoutGroup,
        p.contingentRole,
        p.uniformSize,
        ...p.selections.map(
          (s) => `${s.kitItem?.name || ''} ${s.kitItem?.code || ''} ${s.size} ${s.fit || ''}`
        ),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return haystack.includes(query);
    });
  }, [summary.participants, statusFilter, searchInput]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredParticipants.length / PAGE_SIZE)
  );
  const safePage = Math.min(page, totalPages);

  const pagedParticipants = useMemo(() => {
    const start = (safePage - 1) * PAGE_SIZE;
    return filteredParticipants.slice(start, start + PAGE_SIZE);
  }, [filteredParticipants, safePage]);

  const activeTotal = summary.totalActiveParticipants;
  const completedPct =
    activeTotal > 0
      ? Math.round((summary.completedParticipants / activeTotal) * 100)
      : 0;

  const hasActiveFilters =
    Boolean(searchInput.trim()) || statusFilter !== 'ALL';

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#EEF2FF] border border-[#001558]/20 text-[#001558] flex items-center justify-center shrink-0">
              <Shirt className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-[#001558] tracking-tight">
                Gestión del Kit y Levantamiento de Tallas
              </h1>
              <p className="text-xs sm:text-sm text-slate-600">
                {activeEvent
                  ? `${activeEvent.flagEmoji ? `${activeEvent.flagEmoji} ` : ''}${activeEvent.name} • Consolidado para proveedor y seguimiento de tallas por participante`
                  : 'Consolidado multievento de prendas e indumentaria del contingente'}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => void handleCopyPortalLink()}
              className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#FFFBF0] hover:bg-[#FFF8E1] border border-[#FEB135] text-xs font-bold text-[#001558] transition-colors cursor-pointer"
            >
              <ClipboardCopy className="w-3.5 h-3.5" />
              <span>Copiar enlace Portal (/portal)</span>
            </button>

            <button
              type="button"
              onClick={handleExportCsv}
              disabled={loading}
              className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-white hover:bg-[#F5F6F8] border border-slate-300 text-xs font-bold text-[#001558] transition-colors disabled:opacity-50 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Exportar Matriz CSV</span>
            </button>

            {canManageKit && (
              <button
                type="button"
                onClick={openCreateModal}
                className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#001558] hover:bg-[#0b2370] text-white text-xs font-extrabold transition-colors shadow-xs cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5 text-[#FEB135]" />
                <span>Configurar Prenda</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleReload}
              aria-label="Actualizar matriz del kit"
              title="Actualizar matriz del kit"
              className="inline-flex items-center justify-center p-2 rounded-xl bg-white hover:bg-[#FFFBF0] border border-slate-200 hover:border-[#FEB135] text-[#001558] transition-colors cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* 4 Interactive KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* 1. Total Activos */}
        <button
          type="button"
          onClick={() => handleKpiClick('ALL')}
          className={`text-left rounded-2xl p-4 border transition-all cursor-pointer shadow-xs ${
            activeTab === 'participants' && statusFilter === 'ALL'
              ? 'bg-[#EEF2FF]/70 border-[#001558] ring-2 ring-[#001558]/20'
              : 'bg-white border-slate-200 hover:border-[#001558]/40'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Total Activos
            </span>
            <div className="w-8 h-8 rounded-xl bg-[#EEF2FF] border border-[#001558]/20 text-[#001558] flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-[#001558]">
            {activeTotal.toLocaleString('es-CL')}
          </p>
          <p className="text-[10px] text-slate-500 mt-2">
            {summary.items.length}{' '}
            {summary.items.length === 1 ? 'prenda configurada' : 'prendas configuradas'}
          </p>
        </button>

        {/* 2. Tallas Completas */}
        <button
          type="button"
          onClick={() => handleKpiClick('COMPLETED')}
          className={`text-left rounded-2xl p-4 border transition-all cursor-pointer shadow-xs ${
            statusFilter === 'COMPLETED'
              ? 'bg-emerald-50/70 border-emerald-500 ring-2 ring-emerald-200'
              : 'bg-white border-slate-200 hover:border-emerald-300'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Tallas Completas
            </span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline justify-between gap-2 mb-2">
            <span className="text-2xl font-black text-[#001558]">
              {summary.completedParticipants.toLocaleString('es-CL')}
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

        {/* 3. Parciales */}
        <button
          type="button"
          onClick={() => handleKpiClick('PARTIAL')}
          className={`text-left rounded-2xl p-4 border transition-all cursor-pointer shadow-xs ${
            statusFilter === 'PARTIAL'
              ? 'bg-[#FFF8E1] border-[#FEB135] ring-2 ring-[#FEB135]/40'
              : 'bg-white border-slate-200 hover:border-[#FEB135]'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Parciales
            </span>
            <div className="w-8 h-8 rounded-xl bg-[#FFF8E1] border border-[#FEB135] text-[#001558] flex items-center justify-center">
              <Layers className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-[#001558]">
            {summary.partialParticipants.toLocaleString('es-CL')}
          </p>
          <p className="text-[10px] text-slate-500 mt-2">
            Faltan prendas obligatorias
          </p>
        </button>

        {/* 4. Pendientes */}
        <button
          type="button"
          onClick={() => handleKpiClick('PENDING')}
          className={`text-left rounded-2xl p-4 border transition-all cursor-pointer shadow-xs ${
            statusFilter === 'PENDING'
              ? 'bg-slate-100 border-slate-500 ring-2 ring-slate-300'
              : 'bg-white border-slate-200 hover:border-slate-400'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Pendientes
            </span>
            <div className="w-8 h-8 rounded-xl bg-slate-100 border border-slate-200 text-slate-600 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-slate-700">
            {summary.pendingParticipants.toLocaleString('es-CL')}
          </p>
          <p className="text-[10px] text-slate-500 mt-2">
            Sin selecciones registradas
          </p>
        </button>
      </div>

      {/* Error Banner */}
      {error && (
        <div
          role="alert"
          className="bg-red-50 border border-red-200 text-red-700 rounded-2xl p-4 text-xs font-semibold flex items-center gap-2"
        >
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Local Tabs */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-4 sm:px-6 border-b border-slate-200 bg-[#F5F6F8]">
          <div className="flex items-center overflow-x-auto whitespace-nowrap">
            <button
              type="button"
              onClick={() => setActiveTab('supplier')}
              className={`flex items-center gap-2 py-3.5 px-4 text-xs font-extrabold uppercase tracking-wider border-b-2 transition-colors cursor-pointer shrink-0 ${
                activeTab === 'supplier'
                  ? 'border-[#001558] text-[#001558] bg-white'
                  : 'border-transparent text-slate-500 hover:text-[#001558]'
              }`}
            >
              <PackageCheck className="w-4 h-4 text-[#FEB135]" />
              <span>Matriz para Proveedor</span>
              <span className="px-1.5 py-0.5 rounded-full bg-[#EEF2FF] text-[#001558] text-[10px] font-black">
                {supplierItems.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('participants')}
              className={`flex items-center gap-2 py-3.5 px-4 text-xs font-extrabold uppercase tracking-wider border-b-2 transition-colors cursor-pointer shrink-0 ${
                activeTab === 'participants'
                  ? 'border-[#001558] text-[#001558] bg-white'
                  : 'border-transparent text-slate-500 hover:text-[#001558]'
              }`}
            >
              <Users className="w-4 h-4 text-[#001558]" />
              <span>Detalle por Participante</span>
              <span className="px-1.5 py-0.5 rounded-full bg-[#EEF2FF] text-[#001558] text-[10px] font-black">
                {filteredParticipants.length.toLocaleString('es-CL')}
              </span>
            </button>
          </div>

          {activeTab === 'supplier' && (
            <div className="flex items-center justify-between sm:justify-end gap-3 py-2 text-xs">
              {canManageKit && (
                <label className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-600 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeInactive}
                    onChange={(e) => setIncludeInactive(e.target.checked)}
                    className="rounded border-slate-300 text-[#001558] focus:ring-[#FEB135]"
                  />
                  <span>Mostrar inactivas</span>
                </label>
              )}
              <span className="px-2.5 py-1 rounded-lg bg-[#001558] text-white text-[11px] font-bold">
                Total general:{' '}
                <strong className="text-[#FEB135]">
                  {totalUnitsAllItems.toLocaleString('es-CL')}
                </strong>{' '}
                prendas
              </span>
            </div>
          )}
        </div>

        {/* Loading State */}
        {loading ? (
          <div className="p-12 flex items-center justify-center gap-2 text-xs font-semibold text-slate-500">
            <Loader2 className="w-5 h-5 animate-spin text-[#001558]" />
            <span>Cargando matriz de tallas del kit...</span>
          </div>
        ) : activeTab === 'supplier' ? (
          /* TAB 1: MATRIZ PARA PROVEEDOR */
          <div className="p-4 sm:p-6 bg-[#F5F6F8]/50">
            {supplierItems.length === 0 ? (
              <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center space-y-2 text-slate-500">
                <Shirt className="w-9 h-9 mx-auto text-slate-300" />
                <p className="text-sm font-bold text-[#001558]">
                  No hay prendas configuradas para este evento
                </p>
                <p className="text-xs text-slate-500">
                  Configura las prendas del kit oficial para comenzar el levantamiento de tallas.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                {supplierItems.map((entry) => {
                  const item = entry.item;
                  const catMeta =
                    CATEGORY_META[(item.category || '').toUpperCase()] || {
                      label: item.category || 'Prenda',
                      className: 'bg-slate-100 text-slate-700 border-slate-200',
                    };
                  const sortedBreakdown = sortBreakdownRows(
                    entry.breakdown,
                    item.availableSizes
                  );

                  return (
                    <section
                      key={item.id}
                      className={`bg-white border rounded-2xl shadow-xs overflow-hidden flex flex-col ${
                        item.isActive
                          ? 'border-slate-200'
                          : 'border-slate-300 opacity-80'
                      }`}
                    >
                      {/* Card Header */}
                      <div className="p-4 sm:p-5 border-b border-slate-200 bg-white space-y-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="space-y-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span
                                className={`px-2 py-0.5 rounded-md border text-[10px] font-extrabold uppercase ${catMeta.className}`}
                              >
                                {catMeta.label}
                              </span>
                              <span className="px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200 text-slate-700 font-mono text-[10px] font-bold">
                                {item.code}
                              </span>
                              <span className="px-2 py-0.5 rounded-md bg-[#FFF8E1] border border-[#FEB135] text-[#001558] font-mono text-[10px] font-black">
                                x{item.includedQuantity} / part.
                              </span>
                              {item.isRequired ? (
                                <span className="px-2 py-0.5 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-800 text-[10px] font-bold">
                                  Obligatoria
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200 text-slate-600 text-[10px] font-semibold">
                                  Opcional
                                </span>
                              )}
                              {!item.isActive && (
                                <span className="px-2 py-0.5 rounded-md bg-red-50 border border-red-200 text-red-700 text-[10px] font-bold">
                                  Inactiva
                                </span>
                              )}
                            </div>

                            <h2 className="text-base font-black text-[#001558] leading-snug">
                              {item.name}
                            </h2>
                            {item.description && (
                              <p className="text-xs text-slate-600 leading-relaxed">
                                {item.description}
                              </p>
                            )}
                          </div>

                          {canManageKit && (
                            <button
                              type="button"
                              onClick={() => openEditModal(item)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-[#EEF2FF] hover:bg-[#001558] text-[#001558] hover:text-white border border-[#001558]/20 text-[11px] font-bold transition-colors shrink-0 cursor-pointer"
                            >
                              <Pencil className="w-3 h-3" />
                              <span>Editar prenda</span>
                            </button>
                          )}
                        </div>

                        {/* Item KPIs */}
                        <div className="grid grid-cols-2 gap-2.5 pt-1">
                          <div className="rounded-xl bg-[#F5F6F8] border border-slate-200 px-3 py-2">
                            <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">
                              Participantes confirmados
                            </span>
                            <span className="text-base font-black text-[#001558]">
                              {entry.totalConfirmedParticipants.toLocaleString('es-CL')}
                            </span>
                          </div>
                          <div className="rounded-xl bg-[#001558] text-white px-3 py-2 border border-[#001558]">
                            <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-200">
                              Total a encargar
                            </span>
                            <span className="text-base font-black text-[#FEB135]">
                              {entry.totalUnits.toLocaleString('es-CL')} uds.
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Size x Fit Table */}
                      <div className="flex-1 overflow-x-auto">
                        {sortedBreakdown.length === 0 ? (
                          <div className="p-6 text-center text-xs text-slate-500">
                            Aún no hay selecciones confirmadas para esta prenda.
                          </div>
                        ) : (
                          <table className="w-full text-left border-collapse text-xs">
                            <thead>
                              <tr className="bg-[#F5F6F8] border-b border-slate-200 text-[10px] font-extrabold text-slate-600 uppercase tracking-wider">
                                <th className="py-2.5 px-4">Talla</th>
                                <th className="py-2.5 px-4">Corte / Fit</th>
                                <th className="py-2.5 px-4 text-right">
                                  Participantes
                                </th>
                                <th className="py-2.5 px-4 text-right">
                                  Unidades (x{item.includedQuantity})
                                </th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200">
                              {sortedBreakdown.map((cell) => {
                                const fitLabel = cell.fit || 'Estándar';
                                return (
                                  <tr
                                    key={`${cell.size}-${fitLabel}`}
                                    className="hover:bg-[#FFFBF0]/70 transition-colors"
                                  >
                                    <td className="py-2.5 px-4 font-black text-[#001558]">
                                      {cell.size}
                                    </td>
                                    <td className="py-2.5 px-4 text-slate-700 font-medium">
                                      {fitLabel}
                                    </td>
                                    <td className="py-2.5 px-4 text-right font-mono text-slate-700">
                                      {cell.count.toLocaleString('es-CL')}
                                    </td>
                                    <td className="py-2.5 px-4 text-right font-mono font-black text-[#001558]">
                                      {cell.units.toLocaleString('es-CL')}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                            <tfoot>
                              <tr className="bg-[#F5F6F8] border-t border-slate-200 font-extrabold text-[#001558]">
                                <td className="py-2.5 px-4" colSpan={2}>
                                  Subtotal {item.code}
                                </td>
                                <td className="py-2.5 px-4 text-right font-mono">
                                  {entry.totalConfirmedParticipants.toLocaleString('es-CL')}
                                </td>
                                <td className="py-2.5 px-4 text-right font-mono">
                                  {entry.totalUnits.toLocaleString('es-CL')} uds.
                                </td>
                              </tr>
                            </tfoot>
                          </table>
                        )}
                      </div>
                    </section>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          /* TAB 2: DETALLE POR PARTICIPANTE */
          <div>
            {/* Filters */}
            <div className="p-4 border-b border-slate-200 bg-white">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="sm:col-span-2 relative">
                  <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                  <input
                    type="text"
                    value={searchInput}
                    onChange={(e) => {
                      setSearchInput(e.target.value);
                      setPage(1);
                    }}
                    placeholder="Buscar por RUT, participante, cupo, unidad o talla..."
                    className="w-full bg-white border border-slate-300 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-800 placeholder-slate-400 focus:border-[#001558] focus:ring-2 focus:ring-[#FEB135]/50 focus:outline-none"
                  />
                </div>

                <select
                  aria-label="Filtrar por estado del kit"
                  value={statusFilter}
                  onChange={(e) => {
                    setStatusFilter(e.target.value as KitStatusFilter);
                    setPage(1);
                  }}
                  className="bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-800 font-medium focus:border-[#001558] focus:ring-2 focus:ring-[#FEB135]/50 focus:outline-none"
                >
                  {STATUS_FILTER_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  onClick={() => {
                    setSearchInput('');
                    setStatusFilter('ALL');
                    setPage(1);
                  }}
                  disabled={!hasActiveFilters}
                  className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-slate-300 bg-[#F5F6F8] hover:bg-slate-200/70 text-xs font-bold text-slate-700 disabled:opacity-45 transition-colors cursor-pointer"
                >
                  <FilterX className="w-3.5 h-3.5" />
                  <span>Limpiar filtros</span>
                </button>
              </div>
            </div>

            {filteredParticipants.length === 0 ? (
              <div className="p-12 text-center space-y-2 text-slate-500">
                <Shirt className="w-9 h-9 mx-auto text-slate-300" />
                <p className="text-sm font-bold text-[#001558]">
                  No hay participantes que coincidan con la búsqueda
                </p>
                <p className="text-xs text-slate-500">
                  Intenta limpiar los filtros o buscar por otro RUT o nombre.
                </p>
              </div>
            ) : (
              <>
                {/* Desktop Table */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-[#F5F6F8] border-b border-slate-200 text-[11px] font-extrabold text-slate-600 uppercase tracking-wider">
                        <th className="py-3 px-4">RUT &amp; Cupo</th>
                        <th className="py-3 px-4">Participante</th>
                        <th className="py-3 px-4">Estado Kit</th>
                        <th className="py-3 px-4">Tallas Seleccionadas</th>
                        <th className="py-3 px-4 text-right">Ficha</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 text-xs">
                      {pagedParticipants.map((p) => {
                        const statusMeta = KIT_STATUS_META[p.kitStatus];
                        const fullName = [
                          p.firstName,
                          p.lastName,
                          p.secondLastName,
                        ]
                          .filter(Boolean)
                          .join(' ');
                        const groupOrUnit =
                          p.unitName || p.scoutGroup || p.contingentRole;

                        return (
                          <tr
                            key={p.id}
                            onClick={() => setSelectedParticipantId(p.id)}
                            className="hover:bg-[#FFFBF0]/70 transition-colors cursor-pointer align-middle"
                          >
                            <td className="py-3.5 px-4 whitespace-nowrap">
                              <p className="font-mono font-bold text-[#001558]">
                                {p.rut}
                              </p>
                              <p className="text-[11px] text-slate-500 font-mono">
                                {p.cupoCode || 'Sin cupo'}
                              </p>
                            </td>

                            <td className="py-3.5 px-4">
                              <p className="font-bold text-[#001558]">
                                {fullName}
                              </p>
                              <p className="text-[11px] text-slate-600">
                                {groupOrUnit}
                                {p.contingentRole ? ` • ${p.contingentRole}` : ''}
                              </p>
                            </td>

                            <td className="py-3.5 px-4 whitespace-nowrap">
                              <span
                                className={`inline-flex items-center px-2.5 py-1 rounded-full border text-[11px] font-bold ${statusMeta.className}`}
                              >
                                {statusMeta.label}
                              </span>
                            </td>

                            <td className="py-3.5 px-4">
                              {p.selections.length > 0 ? (
                                <div className="flex flex-wrap gap-1.5">
                                  {p.selections.map((sel) => (
                                    <span
                                      key={sel.id || sel.kitItemId}
                                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#EEF2FF] text-[#001558] border border-[#001558]/20 text-[11px] font-semibold"
                                    >
                                      <span className="font-bold">
                                        {sel.kitItem?.code ||
                                          sel.kitItem?.name ||
                                          sel.kitItemId}
                                        :
                                      </span>
                                      <span className="font-black">
                                        {sel.size}
                                      </span>
                                      {sel.fit && (
                                        <span className="text-slate-600">
                                          ({sel.fit})
                                        </span>
                                      )}
                                    </span>
                                  ))}
                                </div>
                              ) : (
                                <span className="text-[11px] text-slate-400">
                                  {p.uniformSize
                                    ? `Sin detalle (Ref: ${p.uniformSize})`
                                    : 'Sin tallas registradas'}
                                </span>
                              )}
                            </td>

                            <td className="py-3.5 px-4 text-right whitespace-nowrap">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedParticipantId(p.id);
                                }}
                                className="px-2.5 py-1.5 rounded-lg bg-[#EEF2FF] hover:bg-[#001558] text-[#001558] hover:text-white border border-[#001558]/20 text-[11px] font-bold transition-colors cursor-pointer"
                              >
                                Ver Logística
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Cards */}
                <div className="md:hidden divide-y divide-slate-200">
                  {pagedParticipants.map((p) => {
                    const statusMeta = KIT_STATUS_META[p.kitStatus];
                    const fullName = [
                      p.firstName,
                      p.lastName,
                      p.secondLastName,
                    ]
                      .filter(Boolean)
                      .join(' ');
                    const groupOrUnit =
                      p.unitName || p.scoutGroup || p.contingentRole;

                    return (
                      <div key={p.id} className="p-4 space-y-2.5">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="text-sm font-bold text-[#001558]">
                              {fullName}
                            </p>
                            <p className="text-[11px] text-slate-500 font-mono">
                              {p.rut}
                              {p.cupoCode ? ` • ${p.cupoCode}` : ''}
                            </p>
                            <p className="text-xs text-slate-600">
                              {groupOrUnit}
                            </p>
                          </div>

                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full border text-[10px] font-bold shrink-0 ${statusMeta.className}`}
                          >
                            {statusMeta.label}
                          </span>
                        </div>

                        {p.selections.length > 0 ? (
                          <div className="flex flex-wrap gap-1.5">
                            {p.selections.map((sel) => (
                              <span
                                key={sel.id || sel.kitItemId}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#EEF2FF] text-[#001558] border border-[#001558]/20 text-[10px] font-semibold"
                              >
                                <span className="font-bold">
                                  {sel.kitItem?.code ||
                                    sel.kitItem?.name ||
                                    sel.kitItemId}
                                  :
                                </span>
                                <span className="font-black">{sel.size}</span>
                                {sel.fit && (
                                  <span className="text-slate-600">
                                    ({sel.fit})
                                  </span>
                                )}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <p className="text-[11px] text-slate-400">
                            {p.uniformSize
                              ? `Sin detalle (Ref: ${p.uniformSize})`
                              : 'Sin tallas registradas'}
                          </p>
                        )}

                        <div className="pt-1">
                          <button
                            type="button"
                            onClick={() => setSelectedParticipantId(p.id)}
                            className="px-3 py-1.5 rounded-lg bg-[#EEF2FF] text-[#001558] border border-[#001558]/20 text-xs font-bold cursor-pointer"
                          >
                            Ver Logística y Tallas
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Pagination Footer */}
                <div className="px-4 py-3 bg-[#F5F6F8] border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs">
                  <span className="text-slate-600 font-semibold">
                    Página {safePage} de {totalPages} •{' '}
                    {filteredParticipants.length.toLocaleString('es-CL')}{' '}
                    participantes
                  </span>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={safePage <= 1}
                      onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white border border-slate-300 text-slate-700 font-bold hover:bg-slate-50 disabled:opacity-45 cursor-pointer"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                      <span>Anterior</span>
                    </button>
                    <button
                      type="button"
                      disabled={safePage >= totalPages}
                      onClick={() =>
                        setPage((prev) => Math.min(totalPages, prev + 1))
                      }
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white border border-slate-300 text-slate-700 font-bold hover:bg-slate-50 disabled:opacity-45 cursor-pointer"
                    >
                      <span>Siguiente</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Modal: Configurar / Editar Prenda */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#001558]/40 backdrop-blur-xs"
          onClick={(e) => {
            if (e.target === e.currentTarget && !savingItem) {
              handleCloseModal();
            }
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={modalTitleId}
            className="bg-white border border-slate-200 w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
          >
            <div className="bg-[#001558] text-white px-6 py-4 border-b-4 border-b-[#FEB135] flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-white/10 border border-[#FEB135]/40 flex items-center justify-center text-[#FEB135]">
                  <Shirt className="w-5 h-5" />
                </div>
                <div>
                  <h2 id={modalTitleId} className="text-base font-extrabold text-white">
                    {editingItem
                      ? `Editar Prenda: ${editingItem.name}`
                      : 'Configurar Nueva Prenda del Kit'}
                  </h2>
                  <p className="text-[11px] text-slate-200">
                    {activeEvent?.name || 'Catálogo de indumentaria del evento'}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleCloseModal}
                disabled={savingItem}
                aria-label="Cerrar modal"
                className="p-2 rounded-lg text-white/75 hover:text-white hover:bg-white/10 transition-colors disabled:opacity-50 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={handleSaveItem}
              className="p-6 overflow-y-auto space-y-4 text-xs"
            >
              {modalError && (
                <div
                  role="alert"
                  className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 flex items-start gap-2 font-semibold"
                >
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{modalError}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label
                    htmlFor="kit-item-code"
                    className="block font-bold text-[#001558] uppercase tracking-wider text-[11px] mb-1"
                  >
                    Código *
                  </label>
                  <input
                    id="kit-item-code"
                    type="text"
                    required
                    value={formCode}
                    onChange={(e) => setFormCode(e.target.value.toUpperCase())}
                    placeholder="Ej: POLERA"
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono uppercase text-slate-800 focus:border-[#001558] focus:ring-2 focus:ring-[#FEB135]/50 focus:outline-none"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label
                    htmlFor="kit-item-name"
                    className="block font-bold text-[#001558] uppercase tracking-wider text-[11px] mb-1"
                  >
                    Nombre de la Prenda *
                  </label>
                  <input
                    id="kit-item-name"
                    type="text"
                    required
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="Ej: Polera Institucional del Evento"
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-800 focus:border-[#001558] focus:ring-2 focus:ring-[#FEB135]/50 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label
                    htmlFor="kit-item-category"
                    className="block font-bold text-[#001558] uppercase tracking-wider text-[11px] mb-1"
                  >
                    Categoría *
                  </label>
                  <select
                    id="kit-item-category"
                    value={formCategory}
                    onChange={(e) =>
                      setFormCategory(e.target.value as KitCategory)
                    }
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-800 focus:border-[#001558] focus:ring-2 focus:ring-[#FEB135]/50 focus:outline-none"
                  >
                    {CATEGORY_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="kit-item-qty"
                    className="block font-bold text-[#001558] uppercase tracking-wider text-[11px] mb-1"
                  >
                    Cantidad Incluida *
                  </label>
                  <input
                    id="kit-item-qty"
                    type="number"
                    min={1}
                    max={20}
                    required
                    value={formIncludedQty}
                    onChange={(e) => setFormIncludedQty(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-800 focus:border-[#001558] focus:ring-2 focus:ring-[#FEB135]/50 focus:outline-none"
                  />
                </div>

                <div>
                  <label
                    htmlFor="kit-item-order"
                    className="block font-bold text-[#001558] uppercase tracking-wider text-[11px] mb-1"
                  >
                    Orden
                  </label>
                  <input
                    id="kit-item-order"
                    type="number"
                    min={0}
                    value={formSortOrder}
                    onChange={(e) => setFormSortOrder(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-800 focus:border-[#001558] focus:ring-2 focus:ring-[#FEB135]/50 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="kit-item-desc"
                  className="block font-bold text-[#001558] uppercase tracking-wider text-[11px] mb-1"
                >
                  Descripción para el Participante
                </label>
                <textarea
                  id="kit-item-desc"
                  rows={2}
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="Ej: Polera oficial para actividades diarias del evento..."
                  className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-800 focus:border-[#001558] focus:ring-2 focus:ring-[#FEB135]/50 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="kit-item-sizes"
                    className="block font-bold text-[#001558] uppercase tracking-wider text-[11px] mb-1"
                  >
                    Tallas Disponibles (separadas por coma) *
                  </label>
                  <input
                    id="kit-item-sizes"
                    type="text"
                    required
                    value={formSizes}
                    onChange={(e) => setFormSizes(e.target.value)}
                    placeholder="XS, S, M, L, XL, 2XL, 3XL"
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-800 focus:border-[#001558] focus:ring-2 focus:ring-[#FEB135]/50 focus:outline-none"
                  />
                </div>

                <div>
                  <label
                    htmlFor="kit-item-fits"
                    className="block font-bold text-[#001558] uppercase tracking-wider text-[11px] mb-1"
                  >
                    Cortes / Fit (separados por coma)
                  </label>
                  <input
                    id="kit-item-fits"
                    type="text"
                    value={formFits}
                    onChange={(e) => setFormFits(e.target.value)}
                    placeholder="Unisex / Recto, Entallado"
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-800 focus:border-[#001558] focus:ring-2 focus:ring-[#FEB135]/50 focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-6 pt-1">
                <label className="inline-flex items-center gap-2 font-bold text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formIsRequired}
                    onChange={(e) => setFormIsRequired(e.target.checked)}
                    className="rounded border-slate-300 text-[#001558] focus:ring-[#FEB135]"
                  />
                  <span>Selección obligatoria en Portal</span>
                </label>

                <label className="inline-flex items-center gap-2 font-bold text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formIsActive}
                    onChange={(e) => setFormIsActive(e.target.checked)}
                    className="rounded border-slate-300 text-[#001558] focus:ring-[#FEB135]"
                  />
                  <span>Prenda activa en el evento</span>
                </label>
              </div>

              <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  disabled={savingItem}
                  className="px-4 py-2 rounded-xl bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs font-bold transition-colors disabled:opacity-50 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingItem}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#001558] hover:bg-[#0b2370] text-white text-xs font-extrabold transition-colors shadow-xs disabled:opacity-60 cursor-pointer"
                >
                  {savingItem && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>
                    {editingItem ? 'Guardar Cambios' : 'Crear Prenda'}
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Participant Detail Modal (opens directly in Logistics tab) */}
      {selectedParticipantId && (
        <ParticipantDetailModal
          participantId={selectedParticipantId}
          currency={currency}
          permissions={permissions}
          initialTab="logistics"
          onClose={() => setSelectedParticipantId(null)}
          onParticipantUpdated={handleReload}
        />
      )}
    </div>
  );
}

export default function KitPage() {
  return (
    <AppShell>
      <KitWorkspace />
    </AppShell>
  );
}
