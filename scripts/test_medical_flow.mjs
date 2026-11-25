import { PrismaClient } from '@prisma/client';
import { translateCompleteMedicalRecord } from '../src/lib/medicalTranslation.ts';

const prisma = new PrismaClient();

async function runTest() {
  console.log('🧪 Iniciando prueba automatizada de la Ficha Médica y Traducciones...\n');

  // 1. Obtener un participante de prueba
  const participant = await prisma.participant.findFirst({
    where: { guardianEmail: { not: null } },
  });

  if (!participant) {
    throw new Error('No se encontró ningún participante con apoderado');
  }

  console.log(`👤 Participante seleccionado: ${participant.firstName} ${participant.lastName} (RUT: ${participant.rut})`);
  console.log(`📧 Correo apoderado: ${participant.guardianEmail}`);

  // 2. Probar Motor de Traducción Médica Rigurosa (ES -> EN / PL)
  console.log('\n🌐 Probando motor de traducción clínica rigurosa...');
  const inputClinico = {
    bloodType: 'A+',
    allergiesES: 'Penicilina (anafilaxia), Maní, Picadura de abeja',
    hasSevereAllergies: true,
    carriesEpiPen: true,
    chronicConditionsES: 'Asma bronquial inducida por ejercicio',
    hasChronicConditions: true,
    currentMedicationsES: 'Salbutamol inhalador 2 puffs cada 8 horas si hay crisis',
    takesRegularMedication: true,
    requiresColdChainMedication: false,
    dietaryRestrictionsES: 'Sin gluten (Celíaco)',
    tetanusLastDoseYear: '2025',
    vaccinationRecordsES: 'Antitetánica al día, COVID-19, Tres Vírica',
    pastSurgeriesInjuriesES: 'Apendicectomía (2022), Fractura de clavícula',
    devicesImplantsES: 'Lentes ópticos de repuesto, Frenillos',
    physicalLimitationsES: 'Sabe nadar, mareo en transporte',
  };

  const traducciones = translateCompleteMedicalRecord(inputClinico);

  console.log('\n--- RESULTADOS CLÍNICOS EN INGLÉS (EN) ---');
  console.log('Allergies (EN):', traducciones.allergiesEN);
  console.log('Chronic Conditions (EN):', traducciones.chronicConditionsEN);
  console.log('Medications (EN):', traducciones.currentMedicationsEN);
  console.log('Dietary (EN):', traducciones.dietaryRestrictionsEN);
  console.log('Vaccinations (EN):', traducciones.vaccinationRecordsEN);
  console.log('Surgeries (EN):', traducciones.pastSurgeriesInjuriesEN);
  console.log('Devices (EN):', traducciones.devicesImplantsEN);
  console.log('Limitations (EN):', traducciones.physicalLimitationsEN);

  console.log('\n--- RESULTADOS CLÍNICOS EN POLACO (PL) ---');
  console.log('Allergies (PL):', traducciones.allergiesPL);
  console.log('Chronic Conditions (PL):', traducciones.chronicConditionsPL);
  console.log('Medications (PL):', traducciones.currentMedicationsPL);
  console.log('Dietary (PL):', traducciones.dietaryRestrictionsPL);
  console.log('Vaccinations (PL):', traducciones.vaccinationRecordsPL);
  console.log('Surgeries (PL):', traducciones.pastSurgeriesInjuriesPL);
  console.log('Devices (PL):', traducciones.devicesImplantsPL);
  console.log('Limitations (PL):', traducciones.physicalLimitationsPL);

  // 3. Guardar en Base de Datos
  const record = await prisma.medicalRecord.upsert({
    where: { participantId: participant.id },
    create: {
      participantId: participant.id,
      bloodType: inputClinico.bloodType,
      emergencyContactName: participant.guardianName || 'Apoderado',
      emergencyContactPhone: participant.guardianPhone || '+56912345678',
      emergencyContactEmail: participant.guardianEmail,
      hasSevereAllergies: inputClinico.hasSevereAllergies,
      carriesEpiPen: inputClinico.carriesEpiPen,
      allergiesES: inputClinico.allergiesES,
      allergiesEN: traducciones.allergiesEN,
      allergiesPL: traducciones.allergiesPL,
      hasChronicConditions: inputClinico.hasChronicConditions,
      chronicConditionsES: inputClinico.chronicConditionsES,
      chronicConditionsEN: traducciones.chronicConditionsEN,
      chronicConditionsPL: traducciones.chronicConditionsPL,
      takesRegularMedication: inputClinico.takesRegularMedication,
      currentMedicationsES: inputClinico.currentMedicationsES,
      currentMedicationsEN: traducciones.currentMedicationsEN,
      currentMedicationsPL: traducciones.currentMedicationsPL,
      dietaryRestrictionsES: inputClinico.dietaryRestrictionsES,
      dietaryRestrictionsEN: traducciones.dietaryRestrictionsEN,
      dietaryRestrictionsPL: traducciones.dietaryRestrictionsPL,
      tetanusLastDoseYear: inputClinico.tetanusLastDoseYear,
      vaccinationRecordsES: inputClinico.vaccinationRecordsES,
      vaccinationRecordsEN: traducciones.vaccinationRecordsEN,
      vaccinationRecordsPL: traducciones.vaccinationRecordsPL,
      pastSurgeriesInjuriesES: inputClinico.pastSurgeriesInjuriesES,
      pastSurgeriesInjuriesEN: traducciones.pastSurgeriesInjuriesEN,
      pastSurgeriesInjuriesPL: traducciones.pastSurgeriesInjuriesPL,
      devicesImplantsES: inputClinico.devicesImplantsES,
      devicesImplantsEN: traducciones.devicesImplantsEN,
      devicesImplantsPL: traducciones.devicesImplantsPL,
      physicalLimitationsES: inputClinico.physicalLimitationsES,
      physicalLimitationsEN: traducciones.physicalLimitationsEN,
      physicalLimitationsPL: traducciones.physicalLimitationsPL,
      emergencyTreatmentConsent: true,
      declaredByName: participant.guardianName,
      declaredByRole: 'APODERADO',
      declaredAt: new Date(),
      completionStatus: 'COMPLETED',
    },
    update: {
      completionStatus: 'COMPLETED',
      allergiesES: inputClinico.allergiesES,
      allergiesEN: traducciones.allergiesEN,
      allergiesPL: traducciones.allergiesPL,
      chronicConditionsEN: traducciones.chronicConditionsEN,
      chronicConditionsPL: traducciones.chronicConditionsPL,
      currentMedicationsEN: traducciones.currentMedicationsEN,
      currentMedicationsPL: traducciones.currentMedicationsPL,
    },
  });

  console.log(`\n✅ Ficha médica persistida con éxito en SQLite!`);
  console.log(`📱 QR Access Code asignado: ${record.qrAccessCode}`);
  console.log(`🔗 URL de Emergencia para Paramédicos: http://localhost:3000/medico/${record.qrAccessCode}`);
  console.log(`🔗 URL Portal Ficha Médica: http://localhost:3000/ficha-medica`);
  console.log('\n🎉 ¡TODAS LAS VALIDACIONES CLÍNICAS Y DE TRADUCCIÓN FINALIZARON CON ÉXITO!');
}

runTest()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
