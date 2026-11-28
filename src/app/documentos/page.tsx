'use client';

import React, { useCallback, useEffect, useId, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  Copy,
  Download,
  ExternalLink,
  Eye,
  EyeOff,
  FileText,
  FilterX,
  Globe,
  Link2,
  Loader2,
  Pencil,
  Pin,
  Plus,
  RefreshCw,
  Save,
  Search,
  Sparkles,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { AppShell, useAppShell } from '@/components/AppShell';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useToast } from '@/components/ui/ToastProvider';
import {
  ALLOWED_UPLOAD_ACCEPT,
  DOCUMENT_AUDIENCES,
  DOCUMENT_CATEGORIES,
  MAX_DOCUMENT_BYTES,
  formatFileSize,
  getDocumentAudienceMeta,
  getDocumentCategoryMeta,
  getFileTypeBadge,
  safeHexColor,
} from '@/lib/eventDocuments';
import type {
  EventDocumentDTO,
  EventDocumentStorageType,
  EventHighlightDTO,
  EventPermissions,
  EventSummary,
} from '@/types/domain';

type ConsoleTab = 'documents' | 'page_info';
type StatusFilter = 'ALL' | 'PUBLISHED' | 'DRAFT';

interface DocumentsApiSummary {
  total: number;
  published: number;
  drafts: number;
  totalDownloads: number;
  byCategory: Record<string, number>;
}

const EMPTY_SUMMARY: DocumentsApiSummary = {
  total: 0,
  published: 0,
  drafts: 0,
  totalDownloads: 0,
  byCategory: {},
};

const INPUT_CLASS =
  'w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-slate-800 placeholder-slate-400 focus:border-[#001558] focus:ring-2 focus:ring-[#FEB135]/50 focus:outline-none transition-all';

function toDateInputValue(val?: string | Date | null): string {
  if (!val) return '';
  const d = new Date(val);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
}

