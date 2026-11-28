import type {
  EventDocumentAudience,
  EventDocumentCategory,
  EventHighlightDTO,
} from '@/types/domain';

export const MAX_DOCUMENT_BYTES = 4 * 1024 * 1024; // 4 MB (Vercel body limit safe)

export interface DocumentCategoryMeta {
  value: EventDocumentCategory;
  label: string;
  shortLabel: string;
  badgeClass: string;
}

export const DOCUMENT_CATEGORIES: DocumentCategoryMeta[] = [
  {
    value: 'CIRCULAR',
    label: 'Circulares Oficiales',
    shortLabel: 'Circular',
    badgeClass: 'bg-[#EEF2FF] text-[#001558] border-[#001558]/20',
  },
  {
    value: 'INFORMATIVO',
    label: 'Informativos y Comunicados',
    shortLabel: 'Informativo',
    badgeClass: 'bg-[#FFF8E1] text-[#001558] border-[#FEB135]',
  },
  {
    value: 'FICHA',
    label: 'Fichas y Autorizaciones',
    shortLabel: 'Ficha',
    badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  },
  {
    value: 'REGLAMENTO',
    label: 'Reglamentos y Protocolos',
    shortLabel: 'Reglamento',
    badgeClass: 'bg-purple-50 text-purple-800 border-purple-200',
  },
  {
    value: 'GUIA',
    label: 'Guías, Manuales y Listados',
    shortLabel: 'Guía',
    badgeClass: 'bg-sky-50 text-sky-800 border-sky-200',
  },
  {
    value: 'OTRO',
    label: 'Otros Documentos',
    shortLabel: 'Otro',
    badgeClass: 'bg-slate-100 text-slate-700 border-slate-300',
  },
];

export const DOCUMENT_CATEGORY_MAP: Record<string, DocumentCategoryMeta> =
  Object.fromEntries(DOCUMENT_CATEGORIES.map((c) => [c.value, c]));

export interface DocumentAudienceMeta {
  value: EventDocumentAudience;
  label: string;
  badgeClass: string;
}

export const DOCUMENT_AUDIENCES: DocumentAudienceMeta[] = [
  {
    value: 'GENERAL',
    label: 'Todo el Contingente',
    badgeClass: 'bg-slate-100 text-slate-700 border-slate-200',
  },
  {
    value: 'PARTICIPANTES',
    label: 'Participantes / Jóvenes',
    badgeClass: 'bg-[#EEF2FF] text-[#001558] border-[#001558]/15',
  },
  {
    value: 'APODERADOS',
    label: 'Familias y Apoderados',
    badgeClass: 'bg-[#FFFBF0] text-[#001558] border-[#FEB135]/70',
  },
  {
    value: 'DIRIGENTES',
    label: 'Dirigentes y Guiadoras',
    badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  },
  {
    value: 'IST',
    label: 'IST y Equipo Adulto',
    badgeClass: 'bg-sky-50 text-sky-800 border-sky-200',
  },
];

export const DOCUMENT_AUDIENCE_MAP: Record<string, DocumentAudienceMeta> =
  Object.fromEntries(DOCUMENT_AUDIENCES.map((a) => [a.value, a]));

export const ALLOWED_DOCUMENT_MIMES = new Set<string>([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/csv',
  'text/plain',
  'image/jpeg',
  'image/png',
  'image/webp',
]);

export const BLOCKED_DOCUMENT_MIMES = new Set<string>([
  'image/svg+xml',
  'text/html',
  'application/xhtml+xml',
  'text/javascript',
  'application/javascript',
  'application/x-javascript',
]);

export const BLOCKED_EXTENSIONS = new Set<string>([
  'svg',
  'html',
  'htm',
  'js',
  'mjs',
  'cjs',
  'exe',
  'sh',
]);

export const INLINE_PREVIEW_MIMES = new Set<string>([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
]);

