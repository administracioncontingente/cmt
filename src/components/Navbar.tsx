'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import Image from 'next/image';
import {
  FileText,
  Heart,
  HeartPulse,
  LogOut,
  Mail,
  Shirt,
  User,
  Users,
  Wallet,
} from 'lucide-react';
import { EventSelector } from './EventSelector';
import type { EventSummary, UserSessionDTO } from '@/types/domain';

interface NavbarProps {
  user: UserSessionDTO | null;
  onEventChange?: (event: EventSummary) => void;
  onOpenInbox?: () => void;
}

const NAV_ITEMS = [
  { href: '/', label: 'Nómina', icon: Users },
  { href: '/finanzas', label: 'Tesorería', icon: Wallet },
  { href: '/salud', label: 'Salud', icon: HeartPulse },
  { href: '/kit', label: 'Kit & Tallas', icon: Shirt },
  { href: '/documentos', label: 'Evento & Docs', icon: FileText },
  { href: '/crm', label: 'Inbox & Casos', icon: Mail },
] as const;

export function Navbar({ user, onEventChange }: NavbarProps) {
  const router = useRouter();
  const pathname = usePathname();

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      router.push('/login');
      router.refresh();
    } catch (error) {
      console.error('Error logging out:', error);
    }
  };

  const isRouteActive = (href: string) => {
    if (href === '/') {
      return pathname === '/';
    }
    return pathname === href || pathname?.startsWith(`${href}/`);
  };

  return (
    <header className="sticky top-0 z-30 bg-white border-b border-slate-200 border-t-4 border-t-[#001558] shadow-xs print:hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 sm:h-20 gap-2 sm:gap-3">
          {/* Brand Logo & Primary Multi-Route Navigation */}
          <div className="flex items-center gap-3 lg:gap-5 min-w-0">
            <Link
              href="/"
              className="relative w-28 sm:w-36 lg:w-44 h-9 sm:h-11 shrink-0 block"
              aria-label="Ir al inicio - Contingente AGSCH"
            >
              <Image
                src="/agsch-logo-color.svg"
                alt="Guías y Scouts de Chile"
                fill
                priority
                className="object-contain object-left"
              />
            </Link>

            {user && (
              <nav
                aria-label="Navegación principal"
                className="hidden md:flex items-center gap-1 lg:gap-1.5"
              >
                {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
                  const active = isRouteActive(href);
                  return (
                    <Link
                      key={href}
                      href={href}
                      className={`relative flex items-center gap-1.5 px-2.5 lg:px-3 py-1.5 rounded-xl border text-xs font-bold whitespace-nowrap transition-colors shrink-0 ${
                        active
                          ? 'bg-[#EEF2FF] text-[#001558] border-[#001558]/25 shadow-xs'
                          : 'bg-transparent text-slate-600 border-transparent hover:text-[#001558] hover:bg-[#F5F6F8]'
                      }`}
                    >
                      <Icon
                        className={`w-3.5 h-3.5 shrink-0 ${
                          active ? 'text-[#FEB135]' : 'text-slate-400'
                        }`}
                      />
                      <span>{label}</span>
                      {active && (
                        <span
                          aria-hidden="true"
                          className="absolute inset-x-2.5 -bottom-[1px] h-0.5 rounded-full bg-[#FEB135]"
                        />
                      )}
                    </Link>
                  );
                })}
              </nav>
            )}
          </div>

          {/* Right Section: Event Selector, Medical Portal & User Account */}
          <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
            <EventSelector currentUser={user} onEventChange={onEventChange} />

            <a
              href="/ficha-medica"
              target="_blank"
              rel="noopener noreferrer"
              className="hidden md:flex items-center gap-1.5 px-2.5 xl:px-3 py-1.5 rounded-xl bg-red-50 hover:bg-red-100 border border-red-200 text-red-700 text-xs font-bold transition-colors shadow-xs shrink-0 whitespace-nowrap"
              title="Abrir portal de Ficha Médica Oficial"
            >
              <Heart className="w-3.5 h-3.5 text-red-600 shrink-0" />
              <span className="hidden xl:inline">Ficha Médica</span>
            </a>

            {user && (
              <div className="flex items-center gap-2 sm:gap-2.5 pl-2 sm:pl-2.5 border-l border-slate-200 shrink-0">
                <div className="flex items-center gap-2 text-right">
                  <div className="w-8 h-8 rounded-xl bg-[#EEF2FF] border border-[#001558]/20 flex items-center justify-center text-[#001558] shrink-0">
                    <User className="w-4 h-4" />
                  </div>
                  <div className="hidden xl:block text-left">
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
                  aria-label="Cerrar sesión"
                  className="p-2 rounded-xl text-slate-500 hover:text-red-700 hover:bg-red-50 border border-transparent hover:border-red-200 transition-colors cursor-pointer shrink-0"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile Secondary Navigation Bar */}
      {user && (
        <nav
          aria-label="Navegación móvil"
          className="md:hidden border-t border-slate-100 bg-[#F5F6F8]/80 px-4 py-2 overflow-x-auto"
        >
          <div className="flex items-center gap-1.5 min-w-max">
            {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
              const active = isRouteActive(href);
              return (
                <Link
                  key={href}
                  href={href}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold whitespace-nowrap transition-colors ${
                    active
                      ? 'bg-[#EEF2FF] text-[#001558] border-[#FEB135] shadow-xs'
                      : 'bg-white text-slate-600 border-slate-200 hover:text-[#001558]'
                  }`}
                >
                  <Icon
                    className={`w-3.5 h-3.5 shrink-0 ${
                      active ? 'text-[#FEB135]' : 'text-slate-400'
                    }`}
                  />
                  <span>{label}</span>
                </Link>
              );
            })}
          </div>
        </nav>
      )}
    </header>
  );
}
