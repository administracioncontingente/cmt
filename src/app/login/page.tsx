'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { ShieldCheck, Lock, Mail, ArrowRight, Loader2, Sparkles } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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

      router.push('/');
      router.refresh();
    } catch (err: any) {
      setError(err.message || 'Error al iniciar sesión');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickFill = () => {
    setEmail('admin@agsch.cl');
    setPassword('admin123');
  };

  return (
    <div className="min-h-screen bg-[#000c33] flex flex-col justify-center items-center px-4 py-12 relative overflow-hidden">
      {/* Background Brand Glows */}
      <div className="absolute top-1/4 -left-20 w-96 h-96 bg-[#001558] rounded-full blur-3xl pointer-events-none opacity-80" />
      <div className="absolute bottom-1/4 -right-20 w-96 h-96 bg-[#FEB135]/15 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md relative z-10">
        {/* Header Branding with Official Logo */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-5">
            <div className="relative w-72 h-20">
              <Image
                src="/agsch-logo-white.svg"
                alt="Asociación de Guías y Scouts de Chile"
                fill
                priority
                className="object-contain"
              />
            </div>
          </div>

          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#001558] border border-[#FEB135]/40 text-[#FEB135] text-xs font-bold mb-2 shadow-sm">
            <span className="w-2 h-2 rounded-full bg-[#FEB135] animate-ping" />
            26° World Scout Jamboree • Polonia 2027
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
            Portal del Contingente Nacional
          </h1>
          <p className="text-slate-300 text-xs mt-1">
            Sistema Oficial de Gestión y Control de Cuotas AGSCH
          </p>
        </div>

        {/* Card */}
        <div className="bg-[#001558]/90 border border-[#0d349e] rounded-2xl shadow-2xl backdrop-blur-xl p-8 relative">
          <div className="flex items-center gap-2 mb-6 pb-4 border-b border-[#0d349e] text-slate-200 text-xs font-semibold uppercase tracking-wider">
            <ShieldCheck className="w-4 h-4 text-[#FEB135]" />
            Acceso Exclusivo Equipo Organizador
          </div>

          {error && (
            <div className="mb-6 p-3.5 rounded-xl bg-red-950/80 border border-red-500/50 text-red-200 text-xs flex items-start gap-2">
              <span className="font-bold">Error:</span> {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                Correo Electrónico
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@agsch.cl"
                  className="w-full pl-10 pr-4 py-2.5 bg-[#000c33]/90 border border-[#0d349e] rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#FEB135] focus:border-transparent text-xs transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                Contraseña
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-4 py-2.5 bg-[#000c33]/90 border border-[#0d349e] rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#FEB135] focus:border-transparent text-xs transition-all"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-[#FEB135] hover:bg-[#e59c22] active:bg-[#cc8610] text-[#001558] font-black text-xs uppercase tracking-wider transition-all shadow-lg shadow-[#FEB135]/20 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer mt-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Verificando...
                </>
              ) : (
                <>
                  Ingresar al Sistema
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Quick Fill Box */}
          <div className="mt-6 pt-4 border-t border-[#0d349e]">
            <div className="bg-[#000c33]/70 rounded-xl p-3 border border-[#0d349e] text-xs flex items-center justify-between">
              <div>
                <span className="text-slate-400">Credencial inicial: </span>
                <span className="text-[#FEB135] font-mono font-medium">admin@agsch.cl</span>
              </div>
              <button
                type="button"
                onClick={handleQuickFill}
                className="text-[#FEB135] hover:underline font-bold text-xs"
              >
                Autocompletar
              </button>
            </div>
          </div>
        </div>

        <p className="text-center text-xs text-slate-400 mt-6">
          Asociación de Guías y Scouts de Chile • Identidad Visual Oficial Kit Digital
        </p>
      </div>
    </div>
  );
}
