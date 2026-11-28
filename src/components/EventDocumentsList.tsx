'use client';

import React, { useMemo, useState } from 'react';
import {
  Calendar,
  Download,
  ExternalLink,
  FileText,
  FilterX,
  Pin,
  Search,
  Users,
} from 'lucide-react';
import {
  DOCUMENT_AUDIENCES,
  DOCUMENT_CATEGORIES,
  formatFileSize,
  getDocumentAudienceMeta,
  getDocumentCategoryMeta,
  getFileTypeBadge,
} from '@/lib/eventDocuments';
import type { EventDocumentDTO } from '@/types/domain';

interface EventDocumentsListProps {
  documents: EventDocumentDTO[];
  eventCode?: string | null;
  compact?: boolean;
  emptyMessage?: string;
}

function formatDocDate(value?: string | Date | null): string {
  if (!value) return 'Sin fecha';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'Sin fecha';
  return parsed.toLocaleDateString('es-CL', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function DocumentCard({
  doc,
  compact,
}: {
  doc: EventDocumentDTO;
  compact?: boolean;
}) {
  const categoryMeta = getDocumentCategoryMeta(doc.category);
  const audienceMeta = getDocumentAudienceMeta(doc.audience);
  const fileBadge = getFileTypeBadge(
    doc.mimeType,
    doc.fileName,
    doc.storageType
  );
  const isExternal = doc.storageType === 'EXTERNAL_LINK';
  const docEndpoint = `/api/public/documents/${encodeURIComponent(doc.id)}`;

  return (
    <article
      className={`bg-white border rounded-2xl transition-all hover:shadow-md ${
        doc.isPinned
          ? 'border-[#FEB135] bg-gradient-to-br from-[#FFFBF0] via-white to-white shadow-xs'
          : 'border-slate-200 hover:border-[#001558]/30'
      } ${compact ? 'p-4' : 'p-5'}`}
    >
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div className="flex items-start gap-3.5 min-w-0 flex-1">
          {/* File type badge */}
          <div
            className={`w-11 h-11 rounded-xl border flex flex-col items-center justify-center shrink-0 font-black text-[10px] tracking-tight ${fileBadge.badgeClass}`}
          >
            <FileText className="w-4 h-4 mb-0.5" />
            <span>{fileBadge.label}</span>
          </div>

          <div className="min-w-0 flex-1 space-y-1.5">
            {/* Pills row */}
            <div className="flex flex-wrap items-center gap-1.5">
              {doc.isPinned && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#FEB135] text-[#001558] text-[10px] font-black uppercase tracking-wider">
                  <Pin className="w-2.5 h-2.5" />
                  Destacado
                </span>
              )}
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold border ${categoryMeta.badgeClass}`}
              >
                {categoryMeta.shortLabel}
              </span>
              {doc.documentCode && (
                <span className="px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200 text-slate-700 font-mono text-[10px] font-bold">
                  {doc.documentCode}
                </span>
              )}
              <span
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${audienceMeta.badgeClass}`}
              >
                <Users className="w-2.5 h-2.5" />
                {audienceMeta.label}
              </span>
            </div>

            <h4 className="text-sm sm:text-base font-extrabold text-[#001558] leading-snug">
              {doc.title}
            </h4>

            {doc.summary && (
              <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-line">
                {doc.summary}
              </p>
            )}

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pt-1 text-[11px] text-slate-500">
              <span className="inline-flex items-center gap-1">
                <Calendar className="w-3 h-3 text-slate-400" />
                Publicado: {formatDocDate(doc.publishedAt || doc.createdAt)}
              </span>
              {isExternal ? (
                <span className="inline-flex items-center gap-1 text-sky-700 font-semibold">
                  <ExternalLink className="w-3 h-3" />
                  Documento en enlace externo
                </span>
              ) : (
                <span>
                  {doc.fileName || 'Archivo'} • {formatFileSize(doc.sizeBytes)}
                </span>
              )}
              <span>
                {doc.downloadCount}{' '}
                {doc.downloadCount === 1 ? 'descarga' : 'descargas'}
              </span>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex sm:flex-col items-stretch sm:items-end gap-2 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
          {isExternal ? (
            <a
              href={docEndpoint}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-[#001558] hover:bg-[#0b2370] text-white text-xs font-extrabold transition-colors shadow-xs whitespace-nowrap"
            >
              <ExternalLink className="w-3.5 h-3.5 text-[#FEB135]" />
              Abrir Enlace
            </a>
          ) : (
            <>
              {fileBadge.canInlinePreview && (
                <a
                  href={docEndpoint}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#EEF2FF] hover:bg-[#dce4ff] border border-[#001558]/20 text-[#001558] text-xs font-extrabold transition-colors whitespace-nowrap"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Ver
                </a>
              )}
              <a
                href={`${docEndpoint}?download=1`}
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-[#FEB135] hover:bg-[#e59c22] text-[#001558] text-xs font-black transition-colors shadow-xs whitespace-nowrap"
              >
                <Download className="w-3.5 h-3.5" />
                Descargar
              </a>
            </>
          )}
        </div>
      </div>
    </article>
  );
}

export function EventDocumentsList({
  documents,
  compact = false,
  emptyMessage = 'Aún no hay documentos publicados para este evento.',
}: EventDocumentsListProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedAudience, setSelectedAudience] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState('');

  const countsByCategory = useMemo(() => {
    const map: Record<string, number> = {};
    for (const d of documents) {
      const key = (d.category || 'OTRO').toUpperCase();
      map[key] = (map[key] || 0) + 1;
    }
    return map;
  }, [documents]);

  const hasActiveFilter =
    selectedCategory !== 'ALL' ||
    selectedAudience !== 'ALL' ||
    searchTerm.trim().length > 0;

  const filteredDocuments = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    return documents.filter((d) => {
      if (
        selectedCategory !== 'ALL' &&
        (d.category || '').toUpperCase() !== selectedCategory
      ) {
        return false;
      }
      if (
        selectedAudience !== 'ALL' &&
        (d.audience || '').toUpperCase() !== selectedAudience
      ) {
        return false;
      }
      if (!query) return true;
      return (
        d.title.toLowerCase().includes(query) ||
        (d.summary || '').toLowerCase().includes(query) ||
        (d.documentCode || '').toLowerCase().includes(query) ||
        (d.fileName || '').toLowerCase().includes(query)
      );
    });
  }, [documents, selectedCategory, selectedAudience, searchTerm]);

  const pinnedDocuments = useMemo(
    () => (hasActiveFilter ? [] : filteredDocuments.filter((d) => d.isPinned)),
    [hasActiveFilter, filteredDocuments]
  );

  const regularDocuments = useMemo(
    () =>
      hasActiveFilter
        ? filteredDocuments
        : filteredDocuments.filter((d) => !d.isPinned),
    [hasActiveFilter, filteredDocuments]
  );

  const resetFilters = () => {
    setSelectedCategory('ALL');
    setSelectedAudience('ALL');
    setSearchTerm('');
  };

  if (documents.length === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center space-y-2">
        <div className="w-12 h-12 rounded-2xl bg-[#EEF2FF] border border-[#001558]/15 flex items-center justify-center mx-auto text-[#001558]">
          <FileText className="w-6 h-6" />
        </div>
        <p className="text-sm font-extrabold text-[#001558]">
          Sin documentos publicados todavía
        </p>
        <p className="text-xs text-slate-500 max-w-md mx-auto">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filter Controls */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3 shadow-2xs">
        <div className="flex flex-col sm:flex-row gap-2.5">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar circular, código, ficha o palabra clave..."
              aria-label="Buscar documentos"
              className="w-full pl-9 pr-3 py-2 bg-[#F5F6F8] border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:border-[#001558] focus:ring-2 focus:ring-[#FEB135]/50 focus:outline-none transition-all"
            />
          </div>

          <select
            value={selectedAudience}
            onChange={(e) => setSelectedAudience(e.target.value)}
            aria-label="Filtrar por destinatario"
            className="sm:w-56 px-3 py-2 bg-[#F5F6F8] border border-slate-200 rounded-xl text-xs font-bold text-[#001558] focus:bg-white focus:border-[#001558] focus:ring-2 focus:ring-[#FEB135]/50 focus:outline-none"
          >
            <option value="ALL">Todos los destinatarios</option>
            {DOCUMENT_AUDIENCES.map((aud) => (
              <option key={aud.value} value={aud.value}>
                {aud.label}
              </option>
            ))}
          </select>

          {hasActiveFilter && (
            <button
              type="button"
              onClick={resetFilters}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors cursor-pointer shrink-0"
            >
              <FilterX className="w-3.5 h-3.5" />
              Limpiar
            </button>
          )}
        </div>

        {/* Category pills */}
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setSelectedCategory('ALL')}
            className={`px-3 py-1.5 rounded-xl text-xs font-extrabold border transition-colors cursor-pointer ${
              selectedCategory === 'ALL'
                ? 'bg-[#001558] text-white border-[#001558]'
                : 'bg-[#F5F6F8] text-slate-700 border-slate-200 hover:border-[#001558]/40'
            }`}
          >
            Todos ({documents.length})
          </button>
          {DOCUMENT_CATEGORIES.map((cat) => {
            const count = countsByCategory[cat.value] || 0;
            if (count === 0) return null;
            const active = selectedCategory === cat.value;
            return (
              <button
                type="button"
                key={cat.value}
                onClick={() => setSelectedCategory(cat.value)}
                className={`px-3 py-1.5 rounded-xl text-xs font-extrabold border transition-colors cursor-pointer ${
                  active
                    ? 'bg-[#001558] text-white border-[#001558]'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-[#EEF2FF] hover:text-[#001558]'
                }`}
              >
                {cat.label} ({count})
              </button>
            );
          })}
        </div>
      </div>

      {/* Results */}
      {filteredDocuments.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 text-center space-y-2">
          <p className="text-sm font-bold text-[#001558]">
            No se encontraron documentos con los filtros actuales
          </p>
          <button
            type="button"
            onClick={resetFilters}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#EEF2FF] text-[#001558] text-xs font-bold cursor-pointer hover:bg-[#dce4ff]"
          >
            <FilterX className="w-3.5 h-3.5" />
            Mostrar todos los documentos ({documents.length})
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {pinnedDocuments.length > 0 && (
            <div className="space-y-2.5">
              <div className="flex items-center gap-2 text-xs font-black text-[#001558] uppercase tracking-wider px-1">
                <Pin className="w-3.5 h-3.5 text-[#FEB135]" />
                Documentos Destacados ({pinnedDocuments.length})
              </div>
              <div className="space-y-3">
                {pinnedDocuments.map((doc) => (
                  <DocumentCard key={doc.id} doc={doc} compact={compact} />
                ))}
              </div>
            </div>
          )}

          {regularDocuments.length > 0 && (
            <div className="space-y-2.5">
              {pinnedDocuments.length > 0 && (
                <div className="text-xs font-black text-slate-500 uppercase tracking-wider px-1 pt-1">
                  Repositorio de Documentos ({regularDocuments.length})
                </div>
              )}
              <div className="space-y-3">
                {regularDocuments.map((doc) => (
                  <DocumentCard key={doc.id} doc={doc} compact={compact} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
