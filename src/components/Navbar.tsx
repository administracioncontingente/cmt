'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { LogOut, User, Heart, Mail } from 'lucide-react';
import { EventSelector } from './EventSelector';
import type { EventSummary, UserSessionDTO } from '@/types/domain';

interface NavbarProps {
  user: UserSessionDTO | null;
  onEventChange?: (event: EventSummary) => void;
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
    <header className="sticky top-0 z-30 bg-white border-b border-slate-200 border-t-4 border-t-[#001558] shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 sm:h-20 gap-2 sm:gap-4">
          {/* Brand Logo & AGSCH Identity */}
          <div className="flex items-center gap-3">
            <div className="relative w-36 sm:w-48 h-10 sm:h-12">
              <Image
                src="/agsch-logo-color.svg"
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
                type="button"
                onClick={onOpenInbox}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#FFFBF0] hover:bg-[#FFF8E1] border border-[#FEB135]/60 text-[#001558] text-xs font-bold transition-colors shadow-xs cursor-pointer"
                title="Bandeja de Entrada de Correos e Incidencias CRM"
              >
                <Mail className="w-3.5 h-3.5 text-[#FEB135]" />
                <span className="hidden sm:inline">Inbox &amp; Casos</span>
              </button>
            )}

            <a
              href="/ficha-medica"
              target="_blank"
              rel="noopener noreferrer"
              className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-50 hover:bg-red-100 border border-red-200 text-red-700 text-xs font-bold transition-colors shadow-xs"
              title="Abrir portal de Ficha Médica Oficial"
            >
              <Heart className="w-3.5 h-3.5 text-red-600" />
              <span>Ficha Médica</span>
            </a>

            {user && (
              <div className="flex items-center gap-2 sm:gap-3 pl-2 sm:pl-3 border-l border-slate-200">
                <div className="flex items-center gap-2 text-right">
                  <div className="w-8 h-8 rounded-xl bg-[#EEF2FF] border border-[#001558]/20 flex items-center justify-center text-[#001558]">
                    <User className="w-4 h-4" />
                  </div>
                  <div className="hidden lg:block text-left">
                    <p className="text-xs font-bold text-[#001558] leading-tight">
                      {user.name}
                    </p>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] text-slate-500 font-mono">
                        {user.email}
                      </span>
                      {user.role === 'SUPER_ADMIN' && (
                        <span className="text-[9px] font-black px-1.5 py-0.2 rounded bg-purple-50 text-purple-800 border border-purple-200">
                          SUPER ADMIN
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleLogout}
                  title="Cerrar sesión"
                  className="p-2 rounded-xl text-slate-500 hover:text-red-700 hover:bg-red-50 border border-transparent hover:border-red-200 transition-colors cursor-pointer"
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
