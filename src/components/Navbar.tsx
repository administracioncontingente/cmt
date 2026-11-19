'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { LogOut, User, DollarSign, Compass, Heart } from 'lucide-react';

interface NavbarProps {
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
  } | null;
}

export function Navbar({ user }: NavbarProps) {
  const router = useRouter();

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      router.push('/login');
      router.refresh();
    } catch (error) {
      console.error('Error logging out:', error);
    }
  };

  return (
    <header className="sticky top-0 z-30 bg-[#001558] border-b border-[#0d349e] text-white shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 sm:h-20">
          {/* Brand Logo & Event Details */}
          <div className="flex items-center gap-4">
            <div className="relative w-44 sm:w-56 h-12 sm:h-14">
              <Image
                src="/agsch-logo-white.svg"
                alt="Guías y Scouts de Chile"
                fill
                priority
                className="object-contain object-left"
              />
            </div>
            <div className="hidden md:block pl-4 border-l border-[#0d349e]">
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-sm sm:text-base tracking-tight text-white">
                  Polonia 2027
                </span>
                <span className="px-2 py-0.5 text-[10px] font-black rounded-md bg-[#FEB135] text-[#001558] uppercase">
                  Contingente Oficial
                </span>
              </div>
              <p className="text-[11px] text-slate-300">
                26° World Scout Jamboree • Gdańsk
              </p>
            </div>
          </div>

          {/* Right section: Medical Portal, USD Badge & User Account */}
          <div className="flex items-center gap-3">
            <a
              href="/ficha-medica"
              target="_blank"
              rel="noopener noreferrer"
              className="hidden md:flex items-center gap-1.5 px-3 py-1 rounded-lg bg-[#000c33] border border-red-500/50 hover:border-red-400 text-red-200 text-xs font-bold transition-colors"
              title="Abrir portal de Ficha Médica Oficial"
            >
              <Heart className="w-3.5 h-3.5 text-red-400" />
              <span>Ficha Médica WSJ</span>
            </a>

            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-lg bg-[#000c33] border border-[#FEB135]/40 text-[#FEB135] text-xs font-bold">
              <DollarSign className="w-3.5 h-3.5" />
              <span>Base Oficial: USD</span>
            </div>

            {user && (
              <div className="flex items-center gap-3 pl-3 border-l border-[#0d349e]">
                <div className="flex items-center gap-2 text-right">
                  <div className="w-8 h-8 rounded-lg bg-[#000c33] border border-[#0d349e] flex items-center justify-center text-[#FEB135]">
                    <User className="w-4 h-4" />
                  </div>
                  <div className="hidden lg:block text-left">
                    <p className="text-xs font-bold text-white">{user.name}</p>
                    <p className="text-[10px] text-slate-300 font-mono">{user.email}</p>
                  </div>
                </div>

                <button
                  onClick={handleLogout}
                  title="Cerrar sesión"
                  className="p-2 rounded-lg text-slate-300 hover:text-white hover:bg-red-950/60 border border-transparent hover:border-red-700/50 transition-colors cursor-pointer"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
