import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  getCurrentUser,
  getEventPermissions,
  resolveAuthorizedEventId,
} from '@/lib/auth';
import { apiErrorResponse } from '@/lib/apiUtils';
import {
  calculateFinancialSummary,
  matchesHealthFilter,
  resolveParticipantTargetAmount,
} from '@/lib/finance';
import { buildRoleWhereClause } from '@/lib/roles';
import { sendEmailViaGoogleWorkspace } from '@/lib/googleWorkspace';
import {
  BULK_EMAIL_BATCH_SIZE,
  BULK_EMAIL_SEND_DELAY_MS,
  buildBulkEmailContent,
  isDeliverableEmail,
  type BulkTemplateContext,
} from '@/lib/bulkEmail';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function buildAppBaseUrl(req: NextRequest): string {
  const originFallback =
    req.nextUrl.origin && req.nextUrl.origin !== 'null'
      ? req.nextUrl.origin
      : 'http://localhost:3000';
  return (process.env.NEXT_PUBLIC_APP_URL?.trim() || originFallback).replace(
    /\/+$/,
    ''
  );
}

async function sendViaResendFallback(params: {
  toEmail: string;
  ccEmail?: string | null;
  subject: string;
  html: string;
  text: string;
}): Promise<{ delivered: boolean; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) return { delivered: false, error: 'RESEND_NOT_CONFIGURED' };
  const from =
    process.env.MAIL_FROM?.trim() || 'AGSCH Eventos <onboarding@resend.dev>';

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [params.toEmail],
        ...(params.ccEmail &&
        params.ccEmail.toLowerCase() !== params.toEmail.toLowerCase()
          ? { cc: [params.ccEmail] }
          : {}),
        subject: params.subject,
        html: params.html,
        text: params.text,
      }),
    });

    if (res.ok) return { delivered: true };
    const errText = await res.text().catch(() => '');
    return {
      delivered: false,
      error: `Resend HTTP ${res.status}: ${errText.slice(0, 120)}`,
    };
  } catch (err: unknown) {
    return {
      delivered: false,
      error: err instanceof Error ? err.message : 'Error de red Resend',
    };
  }
}

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const paramEventId = searchParams.get('eventId');
  const statusFilter = (searchParams.get('status') || 'CONFIRMADO').toUpperCase();
  const roleFilter = (searchParams.get('role') || 'ALL').toUpperCase();
  const financialFilter = (searchParams.get('financial') || 'ALL').toUpperCase();
  const medicalFilter = (searchParams.get('medical') || 'ALL').toUpperCase();
  const search = searchParams.get('search')?.trim() || '';

  try {
    const { eventId, forbidden } = await resolveAuthorizedEventId(
      user,
      paramEventId
    );
    if (forbidden) {
      return NextResponse.json(
        { error: 'No tienes acceso al evento solicitado' },
        { status: 403 }
      );
    }
    if (!eventId) {
      return NextResponse.json({
        senderEmail: null,
        resendConfigured: false,
        totalMatched: 0,
        skippedInvalidCount: 0,
        recipients: [],
      });
    }

    if (!getEventPermissions(user, eventId).canManageCrm) {
      return NextResponse.json(
        { error: 'No tienes permisos para envío masivo en este evento' },
        { status: 403 }
      );
    }

    const [eventInfo, googleAccount, rawParticipants] = await Promise.all([
      prisma.event.findUnique({
        where: { id: eventId },
        select: { id: true, code: true, name: true, currency: true },
      }),
      prisma.emailAccount.findFirst({
        where: { eventId, provider: 'GOOGLE', refreshToken: { not: null } },
        orderBy: { updatedAt: 'desc' },
        select: { email: true },
      }),
      prisma.participant.findMany({
        where: {
          eventId,
          ...(statusFilter === 'CONFIRMADO'
            ? { status: 'CONFIRMADO' }
            : statusFilter === 'ALL_ACTIVE'
              ? { status: { not: 'RETIRADO' } }
              : statusFilter === 'RETIRADO'
                ? { status: 'RETIRADO' }
                : {}),
          ...(roleFilter !== 'ALL' ? buildRoleWhereClause(roleFilter) : {}),
          ...(search
            ? {
                OR: [
                  { firstName: { contains: search, mode: 'insensitive' } },
                  { lastName: { contains: search, mode: 'insensitive' } },
                  { rut: { contains: search, mode: 'insensitive' } },
                  { email: { contains: search, mode: 'insensitive' } },
                  { scoutGroup: { contains: search, mode: 'insensitive' } },
                  { unitName: { contains: search, mode: 'insensitive' } },
                ],
              }
            : {}),
        },
        orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
        select: {
          id: true,
          rut: true,
          firstName: true,
          lastName: true,
          secondLastName: true,
          email: true,
          guardianEmail: true,
          contingentRole: true,
          status: true,
          targetFeeUSD: true,
          totalPaidSheet: true,
          debtFinalUSD: true,
          financialStatusSheet: true,
          plan: {
            select: {
              totalAmount: true,
              installments: {
                orderBy: { installmentNumber: 'asc' },
                select: {
                  id: true,
                  installmentNumber: true,
                  title: true,
                  dueDate: true,
                  amount: true,
                },
              },
            },
          },
          payments: {
            select: {
              id: true,
              amount: true,
              paymentDate: true,
              paymentMethod: true,
            },
          },
          medicalRecord: { select: { completionStatus: true } },
        },
      }),
    ]);

    const filtered: Array<{
      id: string;
      fullName: string;
      firstName: string;
      rut: string;
      email: string;
      guardianEmail: string | null;
      contingentRole: string;
      status: string;
      remainingAmount: number;
      paidAmount: number;
      healthLabel: string;
    }> = [];

    let totalMatched = 0;
    let skippedInvalidCount = 0;

    for (const p of rawParticipants) {
      const medStatus = p.medicalRecord?.completionStatus || 'PENDING';
      if (
        medicalFilter === 'COMPLETED' &&
        medStatus !== 'COMPLETED' &&
        medStatus !== 'VERIFIED'
      ) {
        continue;
      }
      if (
        medicalFilter === 'PENDING' &&
        (medStatus === 'COMPLETED' || medStatus === 'VERIFIED')
      ) {
        continue;
      }

      const targetAmount = resolveParticipantTargetAmount(
        p.targetFeeUSD,
        p.plan?.totalAmount
      );
      const financial = calculateFinancialSummary(
        p.plan?.installments || [],
        p.payments,
        targetAmount
      );

      if (
        financialFilter !== 'ALL' &&
        !matchesHealthFilter(
          {
            status: p.status,
            financialStatusSheet: p.financialStatusSheet,
            financial,
          },
          financialFilter
        )
      ) {
        continue;
      }

      totalMatched++;

      if (!isDeliverableEmail(p.email)) {
        skippedInvalidCount++;
        continue;
      }

      const paidAmount =
        p.totalPaidSheet !== null && p.totalPaidSheet !== undefined
          ? p.totalPaidSheet
          : financial.totalPaid;
      const remainingAmount =
        p.debtFinalUSD !== null && p.debtFinalUSD !== undefined
          ? p.debtFinalUSD
          : financial.balanceRemaining;

      filtered.push({
        id: p.id,
        fullName: [p.firstName, p.lastName, p.secondLastName]
          .filter(Boolean)
          .join(' '),
        firstName: p.firstName,
        rut: p.rut,
        email: p.email.trim(),
        guardianEmail: isDeliverableEmail(p.guardianEmail)
          ? p.guardianEmail!.trim()
          : null,
        contingentRole: p.contingentRole,
        status: p.status,
        remainingAmount,
        paidAmount,
        healthLabel: p.financialStatusSheet || financial.health,
      });
    }

    return NextResponse.json({
      senderEmail: googleAccount?.email || null,
      resendConfigured: Boolean(process.env.RESEND_API_KEY?.trim()),
      currency: eventInfo?.currency || 'USD',
      eventName: eventInfo?.name || 'AGSCH Eventos',
      eventCode: eventInfo?.code || '',
      totalMatched,
      skippedInvalidCount,
      recipients: filtered,
    });
  } catch (error: unknown) {
    return apiErrorResponse(
      error,
      'Error al calcular destinatarios para envío masivo',
      500
    );
  }
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  try {
    const body = (await req.json().catch(() => ({}))) as {
      eventId?: unknown;
      mode?: unknown;
      subject?: unknown;
      body?: unknown;
      participantIds?: unknown;
      includeGuardian?: unknown;
      includePortalCta?: unknown;
      testEmail?: unknown;
    };

    const paramEventId =
      typeof body.eventId === 'string' && body.eventId.trim()
        ? body.eventId.trim()
        : undefined;

    const { eventId, forbidden } = await resolveAuthorizedEventId(
      user,
      paramEventId
    );
    if (forbidden) {
      return NextResponse.json(
        { error: 'No tienes acceso al evento solicitado' },
        { status: 403 }
      );
    }
    if (!eventId) {
      return NextResponse.json(
        { error: 'No hay evento activo seleccionado' },
        { status: 400 }
      );
    }

    if (!getEventPermissions(user, eventId).canManageCrm) {
      return NextResponse.json(
        { error: 'No tienes permisos para enviar comunicados en este evento' },
        { status: 403 }
      );
    }

    const subjectTemplate =
      typeof body.subject === 'string' ? body.subject.trim() : '';
    const bodyTemplate =
      typeof body.body === 'string' ? body.body.trim() : '';

    if (subjectTemplate.length < 3) {
      return NextResponse.json(
        { error: 'El asunto del correo debe tener al menos 3 caracteres.' },
        { status: 400 }
      );
    }
    if (bodyTemplate.length < 10) {
      return NextResponse.json(
        { error: 'El mensaje debe tener al menos 10 caracteres.' },
        { status: 400 }
      );
    }

    const includeGuardian = body.includeGuardian === true;
    const includePortalCta = body.includePortalCta !== false;
    const mode = body.mode === 'test' ? 'test' : 'batch';

    const [eventInfo, googleAccount] = await Promise.all([
      prisma.event.findUnique({
        where: { id: eventId },
        select: { id: true, code: true, name: true, currency: true },
      }),
      prisma.emailAccount.findFirst({
        where: { eventId, provider: 'GOOGLE', refreshToken: { not: null } },
        orderBy: { updatedAt: 'desc' },
        select: { id: true, email: true },
      }),
    ]);

    const resendConfigured = Boolean(process.env.RESEND_API_KEY?.trim());
    if (!googleAccount && !resendConfigured) {
      return NextResponse.json(
        {
          error:
            'No hay cuenta de Google Workspace conectada ni proveedor SMTP configurado para enviar correos.',
        },
        { status: 400 }
      );
    }

    const baseUrl = buildAppBaseUrl(req);
    const portalUrl = `${baseUrl}/portal`;
    const eventPageUrl = eventInfo?.code
      ? `${baseUrl}/eventos/${encodeURIComponent(eventInfo.code)}`
      : `${baseUrl}/eventos`;
    const currency = eventInfo?.currency || 'USD';
    const eventName = eventInfo?.name || 'AGSCH Eventos';

    if (mode === 'test') {
      const targetEmail =
        typeof body.testEmail === 'string' && body.testEmail.trim()
          ? body.testEmail.trim()
          : user.email;

      if (!isDeliverableEmail(targetEmail)) {
        return NextResponse.json(
          { error: 'Ingresa un correo electrónico de prueba válido.' },
          { status: 400 }
        );
      }

      const sampleCtx: BulkTemplateContext = {
        firstName: user.name.split(/\s+/)[0] || 'Participante',
        fullName: user.name,
        rut: '12.345.678-5',
        contingentRole: 'Participante',
        eventName,
        remainingAmount: 600,
        paidAmount: 1200,
        currency,
        portalUrl,
        eventPageUrl,
      };

      const rendered = buildBulkEmailContent({
        subjectTemplate: `[PRUEBA] ${subjectTemplate}`,
        bodyTemplate,
        ctx: sampleCtx,
        includePortalCta,
      });

      let delivered = false;
      let provider: 'google' | 'resend' = 'google';
      let lastError: string | undefined;

      if (googleAccount) {
        const gRes = await sendEmailViaGoogleWorkspace({
          eventId,
          toEmail: targetEmail,
          subject: rendered.subject,
          html: rendered.html,
          text: rendered.text,
        });
        delivered = gRes.delivered;
        lastError = gRes.error;
      }

      if (!delivered && resendConfigured) {
        provider = 'resend';
        const rRes = await sendViaResendFallback({
          toEmail: targetEmail,
          subject: rendered.subject,
          html: rendered.html,
          text: rendered.text,
        });
        delivered = rRes.delivered;
        lastError = rRes.error;
      }

      if (!delivered) {
        return NextResponse.json(
          {
            error:
              lastError ||
              'No se pudo enviar el correo de prueba con Google Workspace.',
          },
          { status: 502 }
        );
      }

      return NextResponse.json({
        success: true,
        provider,
        message: `Correo de prueba enviado a ${targetEmail}${googleAccount ? ` desde ${googleAccount.email}` : ''}.`,
      });
    }

    // Batch send
    const rawIds = Array.isArray(body.participantIds) ? body.participantIds : [];
    const participantIds = rawIds
      .filter((id): id is string => typeof id === 'string' && id.trim().length > 0)
      .slice(0, BULK_EMAIL_BATCH_SIZE + 10); // hard safety cap

    if (participantIds.length === 0) {
      return NextResponse.json(
        { error: 'Debes indicar al menos un destinatario.' },
        { status: 400 }
      );
    }

    const participants = await prisma.participant.findMany({
      where: {
        eventId,
        id: { in: participantIds },
      },
      select: {
        id: true,
        rut: true,
        firstName: true,
        lastName: true,
        secondLastName: true,
        email: true,
        guardianEmail: true,
        contingentRole: true,
        targetFeeUSD: true,
        totalPaidSheet: true,
        debtFinalUSD: true,
        plan: {
          select: {
            totalAmount: true,
            installments: {
              select: {
                id: true,
                installmentNumber: true,
                title: true,
                dueDate: true,
                amount: true,
              },
            },
          },
        },
        payments: {
          select: {
            id: true,
            amount: true,
            paymentDate: true,
            paymentMethod: true,
          },
        },
      },
    });

    let sentCount = 0;
    let failedCount = 0;
    let skippedCount = 0;
    const results: Array<{
      participantId: string;
      email: string;
      ok: boolean;
      error?: string;
    }> = [];

    for (let i = 0; i < participants.length; i++) {
      const p = participants[i];
      if (!isDeliverableEmail(p.email)) {
        skippedCount++;
        results.push({
          participantId: p.id,
          email: p.email,
          ok: false,
          error: 'Correo inválido o genérico',
        });
        continue;
      }

      const targetAmount = resolveParticipantTargetAmount(
        p.targetFeeUSD,
        p.plan?.totalAmount
      );
      const financial = calculateFinancialSummary(
        p.plan?.installments || [],
        p.payments,
        targetAmount
      );

      const paidAmount =
        p.totalPaidSheet !== null && p.totalPaidSheet !== undefined
          ? p.totalPaidSheet
          : financial.totalPaid;
      const remainingAmount =
        p.debtFinalUSD !== null && p.debtFinalUSD !== undefined
          ? p.debtFinalUSD
          : financial.balanceRemaining;

      const ctx: BulkTemplateContext = {
        firstName: p.firstName.trim(),
        fullName: [p.firstName, p.lastName, p.secondLastName]
          .filter(Boolean)
          .join(' '),
        rut: p.rut,
        contingentRole: p.contingentRole,
        eventName,
        remainingAmount,
        paidAmount,
        currency,
        portalUrl,
        eventPageUrl,
      };

      const rendered = buildBulkEmailContent({
        subjectTemplate,
        bodyTemplate,
        ctx,
        includePortalCta,
      });

      const ccEmail =
        includeGuardian && isDeliverableEmail(p.guardianEmail)
          ? p.guardianEmail!.trim()
          : null;

      let delivered = false;
      let errMessage: string | undefined;
      let rateLimited = false;

      if (googleAccount) {
        const gRes = await sendEmailViaGoogleWorkspace({
          eventId,
          toEmail: p.email.trim(),
          ccEmail,
          subject: rendered.subject,
          html: rendered.html,
          text: rendered.text,
        });
        delivered = gRes.delivered;
        errMessage = gRes.error;
        rateLimited = Boolean(gRes.rateLimited);
      }

      if (!delivered && resendConfigured && !rateLimited) {
        const rRes = await sendViaResendFallback({
          toEmail: p.email.trim(),
          ccEmail,
          subject: rendered.subject,
          html: rendered.html,
          text: rendered.text,
        });
        delivered = rRes.delivered;
        errMessage = rRes.error;
      }

      if (delivered) {
        sentCount++;
        results.push({ participantId: p.id, email: p.email.trim(), ok: true });
      } else {
        failedCount++;
        results.push({
          participantId: p.id,
          email: p.email.trim(),
          ok: false,
          error: errMessage || 'No entregado',
        });
      }

      // Respect Gmail API 250 quota-units/sec sustained limit (100 units per messages.send)
      if (i < participants.length - 1) {
        await sleep(rateLimited ? 1500 : BULK_EMAIL_SEND_DELAY_MS);
      }
    }

    return NextResponse.json({
      sentCount,
      failedCount,
      skippedCount,
      results,
    });
  } catch (error: unknown) {
    return apiErrorResponse(
      error,
      'Error ejecutando envío masivo de correos',
      500
    );
  }
}
