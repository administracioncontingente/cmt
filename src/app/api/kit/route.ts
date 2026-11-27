import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  getCurrentUser,
  getEventPermissions,
  resolveAuthorizedEventId,
} from '@/lib/auth';
import {
  ensureDefaultEventKitItems,
  parseEventKitItem,
} from '@/lib/kitCatalog';
import { apiErrorResponse } from '@/lib/apiUtils';
import type {
  EventKitItemDTO,
  KitItemSummaryDTO,
  KitMatrixCellDTO,
  KitMatrixSummaryDTO,
  KitParticipantRowDTO,
  KitSizeGuideRow,
  ParticipantKitSizeDTO,
} from '@/types/domain';

const ALLOWED_KIT_CATEGORIES = new Set([
  'SUPERIOR',
  'ABRIGO',
  'INFERIOR',
  'ACCESORIO',
]);

interface UpsertKitItemBody {
  id?: string;
  eventId?: string;
  code?: string;
  name?: string;
  category?: string;
  description?: string | null;
  availableSizes?: unknown;
  availableFits?: unknown;
  sizeGuide?: unknown;
  includedQuantity?: unknown;
  isRequired?: unknown;
  isActive?: unknown;
  sortOrder?: unknown;
}

function normalizeStringArray(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const result: string[] = [];

  for (const entry of raw) {
    if (typeof entry !== 'string') continue;
    const trimmed = entry.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    result.push(trimmed);
  }
  return result;
}

function normalizeSizeGuide(raw: unknown): KitSizeGuideRow[] | null {
  if (raw === undefined) return null;
  if (!Array.isArray(raw)) return [];

  const opt = (val: unknown): string | undefined =>
    typeof val === 'string' && val.trim() ? val.trim() : undefined;

  const rows: KitSizeGuideRow[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) continue;
    const row = entry as Record<string, unknown>;
    const size = opt(row.size);
    if (!size) continue;
    rows.push({
      size,
      chestCm: opt(row.chestCm),
      lengthCm: opt(row.lengthCm),
      waistCm: opt(row.waistCm),
      hipCm: opt(row.hipCm),
      sleeveCm: opt(row.sleeveCm),
      headCm: opt(row.headCm),
      neckCm: opt(row.neckCm),
      note: opt(row.note),
    });
  }
  return rows;
}

function parsePositiveInt(raw: unknown, fallback: number): number | null {
  if (raw === undefined || raw === null || raw === '') return fallback;
  const num = typeof raw === 'number' ? raw : Number(raw);
  if (!Number.isInteger(num) || num < 1) return null;
  return num;
}

function parseIntOrDefault(raw: unknown, fallback: number): number {
  if (raw === undefined || raw === null || raw === '') return fallback;
  const num = typeof raw === 'number' ? raw : Number(raw);
  return Number.isInteger(num) ? num : fallback;
}

function buildBreakdownForItem(
  item: EventKitItemDTO,
  participantRows: KitParticipantRowDTO[]
): KitItemSummaryDTO {
  const cellMap = new Map<string, KitMatrixCellDTO>();
  let totalConfirmedParticipants = 0;

  for (const participant of participantRows) {
    const selection = participant.selections.find(
      (sel) => sel.kitItemId === item.id && sel.size.trim().length > 0
    );
    if (!selection) continue;

    totalConfirmedParticipants += 1;
    const size = selection.size.trim();
    const fit = selection.fit?.trim() || 'Estándar';
    const cellKey = `${size}\u0000${fit}`;

    const existing = cellMap.get(cellKey);
    if (existing) {
      existing.count += 1;
      existing.units = existing.count * item.includedQuantity;
    } else {
      cellMap.set(cellKey, {
        size,
        fit,
        count: 1,
        units: item.includedQuantity,
      });
    }
  }

  const sizeOrder = new Map(item.availableSizes.map((s, idx) => [s, idx]));
  const fitOrder = new Map(item.availableFits.map((f, idx) => [f, idx]));

  const breakdown = Array.from(cellMap.values()).sort((a, b) => {
    const sa = sizeOrder.get(a.size) ?? Number.MAX_SAFE_INTEGER;
    const sb = sizeOrder.get(b.size) ?? Number.MAX_SAFE_INTEGER;
    if (sa !== sb) return sa - sb;
    const sizeCmp = a.size.localeCompare(b.size);
    if (sizeCmp !== 0) return sizeCmp;

    const fa = fitOrder.get(a.fit) ?? Number.MAX_SAFE_INTEGER;
    const fb = fitOrder.get(b.fit) ?? Number.MAX_SAFE_INTEGER;
    if (fa !== fb) return fa - fb;
    return a.fit.localeCompare(b.fit);
  });

  return {
    item,
    totalConfirmedParticipants,
    totalUnits: totalConfirmedParticipants * item.includedQuantity,
    breakdown,
  };
}

