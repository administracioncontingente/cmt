'use client';

import React, { useState } from 'react';
import Image from 'next/image';
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
  ArrowRight,
  RefreshCw,
  Info,
  Globe,
} from 'lucide-react';
import { formatRut, cleanRut, validateRut } from '@/lib/rut';

export default function FichaMedicaPage() {
  // Estado de pasos: 1 = Pedir OTP, 2 = Validar OTP, 3 = Llenar/Ver Ficha
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Paso 1: Solicitud de código
  const [rutInput, setRutInput] = useState('');
  const [emailInput, setEmailInput] = useState('');
  const [requestingOtp, setRequestingOtp] = useState(false);
  const [otpError, setOtpError] = useState<string | null>(null);

  // Paso 2: Validación OTP
  const [otpCode, setOtpCode] = useState('');
  const [verifyingOtp, setVerifyingOtp] = useState(false);
  const [participantId, setParticipantId] = useState('');
  const [participantName, setParticipantName] = useState('');
  const [maskedEmail, setMaskedEmail] = useState('');
  const [debugOtp, setDebugOtp] = useState<string | null>(null);

  // Paso 3: Ficha Médica
  const [editToken, setEditToken] = useState<string | null>(null);
  const [participant, setParticipant] = useState<any>(null);
  const [medicalRecord, setMedicalRecord] = useState<any>(null);
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

  // Manejar solicitud de OTP
  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setOtpError(null);

    const cleaned = cleanRut(rutInput);
    if (!validateRut(cleaned)) {
      setOtpError('Por favor ingresa un RUT chileno válido');
      return;
    }

    try {
      setRequestingOtp(true);
      const res = await fetch('/api/medical/request-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rut: rutInput, email: emailInput || undefined }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Error al solicitar código');
      }

      setParticipantId(data.participantId);
      setParticipantName(data.participantName);
      setMaskedEmail(data.maskedEmail);
      if (data.debugCode) {
        setDebugOtp(data.debugCode);
      }
      setStep(2);
    } catch (err: any) {
      setOtpError(err.message || 'Error al solicitar código');
    } finally {
      setRequestingOtp(false);
    }
  };

  // Manejar verificación de OTP
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setOtpError(null);

    if (!otpCode.trim() || otpCode.trim().length !== 6) {
      setOtpError('Ingresa el código numérico de 6 dígitos');
      return;
    }

    try {
      setVerifyingOtp(true);
      const res = await fetch('/api/medical/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          participantId,
          email: emailInput || maskedEmail,
          code: otpCode.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Código incorrecto');
      }

      setEditToken(data.editToken);
      setParticipant(data.participant);
      setMedicalRecord(data.medicalRecord);
      setQrEmergencyUrl(data.qrEmergencyUrl);
      setQrDataUrl(data.qrDataUrl);

      // Cargar valores iniciales en el formulario
      const m = data.medicalRecord || {};
      const p = data.participant || {};

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

      setHasSevereAllergies(!!m.hasSevereAllergies);
      setCarriesEpiPen(!!m.carriesEpiPen);
      setAllergiesES(m.allergiesES || p.medicalNotes || '');

      setHasChronicConditions(!!m.hasChronicConditions);
      setChronicConditionsES(m.chronicConditionsES || '');

      setTakesRegularMedication(!!m.takesRegularMedication);
      setRequiresColdChainMedication(!!m.requiresColdChainMedication);
      setCurrentMedicationsES(m.currentMedicationsES || '');

      setDietaryRestrictionsES(m.dietaryRestrictionsES || p.dietaryRestrictions || '');

      setTetanusLastDoseYear(m.tetanusLastDoseYear || '2024');
      setVaccinationRecordsES(m.vaccinationRecordsES || 'Vacunación completa según calendario nacional. Antitetánica al día.');

      setPastSurgeriesInjuriesES(m.pastSurgeriesInjuriesES || '');
      setDevicesImplantsES(m.devicesImplantsES || '');
      setPhysicalLimitationsES(m.physicalLimitationsES || 'Sabe nadar. Capacidad física óptima para actividades de campismo.');

      setEmergencyTreatmentConsent(m.emergencyTreatmentConsent ?? true);
      setDeclaredByName(m.declaredByName || p.guardianName || '');
      setDeclaredByRut(m.declaredByRut || '');
      setDeclaredByRole(m.declaredByRole || 'APODERADO');

      setStep(3);
    } catch (err: any) {
      setOtpError(err.message || 'Error al validar el código');
    } finally {
      setVerifyingOtp(false);
    }
  };

  // Guardar Ficha Médica y Generar Traducciones
  const handleSaveMedical = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveSuccessMsg(null);
    setOtpError(null);

    if (!emergencyTreatmentConsent) {
      alert('Debes aceptar la autorización de tratamiento médico de emergencia en el extranjero para continuar.');
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

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Error al guardar');
      }

      setMedicalRecord(data.medicalRecord);
      setQrEmergencyUrl(data.qrEmergencyUrl);
      setQrDataUrl(data.qrDataUrl);
      setSaveSuccessMsg('¡Ficha médica guardada y traducida rigurosamente al inglés y polaco con éxito!');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err: any) {
      setOtpError(err.message || 'Error al guardar ficha médica');
    } finally {
      setSavingMedical(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#000c33] text-slate-100 flex flex-col font-sans">
      {/* Header Institucional */}
      <header className="bg-[#001558] border-b border-[#0d349e] py-4 px-4 sm:px-8 shadow-lg">
        <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="relative w-44 h-12">
              <Image
                src="/agsch-logo-white.svg"
                alt="Guías y Scouts de Chile"
                fill
                priority
                className="object-contain object-left"
              />
            </div>
            <div className="hidden sm:block pl-3 border-l border-[#0d349e]">
              <span className="font-black text-sm text-white">Polonia 2027</span>
              <p className="text-[11px] text-slate-300">Ficha Médica Oficial del Contingente</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="px-3 py-1 rounded-full bg-[#000c33] border border-[#FEB135]/50 text-[#FEB135] text-xs font-bold flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5" />
              Portal Confidencial de Salud
            </span>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-5xl w-full mx-auto p-4 sm:p-6">
        {/* PASO 1: Ingreso de RUT y Correo */}
        {step === 1 && (
          <div className="max-w-md mx-auto my-8 bg-[#001558] border border-[#0d349e] rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
            <div className="text-center space-y-2">
              <div className="w-14 h-14 rounded-2xl bg-[#000c33] border border-[#FEB135]/40 text-[#FEB135] flex items-center justify-center mx-auto shadow-inner">
                <Heart className="w-7 h-7" />
              </div>
              <h1 className="text-xl font-black text-white">Ficha Médica Polonia 2027</h1>
              <p className="text-xs text-slate-300">
                Acceso exclusivo para participantes y apoderados mediante código de seguridad enviado al correo.
              </p>
            </div>

            {otpError && (
              <div className="p-3.5 rounded-xl bg-red-950/80 border border-red-700 text-red-200 text-xs flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{otpError}</span>
              </div>
            )}

            <form onSubmit={handleRequestOtp} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-bold uppercase tracking-wider mb-1.5">
                  RUT del Participante *
                </label>
                <input
                  type="text"
                  placeholder="Ej: 21.345.678-4"
                  value={rutInput}
                  onChange={(e) => setRutInput(e.target.value)}
                  onBlur={() => rutInput && setRutInput(formatRut(rutInput))}
                  required
                  className="w-full bg-[#000c33] border border-[#0d349e] focus:border-[#FEB135] rounded-xl px-4 py-3 text-white font-mono text-sm focus:outline-none"
                />
                <span className="text-[10px] text-slate-400 mt-1 block">
                  Identificador nacional oficial registrado en la nómina.
                </span>
              </div>

              <div>
                <label className="block text-slate-300 font-bold uppercase tracking-wider mb-1.5">
                  Correo del Apoderado o Participante (Opcional)
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                  <input
                    type="email"
                    placeholder="correo@ejemplo.cl"
                    value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)}
                    className="w-full bg-[#000c33] border border-[#0d349e] focus:border-[#FEB135] rounded-xl pl-10 pr-4 py-3 text-white text-sm focus:outline-none"
                  />
                </div>
                <span className="text-[10px] text-slate-400 mt-1 block">
                  Si lo dejas en blanco, se enviará automáticamente al correo registrado en la ficha oficial.
                </span>
              </div>

              <button
                type="submit"
                disabled={requestingOtp}
                className="w-full py-3.5 rounded-xl bg-[#FEB135] hover:bg-[#e59c22] text-[#001558] font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-[#FEB135]/20 cursor-pointer disabled:opacity-50 transition-all"
              >
                {requestingOtp ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Buscando participante...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    Enviar Código de Verificación
                  </>
                )}
              </button>
            </form>
          </div>
        )}

        {/* PASO 2: Validación del Código de 6 Dígitos */}
        {step === 2 && (
          <div className="max-w-md mx-auto my-8 bg-[#001558] border border-[#0d349e] rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
            <div className="text-center space-y-2">
              <div className="w-14 h-14 rounded-2xl bg-[#000c33] border border-[#FEB135]/40 text-[#FEB135] flex items-center justify-center mx-auto shadow-inner">
                <Lock className="w-7 h-7" />
              </div>
              <h1 className="text-xl font-black text-white">Ingresa el Código de Validación</h1>
              <p className="text-xs text-slate-300">
                Hemos enviado un código de 6 dígitos para validar a{' '}
                <span className="text-[#FEB135] font-bold">{participantName}</span> al correo:{' '}
                <span className="text-white font-mono font-bold">{maskedEmail}</span>.
              </p>
            </div>

            {otpError && (
              <div className="p-3.5 rounded-xl bg-red-950/80 border border-red-700 text-red-200 text-xs flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{otpError}</span>
              </div>
            )}

            {debugOtp && (
              <div className="p-3 bg-[#000c33] border border-[#FEB135]/40 rounded-xl text-center">
                <p className="text-[11px] text-slate-300">
                  Modo Pruebas / Código generado:{' '}
                  <span className="text-[#FEB135] font-mono font-black text-sm">{debugOtp}</span>
                </p>
                <button
                  type="button"
                  onClick={() => setOtpCode(debugOtp)}
                  className="mt-1 text-[10px] text-[#FEB135] underline font-bold"
                >
                  Autocompletar código
                </button>
              </div>
            )}

            <form onSubmit={handleVerifyOtp} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-bold uppercase tracking-wider mb-1.5 text-center">
                  Código de 6 Dígitos
                </label>
                <input
                  type="text"
                  maxLength={6}
                  placeholder="123456"
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                  required
                  className="w-full bg-[#000c33] border-2 border-[#0d349e] focus:border-[#FEB135] rounded-xl px-4 py-3 text-center text-white font-mono text-2xl tracking-widest font-black focus:outline-none"
                />
                <span className="text-[10px] text-slate-400 text-center block mt-1">
                  El código tiene una validez de 15 minutos.
                </span>
              </div>

              <button
                type="submit"
                disabled={verifyingOtp}
                className="w-full py-3.5 rounded-xl bg-[#FEB135] hover:bg-[#e59c22] text-[#001558] font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-[#FEB135]/20 cursor-pointer disabled:opacity-50 transition-all"
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
                  onClick={() => setStep(1)}
                  className="text-xs text-slate-400 hover:text-white underline cursor-pointer"
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
              <div className="p-4 rounded-2xl bg-emerald-950/80 border border-emerald-500 text-emerald-200 text-xs flex items-center justify-between shadow-xl">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                  <span className="font-bold">{saveSuccessMsg}</span>
                </div>
                <button
                  onClick={() => setSaveSuccessMsg(null)}
                  className="text-emerald-300 hover:text-white font-bold ml-2"
                >
                  ✕
                </button>
              </div>
            )}

            {/* Cabecera del Participante y Código QR */}
            <div className="bg-[#001558] border border-[#0d349e] rounded-3xl p-6 shadow-2xl flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-2xl font-black text-white">
                    {participant.firstName} {participant.lastName} {participant.secondLastName || ''}
                  </h1>
                  {participant.cupoCode && (
                    <span className="px-2.5 py-0.5 rounded-lg bg-[#000c33] border border-[#FEB135]/50 text-[#FEB135] text-xs font-mono font-bold">
                      Cupo: {participant.cupoCode}
                    </span>
                  )}
                  <span className="px-2.5 py-0.5 rounded-full bg-[#031c6a] text-indigo-200 text-xs font-bold border border-[#0d349e]">
                    {participant.contingentRole}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs text-slate-300 pt-1">
                  <div>
                    <span className="text-slate-400 text-[10px] block uppercase">RUT</span>
                    <span className="font-mono font-bold text-white">{participant.rut}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 text-[10px] block uppercase">Fecha Nacimiento</span>
                    <span className="font-medium text-white">
                      {participant.birthDate
                        ? new Date(participant.birthDate).toLocaleDateString()
                        : 'No informada'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 text-[10px] block uppercase">Grupo Scout</span>
                    <span className="font-medium text-white">{participant.scoutGroup || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 text-[10px] block uppercase">Estado Ficha</span>
                    <span className="font-bold text-[#FEB135]">
                      {medicalRecord?.completionStatus === 'COMPLETED' ? 'Completada y Traducida' : 'Pendiente de Completar'}
                    </span>
                  </div>
                </div>
              </div>

              {/* QR Code de Emergencia */}
              {qrDataUrl && (
                <div className="flex items-center gap-3 bg-[#000c33] p-3 rounded-2xl border border-[#FEB135]/40 shrink-0">
                  <div className="p-1 bg-white rounded-xl">
                    <img src={qrDataUrl} alt="QR Médico" className="w-20 h-20" />
                  </div>
                  <div className="text-left text-xs space-y-1">
                    <span className="font-bold text-[#FEB135] block text-[11px]">
                      QR de Emergencia
                    </span>
                    <p className="text-[10px] text-slate-400 max-w-[130px]">
                      Acceso para paramédicos en Polonia (Inglés/Polaco)
                    </p>
                    <a
                      href={qrEmergencyUrl || '#'}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[10px] text-[#FEB135] font-bold hover:underline"
                    >
                      <ExternalLink className="w-3 h-3" />
                      Probar QR
                    </a>
                  </div>
                </div>
              )}
            </div>

            {/* Selector de Pestañas de Idioma */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#0d349e] pb-3">
              <div className="flex bg-[#001558] border border-[#0d349e] rounded-xl p-1 text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setActiveLangTab('es')}
                  className={`px-4 py-2 rounded-lg transition-all flex items-center gap-2 ${
                    activeLangTab === 'es'
                      ? 'bg-[#FEB135] text-[#001558] font-black shadow-md'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  🇨🇱 Español (Original Editable)
                </button>
                <button
                  type="button"
                  onClick={() => setActiveLangTab('en')}
                  className={`px-4 py-2 rounded-lg transition-all flex items-center gap-2 ${
                    activeLangTab === 'en'
                      ? 'bg-[#FEB135] text-[#001558] font-black shadow-md'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  🇬🇧 English (Medical Report WSJ)
                </button>
                <button
                  type="button"
                  onClick={() => setActiveLangTab('pl')}
                  className={`px-4 py-2 rounded-lg transition-all flex items-center gap-2 ${
                    activeLangTab === 'pl'
                      ? 'bg-[#FEB135] text-[#001558] font-black shadow-md'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  🇵🇱 Polski (Karta Medyczna)
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-3.5 py-2 rounded-xl bg-[#001558] border border-[#0d349e] hover:border-[#FEB135] text-slate-200 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  Imprimir Ficha
                </button>
              </div>
            </div>

            {/* Vista en Inglés o Polaco (Modo Lectura / Reporte Médico) */}
            {activeLangTab !== 'es' && (
              <div className="bg-[#001558] border border-[#0d349e] rounded-3xl p-6 shadow-2xl space-y-5">
                <div className="flex items-center justify-between pb-3 border-b border-[#0d349e]">
                  <div className="flex items-center gap-2 text-xs font-bold text-[#FEB135]">
                    <Globe className="w-4 h-4" />
                    <span>
                      {activeLangTab === 'en'
                        ? 'OFFICIAL WSJ 2027 ENGLISH MEDICAL REPORT'
                        : 'OFICJALNA KARTA MEDYCZNA WSJ 2027 W JĘZYKU POLSKIM'}
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-400">
                    Traducción médica estandarizada según normativa sanitaria polaca
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div className="bg-[#000c33] p-4 rounded-2xl border border-[#0d349e] space-y-1">
                    <span className="text-[10px] font-bold text-red-300 uppercase tracking-wider">
                      {activeLangTab === 'en' ? 'Allergies & Severe Anaphylaxis Risk' : 'Alergie i Ryzyko Anafilaksji'}
                    </span>
                    <p className="text-white font-medium">
                      {activeLangTab === 'en'
                        ? medicalRecord?.allergiesEN || 'No known allergies reported'
                        : medicalRecord?.allergiesPL || 'Brak zgłoszonych alergii'}
                    </p>
                  </div>

                  <div className="bg-[#000c33] p-4 rounded-2xl border border-[#0d349e] space-y-1">
                    <span className="text-[10px] font-bold text-[#FEB135] uppercase tracking-wider">
                      {activeLangTab === 'en' ? 'Chronic Medical Conditions' : 'Choroby Przewlekłe'}
                    </span>
                    <p className="text-white font-medium">
                      {activeLangTab === 'en'
                        ? medicalRecord?.chronicConditionsEN || 'None reported'
                        : medicalRecord?.chronicConditionsPL || 'Brak zgłoszonych'}
                    </p>
                  </div>

                  <div className="bg-[#000c33] p-4 rounded-2xl border border-[#0d349e] space-y-1">
                    <span className="text-[10px] font-bold text-indigo-300 uppercase tracking-wider">
                      {activeLangTab === 'en' ? 'Current Medications' : 'Aktualnie Przyjmowane Leki'}
                    </span>
                    <p className="text-white font-medium">
                      {activeLangTab === 'en'
                        ? medicalRecord?.currentMedicationsEN || 'None'
                        : medicalRecord?.currentMedicationsPL || 'Brak'}
                    </p>
                  </div>

                  <div className="bg-[#000c33] p-4 rounded-2xl border border-[#0d349e] space-y-1">
                    <span className="text-[10px] font-bold text-emerald-300 uppercase tracking-wider">
                      {activeLangTab === 'en' ? 'Dietary Restrictions' : 'Ograniczenia Dietetyczne'}
                    </span>
                    <p className="text-white font-medium">
                      {activeLangTab === 'en'
                        ? medicalRecord?.dietaryRestrictionsEN || 'Standard diet'
                        : medicalRecord?.dietaryRestrictionsPL || 'Dieta standardowa'}
                    </p>
                  </div>

                  <div className="bg-[#000c33] p-4 rounded-2xl border border-[#0d349e] space-y-1">
                    <span className="text-[10px] font-bold text-cyan-300 uppercase tracking-wider">
                      {activeLangTab === 'en' ? 'Vaccination History' : 'Szczepienia'}
                    </span>
                    <p className="text-white font-medium">
                      {activeLangTab === 'en'
                        ? medicalRecord?.vaccinationRecordsEN || 'Up to date'
                        : medicalRecord?.vaccinationRecordsPL || 'Aktualne'}
                    </p>
                  </div>

                  <div className="bg-[#000c33] p-4 rounded-2xl border border-[#0d349e] space-y-1">
                    <span className="text-[10px] font-bold text-slate-300 uppercase tracking-wider">
                      {activeLangTab === 'en' ? 'Physical & Swimming Limitations' : 'Ograniczenia Aktywności'}
                    </span>
                    <p className="text-white font-medium">
                      {activeLangTab === 'en'
                        ? medicalRecord?.physicalLimitationsEN || 'Full capacity'
                        : medicalRecord?.physicalLimitationsPL || 'Pełna zdolność'}
                    </p>
                  </div>
                </div>

                <div className="text-center pt-2">
                  <button
                    type="button"
                    onClick={() => setActiveLangTab('es')}
                    className="text-xs text-[#FEB135] underline font-bold"
                  >
                    ← Modificar datos en la ficha en español para regenerar la traducción
                  </button>
                </div>
              </div>
            )}

            {/* Formulario en Español (Edición y Guardado) */}
            {activeLangTab === 'es' && (
              <form onSubmit={handleSaveMedical} className="space-y-6">
                {/* 1. Biometría y Grupo Sanguíneo */}
                <div className="bg-[#001558] border border-[#0d349e] rounded-3xl p-6 shadow-xl space-y-4">
                  <div className="flex items-center gap-2 pb-2 border-b border-[#0d349e] text-[#FEB135] font-bold text-xs uppercase tracking-wider">
                    <Droplet className="w-4 h-4" />
                    <span>1. Grupo Sanguíneo y Datos Biométricos</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                    <div>
                      <label className="block text-slate-300 font-bold mb-1">
                        Grupo Sanguíneo / Factor Rh *
                      </label>
                      <select
                        value={bloodType}
                        onChange={(e) => setBloodType(e.target.value)}
                        className="w-full bg-[#000c33] border border-[#0d349e] focus:border-[#FEB135] rounded-xl px-3 py-2.5 text-white font-bold"
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
                      <label className="block text-slate-300 font-bold mb-1">Estatura (cm)</label>
                      <input
                        type="number"
                        placeholder="Ej: 168"
                        value={heightCm}
                        onChange={(e) => setHeightCm(e.target.value)}
                        className="w-full bg-[#000c33] border border-[#0d349e] focus:border-[#FEB135] rounded-xl px-3 py-2.5 text-white font-mono"
                      />
                    </div>

                    <div>
                      <label className="block text-slate-300 font-bold mb-1">Peso (kg)</label>
                      <input
                        type="number"
                        placeholder="Ej: 62"
                        value={weightKg}
                        onChange={(e) => setWeightKg(e.target.value)}
                        className="w-full bg-[#000c33] border border-[#0d349e] focus:border-[#FEB135] rounded-xl px-3 py-2.5 text-white font-mono"
                      />
                    </div>
                  </div>
                </div>

                {/* 2. Contacto de Emergencia */}
                <div className="bg-[#001558] border border-[#0d349e] rounded-3xl p-6 shadow-xl space-y-4">
                  <div className="flex items-center gap-2 pb-2 border-b border-[#0d349e] text-[#FEB135] font-bold text-xs uppercase tracking-wider">
                    <Phone className="w-4 h-4" />
                    <span>2. Contacto de Emergencia en Chile (Apoderado / Familiar Directo)</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
                    <div>
                      <label className="block text-slate-300 font-bold mb-1">Nombre Completo *</label>
                      <input
                        type="text"
                        value={emergencyContactName}
                        onChange={(e) => setEmergencyContactName(e.target.value)}
                        required
                        className="w-full bg-[#000c33] border border-[#0d349e] focus:border-[#FEB135] rounded-xl px-3 py-2.5 text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-300 font-bold mb-1">Parentesco / Relación *</label>
                      <input
                        type="text"
                        placeholder="Madre, Padre, Cónyuge..."
                        value={emergencyContactRelation}
                        onChange={(e) => setEmergencyContactRelation(e.target.value)}
                        required
                        className="w-full bg-[#000c33] border border-[#0d349e] focus:border-[#FEB135] rounded-xl px-3 py-2.5 text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-300 font-bold mb-1">Teléfono con código de país *</label>
                      <input
                        type="tel"
                        placeholder="+56 9 1234 5678"
                        value={emergencyContactPhone}
                        onChange={(e) => setEmergencyContactPhone(e.target.value)}
                        required
                        className="w-full bg-[#000c33] border border-[#0d349e] focus:border-[#FEB135] rounded-xl px-3 py-2.5 text-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-300 font-bold mb-1">Correo Electrónico *</label>
                      <input
                        type="email"
                        value={emergencyContactEmail}
                        onChange={(e) => setEmergencyContactEmail(e.target.value)}
                        required
                        className="w-full bg-[#000c33] border border-[#0d349e] focus:border-[#FEB135] rounded-xl px-3 py-2.5 text-white"
                      />
                    </div>
                  </div>
                </div>

                {/* 3. Alergias e Hipersensibilidades */}
                <div className="bg-[#001558] border border-[#0d349e] rounded-3xl p-6 shadow-xl space-y-4">
                  <div className="flex items-center justify-between pb-2 border-b border-[#0d349e]">
                    <div className="flex items-center gap-2 text-red-400 font-bold text-xs uppercase tracking-wider">
                      <AlertTriangle className="w-4 h-4" />
                      <span>3. Alergias a Medicamentos, Alimentos o Picaduras</span>
                    </div>

                    <div className="flex items-center gap-4 text-xs">
                      <label className="flex items-center gap-2 cursor-pointer text-red-300 font-bold">
                        <input
                          type="checkbox"
                          checked={hasSevereAllergies}
                          onChange={(e) => setHasSevereAllergies(e.target.checked)}
                          className="w-4 h-4 accent-red-600 rounded"
                        />
                        <span>Riesgo de Anafilaxia / Alergia Severa</span>
                      </label>

                      <label className="flex items-center gap-2 cursor-pointer text-[#FEB135] font-bold">
                        <input
                          type="checkbox"
                          checked={carriesEpiPen}
                          onChange={(e) => setCarriesEpiPen(e.target.checked)}
                          className="w-4 h-4 accent-[#FEB135] rounded"
                        />
                        <span>Porta Autoinyector de Epinefrina (EpiPen)</span>
                      </label>
                    </div>
                  </div>

                  <div className="text-xs space-y-1.5">
                    <label className="block text-slate-300 font-bold">
                      Detalle de Alergias (Medicamentos, Maní, Mariscos, Picaduras, Látex, etc.)
                    </label>
                    <textarea
                      rows={2}
                      placeholder="Ej: Penicilina (shock anafiláctico), Picadura de avispa (porta EpiPen), Maní..."
                      value={allergiesES}
                      onChange={(e) => setAllergiesES(e.target.value)}
                      className="w-full bg-[#000c33] border border-[#0d349e] focus:border-[#FEB135] rounded-xl p-3 text-white focus:outline-none"
                    />
                    <span className="text-[10px] text-slate-400 block">
                      Si no tiene ninguna alergia conocida, escribe &quot;Ninguna conocida&quot;.
                    </span>
                  </div>
                </div>

                {/* 4. Condiciones Médicas Crónicas */}
                <div className="bg-[#001558] border border-[#0d349e] rounded-3xl p-6 shadow-xl space-y-4">
                  <div className="flex items-center justify-between pb-2 border-b border-[#0d349e]">
                    <div className="flex items-center gap-2 text-[#FEB135] font-bold text-xs uppercase tracking-wider">
                      <Heart className="w-4 h-4" />
                      <span>4. Condiciones Médicas Crónicas / Diagnósticos Previos</span>
                    </div>

                    <label className="flex items-center gap-2 cursor-pointer text-[#FEB135] text-xs font-bold">
                      <input
                        type="checkbox"
                        checked={hasChronicConditions}
                        onChange={(e) => setHasChronicConditions(e.target.checked)}
                        className="w-4 h-4 accent-[#FEB135] rounded"
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
                      className="w-full bg-[#000c33] border border-[#0d349e] focus:border-[#FEB135] rounded-xl p-3 text-white focus:outline-none"
                    />
                    <span className="text-[10px] text-slate-400 block">
                      Indica cualquier condición que requiera seguimiento o atención por el equipo de salud del WSJ.
                    </span>
                  </div>
                </div>

                {/* 5. Medicación Habitual */}
                <div className="bg-[#001558] border border-[#0d349e] rounded-3xl p-6 shadow-xl space-y-4">
                  <div className="flex items-center justify-between pb-2 border-b border-[#0d349e]">
                    <div className="flex items-center gap-2 text-indigo-300 font-bold text-xs uppercase tracking-wider">
                      <Pill className="w-4 h-4" />
                      <span>5. Medicamentos Habituales / Uso Continuo</span>
                    </div>

                    <div className="flex items-center gap-4 text-xs">
                      <label className="flex items-center gap-2 cursor-pointer text-indigo-200 font-bold">
                        <input
                          type="checkbox"
                          checked={takesRegularMedication}
                          onChange={(e) => setTakesRegularMedication(e.target.checked)}
                          className="w-4 h-4 accent-indigo-500 rounded"
                        />
                        <span>Toma fármacos diariamente</span>
                      </label>

                      <label className="flex items-center gap-2 cursor-pointer text-cyan-300 font-bold">
                        <input
                          type="checkbox"
                          checked={requiresColdChainMedication}
                          onChange={(e) => setRequiresColdChainMedication(e.target.checked)}
                          className="w-4 h-4 accent-cyan-500 rounded"
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
                      className="w-full bg-[#000c33] border border-[#0d349e] focus:border-[#FEB135] rounded-xl p-3 text-white focus:outline-none"
                    />
                    <span className="text-[10px] text-slate-400 block">
                      Incluye principio activo, dosis exacta, frecuencia y si el participante es autónomo en su administración.
                    </span>
                  </div>
                </div>

                {/* 6. Restricciones Alimentarias y Dietas */}
                <div className="bg-[#001558] border border-[#0d349e] rounded-3xl p-6 shadow-xl space-y-4">
                  <div className="flex items-center gap-2 pb-2 border-b border-[#0d349e] text-emerald-300 font-bold text-xs uppercase tracking-wider">
                    <FileText className="w-4 h-4" />
                    <span>6. Régimen Alimentario / Intolerancias</span>
                  </div>

                  <div className="text-xs space-y-2">
                    <input
                      type="text"
                      placeholder="Ej: Vegetariano, Vegano, Celíaco estricto (sin gluten), Sin lactosa, Kosher..."
                      value={dietaryRestrictionsES}
                      onChange={(e) => setDietaryRestrictionsES(e.target.value)}
                      className="w-full bg-[#000c33] border border-[#0d349e] focus:border-[#FEB135] rounded-xl px-4 py-3 text-white text-xs"
                    />
                    <div className="flex flex-wrap gap-2 pt-1">
                      {['Vegetariano', 'Vegano', 'Sin gluten (Celíaco)', 'Sin lactosa', 'Dieta normal'].map((d) => (
                        <button
                          key={d}
                          type="button"
                          onClick={() => setDietaryRestrictionsES(d)}
                          className="px-2.5 py-1 rounded-lg bg-[#000c33] border border-[#0d349e] hover:border-[#FEB135] text-[11px] text-slate-300"
                        >
                          + {d}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* 7. Vacunación */}
                <div className="bg-[#001558] border border-[#0d349e] rounded-3xl p-6 shadow-xl space-y-4">
                  <div className="flex items-center gap-2 pb-2 border-b border-[#0d349e] text-cyan-300 font-bold text-xs uppercase tracking-wider">
                    <Syringe className="w-4 h-4" />
                    <span>7. Vacunación e Inmunizaciones</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                    <div>
                      <label className="block text-slate-300 font-bold mb-1">
                        Año Última Dosis Antitetánica *
                      </label>
                      <input
                        type="text"
                        placeholder="Ej: 2024"
                        value={tetanusLastDoseYear}
                        onChange={(e) => setTetanusLastDoseYear(e.target.value)}
                        required
                        className="w-full bg-[#000c33] border border-[#0d349e] focus:border-[#FEB135] rounded-xl px-3 py-2.5 text-white font-mono"
                      />
                      <span className="text-[10px] text-slate-400 mt-0.5 block">
                        Debe tener refuerzo dentro de los últimos 10 años para campismo internacional.
                      </span>
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-slate-300 font-bold mb-1">
                        Otras Vacunas Relevantes
                      </label>
                      <input
                        type="text"
                        placeholder="Ej: Hepatitis A/B, Tres Vírica (MMR), COVID-19..."
                        value={vaccinationRecordsES}
                        onChange={(e) => setVaccinationRecordsES(e.target.value)}
                        className="w-full bg-[#000c33] border border-[#0d349e] focus:border-[#FEB135] rounded-xl px-3 py-2.5 text-white text-xs"
                      />
                    </div>
                  </div>
                </div>

                {/* 8. Cirugías, Dispositivos y Limitaciones Físicas */}
                <div className="bg-[#001558] border border-[#0d349e] rounded-3xl p-6 shadow-xl space-y-4">
                  <div className="flex items-center gap-2 pb-2 border-b border-[#0d349e] text-slate-300 font-bold text-xs uppercase tracking-wider">
                    <UserCheck className="w-4 h-4" />
                    <span>8. Cirugías Previas, Dispositivos y Limitaciones Físicas</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                    <div>
                      <label className="block text-slate-300 font-bold mb-1">Cirugías / Traumas</label>
                      <textarea
                        rows={2}
                        placeholder="Ej: Apendicectomía (2022), Fractura de brazo..."
                        value={pastSurgeriesInjuriesES}
                        onChange={(e) => setPastSurgeriesInjuriesES(e.target.value)}
                        className="w-full bg-[#000c33] border border-[#0d349e] focus:border-[#FEB135] rounded-xl p-2.5 text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-300 font-bold mb-1">Dispositivos Médicos</label>
                      <textarea
                        rows={2}
                        placeholder="Ej: Lentes ópticos de repuesto, Frenillos / Brackets, Aparato auditivo..."
                        value={devicesImplantsES}
                        onChange={(e) => setDevicesImplantsES(e.target.value)}
                        className="w-full bg-[#000c33] border border-[#0d349e] focus:border-[#FEB135] rounded-xl p-2.5 text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-300 font-bold mb-1">Capacidad Física y Natación</label>
                      <textarea
                        rows={2}
                        placeholder="Ej: Sabe nadar bien, Dificultad para caminatas de más de 10 km..."
                        value={physicalLimitationsES}
                        onChange={(e) => setPhysicalLimitationsES(e.target.value)}
                        className="w-full bg-[#000c33] border border-[#0d349e] focus:border-[#FEB135] rounded-xl p-2.5 text-white"
                      />
                    </div>
                  </div>
                </div>

                {/* 9. Declaración Jurada y Consentimiento */}
                <div className="bg-[#000c33] border-2 border-[#FEB135]/60 rounded-3xl p-6 shadow-2xl space-y-4">
                  <div className="flex items-center gap-2 text-[#FEB135] font-black text-sm uppercase tracking-wider">
                    <Shield className="w-5 h-5" />
                    <span>9. Declaración y Autorización de Tratamiento Médico de Emergencia en Polonia</span>
                  </div>

                  <p className="text-xs text-slate-300 leading-relaxed">
                    Autorizo expresamente al equipo médico del Contingente Nacional de la Asociación de Guías y Scouts de Chile,
                    al personal de salud de la Organización del 26° Jamboree Scout Mundial y a los centros hospitalarios de la República de Polonia
                    a suministrar primeros auxilios, medicamentos de urgencia, traslados en ambulancia o intervenciones quirúrgicas de emergencia
                    en caso de ser estrictamente necesario para la preservación de la vida o salud del participante.
                  </p>

                  <label className="flex items-start gap-3 p-3 rounded-xl bg-[#001558] border border-[#0d349e] cursor-pointer text-xs font-bold text-white">
                    <input
                      type="checkbox"
                      checked={emergencyTreatmentConsent}
                      onChange={(e) => setEmergencyTreatmentConsent(e.target.checked)}
                      required
                      className="w-5 h-5 accent-[#FEB135] rounded mt-0.5"
                    />
                    <span>
                      Declaro bajo fe jurada que los antecedentes médicos proporcionados son verídicos, completos y actualizados. Autorizo el tratamiento médico de emergencia.
                    </span>
                  </label>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs pt-2">
                    <div>
                      <label className="block text-slate-300 font-bold mb-1">Nombre del Declarante *</label>
                      <input
                        type="text"
                        value={declaredByName}
                        onChange={(e) => setDeclaredByName(e.target.value)}
                        required
                        className="w-full bg-[#001558] border border-[#0d349e] focus:border-[#FEB135] rounded-xl px-3 py-2 text-white"
                      />
                    </div>

                    <div>
                      <label className="block text-slate-300 font-bold mb-1">RUT del Declarante *</label>
                      <input
                        type="text"
                        placeholder="Ej: 12.345.678-9"
                        value={declaredByRut}
                        onChange={(e) => setDeclaredByRut(e.target.value)}
                        required
                        className="w-full bg-[#001558] border border-[#0d349e] focus:border-[#FEB135] rounded-xl px-3 py-2 text-white font-mono"
                      />
                    </div>

                    <div>
                      <label className="block text-slate-300 font-bold mb-1">Calidad del Declarante *</label>
                      <select
                        value={declaredByRole}
                        onChange={(e) => setDeclaredByRole(e.target.value)}
                        className="w-full bg-[#001558] border border-[#0d349e] focus:border-[#FEB135] rounded-xl px-3 py-2 text-white font-bold"
                      >
                        <option value="APODERADO">Apoderado / Padre / Madre</option>
                        <option value="PARTICIPANTE_ADULTO">Participante Mayor de Edad (IST / Dirigente / CMT)</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Botón Principal Guardar */}
                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={savingMedical}
                    className="w-full py-4 rounded-2xl bg-[#FEB135] hover:bg-[#e59c22] text-[#001558] font-black text-base flex items-center justify-center gap-2 shadow-2xl shadow-[#FEB135]/30 cursor-pointer disabled:opacity-50 transition-all"
                  >
                    {savingMedical ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Guardando y Traduciendo a Inglés y Polaco...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-5 h-5" />
                        Guardar Ficha Oficial y Generar Traducciones Clínicas
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
