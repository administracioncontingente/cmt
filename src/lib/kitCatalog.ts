import type { EventKitItem } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import type { EventKitItemDTO, KitSizeGuideRow } from '@/types/domain';

export interface DefaultKitItemDefinition {
  code: string;
  name: string;
  category: string;
  description: string;
  availableSizes: string[];
  availableFits: string[];
  sizeGuide: KitSizeGuideRow[];
  includedQuantity: number;
  isRequired: boolean;
  isActive: boolean;
  sortOrder: number;
}

const STANDARD_APPAREL_SIZES = ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL'];

export const DEFAULT_EVENT_KIT_ITEMS: DefaultKitItemDefinition[] = [
  {
    code: 'POLERA',
    name: 'Polera Institucional del Evento',
    category: 'SUPERIOR',
    description: 'Polera oficial del contingente para uso diario en actividades del evento.',
    availableSizes: STANDARD_APPAREL_SIZES,
    availableFits: ['Unisex / Recto', 'Entallado'],
    sizeGuide: [
      { size: 'XS', chestCm: '90-94', lengthCm: '66', note: 'Corte entallado reduce ~4 cm en contorno' },
      { size: 'S', chestCm: '96-100', lengthCm: '69' },
      { size: 'M', chestCm: '102-106', lengthCm: '72' },
      { size: 'L', chestCm: '108-112', lengthCm: '75' },
      { size: 'XL', chestCm: '114-118', lengthCm: '78' },
      { size: '2XL', chestCm: '120-126', lengthCm: '80' },
      { size: '3XL', chestCm: '128-134', lengthCm: '82' },
    ],
    includedQuantity: 2,
    isRequired: true,
    isActive: true,
    sortOrder: 1,
  },
  {
    code: 'POLERON',
    name: 'Polerón / Hoodie Oficial',
    category: 'ABRIGO',
    description: 'Polerón oficial abrigado con capucha para jornadas frescas y vida en campamento.',
    availableSizes: STANDARD_APPAREL_SIZES,
    availableFits: ['Unisex / Recto'],
    sizeGuide: [
      { size: 'XS', chestCm: '98', lengthCm: '65', sleeveCm: '60' },
      { size: 'S', chestCm: '104', lengthCm: '68', sleeveCm: '62' },
      { size: 'M', chestCm: '110', lengthCm: '71', sleeveCm: '64' },
      { size: 'L', chestCm: '116', lengthCm: '74', sleeveCm: '66' },
      { size: 'XL', chestCm: '122', lengthCm: '77', sleeveCm: '68' },
      { size: '2XL', chestCm: '128', lengthCm: '79', sleeveCm: '70' },
      { size: '3XL', chestCm: '134', lengthCm: '81', sleeveCm: '71' },
    ],
    includedQuantity: 1,
    isRequired: true,
    isActive: true,
    sortOrder: 2,
  },
  {
    code: 'CORTAVIENTO',
    name: 'Chaqueta Cortaviento Impermeable',
    category: 'ABRIGO',
    description: 'Chaqueta exterior impermeable y cortaviento para traslados, salidas y ceremonias.',
    availableSizes: STANDARD_APPAREL_SIZES,
    availableFits: ['Unisex / Recto'],
    sizeGuide: [
      { size: 'XS', chestCm: '102', lengthCm: '68', sleeveCm: '62', note: 'Si usarás polerón debajo considera 1 talla más' },
      { size: 'S', chestCm: '108', lengthCm: '71', sleeveCm: '64', note: 'Si usarás polerón debajo considera 1 talla más' },
      { size: 'M', chestCm: '114', lengthCm: '74', sleeveCm: '66', note: 'Si usarás polerón debajo considera 1 talla más' },
      { size: 'L', chestCm: '120', lengthCm: '77', sleeveCm: '68', note: 'Si usarás polerón debajo considera 1 talla más' },
      { size: 'XL', chestCm: '126', lengthCm: '79', sleeveCm: '70', note: 'Si usarás polerón debajo considera 1 talla más' },
      { size: '2XL', chestCm: '132', lengthCm: '81', sleeveCm: '71', note: 'Si usarás polerón debajo considera 1 talla más' },
      { size: '3XL', chestCm: '138', lengthCm: '83', sleeveCm: '72', note: 'Si usarás polerón debajo considera 1 talla más' },
    ],
    includedQuantity: 1,
    isRequired: true,
    isActive: true,
    sortOrder: 3,
  },
  {
    code: 'CAMISA',
    name: 'Camisa Oficial de Uniforme',
    category: 'SUPERIOR',
    description: 'Camisa institucional de uniforme AGSCH para ceremonias y representación oficial.',
    availableSizes: STANDARD_APPAREL_SIZES,
    availableFits: ['Unisex / Recto', 'Entallado'],
    sizeGuide: [
      { size: 'XS', chestCm: '94', neckCm: '36', lengthCm: '69' },
      { size: 'S', chestCm: '100', neckCm: '38', lengthCm: '72' },
      { size: 'M', chestCm: '106', neckCm: '40', lengthCm: '75' },
      { size: 'L', chestCm: '112', neckCm: '42', lengthCm: '77' },
      { size: 'XL', chestCm: '118', neckCm: '44', lengthCm: '79' },
      { size: '2XL', chestCm: '126', neckCm: '46', lengthCm: '81' },
      { size: '3XL', chestCm: '134', neckCm: '48', lengthCm: '83' },
    ],
    includedQuantity: 1,
    isRequired: true,
    isActive: true,
    sortOrder: 4,
  },
  {
    code: 'PANTALON',
    name: 'Pantalón / Short Desmontable',
    category: 'INFERIOR',
    description: 'Pantalón convertible a short de secado rápido para actividades en terreno.',
    availableSizes: STANDARD_APPAREL_SIZES,
    availableFits: ['Unisex / Recto'],
    sizeGuide: [
      { size: 'XS', waistCm: '70-74', hipCm: '90-94', lengthCm: '99' },
      { size: 'S', waistCm: '76-80', hipCm: '95-99', lengthCm: '101' },
      { size: 'M', waistCm: '82-86', hipCm: '100-104', lengthCm: '103' },
      { size: 'L', waistCm: '88-92', hipCm: '105-109', lengthCm: '105' },
      { size: 'XL', waistCm: '94-100', hipCm: '110-115', lengthCm: '107' },
      { size: '2XL', waistCm: '102-108', hipCm: '116-121', lengthCm: '108' },
      { size: '3XL', waistCm: '110-116', hipCm: '122-127', lengthCm: '109' },
    ],
    includedQuantity: 1,
    isRequired: false,
    isActive: true,
    sortOrder: 5,
  },
  {
    code: 'GORRO',
    name: 'Gorro / Sombrero de Campamento',
    category: 'ACCESORIO',
    description: 'Sombrero o gorro oficial con protección solar para campamento y excursiones.',
    availableSizes: ['S/M (55-57 cm)', 'L/XL (58-61 cm)'],
    availableFits: [],
    sizeGuide: [
      {
        size: 'S/M (55-57 cm)',
        headCm: '55-57',
        note: 'Medir contorno de cabeza 1 cm sobre las cejas y orejas',
      },
      {
        size: 'L/XL (58-61 cm)',
        headCm: '58-61',
        note: 'Medir contorno de cabeza 1 cm sobre las cejas y orejas',
      },
    ],
    includedQuantity: 1,
    isRequired: true,
    isActive: true,
    sortOrder: 6,
  },
];

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function optionalNonEmptyString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value : undefined;
}

