import { prisma } from '@/lib/prisma';
import { cleanRut } from '@/lib/rut';

export interface SyncedMessageData {
  googleMessageId: string;
  googleThreadId: string;
  senderEmail: string;
  senderName?: string;
  recipientEmail?: string;
  subject: string;
  snippet?: string;
  bodyText?: string;
  bodyHtml?: string;
  date: Date;
  hasAttachments?: boolean;
  labels?: string[];
}

/**
 * Extrae posibles RUTs chilenos de un texto
 */
export function extractRutsFromText(text: string): string[] {
  if (!text) return [];
  const rutRegex = /\b(\d{1,2}\.?\d{3}\.?\d{3}-?[\dkK])\b/g;
  const matches = text.match(rutRegex) || [];
  return Array.from(new Set(matches.map((m) => cleanRut(m)).filter(Boolean)));
}

/**
 * Algoritmo de Asociación Inteligente:
 * 1. Coincidencia exacta de correo del participante (EXACT_EMAIL)
 * 2. Coincidencia de correo del apoderado/tutor legal (GUARDIAN_EMAIL)
 * 3. Coincidencia de RUT extraído del asunto o cuerpo (RUT_MATCH)
 */
export async function matchParticipantForMessage(
  eventId: string,
  senderEmail: string,
  subject: string,
  bodyText: string
): Promise<{ participantId: string | null; method: string | null }> {
  const cleanSender = senderEmail.toLowerCase().trim();

  // 1. Buscar por email directo del participante en este evento
  const byParticipantEmail = await prisma.participant.findFirst({
    where: {
      eventId,
      email: cleanSender,
    },
    select: { id: true },
  });

  if (byParticipantEmail) {
    return { participantId: byParticipantEmail.id, method: 'EXACT_EMAIL' };
  }

  // 2. Buscar por email del apoderado
  const byGuardianEmail = await prisma.participant.findFirst({
    where: {
      eventId,
      guardianEmail: cleanSender,
    },
    select: { id: true },
  });

  if (byGuardianEmail) {
    return { participantId: byGuardianEmail.id, method: 'GUARDIAN_EMAIL' };
  }

  // 3. Buscar por RUT presente en asunto o cuerpo
  const combinedText = `${subject} ${bodyText}`;
  const foundRuts = extractRutsFromText(combinedText);

  for (const rut of foundRuts) {
    const byRut = await prisma.participant.findFirst({
      where: {
        eventId,
        OR: [{ rutClean: rut }, { rut: { contains: rut } }],
      },
      select: { id: true },
    });

    if (byRut) {
      return { participantId: byRut.id, method: 'RUT_MATCH' };
    }
  }

  return { participantId: null, method: null };
}

/**
 * Guarda o actualiza un mensaje en la base de datos y lo auto-asocia
 */
export async function ingestEmailMessage(
  eventId: string,
  accountId: string | null,
  data: SyncedMessageData
) {
  // Intentar match inteligente
  const { participantId, method } = await matchParticipantForMessage(
    eventId,
    data.senderEmail,
    data.subject,
    data.bodyText || data.snippet || ''
  );

  const message = await prisma.emailMessage.upsert({
    where: { googleMessageId: data.googleMessageId },
    update: {
      googleThreadId: data.googleThreadId,
      senderEmail: data.senderEmail,
      senderName: data.senderName,
      recipientEmail: data.recipientEmail,
      subject: data.subject,
      snippet: data.snippet,
      bodyText: data.bodyText,
      bodyHtml: data.bodyHtml,
      date: data.date,
      hasAttachments: Boolean(data.hasAttachments),
      labels: data.labels ? JSON.stringify(data.labels) : null,
      ...(participantId ? { participantId, matchMethod: method } : {}),
    },
    create: {
      eventId,
      accountId,
      googleMessageId: data.googleMessageId,
      googleThreadId: data.googleThreadId,
      senderEmail: data.senderEmail,
      senderName: data.senderName,
      recipientEmail: data.recipientEmail,
      subject: data.subject,
      snippet: data.snippet,
      bodyText: data.bodyText,
      bodyHtml: data.bodyHtml,
      date: data.date,
      hasAttachments: Boolean(data.hasAttachments),
      labels: data.labels ? JSON.stringify(data.labels) : null,
      participantId,
      matchMethod: method,
    },
    include: {
      participant: {
        select: {
          id: true,
          rut: true,
          firstName: true,
          lastName: true,
          contingentRole: true,
          unitName: true,
        },
      },
    },
  });

  return message;
}

/**
 * Generador de Correos e Hilos de Muestra (Scout Contingent Simulator)
 * Permite probar de inmediato la bandeja de entrada, asociación y tickets
 */
