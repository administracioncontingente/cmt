import { Prisma } from '@prisma/client';
import type { PortalTicketDTO } from '@/types/domain';

/**
 * Prisma select for participant-facing tickets: never exposes internal staff notes,
 * assignees, or staff user identities.
 */
export const PORTAL_TICKET_SELECT = {
  id: true,
  ticketNumber: true,
  title: true,
  description: true,
  category: true,
  priority: true,
  status: true,
  resolutionNotes: true,
  resolvedAt: true,
  createdAt: true,
  updatedAt: true,
  comments: {
    where: { isInternal: false },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      userId: true,
      authorName: true,
      content: true,
      createdAt: true,
    },
  },
} satisfies Prisma.IncidentSelect;

export type PortalTicketRecord = Prisma.IncidentGetPayload<{
  select: typeof PORTAL_TICKET_SELECT;
}>;

/** Maps a ticket record to its participant-safe DTO (participant messages have no staff userId). */
export function toPortalTicketDTO(record: PortalTicketRecord): PortalTicketDTO {
  const isResolved = record.status === 'RESUELTA' || record.status === 'CERRADA';
  return {
    id: record.id,
    ticketNumber: record.ticketNumber,
    title: record.title,
    description: record.description,
    category: record.category,
    priority: record.priority,
    status: record.status,
    resolutionNotes: isResolved ? record.resolutionNotes : null,
    resolvedAt: record.resolvedAt,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    messages: record.comments.map((c) => ({
      id: c.id,
      authorName: c.userId ? `${c.authorName} (Equipo)` : c.authorName,
      content: c.content,
      fromParticipant: !c.userId,
      createdAt: c.createdAt,
    })),
  };
}
