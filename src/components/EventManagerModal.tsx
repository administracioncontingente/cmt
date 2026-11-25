'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  Users,
  PlusCircle,
  Shield,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Calendar,
  Globe,
  DollarSign,
  UserCheck,
} from 'lucide-react';

interface EventManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeEvent: {
    id: string;
    code: string;
    name: string;
    shortName?: string | null;
    flagEmoji?: string | null;
    currency?: string;
  } | null;
  currentUser: {
    id: string;
    email: string;
    name: string;
    role: string;
  } | null;
  onEventCreated?: () => void;
}

export function EventManagerModal({
  isOpen,
  onClose,
  activeEvent,
  currentUser,
  onEventCreated,
}: EventManagerModalProps) {
  const [activeTab, setActiveTab] = useState<'team' | 'newEvent'>('team');
  const [loading, setLoading] = useState(false);
  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  const [canManageTeam, setCanManageTeam] = useState(false);

  // Form para nuevo miembro
  const [newMemberEmail, setNewMemberEmail] = useState('');
  const [newMemberName, setNewMemberName] = useState('');
  const [newMemberRole, setNewMemberRole] = useState('COORDINATOR');
  const [newMemberTitle, setNewMemberTitle] = useState('');
  const [newMemberPassword, setNewMemberPassword] = useState('admin123');

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

  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const isSuperAdmin = currentUser?.role === 'SUPER_ADMIN';

  // Cargar equipo del evento
  const loadTeam = async () => {
    if (!activeEvent?.id) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/events/${activeEvent.id}/team`);
      if (res.ok) {
        const data = await res.json();
        setTeamMembers(data.members || []);
        setCanManageTeam(data.canManageTeam || isSuperAdmin);
      }
    } catch (err) {
      console.error('Error loading team:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && activeEvent?.id) {
      loadTeam();
      setMessage(null);
    }
  }, [isOpen, activeEvent?.id]);

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
          password: newMemberPassword,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al asignar miembro');

      setMessage({ type: 'success', text: `Usuario ${newMemberEmail} asignado exitosamente como ${newMemberRole}.` });
      setNewMemberEmail('');
      setNewMemberName('');
      setNewMemberTitle('');
      loadTeam();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveMember = async (userId: string, userName: string) => {
    if (!activeEvent?.id) return;
    if (!confirm(`¿Estás seguro de remover a ${userName} del equipo de este evento?`)) return;

    setLoading(true);
    try {
      const res = await fetch(`/api/events/${activeEvent.id}/team?userId=${userId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setMessage({ type: 'success', text: 'Miembro removido del evento.' });
        loadTeam();
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
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

      setMessage({ type: 'success', text: `¡Evento "${newName}" creado con éxito!` });
      setNewCode('');
      setNewName('');
      setNewShortName('');
      setNewCountry('');
      setNewCity('');
      if (onEventCreated) onEventCreated();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="bg-[#000c33] border border-[#0d349e] w-full max-w-4xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-[#001558] px-6 py-4 border-b border-[#0d349e] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">{activeEvent?.flagEmoji || '🏕️'}</span>
            <div>
              <h2 className="text-lg font-black text-white">
                Gestión de Eventos y Permisos AGSCH
              </h2>
              <p className="text-xs text-slate-300">
                Evento activo: <span className="font-bold text-[#FEB135]">{activeEvent?.name}</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-2 rounded-lg hover:bg-white/10 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selector */}
        <div className="flex border-b border-[#0d349e] bg-[#001040]">
          <button
            onClick={() => { setActiveTab('team'); setMessage(null); }}
            className={`flex items-center gap-2 px-6 py-3 text-xs font-bold uppercase tracking-wider transition border-b-2 ${
              activeTab === 'team'
                ? 'border-[#FEB135] text-[#FEB135] bg-[#001558]'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Users className="w-4 h-4" />
            Equipo y Permisos del Evento
          </button>

          {isSuperAdmin && (
            <button
              onClick={() => { setActiveTab('newEvent'); setMessage(null); }}
              className={`flex items-center gap-2 px-6 py-3 text-xs font-bold uppercase tracking-wider transition border-b-2 ${
                activeTab === 'newEvent'
                  ? 'border-[#FEB135] text-[#FEB135] bg-[#001558]'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
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
            className={`px-6 py-3 text-xs flex items-center gap-2 ${
              message.type === 'success'
                ? 'bg-emerald-950/80 text-emerald-300 border-b border-emerald-500/30'
                : 'bg-red-950/80 text-red-300 border-b border-red-500/30'
            }`}
          >
            {message.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
            )}
            <span>{message.text}</span>
          </div>
        )}

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6">
          {activeTab === 'team' && (
            <div className="space-y-6">
              {/* Info banner roles */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="bg-[#001558]/60 border border-[#0d349e] p-3 rounded-xl text-[11px]">
                  <span className="font-bold text-[#FEB135] block mb-1">EVENT_ADMIN</span>
                  <span className="text-slate-300">Control total del evento, cupos, planes y gestión del equipo.</span>
                </div>
                <div className="bg-[#001558]/60 border border-[#0d349e] p-3 rounded-xl text-[11px]">
                  <span className="font-bold text-emerald-400 block mb-1">TREASURER</span>
                  <span className="text-slate-300">Gestión de cuotas, registro de pagos y conciliación financiera en USD.</span>
                </div>
                <div className="bg-[#001558]/60 border border-[#0d349e] p-3 rounded-xl text-[11px]">
                  <span className="font-bold text-red-400 block mb-1">MEDICAL_STAFF</span>
                  <span className="text-slate-300">Acceso clínico, revisión de fichas médicas, alergias severas y EpiPen.</span>
                </div>
                <div className="bg-[#001558]/60 border border-[#0d349e] p-3 rounded-xl text-[11px]">
                  <span className="font-bold text-blue-400 block mb-1">COORDINATOR</span>
                  <span className="text-slate-300">Coordinación de patrullas, unidades y nómina de participantes.</span>
                </div>
              </div>

              {/* Members Table */}
              <div className="bg-[#001558]/40 border border-[#0d349e] rounded-xl overflow-hidden">
                <div className="px-4 py-3 bg-[#001558] border-b border-[#0d349e] flex items-center justify-between">
                  <span className="text-xs font-bold text-white uppercase tracking-wider">
                    Miembros Actuales del Equipo ({teamMembers.length})
                  </span>
                  {loading && <Loader2 className="w-4 h-4 animate-spin text-[#FEB135]" />}
                </div>

                <div className="divide-y divide-[#0d349e]/50">
                  {teamMembers.length === 0 ? (
                    <div className="p-8 text-center text-xs text-slate-400">
                      No hay miembros asignados directamente a este evento aún.
                    </div>
                  ) : (
                    teamMembers.map((m) => (
                      <div key={m.id} className="p-4 flex items-center justify-between gap-4 hover:bg-white/[0.02]">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-9 h-9 rounded-full bg-[#001558] border border-[#FEB135]/40 flex items-center justify-center text-sm font-black text-[#FEB135]">
                            {m.user?.name?.[0] || 'U'}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-sm text-white truncate">{m.user?.name}</span>
                              {m.user?.role === 'SUPER_ADMIN' && (
                                <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-purple-500/20 text-purple-300 border border-purple-500/30">
                                  SUPER ADMIN
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-slate-400 flex items-center gap-2">
                              <span>{m.user?.email}</span>
                              {m.title && <span className="text-slate-500">• {m.title}</span>}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 shrink-0">
                          <span
                            className={`px-2.5 py-1 rounded-full text-[11px] font-bold border ${
                              m.role === 'EVENT_ADMIN'
                                ? 'bg-[#FEB135]/20 text-[#FEB135] border-[#FEB135]/40'
                                : m.role === 'TREASURER'
                                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                                : m.role === 'MEDICAL_STAFF'
                                ? 'bg-red-500/20 text-red-300 border-red-500/40'
                                : 'bg-blue-500/20 text-blue-300 border-blue-500/40'
                            }`}
                          >
                            {m.role}
                          </span>

                          {canManageTeam && m.user?.id !== currentUser?.id && (
                            <button
                              onClick={() => handleRemoveMember(m.userId, m.user?.name)}
                              className="text-slate-400 hover:text-red-400 p-1.5 rounded-lg hover:bg-red-500/10 transition"
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
                <div className="bg-[#001558]/80 border border-[#0d349e] p-5 rounded-xl space-y-4">
                  <div className="flex items-center gap-2 text-xs font-bold text-[#FEB135] uppercase tracking-wider">
                    <UserCheck className="w-4 h-4" />
                    Asignar o Invitar Nuevo Miembro al Equipo
                  </div>

                  <form onSubmit={handleAddMember} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-300 mb-1">
                        Correo Electrónico *
                      </label>
                      <input
                        type="email"
                        required
                        placeholder="ejemplo@agsch.cl"
                        value={newMemberEmail}
                        onChange={(e) => setNewMemberEmail(e.target.value)}
                        className="w-full bg-[#000c33] border border-[#0d349e] rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#FEB135]"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-300 mb-1">
                        Nombre Completo
                      </label>
                      <input
                        type="text"
                        placeholder="Ej: Claudia Morales"
                        value={newMemberName}
                        onChange={(e) => setNewMemberName(e.target.value)}
                        className="w-full bg-[#000c33] border border-[#0d349e] rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#FEB135]"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-300 mb-1">
                        Rol en este Evento *
                      </label>
                      <select
                        value={newMemberRole}
                        onChange={(e) => setNewMemberRole(e.target.value)}
                        className="w-full bg-[#000c33] border border-[#0d349e] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-[#FEB135]"
                      >
                        <option value="EVENT_ADMIN">EVENT_ADMIN (Administrador)</option>
                        <option value="TREASURER">TREASURER (Tesorero/a)</option>
                        <option value="MEDICAL_STAFF">MEDICAL_STAFF (Equipo Médico)</option>
                        <option value="COORDINATOR">COORDINATOR (Coordinador)</option>
                        <option value="VIEWER">VIEWER (Solo Consulta)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-300 mb-1">
                        Cargo / Título Oficial
                      </label>
                      <input
                        type="text"
                        placeholder="Ej: Jefa de Unidad Tropa Cóndor"
                        value={newMemberTitle}
                        onChange={(e) => setNewMemberTitle(e.target.value)}
                        className="w-full bg-[#000c33] border border-[#0d349e] rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#FEB135]"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-300 mb-1">
                        Contraseña Inicial (si es nuevo)
                      </label>
                      <input
                        type="text"
                        value={newMemberPassword}
                        onChange={(e) => setNewMemberPassword(e.target.value)}
                        className="w-full bg-[#000c33] border border-[#0d349e] rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#FEB135]"
                      />
                    </div>

                    <div className="flex items-end">
                      <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-[#FEB135] text-[#001558] hover:bg-[#ffbe4f] font-bold text-xs py-2 px-4 rounded-lg transition flex items-center justify-center gap-2 shadow-md disabled:opacity-50"
                      >
                        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <PlusCircle className="w-4 h-4" />}
                        Guardar Miembro
                      </button>
                    </div>
                  </form>
                </div>
              )}
            </div>
          )}

          {activeTab === 'newEvent' && isSuperAdmin && (
            <form onSubmit={handleCreateEvent} className="space-y-4 max-w-2xl mx-auto">
              <div className="bg-[#001558]/60 border border-[#0d349e] p-4 rounded-xl text-xs text-slate-300">
                Como <strong>SUPER_ADMIN</strong>, puedes crear nuevos eventos institucionales para la Asociación (Jamborees Mundiales, Moots, Paxtu Nacionales, Encuentros de Guiadoras). Cada evento tendrá sus propios participantes, cuotas y equipo de gestión independiente.
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    Código Único * (Ej: MOOT-2029)
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="JAMBOREE-2031"
                    value={newCode}
                    onChange={(e) => setNewCode(e.target.value)}
                    className="w-full bg-[#001558] border border-[#0d349e] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-[#FEB135]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    Bandera / Emoji *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="🇵🇹"
                    value={newFlag}
                    onChange={(e) => setNewFlag(e.target.value)}
                    className="w-full bg-[#001558] border border-[#0d349e] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-[#FEB135]"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    Nombre Oficial del Evento *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="27° World Scout Jamboree • Dinamarca 2031"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    className="w-full bg-[#001558] border border-[#0d349e] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-[#FEB135]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    Nombre Corto
                  </label>
                  <input
                    type="text"
                    placeholder="Dinamarca 2031"
                    value={newShortName}
                    onChange={(e) => setNewShortName(e.target.value)}
                    className="w-full bg-[#001558] border border-[#0d349e] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-[#FEB135]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    Moneda de Pago Oficial *
                  </label>
                  <select
                    value={newCurrency}
                    onChange={(e) => setNewCurrency(e.target.value)}
                    className="w-full bg-[#001558] border border-[#0d349e] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-[#FEB135]"
                  >
                    <option value="USD">USD (Dólares Americanos)</option>
                    <option value="EUR">EUR (Euros)</option>
                    <option value="CLP">CLP (Pesos Chilenos)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    País Sede
                  </label>
                  <input
                    type="text"
                    placeholder="Dinamarca"
                    value={newCountry}
                    onChange={(e) => setNewCountry(e.target.value)}
                    className="w-full bg-[#001558] border border-[#0d349e] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-[#FEB135]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    Ciudad / Lugar
                  </label>
                  <input
                    type="text"
                    placeholder="Copenhague"
                    value={newCity}
                    onChange={(e) => setNewCity(e.target.value)}
                    className="w-full bg-[#001558] border border-[#0d349e] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-[#FEB135]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    Fecha de Inicio
                  </label>
                  <input
                    type="date"
                    value={newStartDate}
                    onChange={(e) => setNewStartDate(e.target.value)}
                    className="w-full bg-[#001558] border border-[#0d349e] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-[#FEB135]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    Fecha de Término
                  </label>
                  <input
                    type="date"
                    value={newEndDate}
                    onChange={(e) => setNewEndDate(e.target.value)}
                    className="w-full bg-[#001558] border border-[#0d349e] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-[#FEB135]"
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-[#0d349e] flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setActiveTab('team')}
                  className="px-4 py-2 rounded-lg text-xs font-bold text-slate-300 hover:bg-white/10 transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="bg-[#FEB135] text-[#001558] hover:bg-[#ffbe4f] font-bold text-xs py-2 px-6 rounded-lg transition flex items-center gap-2 shadow-lg disabled:opacity-50"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <PlusCircle className="w-4 h-4" />}
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
