import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const { id: incidentId } = await params;

  try {
    const body = await req.json();
    const { content, isInternal } = body;

    if (!content || !content.trim()) {
      return NextResponse.json({ error: 'El contenido del comentario es requerido' }, { status: 400 });
    }

    const comment = await prisma.incidentComment.create({
      data: {
        incidentId,
        userId: user.id,
        authorName: user.name,
        content: content.trim(),
        isInternal: isInternal !== undefined ? Boolean(isInternal) : true,
      },
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
    });

    return NextResponse.json({
      message: 'Comentario agregado',
      comment,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
