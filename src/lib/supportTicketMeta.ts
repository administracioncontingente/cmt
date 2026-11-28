/**
 * Client-safe labels and styles for participant support tickets (backed by the Incident model).
 */

export const PORTAL_TICKET_CATEGORIES = [
  {
    value: 'CONSULTA_GENERAL',
    label: 'Consulta general',
    hint: 'Dudas sobre el evento, fechas, actividades u otros temas.',
  },
  {
    value: 'FINANZAS',
    label: 'Pagos y cuotas',
    hint: 'Abonos no reflejados, comprobantes, saldos o devoluciones.',
  },
  {
    value: 'FICHA_MEDICA',
    label: 'Ficha médica y salud',
    hint: 'Correcciones de la ficha, alergias, medicamentos o QR.',
  },
  {
    value: 'PASAJES_LOGISTICA',
    label: 'Pasajes, kit y logística',
    hint: 'Vuelos, traslados, tallas del kit o equipamiento.',
  },
  {
    value: 'CEDULA_LEGAL',
    label: 'Documentos legales',
    hint: 'Cédula, pasaporte, autorizaciones notariales o permisos.',
  },
] as const;

export type PortalTicketCategory = (typeof PORTAL_TICKET_CATEGORIES)[number]['value'];

export function getTicketCategoryLabel(category?: string | null): string {
  return (
    PORTAL_TICKET_CATEGORIES.find((c) => c.value === category)?.label ??
    'Consulta general'
  );
}

export const TICKET_STATUS_META: Record<
  string,
  { label: string; participantHint: string; className: string }
> = {
  ABIERTA: {
    label: 'Recibido',
    participantHint: 'Tu solicitud fue recibida y será revisada por el equipo.',
    className: 'bg-[#EEF2FF] text-[#001558] border-[#001558]/20',
  },
  EN_PROCESO: {
    label: 'En revisión',
    participantHint: 'El equipo está trabajando en tu solicitud.',
    className: 'bg-sky-50 text-sky-800 border-sky-200',
  },
  ESPERANDO_RESPUESTA: {
    label: 'Requiere tu respuesta',
    participantHint: 'El equipo necesita información adicional de tu parte.',
    className: 'bg-[#FFF8E1] text-[#001558] border-[#FEB135]',
  },
  RESUELTA: {
    label: 'Resuelto',
    participantHint:
      'El equipo marcó tu solicitud como resuelta. Si aún tienes dudas, puedes responder para reabrirla.',
    className: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  },
  CERRADA: {
    label: 'Cerrado',
    participantHint: 'Este ticket fue cerrado. Si necesitas ayuda, crea un nuevo ticket.',
    className: 'bg-slate-100 text-slate-600 border-slate-200',
  },
};

export function getTicketStatusMeta(status?: string | null) {
  return TICKET_STATUS_META[status || ''] ?? TICKET_STATUS_META.ABIERTA;
}

export const TICKET_SUBJECT_MAX = 140;
export const TICKET_MESSAGE_MAX = 4000;
export const TICKET_DAILY_LIMIT = 5;
