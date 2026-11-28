import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { getParticipantSession } from '@/lib/participantAuth';
import { ensureDefaultEventKitItems } from '@/lib/kitCatalog';
import {
  calculateFinancialSummary,
  resolveParticipantTargetAmount,
} from '@/lib/finance';
import { generateMedicalQr } from '@/lib/qr';
import { apiErrorResponse, parseOptionalDate } from '@/lib/apiUtils';
import type {
  PortalHouseholdMemberDTO,
  PortalMeResponseDTO,
} from '@/types/domain';

const SAFE_STRING_FIELDS = [
  'phone',
  'gender',
  'address',
  'commune',
  'city',
  'nationality',
  'secondNationality',
  'dietaryRestrictions',
  'medicalNotes',
  'guardianName',
  'guardianRelationship',
  'guardianPhone',
  'guardianEmail',
  'scoutGroup',
  'scoutZone',
  'scoutDistrict',
  'groupLeaderName',
  'groupLeaderEmail',
  'groupLeaderPhone',
] as const;

type SafeStringField = (typeof SAFE_STRING_FIELDS)[number];

const EMAIL_NORMALIZED_FIELDS = new Set<SafeStringField>([
  'guardianEmail',
  'groupLeaderEmail',
]);

export async function GET(req: NextRequest) {
  const session = await getParticipantSession();
  if (!session) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  try {
    const participantRecord = await prisma.participant.findUnique({
      where: { id: session.participantId },
      include: {
        event: {
          select: {
            id: true,
            code: true,
            name: true,
            shortName: true,
            flagEmoji: true,
            currency: true,
            country: true,
            city: true,
            isDefault: true,
          },
        },
        plan: {
          include: {
            installments: {
              orderBy: { installmentNumber: 'asc' },
            },
          },
        },
        payments: {
          orderBy: { paymentDate: 'desc' },
        },
        medicalRecord: true,
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
          orderBy: {
            kitItem: {
              sortOrder: 'asc',
            },
          },
        },
      },
    });

    if (!participantRecord) {
      return NextResponse.json(
        { error: 'Participante no encontrado' },
        { status: 404 }
      );
    }

    const { event, ...participantData } = participantRecord;

    const totalAmount = resolveParticipantTargetAmount(
      participantRecord.targetFeeUSD,
      participantRecord.plan?.totalAmount
    );

    const financial = calculateFinancialSummary(
      participantRecord.plan?.installments || [],
      participantRecord.payments || [],
      totalAmount
    );

    const [kitItems, eventDocuments] = participantRecord.eventId
      ? await Promise.all([
          ensureDefaultEventKitItems(participantRecord.eventId),
          prisma.eventDocument.findMany({
            where: {
              eventId: participantRecord.eventId,
              isPublished: true,
            },
            orderBy: [
              { isPinned: 'desc' },
              { publishedAt: 'desc' },
              { createdAt: 'desc' },
            ],
            select: {
              id: true,
              eventId: true,
              title: true,
              summary: true,
              category: true,
              documentCode: true,
              audience: true,
              storageType: true,
              externalUrl: true,
              fileName: true,
              mimeType: true,
              sizeBytes: true,
              isPublished: true,
              isPinned: true,
              publishedAt: true,
              downloadCount: true,
              uploadedById: true,
              createdAt: true,
              updatedAt: true,
            },
          }),
        ])
      : [[], []];

    const householdParticipants = await prisma.participant.findMany({
      where: {
        OR: [
          { email: { equals: session.email, mode: 'insensitive' } },
          { guardianEmail: { equals: session.email, mode: 'insensitive' } },
        ],
      },
      orderBy: [{ createdAt: 'desc' }],
      select: {
        id: true,
        rut: true,
        firstName: true,
        lastName: true,
        contingentRole: true,
        event: {
          select: {
            name: true,
            code: true,
          },
        },
      },
    });

    const household: PortalHouseholdMemberDTO[] = householdParticipants.map(
      (member) => ({
        id: member.id,
        rut: member.rut,
        firstName: member.firstName,
        lastName: member.lastName,
        contingentRole: member.contingentRole,
        eventName: member.event?.name ?? null,
        eventCode: member.event?.code ?? null,
      })
    );

    let qrEmergencyUrl: string | null = null;
    let qrDataUrl: string | null = null;
    if (participantRecord.medicalRecord?.qrAccessCode) {
      const qr = await generateMedicalQr(
        req,
        participantRecord.medicalRecord.qrAccessCode
      );
      qrEmergencyUrl = qr.qrEmergencyUrl;
      qrDataUrl = qr.qrDataUrl;
    }

    const payload: PortalMeResponseDTO = {
      participant: {
        ...participantData,
        financial,
        kitSizes: participantRecord.kitSizes,
      },
      event: event ?? null,
      household,
      kitItems,
      kitSizes: participantRecord.kitSizes,
      eventDocuments,
      qrEmergencyUrl,
      qrDataUrl,
      sessionEmail: session.email,
    };

    return NextResponse.json(payload);
  } catch (error: unknown) {
    return apiErrorResponse(
      error,
      'Error al obtener el perfil del participante',
      500
    );
  }
}

export async function PUT(req: NextRequest) {
  const session = await getParticipantSession();
  if (!session) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return NextResponse.json(
      { error: 'Cuerpo JSON inválido' },
      { status: 400 }
    );
  }

  if (!rawBody || typeof rawBody !== 'object' || Array.isArray(rawBody)) {
    return NextResponse.json(
      { error: 'Cuerpo JSON inválido' },
      { status: 400 }
    );
  }

  const body = rawBody as Record<string, unknown>;

  try {
    const existing = await prisma.participant.findUnique({
      where: { id: session.participantId },
      select: { id: true },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Participante no encontrado' },
        { status: 404 }
      );
    }

    // Strict allowlist of self-service editable profile fields only.
    const updateData: Prisma.ParticipantUpdateInput = {};

    for (const field of SAFE_STRING_FIELDS) {
      const val = body[field];
      if (val === undefined) continue;
      if (val === null) {
        updateData[field] = null;
        continue;
      }
      if (typeof val !== 'string') {
        return NextResponse.json(
          { error: `El campo ${field} debe ser texto` },
          { status: 400 }
        );
      }
      const trimmed = val.trim();
      if (!trimmed) {
        updateData[field] = null;
      } else {
        updateData[field] = EMAIL_NORMALIZED_FIELDS.has(field)
          ? trimmed.toLowerCase()
          : trimmed;
      }
    }

    if (body.birthDate !== undefined) {
      if (
        body.birthDate === null ||
        (typeof body.birthDate === 'string' && !body.birthDate.trim())
      ) {
        updateData.birthDate = null;
      } else {
        const parsedBirthDate = parseOptionalDate(body.birthDate);
        if (!parsedBirthDate) {
          return NextResponse.json(
            { error: 'Fecha de nacimiento inválida' },
            { status: 400 }
          );
        }
        updateData.birthDate = parsedBirthDate;
      }
    }

    const updated = await prisma.participant.update({
      where: { id: session.participantId },
      data: updateData,
    });

    return NextResponse.json({ success: true, participant: updated });
  } catch (error: unknown) {
    return apiErrorResponse(
      error,
      'Error al actualizar los datos del participante',
      500
    );
  }
}