/**
 * Returns the event's kit catalog, supplier sizing matrix breakdown,
 * and active participants' kit completion statuses.
 */
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const paramEventId = searchParams.get('eventId');
    const includeInactive = searchParams.get('includeInactive') === 'true';

    const { eventId: activeEventId, forbidden } = await resolveAuthorizedEventId(
      user,
      paramEventId
    );

    if (forbidden) {
      return NextResponse.json(
        { error: 'No tienes acceso a este evento' },
        { status: 403 }
      );
    }

    if (!activeEventId) {
      const empty: KitMatrixSummaryDTO = {
        items: [],
        totalsByItem: [],
        completedParticipants: 0,
        partialParticipants: 0,
        pendingParticipants: 0,
        totalActiveParticipants: 0,
        participants: [],
      };
      return NextResponse.json(empty);
    }

    const permissions = getEventPermissions(user, activeEventId);
    if (!permissions.canView) {
      return NextResponse.json(
        { error: 'No tienes acceso a este evento' },
        { status: 403 }
      );
    }

    const activeItems = await ensureDefaultEventKitItems(activeEventId);
    const items: EventKitItemDTO[] = includeInactive
      ? (
          await prisma.eventKitItem.findMany({
            where: { eventId: activeEventId },
            orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
          })
        ).map(parseEventKitItem)
      : activeItems;

    const activeParticipants = await prisma.participant.findMany({
      where: {
        eventId: activeEventId,
        status: { not: 'RETIRADO' },
      },
      select: {
        id: true,
        rut: true,
        firstName: true,
        lastName: true,
        secondLastName: true,
        contingentRole: true,
        scoutGroup: true,
        unitName: true,
        cupoCode: true,
        uniformSize: true,
        kitSizes: {
          include: {
            kitItem: {
              select: {
                id: true,
                code: true,
                name: true,
                category: true,
                includedQuantity: true,
              },
            },
          },
          orderBy: { kitItem: { sortOrder: 'asc' } },
        },
      },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    });

    const activeItemIdSet = new Set(activeItems.map((item) => item.id));
    const displayItemIdSet = new Set(items.map((item) => item.id));
    const requiredItemIds = activeItems
      .filter((item) => item.isRequired)
      .map((item) => item.id);

    let completedParticipants = 0;
    let partialParticipants = 0;
    let pendingParticipants = 0;

    const participantRows: KitParticipantRowDTO[] = activeParticipants.map((p) => {
      const activeSelections = p.kitSizes.filter(
        (sel) => activeItemIdSet.has(sel.kitItemId) && sel.size.trim().length > 0
      );
      const selectedActiveIds = new Set(
        activeSelections.map((sel) => sel.kitItemId)
      );

      let kitStatus: 'COMPLETED' | 'PARTIAL' | 'PENDING' = 'PENDING';
      if (activeSelections.length === 0) {
        kitStatus = 'PENDING';
      } else if (
        requiredItemIds.length === 0 ||
        requiredItemIds.every((reqId) => selectedActiveIds.has(reqId))
      ) {
        kitStatus = 'COMPLETED';
      } else {
        kitStatus = 'PARTIAL';
      }

      if (kitStatus === 'COMPLETED') completedParticipants += 1;
      else if (kitStatus === 'PARTIAL') partialParticipants += 1;
      else pendingParticipants += 1;

      const selections: ParticipantKitSizeDTO[] = p.kitSizes
        .filter((sel) => displayItemIdSet.has(sel.kitItemId))
        .map((sel) => ({
          id: sel.id,
          kitItemId: sel.kitItemId,
          size: sel.size,
          fit: sel.fit,
          notes: sel.notes,
          confirmedAt: sel.confirmedAt,
          updatedAt: sel.updatedAt,
          kitItem: sel.kitItem,
        }));

      return {
        id: p.id,
        rut: p.rut,
        firstName: p.firstName,
        lastName: p.lastName,
        secondLastName: p.secondLastName,
        contingentRole: p.contingentRole,
        scoutGroup: p.scoutGroup,
        unitName: p.unitName,
        cupoCode: p.cupoCode,
        uniformSize: p.uniformSize,
        kitStatus,
        selections,
      };
    });

    const totalsByItem: KitItemSummaryDTO[] = items.map((item) =>
      buildBreakdownForItem(item, participantRows)
    );

    const summary: KitMatrixSummaryDTO = {
      items,
      totalsByItem,
      completedParticipants,
      partialParticipants,
      pendingParticipants,
      totalActiveParticipants: participantRows.length,
      participants: participantRows,
    };

    return NextResponse.json(summary);
  } catch (error: unknown) {
    return apiErrorResponse(
      error,
      'Error al calcular la matriz de tallas del kit',
      500
    );
  }
}