export const ALLOWED_UPLOAD_ACCEPT =
  '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.csv,.txt,.jpg,.jpeg,.png,.webp';

export class DocumentValidationError extends Error {
  statusCode: number;

  constructor(message: string, statusCode = 400) {
    super(message);
    this.name = 'DocumentValidationError';
    this.statusCode = statusCode;
  }
}

export function sanitizeDocumentCategory(
  raw?: string | null
): EventDocumentCategory {
  const normalized = (raw || 'CIRCULAR').trim().toUpperCase();
  if (normalized in DOCUMENT_CATEGORY_MAP) {
    return normalized as EventDocumentCategory;
  }
  return 'CIRCULAR';
}

export function sanitizeDocumentAudience(
  raw?: string | null
): EventDocumentAudience {
  const normalized = (raw || 'GENERAL').trim().toUpperCase();
  if (normalized in DOCUMENT_AUDIENCE_MAP) {
    return normalized as EventDocumentAudience;
  }
  return 'GENERAL';
}

export function getDocumentCategoryMeta(
  category?: string | null
): DocumentCategoryMeta {
  return (
    DOCUMENT_CATEGORY_MAP[(category || '').trim().toUpperCase()] ??
    DOCUMENT_CATEGORY_MAP.OTRO
  );
}

export function getDocumentAudienceMeta(
  audience?: string | null
): DocumentAudienceMeta {
  return (
    DOCUMENT_AUDIENCE_MAP[(audience || '').trim().toUpperCase()] ??
    DOCUMENT_AUDIENCE_MAP.GENERAL
  );
}

export function inferDocumentMimeType(file: File): string {
  const rawType = (file.type || '').toLowerCase().trim().split(';')[0];
  const ext = file.name.split('.').pop()?.toLowerCase().trim() || '';

  if (BLOCKED_EXTENSIONS.has(ext) || BLOCKED_DOCUMENT_MIMES.has(rawType)) {
    return rawType || `blocked/${ext}`;
  }

  if (ALLOWED_DOCUMENT_MIMES.has(rawType)) {
    return rawType;
  }
  if (rawType === 'image/jpg') return 'image/jpeg';

  switch (ext) {
    case 'pdf':
      return 'application/pdf';
    case 'doc':
      return 'application/msword';
    case 'docx':
      return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    case 'xls':
      return 'application/vnd.ms-excel';
    case 'xlsx':
      return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    case 'ppt':
      return 'application/vnd.ms-powerpoint';
    case 'pptx':
      return 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
    case 'csv':
      return 'text/csv';
    case 'txt':
      return 'text/plain';
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'png':
      return 'image/png';
    case 'webp':
      return 'image/webp';
    default:
      return rawType || 'application/octet-stream';
  }
}

