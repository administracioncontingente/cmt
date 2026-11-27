import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getParticipantSession } from '@/lib/participantAuth';
import { translateCompleteMedicalRecord } from '@/lib/medicalTranslation';
import { generateMedicalQr } from '@/lib/qr';
import { apiErrorResponse, parseOptionalFloat } from '@/lib/apiUtils';

interface PortalMedicalUpdateBody {
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

function optionalTrimmedString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

/**
 * Updates and translates the authenticated participant's medical record,
 * regenerating their emergency QR code payload.
 */
export async function POST(req: NextRequest) {
  const session = await getParticipantSession();
  if (!session) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  let body: PortalMedicalUpdateBody;
  try {
    const parsed: unknown = await req.json();
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return NextResponse.json(
        { error: 'Cuerpo JSON inválido' },
        { status: 400 }
      );
    }
    body = parsed as PortalMedicalUpdateBody;
  } catch {
    return NextResponse.json(
      { error: 'Cuerpo JSON inválido' },
      { status: 400 }
    );
  }

  if (body.emergencyTreatmentConsent !== true) {
    return NextResponse.json(
      {
        error:
          'Debes aceptar la autorización de tratamiento médico de emergencia para guardar la ficha médica.',
      },
      { status: 400 }
    );
  }

  try {
    const participant = await prisma.participant.findUnique({
      where: { id: session.participantId },
      include: { medicalRecord: true },
    });

    if (!participant) {
      return NextResponse.json(
        { error: 'Participante no encontrado' },
        { status: 404 }
      );
    }

    const tetanusYear =
      body.tetanusLastDoseYear !== null &&
      body.tetanusLastDoseYear !== undefined &&
      String(body.tetanusLastDoseYear).trim()
        ? String(body.tetanusLastDoseYear).trim()
        : null;

    const allergiesES = optionalTrimmedString(body.allergiesES);
    const chronicConditionsES = optionalTrimmedString(body.chronicConditionsES);
    const currentMedicationsES = optionalTrimmedString(body.currentMedicationsES);
    const dietaryRestrictionsES = optionalTrimmedString(body.dietaryRestrictionsES);
    const vaccinationRecordsES = optionalTrimmedString(body.vaccinationRecordsES);
    const pastSurgeriesInjuriesES = optionalTrimmedString(body.pastSurgeriesInjuriesES);
    const devicesImplantsES = optionalTrimmedString(body.devicesImplantsES);
    const physicalLimitationsES = optionalTrimmedString(body.physicalLimitationsES);

    const translations = translateCompleteMedicalRecord({
      bloodType: optionalTrimmedString(body.bloodType),
      allergiesES,
      hasSevereAllergies: Boolean(body.hasSevereAllergies),
      carriesEpiPen: Boolean(body.carriesEpiPen),
      chronicConditionsES,
      currentMedicationsES,
      requiresColdChainMedication: Boolean(body.requiresColdChainMedication),
      dietaryRestrictionsES,
      vaccinationRecordsES,
      tetanusLastDoseYear: tetanusYear,
      pastSurgeriesInjuriesES,
      devicesImplantsES,
      physicalLimitationsES,
    });

    const forwardedFor = req.headers.get('x-forwarded-for');
    const clientIp =
      forwardedFor?.split(',')[0]?.trim() ||
      req.headers.get('x-real-ip')?.trim() ||
      null;

    const medicalData = {
      bloodType: optionalTrimmedString(body.bloodType),
      heightCm: parseOptionalFloat(body.heightCm),
      weightKg: parseOptionalFloat(body.weightKg),

      emergencyContactName: optionalTrimmedString(body.emergencyContactName),
      emergencyContactPhone: optionalTrimmedString(body.emergencyContactPhone),
      emergencyContactRelation: optionalTrimmedString(body.emergencyContactRelation),
      emergencyContactEmail: optionalTrimmedString(body.emergencyContactEmail),

      insuranceCompany: optionalTrimmedString(body.insuranceCompany),
      insurancePolicyNumber: optionalTrimmedString(body.insurancePolicyNumber),
      insuranceEmergencyPhone: optionalTrimmedString(body.insuranceEmergencyPhone),

      hasSevereAllergies: Boolean(body.hasSevereAllergies),
      carriesEpiPen: Boolean(body.carriesEpiPen),
      allergiesES,
      allergiesEN: translations.allergiesEN,
      allergiesPL: translations.allergiesPL,

      hasChronicConditions: Boolean(body.hasChronicConditions),
      chronicConditionsES,
      chronicConditionsEN: translations.chronicConditionsEN,
      chronicConditionsPL: translations.chronicConditionsPL,

      takesRegularMedication: Boolean(body.takesRegularMedication),
      requiresColdChainMedication: Boolean(body.requiresColdChainMedication),
      currentMedicationsES,
      currentMedicationsEN: translations.currentMedicationsEN,
      currentMedicationsPL: translations.currentMedicationsPL,

      dietaryRestrictionsES,
      dietaryRestrictionsEN: translations.dietaryRestrictionsEN,
      dietaryRestrictionsPL: translations.dietaryRestrictionsPL,

      tetanusLastDoseYear: tetanusYear,
      vaccinationRecordsES,
      vaccinationRecordsEN: translations.vaccinationRecordsEN,
      vaccinationRecordsPL: translations.vaccinationRecordsPL,

      pastSurgeriesInjuriesES,
      pastSurgeriesInjuriesEN: translations.pastSurgeriesInjuriesEN,
      pastSurgeriesInjuriesPL: translations.pastSurgeriesInjuriesPL,

      devicesImplantsES,
      devicesImplantsEN: translations.devicesImplantsEN,
      devicesImplantsPL: translations.devicesImplantsPL,

      physicalLimitationsES,
      physicalLimitationsEN: translations.physicalLimitationsEN,
      physicalLimitationsPL: translations.physicalLimitationsPL,

      emergencyTreatmentConsent: true,
      declaredByName: optionalTrimmedString(body.declaredByName),
      declaredByRut: optionalTrimmedString(body.declaredByRut),
      declaredByRole: optionalTrimmedString(body.declaredByRole) || 'APODERADO',
      declaredAt: new Date(),

      completionStatus: 'COMPLETED',
      lastUpdatedIp: clientIp,
    };

    const savedRecord = await prisma.$transaction(async (tx) => {
      const upserted = await tx.medicalRecord.upsert({
        where: { participantId: participant.id },
        create: {
          participantId: participant.id,
          ...medicalData,
        },
        update: medicalData,
      });

      const participantUpdates: {
        dietaryRestrictions?: string;
        medicalNotes?: string;
      } = {};

      if (
        dietaryRestrictionsES &&
        dietaryRestrictionsES !== (participant.dietaryRestrictions || '').trim()
      ) {
        participantUpdates.dietaryRestrictions = dietaryRestrictionsES;
      }

      if (allergiesES) {
        const nextMedicalNotes = `Alergias: ${allergiesES}`;
        if (nextMedicalNotes !== (participant.medicalNotes || '').trim()) {
          participantUpdates.medicalNotes = nextMedicalNotes;
        }
      }

      if (Object.keys(participantUpdates).length > 0) {
        await tx.participant.update({
          where: { id: participant.id },
          data: participantUpdates,
        });
      }

      return upserted;
    });

    const { qrEmergencyUrl, qrDataUrl } = await generateMedicalQr(
      req,
      savedRecord.qrAccessCode
    );

    return NextResponse.json({
      success: true,
      message: 'Ficha médica guardada y traducida exitosamente.',
      medicalRecord: savedRecord,
      qrEmergencyUrl,
      qrDataUrl,
    });
  } catch (error: unknown) {
    return apiErrorResponse(
      error,
      'Error interno al guardar la ficha médica',
      500
    );
  }
}
