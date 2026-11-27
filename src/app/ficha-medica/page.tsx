'use client';

import React, { useRef, useState } from 'react';
import Image from 'next/image';
import { useParams } from 'next/navigation';
import {
  Shield,
  Heart,
  Droplet,
  AlertTriangle,
  Pill,
  Syringe,
  FileText,
  UserCheck,
  CheckCircle2,
  Lock,
  Mail,
  Send,
  Loader2,
  ExternalLink,
  Printer,
  Sparkles,
  Phone,
  Globe,
  ShieldCheck,
} from 'lucide-react';
import { formatRut, cleanRut, validateRut } from '@/lib/rut';
import { useToast } from '@/components/ui/ToastProvider';
import type { ParticipantDTO, MedicalRecordDTO } from '@/types/domain';

interface RequestOtpResponse {
  success?: boolean;
  participantId: string;
  participantName: string;
  maskedEmail: string;
  challengeToken?: string;
  debugCode?: string;
  error?: string;
}

interface VerifyOtpResponse {
  success?: boolean;
  editToken: string;
  qrEmergencyUrl: string;
  qrDataUrl: string;
  participant: ParticipantDTO;
  medicalRecord: MedicalRecordDTO;
  error?: string;
}

interface SaveMedicalResponse {
  success?: boolean;
  medicalRecord: MedicalRecordDTO;
  qrEmergencyUrl: string;
  qrDataUrl: string;
  error?: string;
}

const STEPPER_STEPS = [
  { num: 1 as const, label: 'Identificación' },
  { num: 2 as const, label: 'Verificación OTP' },
  { num: 3 as const, label: 'Ficha Médica Trilingüe' },
];

const SECTION_ANCHORS = [
  { href: '#sec-biometria', label: 'Biometría' },
  { href: '#sec-emergencia', label: 'Emergencia' },
  { href: '#sec-seguro', label: 'Seguro' },
  { href: '#sec-alergias', label: 'Alergias' },
  { href: '#sec-cronicas', label: 'Crónicas' },
  { href: '#sec-vacunas', label: 'Vacunas' },
  { href: '#sec-consentimiento', label: 'Consentimiento' },
];