export async function validateDocumentFile(file: File): Promise<{
  buffer: Buffer;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
}> {
  if (!file || file.size <= 0) {
    throw new DocumentValidationError('El archivo adjunto está vacío.', 400);
  }
  if (file.size > MAX_DOCUMENT_BYTES) {
    throw new DocumentValidationError(
      `El archivo "${file.name}" supera el límite máximo de 4 MB.`,
      400
    );
  }

  const ext = file.name.split('.').pop()?.toLowerCase().trim() || '';
  const rawMime = (file.type || '').toLowerCase().trim().split(';')[0];

  if (BLOCKED_EXTENSIONS.has(ext) || BLOCKED_DOCUMENT_MIMES.has(rawMime)) {
    throw new DocumentValidationError(
      'Por seguridad, no se permiten archivos HTML, SVG ni ejecutables.',
      400
    );
  }

  const mimeType = inferDocumentMimeType(file);
  if (!ALLOWED_DOCUMENT_MIMES.has(mimeType)) {
    throw new DocumentValidationError(
      'Formato de documento no soportado. Sube PDF, Word (.doc/.docx), Excel (.xls/.xlsx), PowerPoint (.ppt/.pptx), CSV, TXT o imagen (JPG, PNG, WebP).',
      400
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const cleanFileName = (file.name || 'documento.pdf')
    .replace(/[\r\n"\\/]/g, '_')
    .slice(0, 180);

  return {
    buffer,
    fileName: cleanFileName,
    mimeType,
    sizeBytes: buffer.length,
  };
}

export function isValidHttpUrl(raw?: string | null): boolean {
  if (!raw || typeof raw !== 'string') return false;
  const trimmed = raw.trim();
  if (!trimmed) return false;
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

export function safeHexColor(
  raw?: string | null,
  fallback = '#001558'
): string {
  if (!raw || typeof raw !== 'string') return fallback;
  const trimmed = raw.trim();
  return /^#[0-9a-fA-F]{6}$/.test(trimmed) ? trimmed : fallback;
}

export function parseEventHighlights(
  raw?: string | null
): EventHighlightDTO[] {
  if (!raw || typeof raw !== 'string' || !raw.trim()) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const items: EventHighlightDTO[] = [];
    for (let idx = 0; idx < parsed.length && items.length < 20; idx++) {
      const entry = parsed[idx];
      if (!entry || typeof entry !== 'object' || Array.isArray(entry)) continue;
      const obj = entry as Record<string, unknown>;
      const title = typeof obj.title === 'string' ? obj.title.trim() : '';
      const content =
        typeof obj.content === 'string' ? obj.content.trim() : '';
      if (!title || !content) continue;
      const id =
        typeof obj.id === 'string' && obj.id.trim()
          ? obj.id.trim()
          : `hl-${idx + 1}`;
      const dateLabel =
        typeof obj.dateLabel === 'string' && obj.dateLabel.trim()
          ? obj.dateLabel.trim()
          : undefined;
      const badge =
        typeof obj.badge === 'string' && obj.badge.trim()
          ? obj.badge.trim()
          : undefined;
      items.push({ id, title, content, dateLabel, badge });
    }
    return items;
  } catch {
    return [];
  }
}

export function serializeEventHighlights(raw: unknown): string | null {
  if (raw === null || raw === undefined) return null;
  if (!Array.isArray(raw)) {
    throw new DocumentValidationError(
      'El formato de avisos o hitos destacados es inválido.',
      400
    );
  }
  if (raw.length > 20) {
    throw new DocumentValidationError(
      'Se permiten hasta 20 avisos o hitos destacados por evento.',
      400
    );
  }

  const normalized: EventHighlightDTO[] = [];
  for (let i = 0; i < raw.length; i++) {
    const item = raw[i];
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue;
    const obj = item as Record<string, unknown>;
    const title = typeof obj.title === 'string' ? obj.title.trim() : '';
    const content = typeof obj.content === 'string' ? obj.content.trim() : '';
    if (!title && !content) continue;
    if (!title || !content) {
      throw new DocumentValidationError(
        `El aviso #${i + 1} requiere título y descripción.`,
        400
      );
    }
    normalized.push({
      id:
        typeof obj.id === 'string' && obj.id.trim()
          ? obj.id.trim().slice(0, 64)
          : `hl-${Date.now()}-${i}`,
      title: title.slice(0, 140),
      content: content.slice(0, 1000),
      dateLabel:
        typeof obj.dateLabel === 'string' && obj.dateLabel.trim()
          ? obj.dateLabel.trim().slice(0, 80)
          : undefined,
      badge:
        typeof obj.badge === 'string' && obj.badge.trim()
          ? obj.badge.trim().slice(0, 50)
          : undefined,
    });
  }

  return normalized.length > 0 ? JSON.stringify(normalized) : null;
}

export function formatFileSize(bytes?: number | null): string {
  if (!bytes || bytes <= 0) return '—';
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(kb >= 100 ? 0 : 1)} KB`;
  const mb = kb / 1024;
  return `${mb.toFixed(1)} MB`;
}

export function getFileTypeBadge(
  mimeType?: string | null,
  fileName?: string | null,
  storageType?: string
): { label: string; badgeClass: string; canInlinePreview: boolean } {
  if (storageType === 'EXTERNAL_LINK') {
    return {
      label: 'ENLACE',
      badgeClass: 'bg-sky-50 text-sky-800 border-sky-200',
      canInlinePreview: false,
    };
  }

  const mime = (mimeType || '').toLowerCase();
  const ext = (fileName || '').split('.').pop()?.toLowerCase() || '';

  if (mime === 'application/pdf' || ext === 'pdf') {
    return {
      label: 'PDF',
      badgeClass: 'bg-red-50 text-red-700 border-red-200',
      canInlinePreview: true,
    };
  }
  if (
    mime.includes('wordprocessingml') ||
    mime === 'application/msword' ||
    ext === 'doc' ||
    ext === 'docx'
  ) {
    return {
      label: 'WORD',
      badgeClass: 'bg-blue-50 text-blue-800 border-blue-200',
      canInlinePreview: false,
    };
  }
  if (
    mime.includes('spreadsheetml') ||
    mime === 'application/vnd.ms-excel' ||
    mime === 'text/csv' ||
    ext === 'xls' ||
    ext === 'xlsx' ||
    ext === 'csv'
  ) {
    return {
      label: ext === 'csv' ? 'CSV' : 'EXCEL',
      badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-200',
      canInlinePreview: false,
    };
  }
  if (
    mime.includes('presentationml') ||
    mime === 'application/vnd.ms-powerpoint' ||
    ext === 'ppt' ||
    ext === 'pptx'
  ) {
    return {
      label: 'PPT',
      badgeClass: 'bg-amber-50 text-amber-800 border-amber-200',
      canInlinePreview: false,
    };
  }
  if (mime.startsWith('image/') || ['jpg', 'jpeg', 'png', 'webp'].includes(ext)) {
    return {
      label: ext ? ext.toUpperCase() : 'IMG',
      badgeClass: 'bg-purple-50 text-purple-800 border-purple-200',
      canInlinePreview: INLINE_PREVIEW_MIMES.has(mime) || ['jpg', 'jpeg', 'png', 'webp'].includes(ext),
    };
  }
  if (mime === 'text/plain' || ext === 'txt') {
    return {
      label: 'TXT',
      badgeClass: 'bg-slate-100 text-slate-700 border-slate-200',
      canInlinePreview: false,
    };
  }

  return {
    label: ext ? ext.toUpperCase().slice(0, 6) : 'ARCHIVO',
    badgeClass: 'bg-slate-100 text-slate-700 border-slate-200',
    canInlinePreview: false,
  };
}

export function formatEventTypeLabel(type?: string | null): string {
  switch ((type || '').trim().toUpperCase()) {
    case 'JAMBOREE_MUNDIAL':
      return 'Jamboree Scout Mundial';
    case 'MOOT_MUNDIAL':
      return 'World Scout Moot';
    case 'JAMBOREE_NACIONAL':
      return 'Evento Scout Nacional';
    case 'JAMBOREE_INTERAMERICANO':
      return 'Evento Interamericano';
    case 'PAXTU':
      return 'Paxtu Nacional';
    case 'CANAPRO':
      return 'Encuentro Nacional';
    default:
      return type ? type.replace(/_/g, ' ') : 'Evento Institucional AGSCH';
  }
}

export function buildContentDisposition(
  mode: 'inline' | 'attachment',
  fileName: string
): string {
  const safeAscii =
    fileName
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9._ -]/g, '_')
      .trim() || 'documento';
  const encodedUtf8 = encodeURIComponent(fileName).replace(
    /['()*!]/g,
    (ch) => `%${ch.charCodeAt(0).toString(16).toUpperCase()}`
  );
  return `${mode}; filename="${safeAscii}"; filename*=UTF-8''${encodedUtf8}`;
}
