import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🔐 Configurando credenciales de administrador en Supabase...');
  
  const hash = await bcrypt.hash('admin123', 10);
  
  // 1. admin@agsch.cl
  const adminAgsch = await prisma.user.upsert({
    where: { email: 'admin@agsch.cl' },
    update: {
      passwordHash: hash,
      role: 'ADMIN',
      name: 'Comisionado de Contingente',
    },
    create: {
      email: 'admin@agsch.cl',
      passwordHash: hash,
      role: 'ADMIN',
      name: 'Comisionado de Contingente',
    },
  });
  console.log('✓ Usuario admin@agsch.cl configurado con password "admin123"');

  // 2. administracioncontingente@guiasyscoutschile.cl
  const adminInstitucional = await prisma.user.upsert({
    where: { email: 'administracioncontingente@guiasyscoutschile.cl' },
    update: {
      passwordHash: hash,
      role: 'ADMIN',
      name: 'Administración Contingente',
    },
    create: {
      email: 'administracioncontingente@guiasyscoutschile.cl',
      passwordHash: hash,
      role: 'ADMIN',
      name: 'Administración Contingente',
    },
  });
  console.log('✓ Usuario administracioncontingente@guiasyscoutschile.cl configurado con password "admin123"');

  // 3. Test verification
  const isValid1 = await bcrypt.compare('admin123', adminAgsch.passwordHash);
  const isValid2 = await bcrypt.compare('admin123', adminInstitucional.passwordHash);
  console.log(`\nVerificación: admin@agsch.cl -> ${isValid1 ? 'OK' : 'FALLO'}`);
  console.log(`Verificación: administracioncontingente@guiasyscoutschile.cl -> ${isValid2 ? 'OK' : 'FALLO'}`);
}

main()
  .catch((e) => {
    console.error('Error al configurar credenciales:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
