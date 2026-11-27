'use client';

import React, { useEffect, useId, useState } from 'react';
import { X, UserPlus, Save, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { formatRut, cleanRut, validateRut } from '@/lib/rut';
import { useToast } from '@/components/ui/ToastProvider';
import type { EventSummary, ParticipantDTO } from '@/types/domain';

export interface ParticipantFormModalProps {
  initialData?: ParticipantDTO | null;
  activeEvent?: EventSummary | null;
  onClose: () => void;
  onSuccess: () => void;
}

const INPUT_CLASS =
  'w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-800 placeholder-slate-400 focus:border-[#001558] focus:ring-2 focus:ring-[#FEB135]/50 focus:outline-none transition-all';

export function ParticipantFormModal({
  initialData,
  activeEvent,
  onClose,
  onSuccess,
}: ParticipantFormModalProps) {
  const { toast } = useToast();
  const titleId = useId();
  const isEditing = !!initialData;

  const [rut, setRut] = useState(initialData?.rut || '');
  const [rutTouched, setRutTouched] = useState(false);
  const [firstName, setFirstName] = useState(initialData?.firstName || '');
  const [lastName, setLastName] = useState(initialData?.lastName || '');
  const [secondLastName, setSecondLastName] = useState(
    initialData?.secondLastName || ''
  );
  const [email, setEmail] = useState(initialData?.email || '');
  const [phone, setPhone] = useState(initialData?.phone || '');
  const [birthDate, setBirthDate] = useState(
    initialData?.birthDate
      ? new Date(initialData.birthDate).toISOString().split('T')[0]
      : ''
  );
  const [gender, setGender] = useState(initialData?.gender || 'Masculino');
  const [contingentRole, setContingentRole] = useState(
    initialData?.contingentRole || 'Participante'
  );
  const [status, setStatus] = useState(initialData?.status || 'CONFIRMADO');
  const [targetFeeUSD, setTargetFeeUSD] = useState(
    initialData?.targetFeeUSD !== null && initialData?.targetFeeUSD !== undefined
      ? String(initialData.targetFeeUSD)
      : ''
  );
  const [scoutZone, setScoutZone] = useState(initialData?.scoutZone || '');
  const [scoutDistrict, setScoutDistrict] = useState(
    initialData?.scoutDistrict || ''
  );
  const [scoutGroup, setScoutGroup] = useState(initialData?.scoutGroup || '');
  const [unitName, setUnitName] = useState(
    initialData?.unitName || initialData?.unit || ''
  );
  const [patrolName, setPatrolName] = useState(
    initialData?.patrolName || initialData?.patrol || ''
  );
  const [cupoCode, setCupoCode] = useState(initialData?.cupoCode || '');
  const [uniformSize, setUniformSize] = useState(initialData?.uniformSize || '');

  // Guardian
  const [guardianName, setGuardianName] = useState(
    initialData?.guardianName || ''
  );
  const [guardianPhone, setGuardianPhone] = useState(
    initialData?.guardianPhone || ''
  );
  const [guardianEmail, setGuardianEmail] = useState(
    initialData?.guardianEmail || ''
  );

  // Address
  const [address, setAddress] = useState(initialData?.address || '');
  const [commune, setCommune] = useState(initialData?.commune || '');
  const [city, setCity] = useState(initialData?.city || '');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !loading) {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [loading, onClose]);

  const cleanedRut = cleanRut(rut);
  const shouldShowRutFeedback =
    cleanedRut.length >= 7 || (rutTouched && cleanedRut.length > 0);
  const isRutValid = shouldShowRutFeedback ? validateRut(cleanedRut) : null;

  const handleRutBlur = () => {
    setRutTouched(true);
    if (rut) {
      setRut(formatRut(rut));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!rut.trim() || !firstName.trim() || !lastName.trim() || !email.trim()) {
      setError('RUT, Nombres, Apellidos y Correo son campos obligatorios');
      return;
    }

    const cleaned = cleanRut(rut);
    if (!validateRut(cleaned)) {
      setRutTouched(true);
      setError(
        'El RUT ingresado no es válido (verifique el dígito verificador)'
      );
      return;
    }

    const trimmedTargetFee = targetFeeUSD.trim();
    const parsedTargetFee =
      trimmedTargetFee === '' ? null : parseFloat(trimmedTargetFee);
    if (
      parsedTargetFee !== null &&
      (Number.isNaN(parsedTargetFee) || parsedTargetFee < 0)
    ) {
      setError(
        'La Cuota Objetivo Personalizada (USD) debe ser un monto válido mayor o igual a 0'
      );
      return;
    }

    try {
      setLoading(true);
      const url = isEditing
        ? `/api/participants/${initialData.id}`
        : '/api/participants';
      const method = isEditing ? 'PUT' : 'POST';

      const payload: Record<string, unknown> = {
        rut,
        firstName,
        lastName,
        secondLastName,
        email,
        phone,
        birthDate: birthDate || null,
        gender,
        address,
        commune,
        city,
        contingentRole,
        status,
        targetFeeUSD: parsedTargetFee,
        scoutZone,
        scoutDistrict,
        scoutGroup,
        unitName,
        patrolName,
        cupoCode,
        uniformSize,
        guardianName,
        guardianPhone,
        guardianEmail,
      };

      if (!isEditing && activeEvent?.id) {
        payload.eventId = activeEvent.id;
      }

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Error al guardar participante');
      }

      toast.success(
        isEditing
          ? 'Ficha del participante actualizada correctamente'
          : 'Participante inscrito correctamente'
      );
      onSuccess();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error inesperado';
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#001558]/40 backdrop-blur-xs p-3 sm:p-6 overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget && !loading) {
          onClose();
        }
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="bg-white border border-slate-200 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200"
      >
        {/* Header */}
        <div className="px-6 py-4 bg-[#001558] text-white border-b-4 border-b-[#FEB135] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-white/10 border border-[#FEB135]/50 text-[#FEB135] flex items-center justify-center">
              {isEditing ? (
                <Save className="w-5 h-5" />
              ) : (
                <UserPlus className="w-5 h-5" />
              )}
            </div>
            <div>
              <h2 id={titleId} className="text-base font-extrabold text-white">
                {isEditing
                  ? 'Editar Ficha Oficial'
                  : 'Inscribir Nuevo Participante'}
              </h2>
              <p className="text-xs text-slate-200">
                {activeEvent?.shortName || activeEvent?.name || 'Sistema Multievento'} •
                Asociación de Guías y Scouts de Chile
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar modal"
            className="p-2 rounded-xl text-white/75 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body Form */}
        <form
          onSubmit={handleSubmit}
          className="p-6 overflow-y-auto space-y-5 flex-1 text-xs bg-white"
        >
          {error && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-600" />
              <span>{error}</span>
            </div>
          )}

          {/* Sección 1: Datos Personales y Contacto */}
          <div>
            <h3 className="font-extrabold text-[#001558] uppercase tracking-wider mb-3 border-l-4 border-[#FEB135] pl-2.5">
              1. Datos Personales y Contacto
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-slate-700 mb-1 font-semibold">
                  RUT Chileno*
                </label>
                <input
                  type="text"
                  required
                  value={rut}
                  onChange={(e) => setRut(e.target.value)}
                  onBlur={handleRutBlur}
                  placeholder="12.345.678-5"
                  aria-invalid={isRutValid === false}
                  className={`${INPUT_CLASS} font-mono ${
                    isRutValid === true
                      ? 'border-emerald-400 focus:border-emerald-600'
                      : isRutValid === false
                        ? 'border-red-400 focus:border-red-600'
                        : ''
                  }`}
                />
                {isRutValid !== null && (
                  <p
                    className={`mt-1 text-[11px] font-semibold flex items-center gap-1 ${
                      isRutValid ? 'text-emerald-700' : 'text-red-600'
                    }`}
                  >
                    {isRutValid ? (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                        <span>RUT válido</span>
                      </>
                    ) : (
                      <>
                        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                        <span>Dígito verificador inválido</span>
                      </>
                    )}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-slate-700 mb-1 font-semibold">
                  Nombres*
                </label>
                <input
                  type="text"
                  required
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="Ej: Sofía Ignacia"
                  className={INPUT_CLASS}
                />
              </div>

              <div>
                <label className="block text-slate-700 mb-1 font-semibold">
                  Primer Apellido*
                </label>
                <input
                  type="text"
                  required
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Ej: Silva"
                  className={INPUT_CLASS}
                />
              </div>

              <div>
                <label className="block text-slate-700 mb-1 font-semibold">
                  Segundo Apellido
                </label>
                <input
                  type="text"
                  value={secondLastName}
                  onChange={(e) => setSecondLastName(e.target.value)}
                  placeholder="Ej: Valenzuela"
                  className={INPUT_CLASS}
                />
              </div>

              <div>
                <label className="block text-slate-700 mb-1 font-semibold">
                  Correo Electrónico*
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="sofia@ejemplo.cl"
                  className={INPUT_CLASS}
                />
              </div>

              <div>
                <label className="block text-slate-700 mb-1 font-semibold">
                  Teléfono / WhatsApp
                </label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+56 9 1234 5678"
                  className={INPUT_CLASS}
                />
              </div>

              <div>
                <label className="block text-slate-700 mb-1 font-semibold">
                  Fecha de Nacimiento
                </label>
                <input
                  type="date"
                  value={birthDate}
                  onChange={(e) => setBirthDate(e.target.value)}
                  className={INPUT_CLASS}
                />
              </div>

              <div>
                <label className="block text-slate-700 mb-1 font-semibold">
                  Género
                </label>
                <select
                  value={gender}
                  onChange={(e) => setGender(e.target.value)}
                  className={INPUT_CLASS}
                >
                  <option value="Femenino">Femenino</option>
                  <option value="Masculino">Masculino</option>
                  <option value="Otro">Otro</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-700 mb-1 font-semibold">
                  Rol en Contingente*
                </label>
                <select
                  value={contingentRole}
                  onChange={(e) => setContingentRole(e.target.value)}
                  className="w-full px-3 py-2 bg-[#FFFBF0] border border-[#FEB135] rounded-lg text-[#001558] font-bold focus:border-[#001558] focus:ring-2 focus:ring-[#FEB135]/50 focus:outline-none"
                >
                  <option value="Participante">Joven / Participante</option>
                  <option value="Responsable de Patrulla">
                    Responsable de Patrulla
                  </option>
                  <option value="RESPONSABLE">Educador / Dirigente</option>
                  <option value="IST">IST (Servicio)</option>
                  <option value="CMT">CMT (Contingente)</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-700 mb-1 font-semibold">
                  Estado de Inscripción*
                </label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className={INPUT_CLASS}
                >
                  <option value="CONFIRMADO">Confirmado</option>
                  <option value="PRE_INSCRITO">Preinscrito</option>
                  <option value="RETIRADO">Baja / Retirado</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-700 mb-1 font-semibold">
                  Cuota Objetivo Personalizada (USD)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={targetFeeUSD}
                  onChange={(e) => setTargetFeeUSD(e.target.value)}
                  placeholder="Vacío = cuota del plan"
                  className={`${INPUT_CLASS} font-mono`}
                />
                <p className="mt-1 text-[10px] text-slate-500">
                  Opcional. Ajusta por beca/modalidad o deja vacío.
                </p>
              </div>

              <div>
                <label className="block text-slate-700 mb-1 font-semibold">
                  Código de Cupo
                </label>
                <input
                  type="text"
                  value={cupoCode}
                  onChange={(e) => setCupoCode(e.target.value)}
                  placeholder="Ej: IST106 o PAR042"
                  className={`${INPUT_CLASS} font-mono`}
                />
              </div>

              <div>
                <label className="block text-slate-700 mb-1 font-semibold">
                  Talla Indumentaria / Kit
                </label>
                <input
                  type="text"
                  value={uniformSize}
                  onChange={(e) => setUniformSize(e.target.value)}
                  placeholder="Ej: M, L, XL, 44"
                  className={INPUT_CLASS}
                />
              </div>

              <div>
                <label className="block text-slate-700 mb-1 font-semibold">
                  Dirección
                </label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Ej: Av. Providencia 1234"
                  className={INPUT_CLASS}
                />
              </div>

              <div>
                <label className="block text-slate-700 mb-1 font-semibold">
                  Comuna
                </label>
                <input
                  type="text"
                  value={commune}
                  onChange={(e) => setCommune(e.target.value)}
                  placeholder="Ej: Providencia"
                  className={INPUT_CLASS}
                />
              </div>

              <div>
                <label className="block text-slate-700 mb-1 font-semibold">
                  Ciudad
                </label>
                <input
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="Ej: Santiago"
                  className={INPUT_CLASS}
                />
              </div>
            </div>
          </div>

          {/* Sección 2: Afiliación Scout */}
          <div className="pt-4 border-t border-slate-200">
            <h3 className="font-extrabold text-[#001558] uppercase tracking-wider mb-3 border-l-4 border-[#FEB135] pl-2.5">
              2. Afiliación Scout y Asignación
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <div>
                <label className="block text-slate-700 mb-1 font-semibold">
                  Zona Scout
                </label>
                <input
                  type="text"
                  value={scoutZone}
                  onChange={(e) => setScoutZone(e.target.value)}
                  placeholder="Ej: Santiago Oriente"
                  className={INPUT_CLASS}
                />
              </div>
              <div>
                <label className="block text-slate-700 mb-1 font-semibold">
                  Distrito Scout
                </label>
                <input
                  type="text"
                  value={scoutDistrict}
                  onChange={(e) => setScoutDistrict(e.target.value)}
                  placeholder="Ej: Providencia"
                  className={INPUT_CLASS}
                />
              </div>
              <div>
                <label className="block text-slate-700 mb-1 font-semibold">
                  Grupo Guía y Scout
                </label>
                <input
                  type="text"
                  value={scoutGroup}
                  onChange={(e) => setScoutGroup(e.target.value)}
                  placeholder="Ej: Grupo San Jorge"
                  className={INPUT_CLASS}
                />
              </div>
              <div>
                <label className="block text-slate-700 mb-1 font-semibold">
                  Unidad de Contingente
                </label>
                <input
                  type="text"
                  value={unitName}
                  onChange={(e) => setUnitName(e.target.value)}
                  placeholder="Ej: Tropa Cóndor"
                  className={INPUT_CLASS}
                />
              </div>
              <div>
                <label className="block text-slate-700 mb-1 font-semibold">
                  Patrulla / Equipo
                </label>
                <input
                  type="text"
                  value={patrolName}
                  onChange={(e) => setPatrolName(e.target.value)}
                  placeholder="Ej: Patrulla Albatros"
                  className={INPUT_CLASS}
                />
              </div>
            </div>
          </div>

          {/* Sección 3: Contacto Apoderado */}
          <div className="pt-4 border-t border-slate-200">
            <h3 className="font-extrabold text-[#001558] uppercase tracking-wider mb-3 border-l-4 border-[#FEB135] pl-2.5">
              3. Contacto de Apoderado / Emergencia
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-slate-700 mb-1 font-semibold">
                  Nombre Apoderado
                </label>
                <input
                  type="text"
                  value={guardianName}
                  onChange={(e) => setGuardianName(e.target.value)}
                  placeholder="Ej: Marcela Silva"
                  className={INPUT_CLASS}
                />
              </div>
              <div>
                <label className="block text-slate-700 mb-1 font-semibold">
                  Teléfono Apoderado
                </label>
                <input
                  type="text"
                  value={guardianPhone}
                  onChange={(e) => setGuardianPhone(e.target.value)}
                  placeholder="+56 9 9876 5432"
                  className={INPUT_CLASS}
                />
              </div>
              <div>
                <label className="block text-slate-700 mb-1 font-semibold">
                  Correo Apoderado
                </label>
                <input
                  type="email"
                  value={guardianEmail}
                  onChange={(e) => setGuardianEmail(e.target.value)}
                  placeholder="marcela@ejemplo.cl"
                  className={INPUT_CLASS}
                />
              </div>
            </div>
          </div>

          {/* Submit Actions */}
          <div className="pt-4 border-t border-slate-200 flex justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 rounded-xl font-bold transition-colors cursor-pointer border border-slate-300"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 bg-[#001558] hover:bg-[#0b2370] text-white rounded-xl font-extrabold flex items-center gap-1.5 shadow-xs disabled:opacity-50 cursor-pointer transition-all uppercase tracking-wider"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Guardando...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  {isEditing ? 'Guardar Cambios' : 'Registrar Participante'}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
