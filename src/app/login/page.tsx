'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import {
  ShieldCheck,
  Lock,
  Mail,
  ArrowRight,
  Loader2,
  Eye,
  EyeOff,
  Heart,
  Users,
  UserCheck,
  Globe,
  AlertCircle,
  CreditCard,
  FileText,
} from 'lucide-react';
import { useToast } from '@/components/ui/ToastProvider';

const isDevelopment = process.env.NODE_ENV === 'development';

export default function LoginPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Credenciales incorrectas');
      }

      toast.success('Sesión iniciada correctamente', 'Bienvenido');
      router.push('/');
      router.refresh();
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Error al iniciar sesión';
      setError(message);
      toast.error(message, 'Acceso denegado');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickFill = () => {
    if (!isDevelopment) return;
    setEmail('admin@agsch.cl');
    setPassword('admin123');
  };

  return (
    <div className="min-h-screen bg-[#F5F6F8] flex flex-col justify-center items-center px-4 py-8 sm:py-12 relative overflow-hidden">
      {/* Subtle institutional top bar accent */}
      <div className="fixed top-0 inset-x-0 h-1.5 bg-[#001558] z-20">
        <div className="h-full w-1/3 bg-[#FEB135]" />
      </div>

      <div className="w-full max-w-5xl relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
          {/* Columna Izquierda: Panel Informativo Institucional */}
          <aside className="lg:col-span-5 bg-[#001558] text-white rounded-3xl border-t-4 border-t-[#FEB135] shadow-xl p-7 sm:p-8 flex flex-col justify-between relative overflow-hidden">
            <div className="space-y-6">
              <div className="flex items-center justify-between gap-3">
                <div className="relative w-44 h-12">
                  <Image
                    src="/agsch-logo-white.svg"
                    alt="Asociación de Guías y Scouts de Chile"
                    fill
                    priority
                    className="object-contain object-left"
                  />
                </div>
                <span className="px-2.5 py-1 rounded-full bg-[#FEB135] text-[#001558] text-[10px] font-black uppercase tracking-wider shrink-0">
                  Multievento
                </span>
              </div>

              <div className="space-y-2.5 pt-2 border-t border-white/15">
                <p className="text-[11px] font-bold uppercase tracking-widest text-[#FEB135]">
                  Asociación de Guías y Scouts de Chile
                </p>
                <h2 className="text-xl sm:text-2xl font-black leading-tight text-white">
                  Gestión de Eventos y Contingentes
                </h2>
                <p className="text-xs sm:text-sm text-slate-200 leading-relaxed">
                  Plataforma oficial multievento para la coordinación de
                  contingentes nacionales e internacionales, control de cuotas,
                  salud y comunicaciones.
                </p>
              </div>

              <ul className="space-y-3 pt-1 text-xs text-slate-100">
                <li className="flex items-start gap-3">
                  <div className="w-7 h-7 rounded-lg bg-white/10 border border-[#FEB135]/40 flex items-center justify-center shrink-0 mt-0.5">
                    <Users className="w-3.5 h-3.5 text-[#FEB135]" />
                  </div>
                  <div>
                    <p className="font-bold text-white">Nómina y Unidades</p>
                    <p className="text-slate-300 text-[11px]">
                      Seguimiento de cupos, patrullas, IST, Dirigentes y CMT.
                    </p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-7 h-7 rounded-lg bg-white/10 border border-[#FEB135]/40 flex items-center justify-center shrink-0 mt-0.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-[#FEB135]" />
                  </div>
                  <div>
                    <p className="font-bold text-white">Control de Cuotas</p>
                    <p className="text-slate-300 text-[11px]">
                      Registro verificado de abonos, planes de pago y morosidad.
                    </p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-7 h-7 rounded-lg bg-white/10 border border-[#FEB135]/40 flex items-center justify-center shrink-0 mt-0.5">
                    <Globe className="w-3.5 h-3.5 text-[#FEB135]" />
                  </div>
                  <div>
                    <p className="font-bold text-white">
                      Salud Multilingüe &amp; QR
                    </p>
                    <p className="text-slate-300 text-[11px]">
                      Fichas médicas oficiales multilingües con código QR de
                      emergencia.
                    </p>
                  </div>
                </li>
              </ul>
            </div>

            <div className="mt-8 pt-4 border-t border-white/15 flex items-center justify-between text-[11px] text-slate-300">
              <span>Identidad Oficial Kit Digital</span>
              <span className="font-bold text-[#FEB135]">AGSCH • Eventos</span>
            </div>
          </aside>

          {/* Columna Derecha: Logo Oficial a Color + Tarjeta de Inicio de Sesión */}
          <div className="lg:col-span-7 flex flex-col justify-between gap-4">
            <div className="bg-white border border-slate-200 border-t-4 border-t-[#001558] rounded-3xl shadow-xl p-6 sm:p-8 flex-1 flex flex-col justify-center">
              {/* Branding Oficial a Color */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6 pb-5 border-b border-slate-200">
                <div className="relative w-52 h-14 shrink-0">
                  <Image
                    src="/agsch-logo-color.svg"
                    alt="Asociación de Guías y Scouts de Chile"
                    fill
                    priority
                    className="object-contain object-left"
                  />
                </div>
                <div className="sm:text-right">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FFFBF0] border border-[#FEB135] text-[#001558] text-[11px] font-bold">
                    <ShieldCheck className="w-3.5 h-3.5 text-[#001558]" />
                    Equipo Organizador
                  </div>
                  <h1 className="text-lg sm:text-xl font-black text-[#001558] tracking-tight mt-1.5">
                    Portal de Administración
                  </h1>
                </div>
              </div>

              {error && (
                <div
                  role="alert"
                  className="mb-5 p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-start gap-2.5"
                >
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">Error de acceso:</span> {error}
                  </div>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label
                    htmlFor="login-email"
                    className="block text-xs font-bold text-[#001558] uppercase tracking-wider mb-1.5"
                  >
                    Correo Electrónico
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                      <Mail className="w-4 h-4" />
                    </div>
                    <input
                      id="login-email"
                      type="email"
                      autoComplete="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="nombre@agsch.cl"
                      className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-300 rounded-xl text-slate-800 placeholder-slate-400 focus:border-[#001558] focus:ring-2 focus:ring-[#FEB135]/50 focus:outline-none text-sm transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="login-password"
                    className="block text-xs font-bold text-[#001558] uppercase tracking-wider mb-1.5"
                  >
                    Contraseña
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                      <Lock className="w-4 h-4" />
                    </div>
                    <input
                      id="login-password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="current-password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full pl-10 pr-11 py-2.5 bg-white border border-slate-300 rounded-xl text-slate-800 placeholder-slate-400 focus:border-[#001558] focus:ring-2 focus:ring-[#FEB135]/50 focus:outline-none text-sm transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((prev) => !prev)}
                      aria-label={
                        showPassword
                          ? 'Ocultar contraseña'
                          : 'Mostrar contraseña'
                      }
                      aria-pressed={showPassword}
                      className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-[#001558] transition-colors cursor-pointer"
                    >
                      {showPassword ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-[#001558] hover:bg-[#0b2370] text-white font-extrabold text-xs uppercase tracking-wider transition-all shadow-md disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer mt-2"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Verificando...
                    </>
                  ) : (
                    <>
                      Ingresar al Sistema
                      <ArrowRight className="w-4 h-4 text-[#FEB135]" />
                    </>
                  )}
                </button>
              </form>

              {/* Quick Fill Box: SOLO en entorno de desarrollo */}
              {isDevelopment && (
                <div className="mt-5 pt-4 border-t border-slate-200">
                  <div className="bg-[#FFFBF0] border border-[#FEB135]/40 border-l-4 border-l-[#FEB135] rounded-xl p-3 text-xs flex items-center justify-between gap-2 text-[#001558]">
                    <div>
                      <span className="text-slate-600 font-medium">
                        Modo Desarrollo:{' '}
                      </span>
                      <span className="text-[#001558] font-mono font-bold">
                        admin@agsch.cl
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={handleQuickFill}
                      className="text-[#001558] hover:underline font-extrabold text-xs cursor-pointer shrink-0"
                    >
                      Autocompletar
                    </button>
                  </div>
                </div>
              )}

              {/* Accesos secundarios visibles para familias y participantes */}
              <div className="mt-6 pt-5 border-t border-slate-200 space-y-3">
                {/* Tarjeta Principal: Portal del Participante */}
                <div className="bg-[#EEF2FF] border-2 border-[#001558]/25 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-[#001558] text-[#FEB135] flex items-center justify-center shrink-0 shadow-xs">
                      <UserCheck className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-xs sm:text-sm font-black text-[#001558]">
                          Portal del Participante
                        </p>
                        <span className="px-2 py-0.5 rounded-full bg-[#FFF8E1] border border-[#FEB135] text-[#001558] text-[10px] font-extrabold">
                          /portal
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-700 leading-snug mt-0.5">
                        Consulta tus cuotas, actualiza tus datos, ficha médica,
                        comprobantes y tallas del kit ingresando con un enlace a
                        tu correo.
                      </p>
                    </div>
                  </div>
                  <Link
                    href="/portal"
                    className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#001558] hover:bg-[#0b2370] text-white font-black text-xs whitespace-nowrap transition-colors shadow-xs shrink-0"
                  >
                    Ir al Portal
                    <ArrowRight className="w-3.5 h-3.5 text-[#FEB135]" />
                  </Link>
                </div>

                {/* Accesos compactos secundarios */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <Link
                    href="/eventos"
                    className="group bg-[#EEF2FF]/60 hover:bg-[#EEF2FF] border border-[#001558]/20 rounded-xl p-3 flex items-center justify-between gap-2 transition-colors"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-white border border-[#001558]/15 flex items-center justify-center shrink-0">
                        <FileText className="w-4 h-4 text-[#001558]" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-extrabold text-[#001558] truncate">
                          Eventos y Documentos
                        </p>
                        <p className="text-[10px] text-slate-600 truncate">
                          Información, circulares y fichas
                        </p>
                      </div>
                    </div>
                    <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-[#001558] shrink-0 transition-colors" />
                  </Link>

                  <Link
                    href="/pagos"
                    className="group bg-[#F5F6F8] hover:bg-[#EEF2FF] border border-slate-200 hover:border-[#001558]/30 rounded-xl p-3 flex items-center justify-between gap-2 transition-colors"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center shrink-0">
                        <CreditCard className="w-4 h-4 text-[#001558]" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-extrabold text-[#001558] truncate">
                          Informar Pago Rápido
                        </p>
                        <p className="text-[10px] text-slate-600 truncate">
                          Comprobante individual o grupal
                        </p>
                      </div>
                    </div>
                    <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-[#001558] shrink-0 transition-colors" />
                  </Link>

                  <Link
                    href="/ficha-medica"
                    className="group bg-[#FFFBF0] hover:bg-[#FFF8E1] border border-[#FEB135]/60 rounded-xl p-3 flex items-center justify-between gap-2 transition-colors"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-white border border-[#FEB135]/50 flex items-center justify-center shrink-0">
                        <Heart className="w-4 h-4 text-red-600" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-extrabold text-[#001558] truncate">
                          Ficha Médica por RUT
                        </p>
                        <p className="text-[10px] text-slate-600 truncate">
                          Acceso directo con código OTP
                        </p>
                      </div>
                    </div>
                    <ArrowRight className="w-3.5 h-3.5 text-[#001558]/60 group-hover:text-[#001558] shrink-0 transition-colors" />
                  </Link>
                </div>
              </div>
            </div>

            <p className="text-center lg:text-right text-[11px] text-slate-500">
              Asociación de Guías y Scouts de Chile • Identidad Visual Oficial
              Kit Digital
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
