'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { LogOut, User, Heart, Mail } from 'lucide-react';
import { EventSelector, EventItem } from './EventSelector';

interface NavbarProps {
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
  } | null;
  onEventChange?: (event: EventItem) => void;
  onOpenInbox?: () => void;
}

export function Navbar({ user, onEventChange, onOpenInbox }: NavbarProps) {
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
        <div className="flex items-center justify-between h-16 sm:h-20 gap-2 sm:gap-4">
          {/* Brand Logo & AGSCH Identity */}
          <div className="flex items-center gap-3">
            <div className="relative w-36 sm:w-48 h-10 sm:h-12">
              <Image
                src="/agsch-logo-white.svg"
                alt="Guías y Scouts de Chile"
                fill
                priority
                className="object-contain object-left"
              />
            </div>
          </div>

          {/* Center: Multi-Event Selector */}
          <div className="flex items-center">
            <EventSelector currentUser={user} onEventChange={onEventChange} />
          </div>

          {/* Right section: Inbox CRM, Medical Portal & User Account */}
          <div className="flex items-center gap-2 sm:gap-3">
            {user && onOpenInbox && (
              <button
                onClick={onOpenInbox}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#000c33] border border-[#FEB135]/40 hover:border-[#FEB135] text-[#FEB135] hover:text-white text-xs font-bold transition-colors shadow-sm"
                title="Bandeja de Entrada de Correos e Incidencias CRM"
              >
                <Mail className="w-3.5 h-3.5 text-[#FEB135]" />
                <span className="hidden sm:inline">Inbox & Casos</span>
              </button>
            )}

            <a
              href="/ficha-medica"
              target="_blank"
              rel="noopener noreferrer"
              className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#000c33] border border-red-500/50 hover:border-red-400 text-red-200 text-xs font-bold transition-colors shadow-sm"
              title="Abrir portal de Ficha Médica Oficial"
            >
              <Heart className="w-3.5 h-3.5 text-red-400" />
              <span>Ficha Médica</span>
            </a>

            {user && (
              <div className="flex items-center gap-2 sm:gap-3 pl-2 sm:pl-3 border-l border-[#0d349e]">
                <div className="flex items-center gap-2 text-right">
                  <div className="w-8 h-8 rounded-xl bg-[#000c33] border border-[#0d349e] flex items-center justify-center text-[#FEB135]">
                    <User className="w-4 h-4" />
                  </div>
                  <div className="hidden lg:block text-left">
                    <p className="text-xs font-bold text-white leading-tight">{user.name}</p>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] text-slate-300 font-mono">{user.email}</span>
                      {user.role === 'SUPER_ADMIN' && (
                        <span className="text-[9px] font-black px-1 rounded bg-purple-500/30 text-purple-300">
                          SUPER ADMIN
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <button
                  onClick={handleLogout}
                  title="Cerrar sesión"
                  className="p-2 rounded-xl text-slate-300 hover:text-white hover:bg-red-950/60 border border-transparent hover:border-red-700/50 transition-colors cursor-pointer"
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
