import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser, getEventPermissions } from '@/lib/auth';
import { verifyMedicalEditToken } from '@/lib/medicalAuth';
import { translateCompleteMedicalRecord } from '@/lib/medicalTranslation';
import { apiErrorResponse, parseOptionalFloat } from '@/lib/apiUtils';
import { generateMedicalQr } from '@/lib/qr';

interface MedicalUpdateBody {
  bloodType?: string | null;
  heightCm?: unknown;
  weightKg?: unknown;
  emergencyContactName?: string | null;
  emergencyContactPhone?: string | null;
  emergencyContactRelation?: string | null;
  emergencyContactEmail?: string | null;
  insuranceCompany?: string | null;
  insurancePolicyNumber?: string | null;
  insuranceEmergencyPhone?: string | null;
  hasSevereAllergies?: boolean;
  carriesEpiPen?: boolean;
  allergiesES?: string | null;
  hasChronicConditions?: boolean;
  chronicConditionsES?: string | null;
  takesRegularMedication?: boolean;
  requiresColdChainMedication?: boolean;
  currentMedicationsES?: string | null;
  dietaryRestrictionsES?: string | null;
  tetanusLastDoseYear?: string | number | null;
  vaccinationRecordsES?: string | null;
  pastSurgeriesInjuriesES?: string | null;
  devicesImplantsES?: string | null;
  physicalLimitationsES?: string | null;
  emergencyTreatmentConsent?: boolean;
  declaredByName?: string | null;
  declaredByRut?: string | null;
  declaredByRole?: string | null;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const authHeader = req.headers.get('authorization');

    const adminUser = await getCurrentUser();

    let tokenPayload = null;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      tokenPayload = await verifyMedicalEditToken(token);
    }

    const participant = await prisma.participant.findFirst({
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

    if (!participant) {
      return NextResponse.json(
        { error: 'Participante o registro médico no encontrado' },
        { status: 404 }
      );
    }

    const hasAdminAccess = adminUser
      ? participant.eventId
        ? getEventPermissions(adminUser, participant.eventId).canView
        : adminUser.role === 'SUPER_ADMIN'
      : false;

    const hasTokenAccess = Boolean(
      tokenPayload && tokenPayload.participantId === participant.id
    );

    const hasQrAccess = Boolean(
      participant.medicalRecord?.qrAccessCode &&
        participant.medicalRecord.qrAccessCode === id
    );

    if (!hasAdminAccess && !hasTokenAccess && !hasQrAccess) {
      return NextResponse.json(
        { error: 'Acceso no autorizado a la ficha médica confidencial' },
        { status: adminUser ? 403 : 401 }
      );
    }

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

    const { qrEmergencyUrl, qrDataUrl } = await generateMedicalQr(
      req,
      medicalRecord.qrAccessCode
    );

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
  } catch (error: unknown) {
    return apiErrorResponse(error, 'Error al procesar la solicitud médica');
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = (await req.json()) as MedicalUpdateBody;
    const authHeader = req.headers.get('authorization');

    const adminUser = await getCurrentUser();
    let tokenPayload = null;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      tokenPayload = await verifyMedicalEditToken(token);
    }

    const participant = await prisma.participant.findFirst({
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

    if (!participant) {
      return NextResponse.json(
        { error: 'Participante no encontrado' },
        { status: 404 }
      );
    }

    const hasAdminAccess = adminUser
      ? participant.eventId
        ? getEventPermissions(adminUser, participant.eventId).canManageMedical
        : adminUser.role === 'SUPER_ADMIN'
      : false;

    const hasEditTokenAccess = Boolean(
      tokenPayload &&
        tokenPayload.participantId === participant.id &&
        tokenPayload.scope === 'MEDICAL_EDIT'
    );

    if (!hasAdminAccess && !hasEditTokenAccess) {
      return NextResponse.json(
        { error: 'No tienes autorización para editar esta ficha médica.' },
        { status: adminUser || tokenPayload ? 403 : 401 }
      );
    }

    const translations = translateCompleteMedicalRecord({
      bloodType: body.bloodType,
      allergiesES: body.allergiesES,
      hasSevereAllergies: Boolean(body.hasSevereAllergies),
      carriesEpiPen: Boolean(body.carriesEpiPen),
      chronicConditionsES: body.chronicConditionsES,
      currentMedicationsES: body.currentMedicationsES,
      requiresColdChainMedication: Boolean(body.requiresColdChainMedication),
      dietaryRestrictionsES: body.dietaryRestrictionsES,
      vaccinationRecordsES: body.vaccinationRecordsES,
      tetanusLastDoseYear: body.tetanusLastDoseYear ? String(body.tetanusLastDoseYear) : null,
      pastSurgeriesInjuriesES: body.pastSurgeriesInjuriesES,
      devicesImplantsES: body.devicesImplantsES,
      physicalLimitationsES: body.physicalLimitationsES,
    });

    const clientIp =
      req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || undefined;

    const medicalData = {
      bloodType: body.bloodType || null,
      heightCm: parseOptionalFloat(body.heightCm),
      weightKg: parseOptionalFloat(body.weightKg),

      emergencyContactName: body.emergencyContactName || null,
      emergencyContactPhone: body.emergencyContactPhone || null,
      emergencyContactRelation: body.emergencyContactRelation || null,
      emergencyContactEmail: body.emergencyContactEmail || null,

      insuranceCompany: body.insuranceCompany || null,
      insurancePolicyNumber: body.insurancePolicyNumber || null,
      insuranceEmergencyPhone: body.insuranceEmergencyPhone || null,

      hasSevereAllergies: Boolean(body.hasSevereAllergies),
      carriesEpiPen: Boolean(body.carriesEpiPen),
      allergiesES: body.allergiesES || null,
      allergiesEN: translations.allergiesEN,
      allergiesPL: translations.allergiesPL,

      hasChronicConditions: Boolean(body.hasChronicConditions),
      chronicConditionsES: body.chronicConditionsES || null,
      chronicConditionsEN: translations.chronicConditionsEN,
      chronicConditionsPL: translations.chronicConditionsPL,

      takesRegularMedication: Boolean(body.takesRegularMedication),
      requiresColdChainMedication: Boolean(body.requiresColdChainMedication),
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

      emergencyTreatmentConsent: Boolean(body.emergencyTreatmentConsent),
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

    await prisma.participant.update({
      where: { id: participant.id },
      data: {
        dietaryRestrictions: body.dietaryRestrictionsES || participant.dietaryRestrictions,
        medicalNotes: body.allergiesES
          ? `Alergias: ${body.allergiesES}`
          : participant.medicalNotes,
      },
    });

    const { qrEmergencyUrl, qrDataUrl } = await generateMedicalQr(
      req,
      updatedRecord.qrAccessCode
    );

    return NextResponse.json({
      success: true,
      message: 'Ficha médica guardada y traducida exitosamente al inglés y polaco.',
      medicalRecord: updatedRecord,
      qrEmergencyUrl,
      qrDataUrl,
    });
  } catch (error: unknown) {
    return apiErrorResponse(error, 'Error interno al guardar la ficha médica');
  }
}
