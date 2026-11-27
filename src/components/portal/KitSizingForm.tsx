'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Info,
  Loader2,
  Printer,
  Ruler,
  Shirt,
  Sparkles,
  AlertTriangle,
} from 'lucide-react';
import { useToast } from '@/components/ui/ToastProvider';
import type {
  EventKitItemDTO,
  KitSizeGuideRow,
  ParticipantKitSizeDTO,
} from '@/types/domain';

export interface KitSizingFormProps {
  kitItems: EventKitItemDTO[];
  initialSelections: ParticipantKitSizeDTO[];
  participantName: string;
  eventName: string;
  onSaved: () => Promise<void> | void;
}

interface SelectionDraft {
  size: string;
  fit: string;
  notes: string;
}

const STANDARD_BASE_SIZES = ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL'] as const;

const CATEGORY_ORDER = ['SUPERIOR', 'ABRIGO', 'INFERIOR', 'ACCESORIO'] as const;

const CATEGORY_META: Record<string, { title: string; subtitle: string }> = {
  SUPERIOR: {
    title: 'Prendas Superiores',
    subtitle: 'Poleras y camisas oficiales del contingente',
  },
  ABRIGO: {
    title: 'Abrigo y Exterior',
    subtitle: 'Polerones y chaquetas para jornadas frescas o lluvia',
  },
  INFERIOR: {
    title: 'Prendas Inferiores',
    subtitle: 'Pantalones y shorts de terreno',
  },
  ACCESORIO: {
    title: 'Accesorios y Cabeza',
    subtitle: 'Gorros, sombreros y complementos oficiales',
  },
};

const SIZE_GUIDE_COLUMNS: Array<{
  key: keyof Omit<KitSizeGuideRow, 'size'>;
  label: string;
}> = [
  { key: 'chestCm', label: 'Pecho (cm)' },
  { key: 'lengthCm', label: 'Largo (cm)' },
  { key: 'sleeveCm', label: 'Manga (cm)' },
  { key: 'waistCm', label: 'Cintura (cm)' },
  { key: 'hipCm', label: 'Cadera (cm)' },
  { key: 'neckCm', label: 'Cuello (cm)' },
  { key: 'headCm', label: 'Contorno Cabeza (cm)' },
  { key: 'note', label: 'Observación' },
];

function buildInitialDrafts(
  kitItems: EventKitItemDTO[],
  initialSelections: ParticipantKitSizeDTO[]
): Record<string, SelectionDraft> {
  const byItemId = new Map<string, ParticipantKitSizeDTO>();
  for (const sel of initialSelections) {
    byItemId.set(sel.kitItemId, sel);
  }

  const drafts: Record<string, SelectionDraft> = {};
  for (const item of kitItems) {
    const existing = byItemId.get(item.id);
    const defaultFit =
      existing?.fit && item.availableFits.includes(existing.fit)
        ? existing.fit
        : item.availableFits[0] || '';
    drafts[item.id] = {
      size: existing?.size || '',
      fit: existing?.size ? defaultFit : existing?.fit || '',
      notes: existing?.notes || '',
    };
  }
  return drafts;
}

