import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';

/**
 * Extracts a safe string message from an unknown thrown value.
 */
export function getErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;
  if (
    err &&
    typeof err === 'object' &&
    'message' in err &&
    typeof (err as { message: unknown }).message === 'string'
  ) {
    return (err as { message: string }).message;
  }
  return 'Error desconocido';
}

/**
 * Logs a server error and returns a sanitized NextResponse.
 * Translates common Prisma known request errors (P2025, P2002) and hides raw 500 details in production.
 */
export function apiErrorResponse(
  err: unknown,
  fallbackMessage: string,
  status = 500
): NextResponse {
  console.error(fallbackMessage, err);

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2025') {
      return NextResponse.json({ error: 'Registro no encontrado' }, { status: 404 });
    }
    if (err.code === 'P2002') {
      return NextResponse.json({ error: 'Registro duplicado' }, { status: 409 });
    }
  }

  const isProd = process.env.NODE_ENV === 'production';
  if (status === 500 && isProd) {
    return NextResponse.json({ error: fallbackMessage }, { status: 500 });
  }

  const detail = getErrorMessage(err);
  const message =
    status === 500 && detail && detail !== 'Error desconocido'
      ? `${fallbackMessage}: ${detail}`
      : fallbackMessage;

  return NextResponse.json({ error: message }, { status });
}

/**
 * Parses an optional numeric input into a finite number or null (never NaN).
 */
export function parseOptionalFloat(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

/**
 * Parses an optional Date, ISO/DD-MM-YYYY string, or Excel serial date (>= 1) into a valid Date or null.
 */
export function parseOptionalDate(value: unknown): Date | null {
  if (value === null || value === undefined || value === '') return null;

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  if (typeof value === 'number') {
    if (!Number.isFinite(value) || value < 1) return null;
    // Excel 1900 epoch serial date (25569 corresponds to 1970-01-01 UTC)
    const utcMs = Math.round((value - 25569) * 86400 * 1000);
    const parsed = new Date(utcMs);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;

    const ddmmyyyy = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(trimmed);
    if (ddmmyyyy) {
      const day = Number(ddmmyyyy[1]);
      const month = Number(ddmmyyyy[2]);
      const year = Number(ddmmyyyy[3]);
      if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
        const parsed = new Date(Date.UTC(year, month - 1, day));
        if (
          !Number.isNaN(parsed.getTime()) &&
          parsed.getUTCFullYear() === year &&
          parsed.getUTCMonth() === month - 1 &&
          parsed.getUTCDate() === day
        ) {
          return parsed;
        }
      }
      return null;
    }

    const parsed = new Date(trimmed);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  return null;
}