/**
 * Creates or updates an EventKitItem in the authorized active event.
 */
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  let body: UpsertKitItemBody;
  try {
    const parsed: unknown = await req.json();
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return NextResponse.json(
        { error: 'Cuerpo JSON inválido' },
        { status: 400 }
      );
    }
    body = parsed as UpsertKitItemBody;
  } catch {
    return NextResponse.json(
      { error: 'Cuerpo JSON inválido' },
      { status: 400 }
    );
  }

  try {
    const { searchParams } = new URL(req.url);
    const requestedEventId =
      typeof body.eventId === 'string' && body.eventId.trim()
        ? body.eventId.trim()
        : searchParams.get('eventId');

    const { eventId: activeEventId, forbidden } = await resolveAuthorizedEventId(
      user,
      requestedEventId
    );

    if (forbidden) {
      return NextResponse.json(
        { error: 'No tienes acceso a este evento' },
        { status: 403 }
      );
    }

    if (!activeEventId) {
      return NextResponse.json(
        { error: 'No hay un evento activo seleccionado' },
        { status: 400 }
      );
    }

    const permissions = getEventPermissions(user, activeEventId);
    if (!permissions.isEventAdmin && !permissions.canEditParticipants) {
      return NextResponse.json(
        { error: 'No tienes permisos para configurar prendas del kit' },
        { status: 403 }
      );
    }

    const itemId = typeof body.id === 'string' && body.id.trim() ? body.id.trim() : null;
    const code = typeof body.code === 'string' ? body.code.trim().toUpperCase() : '';
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const rawCategory =
      typeof body.category === 'string' && body.category.trim()
        ? body.category.trim().toUpperCase()
        : 'SUPERIOR';
    const description =
      typeof body.description === 'string' && body.description.trim()
        ? body.description.trim()
        : null;

    if (!code) {
      return NextResponse.json(
        { error: 'El código de la prenda es obligatorio' },
        { status: 400 }
      );
    }

    if (!name) {
      return NextResponse.json(
        { error: 'El nombre de la prenda es obligatorio' },
        { status: 400 }
      );
    }

    if (!ALLOWED_KIT_CATEGORIES.has(rawCategory)) {
      return NextResponse.json(
        {
          error:
            'Categoría inválida. Usa SUPERIOR, ABRIGO, INFERIOR o ACCESORIO.',
        },
        { status: 400 }
      );
    }

    const availableSizes = normalizeStringArray(body.availableSizes);
    if (availableSizes.length < 1) {
      return NextResponse.json(
        { error: 'Debes indicar al menos una talla disponible' },
        { status: 400 }
      );
    }

    const availableFits = normalizeStringArray(body.availableFits);
    const normalizedSizeGuide = normalizeSizeGuide(body.sizeGuide);

    const includedQuantity = parsePositiveInt(body.includedQuantity, 1);
    if (includedQuantity === null) {
      return NextResponse.json(
        { error: 'La cantidad incluida por participante debe ser un entero mayor o igual a 1' },
        { status: 400 }
      );
    }

    const isRequired =
      typeof body.isRequired === 'boolean' ? body.isRequired : true;
    const isActive = typeof body.isActive === 'boolean' ? body.isActive : true;
    const sortOrder = parseIntOrDefault(body.sortOrder, 0);

    if (itemId) {
      const existing = await prisma.eventKitItem.findUnique({
        where: { id: itemId },
      });

      if (!existing) {
        return NextResponse.json(
          { error: 'Prenda del kit no encontrada' },
          { status: 404 }
        );
      }

      if (existing.eventId !== activeEventId) {
        return NextResponse.json(
          { error: 'La prenda no pertenece al evento activo' },
          { status: 403 }
        );
      }

      if (code !== existing.code) {
        const collision = await prisma.eventKitItem.findUnique({
          where: {
            eventId_code: {
              eventId: activeEventId,
              code,
            },
          },
          select: { id: true },
        });
        if (collision) {
          return NextResponse.json(
            { error: `Ya existe una prenda con el código "${code}" en este evento` },
            { status: 409 }
          );
        }
      }

      const saved = await prisma.eventKitItem.update({
        where: { id: itemId },
        data: {
          code,
          name,
          category: rawCategory,
          description,
          availableSizes: JSON.stringify(availableSizes),
          availableFits: JSON.stringify(availableFits),
          ...(normalizedSizeGuide !== null
            ? { sizeGuideJson: JSON.stringify(normalizedSizeGuide) }
            : {}),
          includedQuantity,
          isRequired,
          isActive,
          sortOrder,
        },
      });

      return NextResponse.json({
        success: true,
        item: parseEventKitItem(saved),
      });
    }

    const duplicate = await prisma.eventKitItem.findUnique({
      where: {
        eventId_code: {
          eventId: activeEventId,
          code,
        },
      },
      select: { id: true },
    });

    if (duplicate) {
      return NextResponse.json(
        { error: `Ya existe una prenda con el código "${code}" en este evento` },
        { status: 409 }
      );
    }

    const saved = await prisma.eventKitItem.create({
      data: {
        eventId: activeEventId,
        code,
        name,
        category: rawCategory,
        description,
        availableSizes: JSON.stringify(availableSizes),
        availableFits: JSON.stringify(availableFits),
        sizeGuideJson: JSON.stringify(normalizedSizeGuide ?? []),
        includedQuantity,
        isRequired,
        isActive,
        sortOrder,
      },
    });

    return NextResponse.json(
      {
        success: true,
        item: parseEventKitItem(saved),
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    return apiErrorResponse(
      error,
      'Error al guardar la configuración de la prenda del kit',
      500
    );
  }
}

/**
 * Deletes an EventKitItem belonging to the active event (event admin only).
 */
export async function DELETE(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id')?.trim() || '';
    const paramEventId = searchParams.get('eventId');

    if (!id) {
      return NextResponse.json(
        { error: 'Falta el parámetro id de la prenda' },
        { status: 400 }
      );
    }

    const { eventId: activeEventId, forbidden } = await resolveAuthorizedEventId(
      user,
      paramEventId
    );

    if (forbidden) {
      return NextResponse.json(
        { error: 'No tienes acceso a este evento' },
        { status: 403 }
      );
    }

    if (!activeEventId) {
      return NextResponse.json(
        { error: 'No hay un evento activo seleccionado' },
        { status: 400 }
      );
    }

    const permissions = getEventPermissions(user, activeEventId);
    if (!permissions.isEventAdmin) {
      return NextResponse.json(
        { error: 'Solo los administradores del evento pueden eliminar prendas del kit' },
        { status: 403 }
      );
    }

    const existing = await prisma.eventKitItem.findUnique({
      where: { id },
      include: {
        _count: {
          select: { selections: true },
        },
      },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Prenda del kit no encontrada' },
        { status: 404 }
      );
    }

    if (existing.eventId !== activeEventId) {
      return NextResponse.json(
        { error: 'La prenda no pertenece al evento activo' },
        { status: 403 }
      );
    }

    await prisma.eventKitItem.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      deletedId: id,
      removedSelectionsCount: existing._count.selections,
    });
  } catch (error: unknown) {
    return apiErrorResponse(error, 'Error al eliminar la prenda del kit', 500);
  }
}
