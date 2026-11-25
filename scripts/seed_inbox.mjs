import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('📬 Generando correos de muestra en Supabase...');
  const wsj = await prisma.event.findFirst({ where: { code: 'WSJ-2027' } });
  if (!wsj) {
    console.error('No se encontró evento WSJ-2027');
    return;
  }

  const pList = await prisma.participant.findMany({
    where: { eventId: wsj.id },
    take: 4,
  });

  const p1 = pList[0];
  const p2 = pList[1];
  const p3 = pList[2];

  const now = new Date();

  const messages = [
    {
      googleMessageId: `msg_gmail_${Date.now()}_1`,
      googleThreadId: 'thread_finanzas_cuota3',
      eventId: wsj.id,
      senderEmail: p1 ? p1.email : 'apoderado.sepulveda@gmail.com',
      senderName: p1 ? `${p1.firstName} ${p1.lastName}` : 'Carlos Sepúlveda',
      recipientEmail: 'administracioncontingente@guiasyscoutschile.cl',
      subject: `Comprobante Transferencia Cuota 3 - ${p1 ? p1.rut : '21.345.678-4'}`,
      snippet: 'Estimado Equipo de Finanzas, adjunto el comprobante de transferencia bancaria por USD 600 correspondiente a la Cuota 3...',
      bodyText: `Estimado Equipo de Finanzas del Contingente,\n\nAdjunto comprobante de transferencia bancaria por USD 600 correspondiente a la Cuota 3 del participante ${p1 ? `${p1.firstName} ${p1.lastName} (RUT: ${p1.rut})` : 'Camila Sepúlveda'}.\n\nN° de operación bancaria: TRF-994820.\nBanco: Banco de Chile.\nFavor confirmar recepción y actualización en el sistema.\n\nSiempre Listos,\nFamilia Sepúlveda`,
      date: new Date(now.getTime() - 1000 * 60 * 25),
      hasAttachments: true,
      labels: JSON.stringify(['INBOX', 'FINANZAS', 'IMPORTANTE']),
      participantId: p1 ? p1.id : null,
      matchMethod: 'EXACT_EMAIL',
    },
    {
      googleMessageId: `msg_gmail_${Date.now()}_2`,
      googleThreadId: 'thread_salud_insulina',
      eventId: wsj.id,
      senderEmail: p2?.guardianEmail || (p2 ? p2.email : 'carlos.morales@empresa.cl'),
      senderName: p2?.guardianName || 'Carlos Morales Pinto',
      recipientEmail: 'administracioncontingente@guiasyscoutschile.cl',
      subject: `Consulta Médica Urgente: Cadena de Frío e Insulina (RUT: ${p2 ? p2.rut : '20.890.123-0'})`,
      snippet: 'Hola, completamos la ficha médica en el portal pero necesitamos saber los protocolos para el transporte aéreo de insulina...',
      bodyText: `Estimado Equipo Médico del Contingente WSJ,\n\nEscribo respecto a mi hijo ${p2 ? `${p2.firstName} ${p2.lastName} (RUT: ${p2.rut})` : 'Matías Morales'}. Ya completamos la Ficha Médica WSJ en el portal indicando su condición de Diabetes Tipo 1.\n\nQueremos coordinar con anticipación cómo se manejará la cadena de frío (refrigeración entre 2°C y 8°C) durante el vuelo comercial Santiago-Varsovia y en el subcampo en Gdansk.\n\nQuedo atento a sus indicaciones.\n\nSaludos cordiales,\n${p2?.guardianName || 'Carlos Morales Pinto'}\nTeléfono: ${p2?.guardianPhone || '+56 9 8765 1122'}`,
      date: new Date(now.getTime() - 1000 * 60 * 110),
      hasAttachments: false,
      labels: JSON.stringify(['INBOX', 'SALUD', 'URGENTE']),
      participantId: p2 ? p2.id : null,
      matchMethod: 'GUARDIAN_EMAIL',
    },
    {
      googleMessageId: `msg_gmail_${Date.now()}_3`,
      googleThreadId: 'thread_cedula_pasaporte',
      eventId: wsj.id,
      senderEmail: 'contacto.familiar@scout.cl',
      senderName: 'Patricia Donoso',
      recipientEmail: 'administracioncontingente@guiasyscoutschile.cl',
      subject: `Renovación de Pasaporte y Cédula - RUT ${p3 ? p3.rut : '16.543.210-K'}`,
      snippet: 'Buenos días, les informamos que el pasaporte fue renovado en Registro Civil y ya tenemos el nuevo número de documento...',
      bodyText: `Estimados Comisionados,\n\nLes escribo para informar que la cédula de identidad y el pasaporte de ${p3 ? `${p3.firstName} ${p3.lastName}` : 'Rodrigo Silva'} ya fueron renovados exitosamente en el Registro Civil.\n\nAdjunto copia escaneada para que puedan actualizar los registros oficiales ante la organización polaca.\n\nMuchas gracias,\nPatricia Donoso`,
      date: new Date(now.getTime() - 1000 * 60 * 350),
      hasAttachments: true,
      labels: JSON.stringify(['INBOX', 'DOCUMENTACION']),
      participantId: p3 ? p3.id : null,
      matchMethod: 'RUT_MATCH',
    },
    {
      googleMessageId: `msg_gmail_${Date.now()}_4`,
      googleThreadId: 'thread_vuelos_salida',
      eventId: wsj.id,
      senderEmail: 'consulta.general@gmail.com',
      senderName: 'Familia Scout',
      recipientEmail: 'administracioncontingente@guiasyscoutschile.cl',
      subject: 'Consulta sobre fechas y vuelos de salida desde Santiago',
      snippet: 'Buenas tardes, quisiéramos consultar si ya están definidas las fechas exactas de salida del contingente hacia Europa...',
      bodyText: `Buenas tardes contingente,\n\nQuisiéramos consultar cuándo se publicará el itinerario definitivo de vuelos comerciales de salida desde Santiago hacia Gdansk.\n\nQuedamos a la espera de la circular informativa.\n\nSaludos,\nFamilia Scout`,
      date: new Date(now.getTime() - 1000 * 60 * 600),
      hasAttachments: false,
      labels: JSON.stringify(['INBOX', 'CONSULTA']),
      participantId: null, // Sin asociar para probar vinculación manual
      matchMethod: null,
    },
  ];

  for (const m of messages) {
    await prisma.emailMessage.upsert({
      where: { googleMessageId: m.googleMessageId },
      update: m,
      create: m,
    });
  }
  console.log(`✓ ${messages.length} mensajes creados y asociados en Supabase`);

  // Crear 2 incidencias iniciales de demostración
  if (p2) {
    const admin = await prisma.user.findFirst();
    const inc = await prisma.incident.upsert({
      where: { ticketNumber: 'INC-2027-001' },
      update: {},
      create: {
        ticketNumber: 'INC-2027-001',
        eventId: wsj.id,
        participantId: p2.id,
        title: 'Gestión Especial de Cadena de Frío para Insulina en Campamento',
        description: 'Coordinación con el equipo médico de Polonia para asegurar refrigerador en subcampo y transporte con hielo seco en vuelo Santiago-Varsovia.',
        category: 'FICHA_MEDICA',
        priority: 'URGENTE',
        status: 'EN_PROCESO',
        createdById: admin?.id,
        assignedToId: admin?.id,
        comments: {
          create: [
            {
              authorName: 'Dra. Claudia Reyes',
              content: 'Caso tomado por equipo médico. Se contactó a la aseguradora y a la aerolínea para autorización de hielera médica en cabina.',
              isInternal: true,
            },
          ],
        },
      },
    });
    console.log(`✓ Incidencia ${inc.ticketNumber} creada y vinculada`);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