function safeParseStringArray(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
  } catch {
    return [];
  }
}

function safeParseSizeGuide(raw: string | null | undefined): KitSizeGuideRow[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    const rows: KitSizeGuideRow[] = [];
    for (const entry of parsed) {
      if (!isPlainRecord(entry) || typeof entry.size !== 'string' || !entry.size.trim()) {
        continue;
      }
      rows.push({
        size: entry.size,
        chestCm: optionalNonEmptyString(entry.chestCm),
        lengthCm: optionalNonEmptyString(entry.lengthCm),
        waistCm: optionalNonEmptyString(entry.waistCm),
        hipCm: optionalNonEmptyString(entry.hipCm),
        sleeveCm: optionalNonEmptyString(entry.sleeveCm),
        headCm: optionalNonEmptyString(entry.headCm),
        neckCm: optionalNonEmptyString(entry.neckCm),
        note: optionalNonEmptyString(entry.note),
      });
    }
    return rows;
  } catch {
    return [];
  }
}

/**
 * Converts a Prisma EventKitItem row into an EventKitItemDTO with safe JSON parsing fallbacks.
 */
export function parseEventKitItem(row: EventKitItem): EventKitItemDTO {
  return {
    id: row.id,
    eventId: row.eventId,
    code: row.code,
    name: row.name,
    category: row.category,
    description: row.description,
    availableSizes: safeParseStringArray(row.availableSizes),
    availableFits: safeParseStringArray(row.availableFits),
    sizeGuide: safeParseSizeGuide(row.sizeGuideJson),
    includedQuantity: row.includedQuantity,
    isRequired: row.isRequired,
    isActive: row.isActive,
    sortOrder: row.sortOrder,
  };
}

