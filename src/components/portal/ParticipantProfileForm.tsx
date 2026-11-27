'use client';

import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Info,
  Loader2,
  Lock,
  Save,
  Shield,
  User,
  Users,
} from 'lucide-react';
import { useToast } from '@/components/ui/ToastProvider';
import { getRoleBadgeInfo } from '@/lib/roles';
import type { ParticipantDTO } from '@/types/domain';

export interface ParticipantProfileFormProps {
  participant: ParticipantDTO;
  onSaved: () => Promise<void> | void;
}

interface ProfileFormState {
  phone: string;
  birthDate: string;
  gender: string;
  address: string;
  commune: string;
  city: string;
  nationality: string;
  secondNationality: string;
  guardianName: string;
  guardianRelationship: string;
  guardianPhone: string;
  guardianEmail: string;
  scoutGroup: string;
  scoutZone: string;
  scoutDistrict: string;
  groupLeaderName: string;
  groupLeaderEmail: string;
  groupLeaderPhone: string;
  dietaryRestrictions: string;
  medicalNotes: string;
}

const INPUT_CLASS =
  'w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs sm:text-sm text-slate-800 placeholder-slate-400 focus:border-[#001558] focus:ring-2 focus:ring-[#FEB135]/50 focus:outline-none transition-all';

const STANDARD_GENDER_OPTIONS = [
  'Femenino',
  'Masculino',
  'Otro',
  'Prefiero no indicar',
];

