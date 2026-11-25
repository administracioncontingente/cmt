import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌐 Inicializando Sistema Multi-Evento AGSCH...');

  // 1. Crear Evento Oficial 1: WSJ Polonia 2027 (Principal)
  const wsjEvent = await prisma.event.upsert({
    where: { code: 'WSJ-2027' },
    update: {
      isDefault: true,
      name: '26° World Scout Jamboree • Polonia 2027',
      shortName: 'Polonia 2027',
      type: 'JAMBOREE_MUNDIAL',
      country: 'Polonia',
      city: 'Gdańsk',
      flagEmoji: '🇵🇱',
      currency: 'USD',
      startDate: new Date('2027-07-30'),
      endDate: new Date('2027-08-10'),
      themeColor: '#001558',
      accentColor: '#FEB135',
      isActive: true,
    },
    create: {
      code: 'WSJ-2027',
      name: '26° World Scout Jamboree • Polonia 2027',
      shortName: 'Polonia 2027',
      type: 'JAMBOREE_MUNDIAL',
      country: 'Polonia',
      city: 'Gdańsk',
      flagEmoji: '🇵🇱',
      currency: 'USD',
      isDefault: true,
      startDate: new Date('2027-07-30'),
      endDate: new Date('2027-08-10'),
      themeColor: '#001558',
      accentColor: '#FEB135',
      isActive: true,
      description: 'Contingente oficial de la Asociación de Guías y Scouts de Chile en el 26° Jamboree Scout Mundial.',
    },
  });
  console.log(`✓ Evento creado/actualizado: ${wsjEvent.name} (${wsjEvent.id})`);

  // 2. Crear Evento Oficial 2: Moot Portugal 2029
  const mootEvent = await prisma.event.upsert({
    where: { code: 'MOOT-2029' },
    update: {
      name: '17° World Scout Moot • Portugal 2029',
      shortName: 'Portugal 2029',
      type: 'MOOT_MUNDIAL',
      country: 'Portugal',
      city: 'Lisboa / Porto',
      flagEmoji: '🇵🇹',
      currency: 'EUR',
      startDate: new Date('2029-07-25'),
      endDate: new Date('2029-08-05'),
      themeColor: '#0c4a25',
      accentColor: '#e02424',
      isActive: true,
    },
    create: {
      code: 'MOOT-2029',
      name: '17° World Scout Moot • Portugal 2029',
      shortName: 'Portugal 2029',
      type: 'MOOT_MUNDIAL',
      country: 'Portugal',
      city: 'Lisboa / Porto',
      flagEmoji: '🇵🇹',
      currency: 'EUR',
      isDefault: false,
      startDate: new Date('2029-07-25'),
      endDate: new Date('2029-08-05'),
      themeColor: '#0c4a25',
      accentColor: '#e02424',
      isActive: true,
      description: 'Evento mundial para jóvenes adultos (rovers / caminantes) de 18 a 25 años.',
    },
  });
  console.log(`✓ Evento creado/actualizado: ${mootEvent.name} (${mootEvent.id})`);

  // 3. Crear Evento Oficial 3: Paxtu Nacional 2026
  const paxtuEvent = await prisma.event.upsert({
    where: { code: 'PAXTU-2026' },
    update: {
      name: 'Campamento Nacional Paxtu • Chile 2026',
      shortName: 'Paxtu 2026',
      type: 'JAMBOREE_NACIONAL',
      country: 'Chile',
      city: 'Picarquín, Mostazal',
      flagEmoji: '🇨🇱',
      currency: 'CLP',
      startDate: new Date('2026-01-15'),
      endDate: new Date('2026-01-22'),
      themeColor: '#1e3a8a',
      accentColor: '#dc2626',
      isActive: true,
    },
    create: {
      code: 'PAXTU-2026',
      name: 'Campamento Nacional Paxtu • Chile 2026',
      shortName: 'Paxtu 2026',
      type: 'JAMBOREE_NACIONAL',
      country: 'Chile',
      city: 'Picarquín, Mostazal',
      flagEmoji: '🇨🇱',
      currency: 'CLP',
      isDefault: false,
      startDate: new Date('2026-01-15'),
      endDate: new Date('2026-01-22'),
      themeColor: '#1e3a8a',
      accentColor: '#dc2626',
      isActive: true,
      description: 'Gran campamento scout nacional para las ramas Golondrinas, Lobatos, Guías y Scouts.',
    },
  });
  console.log(`✓ Evento creado/actualizado: ${paxtuEvent.name} (${paxtuEvent.id})`);

  // 4. Vincular todos los planes existentes y participantes existentes a WSJ-2027
  const updatedPlans = await prisma.paymentPlan.updateMany({
    where: { eventId: null },
    data: { eventId: wsjEvent.id },
  });
  console.log(`✓ ${updatedPlans.count} planes de pago vinculados a WSJ-2027`);

  const updatedParticipants = await prisma.participant.updateMany({
    where: { eventId: null },
    data: { eventId: wsjEvent.id },
  });
  console.log(`✓ ${updatedParticipants.count} participantes vinculados a WSJ-2027`);

  // 5. Configurar Super Administradores y Miembros de Equipo por Evento
  const passwordHash = await bcrypt.hash('admin123', 10);

  // A. Super Administrador Global
  const adminGlobal = await prisma.user.upsert({
    where: { email: 'admin@agsch.cl' },
    update: { role: 'SUPER_ADMIN' },
    create: {
      email: 'admin@agsch.cl',
      passwordHash,
      name: 'Comisionado Nacional AGSCH',
      role: 'SUPER_ADMIN',
    },
  });

  const adminInstitucional = await prisma.user.upsert({
    where: { email: 'administracioncontingente@guiasyscoutschile.cl' },
    update: { role: 'SUPER_ADMIN' },
    create: {
      email: 'administracioncontingente@guiasyscoutschile.cl',
      passwordHash,
      name: 'Administración Contingente Nacional',
      role: 'SUPER_ADMIN',
    },
  });

  // B. Equipo Específico para WSJ Polonia 2027
  const jefePolonia = await prisma.user.upsert({
    where: { email: 'jefe.polonia@agsch.cl' },
    update: { role: 'USER', passwordHash },
    create: {
      email: 'jefe.polonia@agsch.cl',
      passwordHash,
      name: 'Ignacio Valenzuela (Jefe Contingente WSJ)',
      role: 'USER',
    },
  });

  const tesoreroPolonia = await prisma.user.upsert({
    where: { email: 'tesorero.polonia@agsch.cl' },
    update: { role: 'USER', passwordHash },
    create: {
      email: 'tesorero.polonia@agsch.cl',
      passwordHash,
      name: 'María Paz Morales (Tesorera WSJ)',
      role: 'USER',
    },
  });

  const medicoPolonia = await prisma.user.upsert({
    where: { email: 'medico.polonia@agsch.cl' },
    update: { role: 'USER', passwordHash },
    create: {
      email: 'medico.polonia@agsch.cl',
      passwordHash,
      name: 'Dra. Claudia Reyes (Jefa Equipo de Salud WSJ)',
      role: 'USER',
    },
  });

  // C. Equipo Específico para Moot Portugal 2029
  const jefePortugal = await prisma.user.upsert({
    where: { email: 'jefe.portugal@agsch.cl' },
    update: { role: 'USER', passwordHash },
    create: {
      email: 'jefe.portugal@agsch.cl',
      passwordHash,
      name: 'Sebastián Alarcón (Jefe Contingente Moot)',
      role: 'USER',
    },
  });

  // 6. Asignar Roles de Pertenencia (EventMembership)
  const memberships = [
    // Super administradores asignados como EVENT_ADMIN en Polonia
    { userId: adminGlobal.id, eventId: wsjEvent.id, role: 'EVENT_ADMIN', title: 'Comisionado de Contingente' },
    { userId: adminInstitucional.id, eventId: wsjEvent.id, role: 'EVENT_ADMIN', title: 'Gestión Nacional' },
    
    // Equipo WSJ Polonia 2027
    { userId: jefePolonia.id, eventId: wsjEvent.id, role: 'EVENT_ADMIN', title: 'Jefe de Contingente WSJ' },
    { userId: tesoreroPolonia.id, eventId: wsjEvent.id, role: 'TREASURER', title: 'Tesorera del Contingente' },
    { userId: medicoPolonia.id, eventId: wsjEvent.id, role: 'MEDICAL_STAFF', title: 'Encargada Médica Nacional' },

    // Equipo Moot Portugal 2029
    { userId: jefePortugal.id, eventId: mootEvent.id, role: 'EVENT_ADMIN', title: 'Jefe de Contingente Moot 2029' },
  ];

  for (const m of memberships) {
    await prisma.eventMembership.upsert({
      where: {
        userId_eventId: {
          userId: m.userId,
          eventId: m.eventId,
        },
      },
      update: {
        role: m.role,
        title: m.title,
      },
      create: {
        userId: m.userId,
        eventId: m.eventId,
        role: m.role,
        title: m.title,
      },
    });
  }
  console.log(`✓ ${memberships.length} asignaciones de equipo y permisos creadas`);

  console.log('\n🎉 ¡Sistema Multi-Evento AGSCH configurado exitosamente!');
}

main()
  .catch((e) => {
    console.error('Error al inicializar multi-evento:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
