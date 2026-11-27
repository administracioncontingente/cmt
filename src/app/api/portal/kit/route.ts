import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getParticipantSession } from '@/lib/participantAuth';
import {
  buildUniformSizeSummary,
  ensureDefaultEventKitItems,
} from '@/lib/kitCatalog';
import { apiErrorResponse } from '@/lib/apiUtils';
import type { EventKitItemDTO } from '@/types/domain';

interface KitSelectionInput {
  kitItemId: string;
  size: string;
  fit?: string | null;
  notes?: string | null;
}

interface NormalizedKitSelection {
  kitItemId: string;
  size: string;
  fit: string | null;
  notes: string | null;
}

function validateAndNormalizeSelections(
  rawSelections: unknown[],
  kitItems: EventKitItemDTO[]
): { validSelections: NormalizedKitSelection[] } | { error: string } {
  const itemById = new Map(kitItems.map((item) => [item.id, item]));
  const seenItemIds = new Set<string>();
  const validSelections: NormalizedKitSelection[] = [];

  for (const rawEntry of rawSelections) {
    if (!rawEntry || typeof rawEntry !== 'object' || Array.isArray(rawEntry)) {
      return { error: 'Formato inválido en las selecciones del kit.' };
    }

    const entry = rawEntry as Partial<KitSelectionInput>;
    const kitItemId =
      typeof entry.kitItemId === 'string' ? entry.kitItemId.trim() : '';

    if (!kitItemId) {
      return { error: 'Cada selección debe indicar el identificador de la prenda.' };
    }

    if (seenItemIds.has(kitItemId)) {
      return { error: 'No puedes enviar prendas duplicadas en la selección.' };
    }
    seenItemIds.add(kitItemId);

    const item = itemById.get(kitItemId);
    if (!item) {
      return {
        error: `La prenda seleccionada (${kitItemId}) no pertenece al catálogo activo del evento.`,
      };
    }

    const size = typeof entry.size === 'string' ? entry.size.trim() : '';
    if (!size) {
      if (item.isRequired) {
        return { error: `Debes seleccionar una talla para "${item.name}".` };
      }
      continue;
    }

    if (!item.availableSizes.includes(size)) {
      return {
        error: `La talla "${size}" no es válida para "${item.name}". Opciones: ${item.availableSizes.join(', ')}.`,
      };
    }

    const rawFit = typeof entry.fit === 'string' ? entry.fit.trim() : '';
    if (item.availableFits.length > 0 && rawFit && !item.availableFits.includes(rawFit)) {
      return {
        error: `El corte "${rawFit}" no es válido para "${item.name}". Opciones: ${item.availableFits.join(', ')}.`,
      };
    }

    const fit = item.availableFits.length > 0 ? rawFit || null : null;
    const notes =
      typeof entry.notes === 'string' && entry.notes.trim()
        ? entry.notes.trim().slice(0, 200)
        : null;

    validSelections.push({
      kitItemId,
      size,
      fit,
      notes,
    });
  }

  const selectedIds = new Set(validSelections.map((sel) => sel.kitItemId));
  const missingRequired = kitItems.filter(
    (item) => item.isRequired && !selectedIds.has(item.id)
  );

  if (missingRequired.length > 0) {
    return {
      error: `Falta seleccionar talla obligatoria para: ${missingRequired.map((item) => item.name).join(', ')}.`,
    };
  }

  return { validSelections };
}

/**
 * Returns the active kit catalog for the authenticated participant's event
 * along with their currently saved size selections.
 */