export function KitSizingForm({
  kitItems,
  initialSelections,
  participantName,
  eventName,
  onSaved,
}: KitSizingFormProps) {
  const { toast } = useToast();

  const [drafts, setDrafts] = useState<Record<string, SelectionDraft>>(() =>
    buildInitialDrafts(kitItems, initialSelections)
  );
  const [quickBaseSize, setQuickBaseSize] = useState<string>('');
  const [openGuides, setOpenGuides] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [missingItemIds, setMissingItemIds] = useState<string[]>([]);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Sync drafts if parent refreshes kitItems or initialSelections
  useEffect(() => {
    let cancelled = false;
    async function syncFromProps() {
      await Promise.resolve();
      if (cancelled) return;
      setDrafts(buildInitialDrafts(kitItems, initialSelections));
      setHasUnsavedChanges(false);
      setMissingItemIds([]);
      setFormError(null);
    }
    void syncFromProps();
    return () => {
      cancelled = true;
    };
  }, [kitItems, initialSelections]);

  const activeItems = useMemo(
    () =>
      [...kitItems]
        .filter((item) => item.isActive)
        .sort((a, b) => a.sortOrder - b.sortOrder),
    [kitItems]
  );

  const requiredItems = useMemo(
    () => activeItems.filter((item) => item.isRequired),
    [activeItems]
  );

  const selectedRequiredCount = useMemo(
    () =>
      requiredItems.filter((item) => Boolean(drafts[item.id]?.size?.trim()))
        .length,
    [requiredItems, drafts]
  );

  const serverRequiredComplete = useMemo(() => {
    if (requiredItems.length === 0) {
      return initialSelections.length > 0;
    }
    const savedSet = new Set(
      initialSelections
        .filter((sel) => Boolean(sel.size?.trim()))
        .map((sel) => sel.kitItemId)
    );
    return requiredItems.every((item) => savedSet.has(item.id));
  }, [requiredItems, initialSelections]);

  const isConfirmedOnServer = serverRequiredComplete && !hasUnsavedChanges;

  const progressPercent =
    requiredItems.length > 0
      ? Math.round((selectedRequiredCount / requiredItems.length) * 100)
      : activeItems.length > 0
        ? Math.round(
            (activeItems.filter((i) => Boolean(drafts[i.id]?.size?.trim()))
              .length /
              activeItems.length) *
              100
          )
        : 0;

  const groupedItems = useMemo(() => {
    const groups = new Map<string, EventKitItemDTO[]>();
    for (const cat of CATEGORY_ORDER) {
      groups.set(cat, []);
    }
    const extraCategories: string[] = [];

    for (const item of activeItems) {
      const cat = (item.category || 'SUPERIOR').toUpperCase();
      if (!groups.has(cat)) {
        groups.set(cat, []);
        extraCategories.push(cat);
      }
      groups.get(cat)!.push(item);
    }

    const orderedKeys = [...CATEGORY_ORDER, ...extraCategories];
    return orderedKeys
      .map((cat) => ({
        category: cat,
        meta: CATEGORY_META[cat] || {
          title: `Categoría ${cat}`,
          subtitle: 'Prendas del equipamiento oficial',
        },
        items: groups.get(cat) || [],
      }))
      .filter((group) => group.items.length > 0);
  }, [activeItems]);

  const updateItemDraft = (
    item: EventKitItemDTO,
    patch: Partial<SelectionDraft>
  ) => {
    setDrafts((prev) => {
      const current = prev[item.id] || { size: '', fit: '', notes: '' };
      const nextSize = patch.size !== undefined ? patch.size : current.size;
      let nextFit = patch.fit !== undefined ? patch.fit : current.fit;

      if (
        nextSize &&
        item.availableFits.length > 0 &&
        (!nextFit || !item.availableFits.includes(nextFit))
      ) {
        nextFit = item.availableFits[0];
      }

      return {
        ...prev,
        [item.id]: {
          size: nextSize,
          fit: nextFit,
          notes: patch.notes !== undefined ? patch.notes : current.notes,
        },
      };
    });
    setHasUnsavedChanges(true);
    setFormError(null);
    if (patch.size) {
      setMissingItemIds((prev) => prev.filter((id) => id !== item.id));
    }
  };

  const applyBaseSize = (targetSize: string, overwriteExisting: boolean) => {
    setQuickBaseSize(targetSize);
    let updatedCount = 0;

    setDrafts((prev) => {
      const next = { ...prev };
      for (const item of activeItems) {
        if (!item.availableSizes.includes(targetSize)) {
          continue;
        }
        const current = next[item.id] || { size: '', fit: '', notes: '' };
        if (!overwriteExisting && current.size.trim()) {
          continue;
        }
        const fit =
          current.fit && item.availableFits.includes(current.fit)
            ? current.fit
            : item.availableFits[0] || '';
        next[item.id] = {
          ...current,
          size: targetSize,
          fit,
        };
        updatedCount += 1;
      }
      return next;
    });

    if (updatedCount > 0) {
      setHasUnsavedChanges(true);
      setFormError(null);
      setMissingItemIds([]);
      toast.info(
        overwriteExisting
          ? `Talla ${targetSize} aplicada a ${updatedCount} prenda(s) compatibles.`
          : `Talla sugerida ${targetSize} aplicada a ${updatedCount} prenda(s) sin selección.`
      );
    } else if (!overwriteExisting) {
      toast.info(
        `Las prendas compatibles ya tienen talla elegida. Usa "Aplicar talla base a todas" para reemplazarlas por ${targetSize}.`
      );
    }
  };

  const toggleGuide = (itemId: string) => {
    setOpenGuides((prev) => ({ ...prev, [itemId]: !prev[itemId] }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const missing = requiredItems.filter(
      (item) => !drafts[item.id]?.size?.trim()
    );

    if (missing.length > 0) {
      setMissingItemIds(missing.map((m) => m.id));
      const names = missing.map((m) => m.name).join(', ');
      const msg = `Debes elegir talla en todas las prendas obligatorias antes de confirmar: ${names}.`;
      setFormError(msg);
      toast.error(msg, 'Faltan tallas obligatorias');
      return;
    }

    const selections = activeItems
      .map((item) => {
        const draft = drafts[item.id];
        if (!draft || !draft.size.trim()) return null;
        return {
          kitItemId: item.id,
          size: draft.size.trim(),
          fit:
            item.availableFits.length > 0
              ? draft.fit || item.availableFits[0]
              : null,
          notes: draft.notes.trim() ? draft.notes.trim().slice(0, 120) : null,
        };
      })
      .filter((entry): entry is NonNullable<typeof entry> => entry !== null);

    if (selections.length === 0) {
      const msg = 'Selecciona al menos una talla antes de guardar.';
      setFormError(msg);
      toast.error(msg);
      return;
    }

    try {
      setSaving(true);
      const res = await fetch('/api/portal/kit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ selections }),
      });

      const data = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        error?: string;
      };

      if (!res.ok) {
        throw new Error(data.error || 'No se pudieron guardar las tallas del kit');
      }

      setHasUnsavedChanges(false);
      setMissingItemIds([]);
      toast.success(
        'Tus tallas del kit fueron confirmadas y registradas correctamente.',
        'Kit confirmado'
      );
      await onSaved();
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : 'Error inesperado al guardar tallas del kit';
      setFormError(msg);
      toast.error(msg, 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  if (activeItems.length === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-3xl p-8 text-center shadow-xs space-y-2">
        <Shirt className="w-10 h-10 text-slate-300 mx-auto" />
        <h2 className="text-base font-black text-[#001558]">
          Catálogo de Kit aún no configurado
        </h2>
        <p className="text-xs text-slate-600 max-w-md mx-auto">
          La coordinación de {eventName} aún no ha publicado las prendas para
          levantamiento de tallas.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Cabecera de avance */}
      <section className="bg-white border border-slate-200 border-t-4 border-t-[#001558] rounded-3xl p-5 sm:p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg sm:text-xl font-black text-[#001558] flex items-center gap-2">
                <Shirt className="w-5 h-5 text-[#FEB135]" />
                Levantamiento de Tallas del Kit
              </h2>
              <span
                className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold border ${
                  isConfirmedOnServer
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                    : 'bg-[#FFF8E1] text-[#001558] border-[#FEB135]'
                }`}
              >
                {isConfirmedOnServer ? (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    Confirmado
                  </>
                ) : (
                  'Pendiente'
                )}
              </span>
            </div>
            <p className="text-xs text-slate-600">
              {participantName} • {eventName}
            </p>
          </div>

          <div className="text-left sm:text-right shrink-0">
            <span className="block text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Progreso obligatorio
            </span>
            <span className="text-sm font-black text-[#001558]">
              {selectedRequiredCount} de {requiredItems.length} prendas
              obligatorias seleccionadas
            </span>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="space-y-1.5">
          <div
            className="w-full h-3 rounded-full bg-[#F5F6F8] border border-slate-200 overflow-hidden"
            role="progressbar"
            aria-valuenow={progressPercent}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Avance de selección de prendas obligatorias"
          >
            <div
              className={`h-full transition-all duration-300 ${
                progressPercent === 100 ? 'bg-emerald-600' : 'bg-[#001558]'
              }`}
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          {hasUnsavedChanges && (
            <p className="text-[11px] font-bold text-amber-800 print:hidden">
              Tienes cambios sin confirmar. Revisa el resumen al final y presiona
              &quot;Confirmar y Guardar Tallas del Kit&quot;.
            </p>
          )}
        </div>
      </section>

      {/* Talla base rápida */}
      <section className="bg-[#FFFBF0] border border-[#FEB135]/70 rounded-3xl p-5 shadow-xs space-y-3 print:hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-xs font-black uppercase tracking-wider text-[#001558] flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-[#FEB135]" />
              Talla base rápida
            </h3>
            <p className="text-xs text-slate-700 mt-0.5">
              Elige tu talla habitual para pre-rellenar las prendas de vestir que
              aún no tienen selección (puedes ajustar cada prenda después).
            </p>
          </div>

          {quickBaseSize && (
            <button
              type="button"
              onClick={() => applyBaseSize(quickBaseSize, true)}
              className="px-3.5 py-2 rounded-xl bg-[#001558] hover:bg-[#0b2370] text-white text-xs font-extrabold transition-colors cursor-pointer shrink-0 shadow-2xs"
            >
              Aplicar talla base ({quickBaseSize}) a todas
            </button>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          {STANDARD_BASE_SIZES.map((sz) => {
            const active = quickBaseSize === sz;
            return (
              <button
                key={sz}
                type="button"
                onClick={() => applyBaseSize(sz, false)}
                aria-pressed={active}
                className={`min-w-[48px] px-3.5 py-2 rounded-xl text-xs font-black transition-all cursor-pointer border ${
                  active
                    ? 'bg-[#001558] text-white border-[#FEB135] ring-2 ring-[#FEB135]/60'
                    : 'bg-white hover:bg-slate-50 text-[#001558] border-slate-300 hover:border-[#001558]'
                }`}
              >
                {sz}
              </button>
            );
          })}
        </div>

        <div className="flex items-start gap-2 pt-1 text-[11px] text-[#001558] bg-white/80 border border-[#FEB135]/40 rounded-xl px-3 py-2">
          <Info className="w-4 h-4 text-[#FEB135] shrink-0 mt-0.5" />
          <span>
            <strong>Recomendación práctica:</strong> Para cortavientos o
            chaquetas exteriores considera <strong>1 talla mayor</strong> si
            usarás polerón debajo. Gorros/sombreros se eligen por contorno de
            cabeza en centímetros.
          </span>
        </div>
      </section>

      {formError && (
        <div
          role="alert"
          className="p-4 rounded-2xl bg-red-50 border border-red-200 text-red-800 text-xs flex items-start gap-2.5 font-semibold"
        >
          <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
          <span>{formError}</span>
        </div>
      )}

      {/* Prendas agrupadas por categoría */}
      <div className="space-y-6">
        {groupedItems.map((group) => (
          <section key={group.category} className="space-y-3">
            <div className="flex items-baseline justify-between gap-2 px-1">
              <div>
                <h3 className="text-sm font-black text-[#001558] uppercase tracking-wider border-l-4 border-[#FEB135] pl-2.5">
                  {group.meta.title}
                </h3>
                <p className="text-[11px] text-slate-500 pl-3.5">
                  {group.meta.subtitle}
                </p>
              </div>
              <span className="text-[11px] font-bold text-slate-500">
                {group.items.length} prenda{group.items.length === 1 ? '' : 's'}
              </span>
            </div>

            <div className="grid grid-cols-1 gap-4">
              {group.items.map((item) => {
                const draft = drafts[item.id] || {
                  size: '',
                  fit: '',
                  notes: '',
                };
                const isMissing = missingItemIds.includes(item.id);
                const guideOpen = Boolean(openGuides[item.id]);
                const visibleGuideColumns = SIZE_GUIDE_COLUMNS.filter((col) =>
                  item.sizeGuide.some((row) => Boolean(row[col.key]?.trim()))
                );
                const hasHeadGuide = item.sizeGuide.some((row) =>
                  Boolean(row.headCm?.trim())
                );

                return (
                  <article
                    key={item.id}
                    className={`bg-white rounded-3xl border p-5 shadow-xs space-y-4 transition-colors ${
                      isMissing
                        ? 'border-red-400 ring-2 ring-red-100'
                        : draft.size
                          ? 'border-slate-200 border-l-4 border-l-[#001558]'
                          : 'border-slate-200'
                    }`}
                  >
                    {/* Header de prenda */}
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className="text-base font-black text-[#001558]">
                            {item.name}
                          </h4>
                          <span className="px-2 py-0.5 rounded-lg bg-[#FFF8E1] border border-[#FEB135] text-[#001558] font-mono text-[11px] font-black">
                            x{item.includedQuantity}
                          </span>
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider border ${
                              item.isRequired
                                ? 'bg-[#EEF2FF] text-[#001558] border-[#001558]/20'
                                : 'bg-slate-100 text-slate-600 border-slate-200'
                            }`}
                          >
                            {item.isRequired ? 'Obligatoria' : 'Opcional'}
                          </span>
                        </div>
                        {item.description && (
                          <p className="text-xs text-slate-600">
                            {item.description}
                          </p>
                        )}
                      </div>

                      {draft.size && (
                        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-extrabold shrink-0">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          <span>
                            {draft.size}
                            {draft.fit ? ` • ${draft.fit}` : ''}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Selector táctil de tallas */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600">
                          Selecciona tu talla {item.isRequired ? '*' : ''}
                        </span>
                        {!item.isRequired && draft.size && (
                          <button
                            type="button"
                            onClick={() =>
                              updateItemDraft(item, { size: '', fit: '' })
                            }
                            className="text-[11px] font-bold text-slate-500 hover:text-red-700 cursor-pointer print:hidden"
                          >
                            Limpiar selección
                          </button>
                        )}
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {item.availableSizes.map((sz) => {
                          const selected = draft.size === sz;
                          return (
                            <button
                              key={sz}
                              type="button"
                              onClick={() =>
                                updateItemDraft(item, { size: sz })
                              }
                              aria-pressed={selected}
                              className={`min-w-[52px] min-h-[42px] px-3.5 py-2 rounded-xl text-xs font-black transition-all cursor-pointer border-2 ${
                                selected
                                  ? 'bg-[#001558] text-white border-[#FEB135] shadow-xs'
                                  : 'bg-[#F5F6F8] hover:bg-[#FFFBF0] text-[#001558] border-slate-200 hover:border-[#001558]'
                              }`}
                            >
                              {sz}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Selector de Corte / Fit */}
                    {item.availableFits.length > 0 && (
                      <div className="space-y-1.5">
                        <span className="block text-[11px] font-bold uppercase tracking-wider text-slate-600">
                          Corte / Fit
                        </span>
                        <div className="flex flex-wrap gap-2">
                          {item.availableFits.map((fitOption) => {
                            const selected =
                              (draft.fit || item.availableFits[0]) === fitOption;
                            return (
                              <button
                                key={fitOption}
                                type="button"
                                onClick={() =>
                                  updateItemDraft(item, { fit: fitOption })
                                }
                                aria-pressed={selected}
                                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                                  selected
                                    ? 'bg-[#FFFBF0] text-[#001558] border-[#001558] ring-2 ring-[#FEB135]/60 font-extrabold'
                                    : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-300'
                                }`}
                              >
                                {fitOption}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Acordeón Guía de Medidas */}
                    {item.sizeGuide.length > 0 && (
                      <div className="border border-slate-200 rounded-2xl overflow-hidden bg-[#F5F6F8]/60 print:hidden">
                        <button
                          type="button"
                          onClick={() => toggleGuide(item.id)}
                          aria-expanded={guideOpen}
                          className="w-full px-4 py-2.5 flex items-center justify-between gap-2 text-left text-xs font-extrabold text-[#001558] hover:bg-[#FFFBF0] transition-colors cursor-pointer"
                        >
                          <span className="inline-flex items-center gap-2">
                            <Ruler className="w-4 h-4 text-[#FEB135]" />
                            Ver guía de medidas (cm) y cómo medirte
                          </span>
                          {guideOpen ? (
                            <ChevronUp className="w-4 h-4 text-slate-500" />
                          ) : (
                            <ChevronDown className="w-4 h-4 text-slate-500" />
                          )}
                        </button>

                        {guideOpen && (
                          <div className="p-4 bg-white border-t border-slate-200 space-y-3">
                            <div className="overflow-x-auto">
                              <table className="w-full text-left border-collapse text-xs">
                                <thead>
                                  <tr className="bg-[#F5F6F8] border-b border-slate-200 text-[10px] font-black uppercase tracking-wider text-slate-600">
                                    <th className="py-2 px-3">Talla</th>
                                    {visibleGuideColumns.map((col) => (
                                      <th key={col.key} className="py-2 px-3">
                                        {col.label}
                                      </th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                  {item.sizeGuide.map((row) => {
                                    const isRowSelected =
                                      draft.size === row.size;
                                    return (
                                      <tr
                                        key={row.size}
                                        className={
                                          isRowSelected
                                            ? 'bg-[#FFFBF0] font-bold text-[#001558]'
                                            : 'hover:bg-slate-50 text-slate-700'
                                        }
                                      >
                                        <td className="py-2 px-3 font-mono font-black text-[#001558] whitespace-nowrap">
                                          {row.size}
                                        </td>
                                        {visibleGuideColumns.map((col) => (
                                          <td
                                            key={col.key}
                                            className="py-2 px-3 whitespace-nowrap"
                                          >
                                            {row[col.key] || '—'}
                                          </td>
                                        ))}
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>

                            <div className="bg-[#EEF2FF]/70 border border-[#001558]/15 rounded-xl p-3 text-[11px] text-slate-700 space-y-1">
                              <p className="font-extrabold text-[#001558]">
                                Cómo medirte correctamente:
                              </p>
                              <p>
                                {hasHeadGuide
                                  ? 'Usa una huincha flexible sin apretar alrededor de tu cabeza, pasando aprox. 1 cm sobre las cejas y orejas.'
                                  : 'Usa una huincha flexible sin apretar sobre ropa liviana (o mide una prenda similar que te quede cómoda estirada en superficie plana). Si estás entre dos tallas, elige la mayor.'}
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Nota opcional corta por prenda */}
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <label
                          htmlFor={`kit-note-${item.id}`}
                          className="text-[11px] font-bold text-slate-600"
                        >
                          Nota opcional para esta prenda (máx. 120 caracteres)
                        </label>
                        {draft.notes.length > 0 && (
                          <span className="text-[10px] font-mono text-slate-400">
                            {draft.notes.length}/120
                          </span>
                        )}
                      </div>
                      <input
                        id={`kit-note-${item.id}`}
                        type="text"
                        maxLength={120}
                        value={draft.notes}
                        onChange={(e) =>
                          updateItemDraft(item, { notes: e.target.value })
                        }
                        placeholder="Ej: Prefiero holgada para usar con primera capa"
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:border-[#001558] focus:ring-2 focus:ring-[#FEB135]/50 focus:outline-none transition-all"
                      />
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        ))}
      </div>

      {/* Resumen final + acciones */}
      <section className="bg-white border border-slate-200 rounded-3xl p-5 sm:p-6 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-200">
          <div>
            <h3 className="text-sm font-black text-[#001558] uppercase tracking-wider">
              Resumen de Tallas Seleccionadas
            </h3>
            <p className="text-xs text-slate-500">
              Verifica todas tus prendas antes de confirmar o imprimir tu
              respaldo.
            </p>
          </div>
          <span className="text-xs font-bold text-[#001558]">
            {
              activeItems.filter((item) => Boolean(drafts[item.id]?.size?.trim()))
                .length
            }{' '}
            de {activeItems.length} prendas elegidas
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
          {activeItems.map((item) => {
            const draft = drafts[item.id];
            const hasSize = Boolean(draft?.size?.trim());
            return (
              <div
                key={item.id}
                className={`p-3 rounded-2xl border text-xs flex flex-col justify-between gap-1 ${
                  hasSize
                    ? 'bg-[#F5F6F8] border-slate-200'
                    : item.isRequired
                      ? 'bg-amber-50/70 border-amber-300'
                      : 'bg-white border-dashed border-slate-200'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="font-bold text-[#001558] leading-snug">
                    {item.name}
                  </span>
                  <span className="font-mono text-[10px] font-bold text-slate-500 shrink-0">
                    x{item.includedQuantity}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2 pt-1">
                  <span
                    className={`font-black ${
                      hasSize
                        ? 'text-[#001558]'
                        : item.isRequired
                          ? 'text-amber-800'
                          : 'text-slate-400'
                    }`}
                  >
                    {hasSize
                      ? `${draft.size}${draft.fit ? ` (${draft.fit})` : ''}`
                      : item.isRequired
                        ? 'Pendiente (Obligatoria)'
                        : 'Sin selección (Opcional)'}
                  </span>
                </div>
                {draft?.notes?.trim() && (
                  <p className="text-[10px] text-slate-500 italic truncate">
                    Nota: {draft.notes.trim()}
                  </p>
                )}
              </div>
            );
          })}
        </div>

        <div className="pt-3 border-t border-slate-200 flex flex-col-reverse sm:flex-row sm:items-center justify-between gap-3 print:hidden">
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-white hover:bg-slate-50 border border-slate-300 text-[#001558] text-xs font-bold cursor-pointer transition-colors"
          >
            <Printer className="w-4 h-4" />
            Imprimir tallas
          </button>

          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-[#001558] hover:bg-[#0b2370] text-white font-black text-xs uppercase tracking-wider shadow-md disabled:opacity-50 cursor-pointer transition-all"
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Confirmando tallas...
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4 text-[#FEB135]" />
                Confirmar y Guardar Tallas del Kit
              </>
            )}
          </button>
        </div>
      </section>
    </form>
  );
}
