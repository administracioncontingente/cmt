'use client';

import React, { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import {
  AlertTriangle,
  CheckCircle2,
  Droplet,
  ExternalLink,
  FileText,
  Globe,
  Heart,
  Loader2,
  Phone,
  Pill,
  Printer,
  Shield,
  ShieldCheck,
  Sparkles,
  Syringe,
  UserCheck,
} from 'lucide-react';
import { useToast } from '@/components/ui/ToastProvider';
import { cleanRut, formatRut, validateRut } from '@/lib/rut';
import type { MedicalRecordDTO, ParticipantDTO } from '@/types/domain';

export interface PortalMedicalFormProps {
  participant: ParticipantDTO;
  medicalRecord: MedicalRecordDTO | null;
  qrEmergencyUrl?: string | null;
  qrDataUrl?: string | null;
  onSaved: () => Promise<void> | void;
}

interface MedicalFormFields {
  bloodType: string;
  heightCm: string;
  weightKg: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  emergencyContactRelation: string;
  emergencyContactEmail: string;
  insuranceCompany: string;
  insurancePolicyNumber: string;
  insuranceEmergencyPhone: string;
  hasSevereAllergies: boolean;
  carriesEpiPen: boolean;
  allergiesES: string;
  hasChronicConditions: boolean;
  chronicConditionsES: string;
  takesRegularMedication: boolean;
  requiresColdChainMedication: boolean;
  currentMedicationsES: string;
  dietaryRestrictionsES: string;
  tetanusLastDoseYear: string;
  vaccinationRecordsES: string;
  pastSurgeriesInjuriesES: string;
  devicesImplantsES: string;
  physicalLimitationsES: string;
  emergencyTreatmentConsent: boolean;
  declaredByName: string;
  declaredByRut: string;
  declaredByRole: string;
}

interface SavePortalMedicalResponse {
  success?: boolean;
  medicalRecord?: MedicalRecordDTO;
  qrEmergencyUrl?: string | null;
  qrDataUrl?: string | null;
  error?: string;
}

const INPUT_CLASS =
  'w-full bg-white border border-slate-300 text-slate-800 placeholder-slate-400 focus:border-[#001558] focus:ring-2 focus:ring-[#FEB135]/50 focus:outline-none rounded-xl px-3.5 py-2.5 transition-all';

function formatDeterministicDate(value?: string | Date | null): string {
  if (!value) return 'No informada';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'No informada';
  return parsed.toLocaleDateString('es-CL');
}

function buildMedicalFields(
  participant: ParticipantDTO,
  medicalRecord: MedicalRecordDTO | null
): MedicalFormFields {
  const m = medicalRecord || ({} as Partial<MedicalRecordDTO>);
  return {
    bloodType: m.bloodType || 'O+',
    heightCm: m.heightCm !== null && m.heightCm !== undefined ? String(m.heightCm) : '',
    weightKg: m.weightKg !== null && m.weightKg !== undefined ? String(m.weightKg) : '',
    emergencyContactName: m.emergencyContactName || participant.guardianName || '',
    emergencyContactPhone: m.emergencyContactPhone || participant.guardianPhone || '',
    emergencyContactRelation:
      m.emergencyContactRelation || participant.guardianRelationship || '',
    emergencyContactEmail: m.emergencyContactEmail || participant.guardianEmail || '',
    insuranceCompany: m.insuranceCompany || '',
    insurancePolicyNumber: m.insurancePolicyNumber || '',
    insuranceEmergencyPhone: m.insuranceEmergencyPhone || '',
    hasSevereAllergies: Boolean(m.hasSevereAllergies),
    carriesEpiPen: Boolean(m.carriesEpiPen),
    allergiesES: m.allergiesES || participant.medicalNotes || '',
    hasChronicConditions: Boolean(m.hasChronicConditions),
    chronicConditionsES: m.chronicConditionsES || '',
    takesRegularMedication: Boolean(m.takesRegularMedication),
    requiresColdChainMedication: Boolean(m.requiresColdChainMedication),
    currentMedicationsES: m.currentMedicationsES || '',
    dietaryRestrictionsES:
      m.dietaryRestrictionsES || participant.dietaryRestrictions || '',
    tetanusLastDoseYear: m.tetanusLastDoseYear || '',
    vaccinationRecordsES: m.vaccinationRecordsES || '',
    pastSurgeriesInjuriesES: m.pastSurgeriesInjuriesES || '',
    devicesImplantsES: m.devicesImplantsES || '',
    physicalLimitationsES: m.physicalLimitationsES || '',
    emergencyTreatmentConsent: Boolean(m.emergencyTreatmentConsent),
    declaredByName: m.declaredByName || participant.guardianName || '',
    declaredByRut: m.declaredByRut || '',
    declaredByRole: m.declaredByRole || 'APODERADO',
  };
}

export function PortalMedicalForm({
  participant,
  medicalRecord,
  qrEmergencyUrl,
  qrDataUrl,
  onSaved,
}: PortalMedicalFormProps) {
  const { toast } = useToast();
  const errorBannerRef = useRef<HTMLDivElement | null>(null);

  const [activeLangTab, setActiveLangTab] = useState<'es' | 'en' | 'pl'>('es');
  const [fields, setFields] = useState<MedicalFormFields>(() =>
    buildMedicalFields(participant, medicalRecord)
  );
  const [localRecord, setLocalRecord] = useState<MedicalRecordDTO | null>(
    medicalRecord
  );
  const [localQrUrl, setLocalQrUrl] = useState<string | null>(
    qrEmergencyUrl ?? null
  );
  const [localQrDataUrl, setLocalQrDataUrl] = useState<string | null>(
    qrDataUrl ?? null
  );

  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function syncProps() {
      await Promise.resolve();
      if (cancelled) return;
      setFields(buildMedicalFields(participant, medicalRecord));
      setLocalRecord(medicalRecord);
      setLocalQrUrl(qrEmergencyUrl ?? null);
      setLocalQrDataUrl(qrDataUrl ?? null);
    }
    void syncProps();
    return () => {
      cancelled = true;
    };
  }, [participant, medicalRecord, qrEmergencyUrl, qrDataUrl]);

  const updateField = <K extends keyof MedicalFormFields>(
    key: K,
    value: MedicalFormFields[K]
  ) => {
    setFields((prev) => ({ ...prev, [key]: value }));
    setErrorMsg(null);
    setSuccessMsg(null);
  };

  const scrollToError = () => {
    requestAnimationFrame(() => {
      errorBannerRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    });
  };

  const effectiveRecord = localRecord || medicalRecord;
  const isCompleted =
    effectiveRecord?.completionStatus === 'COMPLETED' ||
    effectiveRecord?.completionStatus === 'VERIFIED';

  const resolvedQrHref =
    localQrUrl ||
    (effectiveRecord?.qrAccessCode
      ? `/medico/${effectiveRecord.qrAccessCode}`
      : null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!fields.emergencyTreatmentConsent) {
      const msg =
        'Debes marcar la autorización de tratamiento médico de emergencia para guardar la ficha médica.';
      setErrorMsg(msg);
      toast.error(msg, 'Consentimiento obligatorio');
      scrollToError();
      return;
    }

    if (fields.declaredByRut.trim()) {
      const cleanedDeclarantRut = cleanRut(fields.declaredByRut);
      if (!validateRut(cleanedDeclarantRut)) {
        const msg =
          'El RUT del declarante ingresado no es válido. Verifica el dígito verificador.';
        setErrorMsg(msg);
        toast.error(msg, 'RUT inválido');
        scrollToError();
        return;
      }
    }

    try {
      setSaving(true);
      const res = await fetch('/api/portal/medical', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bloodType: fields.bloodType,
          heightCm: fields.heightCm,
          weightKg: fields.weightKg,
          emergencyContactName: fields.emergencyContactName.trim(),
          emergencyContactPhone: fields.emergencyContactPhone.trim(),
          emergencyContactRelation: fields.emergencyContactRelation.trim(),
          emergencyContactEmail: fields.emergencyContactEmail.trim(),
          insuranceCompany: fields.insuranceCompany.trim(),
          insurancePolicyNumber: fields.insurancePolicyNumber.trim(),
          insuranceEmergencyPhone: fields.insuranceEmergencyPhone.trim(),
          hasSevereAllergies: fields.hasSevereAllergies,
          carriesEpiPen: fields.carriesEpiPen,
          allergiesES: fields.allergiesES.trim(),
          hasChronicConditions: fields.hasChronicConditions,
          chronicConditionsES: fields.chronicConditionsES.trim(),
          takesRegularMedication: fields.takesRegularMedication,
          requiresColdChainMedication: fields.requiresColdChainMedication,
          currentMedicationsES: fields.currentMedicationsES.trim(),
          dietaryRestrictionsES: fields.dietaryRestrictionsES.trim(),
          tetanusLastDoseYear: fields.tetanusLastDoseYear.trim(),
          vaccinationRecordsES: fields.vaccinationRecordsES.trim(),
          pastSurgeriesInjuriesES: fields.pastSurgeriesInjuriesES.trim(),
          devicesImplantsES: fields.devicesImplantsES.trim(),
          physicalLimitationsES: fields.physicalLimitationsES.trim(),
          emergencyTreatmentConsent: fields.emergencyTreatmentConsent,
          declaredByName: fields.declaredByName.trim(),
          declaredByRut: fields.declaredByRut.trim()
            ? formatRut(cleanRut(fields.declaredByRut))
            : '',
          declaredByRole: fields.declaredByRole,
        }),
      });

      const data = (await res.json().catch(() => ({}))) as SavePortalMedicalResponse;
      if (!res.ok) {
        throw new Error(data.error || 'No se pudo guardar la ficha médica');
      }

      if (data.medicalRecord) {
        setLocalRecord(data.medicalRecord);
      }
      if (data.qrEmergencyUrl !== undefined) {
        setLocalQrUrl(data.qrEmergencyUrl);
      }
      if (data.qrDataUrl !== undefined) {
        setLocalQrDataUrl(data.qrDataUrl);
      }

      setSuccessMsg(
        'Ficha médica guardada y traducida automáticamente al inglés y polaco.'
      );
      toast.success(
        'Ficha médica actualizada y traducida al inglés y polaco.',
        'Ficha guardada'
      );
      await onSaved();
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : 'Error al guardar ficha médica';
      setErrorMsg(msg);
      toast.error(msg, 'Error al guardar');
      scrollToError();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Cabecera participante + QR de emergencia */}
      <section className="bg-white border border-slate-200 border-t-4 border-t-[#001558] rounded-3xl p-5 sm:p-6 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-5">
        <div className="space-y-2 w-full">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xl font-black text-[#001558]">
              {participant.firstName} {participant.lastName}{' '}
              {participant.secondLastName || ''}
            </h2>
            {participant.cupoCode && (
              <span className="px-2.5 py-0.5 rounded-lg bg-[#FFF8E1] border border-[#FEB135] text-[#001558] text-xs font-mono font-bold">
                Cupo: {participant.cupoCode}
              </span>
            )}
            <span
              className={`px-2.5 py-0.5 rounded-full text-[11px] font-extrabold border ${
                isCompleted
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                  : 'bg-amber-50 text-amber-800 border-amber-200'
              }`}
            >
              {isCompleted
                ? 'Completada y Traducida'
                : 'Pendiente de Completar'}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs text-slate-600 pt-1">
            <div>
              <span className="text-slate-400 text-[10px] block uppercase font-bold">
                RUT
              </span>
              <span className="font-mono font-bold text-[#001558]">
                {participant.rut}
              </span>
            </div>
            <div>
              <span className="text-slate-400 text-[10px] block uppercase font-bold">
                Fecha Nacimiento
              </span>
              <span className="font-medium text-slate-800">
                {formatDeterministicDate(participant.birthDate)}
              </span>
            </div>
            <div>
              <span className="text-slate-400 text-[10px] block uppercase font-bold">
                Grupo Scout
              </span>
              <span className="font-medium text-slate-800">
                {participant.scoutGroup || 'No registrado'}
              </span>
            </div>
            <div>
              <span className="text-slate-400 text-[10px] block uppercase font-bold">
                Grupo Sanguíneo
              </span>
              <span className="font-black text-red-700">
                {effectiveRecord?.bloodType || fields.bloodType || 'N/R'}
              </span>
            </div>
          </div>
        </div>

        {(localQrDataUrl || resolvedQrHref) && (
          <div className="flex items-center gap-3 bg-[#F5F6F8] p-3.5 rounded-2xl border border-slate-200 shrink-0 w-full md:w-auto">
            {localQrDataUrl && (
              <div className="p-1.5 bg-white rounded-xl border border-slate-200 shrink-0">
                <Image
                  src={localQrDataUrl}
                  alt="Código QR Médico de Emergencia"
                  width={80}
                  height={80}
                  unoptimized
                  className="w-20 h-20"
                />
              </div>
            )}
            <div className="text-left text-xs space-y-1">
              <span className="font-black text-[#001558] block text-[11px]">
                QR de Emergencia
              </span>
              <p className="text-[10px] text-slate-600 max-w-[155px]">
                Acceso multilingüe directo para equipos de salud y emergencias
              </p>
              {resolvedQrHref && (
                <a
                  href={resolvedQrHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[11px] text-[#001558] font-extrabold hover:underline print:hidden"
                >
                  <ExternalLink className="w-3 h-3" />
                  Abrir tarjeta QR
                </a>
              )}
            </div>
          </div>
        )}
      </section>

      {successMsg && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs flex items-center justify-between gap-2 font-bold">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span>{successMsg}</span>
          </div>
          <button
            type="button"
            onClick={() => setSuccessMsg(null)}
            aria-label="Cerrar aviso"
            className="text-emerald-700 hover:text-emerald-950 font-black cursor-pointer px-1"
          >
            ✕
          </button>
        </div>
      )}

      {errorMsg && (
        <div
          ref={errorBannerRef}
          role="alert"
          className="p-4 rounded-2xl bg-red-50 border border-red-200 text-red-800 text-xs flex items-center justify-between gap-2 font-semibold"
        >
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
            <span>{errorMsg}</span>
          </div>
          <button
            type="button"
            onClick={() => setErrorMsg(null)}
            aria-label="Cerrar alerta"
            className="text-red-700 hover:text-red-950 font-black cursor-pointer px-1"
          >
            ✕
          </button>
        </div>
      )}

      {/* Selector de pestañas trilingüe + Imprimir */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3 print:hidden">
        <div
          role="tablist"
          aria-label="Idioma de la ficha médica"
          className="flex flex-wrap bg-white border border-slate-200 rounded-xl p-1 text-xs font-bold shadow-2xs"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeLangTab === 'es'}
            onClick={() => setActiveLangTab('es')}
            className={`px-4 py-2 rounded-lg transition-all cursor-pointer ${
              activeLangTab === 'es'
                ? 'bg-[#001558] text-white font-black shadow-xs'
                : 'text-slate-600 hover:text-[#001558]'
            }`}
          >
            🇨🇱 Español Editable
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeLangTab === 'en'}
            onClick={() => setActiveLangTab('en')}
            className={`px-4 py-2 rounded-lg transition-all cursor-pointer ${
              activeLangTab === 'en'
                ? 'bg-[#001558] text-white font-black shadow-xs'
                : 'text-slate-600 hover:text-[#001558]'
            }`}
          >
            🇬🇧 English
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeLangTab === 'pl'}
            onClick={() => setActiveLangTab('pl')}
            className={`px-4 py-2 rounded-lg transition-all cursor-pointer ${
              activeLangTab === 'pl'
                ? 'bg-[#001558] text-white font-black shadow-xs'
                : 'text-slate-600 hover:text-[#001558]'
            }`}
          >
            🇵🇱 Polski
          </button>
        </div>

        <button
          type="button"
          onClick={() => window.print()}
          className="px-3.5 py-2 rounded-xl bg-white border border-slate-300 hover:border-[#001558] text-[#001558] text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
        >
          <Printer className="w-3.5 h-3.5" />
          Imprimir Ficha
        </button>
      </div>

      {/* Vista en Inglés o Polaco */}
      {activeLangTab !== 'es' && (
        <section className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-200">
            <div className="flex items-center gap-2 text-xs font-black text-[#001558]">
              <Globe className="w-4 h-4 text-[#FEB135]" />
              <span>
                {activeLangTab === 'en'
                  ? 'OFFICIAL AGSCH ENGLISH MEDICAL REPORT'
                  : 'OFICJALNA KARTA MEDYCZNA AGSCH W JĘZYKU POLSKIM'}
              </span>
            </div>
            <span className="text-[11px] text-slate-500">
              Traducción clínica automática generada al guardar la ficha en
              español
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div className="bg-red-50 border border-red-200 rounded-2xl p-3.5">
              <span className="text-[10px] font-black uppercase text-red-700 block">
                {activeLangTab === 'en'
                  ? 'Blood Type / Biometrics'
                  : 'Grupa Krwi / Biometria'}
              </span>
              <p className="font-black text-red-800 text-base mt-0.5">
                {effectiveRecord?.bloodType || 'N/R'}
              </p>
              <p className="text-[11px] text-slate-700 mt-0.5">
                {effectiveRecord?.heightCm
                  ? `${effectiveRecord.heightCm} cm`
                  : 'N/R'}{' '}
                •{' '}
                {effectiveRecord?.weightKg
                  ? `${effectiveRecord.weightKg} kg`
                  : 'N/R'}
              </p>
            </div>

            <div className="bg-[#F5F6F8] border border-slate-200 rounded-2xl p-3.5">
              <span className="text-[10px] font-black uppercase text-[#001558] block">
                {activeLangTab === 'en'
                  ? 'Emergency Contact'
                  : 'Kontakt Alarmowy'}
              </span>
              <p className="font-bold text-[#001558] mt-0.5">
                {effectiveRecord?.emergencyContactName ||
                  participant.guardianName ||
                  'N/R'}
              </p>
              <p className="font-mono text-[11px] text-slate-700">
                {effectiveRecord?.emergencyContactPhone ||
                  participant.guardianPhone ||
                  'N/R'}
              </p>
            </div>

            <div className="bg-[#F5F6F8] border border-slate-200 rounded-2xl p-3.5">
              <span className="text-[10px] font-black uppercase text-[#001558] block">
                {activeLangTab === 'en'
                  ? 'Travel Insurance'
                  : 'Ubezpieczenie Podróżne'}
              </span>
              <p className="font-bold text-[#001558] mt-0.5">
                {effectiveRecord?.insuranceCompany || 'N/R'}
              </p>
              <p className="font-mono text-[11px] text-slate-700">
                {effectiveRecord?.insurancePolicyNumber || 'N/R'}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="bg-[#F5F6F8] p-4 rounded-2xl border border-slate-200 space-y-1">
              <span className="text-[10px] font-bold text-red-700 uppercase tracking-wider">
                {activeLangTab === 'en'
                  ? 'Allergies & Anaphylaxis Risk'
                  : 'Alergie i Ryzyko Anafilaksji'}
              </span>
              <p className="text-slate-800 font-medium">
                {activeLangTab === 'en'
                  ? effectiveRecord?.allergiesEN ||
                    'No known allergies reported'
                  : effectiveRecord?.allergiesPL || 'Brak zgłoszonych alergii'}
              </p>
              {effectiveRecord?.carriesEpiPen && (
                <span className="inline-block mt-1 px-2 py-0.5 rounded bg-red-100 text-red-800 font-bold text-[10px]">
                  {activeLangTab === 'en'
                    ? 'Carries EpiPen'
                    : 'Posiada EpiPen'}
                </span>
              )}
            </div>

            <div className="bg-[#F5F6F8] p-4 rounded-2xl border border-slate-200 space-y-1">
              <span className="text-[10px] font-bold text-[#001558] uppercase tracking-wider">
                {activeLangTab === 'en'
                  ? 'Chronic Medical Conditions'
                  : 'Choroby Przewlekłe'}
              </span>
              <p className="text-slate-800 font-medium">
                {activeLangTab === 'en'
                  ? effectiveRecord?.chronicConditionsEN || 'None reported'
                  : effectiveRecord?.chronicConditionsPL || 'Brak zgłoszonych'}
              </p>
            </div>

            <div className="bg-[#F5F6F8] p-4 rounded-2xl border border-slate-200 space-y-1">
              <span className="text-[10px] font-bold text-[#001558] uppercase tracking-wider">
                {activeLangTab === 'en'
                  ? 'Current Medications'
                  : 'Aktualnie Przyjmowane Leki'}
              </span>
              <p className="text-slate-800 font-medium">
                {activeLangTab === 'en'
                  ? effectiveRecord?.currentMedicationsEN || 'None'
                  : effectiveRecord?.currentMedicationsPL || 'Brak'}
              </p>
              {effectiveRecord?.requiresColdChainMedication && (
                <span className="inline-block mt-1 px-2 py-0.5 rounded bg-sky-100 text-sky-900 font-bold text-[10px]">
                  {activeLangTab === 'en'
                    ? 'Cold chain (2-8°C) required'
                    : 'Wymaga chłodzenia (2-8°C)'}
                </span>
              )}
            </div>

            <div className="bg-[#F5F6F8] p-4 rounded-2xl border border-slate-200 space-y-1">
              <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider">
                {activeLangTab === 'en'
                  ? 'Dietary Restrictions'
                  : 'Ograniczenia Dietetyczne'}
              </span>
              <p className="text-slate-800 font-medium">
                {activeLangTab === 'en'
                  ? effectiveRecord?.dietaryRestrictionsEN || 'Standard diet'
                  : effectiveRecord?.dietaryRestrictionsPL ||
                    'Dieta standardowa'}
              </p>
            </div>

            <div className="bg-[#F5F6F8] p-4 rounded-2xl border border-slate-200 space-y-1">
              <span className="text-[10px] font-bold text-[#001558] uppercase tracking-wider">
                {activeLangTab === 'en'
                  ? 'Vaccination History'
                  : 'Szczepienia'}
              </span>
              <p className="text-slate-800 font-medium">
                {activeLangTab === 'en'
                  ? effectiveRecord?.vaccinationRecordsEN || 'Up to date'
                  : effectiveRecord?.vaccinationRecordsPL || 'Aktualne'}
              </p>
            </div>

            <div className="bg-[#F5F6F8] p-4 rounded-2xl border border-slate-200 space-y-1">
              <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">
                {activeLangTab === 'en'
                  ? 'Past Surgeries & Trauma'
                  : 'Przebyte Operacje i Urazy'}
              </span>
              <p className="text-slate-800 font-medium">
                {activeLangTab === 'en'
                  ? effectiveRecord?.pastSurgeriesInjuriesEN || 'None reported'
                  : effectiveRecord?.pastSurgeriesInjuriesPL || 'Brak'}
              </p>
            </div>

            <div className="bg-[#F5F6F8] p-4 rounded-2xl border border-slate-200 space-y-1">
              <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">
                {activeLangTab === 'en'
                  ? 'Medical Devices & Implants'
                  : 'Urządzenia Medyczne'}
              </span>
              <p className="text-slate-800 font-medium">
                {activeLangTab === 'en'
                  ? effectiveRecord?.devicesImplantsEN || 'None'
                  : effectiveRecord?.devicesImplantsPL || 'Brak'}
              </p>
            </div>

            <div className="bg-[#F5F6F8] p-4 rounded-2xl border border-slate-200 space-y-1">
              <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">
                {activeLangTab === 'en'
                  ? 'Physical & Water Activity Limitations'
                  : 'Ograniczenia Aktywności'}
              </span>
              <p className="text-slate-800 font-medium">
                {activeLangTab === 'en'
                  ? effectiveRecord?.physicalLimitationsEN || 'Full capacity'
                  : effectiveRecord?.physicalLimitationsPL || 'Pełna zdolność'}
              </p>
            </div>
          </div>

          <div className="text-center pt-2 print:hidden">
            <button
              type="button"
              onClick={() => setActiveLangTab('es')}
              className="text-xs text-[#001558] underline font-bold cursor-pointer"
            >
              ← Modificar datos en la pestaña Español para regenerar las
              traducciones
            </button>
          </div>
        </section>
      )}

      {/* Formulario en Español */}
      {activeLangTab === 'es' && (
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* 1. Biometría y Grupo Sanguíneo */}
          <section className="bg-white border border-slate-200 rounded-3xl p-5 sm:p-6 shadow-xs space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-200 text-[#001558] font-black text-xs uppercase tracking-wider">
              <Droplet className="w-4 h-4 text-red-600" />
              <span>1. Grupo Sanguíneo y Datos Biométricos</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
              <div>
                <label
                  htmlFor="med-blood-type"
                  className="block text-slate-700 font-bold mb-1"
                >
                  Grupo Sanguíneo / Factor Rh *
                </label>
                <select
                  id="med-blood-type"
                  value={fields.bloodType}
                  onChange={(e) => updateField('bloodType', e.target.value)}
                  className={`${INPUT_CLASS} font-bold`}
                >
                  <option value="O+">O Rh+ (O Positivo)</option>
                  <option value="O-">O Rh- (O Negativo)</option>
                  <option value="A+">A Rh+ (A Positivo)</option>
                  <option value="A-">A Rh- (A Negativo)</option>
                  <option value="B+">B Rh+ (B Positivo)</option>
                  <option value="B-">B Rh- (B Negativo)</option>
                  <option value="AB+">AB Rh+ (AB Positivo)</option>
                  <option value="AB-">AB Rh- (AB Negativo)</option>
                  <option value="DESCONOCIDO">Desconocido / No informado</option>
                </select>
              </div>

              <div>
                <label
                  htmlFor="med-height"
                  className="block text-slate-700 font-bold mb-1"
                >
                  Estatura (cm)
                </label>
                <input
                  id="med-height"
                  type="number"
                  min="40"
                  max="250"
                  placeholder="Ej: 168"
                  value={fields.heightCm}
                  onChange={(e) => updateField('heightCm', e.target.value)}
                  className={`${INPUT_CLASS} font-mono`}
                />
              </div>

              <div>
                <label
                  htmlFor="med-weight"
                  className="block text-slate-700 font-bold mb-1"
                >
                  Peso (kg)
                </label>
                <input
                  id="med-weight"
                  type="number"
                  min="10"
                  max="250"
                  step="0.1"
                  placeholder="Ej: 62"
                  value={fields.weightKg}
                  onChange={(e) => updateField('weightKg', e.target.value)}
                  className={`${INPUT_CLASS} font-mono`}
                />
              </div>
            </div>
          </section>

          {/* 2. Contacto de Emergencia */}
          <section className="bg-white border border-slate-200 rounded-3xl p-5 sm:p-6 shadow-xs space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-200 text-[#001558] font-black text-xs uppercase tracking-wider">
              <Phone className="w-4 h-4 text-[#FEB135]" />
              <span>2. Contacto de Emergencia (Apoderado / Familiar Directo)</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
              <div>
                <label
                  htmlFor="med-emg-name"
                  className="block text-slate-700 font-bold mb-1"
                >
                  Nombre Completo *
                </label>
                <input
                  id="med-emg-name"
                  type="text"
                  required
                  value={fields.emergencyContactName}
                  onChange={(e) =>
                    updateField('emergencyContactName', e.target.value)
                  }
                  className={INPUT_CLASS}
                />
              </div>

              <div>
                <label
                  htmlFor="med-emg-rel"
                  className="block text-slate-700 font-bold mb-1"
                >
                  Parentesco / Relación *
                </label>
                <input
                  id="med-emg-rel"
                  type="text"
                  required
                  placeholder="Madre, Padre, Cónyuge..."
                  value={fields.emergencyContactRelation}
                  onChange={(e) =>
                    updateField('emergencyContactRelation', e.target.value)
                  }
                  className={INPUT_CLASS}
                />
              </div>

              <div>
                <label
                  htmlFor="med-emg-phone"
                  className="block text-slate-700 font-bold mb-1"
                >
                  Teléfono con código país *
                </label>
                <input
                  id="med-emg-phone"
                  type="tel"
                  required
                  placeholder="+56 9 1234 5678"
                  value={fields.emergencyContactPhone}
                  onChange={(e) =>
                    updateField('emergencyContactPhone', e.target.value)
                  }
                  className={`${INPUT_CLASS} font-mono`}
                />
              </div>

              <div>
                <label
                  htmlFor="med-emg-email"
                  className="block text-slate-700 font-bold mb-1"
                >
                  Correo Electrónico *
                </label>
                <input
                  id="med-emg-email"
                  type="email"
                  required
                  value={fields.emergencyContactEmail}
                  onChange={(e) =>
                    updateField('emergencyContactEmail', e.target.value)
                  }
                  className={INPUT_CLASS}
                />
              </div>
            </div>
          </section>

          {/* 3. Seguro de Viaje */}
          <section className="bg-white border border-slate-200 rounded-3xl p-5 sm:p-6 shadow-xs space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-200 text-[#001558] font-black text-xs uppercase tracking-wider">
              <ShieldCheck className="w-4 h-4 text-[#FEB135]" />
              <span>3. Seguro de Asistencia en Viaje / Cobertura Médica</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
              <div>
                <label
                  htmlFor="med-ins-company"
                  className="block text-slate-700 font-bold mb-1"
                >
                  Aseguradora / Convenio
                </label>
                <input
                  id="med-ins-company"
                  type="text"
                  placeholder="Ej: Seguro de Asistencia del Evento"
                  value={fields.insuranceCompany}
                  onChange={(e) =>
                    updateField('insuranceCompany', e.target.value)
                  }
                  className={INPUT_CLASS}
                />
              </div>

              <div>
                <label
                  htmlFor="med-ins-policy"
                  className="block text-slate-700 font-bold mb-1"
                >
                  N° de Póliza (si aplica)
                </label>
                <input
                  id="med-ins-policy"
                  type="text"
                  placeholder="Póliza Grupal AGSCH o particular"
                  value={fields.insurancePolicyNumber}
                  onChange={(e) =>
                    updateField('insurancePolicyNumber', e.target.value)
                  }
                  className={`${INPUT_CLASS} font-mono`}
                />
              </div>

              <div>
                <label
                  htmlFor="med-ins-phone"
                  className="block text-slate-700 font-bold mb-1"
                >
                  Teléfono de Asistencia 24/7
                </label>
                <input
                  id="med-ins-phone"
                  type="tel"
                  placeholder="+56 2 ..."
                  value={fields.insuranceEmergencyPhone}
                  onChange={(e) =>
                    updateField('insuranceEmergencyPhone', e.target.value)
                  }
                  className={`${INPUT_CLASS} font-mono`}
                />
              </div>
            </div>
          </section>

          {/* 4. Alergias */}
          <section className="bg-white border border-slate-200 rounded-3xl p-5 sm:p-6 shadow-xs space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-200">
              <div className="flex items-center gap-2 text-red-700 font-black text-xs uppercase tracking-wider">
                <AlertTriangle className="w-4 h-4 text-red-600" />
                <span>4. Alergias a Medicamentos, Alimentos o Picaduras</span>
              </div>

              <div className="flex flex-wrap items-center gap-4 text-xs">
                <label className="flex items-center gap-2 cursor-pointer text-red-700 font-bold">
                  <input
                    type="checkbox"
                    checked={fields.hasSevereAllergies}
                    onChange={(e) =>
                      updateField('hasSevereAllergies', e.target.checked)
                    }
                    className="w-4 h-4 accent-red-600 rounded"
                  />
                  <span>Riesgo de Anafilaxia / Alergia Severa</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer text-[#001558] font-bold">
                  <input
                    type="checkbox"
                    checked={fields.carriesEpiPen}
                    onChange={(e) =>
                      updateField('carriesEpiPen', e.target.checked)
                    }
                    className="w-4 h-4 accent-[#001558] rounded"
                  />
                  <span>Porta Autoinyector de Epinefrina (EpiPen)</span>
                </label>
              </div>
            </div>

            <div className="text-xs space-y-1.5">
              <label
                htmlFor="med-allergies"
                className="block text-slate-700 font-bold"
              >
                Detalle de Alergias
              </label>
              <textarea
                id="med-allergies"
                rows={2}
                placeholder='Ej: Penicilina, picadura de avispa, maní... Si no tiene alergias escribe "Ninguna conocida".'
                value={fields.allergiesES}
                onChange={(e) => updateField('allergiesES', e.target.value)}
                className={INPUT_CLASS}
              />
            </div>
          </section>

          {/* 5. Condiciones Crónicas */}
          <section className="bg-white border border-slate-200 rounded-3xl p-5 sm:p-6 shadow-xs space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-200">
              <div className="flex items-center gap-2 text-[#001558] font-black text-xs uppercase tracking-wider">
                <Heart className="w-4 h-4 text-[#FEB135]" />
                <span>5. Condiciones Médicas Crónicas</span>
              </div>

              <label className="flex items-center gap-2 cursor-pointer text-[#001558] text-xs font-bold">
                <input
                  type="checkbox"
                  checked={fields.hasChronicConditions}
                  onChange={(e) =>
                    updateField('hasChronicConditions', e.target.checked)
                  }
                  className="w-4 h-4 accent-[#001558] rounded"
                />
                <span>Tiene diagnósticos crónicos</span>
              </label>
            </div>

            <div className="text-xs space-y-1.5">
              <label
                htmlFor="med-chronic"
                className="block text-slate-700 font-bold"
              >
                Detalle de Diagnósticos Crónicos
              </label>
              <textarea
                id="med-chronic"
                rows={2}
                placeholder="Ej: Asma bronquial, diabetes tipo 1, epilepsia, celiaquía..."
                value={fields.chronicConditionsES}
                onChange={(e) =>
                  updateField('chronicConditionsES', e.target.value)
                }
                className={INPUT_CLASS}
              />
            </div>
          </section>

          {/* 6. Medicamentos y Cadena de Frío */}
          <section className="bg-white border border-slate-200 rounded-3xl p-5 sm:p-6 shadow-xs space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-200">
              <div className="flex items-center gap-2 text-[#001558] font-black text-xs uppercase tracking-wider">
                <Pill className="w-4 h-4 text-indigo-600" />
                <span>6. Medicamentos Habituales / Uso Continuo</span>
              </div>

              <div className="flex flex-wrap items-center gap-4 text-xs">
                <label className="flex items-center gap-2 cursor-pointer text-slate-700 font-bold">
                  <input
                    type="checkbox"
                    checked={fields.takesRegularMedication}
                    onChange={(e) =>
                      updateField('takesRegularMedication', e.target.checked)
                    }
                    className="w-4 h-4 accent-[#001558] rounded"
                  />
                  <span>Toma fármacos diariamente</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer text-[#001558] font-bold">
                  <input
                    type="checkbox"
                    checked={fields.requiresColdChainMedication}
                    onChange={(e) =>
                      updateField(
                        'requiresColdChainMedication',
                        e.target.checked
                      )
                    }
                    className="w-4 h-4 accent-[#001558] rounded"
                  />
                  <span>Requiere Cadena de Frío (2-8°C)</span>
                </label>
              </div>
            </div>

            <div className="text-xs space-y-1.5">
              <label
                htmlFor="med-medications"
                className="block text-slate-700 font-bold"
              >
                Medicamentos, Dosis y Frecuencia
              </label>
              <textarea
                id="med-medications"
                rows={2}
                placeholder="Principio activo, dosis exacta, horario y autonomía de administración..."
                value={fields.currentMedicationsES}
                onChange={(e) =>
                  updateField('currentMedicationsES', e.target.value)
                }
                className={INPUT_CLASS}
              />
            </div>
          </section>

          {/* 7. Dieta */}
          <section className="bg-white border border-slate-200 rounded-3xl p-5 sm:p-6 shadow-xs space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-200 text-[#001558] font-black text-xs uppercase tracking-wider">
              <FileText className="w-4 h-4 text-emerald-600" />
              <span>7. Régimen Alimentario / Intolerancias</span>
            </div>

            <div className="text-xs space-y-2">
              <label htmlFor="med-diet" className="sr-only">
                Régimen alimentario
              </label>
              <input
                id="med-diet"
                type="text"
                placeholder="Ej: Vegetariano, Vegano, Celíaco estricto, Sin lactosa..."
                value={fields.dietaryRestrictionsES}
                onChange={(e) =>
                  updateField('dietaryRestrictionsES', e.target.value)
                }
                className={INPUT_CLASS}
              />
              <div className="flex flex-wrap gap-2 pt-1 print:hidden">
                {[
                  'Vegetariano',
                  'Vegano',
                  'Sin gluten (Celíaco)',
                  'Sin lactosa',
                  'Dieta normal',
                ].map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => updateField('dietaryRestrictionsES', opt)}
                    className="px-2.5 py-1 rounded-lg bg-[#F5F6F8] border border-slate-200 hover:border-[#001558] text-[11px] text-[#001558] font-semibold cursor-pointer transition-colors"
                  >
                    + {opt}
                  </button>
                ))}
              </div>
            </div>
          </section>

          {/* 8. Vacunas */}
          <section className="bg-white border border-slate-200 rounded-3xl p-5 sm:p-6 shadow-xs space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-200 text-[#001558] font-black text-xs uppercase tracking-wider">
              <Syringe className="w-4 h-4 text-sky-600" />
              <span>8. Vacunación e Inmunizaciones</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
              <div>
                <label
                  htmlFor="med-tetanus"
                  className="block text-slate-700 font-bold mb-1"
                >
                  Año Última Dosis Antitetánica *
                </label>
                <input
                  id="med-tetanus"
                  type="text"
                  required
                  placeholder="Ej: 2024"
                  value={fields.tetanusLastDoseYear}
                  onChange={(e) =>
                    updateField('tetanusLastDoseYear', e.target.value)
                  }
                  className={`${INPUT_CLASS} font-mono`}
                />
              </div>

              <div className="sm:col-span-2">
                <label
                  htmlFor="med-vaccines"
                  className="block text-slate-700 font-bold mb-1"
                >
                  Registro de Vacunas Relevantes
                </label>
                <input
                  id="med-vaccines"
                  type="text"
                  placeholder="Ej: Calendario nacional al día, Hepatitis A/B, MMR..."
                  value={fields.vaccinationRecordsES}
                  onChange={(e) =>
                    updateField('vaccinationRecordsES', e.target.value)
                  }
                  className={INPUT_CLASS}
                />
              </div>
            </div>
          </section>

          {/* 9. Cirugías, Dispositivos y Limitaciones */}
          <section className="bg-white border border-slate-200 rounded-3xl p-5 sm:p-6 shadow-xs space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-200 text-[#001558] font-black text-xs uppercase tracking-wider">
              <UserCheck className="w-4 h-4 text-[#001558]" />
              <span>
                9. Cirugías Previas, Dispositivos y Limitaciones Físicas
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
              <div>
                <label
                  htmlFor="med-surgeries"
                  className="block text-slate-700 font-bold mb-1"
                >
                  Cirugías / Traumas
                </label>
                <textarea
                  id="med-surgeries"
                  rows={2}
                  placeholder="Ej: Apendicectomía (2022)..."
                  value={fields.pastSurgeriesInjuriesES}
                  onChange={(e) =>
                    updateField('pastSurgeriesInjuriesES', e.target.value)
                  }
                  className={INPUT_CLASS}
                />
              </div>

              <div>
                <label
                  htmlFor="med-devices"
                  className="block text-slate-700 font-bold mb-1"
                >
                  Dispositivos Médicos
                </label>
                <textarea
                  id="med-devices"
                  rows={2}
                  placeholder="Ej: Lentes ópticos, frenillos, aparato auditivo..."
                  value={fields.devicesImplantsES}
                  onChange={(e) =>
                    updateField('devicesImplantsES', e.target.value)
                  }
                  className={INPUT_CLASS}
                />
              </div>

              <div>
                <label
                  htmlFor="med-limitations"
                  className="block text-slate-700 font-bold mb-1"
                >
                  Capacidad Física y Natación
                </label>
                <textarea
                  id="med-limitations"
                  rows={2}
                  placeholder="Ej: Sabe nadar bien, sin restricciones..."
                  value={fields.physicalLimitationsES}
                  onChange={(e) =>
                    updateField('physicalLimitationsES', e.target.value)
                  }
                  className={INPUT_CLASS}
                />
              </div>
            </div>
          </section>

          {/* 10. Consentimiento */}
          <section className="bg-[#FFFBF0] border border-[#FEB135]/60 border-l-4 border-l-[#FEB135] rounded-3xl p-5 sm:p-6 shadow-xs space-y-4 text-[#001558]">
            <div className="flex items-center gap-2 font-black text-xs sm:text-sm uppercase tracking-wider">
              <Shield className="w-5 h-5 text-[#FEB135]" />
              <span>
                10. Declaración y Autorización de Tratamiento Médico de
                Emergencia
              </span>
            </div>

            <p className="text-xs text-slate-700 leading-relaxed">
              Autorizo expresamente al equipo médico de la Asociación de Guías y
              Scouts de Chile, al personal de salud de la organización del evento
              y a los centros asistenciales correspondientes a suministrar
              primeros auxilios, medicamentos de urgencia, traslados o
              atenciones médicas de emergencia en caso de ser estrictamente
              necesario para resguardar la vida o salud del participante.
            </p>

            <label className="flex items-start gap-3 p-3.5 rounded-xl bg-white border border-slate-200 cursor-pointer text-xs font-bold text-[#001558]">
              <input
                type="checkbox"
                checked={fields.emergencyTreatmentConsent}
                onChange={(e) =>
                  updateField('emergencyTreatmentConsent', e.target.checked)
                }
                className="w-5 h-5 accent-[#001558] rounded mt-0.5 shrink-0"
              />
              <span>
                Declaro bajo fe jurada que los antecedentes médicos ingresados
                son verídicos, completos y actualizados. Autorizo el tratamiento
                médico de emergencia durante el evento. *
              </span>
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs pt-1">
              <div>
                <label
                  htmlFor="med-declared-name"
                  className="block text-[#001558] font-bold mb-1"
                >
                  Nombre del Declarante *
                </label>
                <input
                  id="med-declared-name"
                  type="text"
                  required
                  value={fields.declaredByName}
                  onChange={(e) =>
                    updateField('declaredByName', e.target.value)
                  }
                  className={INPUT_CLASS}
                />
              </div>

              <div>
                <label
                  htmlFor="med-declared-rut"
                  className="block text-[#001558] font-bold mb-1"
                >
                  RUT del Declarante *
                </label>
                <input
                  id="med-declared-rut"
                  type="text"
                  required
                  placeholder="Ej: 12.345.678-9"
                  value={fields.declaredByRut}
                  onChange={(e) => updateField('declaredByRut', e.target.value)}
                  onBlur={() => {
                    if (fields.declaredByRut.trim()) {
                      updateField(
                        'declaredByRut',
                        formatRut(fields.declaredByRut)
                      );
                    }
                  }}
                  className={`${INPUT_CLASS} font-mono`}
                />
              </div>

              <div>
                <label
                  htmlFor="med-declared-role"
                  className="block text-[#001558] font-bold mb-1"
                >
                  Calidad del Declarante *
                </label>
                <select
                  id="med-declared-role"
                  value={fields.declaredByRole}
                  onChange={(e) =>
                    updateField('declaredByRole', e.target.value)
                  }
                  className={`${INPUT_CLASS} font-bold`}
                >
                  <option value="APODERADO">Apoderado / Padre / Madre</option>
                  <option value="PARTICIPANTE_ADULTO">
                    Participante Mayor de Edad (IST / Dirigente / CMT)
                  </option>
                </select>
              </div>
            </div>
          </section>

          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 print:hidden">
            <p className="text-[11px] text-slate-600">
              Al guardar, la ficha se traducirá automáticamente al inglés y
              polaco y actualizará el acceso QR de emergencia.
            </p>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-[#FEB135] hover:bg-[#e59c22] text-[#001558] font-black text-xs uppercase tracking-wider shadow-md disabled:opacity-50 cursor-pointer transition-all shrink-0"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Guardando y Traduciendo...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Guardar y Traducir Ficha Médica
                </>
              )}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
