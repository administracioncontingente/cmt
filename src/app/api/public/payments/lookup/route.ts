import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cleanRut, formatRut, validateRut } from '@/lib/rut';
import { getRoleBadgeInfo } from '@/lib/roles';
import { apiErrorResponse } from '@/lib/apiUtils';
import { maskParticipantName } from '@/lib/paymentService';

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      eventCode?: unknown;
      rut?: unknown;
    };

    const eventCodeRaw =
      typeof body.eventCode === 'string' ? body.eventCode.trim().toUpperCase() : '';
    const rutRaw = typeof body.rut === 'string' ? body.rut.trim() : '';

    if (!rutRaw) {
      return NextResponse.json(
        { found: false, error: 'Debes ingresar un RUT para verificar' },
        { status: 400 }
      );
    }

    const cleaned = cleanRut(rutRaw);
    if (!cleaned || !validateRut(cleaned)) {
      return NextResponse.json(
        {
          found: false,
          error: 'El RUT ingresado no es válido (verifica el dígito verificador)',
        },
        { status: 400 }
      );
    }

    const event = eventCodeRaw
      ? await prisma.event.findFirst({
          where: { code: eventCodeRaw, isActive: true },
          select: { id: true, code: true, name: true },
        })
      : await prisma.event.findFirst({
          where: { isActive: true },
          orderBy: [{ isDefault: 'desc' }, { startDate: 'asc' }],
          select: { id: true, code: true, name: true },
        });

    if (!event) {
      return NextResponse.json(
        { found: false, error: 'El evento seleccionado no existe o no está activo' },
        { status: 404 }
      );
    }

    const formatted = formatRut(cleaned);

    const participant = await prisma.participant.findFirst({
      where: {
        eventId: event.id,
        OR: [{ rutClean: cleaned }, { rut: formatted }],
      },
      select: {
        firstName: true,
        lastName: true,
        secondLastName: true,
        scoutGroup: true,
        unitName: true,
        cupoCode: true,
        contingentRole: true,
      },
    });

    if (!participant) {
      return NextResponse.json(
        {
          found: false,
          error: `El RUT ${formatted} no figura inscrito en ${event.name}`,
        },
        { status: 200 }
      );
    }

    const roleInfo = getRoleBadgeInfo(participant.contingentRole);

    return NextResponse.json({
      found: true,
      maskedName: maskParticipantName(
        participant.firstName,
        participant.lastName,
        participant.secondLastName
      ),
      scoutGroup: participant.scoutGroup,
      unitName: participant.unitName,
      cupoCode: participant.cupoCode,
      roleLabel: roleInfo.label,
    });
  } catch (error: unknown) {
    return apiErrorResponse(error, 'Error al verificar RUT del participante', 500);
  }
}
