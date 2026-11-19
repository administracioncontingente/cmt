import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import { verifyMedicalEditToken } from '@/lib/medicalAuth';
import { translateCompleteMedicalRecord } from '@/lib/medicalTranslation';
import { cleanRut, formatRut } from '@/lib/rut';
import QRCode from 'qrcode';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const rutParam = searchParams.get('rut');
    const emailParam = searchParams.get('email');
    const authHeader = req.headers.get('authorization');

    // 1. Verificar si viene con sesión de Administrador
    const adminUser = await getCurrentUser();

    // 2. Verificar si viene con Token de Edición Médica (OTP previo)
    let tokenPayload = null;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      tokenPayload = await verifyMedicalEditToken(token);
    }

    // Buscar participante por ID, o si id es 'by-rut', buscar por los parámetros de búsqueda
    let participant = null;

    if (id === 'by-rut' && rutParam && emailParam) {
      const cleaned = cleanRut(rutParam);
      const formatted = formatRut(cleaned);
      const normEmail = emailParam.toLowerCase().trim();

      participant = await prisma.participant.findFirst({
        where: {
          AND: [
            {
              OR: [
                { rut: formatted },
                { rut: cleaned },
                { rutClean: cleaned },
              ],
            },
            {
              OR: [
                { guardianEmail: normEmail },
                { email: normEmail },
              ],
            },
          ],
        },
        include: {
          medicalRecord: true,
        },
      });
    } else {
      participant = await prisma.participant.findFirst({
        where: {
          OR: [
            { id },
            { rut: id },
            { medicalRecord: { qrAccessCode: id } },
          ],
        },
        include: {
          medicalRecord: true,
        },
      });
    }

    if (!participant) {
      return NextResponse.json(
        { error: 'Participante o registro médico no encontrado' },
        { status: 404 }
      );
    }

    // Control de acceso: Permitir si es admin, o si el token coincide con el participante, o si coincide RUT + email
    const isAuthorized =
      !!adminUser ||
      (tokenPayload && tokenPayload.participantId === participant.id) ||
      (rutParam &&
        emailParam &&
        (cleanRut(participant.rut) === cleanRut(rutParam) ||
          participant.rut === formatRut(cleanRut(rutParam))) &&
        (participant.email?.toLowerCase() === emailParam.toLowerCase().trim() ||
          participant.guardianEmail?.toLowerCase() === emailParam.toLowerCase().trim()));

    // Si no está autorizado pero es acceso por QR de emergencia (id coincide con qrAccessCode):
    const isQrEmergencyAccess =
      participant.medicalRecord?.qrAccessCode === id ||
      searchParams.get('qrAccess') === 'true';

    if (!isAuthorized && !isQrEmergencyAccess) {
      return NextResponse.json(
        { error: 'Acceso no autorizado a la ficha médica confidencial' },
        { status: 401 }
      );
    }

    // Asegurar que exista MedicalRecord
    let medicalRecord = participant.medicalRecord;
    if (!medicalRecord) {
      medicalRecord = await prisma.medicalRecord.create({
        data: {
          participantId: participant.id,
          emergencyContactName: participant.guardianName || null,
          emergencyContactPhone: participant.guardianPhone || null,
          emergencyContactEmail: participant.guardianEmail || null,
          emergencyContactRelation: participant.guardianRelationship || null,
          dietaryRestrictionsES: participant.dietaryRestrictions || null,
          allergiesES: participant.medicalNotes || null,
        },
      });
    }

    // Generar código QR Data URL
    const origin = req.headers.get('origin') || req.headers.get('host') || 'http://localhost:3000';
    const baseUrl = origin.startsWith('http') ? origin : `https://${origin}`;
    const qrEmergencyUrl = `${baseUrl}/medico/${medicalRecord.qrAccessCode}`;
    const qrDataUrl = await QRCode.toDataURL(qrEmergencyUrl, {
      margin: 1,
      width: 256,
      color: {
        dark: '#001558',
        light: '#FFFFFF',
      },
    });

    return NextResponse.json({
      participant: {
        id: participant.id,
        rut: participant.rut,
        firstName: participant.firstName,
        lastName: participant.lastName,
        secondLastName: participant.secondLastName,
        email: participant.email,
        phone: participant.phone,
        birthDate: participant.birthDate,
        gender: participant.gender,
        guardianName: participant.guardianName,
        guardianPhone: participant.guardianPhone,
        guardianEmail: participant.guardianEmail,
        guardianRelationship: participant.guardianRelationship,
        scoutZone: participant.scoutZone,
        scoutDistrict: participant.scoutDistrict,
        scoutGroup: participant.scoutGroup,
        contingentRole: participant.contingentRole,
        cupoCode: participant.cupoCode,
      },
      medicalRecord,
      qrEmergencyUrl,
      qrDataUrl,
    });
  } catch (error: any) {
    console.error('Error al obtener ficha médica:', error);
    return NextResponse.json(
      { error: error.message || 'Error al procesar la solicitud médica' },
      { status: 500 }
    );
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const authHeader = req.headers.get('authorization');

    // Validar autorización: Admin o Token de Edición Médica
    const adminUser = await getCurrentUser();
    let tokenPayload = null;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      tokenPayload = await verifyMedicalEditToken(token);
    }

    // Encontrar participante
    const participant = await prisma.participant.findFirst({
      where: {
        OR: [{ id }, { rut: id }],
      },
      include: {
        medicalRecord: true,
      },
    });

    if (!participant) {
      return NextResponse.json(
        { error: 'Participante no encontrado' },
        { status: 404 }
      );
    }

    const isAuthorized =
      !!adminUser ||
      (tokenPayload && tokenPayload.participantId === participant.id);

    if (!isAuthorized) {
      return NextResponse.json(
        { error: 'No tienes autorización para editar esta ficha médica.' },
        { status: 401 }
      );
    }

    // Realizar la traducción médica rigurosa cruzada ES -> EN y PL
    const translations = translateCompleteMedicalRecord({
      bloodType: body.bloodType,
      allergiesES: body.allergiesES,
      hasSevereAllergies: !!body.hasSevereAllergies,
      carriesEpiPen: !!body.carriesEpiPen,
      chronicConditionsES: body.chronicConditionsES,
      currentMedicationsES: body.currentMedicationsES,
      requiresColdChainMedication: !!body.requiresColdChainMedication,
      dietaryRestrictionsES: body.dietaryRestrictionsES,
      vaccinationRecordsES: body.vaccinationRecordsES,
      tetanusLastDoseYear: body.tetanusLastDoseYear ? String(body.tetanusLastDoseYear) : null,
      pastSurgeriesInjuriesES: body.pastSurgeriesInjuriesES,
      devicesImplantsES: body.devicesImplantsES,
      physicalLimitationsES: body.physicalLimitationsES,
    });

    const clientIp = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || undefined;

    const medicalData = {
      bloodType: body.bloodType || null,
      heightCm: body.heightCm ? parseFloat(body.heightCm) : null,
      weightKg: body.weightKg ? parseFloat(body.weightKg) : null,

      emergencyContactName: body.emergencyContactName || null,
      emergencyContactPhone: body.emergencyContactPhone || null,
      emergencyContactRelation: body.emergencyContactRelation || null,
      emergencyContactEmail: body.emergencyContactEmail || null,

      insuranceCompany: body.insuranceCompany || null,
      insurancePolicyNumber: body.insurancePolicyNumber || null,
      insuranceEmergencyPhone: body.insuranceEmergencyPhone || null,

      hasSevereAllergies: !!body.hasSevereAllergies,
      carriesEpiPen: !!body.carriesEpiPen,
      allergiesES: body.allergiesES || null,
      allergiesEN: translations.allergiesEN,
      allergiesPL: translations.allergiesPL,

      hasChronicConditions: !!body.hasChronicConditions,
      chronicConditionsES: body.chronicConditionsES || null,
      chronicConditionsEN: translations.chronicConditionsEN,
      chronicConditionsPL: translations.chronicConditionsPL,

      takesRegularMedication: !!body.takesRegularMedication,
      requiresColdChainMedication: !!body.requiresColdChainMedication,
      currentMedicationsES: body.currentMedicationsES || null,
      currentMedicationsEN: translations.currentMedicationsEN,
      currentMedicationsPL: translations.currentMedicationsPL,

      dietaryRestrictionsES: body.dietaryRestrictionsES || null,
      dietaryRestrictionsEN: translations.dietaryRestrictionsEN,
      dietaryRestrictionsPL: translations.dietaryRestrictionsPL,

      tetanusLastDoseYear: body.tetanusLastDoseYear ? String(body.tetanusLastDoseYear) : null,
      vaccinationRecordsES: body.vaccinationRecordsES || null,
      vaccinationRecordsEN: translations.vaccinationRecordsEN,
      vaccinationRecordsPL: translations.vaccinationRecordsPL,

      pastSurgeriesInjuriesES: body.pastSurgeriesInjuriesES || null,
      pastSurgeriesInjuriesEN: translations.pastSurgeriesInjuriesEN,
      pastSurgeriesInjuriesPL: translations.pastSurgeriesInjuriesPL,

      devicesImplantsES: body.devicesImplantsES || null,
      devicesImplantsEN: translations.devicesImplantsEN,
      devicesImplantsPL: translations.devicesImplantsPL,

      physicalLimitationsES: body.physicalLimitationsES || null,
      physicalLimitationsEN: translations.physicalLimitationsEN,
      physicalLimitationsPL: translations.physicalLimitationsPL,

      emergencyTreatmentConsent: !!body.emergencyTreatmentConsent,
      declaredByName: body.declaredByName || null,
      declaredByRut: body.declaredByRut || null,
      declaredByRole: body.declaredByRole || 'APODERADO',
      declaredAt: new Date(),

      completionStatus: 'COMPLETED',
      lastUpdatedIp: clientIp || null,
    };

    const updatedRecord = await prisma.medicalRecord.upsert({
      where: { participantId: participant.id },
      create: {
        participantId: participant.id,
        ...medicalData,
      },
      update: medicalData,
    });

    // Actualizar campos médicos resumidos en el participante
    await prisma.participant.update({
      where: { id: participant.id },
      data: {
        dietaryRestrictions: body.dietaryRestrictionsES || participant.dietaryRestrictions,
        medicalNotes: body.allergiesES
          ? `Alergias: ${body.allergiesES}`
          : participant.medicalNotes,
      },
    });

    // Generar URL del código QR
    const origin = req.headers.get('origin') || req.headers.get('host') || 'http://localhost:3000';
    const baseUrl = origin.startsWith('http') ? origin : `https://${origin}`;
    const qrEmergencyUrl = `${baseUrl}/medico/${updatedRecord.qrAccessCode}`;
    const qrDataUrl = await QRCode.toDataURL(qrEmergencyUrl, {
      margin: 1,
      width: 256,
      color: {
        dark: '#001558',
        light: '#FFFFFF',
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Ficha médica guardada y traducida exitosamente al inglés y polaco.',
      medicalRecord: updatedRecord,
      qrEmergencyUrl,
      qrDataUrl,
    });
  } catch (error: any) {
    console.error('Error al guardar ficha médica:', error);
    return NextResponse.json(
      { error: error.message || 'Error interno al guardar la ficha médica' },
      { status: 500 }
    );
  }
}