/**
 * Seeds the default kit catalog for an event when it has zero EventKitItem rows,
 * then returns all active items ordered by sortOrder ascending, createdAt ascending.
 */
export async function ensureDefaultEventKitItems(eventId: string): Promise<EventKitItemDTO[]> {
  const existingCount = await prisma.eventKitItem.count({
    where: { eventId },
  });

  if (existingCount === 0) {
    await prisma.eventKitItem.createMany({
      data: DEFAULT_EVENT_KIT_ITEMS.map((item) => ({
        eventId,
        code: item.code,
        name: item.name,
        category: item.category,
        description: item.description,
        availableSizes: JSON.stringify(item.availableSizes),
        availableFits: JSON.stringify(item.availableFits),
        sizeGuideJson: JSON.stringify(item.sizeGuide),
        includedQuantity: item.includedQuantity,
        isRequired: item.isRequired,
        isActive: item.isActive,
        sortOrder: item.sortOrder,
      })),
      skipDuplicates: true,
    });
  }

  const items = await prisma.eventKitItem.findMany({
    where: {
      eventId,
      isActive: true,
    },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
  });

  return items.map(parseEventKitItem);
}

/**
 * Builds a concise human-readable uniform size summary (<= 240 chars) from kit selections.
 */
export function buildUniformSizeSummary(
  selections: Array<{
    kitItemName?: string;
    code?: string;
    size: string;
    fit?: string | null;
  }>
): string {
  const parts = selections
    .map((sel) => {
      const size = sel.size?.trim();
      if (!size) return '';
      const label = (sel.kitItemName || sel.code || '').trim();
      const fit = sel.fit?.trim();
      const value = fit ? `${size} (${fit})` : size;
      return label ? `${label}: ${value}` : value;
    })
    .filter((part) => part.length > 0);

  if (parts.length === 0) return '';

  const joined = parts.join(' | ');
  if (joined.length <= 240) return joined;

  let summary = '';
  for (let i = 0; i < parts.length; i++) {
    const candidate = summary ? `${summary} | ${parts[i]}` : parts[i];
    const hasMore = i < parts.length - 1;
    const reserve = hasMore ? 6 : 0; // Room for " | ..."
    if (candidate.length + reserve <= 240) {
      summary = candidate;
    } else {
      break;
    }
  }

  if (!summary) {
    return `${parts[0].slice(0, 237).trimEnd()}...`;
  }

  return `${summary} | ...`;
}