function formatShortDate(val?: string | Date | null): string {
  if (!val) return '—';
  const d = new Date(val);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('es-CL', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function DocumentConsoleContent() {
  const { activeEvent, permissions, user, eventVersion, refreshStats } =
    useAppShell();
  const { toast } = useToast();
  const modalTitleId = useId();

  const [activeTab, setActiveTab] = useState<ConsoleTab>('documents');

  // Documents tab state
  const [loadingDocs, setLoadingDocs] = useState(true);
  const [documents, setDocuments] = useState<EventDocumentDTO[]>([]);
  const [docSummary, setDocSummary] =
    useState<DocumentsApiSummary>(EMPTY_SUMMARY);
  const [docPermissions, setDocPermissions] =
    useState<EventPermissions | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [docToDelete, setDocToDelete] = useState<EventDocumentDTO | null>(null);
  const [deletingDoc, setDeletingDoc] = useState(false);

  // Document modal state
  const [isDocModalOpen, setIsDocModalOpen] = useState(false);
  const [editingDoc, setEditingDoc] = useState<EventDocumentDTO | null>(null);
  const [savingDoc, setSavingDoc] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [isDraggingFile, setIsDraggingFile] = useState(false);

  const [formTitle, setFormTitle] = useState('');
  const [formSummary, setFormSummary] = useState('');
  const [formCategory, setFormCategory] = useState('CIRCULAR');
  const [formCode, setFormCode] = useState('');
  const [formAudience, setFormAudience] = useState('GENERAL');
  const [formStorageType, setFormStorageType] =
    useState<EventDocumentStorageType>('UPLOAD');
  const [formExternalUrl, setFormExternalUrl] = useState('');
  const [formFile, setFormFile] = useState<File | null>(null);
  const [formPublishedAt, setFormPublishedAt] = useState('');
  const [formIsPublished, setFormIsPublished] = useState(true);
  const [formIsPinned, setFormIsPinned] = useState(false);

  // Event page config tab state
  const [loadingPageInfo, setLoadingPageInfo] = useState(true);
  const [savingPageInfo, setSavingPageInfo] = useState(false);
  const [pageInfoError, setPageInfoError] = useState<string | null>(null);
  const [isPublicPagePublished, setIsPublicPagePublished] = useState(true);
  const [publicHeadline, setPublicHeadline] = useState('');
  const [publicSummary, setPublicSummary] = useState('');
  const [venueDetails, setVenueDetails] = useState('');
  const [registrationInfo, setRegistrationInfo] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [officialWebsiteUrl, setOfficialWebsiteUrl] = useState('');
  const [bannerUrl, setBannerUrl] = useState('');
  const [themeColor, setThemeColor] = useState('#001558');
  const [accentColor, setAccentColor] = useState('#FEB135');
  const [highlights, setHighlights] = useState<EventHighlightDTO[]>([]);

  const activeEventId = activeEvent?.id ?? null;
  const effectivePerms = docPermissions || permissions;
  const canManageDocuments = Boolean(effectivePerms?.canManageDocuments);
  const canManageEventPage = Boolean(effectivePerms?.canManageEventPage);

  const loadDocuments = useCallback(async () => {
    if (!activeEventId) {
      setDocuments([]);
      setDocSummary(EMPTY_SUMMARY);
      setLoadingDocs(false);
      return;
    }
    setLoadingDocs(true);
    try {
      const res = await fetch(
        `/api/documents?eventId=${encodeURIComponent(activeEventId)}`
      );
      if (!res.ok) {
        throw new Error('No se pudieron cargar los documentos');
      }
      const data = (await res.json()) as {
        documents?: EventDocumentDTO[];
        summary?: DocumentsApiSummary;
        permissions?: EventPermissions;
      };
      setDocuments(data.documents || []);
      setDocSummary(data.summary || EMPTY_SUMMARY);
      if (data.permissions) setDocPermissions(data.permissions);
    } catch (err: unknown) {
      toast.error(
        err instanceof Error ? err.message : 'Error cargando documentos'
      );
    } finally {
      setLoadingDocs(false);
    }
  }, [activeEventId, toast]);

  const loadPageInfo = useCallback(async () => {
    if (!activeEventId) {
      setLoadingPageInfo(false);
      return;
    }
    setLoadingPageInfo(true);
    setPageInfoError(null);
    try {
      const res = await fetch(
        `/api/event-page?eventId=${encodeURIComponent(activeEventId)}`
      );
      if (!res.ok) {
        throw new Error(
          'No se pudo cargar la configuración de la página del evento'
        );
      }
      const data = (await res.json()) as {
        event?: EventSummary | null;
        highlights?: EventHighlightDTO[];
      };
      const ev = data.event;
      if (ev) {
        setIsPublicPagePublished(ev.isPublicPagePublished ?? true);
        setPublicHeadline(ev.publicHeadline || '');
        setPublicSummary(ev.publicSummary || '');
        setVenueDetails(ev.venueDetails || '');
        setRegistrationInfo(ev.registrationInfo || '');
        setContactEmail(ev.contactEmail || '');
        setContactPhone(ev.contactPhone || '');
        setOfficialWebsiteUrl(ev.officialWebsiteUrl || '');
        setBannerUrl(ev.bannerUrl || '');
        setThemeColor(safeHexColor(ev.themeColor, '#001558'));
        setAccentColor(safeHexColor(ev.accentColor, '#FEB135'));
      }
      setHighlights(data.highlights || []);
    } catch (err: unknown) {
      setPageInfoError(
        err instanceof Error
          ? err.message
          : 'Error al cargar información de la página'
      );
    } finally {
      setLoadingPageInfo(false);
    }
  }, [activeEventId]);

  useEffect(() => {
    let cancelled = false;
    async function init() {
      await Promise.resolve();
      if (cancelled) return;
      await Promise.all([loadDocuments(), loadPageInfo()]);
    }
    void init();
    return () => {
      cancelled = true;
    };
  }, [eventVersion, loadDocuments, loadPageInfo]);

  const publicPagePath = activeEvent?.code
    ? `/eventos/${encodeURIComponent(activeEvent.code)}`
    : '/eventos';

  const handleCopyPublicUrl = async () => {
    try {
      const fullUrl = `${window.location.origin}${publicPagePath}`;
      await navigator.clipboard.writeText(fullUrl);
      toast.success(`Enlace copiado: ${fullUrl}`);
    } catch {
      toast.error('No se pudo copiar el enlace');
    }
  };

  const filteredDocuments = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return documents.filter((d) => {
      if (
        categoryFilter !== 'ALL' &&
        (d.category || '').toUpperCase() !== categoryFilter
      ) {
        return false;
      }
      if (statusFilter === 'PUBLISHED' && !d.isPublished) return false;
      if (statusFilter === 'DRAFT' && d.isPublished) return false;
      if (!q) return true;
      return (
        d.title.toLowerCase().includes(q) ||
        (d.summary || '').toLowerCase().includes(q) ||
        (d.documentCode || '').toLowerCase().includes(q) ||
        (d.fileName || '').toLowerCase().includes(q)
      );
    });
  }, [documents, searchTerm, categoryFilter, statusFilter]);

  const circularAndInfoCount =
    (docSummary.byCategory?.CIRCULAR || 0) +
    (docSummary.byCategory?.INFORMATIVO || 0);
  const fichasAndOthersCount =
    docSummary.total - circularAndInfoCount;

  const openCreateModal = () => {
    setEditingDoc(null);
    setModalError(null);
    setFormTitle('');
    setFormSummary('');
    setFormCategory('CIRCULAR');
    setFormCode('');
    setFormAudience('GENERAL');
    setFormStorageType('UPLOAD');
    setFormExternalUrl('');
    setFormFile(null);
    setFormPublishedAt(new Date().toISOString().slice(0, 10));
    setFormIsPublished(true);
    setFormIsPinned(false);
    setIsDocModalOpen(true);
  };

  const openEditModal = (doc: EventDocumentDTO) => {
    setEditingDoc(doc);
    setModalError(null);
    setFormTitle(doc.title);
    setFormSummary(doc.summary || '');
    setFormCategory(doc.category || 'CIRCULAR');
    setFormCode(doc.documentCode || '');
    setFormAudience(doc.audience || 'GENERAL');
    setFormStorageType(
      doc.storageType === 'EXTERNAL_LINK' ? 'EXTERNAL_LINK' : 'UPLOAD'
    );
    setFormExternalUrl(doc.externalUrl || '');
    setFormFile(null);
    setFormPublishedAt(toDateInputValue(doc.publishedAt || doc.createdAt));
    setFormIsPublished(doc.isPublished);
    setFormIsPinned(doc.isPinned);
    setIsDocModalOpen(true);
  };

  const closeDocModal = () => {
    if (savingDoc) return;
    setIsDocModalOpen(false);
    setEditingDoc(null);
    setModalError(null);
  };

  const handleSelectFile = (file: File | null) => {
    setModalError(null);
    if (!file) {
      setFormFile(null);
      return;
    }
    if (file.size > MAX_DOCUMENT_BYTES) {
      const msg = `El archivo "${file.name}" supera el límite de 4 MB.`;
      setModalError(msg);
      toast.error(msg);
      return;
    }
    setFormFile(file);
  };

  const handleSaveDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeEvent?.id) return;
    setModalError(null);

    if (!formTitle.trim()) {
      setModalError('El título del documento es obligatorio.');
      return;
    }
    if (formStorageType === 'EXTERNAL_LINK' && !formExternalUrl.trim()) {
      setModalError('Ingresa el enlace externo del documento (https://...).');
      return;
    }
    if (
      formStorageType === 'UPLOAD' &&
      !editingDoc &&
      !formFile
    ) {
      setModalError('Selecciona un archivo para subir.');
      return;
    }
    if (
      formStorageType === 'UPLOAD' &&
      editingDoc?.storageType === 'EXTERNAL_LINK' &&
      !formFile
    ) {
      setModalError(
        'Al cambiar de enlace externo a archivo subido, debes adjuntar el archivo.'
      );
      return;
    }

    setSavingDoc(true);
    try {
      const fd = new FormData();
      fd.append('eventId', activeEvent.id);
      fd.append('title', formTitle.trim());
      fd.append('summary', formSummary.trim());
      fd.append('category', formCategory);
      fd.append('documentCode', formCode.trim());
      fd.append('audience', formAudience);
      fd.append('storageType', formStorageType);
      fd.append('isPublished', String(formIsPublished));
      fd.append('isPinned', String(formIsPinned));
      if (formPublishedAt) {
        fd.append('publishedAt', formPublishedAt);
      }
      if (formStorageType === 'EXTERNAL_LINK') {
        fd.append('externalUrl', formExternalUrl.trim());
      } else if (formFile) {
        fd.append('file', formFile);
      }

      const url = editingDoc
        ? `/api/documents/${encodeURIComponent(editingDoc.id)}`
        : '/api/documents';
      const method = editingDoc ? 'PATCH' : 'POST';

      const res = await fetch(url, { method, body: fd });
      const data = (await res.json().catch(() => ({}))) as {
        message?: string;
        error?: string;
      };
      if (!res.ok) {
        throw new Error(data.error || 'Error al guardar el documento');
      }

      toast.success(
        data.message ||
          (editingDoc ? 'Documento actualizado' : 'Documento guardado')
      );
      setIsDocModalOpen(false);
      setEditingDoc(null);
      await loadDocuments();
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : 'Error al guardar el documento';
      setModalError(msg);
      toast.error(msg);
    } finally {
      setSavingDoc(false);
    }
  };

  const handleQuickToggle = async (
    doc: EventDocumentDTO,
    field: 'isPublished' | 'isPinned'
  ) => {
    setTogglingId(doc.id);
    try {
      const nextVal = !doc[field];
      const res = await fetch(`/api/documents/${encodeURIComponent(doc.id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: nextVal }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        throw new Error(data.error || 'No se pudo actualizar el estado');
      }
      toast.success(
        field === 'isPublished'
          ? nextVal
            ? 'Documento publicado en la página del evento'
            : 'Documento pasado a borrador'
          : nextVal
            ? 'Documento fijado como destacado'
            : 'Documento desfijado'
      );
      await loadDocuments();
    } catch (err: unknown) {
      toast.error(
        err instanceof Error ? err.message : 'Error actualizando documento'
      );
    } finally {
      setTogglingId(null);
    }
  };

  const handleConfirmDelete = async () => {
    if (!docToDelete) return;
    setDeletingDoc(true);
    try {
      const res = await fetch(
        `/api/documents/${encodeURIComponent(docToDelete.id)}`,
        { method: 'DELETE' }
      );
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        throw new Error(data.error || 'No se pudo eliminar el documento');
      }
      toast.success(`"${docToDelete.title}" eliminado`);
      setDocToDelete(null);
      await loadDocuments();
    } catch (err: unknown) {
      toast.error(
        err instanceof Error ? err.message : 'Error eliminando documento'
      );
    } finally {
      setDeletingDoc(false);
    }
  };

  // Highlight editors
  const handleAddHighlight = () => {
    setHighlights((prev) => [
      ...prev,
      {
        id: `hl-${Date.now()}`,
        title: '',
        content: '',
        badge: 'Aviso Oficial',
        dateLabel: '',
      },
    ]);
  };

  const handleUpdateHighlight = (
    idx: number,
    patch: Partial<EventHighlightDTO>
  ) => {
    setHighlights((prev) =>
      prev.map((item, i) => (i === idx ? { ...item, ...patch } : item))
    );
  };

  const handleMoveHighlight = (idx: number, dir: -1 | 1) => {
    setHighlights((prev) => {
      const target = idx + dir;
      if (target < 0 || target >= prev.length) return prev;
      const copy = [...prev];
      const [item] = copy.splice(idx, 1);
      copy.splice(target, 0, item);
      return copy;
    });
  };

  const handleRemoveHighlight = (idx: number) => {
    setHighlights((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSavePageInfo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeEvent?.id) return;
    setPageInfoError(null);
    setSavingPageInfo(true);

    try {
      const cleanHighlights = highlights.filter(
        (h) => h.title.trim() || h.content.trim()
      );
      const res = await fetch('/api/event-page', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventId: activeEvent.id,
          isPublicPagePublished,
          publicHeadline: publicHeadline.trim() || null,
          publicSummary: publicSummary.trim() || null,
          venueDetails: venueDetails.trim() || null,
          registrationInfo: registrationInfo.trim() || null,
          contactEmail: contactEmail.trim() || null,
          contactPhone: contactPhone.trim() || null,
          officialWebsiteUrl: officialWebsiteUrl.trim() || null,
          bannerUrl: bannerUrl.trim() || null,
          themeColor: themeColor.trim() || '#001558',
          accentColor: accentColor.trim() || '#FEB135',
          highlights: cleanHighlights,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        message?: string;
        error?: string;
        highlights?: EventHighlightDTO[];
      };
      if (!res.ok) {
        throw new Error(
          data.error || 'Error al guardar la página informativa'
        );
      }
      if (data.highlights) setHighlights(data.highlights);
      toast.success(
        data.message || 'Página informativa actualizada correctamente'
      );
      await refreshStats();
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : 'Error al guardar la configuración';
      setPageInfoError(msg);
      toast.error(msg);
    } finally {
      setSavingPageInfo(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <section className="bg-white border border-slate-200 border-t-4 border-t-[#001558] rounded-3xl p-5 sm:p-6 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1.5 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-2xl leading-none">
              {activeEvent?.flagEmoji || '🏕️'}
            </span>
            <h1 className="text-xl sm:text-2xl font-black text-[#001558] tracking-tight">
              Página del Evento y Documentación Oficial
            </h1>
            <span
              className={`px-2.5 py-0.5 rounded-full text-[11px] font-black border ${
                isPublicPagePublished
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                  : 'bg-[#FFF8E1] text-[#001558] border-[#FEB135]'
              }`}
            >
              {isPublicPagePublished ? 'Página Pública' : 'Borrador Privado'}
            </span>
          </div>
          <p className="text-xs text-slate-600">
            Evento activo:{' '}
            <strong className="text-[#001558]">
              {activeEvent?.name || 'Sin evento'}
            </strong>{' '}
            • URL pública:{' '}
            <code className="px-1.5 py-0.5 rounded bg-[#EEF2FF] text-[#001558] font-mono font-bold text-[11px]">
              {publicPagePath}
            </code>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleCopyPublicUrl}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#F5F6F8] hover:bg-slate-200 border border-slate-200 text-[#001558] text-xs font-bold transition-colors cursor-pointer"
          >
            <Copy className="w-3.5 h-3.5" />
            Copiar Enlace
          </button>

          <Link
            href={publicPagePath}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#001558] hover:bg-[#0b2370] text-white text-xs font-extrabold transition-colors shadow-xs"
          >
            <Globe className="w-3.5 h-3.5 text-[#FEB135]" />
            Ver Página Pública
            <ExternalLink className="w-3 h-3" />
          </Link>

          {canManageDocuments && (
            <button
              type="button"
              onClick={openCreateModal}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#FEB135] hover:bg-[#e59c22] text-[#001558] text-xs font-black transition-colors shadow-xs cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Subir / Publicar Documento
            </button>
          )}
        </div>
      </section>

      {/* KPI Row */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
            Total Documentos
          </span>
          <p className="text-2xl font-black text-[#001558] mt-1">
            {docSummary.total}
          </p>
          <p className="text-[11px] text-slate-500 mt-0.5">
            {docSummary.published} publicados • {docSummary.drafts} borradores
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
            Circulares e Informativos
          </span>
          <p className="text-2xl font-black text-[#001558] mt-1">
            {circularAndInfoCount}
          </p>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Comunicados oficiales del evento
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
            Fichas y Otros
          </span>
          <p className="text-2xl font-black text-emerald-700 mt-1">
            {fichasAndOthersCount}
          </p>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Fichas, reglamentos y guías
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
            Descargas Totales
          </span>
          <p className="text-2xl font-black text-[#001558] mt-1">
            {docSummary.totalDownloads}
          </p>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Consultas desde web y portal
          </p>
        </div>
      </section>

      {/* Console Tabs */}
      <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-xs">
        <div className="flex flex-wrap border-b border-slate-200 bg-[#F5F6F8]">
          <button
            type="button"
            onClick={() => setActiveTab('documents')}
            className={`flex items-center gap-2 px-6 py-3.5 text-xs font-extrabold uppercase tracking-wider border-b-2 transition-colors cursor-pointer ${
              activeTab === 'documents'
                ? 'border-[#001558] text-[#001558] bg-white'
                : 'border-transparent text-slate-500 hover:text-[#001558]'
            }`}
          >
            <FileText className="w-4 h-4 text-[#FEB135]" />
            Documentos Oficiales ({docSummary.total})
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('page_info')}
            className={`flex items-center gap-2 px-6 py-3.5 text-xs font-extrabold uppercase tracking-wider border-b-2 transition-colors cursor-pointer ${
              activeTab === 'page_info'
                ? 'border-[#001558] text-[#001558] bg-white'
                : 'border-transparent text-slate-500 hover:text-[#001558]'
            }`}
          >
            <Globe className="w-4 h-4 text-[#FEB135]" />
            Información de la Página del Evento
          </button>
        </div>

        {/* TAB 1: DOCUMENTS */}
        {activeTab === 'documents' && (
          <div className="p-5 sm:p-6 space-y-5">
            {/* Search & Filters */}
            <div className="flex flex-col md:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3 pointer-events-none" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Buscar por título, código (CIRC-01), resumen o archivo..."
                  className={`${INPUT_CLASS} pl-10`}
                />
              </div>

              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                aria-label="Filtrar por categoría"
                className="md:w-56 bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-[#001558]"
              >
                <option value="ALL">Todas las categorías</option>
                {DOCUMENT_CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>

              <select
                value={statusFilter}
                onChange={(e) =>
                  setStatusFilter(e.target.value as StatusFilter)
                }
                aria-label="Filtrar por estado"
                className="md:w-44 bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-[#001558]"
              >
                <option value="ALL">Todos los estados</option>
                <option value="PUBLISHED">Solo Publicados</option>
                <option value="DRAFT">Solo Borradores</option>
              </select>

              {(searchTerm ||
                categoryFilter !== 'ALL' ||
                statusFilter !== 'ALL') && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchTerm('');
                    setCategoryFilter('ALL');
                    setStatusFilter('ALL');
                  }}
                  className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold cursor-pointer"
                >
                  <FilterX className="w-3.5 h-3.5" />
                  Limpiar
                </button>
              )}

              <button
                type="button"
                onClick={() => void loadDocuments()}
                title="Actualizar lista"
                className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-[#F5F6F8] hover:bg-slate-200 border border-slate-200 text-[#001558] text-xs font-bold cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* List */}
            {loadingDocs ? (
              <div className="py-12 flex items-center justify-center gap-2 text-[#001558] text-xs font-bold">
                <Loader2 className="w-5 h-5 animate-spin" />
                Cargando documentos del evento...
              </div>
            ) : filteredDocuments.length === 0 ? (
              <div className="bg-[#F5F6F8] border border-dashed border-slate-300 rounded-2xl p-10 text-center space-y-3">
                <FileText className="w-10 h-10 text-[#001558]/40 mx-auto" />
                <div className="space-y-1">
                  <p className="text-sm font-extrabold text-[#001558]">
                    {documents.length === 0
                      ? 'No hay documentos cargados para este evento aún'
                      : 'No hay documentos que coincidan con tu filtro'}
                  </p>
                  <p className="text-xs text-slate-500">
                    {documents.length === 0
                      ? 'Sube circulares, informativos, fichas o reglamentos para que queden disponibles en la página del evento y el portal.'
                      : 'Prueba limpiando los filtros de búsqueda o categoría.'}
                  </p>
                </div>
                {canManageDocuments && documents.length === 0 && (
                  <button
                    type="button"
                    onClick={openCreateModal}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#001558] text-white text-xs font-extrabold cursor-pointer hover:bg-[#0b2370]"
                  >
                    <Plus className="w-4 h-4 text-[#FEB135]" />
                    Subir Primer Documento
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {filteredDocuments.map((doc) => {
                  const categoryMeta = getDocumentCategoryMeta(doc.category);
                  const audienceMeta = getDocumentAudienceMeta(doc.audience);
                  const fileBadge = getFileTypeBadge(
                    doc.mimeType,
                    doc.fileName,
                    doc.storageType
                  );
                  const canEditThis =
                    canManageEventPage ||
                    (canManageDocuments && doc.uploadedById === user?.id);
                  const busy = togglingId === doc.id;
                  const docUrl = `/api/public/documents/${encodeURIComponent(doc.id)}`;

                  return (
                    <div
                      key={doc.id}
                      className={`border rounded-2xl p-4 sm:p-5 transition-all ${
                        doc.isPinned
                          ? 'bg-[#FFFBF0]/60 border-[#FEB135]'
                          : 'bg-white border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                        <div className="flex items-start gap-3.5 min-w-0 flex-1">
                          <div
                            className={`w-11 h-11 rounded-xl border flex flex-col items-center justify-center shrink-0 font-black text-[10px] ${fileBadge.badgeClass}`}
                          >
                            <FileText className="w-4 h-4 mb-0.5" />
                            <span>{fileBadge.label}</span>
                          </div>

                          <div className="min-w-0 flex-1 space-y-1.5">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black border ${
                                  doc.isPublished
                                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                    : 'bg-slate-100 text-slate-600 border-slate-300'
                                }`}
                              >
                                {doc.isPublished ? (
                                  <>
                                    <Eye className="w-2.5 h-2.5" />
                                    Publicado
                                  </>
                                ) : (
                                  <>
                                    <EyeOff className="w-2.5 h-2.5" />
                                    Borrador
                                  </>
                                )}
                              </span>

                              {doc.isPinned && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#FEB135] text-[#001558] text-[10px] font-black uppercase">
                                  <Pin className="w-2.5 h-2.5" />
                                  Fijado
                                </span>
                              )}

                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold border ${categoryMeta.badgeClass}`}
                              >
                                {categoryMeta.shortLabel}
                              </span>

                              {doc.documentCode && (
                                <span className="px-2 py-0.5 rounded bg-slate-100 border border-slate-200 font-mono text-[10px] font-bold text-slate-700">
                                  {doc.documentCode}
                                </span>
                              )}

                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${audienceMeta.badgeClass}`}
                              >
                                {audienceMeta.label}
                              </span>
                            </div>

                            <h3 className="text-sm sm:text-base font-extrabold text-[#001558]">
                              {doc.title}
                            </h3>

                            {doc.summary && (
                              <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-line">
                                {doc.summary}
                              </p>
                            )}

                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-500 pt-1">
                              <span>
                                Fecha:{' '}
                                <strong className="text-slate-700">
                                  {formatShortDate(
                                    doc.publishedAt || doc.createdAt
                                  )}
                                </strong>
                              </span>
                              <span>
                                {doc.storageType === 'EXTERNAL_LINK'
                                  ? `Enlace: ${doc.externalUrl}`
                                  : `${doc.fileName || 'Archivo'} (${formatFileSize(doc.sizeBytes)})`}
                              </span>
                              <span>{doc.downloadCount} descargas</span>
                              {doc.uploadedBy?.name && (
                                <span>Por: {doc.uploadedBy.name}</span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex flex-wrap items-center gap-1.5 shrink-0 pt-2 lg:pt-0 border-t lg:border-t-0 border-slate-100">
                          <a
                            href={
                              doc.storageType === 'EXTERNAL_LINK' ||
                              fileBadge.canInlinePreview
                                ? docUrl
                                : `${docUrl}?download=1`
                            }
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#EEF2FF] hover:bg-[#dce4ff] text-[#001558] text-xs font-bold transition-colors"
                            title="Abrir / Descargar documento"
                          >
                            {doc.storageType === 'EXTERNAL_LINK' ||
                            fileBadge.canInlinePreview ? (
                              <ExternalLink className="w-3.5 h-3.5" />
                            ) : (
                              <Download className="w-3.5 h-3.5" />
                            )}
                            Ver
                          </a>

                          {canEditThis && (
                            <>
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() =>
                                  void handleQuickToggle(doc, 'isPinned')
                                }
                                title={
                                  doc.isPinned
                                    ? 'Quitar de destacados'
                                    : 'Fijar como destacado'
                                }
                                className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-xs font-bold transition-colors cursor-pointer disabled:opacity-50 ${
                                  doc.isPinned
                                    ? 'bg-[#FFF8E1] border-[#FEB135] text-[#001558]'
                                    : 'bg-white border-slate-200 text-slate-600 hover:text-[#001558]'
                                }`}
                              >
                                <Pin className="w-3.5 h-3.5" />
                                {doc.isPinned ? 'Fijado' : 'Fijar'}
                              </button>

                              <button
                                type="button"
                                disabled={busy}
                                onClick={() =>
                                  void handleQuickToggle(doc, 'isPublished')
                                }
                                className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-xs font-bold transition-colors cursor-pointer disabled:opacity-50 ${
                                  doc.isPublished
                                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800 hover:bg-emerald-100'
                                    : 'bg-slate-100 border-slate-200 text-slate-700 hover:bg-[#EEF2FF] hover:text-[#001558]'
                                }`}
                              >
                                {doc.isPublished ? 'Ocultar' : 'Publicar'}
                              </button>

                              <button
                                type="button"
                                onClick={() => openEditModal(doc)}
                                title="Editar documento"
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs font-bold transition-colors cursor-pointer"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                                Editar
                              </button>

                              <button
                                type="button"
                                onClick={() => setDocToDelete(doc)}
                                title="Eliminar documento"
                                className="inline-flex items-center justify-center p-1.5 rounded-lg bg-white hover:bg-red-50 border border-slate-200 hover:border-red-200 text-slate-500 hover:text-red-700 transition-colors cursor-pointer"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: PAGE INFO */}
        {activeTab === 'page_info' && (
          <div className="p-5 sm:p-6">
            {loadingPageInfo ? (
              <div className="py-12 flex items-center justify-center gap-2 text-[#001558] text-xs font-bold">
                <Loader2 className="w-5 h-5 animate-spin" />
                Cargando configuración de la página del evento...
              </div>
            ) : (
              <form onSubmit={handleSavePageInfo} className="space-y-6">
                {!canManageEventPage && (
                  <div className="bg-[#FFFBF0] border border-[#FEB135] rounded-2xl p-4 text-xs text-[#001558] flex items-start gap-2.5 font-semibold">
                    <AlertCircle className="w-4 h-4 text-[#FEB135] shrink-0 mt-0.5" />
                    <span>
                      Tienes acceso de solo lectura para la configuración de la
                      página pública. Solo Administradores y Coordinadores del
                      evento pueden editar esta información.
                    </span>
                  </div>
                )}

                {pageInfoError && (
                  <div className="bg-red-50 border border-red-200 rounded-2xl p-4 text-xs text-red-700 flex items-start gap-2 font-bold">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{pageInfoError}</span>
                  </div>
                )}

                {/* Publication status toggle */}
                <div className="bg-[#F5F6F8] border border-slate-200 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <h2 className="text-sm font-black text-[#001558] flex items-center gap-2">
                      <Globe className="w-4 h-4 text-[#FEB135]" />
                      Estado de Publicación de la Página Pública
                    </h2>
                    <p className="text-xs text-slate-600">
                      Cuando está activa, cualquier familia, participante o
                      dirigente puede acceder a{' '}
                      <span className="font-mono font-bold text-[#001558]">
                        {publicPagePath}
                      </span>{' '}
                      sin iniciar sesión.
                    </p>
                  </div>

                  <label className="inline-flex items-center gap-3 bg-white border border-slate-300 px-4 py-2.5 rounded-xl cursor-pointer shrink-0">
                    <input
                      type="checkbox"
                      disabled={!canManageEventPage}
                      checked={isPublicPagePublished}
                      onChange={(e) =>
                        setIsPublicPagePublished(e.target.checked)
                      }
                      className="w-4 h-4 accent-[#001558]"
                    />
                    <span className="text-xs font-black text-[#001558]">
                      {isPublicPagePublished
                        ? 'Página Pública Activa'
                        : 'Oculta (Modo Borrador)'}
                    </span>
                  </label>
                </div>

                {/* Main info fields */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                  <div className="lg:col-span-2">
                    <label className="block text-xs font-bold text-[#001558] mb-1.5">
                      Bajada o Titular Público del Evento
                    </label>
                    <input
                      type="text"
                      disabled={!canManageEventPage}
                      maxLength={200}
                      placeholder="Ej: Portal informativo oficial del Contingente Chileno: circulares, fechas clave e instrucciones."
                      value={publicHeadline}
                      onChange={(e) => setPublicHeadline(e.target.value)}
                      className={INPUT_CLASS}
                    />
                  </div>

                  <div className="lg:col-span-2">
                    <label className="block text-xs font-bold text-[#001558] mb-1.5">
                      Descripción Detallada (&ldquo;Acerca del Evento y
                      Contingente&rdquo;)
                    </label>
                    <textarea
                      rows={5}
                      disabled={!canManageEventPage}
                      placeholder="Explica de qué se trata el evento, objetivos del contingente, requisitos generales y recomendaciones..."
                      value={publicSummary}
                      onChange={(e) => setPublicSummary(e.target.value)}
                      className={INPUT_CLASS}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#001558] mb-1.5">
                      Detalles de Sede, Traslado y Alojamiento
                    </label>
                    <textarea
                      rows={4}
                      disabled={!canManageEventPage}
                      placeholder="Información del campo, isla/parque, traslados, clima esperado o logística en sede..."
                      value={venueDetails}
                      onChange={(e) => setVenueDetails(e.target.value)}
                      className={INPUT_CLASS}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#001558] mb-1.5">
                      Instrucciones de Inscripción y Requisitos
                    </label>
                    <textarea
                      rows={4}
                      disabled={!canManageEventPage}
                      placeholder="Edades mínimas, vigencia de registro institucional, etapas de pago y documentación exigida..."
                      value={registrationInfo}
                      onChange={(e) => setRegistrationInfo(e.target.value)}
                      className={INPUT_CLASS}
                    />
                  </div>
                </div>

                {/* Contact & Visual Identity */}
                <div className="border-t border-slate-200 pt-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-[#001558] mb-1.5">
                      Correo de Contacto Oficial
                    </label>
                    <input
                      type="email"
                      disabled={!canManageEventPage}
                      placeholder="contingente@agsch.cl"
                      value={contactEmail}
                      onChange={(e) => setContactEmail(e.target.value)}
                      className={INPUT_CLASS}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#001558] mb-1.5">
                      Teléfono / WhatsApp de Coordinación
                    </label>
                    <input
                      type="text"
                      disabled={!canManageEventPage}
                      placeholder="+56 9 0000 0000"
                      value={contactPhone}
                      onChange={(e) => setContactPhone(e.target.value)}
                      className={INPUT_CLASS}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#001558] mb-1.5">
                      Sitio Web Oficial Externo
                    </label>
                    <input
                      type="url"
                      disabled={!canManageEventPage}
                      placeholder="https://..."
                      value={officialWebsiteUrl}
                      onChange={(e) => setOfficialWebsiteUrl(e.target.value)}
                      className={INPUT_CLASS}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#001558] mb-1.5">
                      Imagen Banner Opcional (URL HTTPS)
                    </label>
                    <input
                      type="url"
                      disabled={!canManageEventPage}
                      placeholder="https://..."
                      value={bannerUrl}
                      onChange={(e) => setBannerUrl(e.target.value)}
                      className={INPUT_CLASS}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#001558] mb-1.5">
                      Color Principal (Hex)
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        disabled={!canManageEventPage}
                        value={safeHexColor(themeColor, '#001558')}
                        onChange={(e) => setThemeColor(e.target.value)}
                        className="w-10 h-10 rounded-lg border border-slate-300 cursor-pointer shrink-0 p-0.5 bg-white"
                      />
                      <input
                        type="text"
                        disabled={!canManageEventPage}
                        value={themeColor}
                        onChange={(e) => setThemeColor(e.target.value)}
                        className={`${INPUT_CLASS} font-mono`}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#001558] mb-1.5">
                      Color Acento (Hex)
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        disabled={!canManageEventPage}
                        value={safeHexColor(accentColor, '#FEB135')}
                        onChange={(e) => setAccentColor(e.target.value)}
                        className="w-10 h-10 rounded-lg border border-slate-300 cursor-pointer shrink-0 p-0.5 bg-white"
                      />
                      <input
                        type="text"
                        disabled={!canManageEventPage}
                        value={accentColor}
                        onChange={(e) => setAccentColor(e.target.value)}
                        className={`${INPUT_CLASS} font-mono`}
                      />
                    </div>
                  </div>
                </div>

                {/* Highlights Editor */}
                <div className="border-t border-slate-200 pt-5 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h3 className="text-sm font-black text-[#001558] flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-[#FEB135]" />
                        Avisos e Hitos Destacados ({highlights.length})
                      </h3>
                      <p className="text-xs text-slate-500">
                        Tarjetas de fechas clave, reuniones informativas o
                        recordatorios importantes en la página pública.
                      </p>
                    </div>
                    {canManageEventPage && (
                      <button
                        type="button"
                        onClick={handleAddHighlight}
                        disabled={highlights.length >= 20}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#EEF2FF] hover:bg-[#dce4ff] border border-[#001558]/20 text-[#001558] text-xs font-extrabold cursor-pointer disabled:opacity-50"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Agregar Aviso / Hito
                      </button>
                    )}
                  </div>

                  {highlights.length === 0 ? (
                    <div className="bg-[#F5F6F8] border border-dashed border-slate-300 rounded-2xl p-6 text-center text-xs text-slate-500">
                      No has agregado avisos destacados aún. Puedes sumar
                      reuniones informativas, cierres de inscripción o hitos del
                      calendario.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {highlights.map((hl, idx) => (
                        <div
                          key={hl.id}
                          className="bg-[#F5F6F8] border border-slate-200 rounded-2xl p-4 space-y-3"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-black text-[#001558]">
                              Aviso #{idx + 1}
                            </span>
                            {canManageEventPage && (
                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  disabled={idx === 0}
                                  onClick={() => handleMoveHighlight(idx, -1)}
                                  title="Subir"
                                  className="p-1.5 rounded-lg bg-white border border-slate-200 text-slate-600 hover:text-[#001558] disabled:opacity-40 cursor-pointer"
                                >
                                  <ArrowUp className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  disabled={idx === highlights.length - 1}
                                  onClick={() => handleMoveHighlight(idx, 1)}
                                  title="Bajar"
                                  className="p-1.5 rounded-lg bg-white border border-slate-200 text-slate-600 hover:text-[#001558] disabled:opacity-40 cursor-pointer"
                                >
                                  <ArrowDown className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveHighlight(idx)}
                                  title="Eliminar aviso"
                                  className="p-1.5 rounded-lg bg-white border border-slate-200 text-red-600 hover:bg-red-50 cursor-pointer"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            )}
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <div>
                              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                                Título *
                              </label>
                              <input
                                type="text"
                                disabled={!canManageEventPage}
                                placeholder="Ej: Reunión Nacional de Apoderados"
                                value={hl.title}
                                onChange={(e) =>
                                  handleUpdateHighlight(idx, {
                                    title: e.target.value,
                                  })
                                }
                                className={INPUT_CLASS}
                              />
                            </div>
                            <div>
                              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                                Etiqueta (Badge)
                              </label>
                              <input
                                type="text"
                                disabled={!canManageEventPage}
                                placeholder="Ej: Importante / Hito"
                                value={hl.badge || ''}
                                onChange={(e) =>
                                  handleUpdateHighlight(idx, {
                                    badge: e.target.value,
                                  })
                                }
                                className={INPUT_CLASS}
                              />
                            </div>
                            <div>
                              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                                Fecha o Plazo
                              </label>
                              <input
                                type="text"
                                disabled={!canManageEventPage}
                                placeholder="Ej: 15 de Marzo 2027"
                                value={hl.dateLabel || ''}
                                onChange={(e) =>
                                  handleUpdateHighlight(idx, {
                                    dateLabel: e.target.value,
                                  })
                                }
                                className={INPUT_CLASS}
                              />
                            </div>
                          </div>

                          <div>
                            <label className="block text-[11px] font-bold text-slate-700 mb-1">
                              Descripción del Aviso *
                            </label>
                            <textarea
                              rows={2}
                              disabled={!canManageEventPage}
                              placeholder="Detalle breve visible para los participantes y familias..."
                              value={hl.content}
                              onChange={(e) =>
                                handleUpdateHighlight(idx, {
                                  content: e.target.value,
                                })
                              }
                              className={INPUT_CLASS}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Save Footer */}
                {canManageEventPage && (
                  <div className="pt-4 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
                    <Link
                      href={publicPagePath}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs font-extrabold text-[#001558] hover:underline"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      Abrir {publicPagePath} en nueva pestaña
                    </Link>

                    <button
                      type="submit"
                      disabled={savingPageInfo}
                      className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[#001558] hover:bg-[#0b2370] text-white text-xs font-black uppercase tracking-wider shadow-md disabled:opacity-50 cursor-pointer transition-colors"
                    >
                      {savingPageInfo ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Save className="w-4 h-4 text-[#FEB135]" />
                      )}
                      Guardar Página del Evento
                    </button>
                  </div>
                )}
              </form>
            )}
          </div>
        )}
      </div>

      {/* Upload / Edit Document Modal */}
      {isDocModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#001558]/40 backdrop-blur-xs"
          onClick={(e) => {
            if (e.target === e.currentTarget && !savingDoc) {
              closeDocModal();
            }
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={modalTitleId}
            className="bg-white border border-slate-200 w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
          >
            <div className="bg-[#001558] text-white px-6 py-4 border-b-4 border-b-[#FEB135] flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Upload className="w-5 h-5 text-[#FEB135]" />
                <div>
                  <h2 id={modalTitleId} className="text-base font-black">
                    {editingDoc
                      ? 'Editar Documento Oficial'
                      : 'Subir y Publicar Documento'}
                  </h2>
                  <p className="text-[11px] text-slate-200">
                    Evento: {activeEvent?.name}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={closeDocModal}
                disabled={savingDoc}
                aria-label="Cerrar modal"
                className="text-white/75 hover:text-white p-1.5 rounded-lg hover:bg-white/10 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={handleSaveDocument}
              className="p-6 overflow-y-auto space-y-4"
            >
              {modalError && (
                <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-bold flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{modalError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-[#001558] mb-1">
                  Título del Documento *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Circular N° 03 - Información de Vuelos y Cuotas"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  className={INPUT_CLASS}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[#001558] mb-1">
                    Categoría *
                  </label>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value)}
                    className={INPUT_CLASS}
                  >
                    {DOCUMENT_CATEGORIES.map((c) => (
                      <option key={c.value} value={c.value}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#001558] mb-1">
                    Código (Opcional)
                  </label>
                  <input
                    type="text"
                    placeholder="Ej: CIRC-003"
                    value={formCode}
                    onChange={(e) => setFormCode(e.target.value)}
                    className={`${INPUT_CLASS} font-mono`}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#001558] mb-1">
                    Destinatario
                  </label>
                  <select
                    value={formAudience}
                    onChange={(e) => setFormAudience(e.target.value)}
                    className={INPUT_CLASS}
                  >
                    {DOCUMENT_AUDIENCES.map((a) => (
                      <option key={a.value} value={a.value}>
                        {a.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#001558] mb-1">
                  Resumen o Descripción Breve
                </label>
                <textarea
                  rows={2}
                  placeholder="Indica qué contiene el documento y a quién va dirigido..."
                  value={formSummary}
                  onChange={(e) => setFormSummary(e.target.value)}
                  className={INPUT_CLASS}
                />
              </div>

              {/* Storage Type Selector */}
              <div className="space-y-3">
                <label className="block text-xs font-bold text-[#001558]">
                  Origen del Documento *
                </label>
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setFormStorageType('UPLOAD')}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex items-center gap-2.5 ${
                      formStorageType === 'UPLOAD'
                        ? 'bg-[#EEF2FF] border-[#001558] text-[#001558]'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <Upload className="w-4 h-4 shrink-0" />
                    <div>
                      <span className="block text-xs font-extrabold">
                        Subir Archivo
                      </span>
                      <span className="block text-[10px] opacity-80">
                        PDF, Word, Excel, PPT, Img (máx 4 MB)
                      </span>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFormStorageType('EXTERNAL_LINK')}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex items-center gap-2.5 ${
                      formStorageType === 'EXTERNAL_LINK'
                        ? 'bg-[#EEF2FF] border-[#001558] text-[#001558]'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <Link2 className="w-4 h-4 shrink-0" />
                    <div>
                      <span className="block text-xs font-extrabold">
                        Enlace Externo
                      </span>
                      <span className="block text-[10px] opacity-80">
                        Google Drive, OneDrive u otra URL
                      </span>
                    </div>
                  </button>
                </div>

                {formStorageType === 'UPLOAD' ? (
                  <div className="space-y-2">
                    {editingDoc &&
                      editingDoc.storageType === 'UPLOAD' &&
                      !formFile && (
                        <div className="bg-[#F5F6F8] border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs flex items-center justify-between gap-2">
                          <span className="text-slate-700 truncate">
                            Archivo actual:{' '}
                            <strong className="text-[#001558]">
                              {editingDoc.fileName}
                            </strong>{' '}
                            ({formatFileSize(editingDoc.sizeBytes)})
                          </span>
                          <span className="text-[10px] font-bold text-slate-500 shrink-0">
                            Opcional: reemplázalo abajo
                          </span>
                        </div>
                      )}

                    <label
                      onDragOver={(e) => {
                        e.preventDefault();
                        setIsDraggingFile(true);
                      }}
                      onDragLeave={() => setIsDraggingFile(false)}
                      onDrop={(e) => {
                        e.preventDefault();
                        setIsDraggingFile(false);
                        const dropped = e.dataTransfer.files?.[0] || null;
                        handleSelectFile(dropped);
                      }}
                      className={`block border-2 border-dashed rounded-2xl p-5 text-center cursor-pointer transition-colors ${
                        isDraggingFile
                          ? 'border-[#001558] bg-[#EEF2FF]'
                          : formFile
                            ? 'border-emerald-400 bg-emerald-50/60'
                            : 'border-slate-300 bg-[#F5F6F8] hover:border-[#001558]/50'
                      }`}
                    >
                      <input
                        type="file"
                        accept={ALLOWED_UPLOAD_ACCEPT}
                        onChange={(e) =>
                          handleSelectFile(e.target.files?.[0] || null)
                        }
                        className="sr-only"
                      />
                      {formFile ? (
                        <div className="space-y-1">
                          <CheckCircle2 className="w-6 h-6 text-emerald-600 mx-auto" />
                          <p className="text-xs font-extrabold text-emerald-900">
                            {formFile.name}
                          </p>
                          <p className="text-[11px] text-emerald-700">
                            {formatFileSize(formFile.size)} • Haz clic para
                            cambiar archivo
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-1">
                          <Upload className="w-6 h-6 text-[#001558] mx-auto" />
                          <p className="text-xs font-bold text-[#001558]">
                            Arrastra un archivo aquí o haz clic para seleccionarlo
                          </p>
                          <p className="text-[11px] text-slate-500">
                            PDF, Word (.doc/.docx), Excel (.xls/.xlsx), PowerPoint,
                            CSV, TXT o Imagen (Máximo 4 MB)
                          </p>
                        </div>
                      )}
                    </label>
                  </div>
                ) : (
                  <div>
                    <label className="block text-xs font-bold text-[#001558] mb-1">
                      URL del Documento Externo *
                    </label>
                    <input
                      type="url"
                      placeholder="https://drive.google.com/..."
                      value={formExternalUrl}
                      onChange={(e) => setFormExternalUrl(e.target.value)}
                      className={INPUT_CLASS}
                    />
                  </div>
                )}
              </div>

              {/* Date & Publication options */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end pt-1">
                <div>
                  <label className="block text-xs font-bold text-[#001558] mb-1">
                    Fecha del Documento
                  </label>
                  <input
                    type="date"
                    value={formPublishedAt}
                    onChange={(e) => setFormPublishedAt(e.target.value)}
                    className={INPUT_CLASS}
                  />
                </div>

                <label className="flex items-center gap-2.5 bg-[#F5F6F8] border border-slate-200 rounded-xl px-3.5 py-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formIsPublished}
                    onChange={(e) => setFormIsPublished(e.target.checked)}
                    className="w-4 h-4 accent-[#001558]"
                  />
                  <span className="text-xs font-extrabold text-[#001558]">
                    Publicar inmediatamente
                  </span>
                </label>

                <label className="flex items-center gap-2.5 bg-[#FFFBF0] border border-[#FEB135]/70 rounded-xl px-3.5 py-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formIsPinned}
                    onChange={(e) => setFormIsPinned(e.target.checked)}
                    className="w-4 h-4 accent-[#001558]"
                  />
                  <span className="text-xs font-extrabold text-[#001558]">
                    Fijar arriba (Destacado)
                  </span>
                </label>
              </div>

              <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={closeDocModal}
                  disabled={savingDoc}
                  className="px-4 py-2.5 rounded-xl bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 text-xs font-bold cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingDoc}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#001558] hover:bg-[#0b2370] text-white text-xs font-black uppercase tracking-wider shadow-sm disabled:opacity-50 cursor-pointer"
                >
                  {savingDoc ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4 text-[#FEB135]" />
                  )}
                  {editingDoc ? 'Guardar Cambios' : 'Subir y Guardar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={docToDelete !== null}
        title="Eliminar documento oficial"
        description={`¿Estás seguro de eliminar permanentemente "${docToDelete?.title || ''}"? Dejará de estar disponible en la página del evento y en el portal.`}
        confirmLabel="Sí, eliminar"
        cancelLabel="Cancelar"
        variant="danger"
        loading={deletingDoc}
        onCancel={() => setDocToDelete(null)}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
}

export default function DocumentosAdminPage() {
  return (
    <AppShell>
      <DocumentConsoleContent />
    </AppShell>
  );
}
