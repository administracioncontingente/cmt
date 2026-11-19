'use client';

import React, { useState } from 'react';
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
  const [secondLastName, setSecondLastName] = useState(initialData?.secondLastName || '');
  const [email, setEmail] = useState(initialData?.email || '');
  const [phone, setPhone] = useState(initialData?.phone || '');
  const [birthDate, setBirthDate] = useState(
    initialData?.birthDate ? new Date(initialData.birthDate).toISOString().split('T')[0] : ''
  );
  const [gender, setGender] = useState(initialData?.gender || 'Masculino');
  const [contingentRole, setContingentRole] = useState(initialData?.contingentRole || 'Participante');
  const [status, setStatus] = useState(initialData?.status || 'CONFIRMADO');
  const [scoutZone, setScoutZone] = useState(initialData?.scoutZone || '');
  const [scoutDistrict, setScoutDistrict] = useState(initialData?.scoutDistrict || '');
  const [scoutGroup, setScoutGroup] = useState(initialData?.scoutGroup || '');
  const [unitName, setUnitName] = useState(initialData?.unitName || initialData?.unit || '');
  const [patrolName, setPatrolName] = useState(initialData?.patrolName || initialData?.patrol || '');
  const [cupoCode, setCupoCode] = useState(initialData?.cupoCode || '');
  const [uniformSize, setUniformSize] = useState(initialData?.uniformSize || '');

  // Guardian
  const [guardianName, setGuardianName] = useState(initialData?.guardianName || '');
  const [guardianPhone, setGuardianPhone] = useState(initialData?.guardianPhone || '');
  const [guardianEmail, setGuardianEmail] = useState(initialData?.guardianEmail || '');

  // Address
  const [address, setAddress] = useState(initialData?.address || '');
  const [commune, setCommune] = useState(initialData?.commune || '');
  const [city, setCity] = useState(initialData?.city || '');

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-3 sm:p-6 overflow-y-auto">
      <div className="bg-[#001558] border border-[#0d349e] rounded-2xl shadow-2xl w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#0d349e] flex items-center justify-between bg-[#000c33]/70">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#000c33] border border-[#FEB135]/40 text-[#FEB135] flex items-center justify-center">
              {isEditing ? <Save className="w-5 h-5" /> : <UserPlus className="w-5 h-5" />}
            </div>
            <div>
              <h2 className="text-base font-black text-white">
                {isEditing ? 'Editar Ficha Oficial' : 'Inscribir Nuevo Participante'}
              </h2>
              <p className="text-xs text-slate-300">
                Polonia 2027 • Asociación de Guías y Scouts de Chile
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-[#000c33] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body Form */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-5 flex-1 text-xs bg-[#001558]">
          {error && (
            <div className="p-3 rounded-xl bg-red-950/80 border border-red-700 text-red-200 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Sección 1: Datos Personales */}
          <div>
            <h3 className="font-bold text-[#FEB135] uppercase tracking-wider mb-2.5">
              1. Datos Personales y Contacto
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-slate-300 mb-1 font-semibold">RUT Chileno*</label>
                <input
                  type="text"
                  required
                  value={rut}
                  onChange={(e) => setRut(e.target.value)}
                  onBlur={handleRutBlur}
                  placeholder="12.345.678-5"
                  className="w-full px-3 py-2 bg-[#000c33] border border-[#0d349e] rounded-lg text-white font-mono focus:ring-2 focus:ring-[#FEB135] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-300 mb-1 font-semibold">Nombres*</label>
                <input
                  type="text"
                  required
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="Ej: Sofía Ignacia"
                  className="w-full px-3 py-2 bg-[#000c33] border border-[#0d349e] rounded-lg text-white focus:ring-2 focus:ring-[#FEB135] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-300 mb-1 font-semibold">Primer Apellido*</label>
                <input
                  type="text"
                  required
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Ej: Silva"
                  className="w-full px-3 py-2 bg-[#000c33] border border-[#0d349e] rounded-lg text-white focus:ring-2 focus:ring-[#FEB135] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-300 mb-1 font-semibold">Segundo Apellido</label>
                <input
                  type="text"
                  value={secondLastName}
                  onChange={(e) => setSecondLastName(e.target.value)}
                  placeholder="Ej: Valenzuela"
                  className="w-full px-3 py-2 bg-[#000c33] border border-[#0d349e] rounded-lg text-white focus:ring-2 focus:ring-[#FEB135] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-300 mb-1 font-semibold">Correo Electrónico*</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="sofia@ejemplo.cl"
                  className="w-full px-3 py-2 bg-[#000c33] border border-[#0d349e] rounded-lg text-white focus:ring-2 focus:ring-[#FEB135] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-300 mb-1 font-semibold">Teléfono / WhatsApp</label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+56 9 1234 5678"
                  className="w-full px-3 py-2 bg-[#000c33] border border-[#0d349e] rounded-lg text-white focus:ring-2 focus:ring-[#FEB135] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-300 mb-1 font-semibold">Fecha de Nacimiento</label>
                <input
                  type="date"
                  value={birthDate}
                  onChange={(e) => setBirthDate(e.target.value)}
                  className="w-full px-3 py-2 bg-[#000c33] border border-[#0d349e] rounded-lg text-white focus:ring-2 focus:ring-[#FEB135] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-300 mb-1 font-semibold">Género</label>
                <select
                  value={gender}
                  onChange={(e) => setGender(e.target.value)}
                  className="w-full px-3 py-2 bg-[#000c33] border border-[#0d349e] rounded-lg text-white focus:ring-2 focus:ring-[#FEB135] focus:outline-none"
                >
                  <option value="Femenino">Femenino</option>
                  <option value="Masculino">Masculino</option>
                  <option value="Otro">Otro</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-300 mb-1 font-semibold">Rol en Contingente*</label>
                <select
                  value={contingentRole}
                  onChange={(e) => setContingentRole(e.target.value)}
                  className="w-full px-3 py-2 bg-[#000c33] border border-[#FEB135]/50 rounded-lg text-[#FEB135] font-bold focus:ring-2 focus:ring-[#FEB135] focus:outline-none"
                >
                  <option value="Participante">Joven / Participante</option>
                  <option value="Responsable de Patrulla">Responsable de Patrulla</option>
                  <option value="RESPONSABLE">Educador / Dirigente</option>
                  <option value="IST">IST (Servicio)</option>
                  <option value="CMT">CMT (Contingente)</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-300 mb-1 font-semibold">Estado de Inscripción*</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="w-full px-3 py-2 bg-[#000c33] border border-[#0d349e] rounded-lg text-white focus:ring-2 focus:ring-[#FEB135] focus:outline-none"
                >
                  <option value="CONFIRMADO">Confirmado</option>
                  <option value="PRE_INSCRITO">Preinscrito</option>
                  <option value="RETIRADO">Baja / Retirado</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-300 mb-1 font-semibold">Código de Cupo</label>
                <input
                  type="text"
                  value={cupoCode}
                  onChange={(e) => setCupoCode(e.target.value)}
                  placeholder="Ej: IST106 o PAR042"
                  className="w-full px-3 py-2 bg-[#000c33] border border-[#0d349e] rounded-lg text-white font-mono focus:ring-2 focus:ring-[#FEB135] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-300 mb-1 font-semibold">Talla Indumentaria / Kit</label>
                <input
                  type="text"
                  value={uniformSize}
                  onChange={(e) => setUniformSize(e.target.value)}
                  placeholder="Ej: M, L, XL, 44"
                  className="w-full px-3 py-2 bg-[#000c33] border border-[#0d349e] rounded-lg text-white focus:ring-2 focus:ring-[#FEB135] focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Sección 2: Afiliación Scout */}
          <div className="pt-3 border-t border-[#0d349e]">
            <h3 className="font-bold text-[#FEB135] uppercase tracking-wider mb-2.5">
              2. Afiliación Scout y Asignación
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div>
                <label className="block text-slate-300 mb-1 font-semibold">Zona Scout</label>
                <input
                  type="text"
                  value={scoutZone}
                  onChange={(e) => setScoutZone(e.target.value)}
                  placeholder="Ej: Santiago Oriente"
                  className="w-full px-3 py-2 bg-[#000c33] border border-[#0d349e] rounded-lg text-white focus:ring-2 focus:ring-[#FEB135] focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-slate-300 mb-1 font-semibold">Distrito Scout</label>
                <input
                  type="text"
                  value={scoutDistrict}
                  onChange={(e) => setScoutDistrict(e.target.value)}
                  placeholder="Ej: Providencia"
                  className="w-full px-3 py-2 bg-[#000c33] border border-[#0d349e] rounded-lg text-white focus:ring-2 focus:ring-[#FEB135] focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-slate-300 mb-1 font-semibold">Grupo Guía y Scout</label>
                <input
                  type="text"
                  value={scoutGroup}
                  onChange={(e) => setScoutGroup(e.target.value)}
                  placeholder="Ej: Grupo San Jorge"
                  className="w-full px-3 py-2 bg-[#000c33] border border-[#0d349e] rounded-lg text-white focus:ring-2 focus:ring-[#FEB135] focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-slate-300 mb-1 font-semibold">Unidad de Contingente</label>
                <input
                  type="text"
                  value={unitName}
                  onChange={(e) => setUnitName(e.target.value)}
                  placeholder="Ej: Tropa Cóndor"
                  className="w-full px-3 py-2 bg-[#000c33] border border-[#0d349e] rounded-lg text-white focus:ring-2 focus:ring-[#FEB135] focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Sección 3: Contacto Apoderado */}
          <div className="pt-3 border-t border-[#0d349e]">
            <h3 className="font-bold text-[#FEB135] uppercase tracking-wider mb-2.5">
              3. Contacto de Apoderado / Emergencia
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-slate-300 mb-1 font-semibold">Nombre Apoderado</label>
                <input
                  type="text"
                  value={guardianName}
                  onChange={(e) => setGuardianName(e.target.value)}
                  placeholder="Ej: Marcela Silva"
                  className="w-full px-3 py-2 bg-[#000c33] border border-[#0d349e] rounded-lg text-white focus:ring-2 focus:ring-[#FEB135] focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-slate-300 mb-1 font-semibold">Teléfono Apoderado</label>
                <input
                  type="text"
                  value={guardianPhone}
                  onChange={(e) => setGuardianPhone(e.target.value)}
                  placeholder="+56 9 9876 5432"
                  className="w-full px-3 py-2 bg-[#000c33] border border-[#0d349e] rounded-lg text-white focus:ring-2 focus:ring-[#FEB135] focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-slate-300 mb-1 font-semibold">Correo Apoderado</label>
                <input
                  type="email"
                  value={guardianEmail}
                  onChange={(e) => setGuardianEmail(e.target.value)}
                  placeholder="marcela@ejemplo.cl"
                  className="w-full px-3 py-2 bg-[#000c33] border border-[#0d349e] rounded-lg text-white focus:ring-2 focus:ring-[#FEB135] focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Submit Actions */}
          <div className="pt-4 border-t border-[#0d349e] flex justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-[#000c33] hover:bg-[#031c6a] text-slate-200 rounded-xl font-bold transition-colors cursor-pointer border border-[#0d349e]"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 bg-[#FEB135] hover:bg-[#e59c22] text-[#001558] rounded-xl font-black flex items-center gap-1.5 shadow-md shadow-[#FEB135]/25 disabled:opacity-50 cursor-pointer transition-all uppercase tracking-wider"
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
