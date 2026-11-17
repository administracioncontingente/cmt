import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed with valid Chilean RUTs...');

  // 1. Clean existing records
  await prisma.payment.deleteMany();
  await prisma.participant.deleteMany();
  await prisma.installmentSchedule.deleteMany();
  await prisma.paymentPlan.deleteMany();
  await prisma.user.deleteMany();

  // 2. Create Admin User
  const passwordHash = await bcrypt.hash('admin123', 10);
  const admin = await prisma.user.create({
    data: {
      email: 'admin@agsch.cl',
      name: 'Comisionado de Contingente',
      passwordHash,
      role: 'ADMIN',
    },
  });
  console.log('👤 Admin user created: admin@agsch.cl (pass: admin123)');

  // 3. Create Payment Plans
  const planJoven = await prisma.paymentPlan.create({
    data: {
      roleKey: 'JOVEN',
      name: 'Plan Participante / Joven (14 - 17 años)',
      totalAmount: 3600,
      currency: 'USD',
      description: 'Cuota de participación completa para jóvenes del contingente chileno.',
      installments: {
        create: [
          { installmentNumber: 1, title: 'Cuota 1 - Reserva e Inscripción', amount: 600, dueDate: new Date('2026-03-31') },
          { installmentNumber: 2, title: 'Cuota 2', amount: 600, dueDate: new Date('2026-06-30') },
          { installmentNumber: 3, title: 'Cuota 3', amount: 600, dueDate: new Date('2026-09-30') },
          { installmentNumber: 4, title: 'Cuota 4', amount: 600, dueDate: new Date('2026-12-31') },
          { installmentNumber: 5, title: 'Cuota 5', amount: 600, dueDate: new Date('2027-03-31') },
          { installmentNumber: 6, title: 'Cuota 6 - Saldo Final', amount: 600, dueDate: new Date('2027-05-31') },
        ],
      },
    },
  });

  const planDirigente = await prisma.paymentPlan.create({
    data: {
      roleKey: 'DIRIGENTE',
      name: 'Plan Educador / Dirigente de Unidad',
      totalAmount: 3300,
      currency: 'USD',
      description: 'Cuota de participación para dirigentes a cargo de unidades de contingente.',
      installments: {
        create: [
          { installmentNumber: 1, title: 'Cuota 1 - Reserva e Inscripción', amount: 550, dueDate: new Date('2026-03-31') },
          { installmentNumber: 2, title: 'Cuota 2', amount: 550, dueDate: new Date('2026-06-30') },
          { installmentNumber: 3, title: 'Cuota 3', amount: 550, dueDate: new Date('2026-09-30') },
          { installmentNumber: 4, title: 'Cuota 4', amount: 550, dueDate: new Date('2026-12-31') },
          { installmentNumber: 5, title: 'Cuota 5', amount: 550, dueDate: new Date('2027-03-31') },
          { installmentNumber: 6, title: 'Cuota 6 - Saldo Final', amount: 550, dueDate: new Date('2027-05-31') },
        ],
      },
    },
  });

  const planIST = await prisma.paymentPlan.create({
    data: {
      roleKey: 'IST',
      name: 'Plan IST (Equipo Internacional de Servicio)',
      totalAmount: 2200,
      currency: 'USD',
      description: 'Cuota para voluntarios adultos del IST (18+ años).',
      installments: {
        create: [
          { installmentNumber: 1, title: 'Cuota 1 - Confirmación IST', amount: 550, dueDate: new Date('2026-04-30') },
          { installmentNumber: 2, title: 'Cuota 2', amount: 550, dueDate: new Date('2026-08-31') },
          { installmentNumber: 3, title: 'Cuota 3', amount: 550, dueDate: new Date('2026-12-31') },
          { installmentNumber: 4, title: 'Cuota 4 - Saldo Final', amount: 550, dueDate: new Date('2027-04-30') },
        ],
      },
    },
  });

  const planCMT = await prisma.paymentPlan.create({
    data: {
      roleKey: 'CMT',
      name: 'Plan CMT (Equipo de Gestión del Contingente)',
      totalAmount: 2200,
      currency: 'USD',
      description: 'Cuota para el equipo de gestión nacional del contingente.',
      installments: {
        create: [
          { installmentNumber: 1, title: 'Cuota 1 - Cuota Inicial', amount: 550, dueDate: new Date('2026-04-30') },
          { installmentNumber: 2, title: 'Cuota 2', amount: 550, dueDate: new Date('2026-08-31') },
          { installmentNumber: 3, title: 'Cuota 3', amount: 550, dueDate: new Date('2026-12-31') },
          { installmentNumber: 4, title: 'Cuota 4 - Saldo Final', amount: 550, dueDate: new Date('2027-04-30') },
        ],
      },
    },
  });

  console.log('💰 Payment plans created (JOVEN, DIRIGENTE, IST, CMT)');

  // 4. Sample Participants
  // Participant 1: Camila Sepulveda (Al día: 2 cuotas pagadas = $1200)
  const p1 = await prisma.participant.create({
    data: {
      rut: '21.345.678-4',
      firstName: 'Camila',
      lastName: 'Sepúlveda Silva',
      email: 'camila.sepulveda@gmail.com',
      phone: '+56 9 8765 4321',
      birthDate: new Date('2010-05-14'),
      gender: 'F',
      dietaryRestrictions: 'Vegetariana',
      medicalNotes: 'Ninguna conocida',
      guardianName: 'Marcela Silva Torres',
      guardianRelationship: 'Madre',
      guardianPhone: '+56 9 9876 5432',
      guardianEmail: 'marcela.silva@gmail.com',
      scoutZone: 'Santiago Oriente',
      scoutDistrict: 'Providencia',
      scoutGroup: 'Grupo Guía y Scout San Jorge',
      contingentRole: 'JOVEN',
      status: 'CONFIRMADO',
      unitOrPatrol: 'Tropa Cóndor - Patrulla Halcones',
      planId: planJoven.id,
      payments: {
        create: [
          {
            amount: 600,
            paymentDate: new Date('2026-03-20'),
            paymentMethod: 'TRANSFERENCIA',
            transactionReference: 'TRF-98231',
            notes: 'Abono Cuota 1',
            registeredById: admin.id,
          },
          {
            amount: 600,
            paymentDate: new Date('2026-06-15'),
            paymentMethod: 'TRANSFERENCIA',
            transactionReference: 'TRF-104928',
            notes: 'Abono Cuota 2',
            registeredById: admin.id,
          },
        ],
      },
    },
  });

  // Participant 2: Matías Morales (En mora: pagó Cuota 1, pero Cuota 2 venció)
  const p2 = await prisma.participant.create({
    data: {
      rut: '20.890.123-0',
      firstName: 'Matías',
      lastName: 'Morales Bravo',
      email: 'matias.morales@gmail.com',
      phone: '+56 9 7654 3210',
      birthDate: new Date('2009-11-20'),
      gender: 'M',
      dietaryRestrictions: 'Sin gluten (Celíaco)',
      guardianName: 'Carlos Morales Pinto',
      guardianRelationship: 'Padre',
      guardianPhone: '+56 9 8765 1122',
      guardianEmail: 'carlos.morales@empresa.cl',
      scoutZone: 'Valparaíso',
      scoutDistrict: 'Viña del Mar',
      scoutGroup: 'Grupo Scout Baden Powell',
      contingentRole: 'JOVEN',
      status: 'CONFIRMADO',
      unitOrPatrol: 'Tropa Cóndor - Patrulla Águilas',
      planId: planJoven.id,
      payments: {
        create: [
          {
            amount: 600,
            paymentDate: new Date('2026-03-28'),
            paymentMethod: 'TRANSFERENCIA',
            transactionReference: 'TRF-88129',
            notes: 'Abono Cuota 1',
            registeredById: admin.id,
          },
        ],
      },
    },
  });

  // Participant 3: Valentina Castro (IST - Al día)
  const p3 = await prisma.participant.create({
    data: {
      rut: '18.765.432-7',
      firstName: 'Valentina',
      lastName: 'Castro Abarca',
      email: 'valentina.ist@gmail.com',
      phone: '+56 9 6543 2109',
      birthDate: new Date('2002-08-10'),
      gender: 'F',
      guardianName: 'Juana Abarca',
      guardianRelationship: 'Madre',
      guardianPhone: '+56 9 5555 4444',
      scoutZone: 'Biobío',
      scoutDistrict: 'Concepción',
      scoutGroup: 'Grupo Scout La Araucaria',
      contingentRole: 'IST',
      status: 'CONFIRMADO',
      unitOrPatrol: 'Equipo de Programa / Logística IST',
      planId: planIST.id,
      payments: {
        create: [
          {
            amount: 550,
            paymentDate: new Date('2026-04-20'),
            paymentMethod: 'TRANSFERENCIA',
            transactionReference: 'TRF-55441',
            notes: 'Cuota 1 IST confirmada',
            registeredById: admin.id,
          },
        ],
      },
    },
  });

  // Participant 4: Rodrigo Silva (Dirigente - Al día)
  const p4 = await prisma.participant.create({
    data: {
      rut: '16.543.210-K',
      firstName: 'Rodrigo',
      lastName: 'Silva Donoso',
      email: 'rodrigo.silva@scout.cl',
      phone: '+56 9 4321 0987',
      birthDate: new Date('1990-03-15'),
      gender: 'M',
      guardianName: 'Patricia Donoso',
      guardianRelationship: 'Esposa',
      guardianPhone: '+56 9 4444 3333',
      scoutZone: 'Santiago Sur',
      scoutDistrict: 'San Miguel',
      scoutGroup: 'Grupo Gilwell',
      contingentRole: 'DIRIGENTE',
      status: 'CONFIRMADO',
      unitOrPatrol: 'Jefe de Unidad Tropa Cóndor',
      planId: planDirigente.id,
      payments: {
        create: [
          {
            amount: 550,
            paymentDate: new Date('2026-03-15'),
            paymentMethod: 'TRANSFERENCIA',
            transactionReference: 'TRF-11223',
            notes: 'Cuota 1 Dirigente',
            registeredById: admin.id,
          },
          {
            amount: 550,
            paymentDate: new Date('2026-06-25'),
            paymentMethod: 'TRANSFERENCIA',
            transactionReference: 'TRF-33445',
            notes: 'Cuota 2 Dirigente',
            registeredById: admin.id,
          },
        ],
      },
    },
  });

  // Participant 5: Benjamín Araya (Preinscrito - Sin pagos aún / En mora de Cuota 1)
  const p5 = await prisma.participant.create({
    data: {
      rut: '22.109.876-5',
      firstName: 'Benjamín',
      lastName: 'Araya Tapia',
      email: 'benja.araya@gmail.com',
      phone: '+56 9 3210 9876',
      birthDate: new Date('2011-01-25'),
      gender: 'M',
      guardianName: 'Eduardo Araya',
      guardianRelationship: 'Padre',
      guardianPhone: '+56 9 3333 2222',
      guardianEmail: 'eduardo.araya@hotmail.com',
      scoutZone: 'Elqui',
      scoutDistrict: 'La Serena',
      scoutGroup: 'Grupo La Serena Centro',
      contingentRole: 'JOVEN',
      status: 'PRE_INSCRITO',
      planId: planJoven.id,
    },
  });

  console.log('✅ Seed completed successfully with valid Chilean RUTs!');
}

main()
  .catch((e) => {
    console.error('❌ Error during seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
