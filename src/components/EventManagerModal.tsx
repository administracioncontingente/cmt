'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  Users,
  PlusCircle,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Loader2,
  UserCheck,
} from 'lucide-react';
import type { EventSummary, TeamMemberDTO, UserSessionDTO } from '@/types/domain';

interface EventManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeEvent: EventSummary | null;
  currentUser: UserSessionDTO | null;
  onEventCreated?: () => void;
}

const INPUT_CLASS =
  'w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-800 placeholder-slate-400 focus:border-[#001558] focus:ring-2 focus:ring-[#FEB135]/50 focus:outline-none transition-all';

export function EventManagerModal({
  isOpen,
  onClose,
  activeEvent,
  currentUser,
  onEventCreated,
}: EventManagerModalProps) {
  const [activeTab, setActiveTab] = useState<'team' | 'newEvent'>('team');
  const [loading, setLoading] = useState(false);
  const [teamMembers, setTeamMembers] = useState<TeamMemberDTO[]>([]);
  const [canManageTeam, setCanManageTeam] = useState(false);

  // Form para nuevo miembro
  const [newMemberEmail, setNewMemberEmail] = useState('');
  const [newMemberName, setNewMemberName] = useState('');
  const [newMemberRole, setNewMemberRole] = useState('COORDINATOR');
  const [newMemberTitle, setNewMemberTitle] = useState('');
  const [newMemberPassword, setNewMemberPassword] = useState('');

  // Form para nuevo evento
  const [newCode, setNewCode] = useState('');
  const [newName, setNewName] = useState('');
  const [newShortName, setNewShortName] = useState('');
  const [newCountry, setNewCountry] = useState('');
  const [newCity, setNewCity] = useState('');
  const [newFlag, setNewFlag] = useState('🏕️');
  const [newCurrency, setNewCurrency] = useState('USD');
  const [newStartDate, setNewStartDate] = useState('');
  const [newEndDate, setNewEndDate] = useState('');

  const [message, setMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  const isSuperAdmin = currentUser?.role === 'SUPER_ADMIN';

  const loadTeam = async () => {
    if (!activeEvent?.id) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/events/${activeEvent.id}/team`);
      if (res.ok) {
        const data = await res.json();
        setTeamMembers(data.members || []);
        setCanManageTeam(Boolean(data.canManageTeam) || isSuperAdmin);
      }
    } catch (err) {
      console.error('Error loading team:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isOpen || !activeEvent?.id) return;
    let cancelled = false;

    async function fetchInitialTeam() {
      try {
        const res = await fetch(`/api/events/${activeEvent!.id}/team`);
        if (!cancelled && res.ok) {
          const data = await res.json();
          setTeamMembers(data.members || []);
          setCanManageTeam(Boolean(data.canManageTeam) || isSuperAdmin);
        }
      } catch (err) {
        console.error('Error loading team:', err);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    fetchInitialTeam();
    return () => {
      cancelled = true;
    };
  }, [isOpen, activeEvent, isSuperAdmin]);

  const handleClose = () => {
    setMessage(null);
    onClose();
  };

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeEvent?.id) return;
    setMessage(null);
    setLoading(true);

    try {
      const res = await fetch(`/api/events/${activeEvent.id}/team`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: newMemberEmail,
          name: newMemberName,
          role: newMemberRole,
          title: newMemberTitle,
          password: newMemberPassword || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al asignar miembro');

      setMessage({
        type: 'success',
        text: `Usuario ${newMemberEmail} asignado exitosamente como ${newMemberRole}.`,
      });
      setNewMemberEmail('');
      setNewMemberName('');
      setNewMemberTitle('');
      setNewMemberPassword('');
      await loadTeam();
    } catch (err: unknown) {
      setMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Error al asignar miembro',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveMember = async (userId: string, userName: string) => {
    if (!activeEvent?.id) return;
    if (
      !confirm(
        `¿Estás seguro de remover a ${userName} del equipo de este evento?`
      )
    ) {
      return;
    }

    setMessage(null);
    setLoading(true);
    try {
      const res = await fetch(
        `/api/events/${activeEvent.id}/team?userId=${userId}`,
        {
          method: 'DELETE',
        }
      );
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Error al remover miembro');
      }
      setMessage({ type: 'success', text: 'Miembro removido del evento.' });
      await loadTeam();
    } catch (err: unknown) {
      setMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Error al remover miembro',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    setLoading(true);

    try {
      const res = await fetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: newCode,
          name: newName,
          shortName: newShortName,
          country: newCountry,
          city: newCity,
          flagEmoji: newFlag,
          currency: newCurrency,
          startDate: newStartDate || undefined,
          endDate: newEndDate || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al crear evento');

      setMessage({
        type: 'success',
        text: `¡Evento "${newName}" creado con éxito!`,
      });
      setNewCode('');
      setNewName('');
      setNewShortName('');
      setNewCountry('');
      setNewCity('');
      if (onEventCreated) onEventCreated();
    } catch (err: unknown) {
      setMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Error al crear evento',
      });
    } finally {
      setLoading(false);
    }
  };

  const getRolePillClass = (role: string) => {
    if (role === 'EVENT_ADMIN') {
      return 'bg-[#FFF8E1] text-[#001558] border-[#FEB135]';
    }
    if (role === 'TREASURER') {
      return 'bg-emerald-50 text-emerald-800 border-emerald-200';
    }
    if (role === 'MEDICAL_STAFF') {
      return 'bg-red-50 text-red-700 border-red-200';
    }
    return 'bg-[#EEF2FF] text-[#001558] border-[#001558]/20';
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#001558]/40 backdrop-blur-xs">
      <div className="bg-white border border-slate-200 w-full max-w-4xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-[#001558] text-white px-6 py-4 border-b-4 border-b-[#FEB135] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">{activeEvent?.flagEmoji || '🏕️'}</span>
            <div>
              <h2 className="text-lg font-extrabold text-white">
                Gestión de Eventos y Permisos AGSCH
              </h2>
              <p className="text-xs text-slate-200">
                Evento activo:{' '}
                <span className="font-bold text-[#FEB135]">
                  {activeEvent?.name || 'Sin evento'}
                </span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="text-white/75 hover:text-white p-2 rounded-lg hover:bg-white/10 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selector */}
        <div className="flex border-b border-slate-200 bg-[#F5F6F8]">
          <button
            type="button"
            onClick={() => {
              setActiveTab('team');
              setMessage(null);
            }}
            className={`flex items-center gap-2 px-6 py-3 text-xs font-bold uppercase tracking-wider transition border-b-2 cursor-pointer ${
              activeTab === 'team'
                ? 'border-[#001558] text-[#001558] bg-white'
                : 'border-transparent text-slate-500 hover:text-[#001558]'
            }`}
          >
            <Users className="w-4 h-4" />
            Equipo y Permisos del Evento
          </button>

          {isSuperAdmin && (
            <button
              type="button"
              onClick={() => {
                setActiveTab('newEvent');
                setMessage(null);
              }}
              className={`flex items-center gap-2 px-6 py-3 text-xs font-bold uppercase tracking-wider transition border-b-2 cursor-pointer ${
                activeTab === 'newEvent'
                  ? 'border-[#001558] text-[#001558] bg-white'
                  : 'border-transparent text-slate-500 hover:text-[#001558]'
              }`}
            >
              <PlusCircle className="w-4 h-4" />
              Crear Nuevo Evento (Super Admin)
            </button>
          )}
        </div>

        {/* Status Message */}
        {message && (
          <div
            className={`px-6 py-3 text-xs flex items-center gap-2 border-b ${
              message.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : 'bg-red-50 text-red-700 border-red-200'
            }`}
          >
            {message.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
            )}
            <span className="font-medium">{message.text}</span>
          </div>
        )}

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6 bg-white">
          {activeTab === 'team' && (
            <div className="space-y-6">
              {/* Info banner roles */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="bg-[#FFFBF0] border border-[#FEB135]/40 border-l-4 border-l-[#FEB135] p-3 rounded-xl text-[11px]">
                  <span className="font-extrabold text-[#001558] block mb-1">
                    EVENT_ADMIN
                  </span>
                  <span className="text-slate-600">
                    Control total del evento, cupos, planes y gestión del equipo.
                  </span>
                </div>
                <div className="bg-emerald-50/70 border border-emerald-200 border-l-4 border-l-emerald-500 p-3 rounded-xl text-[11px]">
                  <span className="font-extrabold text-emerald-800 block mb-1">
                    TREASURER
                  </span>
                  <span className="text-slate-600">
                    Gestión de cuotas, registro de pagos y conciliación financiera.
                  </span>
                </div>
                <div className="bg-red-50/70 border border-red-200 border-l-4 border-l-red-500 p-3 rounded-xl text-[11px]">
                  <span className="font-extrabold text-red-700 block mb-1">
                    MEDICAL_STAFF
                  </span>
                  <span className="text-slate-600">
                    Acceso clínico, revisión de fichas médicas, alergias severas y EpiPen.
                  </span>
                </div>
                <div className="bg-[#EEF2FF] border border-[#001558]/20 border-l-4 border-l-[#001558] p-3 rounded-xl text-[11px]">
                  <span className="font-extrabold text-[#001558] block mb-1">
                    COORDINATOR
                  </span>
                  <span className="text-slate-600">
                    Coordinación de patrullas, unidades y nómina de participantes.
                  </span>
                </div>
              </div>

              {/* Members Table */}
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                <div className="px-4 py-3 bg-[#F5F6F8] border-b border-slate-200 flex items-center justify-between">
                  <span className="text-xs font-extrabold text-[#001558] uppercase tracking-wider">
                    Miembros Actuales del Equipo ({teamMembers.length})
                  </span>
                  {loading && (
                    <Loader2 className="w-4 h-4 animate-spin text-[#001558]" />
                  )}
                </div>

                <div className="divide-y divide-slate-200">
                  {teamMembers.length === 0 ? (
                    <div className="p-8 text-center text-xs text-slate-500">
                      No hay miembros asignados directamente a este evento aún.
                    </div>
                  ) : (
                    teamMembers.map((m) => (
                      <div
                        key={m.id}
                        className="p-4 flex items-center justify-between gap-4 hover:bg-[#FFFBF0]/50 transition-colors"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-9 h-9 rounded-full bg-[#EEF2FF] border border-[#001558]/20 flex items-center justify-center text-sm font-black text-[#001558] shrink-0">
                            {m.user?.name?.[0] || 'U'}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-sm text-[#001558] truncate">
                                {m.user?.name}
                              </span>
                              {m.user?.role === 'SUPER_ADMIN' && (
                                <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-purple-50 text-purple-800 border border-purple-200">
                                  SUPER ADMIN
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-slate-500 flex items-center gap-2 truncate">
                              <span>{m.user?.email}</span>
                              {m.title && (
                                <span className="text-slate-400">
                                  • {m.title}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 shrink-0">
                          <span
                            className={`px-2.5 py-1 rounded-full text-[11px] font-bold border ${getRolePillClass(
                              m.role
                            )}`}
                          >
                            {m.role}
                          </span>

                          {canManageTeam && m.user?.id !== currentUser?.id && (
                            <button
                              type="button"
                              onClick={() =>
                                handleRemoveMember(m.userId, m.user?.name)
                              }
                              className="text-slate-400 hover:text-red-700 p-1.5 rounded-lg hover:bg-red-50 transition cursor-pointer"
                              title="Remover del evento"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Add Member Form */}
              {canManageTeam && (
                <div className="bg-[#F5F6F8] border border-slate-200 p-5 rounded-xl space-y-4">
                  <div className="flex items-center gap-2 text-xs font-extrabold text-[#001558] uppercase tracking-wider">
                    <UserCheck className="w-4 h-4 text-[#FEB135]" />
                    Asignar o Invitar Nuevo Miembro al Equipo
                  </div>

                  <form
                    onSubmit={handleAddMember}
                    className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3"
                  >
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        Correo Electrónico *
                      </label>
                      <input
                        type="email"
                        required
                        placeholder="ejemplo@agsch.cl"
                        value={newMemberEmail}
                        onChange={(e) => setNewMemberEmail(e.target.value)}
                        className={INPUT_CLASS}
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        Nombre Completo
                      </label>
                      <input
                        type="text"
                        placeholder="Ej: Claudia Morales"
                        value={newMemberName}
                        onChange={(e) => setNewMemberName(e.target.value)}
                        className={INPUT_CLASS}
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        Rol en este Evento *
                      </label>
                      <select
                        value={newMemberRole}
                        onChange={(e) => setNewMemberRole(e.target.value)}
                        className={INPUT_CLASS}
                      >
                        <option value="EVENT_ADMIN">
                          EVENT_ADMIN (Administrador)
                        </option>
                        <option value="TREASURER">
                          TREASURER (Tesorero/a)
                        </option>
                        <option value="MEDICAL_STAFF">
                          MEDICAL_STAFF (Equipo Médico)
                        </option>
                        <option value="COORDINATOR">
                          COORDINATOR (Coordinador)
                        </option>
                        <option value="VIEWER">VIEWER (Solo Consulta)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        Cargo / Título Oficial
                      </label>
                      <input
                        type="text"
                        placeholder="Ej: Jefa de Unidad Tropa Cóndor"
                        value={newMemberTitle}
                        onChange={(e) => setNewMemberTitle(e.target.value)}
                        className={INPUT_CLASS}
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        Contraseña Inicial (si es nuevo)
                      </label>
                      <input
                        type="password"
                        placeholder="Mín. 6 caracteres (si es nuevo)"
                        value={newMemberPassword}
                        onChange={(e) => setNewMemberPassword(e.target.value)}
                        className={INPUT_CLASS}
                      />
                    </div>

                    <div className="flex items-end">
                      <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-[#001558] hover:bg-[#0b2370] text-white font-bold text-xs py-2 px-4 rounded-lg transition flex items-center justify-center gap-2 shadow-xs disabled:opacity-50 cursor-pointer"
                      >
                        {loading ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <PlusCircle className="w-4 h-4 text-[#FEB135]" />
                        )}
                        Guardar Miembro
                      </button>
                    </div>
                  </form>
                </div>
              )}
            </div>
          )}

          {activeTab === 'newEvent' && isSuperAdmin && (
            <form
              onSubmit={handleCreateEvent}
              className="space-y-4 max-w-2xl mx-auto"
            >
              <div className="bg-[#FFFBF0] border border-[#FEB135]/40 border-l-4 border-l-[#FEB135] p-4 rounded-xl text-xs text-[#001558]">
                Como <strong>SUPER_ADMIN</strong>, puedes crear nuevos eventos
                institucionales para la Asociación (Jamborees Mundiales, Moots,
                Paxtu Nacionales, Encuentros de Guiadoras). Cada evento tendrá
                sus propios participantes, cuotas y equipo de gestión
                independiente.
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Código Único * (Ej: MOOT-2029)
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="JAMBOREE-2031"
                    value={newCode}
                    onChange={(e) => setNewCode(e.target.value)}
                    className={INPUT_CLASS}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Bandera / Emoji *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="🇵🇹"
                    value={newFlag}
                    onChange={(e) => setNewFlag(e.target.value)}
                    className={INPUT_CLASS}
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Nombre Oficial del Evento *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="27° World Scout Jamboree • Dinamarca 2031"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    className={INPUT_CLASS}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Nombre Corto
                  </label>
                  <input
                    type="text"
                    placeholder="Dinamarca 2031"
                    value={newShortName}
                    onChange={(e) => setNewShortName(e.target.value)}
                    className={INPUT_CLASS}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Moneda de Pago Oficial *
                  </label>
                  <select
                    value={newCurrency}
                    onChange={(e) => setNewCurrency(e.target.value)}
                    className={INPUT_CLASS}
                  >
                    <option value="USD">USD (Dólares Americanos)</option>
                    <option value="EUR">EUR (Euros)</option>
                    <option value="CLP">CLP (Pesos Chilenos)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    País Sede
                  </label>
                  <input
                    type="text"
                    placeholder="Dinamarca"
                    value={newCountry}
                    onChange={(e) => setNewCountry(e.target.value)}
                    className={INPUT_CLASS}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Ciudad / Lugar
                  </label>
                  <input
                    type="text"
                    placeholder="Copenhague"
                    value={newCity}
                    onChange={(e) => setNewCity(e.target.value)}
                    className={INPUT_CLASS}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Fecha de Inicio
                  </label>
                  <input
                    type="date"
                    value={newStartDate}
                    onChange={(e) => setNewStartDate(e.target.value)}
                    className={INPUT_CLASS}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Fecha de Término
                  </label>
                  <input
                    type="date"
                    value={newEndDate}
                    onChange={(e) => setNewEndDate(e.target.value)}
                    className={INPUT_CLASS}
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-slate-200 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setActiveTab('team')}
                  className="px-4 py-2 rounded-lg text-xs font-bold text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="bg-[#FEB135] hover:bg-[#e59c22] text-[#001558] font-extrabold text-xs py-2 px-6 rounded-lg transition flex items-center gap-2 shadow-xs disabled:opacity-50 cursor-pointer"
                >
                  {loading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <PlusCircle className="w-4 h-4" />
                  )}
                  Crear Evento Institucional
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