function toDateInputValue(value?: string | Date | null): string {
  if (!value) return '';
  if (typeof value === 'string') {
    const isoPrefix = value.match(/^(\d{4}-\d{2}-\d{2})/);
    if (isoPrefix) return isoPrefix[1];
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';
  return parsed.toISOString().slice(0, 10);
}

function buildFormState(p: ParticipantDTO): ProfileFormState {
  return {
    phone: p.phone || '',
    birthDate: toDateInputValue(p.birthDate),
    gender: p.gender || '',
    address: p.address || '',
    commune: p.commune || '',
    city: p.city || '',
    nationality: p.nationality || '',
    secondNationality: p.secondNationality || '',
    guardianName: p.guardianName || '',
    guardianRelationship: p.guardianRelationship || '',
    guardianPhone: p.guardianPhone || '',
    guardianEmail: p.guardianEmail || '',
    scoutGroup: p.scoutGroup || '',
    scoutZone: p.scoutZone || '',
    scoutDistrict: p.scoutDistrict || '',
    groupLeaderName: p.groupLeaderName || '',
    groupLeaderEmail: p.groupLeaderEmail || '',
    groupLeaderPhone: p.groupLeaderPhone || '',
    dietaryRestrictions: p.dietaryRestrictions || '',
    medicalNotes: p.medicalNotes || '',
  };
}

function getStatusLabel(status?: string | null): string {
  switch (status) {
    case 'CONFIRMADO':
      return 'Confirmado';
    case 'PRE_INSCRITO':
      return 'Preinscrito';
    case 'LISTA_ESPERA':
      return 'Lista de espera';
    case 'RETIRADO':
      return 'Baja / Retirado';
    default:
      return status || 'Confirmado';
  }
}

export function ParticipantProfileForm({
  participant,
  onSaved,
}: ParticipantProfileFormProps) {
  const { toast } = useToast();
  const [form, setForm] = useState<ProfileFormState>(() =>
    buildFormState(participant)
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedBanner, setSavedBanner] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function syncParticipant() {
      await Promise.resolve();
      if (cancelled) return;
      setForm(buildFormState(participant));
      setError(null);
    }
    void syncParticipant();
    return () => {
      cancelled = true;
    };
  }, [participant]);

  const updateField = (key: keyof ProfileFormState, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setSavedBanner(false);
    setError(null);
  };

  const roleBadge = getRoleBadgeInfo(participant.contingentRole);
  const unitPatrolDisplay =
    [
      participant.unitName || participant.unit,
      participant.patrolName || participant.patrol,
      participant.unitOrPatrol,
    ]
      .filter((v, idx, arr) => Boolean(v) && arr.indexOf(v) === idx)
      .join(' • ') || 'Por asignar';

  const hasCustomGender =
    Boolean(form.gender) && !STANDARD_GENDER_OPTIONS.includes(form.gender);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSavedBanner(false);

    try {
      setSaving(true);
      const res = await fetch('/api/portal/me', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: form.phone.trim() || null,
          birthDate: form.birthDate || null,
          gender: form.gender.trim() || null,
          address: form.address.trim() || null,
          commune: form.commune.trim() || null,
          city: form.city.trim() || null,
          nationality: form.nationality.trim() || null,
          secondNationality: form.secondNationality.trim() || null,
          guardianName: form.guardianName.trim() || null,
          guardianRelationship: form.guardianRelationship.trim() || null,
          guardianPhone: form.guardianPhone.trim() || null,
          guardianEmail: form.guardianEmail.trim() || null,
          scoutGroup: form.scoutGroup.trim() || null,
          scoutZone: form.scoutZone.trim() || null,
          scoutDistrict: form.scoutDistrict.trim() || null,
          groupLeaderName: form.groupLeaderName.trim() || null,
          groupLeaderEmail: form.groupLeaderEmail.trim() || null,
          groupLeaderPhone: form.groupLeaderPhone.trim() || null,
          dietaryRestrictions: form.dietaryRestrictions.trim() || null,
          medicalNotes: form.medicalNotes.trim() || null,
        }),
      });

      const data = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        error?: string;
      };

      if (!res.ok) {
        throw new Error(data.error || 'No se pudieron guardar tus datos');
      }

      setSavedBanner(true);
      toast.success(
        'Tus datos personales, de emergencia y afiliación fueron actualizados.',
        'Datos actualizados'
      );
      await onSaved();
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : 'Error inesperado al actualizar datos';
      setError(msg);
      toast.error(msg, 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Tarjeta solo-lectura de datos oficiales */}
      <section className="bg-white border border-slate-200 border-t-4 border-t-[#001558] rounded-3xl p-5 sm:p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <Lock className="w-4 h-4 text-[#001558]" />
            <h2 className="text-sm font-black text-[#001558] uppercase tracking-wider">
              Datos Oficiales Administrados por Coordinación
            </h2>
          </div>
          <span
            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${roleBadge.className}`}
          >
            {roleBadge.label}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
          <div className="bg-[#F5F6F8] border border-slate-200 rounded-2xl p-3">
            <span className="block text-[10px] font-bold uppercase text-slate-500">
              RUT Oficial
            </span>
            <span className="font-mono font-black text-[#001558] text-sm">
              {participant.rut}
            </span>
          </div>

          <div className="bg-[#F5F6F8] border border-slate-200 rounded-2xl p-3">
            <span className="block text-[10px] font-bold uppercase text-slate-500">
              Correo Registrado
            </span>
            <span className="font-bold text-slate-800 break-all">
              {participant.email || 'No registrado'}
            </span>
          </div>

          <div className="bg-[#F5F6F8] border border-slate-200 rounded-2xl p-3">
            <span className="block text-[10px] font-bold uppercase text-slate-500">
              Cupo Asignado
            </span>
            <span className="font-mono font-black text-[#001558]">
              {participant.cupoCode || 'Por asignar'}
            </span>
          </div>

          <div className="bg-[#F5F6F8] border border-slate-200 rounded-2xl p-3">
            <span className="block text-[10px] font-bold uppercase text-slate-500">
              Rol en el Contingente
            </span>
            <span className="font-bold text-[#001558]">
              {participant.contingentRole || 'Participante'}
            </span>
          </div>

          <div className="bg-[#F5F6F8] border border-slate-200 rounded-2xl p-3">
            <span className="block text-[10px] font-bold uppercase text-slate-500">
              Unidad / Patrulla
            </span>
            <span className="font-bold text-slate-800">
              {unitPatrolDisplay}
            </span>
          </div>

          <div className="bg-[#F5F6F8] border border-slate-200 rounded-2xl p-3">
            <span className="block text-[10px] font-bold uppercase text-slate-500">
              Estado de Inscripción
            </span>
            <span className="font-black text-[#001558]">
              {getStatusLabel(participant.status)}
            </span>
          </div>
        </div>

        <div className="flex items-start gap-2 bg-[#FFFBF0] border border-[#FEB135]/50 border-l-4 border-l-[#FEB135] rounded-2xl px-4 py-3 text-xs text-[#001558]">
          <Info className="w-4 h-4 text-[#FEB135] shrink-0 mt-0.5" />
          <p>
            Por seguridad, cambios en tu RUT, correo oficial, cupo, rol o
            asignación de unidad/patrulla deben solicitarse directamente al
            equipo de coordinación del evento.
          </p>
        </div>
      </section>

      {savedBanner && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs flex items-center gap-2.5 font-bold">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>
            Tus datos fueron guardados correctamente en tu ficha del evento.
          </span>
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="p-4 rounded-2xl bg-red-50 border border-red-200 text-red-800 text-xs flex items-start gap-2.5 font-semibold"
        >
          <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Formulario Editable en 3 Bloques */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Bloque 1: Datos Personales y Contacto */}
        <section className="bg-white border border-slate-200 rounded-3xl p-5 sm:p-6 shadow-xs space-y-4">
          <div className="flex items-center gap-2 pb-2.5 border-b border-slate-200">
            <User className="w-4 h-4 text-[#FEB135]" />
            <h3 className="text-xs font-black text-[#001558] uppercase tracking-wider">
              1. Datos Personales y Contacto
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
            <div>
              <label
                htmlFor="profile-phone"
                className="block font-bold text-slate-700 mb-1"
              >
                Teléfono / WhatsApp
              </label>
              <input
                id="profile-phone"
                type="tel"
                value={form.phone}
                onChange={(e) => updateField('phone', e.target.value)}
                placeholder="+56 9 1234 5678"
                className={`${INPUT_CLASS} font-mono`}
              />
            </div>

            <div>
              <label
                htmlFor="profile-birthdate"
                className="block font-bold text-slate-700 mb-1"
              >
                Fecha de Nacimiento
              </label>
              <input
                id="profile-birthdate"
                type="date"
                value={form.birthDate}
                onChange={(e) => updateField('birthDate', e.target.value)}
                className={INPUT_CLASS}
              />
            </div>

            <div>
              <label
                htmlFor="profile-gender"
                className="block font-bold text-slate-700 mb-1"
              >
                Género
              </label>
              <select
                id="profile-gender"
                value={form.gender}
                onChange={(e) => updateField('gender', e.target.value)}
                className={INPUT_CLASS}
              >
                <option value="">Seleccionar...</option>
                {STANDARD_GENDER_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
                {hasCustomGender && (
                  <option value={form.gender}>{form.gender}</option>
                )}
              </select>
            </div>

            <div className="sm:col-span-2 lg:col-span-3">
              <label
                htmlFor="profile-address"
                className="block font-bold text-slate-700 mb-1"
              >
                Dirección
              </label>
              <input
                id="profile-address"
                type="text"
                value={form.address}
                onChange={(e) => updateField('address', e.target.value)}
                placeholder="Ej: Av. Providencia 1234, Depto. 501"
                className={INPUT_CLASS}
              />
            </div>

            <div>
              <label
                htmlFor="profile-commune"
                className="block font-bold text-slate-700 mb-1"
              >
                Comuna
              </label>
              <input
                id="profile-commune"
                type="text"
                value={form.commune}
                onChange={(e) => updateField('commune', e.target.value)}
                placeholder="Ej: Providencia"
                className={INPUT_CLASS}
              />
            </div>

            <div>
              <label
                htmlFor="profile-city"
                className="block font-bold text-slate-700 mb-1"
              >
                Ciudad
              </label>
              <input
                id="profile-city"
                type="text"
                value={form.city}
                onChange={(e) => updateField('city', e.target.value)}
                placeholder="Ej: Santiago"
                className={INPUT_CLASS}
              />
            </div>

            <div>
              <label
                htmlFor="profile-nationality"
                className="block font-bold text-slate-700 mb-1"
              >
                Nacionalidad
              </label>
              <input
                id="profile-nationality"
                type="text"
                value={form.nationality}
                onChange={(e) => updateField('nationality', e.target.value)}
                placeholder="Chilena"
                className={INPUT_CLASS}
              />
            </div>

            <div>
              <label
                htmlFor="profile-second-nationality"
                className="block font-bold text-slate-700 mb-1"
              >
                Segunda Nacionalidad (Opcional)
              </label>
              <input
                id="profile-second-nationality"
                type="text"
                value={form.secondNationality}
                onChange={(e) =>
                  updateField('secondNationality', e.target.value)
                }
                placeholder="Ej: Italiana, Española, etc."
                className={INPUT_CLASS}
              />
            </div>
          </div>
        </section>

        {/* Bloque 2: Apoderado / Contacto de Emergencia */}
        <section className="bg-white border border-slate-200 rounded-3xl p-5 sm:p-6 shadow-xs space-y-4">
          <div className="flex items-center gap-2 pb-2.5 border-b border-slate-200">
            <Users className="w-4 h-4 text-[#FEB135]" />
            <h3 className="text-xs font-black text-[#001558] uppercase tracking-wider">
              2. Apoderado / Contacto de Emergencia
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label
                htmlFor="profile-guardian-name"
                className="block font-bold text-slate-700 mb-1"
              >
                Nombre Completo Apoderado / Contacto
              </label>
              <input
                id="profile-guardian-name"
                type="text"
                value={form.guardianName}
                onChange={(e) => updateField('guardianName', e.target.value)}
                placeholder="Ej: Marcela Valenzuela"
                className={INPUT_CLASS}
              />
            </div>

            <div>
              <label
                htmlFor="profile-guardian-relation"
                className="block font-bold text-slate-700 mb-1"
              >
                Parentesco / Relación
              </label>
              <input
                id="profile-guardian-relation"
                type="text"
                value={form.guardianRelationship}
                onChange={(e) =>
                  updateField('guardianRelationship', e.target.value)
                }
                placeholder="Ej: Madre, Padre, Tutor/a, Cónyuge"
                className={INPUT_CLASS}
              />
            </div>

            <div>
              <label
                htmlFor="profile-guardian-phone"
                className="block font-bold text-slate-700 mb-1"
              >
                Teléfono de Emergencia
              </label>
              <input
                id="profile-guardian-phone"
                type="tel"
                value={form.guardianPhone}
                onChange={(e) => updateField('guardianPhone', e.target.value)}
                placeholder="+56 9 9876 5432"
                className={`${INPUT_CLASS} font-mono`}
              />
            </div>

            <div>
              <label
                htmlFor="profile-guardian-email"
                className="block font-bold text-slate-700 mb-1"
              >
                Correo Electrónico Apoderado / Emergencia
              </label>
              <input
                id="profile-guardian-email"
                type="email"
                value={form.guardianEmail}
                onChange={(e) => updateField('guardianEmail', e.target.value)}
                placeholder="apoderado@ejemplo.cl"
                className={INPUT_CLASS}
              />
            </div>
          </div>
        </section>

        {/* Bloque 3: Afiliación Scout y Alimentación */}
        <section className="bg-white border border-slate-200 rounded-3xl p-5 sm:p-6 shadow-xs space-y-4">
          <div className="flex items-center gap-2 pb-2.5 border-b border-slate-200">
            <Shield className="w-4 h-4 text-[#FEB135]" />
            <h3 className="text-xs font-black text-[#001558] uppercase tracking-wider">
              3. Afiliación Scout y Alimentación
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
            <div>
              <label
                htmlFor="profile-scout-group"
                className="block font-bold text-slate-700 mb-1"
              >
                Grupo Guía y Scout
              </label>
              <input
                id="profile-scout-group"
                type="text"
                value={form.scoutGroup}
                onChange={(e) => updateField('scoutGroup', e.target.value)}
                placeholder="Ej: Grupo San Jorge"
                className={INPUT_CLASS}
              />
            </div>

            <div>
              <label
                htmlFor="profile-scout-zone"
                className="block font-bold text-slate-700 mb-1"
              >
                Zona Scout
              </label>
              <input
                id="profile-scout-zone"
                type="text"
                value={form.scoutZone}
                onChange={(e) => updateField('scoutZone', e.target.value)}
                placeholder="Ej: Santiago Oriente"
                className={INPUT_CLASS}
              />
            </div>

            <div>
              <label
                htmlFor="profile-scout-district"
                className="block font-bold text-slate-700 mb-1"
              >
                Distrito Scout
              </label>
              <input
                id="profile-scout-district"
                type="text"
                value={form.scoutDistrict}
                onChange={(e) => updateField('scoutDistrict', e.target.value)}
                placeholder="Ej: Providencia"
                className={INPUT_CLASS}
              />
            </div>

            <div>
              <label
                htmlFor="profile-leader-name"
                className="block font-bold text-slate-700 mb-1"
              >
                Nombre Dirigente / Responsable de Grupo
              </label>
              <input
                id="profile-leader-name"
                type="text"
                value={form.groupLeaderName}
                onChange={(e) => updateField('groupLeaderName', e.target.value)}
                placeholder="Nombre de quien dirige tu grupo"
                className={INPUT_CLASS}
              />
            </div>

            <div>
              <label
                htmlFor="profile-leader-email"
                className="block font-bold text-slate-700 mb-1"
              >
                Correo Dirigente / Grupo
              </label>
              <input
                id="profile-leader-email"
                type="email"
                value={form.groupLeaderEmail}
                onChange={(e) =>
                  updateField('groupLeaderEmail', e.target.value)
                }
                placeholder="contacto@grupo.cl"
                className={INPUT_CLASS}
              />
            </div>

            <div>
              <label
                htmlFor="profile-leader-phone"
                className="block font-bold text-slate-700 mb-1"
              >
                Teléfono Dirigente / Grupo
              </label>
              <input
                id="profile-leader-phone"
                type="tel"
                value={form.groupLeaderPhone}
                onChange={(e) =>
                  updateField('groupLeaderPhone', e.target.value)
                }
                placeholder="+56 9 ..."
                className={`${INPUT_CLASS} font-mono`}
              />
            </div>

            <div className="sm:col-span-2 lg:col-span-3">
              <label
                htmlFor="profile-dietary"
                className="block font-bold text-slate-700 mb-1"
              >
                Restricciones Alimentarias / Preferencias de Dieta
              </label>
              <input
                id="profile-dietary"
                type="text"
                value={form.dietaryRestrictions}
                onChange={(e) =>
                  updateField('dietaryRestrictions', e.target.value)
                }
                placeholder="Ej: Vegetariano, Celíaco, Sin lactosa, Ninguna"
                className={INPUT_CLASS}
              />
            </div>

            <div className="sm:col-span-2 lg:col-span-3">
              <label
                htmlFor="profile-medical-notes"
                className="block font-bold text-slate-700 mb-1"
              >
                Observaciones Médicas Generales
              </label>
              <textarea
                id="profile-medical-notes"
                rows={2}
                value={form.medicalNotes}
                onChange={(e) => updateField('medicalNotes', e.target.value)}
                placeholder="Resumen breve si corresponde (el detalle clínico oficial y traducciones se registran en la pestaña Ficha Médica)"
                className={INPUT_CLASS}
              />
            </div>
          </div>
        </section>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
          <p className="text-[11px] text-slate-600">
            Los cambios se actualizan de inmediato en tu ficha oficial del
            evento.
          </p>
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-[#001558] hover:bg-[#0b2370] text-white font-black text-xs uppercase tracking-wider shadow-md disabled:opacity-50 cursor-pointer transition-all shrink-0"
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Guardando cambios...
              </>
            ) : (
              <>
                <Save className="w-4 h-4 text-[#FEB135]" />
                Guardar Mis Datos
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
