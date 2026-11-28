import { Prisma } from '@prisma/client';

export type RoleKey = 'JOVEN' | 'DIRIGENTE' | 'IST' | 'CMT';

/**
 * Normalizes any contingent role label from forms, spreadsheets, or legacy rows into a canonical RoleKey.
 */
export function normalizeRoleKey(rawRole?: string | null): RoleKey {
  const r = (rawRole || '').trim().toUpperCase();
  if (!r) return 'JOVEN';
  if (
    r.includes('RESPONSABLE') ||
    r.includes('DIRIGENTE') ||
    r.includes('EDUCADOR') ||
    r.includes('LEADER')
  ) {
    return 'DIRIGENTE';
  }
  if (r.includes('IST') || r.includes('SERVICIO')) {
    return 'IST';
  }
  if (r.includes('CMT') || r.includes('CONTINGENTE')) {
    return 'CMT';
  }
  return 'JOVEN';
}

/**
 * Builds the Prisma Participant where filter for a role filter option.
 */
export function buildRoleWhereClause(role: string): Prisma.ParticipantWhereInput {
  const normalized = role.trim().toUpperCase();
  if (!normalized || normalized === 'ALL') return {};

  if (normalized === 'JOVEN') {
    return {
      contingentRole: { in: ['Participante', 'PARTICIPANTE', 'JOVEN'] },
    };
  }
  if (normalized === 'DIRIGENTE') {
    return {
      contingentRole: {
        in: ['RESPONSABLE', 'Responsable de Patrulla', 'DIRIGENTE', 'Educador'],
      },
    };
  }
  if (normalized === 'IST') {
    return { contingentRole: 'IST' };
  }
  if (normalized === 'CMT') {
    return { contingentRole: 'CMT' };
  }

  return { contingentRole: role };
}

/**
 * Returns institutional light-theme badge metadata for a participant contingent role.
 */
export function getRoleBadgeInfo(role?: string | null): { label: string; className: string } {
  const r = (role || '').toUpperCase();
  if (r.includes('RESPONSABLE') || r.includes('DIRIGENTE') || r.includes('EDUCADOR')) {
    return {
      label: r.includes('PATRULLA') ? 'Resp. Patrulla' : 'Educador / Dirigente',
      className: 'bg-[#FFF8E1] text-[#001558] border-[#FEB135]',
    };
  }
  if (r.includes('IST') || r.includes('SERVICIO')) {
    return {
      label: 'IST Servicio',
      className: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    };
  }
  if (r.includes('CMT')) {
    return {
      label: 'CMT Gestión',
      className: 'bg-purple-50 text-purple-800 border-purple-200',
    };
  }
  return {
    label: 'Joven Participante',
    className: 'bg-[#EEF2FF] text-[#001558] border-[#001558]/20',
  };
}
