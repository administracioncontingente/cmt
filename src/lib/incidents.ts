import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';

export const INCIDENT_CATEGORIES = [
  'FINANZAS',
  'FICHA_MEDICA',
  'PASAJES_LOGISTICA',
  'CEDULA_LEGAL',
  'CONSULTA_GENERAL',
] as const;

export const INCIDENT_PRIORITIES = ['URGENTE', 'ALTA', 'MEDIA', 'BAJA'] as const;

export const INCIDENT_STATUSES = [
  'ABIERTA',
  'EN_PROCESO',
  'ESPERANDO_RESPUESTA',
  'RESUELTA',
  'CERRADA',
] as const;

export type IncidentCategory = (typeof INCIDENT_CATEGORIES)[number];
export type IncidentPriority = (typeof INCIDENT_PRIORITIES)[number];
export type IncidentStatus = (typeof INCIDENT_STATUSES)[number];

/** Type guard for valid incident categories. */
export function isValidIncidentCategory(value: string): value is IncidentCategory {
  return (INCIDENT_CATEGORIES as readonly string[]).includes(value);
}

/** Type guard for valid incident priorities. */
export function isValidIncidentPriority(value: string): value is IncidentPriority {
  return (INCIDENT_PRIORITIES as readonly string[]).includes(value);
}

/** Type guard for valid incident statuses. */
export function isValidIncidentStatus(value: string): value is IncidentStatus {
  return (INCIDENT_STATUSES as readonly string[]).includes(value);
}

/**
 * Generates the next sequential ticket number for an event using the event code prefix.
 */
export async function generateUniqueTicketNumber(eventId: string): Promise<string> {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { code: true },
  });

  const prefixKey = event?.code?.trim() || String(new Date().getFullYear());
  const prefix = `INC-${prefixKey}-`;

  const latest = await prisma.incident.findFirst({
    where: { ticketNumber: { startsWith: prefix } },
    orderBy: { ticketNumber: 'desc' },
    select: { ticketNumber: true },
  });

  const suffix = latest?.ticketNumber ? latest.ticketNumber.slice(prefix.length) : '';
  const lastNumeric = parseInt(suffix, 10);
  const nextNumeric = Number.isFinite(lastNumeric) && lastNumeric >= 0 ? lastNumeric + 1 : 1;

  return `${prefix}${String(nextNumeric).padStart(3, '0')}`;
}

/**
 * Executes an incident creation callback with a fresh ticket number, retrying on P2002 unique collisions.
 */
export async function createIncidentWithUniqueTicket<T>(
  eventId: string,
  createFn: (ticketNumber: string) => Promise<T>,
  maxRetries = 5
): Promise<T> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const ticketNumber = await generateUniqueTicketNumber(eventId);
    try {
      return await createFn(ticketNumber);
    } catch (err) {
      const isUniqueCollision =
        err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002';
      if (!isUniqueCollision || attempt === maxRetries - 1) {
        throw err;
      }
    }
  }

  throw new Error('No se pudo generar un número de ticket único');
}
