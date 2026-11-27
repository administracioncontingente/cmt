'use client';

import React, { Suspense, useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Loader2,
  ShieldCheck,
} from 'lucide-react';

function PortalAccesoContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token')?.trim() || '';

  const verifiedStartedRef = useRef(false);
  const [status, setStatus] = useState<'verifying' | 'success' | 'error'>(
    'verifying'
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function verifyMagicLink() {
      await Promise.resolve();
      if (cancelled || verifiedStartedRef.current) return;
      verifiedStartedRef.current = true;

      if (!token) {
        setStatus('error');
        setErrorMessage(
          'El enlace de acceso no contiene un código de verificación válido.'
        );
        return;
      }

      try {
        const res = await fetch('/api/portal/auth/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        });

        const data = (await res.json().catch(() => ({}))) as {
          success?: boolean;
          error?: string;
        };

        if (cancelled) return;

        if (res.ok && data.success) {
          setStatus('success');
          router.replace('/portal');
          return;
        }

        setStatus('error');
        setErrorMessage(
          data.error ||
            'El enlace es inválido, ya fue utilizado o expiró. Solicita un nuevo enlace.'
        );
      } catch {
        if (!cancelled) {
          setStatus('error');
          setErrorMessage(
            'Error de conexión al validar tu enlace de acceso. Inténtalo nuevamente.'
          );
        }
      }
    }

    void verifyMagicLink();

    return () => {
      cancelled = true;
    };
  }, [router, token]);

  return (
    <div className="min-h-screen bg-[#F5F6F8] flex flex-col justify-center items-center px-4 py-10 relative">
      <div className="fixed top-0 inset-x-0 h-1.5 bg-[#001558] z-20">
        <div className="h-full w-1/3 bg-[#FEB135]" />
      </div>

      <div className="w-full max-w-md bg-white border border-slate-200 border-t-4 border-t-[#001558] rounded-3xl shadow-xl p-7 sm:p-8 text-center space-y-6">
        <div className="relative w-44 h-12 mx-auto">
          <Image
            src="/agsch-logo-color.svg"
            alt="Asociación de Guías y Scouts de Chile"
            fill
            priority
            className="object-contain"
          />
        </div>

        {status === 'verifying' && (
          <div className="space-y-3 py-4">
            <div className="w-14 h-14 rounded-2xl bg-[#EEF2FF] border border-[#001558]/15 text-[#001558] flex items-center justify-center mx-auto">
              <Loader2 className="w-7 h-7 animate-spin" />
            </div>
            <h1 className="text-xl font-black text-[#001558]">
              Verificando tu acceso seguro...
            </h1>
            <p className="text-xs text-slate-600 leading-relaxed">
              Estamos validando tu enlace de un solo uso para ingresar al Portal
              del Participante AGSCH.
            </p>
          </div>
        )}

        {status === 'success' && (
          <div className="space-y-3 py-4">
            <div className="w-14 h-14 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-7 h-7" />
            </div>
            <h1 className="text-xl font-black text-[#001558]">
              ¡Acceso verificado!
            </h1>
            <p className="text-xs text-slate-600">
              Redirigiendo a tu Portal del Participante...
            </p>
            <Link
              href="/portal"
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-[#001558] hover:bg-[#0b2370] text-white font-bold text-xs transition-colors"
            >
              Ir al Portal ahora
              <ArrowRight className="w-3.5 h-3.5 text-[#FEB135]" />
            </Link>
          </div>
        )}

        {status === 'error' && (
          <div className="space-y-4 py-2">
            <div className="w-14 h-14 rounded-2xl bg-red-50 border border-red-200 text-red-600 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-7 h-7" />
            </div>
            <div className="space-y-1.5">
              <h1 className="text-xl font-black text-[#001558]">
                No pudimos validar el enlace
              </h1>
              <p
                role="alert"
                className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-2xl px-4 py-3 font-semibold"
              >
                {errorMessage ||
                  'El enlace es inválido, ya fue utilizado o expiró.'}
              </p>
            </div>

            <div className="pt-2 space-y-2.5">
              <Link
                href="/portal"
                className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-[#001558] hover:bg-[#0b2370] text-white font-black text-xs uppercase tracking-wider shadow-md transition-colors"
              >
                Solicitar nuevo enlace de acceso
                <ArrowRight className="w-4 h-4 text-[#FEB135]" />
              </Link>
              <p className="text-[11px] text-slate-500 flex items-center justify-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-[#001558]" />
                Por seguridad, cada enlace expira en 15 minutos y sirve una sola
                vez.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function PortalAccesoPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#F5F6F8] flex flex-col items-center justify-center p-4 text-center">
          <Loader2 className="w-10 h-10 text-[#001558] animate-spin mb-3" />
          <p className="text-sm font-bold text-[#001558]">
            Preparando verificación de acceso...
          </p>
        </div>
      }
    >
      <PortalAccesoContent />
    </Suspense>
  );
}
