import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cleanRut, validateRut } from '@/lib/rut';
import { apiErrorResponse, parseOptionalDate, parseOptionalFloat } from '@/lib/apiUtils';
import {
  PaymentValidationError,
  createGroupDetailIncident,
  isValidHttpsUrl,
  recordDirectPayments,
} from '@/lib/paymentService';
import type { GroupAllocationInputDTO } from '@/types/domain';

function getFormString(formData: FormData, key: string): string {
  const val = formData.get(key);
  return typeof val === 'string' ? val.trim() : '';
}

function getFormFile(formData: FormData, key: string): File | null {
  const val = formData.get(key);
  if (val && typeof val === 'object' && 'arrayBuffer' in val && 'size' in val) {
    const file = val as File;
    return file.size > 0 ? file : null;
  }
  return null;
}

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get('content-type') || '';
    if (!contentType.includes('multipart/form-data')) {
      return NextResponse.json(
        { error: 'Formato inválido: se requiere multipart/form-data' },
        { status: 400 }
      );
    }

    const formData = await req.formData();

    const eventCode = getFormString(formData, 'eventCode').toUpperCase();
    const rawMode = getFormString(formData, 'mode') || 'INDIVIDUAL';
    const payerRut = getFormString(formData, 'payerRut');
    const amountRaw = getFormString(formData, 'amount');
    const paymentDateRaw = getFormString(formData, 'paymentDate');
    const paymentMethod = getFormString(formData, 'paymentMethod') || 'TRANSFERENCIA';
    const transactionReference = getFormString(formData, 'transactionReference');
    const branch = getFormString(formData, 'branch');
    const comments = getFormString(formData, 'comments');
    const receiptUrl = getFormString(formData, 'receiptUrl');
    const allocationsRaw = getFormString(formData, 'allocations');
    const detailNames = getFormString(formData, 'detailNames');

    const receiptFile = getFormFile(formData, 'receiptFile');
    const detailFile = getFormFile(formData, 'detailFile');

    if (
      rawMode !== 'INDIVIDUAL' &&
      rawMode !== 'GROUP_SPLIT' &&
      rawMode !== 'GROUP_EXCEL'
    ) {
      return NextResponse.json(
        { error: 'Modalidad de comprobante inválida' },
        { status: 400 }
      );
    }

    const payerCleaned = cleanRut(payerRut);
    if (!payerCleaned || !validateRut(payerCleaned)) {
      return NextResponse.json(
        { error: 'El RUT del titular / quien informa no es válido' },
        { status: 400 }
      );
    }

    const amount = parseOptionalFloat(amountRaw);
    if (amount === null || amount <= 0) {
      return NextResponse.json(
        { error: 'El monto total del depósito debe ser mayor a 0' },
        { status: 400 }
      );
    }

    const paymentDate = parseOptionalDate(paymentDateRaw);
    if (!paymentDate) {
      return NextResponse.json(
        { error: 'Debes indicar una fecha válida del depósito' },
        { status: 400 }
      );
    }

    if (!transactionReference) {
      return NextResponse.json(
        { error: 'El número de comprobante u operación es obligatorio' },
        { status: 400 }
      );
    }

    if (!receiptFile && !isValidHttpsUrl(receiptUrl)) {
      return NextResponse.json(
        {
          error:
            'Debes adjuntar el comprobante de pago (imagen o PDF) o ingresar un enlace HTTPS válido',
        },
        { status: 400 }
      );
    }

    const event = eventCode
      ? await prisma.event.findFirst({
          where: { code: eventCode, isActive: true },
          select: { id: true, code: true, name: true, currency: true },
        })
      : await prisma.event.findFirst({
          where: { isActive: true },
          orderBy: [{ isDefault: 'desc' }, { startDate: 'asc' }],
          select: { id: true, code: true, name: true, currency: true },
        });

    if (!event) {
      return NextResponse.json(
        { error: 'Evento no encontrado o inactivo' },
        { status: 404 }
      );
    }

    if (rawMode === 'GROUP_EXCEL') {
      const incidentResult = await createGroupDetailIncident({
        eventId: event.id,
        payerRut,
        amount,
        paymentDate,
        paymentMethod,
        transactionReference,
        receiptFile,
        receiptUrl: receiptUrl || null,
        detailFile,
        detailNames,
        branch,
        comments,
      });

      return NextResponse.json(
        {
          success: true,
          mode: 'GROUP_EXCEL',
          reference: transactionReference,
          paymentDate: paymentDate.toISOString(),
          totalAmount: Math.round(amount * 100) / 100,
          currency: event.currency,
          eventName: event.name,
          receiptFileName: receiptFile?.name || null,
          createdCount: 0,
          items: [
            {
              rut: payerRut,
              maskedName: incidentResult.maskedName,
              amount: Math.round(amount * 100) / 100,
            },
          ],
          ticketNumber: incidentResult.ticketNumber,
        },
        { status: 201 }
      );
    }

    let allocations: GroupAllocationInputDTO[] | undefined;
    if (rawMode === 'GROUP_SPLIT') {
      if (!allocationsRaw) {
        return NextResponse.json(
          { error: 'Falta el desglose de participantes para el pago grupal' },
          { status: 400 }
        );
      }
      try {
        const parsed = JSON.parse(allocationsRaw) as unknown;
        if (!Array.isArray(parsed)) {
          throw new Error('Not array');
        }
        allocations = parsed as GroupAllocationInputDTO[];
      } catch {
        return NextResponse.json(
          { error: 'Formato inválido en el desglose grupal' },
          { status: 400 }
        );
      }
    }

    const recorded = await recordDirectPayments({
      eventId: event.id,
      mode: rawMode,
      payerRut,
      amount,
      paymentDate,
      paymentMethod,
      transactionReference,
      receiptFile,
      receiptUrl: receiptUrl || null,
      branch,
      comments,
      source: rawMode === 'GROUP_SPLIT' ? 'PORTAL_GROUP_FORM' : 'PORTAL_FORM',
      allocations,
    });

    return NextResponse.json(
      {
        success: true,
        mode: rawMode,
        reference: transactionReference,
        paymentDate: paymentDate.toISOString(),
        totalAmount: recorded.totalAmount,
        currency: event.currency,
        eventName: event.name,
        receiptFileName: recorded.receiptFileName,
        createdCount: recorded.createdCount,
        items: recorded.items.map((item) => ({
          rut: item.rut,
          maskedName: item.maskedName,
          amount: item.amount,
        })),
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    if (error instanceof PaymentValidationError) {
      return NextResponse.json(
        { error: error.message, details: error.details },
        { status: error.statusCode }
      );
    }
    return apiErrorResponse(
      error,
      'Error al registrar el comprobante de pago',
      500
    );
  }
}
