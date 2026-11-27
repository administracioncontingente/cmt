'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import {
  AlertTriangle,
  Phone,
  PhoneOff,
  Shield,
  Heart,
  Droplet,
  Pill,
  Syringe,
  FileText,
  UserCheck,
  CheckCircle2,
  Printer,
  Loader2,
} from 'lucide-react';
import type { ParticipantDTO, MedicalRecordDTO } from '@/types/domain';

interface EmergencyMedicalResponse {
  success: boolean;
  participant: ParticipantDTO;
  medicalRecord: MedicalRecordDTO;
  qrEmergencyUrl?: string;
  qrDataUrl?: string;
  error?: string;
}

function normalizeTelHref(phone?: string | null): string | null {
  const trimmed = phone?.trim();
  if (!trimmed || !/\d{3,}/.test(trimmed)) {
    return null;
  }
  const sanitized = trimmed.replace(/[^+\d]/g, '');
  return sanitized.length >= 3 ? `tel:${sanitized}` : null;
}

function MedicalContent() {
  const params = useParams<{ code?: string }>();
  const code = params?.code;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<EmergencyMedicalResponse | null>(null);
  const [lang, setLang] = useState<'en' | 'pl' | 'es'>('en'); // Default English for international paramedics

  useEffect(() => {
    if (!code) return;
    const controller = new AbortController();
    let cancelled = false;

    async function loadRecord() {
      await Promise.resolve();
      if (cancelled) return;
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/medical/qr/${code}`, { signal: controller.signal });
        if (!res.ok) {
          const errData = (await res.json()) as { error?: string };
          throw new Error(errData.error || 'Medical record not found');
        }
        const json = (await res.json()) as EmergencyMedicalResponse;
        if (!cancelled) {
          setData(json);
        }
      } catch (err: unknown) {
        if (!cancelled && !(err instanceof DOMException && err.name === 'AbortError')) {
          setError(err instanceof Error ? err.message : 'Error loading medical record');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadRecord();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [code]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F5F6F8] flex flex-col items-center justify-center p-4 text-center">
        <Loader2 className="w-10 h-10 text-[#001558] animate-spin mb-4" />
        <h2 className="text-[#001558] font-bold text-lg">Loading AGSCH Medical Profile...</h2>
        <p className="text-slate-500 text-xs mt-1">
          Ładowanie karty medycznej / Cargando ficha médica...
        </p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-[#F5F6F8] flex flex-col items-center justify-center p-4 text-center">
        <div className="bg-white border-2 border-red-300 rounded-2xl p-6 max-w-md w-full shadow-lg">
          <AlertTriangle className="w-12 h-12 text-red-600 mx-auto mb-3" />
          <h2 className="text-[#001558] font-black text-lg">Medical Record Error</h2>
          <p className="text-red-700 text-xs font-semibold mt-2">
            {error || 'Invalid or expired medical QR code'}
          </p>
          <p className="text-slate-500 text-[11px] mt-1">
            Nie znaleziono danych medycznych / Ficha no encontrada
          </p>
        </div>
      </div>
    );
  }

  const { participant, medicalRecord, qrDataUrl } = data;

  const t = {
    en: {
      emergencyTitle: 'EMERGENCY MEDICAL PROFILE',
      eventBadge: 'AGSCH CHILE',
      subtitle: 'Chilean Contingent • Asociación de Guías y Scouts de Chile',
      criticalAlert: 'CRITICAL MEDICAL ALERT / HIGH RISK',
      allergies: 'Allergies & Hypersensitivities',
      epipen: 'PATIENT CARRIES EPINEPHRINE AUTO-INJECTOR (EpiPen)',
      bloodType: 'Blood Type / Rh Group',
      rutPassport: 'RUT / Passport ID',
      contingentRole: 'Contingent Role',
      genderBirth: 'Gender / Birth',
      notReported: 'N/R',
      notSpecified: 'N/A',
      heightLabel: 'Height',
      weightLabel: 'Weight',
      heightNotReported: 'Height N/R',
      weightNotReported: 'Weight N/R',
      emergencyContact: 'Emergency Contact Person',
      defaultContactName: 'Guardian / Emergency Contact',
      relationship: 'Relationship',
      defaultRelationship: 'Parent / Guardian',
      callEmergencyAction: 'Call Emergency',
      noPhoneRegistered: 'No Phone Registered',
      travelInsurance: 'International Travel Insurance',
      defaultInsuranceCompany: 'Assistance / Travel Insurance Policy',
      policyNumber: 'Policy Number',
      defaultPolicyNumber: 'AGSCH Contingent Group Policy',
      insuranceEmergencyLine: 'Insurance Emergency Line',
      chronicConditions: 'Chronic Medical Conditions',
      currentMedications: 'Current Daily Medications',
      coldChain: 'COLD CHAIN REFRIGERATION REQUIRED (2-8°C)',
      dietary: 'Dietary Restrictions & Intolerances',
      vaccinations: 'Vaccinations & Tetanus Booster',
      surgeries: 'Past Surgeries & Major Trauma',
      devices: 'Medical Devices & Implants',
      physicalLimits: 'Physical & Water Activity Limitations',
      consent: 'Emergency Medical Treatment Authorization Granted',
      print: 'Print Medical Sheet',
      verified: 'Medical declaration recorded & signed by guardian',
      guardianFallback: 'Guardian',
      activeStatus: 'Active',
      qrCodeId: 'QR Code ID',
      qrCodeAlt: 'Emergency QR Code',
    },
    pl: {
      emergencyTitle: 'KARTA MEDYCZNA RATUNKOWA',
      eventBadge: 'AGSCH CHILE',
      subtitle: 'Kontyngent Chile • Asociación de Guías y Scouts de Chile',
      criticalAlert: 'KRYTYCZNE OSTRZEŻENIE MEDYCZNE / WYSOKIE RYZYKO',
      allergies: 'Alergie i Nadwrażliwości',
      epipen: 'PACJENT POSIADA AUTOWSTRZYKIWACZ Z ADRENALINĄ (EpiPen)',
      bloodType: 'Grupa Krwi / Czynnik Rh',
      rutPassport: 'RUT / Nr Paszportu',
      contingentRole: 'Rola w Kontyngencie',
      genderBirth: 'Płeć / Data ur.',
      notReported: 'B/D',
      notSpecified: 'B/D',
      heightLabel: 'Wzrost',
      weightLabel: 'Waga',
      heightNotReported: 'Wzrost: B/D',
      weightNotReported: 'Waga: B/D',
      emergencyContact: 'Osoba do Kontaktu w Nagłych Wypadkach',
      defaultContactName: 'Opiekun / Kontakt Alarmowy',
      relationship: 'Relacja',
      defaultRelationship: 'Rodzic / Opiekun',
      callEmergencyAction: 'Zadzwoń teraz',
      noPhoneRegistered: 'Brak zarejestrowanego numeru',
      travelInsurance: 'Międzynarodowe Ubezpieczenie Podróżne',
      defaultInsuranceCompany: 'Polisa Ubezpieczenia Podróżnego',
      policyNumber: 'Numer Polisy',
      defaultPolicyNumber: 'Polisa Grupowa Kontyngentu AGSCH',
      insuranceEmergencyLine: 'Linia Alarmowa Ubezpieczyciela',
      chronicConditions: 'Choroby Przewlekłe',
      currentMedications: 'Aktualnie Przyjmowane Leki',
      coldChain: 'WYMAGANE PRZECHOWYWANIE W LODÓWCE (2-8°C)',
      dietary: 'Ograniczenia Dietetyczne i Nietolerancje',
      vaccinations: 'Szczepienia i Dawka Przypominająca Przeciw Tężcowi',
      surgeries: 'Przebyte Operacje i Ciężkie Urazy',
      devices: 'Urządzenia Medyczne i Protezy',
      physicalLimits: 'Ograniczenia Aktywności Fizycznej i Wodnej',
      consent: 'Zgoda na Ratunkowe Leczenie Medyczne podczas Wydarzenia',
      print: 'Drukuj Kartę Medyczną',
      verified: 'Deklaracja medyczna podpisana przez opiekuna',
      guardianFallback: 'Opiekun',
      activeStatus: 'Aktywna',
      qrCodeId: 'ID Kodu QR',
      qrCodeAlt: 'Ratunkowy Kod QR',
    },
    es: {
      emergencyTitle: 'FICHA MÉDICA DE EMERGENCIA',
      eventBadge: 'AGSCH CHILE',
      subtitle: 'Contingente Nacional • Asociación de Guías y Scouts de Chile',
      criticalAlert: 'ALERTA MÉDICA CRÍTICA / ALTO RIESGO',
      allergies: 'Alergias e Hipersensibilidades',
      epipen: 'EL PARTICIPANTE PORTA AUTOINYECTOR DE EPINEFRINA (EpiPen)',
      bloodType: 'Grupo Sanguíneo / Factor Rh',
      rutPassport: 'RUT / Pasaporte',
      contingentRole: 'Rol en el Contingente',
      genderBirth: 'Género / Nacimiento',
      notReported: 'N/R',
      notSpecified: 'N/A',
      heightLabel: 'Estatura',
      weightLabel: 'Peso',
      heightNotReported: 'Estatura N/R',
      weightNotReported: 'Peso N/R',
      emergencyContact: 'Contacto de Emergencia',
      defaultContactName: 'Apoderado / Contacto de Emergencia',
      relationship: 'Parentesco',
      defaultRelationship: 'Padre / Apoderado',
      callEmergencyAction: 'Llamar a Emergencia',
      noPhoneRegistered: 'Sin teléfono registrado',
      travelInsurance: 'Seguro de Asistencia en Viaje',
      defaultInsuranceCompany: 'Seguro de Asistencia en Viaje',
      policyNumber: 'N° de Póliza',
      defaultPolicyNumber: 'Póliza Grupal Contingente AGSCH',
      insuranceEmergencyLine: 'Línea de Emergencia del Seguro',
      chronicConditions: 'Condiciones Médicas Crónicas',
      currentMedications: 'Medicamentos Habituales',
      coldChain: 'REQUIERE CADENA DE FRÍO (Refrigeración 2-8°C)',
      dietary: 'Restricciones Alimentarias y Dietas',
      vaccinations: 'Vacunas y Refuerzo Antitetánico',
      surgeries: 'Cirugías y Traumatismos Previos',
      devices: 'Dispositivos Médicos e Implantes',
      physicalLimits: 'Limitaciones Físicas y Acuáticas',
      consent: 'Consentimiento para Tratamiento Médico de Emergencia en el Evento',
      print: 'Imprimir Ficha',
      verified: 'Declaración médica completada y firmada por apoderado',
      guardianFallback: 'Apoderado',
      activeStatus: 'Vigente',
      qrCodeId: 'ID Código QR',
      qrCodeAlt: 'Código QR de Emergencia',
    },
  }[lang];

  const dateLocale = lang === 'pl' ? 'pl-PL' : lang === 'es' ? 'es-CL' : 'en-GB';

  const emergencyPhoneDisplay =
    medicalRecord.emergencyContactPhone?.trim() || participant.guardianPhone?.trim() || '';
  const emergencyTelHref = normalizeTelHref(emergencyPhoneDisplay);

  const insurancePhoneDisplay = medicalRecord.insuranceEmergencyPhone?.trim() || '';
  const insuranceTelHref = normalizeTelHref(insurancePhoneDisplay);

  const getAllergies = () => {
    if (lang === 'pl') return medicalRecord.allergiesPL || medicalRecord.allergiesES || 'Brak zgłoszonych alergii';
    if (lang === 'en') return medicalRecord.allergiesEN || medicalRecord.allergiesES || 'No known allergies reported';
    return medicalRecord.allergiesES || 'Sin alergias conocidas';
  };

  const getConditions = () => {
    if (lang === 'pl')
      return medicalRecord.chronicConditionsPL || medicalRecord.chronicConditionsES || 'Brak chorób przewlekłych';
    if (lang === 'en')
      return medicalRecord.chronicConditionsEN || medicalRecord.chronicConditionsES || 'No chronic conditions reported';
    return medicalRecord.chronicConditionsES || 'Sin enfermedades crónicas reportadas';
  };

  const getMedications = () => {
    if (lang === 'pl')
      return medicalRecord.currentMedicationsPL || medicalRecord.currentMedicationsES || 'Brak stałych leków';
    if (lang === 'en')
      return medicalRecord.currentMedicationsEN || medicalRecord.currentMedicationsES || 'No regular medications taken';
    return medicalRecord.currentMedicationsES || 'No toma medicamentos habituales';
  };

  const getDietary = () => {
    if (lang === 'pl')
      return medicalRecord.dietaryRestrictionsPL || medicalRecord.dietaryRestrictionsES || 'Dieta standardowa';
    if (lang === 'en')
      return medicalRecord.dietaryRestrictionsEN || medicalRecord.dietaryRestrictionsES || 'Standard diet';
    return medicalRecord.dietaryRestrictionsES || 'Dieta estándar sin restricciones';
  };

  const getVaccinations = () => {
    if (lang === 'pl')
      return medicalRecord.vaccinationRecordsPL || medicalRecord.vaccinationRecordsES || 'Szczepienia aktualne';
    if (lang === 'en')
      return medicalRecord.vaccinationRecordsEN || medicalRecord.vaccinationRecordsES || 'Vaccinations up to date';
    return medicalRecord.vaccinationRecordsES || 'Vacunas al día';
  };

  const getSurgeries = () => {
    if (lang === 'pl')
      return (
        medicalRecord.pastSurgeriesInjuriesPL ||
        medicalRecord.pastSurgeriesInjuriesES ||
        'Brak istotnych zabiegów w wywiadzie'
      );
    if (lang === 'en')
      return (
        medicalRecord.pastSurgeriesInjuriesEN ||
        medicalRecord.pastSurgeriesInjuriesES ||
        'No significant surgical history'
      );
    return medicalRecord.pastSurgeriesInjuriesES || 'Sin antecedentes quirúrgicos relevantes';
  };

  const getDevices = () => {
    if (lang === 'pl')
      return medicalRecord.devicesImplantsPL || medicalRecord.devicesImplantsES || 'Brak aparatów ani protez';
    if (lang === 'en') return medicalRecord.devicesImplantsEN || medicalRecord.devicesImplantsES || 'None';
    return medicalRecord.devicesImplantsES || 'No utiliza';
  };

  const getPhysicalLimits = () => {
    if (lang === 'pl')
      return (
        medicalRecord.physicalLimitationsPL ||
        medicalRecord.physicalLimitationsES ||
        'Brak ograniczeń / Pełna zdolność'
      );
    if (lang === 'en')
      return (
        medicalRecord.physicalLimitationsEN ||
        medicalRecord.physicalLimitationsES ||
        'Full physical capacity / No limitations'
      );
    return medicalRecord.physicalLimitationsES || 'Capacidad física completa sin limitaciones';
  };

  const hasCriticalAlerts =
    Boolean(medicalRecord.hasSevereAllergies) ||
    Boolean(medicalRecord.carriesEpiPen) ||
    Boolean(medicalRecord.requiresColdChainMedication);

  return (
    <div className="min-h-screen bg-[#F5F6F8] text-slate-800 p-3 sm:p-6 print:bg-white print:text-black print:p-0">
      <div className="max-w-4xl mx-auto space-y-4">
        {/* Top Header / Language Switcher */}
        <header className="flex flex-wrap items-center justify-between gap-3 bg-[#001558] border-b-4 border-b-[#FEB135] rounded-2xl p-4 shadow-md text-white print:rounded-none print:shadow-none">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-red-600 text-white flex items-center justify-center font-black text-2xl shadow-sm shrink-0">
              +
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-black text-sm sm:text-base text-white tracking-tight">
                  {t.emergencyTitle}
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-black bg-[#FEB135] text-[#001558] uppercase">
                  {t.eventBadge}
                </span>
              </div>
              <p className="text-xs text-slate-200">{t.subtitle}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 print:hidden">
            <div className="flex bg-white/10 border border-white/20 rounded-xl p-1 text-xs font-bold">
              <button
                type="button"
                onClick={() => setLang('en')}
                className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                  lang === 'en' ? 'bg-[#FEB135] text-[#001558]' : 'text-slate-100 hover:text-white'
                }`}
              >
                🇬🇧 English
              </button>
              <button
                type="button"
                onClick={() => setLang('pl')}
                className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                  lang === 'pl' ? 'bg-[#FEB135] text-[#001558]' : 'text-slate-100 hover:text-white'
                }`}
              >
                🇵🇱 Polski
              </button>
              <button
                type="button"
                onClick={() => setLang('es')}
                className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                  lang === 'es' ? 'bg-[#FEB135] text-[#001558]' : 'text-slate-100 hover:text-white'
                }`}
              >
                🇨🇱 Español
              </button>
            </div>

            <button
              type="button"
              onClick={() => window.print()}
              className="p-2 rounded-xl bg-white/10 border border-white/20 text-white hover:bg-white/20 transition-colors cursor-pointer"
              title={t.print}
              aria-label={t.print}
            >
              <Printer className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* Critical Alerts Banner (Severe Allergies / EpiPen / Cold Chain) */}
        {hasCriticalAlerts && (
          <section
            aria-label={t.criticalAlert}
            className="bg-red-50 border-2 border-red-600 rounded-2xl overflow-hidden shadow-md text-red-950 print:shadow-none print:break-inside-avoid"
          >
            <div className="bg-red-600 text-white px-4 py-2.5 flex items-center gap-2 font-black text-xs sm:text-sm uppercase tracking-wider">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <span>{t.criticalAlert}</span>
            </div>
            <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs sm:text-sm">
              {medicalRecord.hasSevereAllergies && (
                <div className="bg-white p-3.5 rounded-xl border-2 border-red-300 text-red-900 font-bold shadow-2xs">
                  <span className="block text-[10px] uppercase tracking-wider text-red-700 mb-1">
                    {t.allergies}
                  </span>
                  <span>{getAllergies()}</span>
                </div>
              )}
              {medicalRecord.carriesEpiPen && (
                <div className="bg-[#FFFBF0] p-3.5 rounded-xl border-2 border-[#FEB135] text-[#001558] font-black flex items-center gap-2.5 shadow-2xs">
                  <Syringe className="w-5 h-5 text-red-600 shrink-0" />
                  <span>{t.epipen}</span>
                </div>
              )}
              {medicalRecord.requiresColdChainMedication && (
                <div className="bg-sky-50 p-3.5 rounded-xl border-2 border-sky-300 text-sky-950 font-bold sm:col-span-2">
                  ❄️ {t.coldChain}
                </div>
              )}
            </div>
          </section>
        )}

        {/* Patient Identity & Prominent Blood Type */}
        <section className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-xs grid grid-cols-1 md:grid-cols-3 gap-4 print:shadow-none print:border-slate-300 print:break-inside-avoid">
          {/* Blood Type & Biometrics first on mobile for rapid emergency scanning */}
          <div className="order-1 md:order-2 bg-red-50 border-2 border-red-300 rounded-2xl p-4 flex flex-col items-center justify-center text-center shadow-2xs print:shadow-none">
            <span className="text-[11px] font-black text-red-800 uppercase tracking-wider mb-1">
              {t.bloodType}
            </span>
            <div className="flex items-center gap-2 text-4xl font-black text-red-700 leading-none py-1">
              <Droplet className="w-7 h-7 text-red-600 fill-red-600 shrink-0" />
              <span>{medicalRecord.bloodType || t.notReported}</span>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-2 text-xs text-slate-800 font-bold mt-2">
              <span className="px-2.5 py-0.5 rounded-lg bg-white border border-red-200">
                {medicalRecord.heightCm
                  ? `${t.heightLabel}: ${medicalRecord.heightCm} cm`
                  : t.heightNotReported}
              </span>
              <span className="px-2.5 py-0.5 rounded-lg bg-white border border-red-200">
                {medicalRecord.weightKg
                  ? `${t.weightLabel}: ${medicalRecord.weightKg} kg`
                  : t.weightNotReported}
              </span>
            </div>
          </div>

          <div className="order-2 md:order-1 md:col-span-2 flex flex-col justify-center space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-black text-[#001558]">
                {participant.firstName} {participant.lastName} {participant.secondLastName || ''}
              </h1>
              {participant.cupoCode && (
                <span className="px-2.5 py-0.5 rounded-lg bg-[#FFF8E1] border border-[#FEB135] text-[#001558] text-xs font-mono font-bold">
                  {participant.cupoCode}
                </span>
              )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs text-slate-600">
              <div className="bg-[#F5F6F8] p-2.5 rounded-xl border border-slate-200">
                <span className="text-slate-500 block text-[10px] uppercase font-bold">
                  {t.rutPassport}
                </span>
                <span className="font-mono font-bold text-[#001558]">{participant.rut}</span>
              </div>
              <div className="bg-[#F5F6F8] p-2.5 rounded-xl border border-slate-200">
                <span className="text-slate-500 block text-[10px] uppercase font-bold">
                  {t.contingentRole}
                </span>
                <span className="font-bold text-[#001558]">
                  {participant.contingentRole || t.notSpecified}
                </span>
              </div>
              <div className="bg-[#F5F6F8] p-2.5 rounded-xl border border-slate-200 col-span-2 sm:col-span-1">
                <span className="text-slate-500 block text-[10px] uppercase font-bold">
                  {t.genderBirth}
                </span>
                <span className="font-medium text-slate-800">
                  {participant.gender || t.notReported} •{' '}
                  {participant.birthDate
                    ? new Date(participant.birthDate).toLocaleDateString(dateLocale)
                    : t.notReported}
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* Emergency Contacts & Insurance */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-4 print:break-inside-avoid">
          {/* Emergency Contact */}
          <div className="bg-white border-2 border-[#001558]/15 rounded-2xl p-4 sm:p-5 shadow-xs flex flex-col justify-between gap-3 print:shadow-none print:border-slate-300">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 text-xs font-black text-[#001558] uppercase tracking-wider">
                <Phone className="w-4 h-4 text-[#FEB135]" />
                <span>{t.emergencyContact}</span>
              </div>
              <p className="font-black text-[#001558] text-base">
                {medicalRecord.emergencyContactName ||
                  participant.guardianName ||
                  t.defaultContactName}
              </p>
              <p className="text-xs text-slate-600">
                {t.relationship}:{' '}
                <span className="font-bold text-slate-800">
                  {medicalRecord.emergencyContactRelation ||
                    participant.guardianRelationship ||
                    t.defaultRelationship}
                </span>
              </p>
            </div>

            <div className="pt-1">
              {emergencyTelHref ? (
                <a
                  href={emergencyTelHref}
                  className="w-full flex items-center justify-center gap-2.5 px-4 py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-black text-sm sm:text-base transition-colors shadow-sm print:bg-white print:text-black print:border print:border-slate-400"
                >
                  <Phone className="w-4 h-4 shrink-0" />
                  <span>{t.callEmergencyAction}:</span>
                  <span className="font-mono">{emergencyPhoneDisplay}</span>
                </a>
              ) : (
                <div
                  aria-disabled="true"
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-slate-100 border border-slate-200 text-slate-500 font-bold text-xs"
                >
                  <PhoneOff className="w-4 h-4 shrink-0" />
                  <span>{t.noPhoneRegistered}</span>
                </div>
              )}
            </div>
          </div>

          {/* Travel Insurance */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-xs flex flex-col justify-between gap-3 print:shadow-none print:border-slate-300">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 text-xs font-black text-[#001558] uppercase tracking-wider">
                <Shield className="w-4 h-4 text-[#FEB135]" />
                <span>{t.travelInsurance}</span>
              </div>
              <p className="font-black text-[#001558] text-base">
                {medicalRecord.insuranceCompany || t.defaultInsuranceCompany}
              </p>
              <p className="text-xs text-slate-600">
                {t.policyNumber}:{' '}
                <span className="font-mono font-bold text-slate-900">
                  {medicalRecord.insurancePolicyNumber || t.defaultPolicyNumber}
                </span>
              </p>
            </div>

            <div className="pt-1">
              {insuranceTelHref ? (
                <a
                  href={insuranceTelHref}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-[#EEF2FF] hover:bg-[#dfe6ff] border border-[#001558]/25 text-[#001558] text-xs sm:text-sm font-black transition-colors print:bg-white print:border-slate-400"
                >
                  <Phone className="w-4 h-4 shrink-0" />
                  <span>{t.insuranceEmergencyLine}:</span>
                  <span className="font-mono">{insurancePhoneDisplay}</span>
                </a>
              ) : (
                <div
                  aria-disabled="true"
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-slate-100 border border-slate-200 text-slate-500 font-bold text-xs"
                >
                  <PhoneOff className="w-4 h-4 shrink-0" />
                  <span>{t.noPhoneRegistered}</span>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Detailed Medical Information Cards */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          {/* Allergies */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-1.5 shadow-xs print:shadow-none print:border-slate-300 print:break-inside-avoid">
            <span className="text-[10px] font-bold text-red-700 uppercase tracking-wider flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-red-600" />
              {t.allergies}
            </span>
            <p className="text-slate-900 font-medium bg-[#F5F6F8] p-2.5 rounded-xl border border-slate-200">
              {getAllergies()}
            </p>
          </div>

          {/* Chronic Conditions */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-1.5 shadow-xs print:shadow-none print:border-slate-300 print:break-inside-avoid">
            <span className="text-[10px] font-bold text-[#001558] uppercase tracking-wider flex items-center gap-1.5">
              <Heart className="w-3.5 h-3.5 text-[#FEB135]" />
              {t.chronicConditions}
            </span>
            <p className="text-slate-900 font-medium bg-[#F5F6F8] p-2.5 rounded-xl border border-slate-200">
              {getConditions()}
            </p>
          </div>

          {/* Current Medications */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-1.5 shadow-xs print:shadow-none print:border-slate-300 print:break-inside-avoid">
            <span className="text-[10px] font-bold text-[#001558] uppercase tracking-wider flex items-center gap-1.5">
              <Pill className="w-3.5 h-3.5 text-indigo-600" />
              {t.currentMedications}
            </span>
            <p className="text-slate-900 font-medium bg-[#F5F6F8] p-2.5 rounded-xl border border-slate-200">
              {getMedications()}
            </p>
          </div>

          {/* Dietary Restrictions */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-1.5 shadow-xs print:shadow-none print:border-slate-300 print:break-inside-avoid">
            <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-emerald-600" />
              {t.dietary}
            </span>
            <p className="text-slate-900 font-medium bg-[#F5F6F8] p-2.5 rounded-xl border border-slate-200">
              {getDietary()}
            </p>
          </div>

          {/* Vaccinations */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-1.5 shadow-xs print:shadow-none print:border-slate-300 print:break-inside-avoid">
            <span className="text-[10px] font-bold text-[#001558] uppercase tracking-wider flex items-center gap-1.5">
              <Syringe className="w-3.5 h-3.5 text-sky-600" />
              {t.vaccinations}
            </span>
            <p className="text-slate-900 font-medium bg-[#F5F6F8] p-2.5 rounded-xl border border-slate-200">
              {getVaccinations()}
            </p>
          </div>

          {/* Surgeries & Trauma */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-1.5 shadow-xs print:shadow-none print:border-slate-300 print:break-inside-avoid">
            <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-slate-500" />
              {t.surgeries}
            </span>
            <p className="text-slate-900 font-medium bg-[#F5F6F8] p-2.5 rounded-xl border border-slate-200">
              {getSurgeries()}
            </p>
          </div>

          {/* Devices & Implants */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-1.5 shadow-xs print:shadow-none print:border-slate-300 print:break-inside-avoid">
            <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
              <UserCheck className="w-3.5 h-3.5 text-slate-500" />
              {t.devices}
            </span>
            <p className="text-slate-900 font-medium bg-[#F5F6F8] p-2.5 rounded-xl border border-slate-200">
              {getDevices()}
            </p>
          </div>

          {/* Physical Limitations */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-1.5 shadow-xs print:shadow-none print:border-slate-300 print:break-inside-avoid">
            <span className="text-[10px] font-bold text-amber-800 uppercase tracking-wider flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
              {t.physicalLimits}
            </span>
            <p className="text-slate-900 font-medium bg-[#F5F6F8] p-2.5 rounded-xl border border-slate-200">
              {getPhysicalLimits()}
            </p>
          </div>
        </section>

        {/* Legal Consent & Verification Footer */}
        <footer className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs shadow-xs print:shadow-none print:border-slate-300 print:break-inside-avoid">
          <div className="flex items-center gap-2.5 text-emerald-700">
            <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-600" />
            <div>
              <p className="font-bold text-[#001558]">{t.consent}</p>
              <p className="text-[11px] text-slate-600">
                {t.verified} ({medicalRecord.declaredByName || t.guardianFallback} •{' '}
                {medicalRecord.declaredAt
                  ? new Date(medicalRecord.declaredAt).toLocaleDateString(dateLocale)
                  : t.activeStatus}
                )
              </p>
            </div>
          </div>

          {qrDataUrl && (
            <div className="flex items-center gap-3 shrink-0">
              <div className="p-1 bg-white rounded-lg border border-slate-200">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={qrDataUrl} alt={t.qrCodeAlt} className="w-16 h-16" />
              </div>
              <span className="text-[10px] text-slate-500 font-mono">
                {t.qrCodeId}:
                <br />
                {medicalRecord.qrAccessCode}
              </span>
            </div>
          )}
        </footer>
      </div>
    </div>
  );
}

export default function EmergencyMedicalPage() {
  return (
    <React.Suspense
      fallback={
        <div className="min-h-screen bg-[#F5F6F8] flex flex-col items-center justify-center p-4 text-center">
          <Loader2 className="w-10 h-10 text-[#001558] animate-spin mb-4" />
          <h2 className="text-[#001558] font-bold text-lg">Loading Emergency Medical Profile...</h2>
        </div>
      }
    >
      <MedicalContent />
    </React.Suspense>
  );
}
