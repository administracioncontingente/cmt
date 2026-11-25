'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { ShieldCheck, Lock, Mail, ArrowRight, Loader2 } from 'lucide-react';

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
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : 'Error al iniciar sesión'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleQuickFill = () => {
    setEmail('admin@agsch.cl');
    setPassword('admin123');
  };

  return (
    <div className="min-h-screen bg-[#F5F6F8] flex flex-col justify-center items-center px-4 py-12 relative overflow-hidden">
      {/* Subtle institutional top bar accent */}
      <div className="fixed top-0 inset-x-0 h-1.5 bg-[#001558]">
        <div className="h-full w-1/3 bg-[#FEB135]" />
      </div>

      <div className="w-full max-w-md relative z-10">
        {/* Header Branding with Official Color Logo */}
        <div className="text-center mb-7">
          <div className="flex justify-center mb-4">
            <div className="relative w-72 h-20">
              <Image
                src="/agsch-logo-color.svg"
                alt="Asociación de Guías y Scouts de Chile"
                fill
                priority
                className="object-contain"
              />
            </div>
          </div>

          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-[#FFFBF0] border border-[#FEB135] text-[#001558] text-xs font-bold mb-2.5 shadow-xs">
            <span className="w-2 h-2 rounded-full bg-[#FEB135]" />
            26° World Scout Jamboree • Polonia 2027
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-[#001558] tracking-tight">
            Portal del Contingente Nacional
          </h1>
          <p className="text-slate-600 text-xs mt-1 font-medium">
            Sistema Oficial de Gestión y Control de Cuotas AGSCH
          </p>
        </div>

        {/* Card */}
        <div className="bg-white border border-slate-200 border-t-4 border-t-[#001558] rounded-2xl shadow-xl p-8 relative">
          <div className="flex items-center gap-2 mb-6 pb-4 border-b border-slate-200 text-[#001558] text-xs font-bold uppercase tracking-wider">
            <ShieldCheck className="w-4 h-4 text-[#FEB135]" />
            Acceso Exclusivo Equipo Organizador
          </div>

          {error && (
            <div className="mb-6 p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-start gap-2">
              <span className="font-bold">Error:</span> {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
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
                  className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-300 rounded-xl text-slate-800 placeholder-slate-400 focus:border-[#001558] focus:ring-2 focus:ring-[#FEB135]/50 focus:outline-none text-xs transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
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
                  className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-300 rounded-xl text-slate-800 placeholder-slate-400 focus:border-[#001558] focus:ring-2 focus:ring-[#FEB135]/50 focus:outline-none text-xs transition-all"
                />
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
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Quick Fill Box */}
          <div className="mt-6 pt-4 border-t border-slate-200">
            <div className="bg-[#FFFBF0] border border-[#FEB135]/40 border-l-4 border-l-[#FEB135] rounded-xl p-3 text-xs flex items-center justify-between text-[#001558]">
              <div>
                <span className="text-slate-600 font-medium">
                  Credencial inicial:{' '}
                </span>
                <span className="text-[#001558] font-mono font-bold">
                  admin@agsch.cl
                </span>
              </div>
              <button
                type="button"
                onClick={handleQuickFill}
                className="text-[#001558] hover:underline font-extrabold text-xs cursor-pointer"
              >
                Autocompletar
              </button>
            </div>
          </div>
        </div>

        <p className="text-center text-xs text-slate-500 mt-6">
          Asociación de Guías y Scouts de Chile • Identidad Visual Oficial Kit Digital
        </p>
      </div>
    </div>
  );
}
