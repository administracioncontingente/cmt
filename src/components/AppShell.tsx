'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { Navbar } from './Navbar';
import type {
  DashboardStatsDTO,
  EventPermissions,
  EventSummary,
  UserSessionDTO,
} from '@/types/domain';

export interface AppShellContextValue {
  user: UserSessionDTO | null;
  activeEvent: EventSummary | null;
  permissions: EventPermissions | null;
  statsData: DashboardStatsDTO | null;
  currency: string;
  loadingStats: boolean;
  eventVersion: number;
  refreshStats: () => Promise<void>;
}

const AppShellContext = createContext<AppShellContextValue | null>(null);

export function useAppShell(): AppShellContextValue {
  const context = useContext(AppShellContext);
  if (!context) {
    throw new Error('useAppShell debe utilizarse dentro de un <AppShell>');
  }
  return context;
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  const [user, setUser] = useState<UserSessionDTO | null>(null);
  const [authChecking, setAuthChecking] = useState(true);
  const [activeEvent, setActiveEvent] = useState<EventSummary | null>(null);
  const [permissions, setPermissions] = useState<EventPermissions | null>(null);
  const [statsData, setStatsData] = useState<DashboardStatsDTO | null>(null);
  const [loadingStats, setLoadingStats] = useState(true);
  const [eventVersion, setEventVersion] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function checkAuth() {
      try {
        const res = await fetch('/api/auth/me');
        if (!res.ok) {
          if (!cancelled) {
            router.push('/login');
          }
          return;
        }
        const data = await res.json();
        if (!cancelled) {
          if (!data.user) {
            router.push('/login');
            return;
          }
          setUser(data.user);
        }
      } catch {
        if (!cancelled) {
          router.push('/login');
        }
      } finally {
        if (!cancelled) {
          setAuthChecking(false);
        }
      }
    }

    checkAuth();
    return () => {
      cancelled = true;
    };
  }, [router]);

  useEffect(() => {
    if (authChecking || !user) return;
    let cancelled = false;

    async function loadInitialStats() {
      try {
        const res = await fetch('/api/stats');
        if (!cancelled && res.ok) {
          const data: DashboardStatsDTO = await res.json();
          setStatsData(data);
          setActiveEvent(data.event ?? null);
          setPermissions(data.permissions ?? null);
        }
      } catch (err) {
        console.error('Error fetching stats:', err);
      } finally {
        if (!cancelled) {
          setLoadingStats(false);
        }
      }
    }

    loadInitialStats();
    return () => {
      cancelled = true;
    };
  }, [authChecking, user]);

  const refreshStats = useCallback(async () => {
    setLoadingStats(true);
    try {
      const res = await fetch('/api/stats');
      if (res.ok) {
        const data: DashboardStatsDTO = await res.json();
        setStatsData(data);
        if (data.event) {
          setActiveEvent(data.event);
        }
        setPermissions(data.permissions ?? null);
      }
    } catch (err) {
      console.error('Error refreshing stats:', err);
    } finally {
      setLoadingStats(false);
    }
  }, []);

  const handleEventChange = useCallback(
    (event: EventSummary) => {
      setActiveEvent(event);
      setEventVersion((v) => v + 1);
      void refreshStats();
    },
    [refreshStats]
  );

  const currency = activeEvent?.currency || statsData?.currency || 'USD';

  const contextValue = useMemo<AppShellContextValue>(
    () => ({
      user,
      activeEvent,
      permissions,
      statsData,
      currency,
      loadingStats,
      eventVersion,
      refreshStats,
    }),
    [
      user,
      activeEvent,
      permissions,
      statsData,
      currency,
      loadingStats,
      eventVersion,
      refreshStats,
    ]
  );

  if (authChecking || !user) {
    return (
      <div className="min-h-screen bg-[#F5F6F8] flex items-center justify-center text-slate-600">
        <Loader2 className="w-8 h-8 animate-spin text-[#001558]" />
      </div>
    );
  }

  return (
    <AppShellContext.Provider value={contextValue}>
      <div className="min-h-screen bg-[#F5F6F8] text-slate-800 flex flex-col font-sans">
        <Navbar user={user} onEventChange={handleEventChange} />

        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
          {children}
        </main>

        <footer className="border-t border-slate-200 bg-white py-4 text-center text-xs text-slate-500 print:hidden">
          <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
            <span>
              Asociación de Guías y Scouts de Chile •{' '}
              {activeEvent?.name ||
                'Contingente Nacional al 26° World Scout Jamboree Polonia 2027'}
            </span>
            <span className="text-[11px] text-slate-500">
              Diseño e Identidad Visual conforme a{' '}
              <a
                href="https://kitdigital.agsch.org"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#001558] hover:underline font-bold"
              >
                Kit Digital AGSCH
              </a>
            </span>
          </div>
        </footer>
      </div>
    </AppShellContext.Provider>
  );
}
