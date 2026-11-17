'use client';

import React, { useState, useEffect } from 'react';
import { X, UserPlus, Save, Loader2, AlertCircle } from 'lucide-react';
import { formatRut, cleanRut, validateRut } from '@/lib/rut';

interface ParticipantFormModalProps {
  initialData?: any | null;
  onClose: () => void;
  onSuccess: () => void;
}

export function ParticipantFormModal({
  initialData,
  onClose,
  onSuccess,
}: ParticipantFormModalProps) {
  const isEditing = !!initialData;

  const [rut, setRut] = useState(initialData?.rut || '');
  const [firstName, setFirstName] = useState(initialData?.firstName || '');
  const [lastName, setLastName] = useState(initialData?.lastName || '');
  const [email, setEmail] = useState(initialData?.email || '');
  const [phone, setPhone] = useState(initialData?.phone || '');
  const [birthDate, setBirthDate] = useState(
    initialData?.birthDate ? new Date(initialData.birthDate).toISOString().split('T')[0] : ''
  );
  const [gender, setGender] = useState(initialData?.gender || 'M');
  const [contingentRole, setContingentRole] = useState(initialData?.contingentRole || 'JOVEN');
  const [status, setStatus] = useState(initialData?.status || 'PRE_INSCRITO');
  const [scoutZone, setScoutZone] = useState(initialData?.scoutZone || '');
  const [scoutDistrict, setScoutDistrict] = useState(initialData?.scoutDistrict || '');
  const [scoutGroup, setScoutGroup] = useState(initialData?.scoutGroup || '');
  const [unitOrPatrol, setUnitOrPatrol] = useState(initialData?.unitOrPatrol || '');

  // Guardian
  const [guardianName, setGuardianName] = useState(initialData?.guardianName || '');
  const [guardianRelationship, setGuardianRelationship] = useState(initialData?.guardianRelationship || '');
  const [guardianPhone, setGuardianPhone] = useState(initialData?.guardianPhone || '');
  const [guardianEmail, setGuardianEmail] = useState(initialData?.guardianEmail || '');

  // Medical & notes
  const [dietaryRestrictions, setDietaryRestrictions] = useState(initialData?.dietaryRestrictions || '');
  const [medicalNotes, setMedicalNotes] = useState(initialData?.medicalNotes || '');
  const [notes, setNotes] = useState(initialData?.notes || '');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRutBlur = () => {
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
      setError('El RUT ingresado no es válido (verifique el dígito verificador)');
      return;
    }

    try {
      setLoading(true);
      const url = isEditing
        ? `/api/participants/${initialData.id}`
        : '/api/participants';
      const method = isEditing ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rut,
          firstName,
          lastName,
          email,
          phone,
          birthDate: birthDate || null,
          gender,
          contingentRole,
          status,
          scoutZone,
          scoutDistrict,
          scoutGroup,
          unitOrPatrol,
          guardianName,
          guardianRelationship,
          guardianPhone,
          guardianEmail,
          dietaryRestrictions,
          medicalNotes,
          notes,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Error al guardar participante');
      }

      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Error inesperado');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-3 sm:p-6 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-950 border border-indigo-700/50 text-indigo-400 flex items-center justify-center">
              {isEditing ? <Save className="w-5 h-5" /> : <UserPlus className="w-5 h-5" />}
            </div>
            <div>
              <h2 className="text-base font-bold text-white">
                {isEditing ? 'Editar Datos del Participante' : 'Inscribir Nuevo Participante'}
              </h2>
              <p className="text-xs text-slate-400">
                Polonia 2027 • Asociación de Guías y Scouts de Chile
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body Form */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-5 flex-1 text-xs">
          {error && (
            <div className="p-3 rounded-xl bg-red-950/70 border border-red-800/80 text-red-300 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Sección 1: Datos Personales */}
          <div>
            <h3 className="font-bold text-indigo-300 uppercase tracking-wider mb-2.5">
              1. Datos Personales
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-slate-400 mb-1 font-medium">RUT Chileno*</label>
                <input
                  type="text"
                  required
                  value={rut}
                  onChange={(e) => setRut(e.target.value)}
                  onBlur={handleRutBlur}
                  placeholder="12.345.678-5"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white font-mono focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-medium">Nombres*</label>
                <input
                  type="text"
                  required
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="Ej: Sofía Ignacia"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-medium">Apellidos*</label>
                <input
                  type="text"
                  required
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Ej: Silva Valenzuela"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-medium">Correo Electrónico*</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="sofia@ejemplo.cl"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-medium">Teléfono / WhatsApp</label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+56 9 1234 5678"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-medium">Fecha de Nacimiento</label>
                <input
                  type="date"
                  value={birthDate}
                  onChange={(e) => setBirthDate(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-medium">Género</label>
                <select
                  value={gender}
                  onChange={(e) => setGender(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                >
                  <option value="M">Masculino</option>
                  <option value="F">Femenino</option>
                  <option value="OTRO">Otro</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-medium">Rol en Contingente*</label>
                <select
                  value={contingentRole}
                  onChange={(e) => setContingentRole(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-indigo-600/50 rounded-lg text-white font-semibold focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                >
                  <option value="JOVEN">Participante / Joven ($3,600 USD)</option>
                  <option value="DIRIGENTE">Educador / Dirigente ($3,300 USD)</option>
                  <option value="IST">IST Servicio ($2,200 USD)</option>
                  <option value="CMT">Equipo CMT ($2,200 USD)</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-medium">Estado de Inscripción*</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                >
                  <option value="PRE_INSCRITO">Preinscrito</option>
                  <option value="CONFIRMADO">Confirmado</option>
                  <option value="LISTA_ESPERA">Lista de Espera</option>
                  <option value="RETIRADO">Retirado</option>
                </select>
              </div>
            </div>
          </div>

          {/* Sección 2: Afiliación Scout */}
          <div className="pt-3 border-t border-slate-800">
            <h3 className="font-bold text-emerald-400 uppercase tracking-wider mb-2.5">
              2. Afiliación Scout (AGSCH)
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div>
                <label className="block text-slate-400 mb-1 font-medium">Zona Scout</label>
                <input
                  type="text"
                  value={scoutZone}
                  onChange={(e) => setScoutZone(e.target.value)}
                  placeholder="Ej: Santiago Oriente"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-slate-400 mb-1 font-medium">Distrito Scout</label>
                <input
                  type="text"
                  value={scoutDistrict}
                  onChange={(e) => setScoutDistrict(e.target.value)}
                  placeholder="Ej: Providencia"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-slate-400 mb-1 font-medium">Grupo Guía y Scout</label>
                <input
                  type="text"
                  value={scoutGroup}
                  onChange={(e) => setScoutGroup(e.target.value)}
                  placeholder="Ej: Grupo San Jorge"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-slate-400 mb-1 font-medium">Unidad / Patrulla</label>
                <input
                  type="text"
                  value={unitOrPatrol}
                  onChange={(e) => setUnitOrPatrol(e.target.value)}
                  placeholder="Ej: Tropa Cóndor"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Sección 3: Contacto Apoderado / Emergencia */}
          <div className="pt-3 border-t border-slate-800">
            <h3 className="font-bold text-amber-400 uppercase tracking-wider mb-2.5">
              3. Apoderado / Contacto de Emergencia
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div>
                <label className="block text-slate-400 mb-1 font-medium">Nombre Apoderado</label>
                <input
                  type="text"
                  value={guardianName}
                  onChange={(e) => setGuardianName(e.target.value)}
                  placeholder="Ej: Marcela Silva"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-slate-400 mb-1 font-medium">Parentesco</label>
                <input
                  type="text"
                  value={guardianRelationship}
                  onChange={(e) => setGuardianRelationship(e.target.value)}
                  placeholder="Ej: Madre / Padre / Tutor"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-slate-400 mb-1 font-medium">Teléfono Apoderado</label>
                <input
                  type="text"
                  value={guardianPhone}
                  onChange={(e) => setGuardianPhone(e.target.value)}
                  placeholder="+56 9 9876 5432"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-slate-400 mb-1 font-medium">Correo Apoderado</label>
                <input
                  type="email"
                  value={guardianEmail}
                  onChange={(e) => setGuardianEmail(e.target.value)}
                  placeholder="marcela@ejemplo.cl"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Sección 4: Dieta y Notas */}
          <div className="pt-3 border-t border-slate-800">
            <h3 className="font-bold text-purple-400 uppercase tracking-wider mb-2.5">
              4. Restricciones y Observaciones
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-400 mb-1 font-medium">
                  Restricción Alimentaria / Dieta Especial
                </label>
                <input
                  type="text"
                  value={dietaryRestrictions}
                  onChange={(e) => setDietaryRestrictions(e.target.value)}
                  placeholder="Ej: Celíaco, Vegetariano, Alergia a nueces"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-slate-400 mb-1 font-medium">
                  Notas Médicas Relevantes
                </label>
                <input
                  type="text"
                  value={medicalNotes}
                  onChange={(e) => setMedicalNotes(e.target.value)}
                  placeholder="Ej: Asma leve, medicación de uso diario"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-slate-400 mb-1 font-medium">
                  Notas Internas de la Organización
                </label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Observaciones de seguimiento o acuerdos con el apoderado"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Submit Actions */}
          <div className="pt-4 border-t border-slate-800 flex justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-medium transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-medium flex items-center gap-1.5 shadow-md shadow-indigo-600/30 disabled:opacity-50 cursor-pointer transition-all"
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
