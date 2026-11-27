import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { getCurrentUser, resolveAuthorizedEventId, getEventPermissions } from '@/lib/auth';
import { apiErrorResponse, parseOptionalDate } from '@/lib/apiUtils';
import { cleanRut } from '@/lib/rut';

const round2 = (n: number): number => Math.round(n * 100) / 100;

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const paramEventId = searchParams.get('eventId');
    const { eventId: activeEventId, forbidden } = await resolveAuthorizedEventId(
      user,
      paramEventId
    );

    if (forbidden) {
      return NextResponse.json({ error: 'No tienes acceso a este evento' }, { status: 403 });
    }

    const rawPage = searchParams.get('page');
    const rawLimit = searchParams.get('limit');
    const parsedPage = rawPage !== null ? Number.parseInt(rawPage, 10) : 1;
    const parsedLimit = rawLimit !== null ? Number.parseInt(rawLimit, 10) : 50;
    const page = Number.isFinite(parsedPage) ? Math.max(1, parsedPage) : 1;
    const limit = Number.isFinite(parsedLimit) ? Math.min(200, Math.max(1, parsedLimit)) : 50;

    if (!activeEventId) {
      return NextResponse.json({
        payments: [],
        totalCount: 0,
        page,
        limit,
        totalPages: 1,
        summary: {
          totalAmount: 0,
          totalCount: 0,
          filloutCount: 0,
          withReceiptCount: 0,
          last30DaysAmount: 0,
          sourceCounts: {},
        },
        currency: 'USD',
      });
    }

    const permissions = getEventPermissions(user, activeEventId);
    if (!permissions.canView) {
      return NextResponse.json({ error: 'No tienes acceso a este evento' }, { status: 403 });
    }

    const search = searchParams.get('search')?.trim() || '';
    const source = searchParams.get('source')?.trim().toUpperCase() || '';
    const method = searchParams.get('method')?.trim().toUpperCase() || '';
    const hasReceipt = searchParams.get('hasReceipt')?.trim().toUpperCase() || '';
    const rawDateFrom = searchParams.get('dateFrom')?.trim() || '';
    const rawDateTo = searchParams.get('dateTo')?.trim() || '';

    const baseEventWhere: Prisma.PaymentWhereInput = {
      participant: { eventId: activeEventId },
    };
    const andConditions: Prisma.PaymentWhereInput[] = [baseEventWhere];

    if (source && source !== 'ALL') {
      if (source === 'MANUAL') {
        andConditions.push({ OR: [{ source: 'MANUAL' }, { source: null }] });
      } else {
        andConditions.push({ source });
      }
    }

    if (method && method !== 'ALL') {
      andConditions.push({ paymentMethod: method });
    }

    if (hasReceipt === 'WITH') {
      andConditions.push({ receiptUrl: { not: null } }, { receiptUrl: { not: '' } });
    } else if (hasReceipt === 'WITHOUT') {
      andConditions.push({ OR: [{ receiptUrl: null }, { receiptUrl: '' }] });
    }

    const parsedDateFrom = parseOptionalDate(rawDateFrom);
    const parsedDateTo = parseOptionalDate(rawDateTo);
    if (parsedDateFrom || parsedDateTo) {
      const paymentDateFilter: Prisma.DateTimeFilter = {};
      if (parsedDateFrom) {
        paymentDateFilter.gte = parsedDateFrom;
      }
      if (parsedDateTo) {
        if (/^\d{4}-\d{2}-\d{2}$/.test(rawDateTo)) {
          parsedDateTo.setUTCHours(23, 59, 59, 999);
        }
        paymentDateFilter.lte = parsedDateTo;
      }
      andConditions.push({ paymentDate: paymentDateFilter });
    }

    if (search) {
      const looksLikeRut = /\d/.test(search) && /^[0-9.\-\skK]+$/.test(search);
      const rutSearchTerm = looksLikeRut ? cleanRut(search) : search;
      andConditions.push({
        OR: [
          { transactionReference: { contains: search, mode: 'insensitive' } },
          { notes: { contains: search, mode: 'insensitive' } },
          { filloutSubmissionId: { contains: search, mode: 'insensitive' } },
          {
            participant: {
              OR: [
                { firstName: { contains: search, mode: 'insensitive' } },
                { lastName: { contains: search, mode: 'insensitive' } },
                { rut: { contains: search, mode: 'insensitive' } },
                { rutClean: { contains: rutSearchTerm, mode: 'insensitive' } },
                { cupoCode: { contains: search, mode: 'insensitive' } },
              ],
            },
          },
        ],
      });
    }

    const where: Prisma.PaymentWhereInput = { AND: andConditions };

    const [eventInfo, totalCount, payments, allEventPayments] = await Promise.all([
      prisma.event.findUnique({
        where: { id: activeEventId },
        select: { currency: true },
      }),
      prisma.payment.count({ where }),
      prisma.payment.findMany({
        where,
        include: {
          participant: {
            select: {
              id: true,
              rut: true,
              firstName: true,
              lastName: true,
              contingentRole: true,
              unitName: true,
              cupoCode: true,
              email: true,
              phone: true,
            },
          },
          registeredBy: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
        orderBy: [{ paymentDate: 'desc' }, { createdAt: 'desc' }],
        take: limit,
        skip: (page - 1) * limit,
      }),
      prisma.payment.findMany({
        where: baseEventWhere,
        select: {
          amount: true,
          source: true,
          receiptUrl: true,
          paymentDate: true,
        },
      }),
    ]);

    const thirtyDaysAgoMs = Date.now() - 30 * 24 * 60 * 60 * 1000;
    let totalAmountRaw = 0;
    let filloutCount = 0;
    let withReceiptCount = 0;
    let last30DaysAmountRaw = 0;
    const sourceCounts: Record<string, number> = {};

    for (const p of allEventPayments) {
      totalAmountRaw += p.amount;
      const src = p.source || 'MANUAL';
      sourceCounts[src] = (sourceCounts[src] || 0) + 1;
      if (src === 'FILLOUT_MAIN' || src === 'FILLOUT_SUBFORM') {
        filloutCount++;
      }
      if (p.receiptUrl && p.receiptUrl.trim() !== '') {
        withReceiptCount++;
      }
      if (new Date(p.paymentDate).getTime() >= thirtyDaysAgoMs) {
        last30DaysAmountRaw += p.amount;
      }
    }

    const totalPages = Math.max(1, Math.ceil(totalCount / limit));

    return NextResponse.json({
      payments,
      totalCount,
      page,
      limit,
      totalPages,
      summary: {
        totalAmount: round2(totalAmountRaw),
        totalCount: allEventPayments.length,
        filloutCount,
        withReceiptCount,
        last30DaysAmount: round2(last30DaysAmountRaw),
        sourceCounts,
      },
      currency: eventInfo?.currency || 'USD',
    });
  } catch (error: unknown) {
    return apiErrorResponse(error, 'Error al obtener el historial de pagos', 500);
  }
}