export async function GET() {
  const session = await getParticipantSession();
  if (!session) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  try {
    const participant = await prisma.participant.findUnique({
      where: { id: session.participantId },
      select: {
        id: true,
        eventId: true,
        uniformSize: true,
      },
    });

    if (!participant) {
      return NextResponse.json(
        { error: 'Participante no encontrado' },
        { status: 404 }
      );
    }

    if (!participant.eventId) {
      return NextResponse.json({ kitItems: [], kitSizes: [] });
    }

    const kitItems = await ensureDefaultEventKitItems(participant.eventId);
    const kitSizes = await prisma.participantKitSize.findMany({
      where: { participantId: participant.id },
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
    });

    return NextResponse.json({ kitItems, kitSizes });
  } catch (error: unknown) {
    return apiErrorResponse(
      error,
      'Error al cargar el catálogo de tallas del kit',
      500
    );
  }
}

/**
 * Validates and persists the authenticated participant's kit size selections
 * atomically, updating their legacy uniformSize summary column.
 */
export async function POST(req: NextRequest) {
  const session = await getParticipantSession();
  if (!session) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  let body: { selections?: unknown };
  try {
    const parsed: unknown = await req.json();
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return NextResponse.json(
        { error: 'Cuerpo JSON inválido' },
        { status: 400 }
      );
    }
    body = parsed as { selections?: unknown };
  } catch {
    return NextResponse.json(
      { error: 'Cuerpo JSON inválido' },
      { status: 400 }
    );
  }

  if (!Array.isArray(body.selections)) {
    return NextResponse.json(
      { error: 'El campo selections debe ser un arreglo de prendas' },
      { status: 400 }
    );
  }

  try {
    const participant = await prisma.participant.findUnique({
      where: { id: session.participantId },
      select: {
        id: true,
        eventId: true,
      },
    });

    if (!participant) {
      return NextResponse.json(
        { error: 'Participante no encontrado' },
        { status: 404 }
      );
    }

    if (!participant.eventId) {
      return NextResponse.json(
        { error: 'El participante no tiene un evento asociado' },
        { status: 400 }
      );
    }

    const kitItems = await ensureDefaultEventKitItems(participant.eventId);
    const validation = validateAndNormalizeSelections(body.selections, kitItems);
    if ('error' in validation) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    const { validSelections } = validation;
    const selectedIdSet = new Set(validSelections.map((sel) => sel.kitItemId));
    const clearedActiveItemIds = kitItems
      .map((item) => item.id)
      .filter((id) => !selectedIdSet.has(id));

    const now = new Date();

    const txResult = await prisma.$transaction(async (tx) => {
      if (clearedActiveItemIds.length > 0) {
        await tx.participantKitSize.deleteMany({
          where: {
            participantId: participant.id,
            kitItemId: { in: clearedActiveItemIds },
          },
        });
      }

      for (const sel of validSelections) {
        await tx.participantKitSize.upsert({
          where: {
            participantId_kitItemId: {
              participantId: participant.id,
              kitItemId: sel.kitItemId,
            },
          },
          create: {
            participantId: participant.id,
            kitItemId: sel.kitItemId,
            size: sel.size,
            fit: sel.fit,
            notes: sel.notes,
            confirmedAt: now,
          },
          update: {
            size: sel.size,
            fit: sel.fit,
            notes: sel.notes,
            confirmedAt: now,
          },
        });
      }

      const updatedSelections = await tx.participantKitSize.findMany({
        where: { participantId: participant.id },
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
      });

      const uniformSizeSummary = buildUniformSizeSummary(
        updatedSelections.map((sel) => ({
          kitItemName: sel.kitItem?.name,
          code: sel.kitItem?.code,
          size: sel.size,
          fit: sel.fit,
        }))
      );

      await tx.participant.update({
        where: { id: participant.id },
        data: {
          uniformSize: uniformSizeSummary || null,
        },
      });

      return { updatedSelections, uniformSizeSummary };
    });

    return NextResponse.json({
      success: true,
      kitSizes: txResult.updatedSelections,
      uniformSizeSummary: txResult.uniformSizeSummary,
    });
  } catch (error: unknown) {
    return apiErrorResponse(
      error,
      'Error al guardar las tallas del kit',
      500
    );
  }
}