export async function seedSampleInboxMessages(eventId: string) {
  // Obtener algunos participantes reales para vincular con precisión
  const sampleParticipants = await prisma.participant.findMany({
    where: { eventId },
    take: 5,
  });

  const p1 = sampleParticipants[0];
  const p2 = sampleParticipants[1];
  const p3 = sampleParticipants[2];

  const now = new Date();

  const sampleMessages: SyncedMessageData[] = [
    {
      googleMessageId: `gmail_msg_001_${Date.now()}`,
      googleThreadId: 'thread_finanzas_001',
      senderEmail: p1 ? p1.email : 'apoderado.sepulveda@gmail.com',
      senderName: p1 ? `${p1.firstName} ${p1.lastName}` : 'Carlos Sepúlveda (Apoderado)',
      recipientEmail: 'administracioncontingente@guiasyscoutschile.cl',
      subject: `Comprobante Transferencia Cuota 3 - ${p1 ? p1.rut : '21.345.678-4'}`,
      snippet: 'Estimado Equipo de Finanzas, adjunto el comprobante de transferencia por 600 USD correspondiente a la cuota 3...',
      bodyText: `Estimado Equipo de Finanzas del Contingente,\n\nAdjunto comprobante de transferencia bancaria por USD 600 correspondiente a la Cuota 3 del participante ${p1 ? `${p1.firstName} ${p1.lastName} (RUT: ${p1.rut})` : 'Camila Sepúlveda'}.\n\nN° de operación bancaria: TRF-994820.\nFavor confirmar recepción y actualización en el sistema.\n\nSiempre Listos,\nFamilia Sepúlveda Silva`,
      date: new Date(now.getTime() - 1000 * 60 * 30), // hace 30 min
      hasAttachments: true,
      labels: ['INBOX', 'FINANZAS', 'IMPORTANTE'],
    },
    {
      googleMessageId: `gmail_msg_002_${Date.now()}`,
      googleThreadId: 'thread_medica_002',
      senderEmail: p2?.guardianEmail || (p2 ? p2.email : 'carlos.morales@empresa.cl'),
      senderName: p2?.guardianName || 'Carlos Morales Pinto',
      recipientEmail: 'administracioncontingente@guiasyscoutschile.cl',
      subject: `Consulta Médica Urgente: Cadena de Frío e Insulina (RUT: ${p2 ? p2.rut : '20.890.123-0'})`,
      snippet: 'Hola, completamos la ficha médica en el portal pero necesitamos saber los protocolos para el transporte aéreo de insulina...',
      bodyText: `Estimado Equipo Médico del Contingente WSJ,\n\nEscribo respecto a mi hijo ${p2 ? `${p2.firstName} ${p2.lastName} (RUT: ${p2.rut})` : 'Matías Morales'}. Ya completamos la Ficha Médica WSJ en el portal indicando su condición de Diabetes Tipo 1.\n\nQueremos coordinar con anticipación cómo se manejará la cadena de frío (refrigeración entre 2°C y 8°C) durante el vuelo Santiago-Varsovia y en el subcampo en Gdansk.\n\nQuedo atento a sus indicaciones.\n\nSaludos cordiales,\n${p2?.guardianName || 'Carlos Morales Pinto'}\nTeléfono: ${p2?.guardianPhone || '+56 9 8765 1122'}`,
      date: new Date(now.getTime() - 1000 * 60 * 120), // hace 2 horas
      hasAttachments: false,
      labels: ['INBOX', 'SALUD', 'URGENTE'],
    },
    {
      googleMessageId: `gmail_msg_003_${Date.now()}`,
      googleThreadId: 'thread_legal_003',
      senderEmail: 'contacto.familiar@scout.cl',
      senderName: 'Patricia Donoso',
      recipientEmail: 'administracioncontingente@guiasyscoutschile.cl',
      subject: `Renovación de Pasaporte y Cédula - Participante RUT ${p3 ? p3.rut : '16.543.210-K'}`,
      snippet: 'Buenos días, les informamos que el pasaporte fue renovado en Registro Civil y ya tenemos el nuevo número de documento...',
      bodyText: `Estimados Comisionados,\n\nLes escribo para informar que la cédula de identidad y el pasaporte de ${p3 ? `${p3.firstName} ${p3.lastName}` : 'Rodrigo Silva'} ya fueron renovados exitosamente en el Registro Civil.\n\nAdjunto copia escaneada para que puedan actualizar los registros oficiales ante la organización polaca.\n\nMuchas gracias,\nPatricia Donoso`,
      date: new Date(now.getTime() - 1000 * 60 * 360), // hace 6 horas
      hasAttachments: true,
      labels: ['INBOX', 'DOCUMENTACION'],
    },
    {
      googleMessageId: `gmail_msg_004_${Date.now()}`,
      googleThreadId: 'thread_general_004',
      senderEmail: 'consulta.general@gmail.com',
      senderName: 'Familia Scout',
      recipientEmail: 'administracioncontingente@guiasyscoutschile.cl',
      subject: 'Consulta sobre fechas y vuelos de salida desde Santiago',
      snippet: 'Buenas tardes, quisiéramos consultar si ya están definidas las fechas exactas de salida del contingente hacia Europa...',
      bodyText: `Buenas tardes contingente,\n\nQuisiéramos consultar cuándo se publicará el itinerario definitivo de vuelos comerciales de salida desde Santiago hacia Gdansk.\n\nQuedamos a la espera de la circular informativa.\n\nSaludos,\nFamilia Scout`,
      date: new Date(now.getTime() - 1000 * 60 * 600), // hace 10 horas
      hasAttachments: false,
      labels: ['INBOX', 'CONSULTA'],
    },
  ];

  const ingested = [];
  for (const msg of sampleMessages) {
    const res = await ingestEmailMessage(eventId, null, msg);
    ingested.push(res);
  }

  return ingested;
}