export default function FichaMedicaPage() {
  const params = useParams<{ id?: string }>();
  const { toast } = useToast();
  const errorAlertRef = useRef<HTMLDivElement | null>(null);

  // Estado de pasos: 1 = Pedir OTP, 2 = Validar OTP, 3 = Llenar/Ver Ficha
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Paso 1: Solicitud de código (pre-rellena si viene /ficha-medica/[id])
  const [rutInput, setRutInput] = useState(() => {
    if (!params?.id) return '';
    try {
      return formatRut(decodeURIComponent(params.id));
    } catch {
      return formatRut(params.id);
    }
  });
  const [emailInput, setEmailInput] = useState('');
  const [requestingOtp, setRequestingOtp] = useState(false);
  const [otpError, setOtpError] = useState<string | null>(null);

  // Paso 2: Validación OTP
  const [otpCode, setOtpCode] = useState('');
  const [verifyingOtp, setVerifyingOtp] = useState(false);
  const [challengeToken, setChallengeToken] = useState<string | null>(null);
  const [participantId, setParticipantId] = useState('');
  const [participantName, setParticipantName] = useState('');
  const [maskedEmail, setMaskedEmail] = useState('');
  const [debugOtp, setDebugOtp] = useState<string | null>(null);

  // Paso 3: Ficha Médica
  const [editToken, setEditToken] = useState<string | null>(null);
  const [participant, setParticipant] = useState<ParticipantDTO | null>(null);
  const [medicalRecord, setMedicalRecord] = useState<MedicalRecordDTO | null>(null);
  const [qrEmergencyUrl, setQrEmergencyUrl] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

  // Pestaña de visualización de idioma en la ficha
  const [activeLangTab, setActiveLangTab] = useState<'es' | 'en' | 'pl'>('es');
  const [savingMedical, setSavingMedical] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);

  // Campos del formulario médico (en español)
  const [bloodType, setBloodType] = useState('O+');
  const [heightCm, setHeightCm] = useState('');
  const [weightKg, setWeightKg] = useState('');

  const [emergencyContactName, setEmergencyContactName] = useState('');
  const [emergencyContactPhone, setEmergencyContactPhone] = useState('');
  const [emergencyContactRelation, setEmergencyContactRelation] = useState('');
  const [emergencyContactEmail, setEmergencyContactEmail] = useState('');

  const [insuranceCompany, setInsuranceCompany] = useState('');
  const [insurancePolicyNumber, setInsurancePolicyNumber] = useState('');
  const [insuranceEmergencyPhone, setInsuranceEmergencyPhone] = useState('');

  const [hasSevereAllergies, setHasSevereAllergies] = useState(false);
  const [carriesEpiPen, setCarriesEpiPen] = useState(false);
  const [allergiesES, setAllergiesES] = useState('');

  const [hasChronicConditions, setHasChronicConditions] = useState(false);
  const [chronicConditionsES, setChronicConditionsES] = useState('');

  const [takesRegularMedication, setTakesRegularMedication] = useState(false);
  const [requiresColdChainMedication, setRequiresColdChainMedication] = useState(false);
  const [currentMedicationsES, setCurrentMedicationsES] = useState('');

  const [dietaryRestrictionsES, setDietaryRestrictionsES] = useState('');

  const [tetanusLastDoseYear, setTetanusLastDoseYear] = useState('2024');
  const [vaccinationRecordsES, setVaccinationRecordsES] = useState('');

  const [pastSurgeriesInjuriesES, setPastSurgeriesInjuriesES] = useState('');
  const [devicesImplantsES, setDevicesImplantsES] = useState('');
  const [physicalLimitationsES, setPhysicalLimitationsES] = useState('');

  const [emergencyTreatmentConsent, setEmergencyTreatmentConsent] = useState(false);
  const [declaredByName, setDeclaredByName] = useState('');
  const [declaredByRut, setDeclaredByRut] = useState('');
  const [declaredByRole, setDeclaredByRole] = useState('APODERADO');

  const scrollToErrorAlert = () => {
    requestAnimationFrame(() => {
      errorAlertRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  };

  // Manejar solicitud de OTP
  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setOtpError(null);

    const cleaned = cleanRut(rutInput);
    if (!validateRut(cleaned)) {
      const msg = 'Por favor ingresa un RUT chileno válido';
      setOtpError(msg);
      toast.error(msg, 'RUT inválido');
      return;
    }

    try {
      setRequestingOtp(true);
      const res = await fetch('/api/medical/request-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rut: rutInput, email: emailInput || undefined }),
      });

      const data = (await res.json()) as RequestOtpResponse;
      if (!res.ok) {
        throw new Error(data.error || 'Error al solicitar código');
      }

      setChallengeToken(data.challengeToken || null);
      setParticipantId(data.participantId);
      setParticipantName(data.participantName);
      setMaskedEmail(data.maskedEmail);
      setDebugOtp(data.debugCode || null);
      setStep(2);
      toast.success(
        `Código de verificación enviado a ${data.maskedEmail}`,
        'Código enviado'
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al solicitar código';
      setOtpError(msg);
      toast.error(msg, 'No se pudo enviar el código');
    } finally {
      setRequestingOtp(false);
    }
  };

  // Manejar verificación de OTP
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setOtpError(null);

    if (!otpCode.trim() || otpCode.trim().length !== 6) {
      const msg = 'Ingresa el código numérico de 6 dígitos';
      setOtpError(msg);
      toast.error(msg, 'Código incompleto');
      return;
    }

    try {
      setVerifyingOtp(true);
      const payload = challengeToken
        ? { challengeToken, code: otpCode.trim() }
        : {
            participantId,
            email: emailInput || maskedEmail,
            code: otpCode.trim(),
          };

      const res = await fetch('/api/medical/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = (await res.json()) as VerifyOtpResponse;
      if (!res.ok) {
        throw new Error(data.error || 'Código incorrecto');
      }

      setEditToken(data.editToken);
      setParticipant(data.participant);
      setMedicalRecord(data.medicalRecord);
      setQrEmergencyUrl(data.qrEmergencyUrl);
      setQrDataUrl(data.qrDataUrl);

      // Cargar valores iniciales en el formulario
      const m: Partial<MedicalRecordDTO> = data.medicalRecord || {};
      const p: Partial<ParticipantDTO> = data.participant || {};

      setBloodType(m.bloodType || 'O+');
      setHeightCm(m.heightCm ? String(m.heightCm) : '');
      setWeightKg(m.weightKg ? String(m.weightKg) : '');

      setEmergencyContactName(m.emergencyContactName || p.guardianName || '');
      setEmergencyContactPhone(m.emergencyContactPhone || p.guardianPhone || '');
      setEmergencyContactEmail(m.emergencyContactEmail || p.guardianEmail || '');
      setEmergencyContactRelation(m.emergencyContactRelation || p.guardianRelationship || 'Padre/Madre');

      setInsuranceCompany(m.insuranceCompany || 'Seguro de Asistencia Internacional WSJ 2027');
      setInsurancePolicyNumber(m.insurancePolicyNumber || '');
      setInsuranceEmergencyPhone(m.insuranceEmergencyPhone || '+56 2 2999 0000');

      setHasSevereAllergies(Boolean(m.hasSevereAllergies));
      setCarriesEpiPen(Boolean(m.carriesEpiPen));
      setAllergiesES(m.allergiesES || p.medicalNotes || '');

      setHasChronicConditions(Boolean(m.hasChronicConditions));
      setChronicConditionsES(m.chronicConditionsES || '');

      setTakesRegularMedication(Boolean(m.takesRegularMedication));
      setRequiresColdChainMedication(Boolean(m.requiresColdChainMedication));
      setCurrentMedicationsES(m.currentMedicationsES || '');

      setDietaryRestrictionsES(m.dietaryRestrictionsES || p.dietaryRestrictions || '');

      setTetanusLastDoseYear(m.tetanusLastDoseYear || '2024');
      setVaccinationRecordsES(
        m.vaccinationRecordsES || 'Vacunación completa según calendario nacional. Antitetánica al día.'
      );

      setPastSurgeriesInjuriesES(m.pastSurgeriesInjuriesES || '');
      setDevicesImplantsES(m.devicesImplantsES || '');
      setPhysicalLimitationsES(
        m.physicalLimitationsES || 'Sabe nadar. Capacidad física óptima para actividades de campismo.'
      );

      setEmergencyTreatmentConsent(m.emergencyTreatmentConsent ?? true);
      setDeclaredByName(m.declaredByName || p.guardianName || '');
      setDeclaredByRut(m.declaredByRut || '');
      setDeclaredByRole(m.declaredByRole || 'APODERADO');

      setStep(3);
      toast.success(
        'Identidad verificada. Ya puedes revisar y actualizar la ficha médica.',
        'Verificación exitosa'
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al validar el código';
      setOtpError(msg);
      toast.error(msg, 'Código inválido');
    } finally {
      setVerifyingOtp(false);
    }
  };

  // Guardar Ficha Médica y Generar Traducciones
  const handleSaveMedical = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!participant) return;
    setSaveSuccessMsg(null);
    setOtpError(null);

    if (!emergencyTreatmentConsent) {
      const msg =
        'Debes aceptar la autorización de tratamiento médico de emergencia en el extranjero para continuar.';
      setOtpError(msg);
      toast.error(msg, 'Consentimiento obligatorio');
      scrollToErrorAlert();
      return;
    }

    try {
      setSavingMedical(true);
      const res = await fetch(`/api/medical/${participant.id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${editToken}`,
        },
        body: JSON.stringify({
          bloodType,
          heightCm,
          weightKg,
          emergencyContactName,
          emergencyContactPhone,
          emergencyContactRelation,
          emergencyContactEmail,
          insuranceCompany,
          insurancePolicyNumber,
          insuranceEmergencyPhone,
          hasSevereAllergies,
          carriesEpiPen,
          allergiesES,
          hasChronicConditions,
          chronicConditionsES,
          takesRegularMedication,
          requiresColdChainMedication,
          currentMedicationsES,
          dietaryRestrictionsES,
          tetanusLastDoseYear,
          vaccinationRecordsES,
          pastSurgeriesInjuriesES,
          devicesImplantsES,
          physicalLimitationsES,
          emergencyTreatmentConsent,
          declaredByName,
          declaredByRut,
          declaredByRole,
        }),
      });

      const data = (await res.json()) as SaveMedicalResponse;
      if (!res.ok) {
        throw new Error(data.error || 'Error al guardar');
      }

      setMedicalRecord(data.medicalRecord);
      setQrEmergencyUrl(data.qrEmergencyUrl);
      setQrDataUrl(data.qrDataUrl);
      setSaveSuccessMsg('¡Ficha médica guardada y traducida rigurosamente al inglés y polaco con éxito!');
      toast.success(
        'Ficha médica guardada y traducida al inglés y polaco.',
        'Ficha actualizada'
      );
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al guardar ficha médica';
      setOtpError(msg);
      toast.error(msg, 'Error al guardar');
      scrollToErrorAlert();
    } finally {
      setSavingMedical(false);
    }
  };

  const inputClassName =
    'w-full bg-white border border-slate-300 text-slate-800 placeholder-slate-400 focus:border-[#001558] focus:ring-2 focus:ring-[#FEB135]/50 focus:outline-none rounded-xl px-3 py-2.5';

  return (
    <div className="min-h-screen bg-[#F5F6F8] text-slate-800 flex flex-col font-sans print:bg-white">
      {/* Header Institucional Blanco AGSCH */}
      <header className="bg-white border-b border-slate-200 border-t-4 border-t-[#001558] py-4 px-4 sm:px-8 shadow-xs print:hidden">
        <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="relative w-44 h-12">
              <Image
                src="/agsch-logo-color.svg"
                alt="Guías y Scouts de Chile"
                fill
                priority
                className="object-contain object-left"
              />
            </div>
            <div className="hidden sm:block pl-3 border-l border-slate-200">
              <span className="font-black text-sm text-[#001558]">Polonia 2027</span>
              <p className="text-[11px] text-slate-500">Ficha Médica Oficial del Contingente</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="px-3 py-1 rounded-full bg-[#EEF2FF] border border-[#001558]/20 text-[#001558] text-xs font-bold flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5 text-[#001558]" />
              Portal Confidencial de Salud
            </span>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-5xl w-full mx-auto p-4 sm:p-6">
        {/* Stepper Visual de 3 Pasos */}
        <nav
          aria-label="Progreso de ficha médica"
          className="mb-6 bg-white border border-slate-200 rounded-2xl p-3 sm:p-4 shadow-2xs print:hidden"
        >
          <ol className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-4">
            {STEPPER_STEPS.map((item) => {
              const isCompleted = step > item.num;
              const isCurrent = step === item.num;

              return (
                <li
                  key={item.num}
                  aria-current={isCurrent ? 'step' : undefined}
                  className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl border transition-all ${
                    isCurrent
                      ? 'bg-[#FFFBF0] border-[#FEB135] text-[#001558] shadow-2xs'
                      : isCompleted
                        ? 'bg-emerald-50/70 border-emerald-200 text-emerald-900'
                        : 'bg-[#F5F6F8] border-slate-200 text-slate-400'
                  }`}
                >
                  <span
                    className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-black shrink-0 ${
                      isCurrent
                        ? 'bg-[#001558] text-[#FEB135]'
                        : isCompleted
                          ? 'bg-emerald-600 text-white'
                          : 'bg-white border border-slate-300 text-slate-400'
                    }`}
                  >
                    {isCompleted ? <CheckCircle2 className="w-4 h-4" /> : item.num}
                  </span>
                  <div className="min-w-0">
                    <span className="block text-[10px] font-bold uppercase tracking-wider opacity-75">
                      Paso {item.num}
                    </span>
                    <span className="block text-xs font-extrabold truncate">
                      {item.label}
                    </span>
                  </div>
                </li>
              );
            })}
          </ol>
        </nav>

        {/* PASO 1: Ingreso de RUT y Correo */}
        {step === 1 && (
          <div className="max-w-md mx-auto my-6 bg-white border border-slate-200 border-t-4 border-t-[#001558] rounded-3xl p-6 sm:p-8 shadow-xl space-y-6">
            <div className="text-center space-y-2">
              <div className="w-14 h-14 rounded-2xl bg-[#FFFBF0] border border-[#FEB135]/50 text-[#001558] flex items-center justify-center mx-auto shadow-xs">
                <Heart className="w-7 h-7 text-red-600" />
              </div>
              <h1 className="text-xl font-black text-[#001558]">Ficha Médica Polonia 2027</h1>
              <p className="text-xs text-slate-600">
                Acceso exclusivo para participantes y apoderados mediante código de seguridad enviado al correo.
              </p>
            </div>

            {otpError && (
              <div
                ref={errorAlertRef}
                role="alert"
                className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-start gap-2 font-medium"
              >
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-red-600" />
                <span>{otpError}</span>
              </div>
            )}

            <form onSubmit={handleRequestOtp} className="space-y-4 text-xs">
              <div>
                <label className="block text-[#001558] font-bold uppercase tracking-wider mb-1.5">
                  RUT del Participante *
                </label>
                <input
                  type="text"
                  placeholder="Ej: 21.345.678-4"
                  value={rutInput}
                  onChange={(e) => setRutInput(e.target.value)}
                  onBlur={() => rutInput && setRutInput(formatRut(rutInput))}
                  required
                  className={`${inputClassName} font-mono text-sm px-4 py-3`}
                />
                <span className="text-[10px] text-slate-500 mt-1 block">
                  Identificador nacional oficial registrado en la nómina.
                </span>
              </div>

              <div>
                <label className="block text-[#001558] font-bold uppercase tracking-wider mb-1.5">
                  Correo del Apoderado o Participante (Opcional)
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                  <input
                    type="email"
                    placeholder="correo@ejemplo.cl"
                    value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)}
                    className={`${inputClassName} pl-10 pr-4 py-3 text-sm`}
                  />
                </div>
                <div className="mt-2 p-2.5 rounded-xl bg-[#FFFBF0] border border-[#FEB135]/40 border-l-4 border-l-[#FEB135] text-[11px] text-[#001558]">
                  Si lo dejas en blanco, se enviará automáticamente al correo registrado en la ficha oficial.
                </div>
              </div>

              <button
                type="submit"
                disabled={requestingOtp}
                className="w-full py-3.5 rounded-xl bg-[#001558] hover:bg-[#0b2370] text-white font-black text-sm flex items-center justify-center gap-2 shadow-md cursor-pointer disabled:opacity-50 transition-all"
              >
                {requestingOtp ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Buscando participante...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4 text-[#FEB135]" />
                    Enviar Código de Verificación
                  </>
                )}
              </button>
            </form>
          </div>
        )}

        {/* PASO 2: Validación del Código de 6 Dígitos */}
        {step === 2 && (
          <div className="max-w-md mx-auto my-6 bg-white border border-slate-200 border-t-4 border-t-[#001558] rounded-3xl p-6 sm:p-8 shadow-xl space-y-6">
            <div className="text-center space-y-2">
              <div className="w-14 h-14 rounded-2xl bg-[#FFFBF0] border border-[#FEB135]/50 text-[#001558] flex items-center justify-center mx-auto shadow-xs">
                <Lock className="w-7 h-7 text-[#001558]" />
              </div>
              <h1 className="text-xl font-black text-[#001558]">Ingresa el Código de Validación</h1>
              <p className="text-xs text-slate-600">
                Hemos enviado un código de 6 dígitos para validar a{' '}
                <span className="text-[#001558] font-bold">{participantName}</span> al correo:{' '}
                <span className="text-[#001558] font-mono font-bold">{maskedEmail}</span>.
              </p>
            </div>

            {otpError && (
              <div
                ref={errorAlertRef}
                role="alert"
                className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-start gap-2 font-medium"
              >
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-red-600" />
                <span>{otpError}</span>
              </div>
            )}

            {debugOtp && (
              <div className="p-3 bg-[#FFFBF0] border border-[#FEB135]/40 border-l-4 border-l-[#FEB135] rounded-xl text-center text-[#001558]">
                <p className="text-[11px] font-medium">
                  Modo Pruebas / Código generado:{' '}
                  <span className="text-[#001558] font-mono font-black text-sm">{debugOtp}</span>
                </p>
                <button
                  type="button"
                  onClick={() => setOtpCode(debugOtp)}
                  className="mt-1 text-[11px] text-[#001558] underline font-bold cursor-pointer"
                >
                  Autocompletar código
                </button>
              </div>
            )}

            <form onSubmit={handleVerifyOtp} className="space-y-4 text-xs">
              <div>
                <label className="block text-[#001558] font-bold uppercase tracking-wider mb-1.5 text-center">
                  Código de 6 Dígitos
                </label>
                <input
                  type="text"
                  maxLength={6}
                  placeholder="123456"
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                  required
                  className="w-full bg-white border-2 border-slate-300 focus:border-[#001558] focus:ring-2 focus:ring-[#FEB135]/50 rounded-xl px-4 py-3 text-center text-[#001558] placeholder-slate-300 font-mono text-2xl tracking-widest font-black focus:outline-none"
                />
                <span className="text-[10px] text-slate-500 text-center block mt-1">
                  El código tiene una validez de 15 minutos.
                </span>
              </div>

              <button
                type="submit"
                disabled={verifyingOtp}
                className="w-full py-3.5 rounded-xl bg-[#FEB135] hover:bg-[#e59c22] text-[#001558] font-black text-sm flex items-center justify-center gap-2 shadow-md cursor-pointer disabled:opacity-50 transition-all"
              >
                {verifyingOtp ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Validando código...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    Verificar y Acceder a la Ficha
                  </>
                )}
              </button>

              <div className="text-center pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setStep(1);
                    setOtpError(null);
                  }}
                  className="text-xs text-slate-600 hover:text-[#001558] underline cursor-pointer font-medium"
                >
                  ← Volver a ingresar otro RUT o correo
                </button>
              </div>
            </form>
          </div>
        )}

        {/* PASO 3: Ficha Médica Completa Trilingüe */}
        {step === 3 && participant && (
          <div className="space-y-6 animate-in fade-in duration-300">
            {/* Mensaje de Éxito al Guardar */}
            {saveSuccessMsg && (
              <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center justify-between shadow-xs">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                  <span className="font-bold">{saveSuccessMsg}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setSaveSuccessMsg(null)}
                  className="text-emerald-700 hover:text-emerald-950 font-bold ml-2 cursor-pointer"
                >
                  ✕
                </button>
              </div>
            )}

            {otpError && (
              <div
                ref={errorAlertRef}
                role="alert"
                className="p-4 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center justify-between gap-2 shadow-xs"
              >
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                  <span className="font-semibold">{otpError}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setOtpError(null)}
                  className="text-red-700 hover:text-red-950 font-bold ml-2 cursor-pointer"
                >
                  ✕
                </button>
              </div>
            )}

            {/* Cabecera del Participante y Código QR */}
            <div className="bg-white border border-slate-200 border-t-4 border-t-[#001558] rounded-3xl p-6 shadow-sm flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="space-y-2 w-full">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-2xl font-black text-[#001558]">
                    {participant.firstName} {participant.lastName} {participant.secondLastName || ''}
                  </h1>
                  {participant.cupoCode && (
                    <span className="px-2.5 py-0.5 rounded-lg bg-[#FFF8E1] border border-[#FEB135] text-[#001558] text-xs font-mono font-bold">
                      Cupo: {participant.cupoCode}
                    </span>
                  )}
                  {participant.contingentRole && (
                    <span className="px-2.5 py-0.5 rounded-full bg-[#EEF2FF] text-[#001558] text-xs font-bold border border-[#001558]/20">
                      {participant.contingentRole}
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs text-slate-600 pt-1">
                  <div>
                    <span className="text-slate-400 text-[10px] block uppercase font-bold">RUT</span>
                    <span className="font-mono font-bold text-[#001558]">{participant.rut}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 text-[10px] block uppercase font-bold">Fecha Nacimiento</span>
                    <span className="font-medium text-slate-800">
                      {participant.birthDate
                        ? new Date(participant.birthDate).toLocaleDateString('es-CL')
                        : 'No informada'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 text-[10px] block uppercase font-bold">Grupo Scout</span>
                    <span className="font-medium text-slate-800">{participant.scoutGroup || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 text-[10px] block uppercase font-bold">Estado Ficha</span>
                    <span
                      className={`inline-block px-2 py-0.5 rounded text-[11px] font-bold border ${
                        medicalRecord?.completionStatus === 'COMPLETED'
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                          : 'bg-amber-50 text-amber-800 border-amber-200'
                      }`}
                    >
                      {medicalRecord?.completionStatus === 'COMPLETED'
                        ? 'Completada y Traducida'
                        : 'Pendiente de Completar'}
                    </span>
                  </div>
                </div>
              </div>

              {/* QR Code de Emergencia */}
              {qrDataUrl && (
                <div className="flex items-center gap-3 bg-[#F5F6F8] p-3 rounded-2xl border border-slate-200 shrink-0">
                  <div className="p-1.5 bg-white rounded-xl border border-slate-200">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={qrDataUrl} alt="QR Médico" className="w-20 h-20" />
                  </div>
                  <div className="text-left text-xs space-y-1">
                    <span className="font-bold text-[#001558] block text-[11px]">
                      QR de Emergencia
                    </span>
                    <p className="text-[10px] text-slate-500 max-w-[130px]">
                      Acceso para paramédicos en Polonia (Inglés/Polaco)
                    </p>
                    <a
                      href={qrEmergencyUrl || '#'}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[10px] text-[#001558] font-bold hover:underline print:hidden"
                    >
                      <ExternalLink className="w-3 h-3" />
                      Probar QR
                    </a>
                  </div>
                </div>
              )}
            </div>

            {/* Selector de Pestañas de Idioma */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3 print:hidden">
              <div className="flex flex-wrap bg-white border border-slate-200 rounded-xl p-1 text-xs font-bold shadow-2xs">
                <button
                  type="button"
                  onClick={() => setActiveLangTab('es')}
                  className={`px-4 py-2 rounded-lg transition-all flex items-center gap-2 cursor-pointer ${
                    activeLangTab === 'es'
                      ? 'bg-[#001558] text-white font-black shadow-xs'
                      : 'text-slate-600 hover:text-[#001558]'
                  }`}
                >
                  🇨🇱 Español (Original Editable)
                </button>
                <button
                  type="button"
                  onClick={() => setActiveLangTab('en')}
                  className={`px-4 py-2 rounded-lg transition-all flex items-center gap-2 cursor-pointer ${
                    activeLangTab === 'en'
                      ? 'bg-[#001558] text-white font-black shadow-xs'
                      : 'text-slate-600 hover:text-[#001558]'
                  }`}
                >
                  🇬🇧 English (Medical Report WSJ)
                </button>
                <button
                  type="button"
                  onClick={() => setActiveLangTab('pl')}
                  className={`px-4 py-2 rounded-lg transition-all flex items-center gap-2 cursor-pointer ${
                    activeLangTab === 'pl'
                      ? 'bg-[#001558] text-white font-black shadow-xs'
                      : 'text-slate-600 hover:text-[#001558]'
                  }`}
                >
                  🇵🇱 Polski (Karta Medyczna)
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-3.5 py-2 rounded-xl bg-white border border-slate-300 hover:border-[#001558] text-[#001558] text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
                >
                  <Printer className="w-3.5 h-3.5" />
                  Imprimir Ficha
                </button>
              </div>
            </div>

            {/* Vista en Inglés o Polaco (Modo Lectura / Reporte Médico) */}
            {activeLangTab !== 'es' && (
              <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-200">
                  <div className="flex items-center gap-2 text-xs font-bold text-[#001558]">
                    <Globe className="w-4 h-4 text-[#FEB135]" />
                    <span>
                      {activeLangTab === 'en'
                        ? 'OFFICIAL WSJ 2027 ENGLISH MEDICAL REPORT'
                        : 'OFICJALNA KARTA MEDYCZNA WSJ 2027 W JĘZYKU POLSKIM'}
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-500">
                    Traducción médica estandarizada según normativa sanitaria polaca
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div className="bg-[#F5F6F8] p-4 rounded-2xl border border-slate-200 space-y-1">
                    <span className="text-[10px] font-bold text-red-700 uppercase tracking-wider">
                      {activeLangTab === 'en'
                        ? 'Allergies & Severe Anaphylaxis Risk'
                        : 'Alergie i Ryzyko Anafilaksji'}
                    </span>
                    <p className="text-slate-800 font-medium">
                      {activeLangTab === 'en'
                        ? medicalRecord?.allergiesEN || 'No known allergies reported'
                        : medicalRecord?.allergiesPL || 'Brak zgłoszonych alergii'}
                    </p>
                  </div>

                  <div className="bg-[#F5F6F8] p-4 rounded-2xl border border-slate-200 space-y-1">
                    <span className="text-[10px] font-bold text-[#001558] uppercase tracking-wider">
                      {activeLangTab === 'en' ? 'Chronic Medical Conditions' : 'Choroby Przewlekłe'}
                    </span>
                    <p className="text-slate-800 font-medium">
                      {activeLangTab === 'en'
                        ? medicalRecord?.chronicConditionsEN || 'None reported'
                        : medicalRecord?.chronicConditionsPL || 'Brak zgłoszonych'}
                    </p>
                  </div>

                  <div className="bg-[#F5F6F8] p-4 rounded-2xl border border-slate-200 space-y-1">
                    <span className="text-[10px] font-bold text-[#001558] uppercase tracking-wider">
                      {activeLangTab === 'en' ? 'Current Medications' : 'Aktualnie Przyjmowane Leki'}
                    </span>
                    <p className="text-slate-800 font-medium">
                      {activeLangTab === 'en'
                        ? medicalRecord?.currentMedicationsEN || 'None'
                        : medicalRecord?.currentMedicationsPL || 'Brak'}
                    </p>
                  </div>

                  <div className="bg-[#F5F6F8] p-4 rounded-2xl border border-slate-200 space-y-1">
                    <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider">
                      {activeLangTab === 'en' ? 'Dietary Restrictions' : 'Ograniczenia Dietetyczne'}
                    </span>
                    <p className="text-slate-800 font-medium">
                      {activeLangTab === 'en'
                        ? medicalRecord?.dietaryRestrictionsEN || 'Standard diet'
                        : medicalRecord?.dietaryRestrictionsPL || 'Dieta standardowa'}
                    </p>
                  </div>

                  <div className="bg-[#F5F6F8] p-4 rounded-2xl border border-slate-200 space-y-1">
                    <span className="text-[10px] font-bold text-[#001558] uppercase tracking-wider">
                      {activeLangTab === 'en' ? 'Vaccination History' : 'Szczepienia'}
                    </span>
                    <p className="text-slate-800 font-medium">
                      {activeLangTab === 'en'
                        ? medicalRecord?.vaccinationRecordsEN || 'Up to date'
                        : medicalRecord?.vaccinationRecordsPL || 'Aktualne'}
                    </p>
                  </div>

                  <div className="bg-[#F5F6F8] p-4 rounded-2xl border border-slate-200 space-y-1">
                    <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">
                      {activeLangTab === 'en'
                        ? 'Physical & Swimming Limitations'
                        : 'Ograniczenia Aktywności'}
                    </span>
                    <p className="text-slate-800 font-medium">
                      {activeLangTab === 'en'
                        ? medicalRecord?.physicalLimitationsEN || 'Full capacity'
                        : medicalRecord?.physicalLimitationsPL || 'Pełna zdolność'}
                    </p>
                  </div>
                </div>

                <div className="text-center pt-2 print:hidden">
                  <button
                    type="button"
                    onClick={() => setActiveLangTab('es')}
                    className="text-xs text-[#001558] underline font-bold cursor-pointer"
                  >
                    ← Modificar datos en la ficha en español para regenerar la traducción
                  </button>
                </div>
              </div>
            )}

            {/* Formulario en Español (Edición y Guardado) */}
            {activeLangTab === 'es' && (
              <form onSubmit={handleSaveMedical} className="space-y-6">
                {/* Barra Rápida de Navegación Interna */}
                <nav
                  aria-label="Secciones de la ficha médica"
                  className="bg-white border border-slate-200 rounded-2xl p-2.5 shadow-2xs flex flex-wrap items-center gap-1.5 print:hidden"
                >
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 px-2">
                    Ir a:
                  </span>
                  {SECTION_ANCHORS.map((sec) => (
                    <a
                      key={sec.href}
                      href={sec.href}
                      className="px-3 py-1.5 rounded-xl bg-[#F5F6F8] hover:bg-[#FFFBF0] border border-slate-200 hover:border-[#FEB135] text-[#001558] text-xs font-bold transition-colors"
                    >
                      {sec.label}
                    </a>
                  ))}
                </nav>

                {/* 1. Biometría y Grupo Sanguíneo */}
                <div
                  id="sec-biometria"
                  className="scroll-mt-24 bg-white border border-slate-200 rounded-3xl p-6 shadow-xs space-y-4"
                >
                  <div className="flex items-center gap-2 pb-2 border-b border-slate-200 text-[#001558] font-bold text-xs uppercase tracking-wider">
                    <Droplet className="w-4 h-4 text-red-600" />
                    <span>1. Grupo Sanguíneo y Datos Biométricos</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                    <div>
                      <label className="block text-slate-700 font-bold mb-1">
                        Grupo Sanguíneo / Factor Rh *
                      </label>
                      <select
                        value={bloodType}
                        onChange={(e) => setBloodType(e.target.value)}
                        className={`${inputClassName} font-bold`}
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
                      <label className="block text-slate-700 font-bold mb-1">Estatura (cm)</label>
                      <input
                        type="number"
                        placeholder="Ej: 168"
                        value={heightCm}
                        onChange={(e) => setHeightCm(e.target.value)}
                        className={`${inputClassName} font-mono`}
                      />
                    </div>

                    <div>
                      <label className="block text-slate-700 font-bold mb-1">Peso (kg)</label>
                      <input
                        type="number"
                        placeholder="Ej: 62"
                        value={weightKg}
                        onChange={(e) => setWeightKg(e.target.value)}
                        className={`${inputClassName} font-mono`}
                      />
                    </div>
                  </div>
                </div>

                {/* 2. Contacto de Emergencia */}
                <div
                  id="sec-emergencia"
                  className="scroll-mt-24 bg-white border border-slate-200 rounded-3xl p-6 shadow-xs space-y-4"
                >
                  <div className="flex items-center gap-2 pb-2 border-b border-slate-200 text-[#001558] font-bold text-xs uppercase tracking-wider">
                    <Phone className="w-4 h-4 text-[#FEB135]" />
                    <span>2. Contacto de Emergencia en Chile (Apoderado / Familiar Directo)</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
                    <div>
                      <label className="block text-slate-700 font-bold mb-1">Nombre Completo *</label>
                      <input
                        type="text"
                        value={emergencyContactName}
                        onChange={(e) => setEmergencyContactName(e.target.value)}
                        required
                        className={inputClassName}
                      />
                    </div>
                    <div>
                      <label className="block text-slate-700 font-bold mb-1">Parentesco / Relación *</label>
                      <input
                        type="text"
                        placeholder="Madre, Padre, Cónyuge..."
                        value={emergencyContactRelation}
                        onChange={(e) => setEmergencyContactRelation(e.target.value)}
                        required
                        className={inputClassName}
                      />
                    </div>
                    <div>
                      <label className="block text-slate-700 font-bold mb-1">Teléfono con código de país *</label>
                      <input
                        type="tel"
                        placeholder="+56 9 1234 5678"
                        value={emergencyContactPhone}
                        onChange={(e) => setEmergencyContactPhone(e.target.value)}
                        required
                        className={`${inputClassName} font-mono`}
                      />
                    </div>
                    <div>
                      <label className="block text-slate-700 font-bold mb-1">Correo Electrónico *</label>
                      <input
                        type="email"
                        value={emergencyContactEmail}
                        onChange={(e) => setEmergencyContactEmail(e.target.value)}
                        required
                        className={inputClassName}
                      />
                    </div>
                  </div>
                </div>

                {/* 3. Seguro de Asistencia Internacional */}
                <div
                  id="sec-seguro"
                  className="scroll-mt-24 bg-white border border-slate-200 rounded-3xl p-6 shadow-xs space-y-4"
                >
                  <div className="flex items-center gap-2 pb-2 border-b border-slate-200 text-[#001558] font-bold text-xs uppercase tracking-wider">
                    <ShieldCheck className="w-4 h-4 text-[#FEB135]" />
                    <span>3. Seguro de Asistencia Internacional en Viaje</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                    <div>
                      <label className="block text-slate-700 font-bold mb-1">
                        Aseguradora / Convenio
                      </label>
                      <input
                        type="text"
                        placeholder="Seguro de Asistencia Internacional WSJ 2027"
                        value={insuranceCompany}
                        onChange={(e) => setInsuranceCompany(e.target.value)}
                        className={inputClassName}
                      />
                    </div>
                    <div>
                      <label className="block text-slate-700 font-bold mb-1">
                        N° de Póliza (si aplica)
                      </label>
                      <input
                        type="text"
                        placeholder="Póliza Grupal Contingente WSJ"
                        value={insurancePolicyNumber}
                        onChange={(e) => setInsurancePolicyNumber(e.target.value)}
                        className={`${inputClassName} font-mono`}
                      />
                    </div>
                    <div>
                      <label className="block text-slate-700 font-bold mb-1">
                        Teléfono de Asistencia 24/7
                      </label>
                      <input
                        type="tel"
                        placeholder="+56 2 2999 0000"
                        value={insuranceEmergencyPhone}
                        onChange={(e) => setInsuranceEmergencyPhone(e.target.value)}
                        className={`${inputClassName} font-mono`}
                      />
                    </div>
                  </div>
                </div>

                {/* 4. Alergias e Hipersensibilidades */}
                <div
                  id="sec-alergias"
                  className="scroll-mt-24 bg-white border border-slate-200 rounded-3xl p-6 shadow-xs space-y-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-200">
                    <div className="flex items-center gap-2 text-red-700 font-bold text-xs uppercase tracking-wider">
                      <AlertTriangle className="w-4 h-4 text-red-600" />
                      <span>4. Alergias a Medicamentos, Alimentos o Picaduras</span>
                    </div>

                    <div className="flex flex-wrap items-center gap-4 text-xs">
                      <label className="flex items-center gap-2 cursor-pointer text-red-700 font-bold">
                        <input
                          type="checkbox"
                          checked={hasSevereAllergies}
                          onChange={(e) => setHasSevereAllergies(e.target.checked)}
                          className="w-4 h-4 accent-red-600 rounded"
                        />
                        <span>Riesgo de Anafilaxia / Alergia Severa</span>
                      </label>

                      <label className="flex items-center gap-2 cursor-pointer text-[#001558] font-bold">
                        <input
                          type="checkbox"
                          checked={carriesEpiPen}
                          onChange={(e) => setCarriesEpiPen(e.target.checked)}
                          className="w-4 h-4 accent-[#001558] rounded"
                        />
                        <span>Porta Autoinyector de Epinefrina (EpiPen)</span>
                      </label>
                    </div>
                  </div>

                  <div className="text-xs space-y-1.5">
                    <label className="block text-slate-700 font-bold">
                      Detalle de Alergias (Medicamentos, Maní, Mariscos, Picaduras, Látex, etc.)
                    </label>
                    <textarea
                      rows={2}
                      placeholder="Ej: Penicilina (shock anafiláctico), Picadura de avispa (porta EpiPen), Maní..."
                      value={allergiesES}
                      onChange={(e) => setAllergiesES(e.target.value)}
                      className="w-full bg-white border border-slate-300 text-slate-800 placeholder-slate-400 focus:border-[#001558] focus:ring-2 focus:ring-[#FEB135]/50 focus:outline-none rounded-xl p-3"
                    />
                    <span className="text-[10px] text-slate-500 block">
                      Si no tiene ninguna alergia conocida, escribe &quot;Ninguna conocida&quot;.
                    </span>
                  </div>
                </div>

                {/* 5. Condiciones Médicas Crónicas */}
                <div
                  id="sec-cronicas"
                  className="scroll-mt-24 bg-white border border-slate-200 rounded-3xl p-6 shadow-xs space-y-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-200">
                    <div className="flex items-center gap-2 text-[#001558] font-bold text-xs uppercase tracking-wider">
                      <Heart className="w-4 h-4 text-[#FEB135]" />
                      <span>5. Condiciones Médicas Crónicas / Diagnósticos Previos</span>
                    </div>

                    <label className="flex items-center gap-2 cursor-pointer text-[#001558] text-xs font-bold">
                      <input
                        type="checkbox"
                        checked={hasChronicConditions}
                        onChange={(e) => setHasChronicConditions(e.target.checked)}
                        className="w-4 h-4 accent-[#001558] rounded"
                      />
                      <span>Tiene diagnósticos crónicos</span>
                    </label>
                  </div>

                  <div className="text-xs space-y-1.5">
                    <textarea
                      rows={2}
                      placeholder="Ej: Asma bronquial inducida por ejercicio, Diabetes tipo 1, Celiaquía, Epilepsia..."
                      value={chronicConditionsES}
                      onChange={(e) => setChronicConditionsES(e.target.value)}
                      className="w-full bg-white border border-slate-300 text-slate-800 placeholder-slate-400 focus:border-[#001558] focus:ring-2 focus:ring-[#FEB135]/50 focus:outline-none rounded-xl p-3"
                    />
                    <span className="text-[10px] text-slate-500 block">
                      Indica cualquier condición que requiera seguimiento o atención por el equipo de salud del WSJ.
                    </span>
                  </div>
                </div>

                {/* 6. Medicación Habitual */}
                <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-200">
                    <div className="flex items-center gap-2 text-[#001558] font-bold text-xs uppercase tracking-wider">
                      <Pill className="w-4 h-4 text-indigo-600" />
                      <span>6. Medicamentos Habituales / Uso Continuo</span>
                    </div>

                    <div className="flex flex-wrap items-center gap-4 text-xs">
                      <label className="flex items-center gap-2 cursor-pointer text-slate-700 font-bold">
                        <input
                          type="checkbox"
                          checked={takesRegularMedication}
                          onChange={(e) => setTakesRegularMedication(e.target.checked)}
                          className="w-4 h-4 accent-[#001558] rounded"
                        />
                        <span>Toma fármacos diariamente</span>
                      </label>

                      <label className="flex items-center gap-2 cursor-pointer text-[#001558] font-bold">
                        <input
                          type="checkbox"
                          checked={requiresColdChainMedication}
                          onChange={(e) => setRequiresColdChainMedication(e.target.checked)}
                          className="w-4 h-4 accent-[#001558] rounded"
                        />
                        <span>Requiere refrigeración / Cadena de Frío (2-8°C)</span>
                      </label>
                    </div>
                  </div>

                  <div className="text-xs space-y-1.5">
                    <textarea
                      rows={2}
                      placeholder="Ej: Salbutamol inhalador 2 puffs cada 8 horas en caso de crisis; Insulina glargina 14 unidades en la noche..."
                      value={currentMedicationsES}
                      onChange={(e) => setCurrentMedicationsES(e.target.value)}
                      className="w-full bg-white border border-slate-300 text-slate-800 placeholder-slate-400 focus:border-[#001558] focus:ring-2 focus:ring-[#FEB135]/50 focus:outline-none rounded-xl p-3"
                    />
                    <span className="text-[10px] text-slate-500 block">
                      Incluye principio activo, dosis exacta, frecuencia y si el participante es autónomo en su administración.
                    </span>
                  </div>
                </div>

                {/* 7. Restricciones Alimentarias y Dietas */}
                <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs space-y-4">
                  <div className="flex items-center gap-2 pb-2 border-b border-slate-200 text-[#001558] font-bold text-xs uppercase tracking-wider">
                    <FileText className="w-4 h-4 text-emerald-600" />
                    <span>7. Régimen Alimentario / Intolerancias</span>
                  </div>

                  <div className="text-xs space-y-2">
                    <input
                      type="text"
                      placeholder="Ej: Vegetariano, Vegano, Celíaco estricto (sin gluten), Sin lactosa, Kosher..."
                      value={dietaryRestrictionsES}
                      onChange={(e) => setDietaryRestrictionsES(e.target.value)}
                      className={`${inputClassName} px-4 py-3 text-xs`}
                    />
                    <div className="flex flex-wrap gap-2 pt-1">
                      {['Vegetariano', 'Vegano', 'Sin gluten (Celíaco)', 'Sin lactosa', 'Dieta normal'].map((d) => (
                        <button
                          key={d}
                          type="button"
                          onClick={() => setDietaryRestrictionsES(d)}
                          className="px-2.5 py-1 rounded-lg bg-[#F5F6F8] border border-slate-200 hover:border-[#001558] text-[11px] text-[#001558] font-semibold cursor-pointer transition-colors"
                        >
                          + {d}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* 8. Vacunación */}
                <div
                  id="sec-vacunas"
                  className="scroll-mt-24 bg-white border border-slate-200 rounded-3xl p-6 shadow-xs space-y-4"
                >
                  <div className="flex items-center gap-2 pb-2 border-b border-slate-200 text-[#001558] font-bold text-xs uppercase tracking-wider">
                    <Syringe className="w-4 h-4 text-sky-600" />
                    <span>8. Vacunación e Inmunizaciones</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                    <div>
                      <label className="block text-slate-700 font-bold mb-1">
                        Año Última Dosis Antitetánica *
                      </label>
                      <input
                        type="text"
                        placeholder="Ej: 2024"
                        value={tetanusLastDoseYear}
                        onChange={(e) => setTetanusLastDoseYear(e.target.value)}
                        required
                        className={`${inputClassName} font-mono`}
                      />
                      <span className="text-[10px] text-slate-500 mt-0.5 block">
                        Debe tener refuerzo dentro de los últimos 10 años para campismo internacional.
                      </span>
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-slate-700 font-bold mb-1">
                        Otras Vacunas Relevantes
                      </label>
                      <input
                        type="text"
                        placeholder="Ej: Hepatitis A/B, Tres Vírica (MMR), COVID-19..."
                        value={vaccinationRecordsES}
                        onChange={(e) => setVaccinationRecordsES(e.target.value)}
                        className={`${inputClassName} text-xs`}
                      />
                    </div>
                  </div>
                </div>

                {/* 9. Cirugías, Dispositivos y Limitaciones Físicas */}
                <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs space-y-4">
                  <div className="flex items-center gap-2 pb-2 border-b border-slate-200 text-[#001558] font-bold text-xs uppercase tracking-wider">
                    <UserCheck className="w-4 h-4 text-[#001558]" />
                    <span>9. Cirugías Previas, Dispositivos y Limitaciones Físicas</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                    <div>
                      <label className="block text-slate-700 font-bold mb-1">Cirugías / Traumas</label>
                      <textarea
                        rows={2}
                        placeholder="Ej: Apendicectomía (2022), Fractura de brazo..."
                        value={pastSurgeriesInjuriesES}
                        onChange={(e) => setPastSurgeriesInjuriesES(e.target.value)}
                        className="w-full bg-white border border-slate-300 text-slate-800 placeholder-slate-400 focus:border-[#001558] focus:ring-2 focus:ring-[#FEB135]/50 focus:outline-none rounded-xl p-2.5"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-700 font-bold mb-1">Dispositivos Médicos</label>
                      <textarea
                        rows={2}
                        placeholder="Ej: Lentes ópticos de repuesto, Frenillos / Brackets, Aparato auditivo..."
                        value={devicesImplantsES}
                        onChange={(e) => setDevicesImplantsES(e.target.value)}
                        className="w-full bg-white border border-slate-300 text-slate-800 placeholder-slate-400 focus:border-[#001558] focus:ring-2 focus:ring-[#FEB135]/50 focus:outline-none rounded-xl p-2.5"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-700 font-bold mb-1">Capacidad Física y Natación</label>
                      <textarea
                        rows={2}
                        placeholder="Ej: Sabe nadar bien, Dificultad para caminatas de más de 10 km..."
                        value={physicalLimitationsES}
                        onChange={(e) => setPhysicalLimitationsES(e.target.value)}
                        className="w-full bg-white border border-slate-300 text-slate-800 placeholder-slate-400 focus:border-[#001558] focus:ring-2 focus:ring-[#FEB135]/50 focus:outline-none rounded-xl p-2.5"
                      />
                    </div>
                  </div>
                </div>

                {/* 10. Declaración Jurada y Consentimiento */}
                <div
                  id="sec-consentimiento"
                  className="scroll-mt-24 bg-[#FFFBF0] border border-[#FEB135]/50 border-l-4 border-l-[#FEB135] rounded-3xl p-6 shadow-xs space-y-4 text-[#001558]"
                >
                  <div className="flex items-center gap-2 font-black text-sm uppercase tracking-wider">
                    <Shield className="w-5 h-5 text-[#FEB135]" />
                    <span>10. Declaración y Autorización de Tratamiento Médico de Emergencia en Polonia</span>
                  </div>

                  <p className="text-xs text-slate-700 leading-relaxed">
                    Autorizo expresamente al equipo médico del Contingente Nacional de la Asociación de Guías y Scouts de Chile,
                    al personal de salud de la Organización del 26° Jamboree Scout Mundial y a los centros hospitalarios de la República de Polonia
                    a suministrar primeros auxilios, medicamentos de urgencia, traslados en ambulancia o intervenciones quirúrgicas de emergencia
                    en caso de ser estrictamente necesario para la preservación de la vida o salud del participante.
                  </p>

                  <label className="flex items-start gap-3 p-3.5 rounded-xl bg-white border border-slate-200 cursor-pointer text-xs font-bold text-[#001558]">
                    <input
                      type="checkbox"
                      checked={emergencyTreatmentConsent}
                      onChange={(e) => setEmergencyTreatmentConsent(e.target.checked)}
                      className="w-5 h-5 accent-[#001558] rounded mt-0.5 shrink-0"
                    />
                    <span>
                      Declaro bajo fe jurada que los antecedentes médicos proporcionados son verídicos, completos y actualizados. Autorizo el tratamiento médico de emergencia.
                    </span>
                  </label>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs pt-2">
                    <div>
                      <label className="block text-[#001558] font-bold mb-1">Nombre del Declarante *</label>
                      <input
                        type="text"
                        value={declaredByName}
                        onChange={(e) => setDeclaredByName(e.target.value)}
                        required
                        className={inputClassName}
                      />
                    </div>

                    <div>
                      <label className="block text-[#001558] font-bold mb-1">RUT del Declarante *</label>
                      <input
                        type="text"
                        placeholder="Ej: 12.345.678-9"
                        value={declaredByRut}
                        onChange={(e) => setDeclaredByRut(e.target.value)}
                        required
                        className={`${inputClassName} font-mono`}
                      />
                    </div>

                    <div>
                      <label className="block text-[#001558] font-bold mb-1">Calidad del Declarante *</label>
                      <select
                        value={declaredByRole}
                        onChange={(e) => setDeclaredByRole(e.target.value)}
                        className={`${inputClassName} font-bold`}
                      >
                        <option value="APODERADO">Apoderado / Padre / Madre</option>
                        <option value="PARTICIPANTE_ADULTO">Participante Mayor de Edad (IST / Dirigente / CMT)</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Barra de Acciones Inferior Pegajosa */}
                <div className="sticky bottom-3 z-20 print:hidden">
                  <div className="bg-white/95 backdrop-blur-sm border border-slate-200 border-t-2 border-t-[#001558] rounded-2xl p-3.5 sm:p-4 shadow-xl flex flex-col sm:flex-row items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 text-xs">
                      <span
                        className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                          savingMedical ? 'bg-[#FEB135] animate-pulse' : 'bg-emerald-500'
                        }`}
                      />
                      <div>
                        <p className="font-extrabold text-[#001558]">
                          {savingMedical
                            ? 'Guardando y traduciendo ficha médica...'
                            : 'Cambios listos para guardar y traducir'}
                        </p>
                        <p className="text-[11px] text-slate-500">
                          Se generará automáticamente el reporte clínico en Inglés y Polaco.
                        </p>
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={savingMedical}
                      className="w-full sm:w-auto px-6 py-3 rounded-xl bg-[#FEB135] hover:bg-[#e59c22] text-[#001558] font-black text-sm flex items-center justify-center gap-2 shadow-md cursor-pointer disabled:opacity-50 transition-all shrink-0"
                    >
                      {savingMedical ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Guardando y Traduciendo...
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-4 h-4" />
                          Guardar y Traducir Ficha
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </form>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
