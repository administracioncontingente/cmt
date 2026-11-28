import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  getCurrentUser,
  getEventPermissions,
  resolveAuthorizedEventId,
} from '@/lib/auth';
import { apiErrorResponse } from '@/lib/apiUtils';
import { getGoogleOAuthConfig } from '@/lib/googleWorkspace';

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const paramEventId = searchParams.get('eventId');

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

    const config = getGoogleOAuthConfig(req.nextUrl.origin);

    if (!eventId) {
      return NextResponse.json({
        configured: config.configured,
        redirectUri: config.redirectUri,
        accounts: [],
        canConnect: false,
        canSync: false,
      });
    }

    const permissions = getEventPermissions(user, eventId);
    if (!permissions.canView) {
      return NextResponse.json(
        { error: 'No tienes acceso a este evento' },
        { status: 403 }
      );
    }

    const accounts = await prisma.emailAccount.findMany({
      where: { eventId, provider: 'GOOGLE' },
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        email: true,
        provider: true,
        syncStatus: true,
        lastSyncedAt: true,
        lastError: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({
      configured: config.configured,
      redirectUri: config.redirectUri,
      accounts,
      canConnect: permissions.isEventAdmin,
      canSync: permissions.canManageCrm,
    });
  } catch (error: unknown) {
    return apiErrorResponse(
      error,
      'Error al consultar estado de Google Workspace',
      500
    );
  }
}

export async function DELETE(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const paramEventId = searchParams.get('eventId');
  const accountId = searchParams.get('accountId')?.trim();

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
      return NextResponse.json(
        { error: 'No hay evento activo seleccionado' },
        { status: 400 }
      );
    }

    const permissions = getEventPermissions(user, eventId);
    if (!permissions.isEventAdmin) {
      return NextResponse.json(
        {
          error:
            'Solo Administradores del evento pueden desconectar la cuenta de Google Workspace.',
        },
        { status: 403 }
      );
    }

    await prisma.emailAccount.deleteMany({
      where: {
        eventId,
        provider: 'GOOGLE',
        ...(accountId ? { id: accountId } : {}),
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Cuenta de Google Workspace desconectada del evento.',
    });
  } catch (error: unknown) {
    return apiErrorResponse(
      error,
      'Error al desconectar cuenta de Google Workspace',
      500
    );
  }
}
