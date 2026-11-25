'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Navbar } from '@/components/Navbar';
import { StatsOverview } from '@/components/StatsOverview';
import { ParticipantTable } from '@/components/ParticipantTable';
import { ParticipantDetailModal } from '@/components/ParticipantDetailModal';
import { ParticipantFormModal } from '@/components/ParticipantFormModal';
import { ImportModal } from '@/components/ImportModal';
import { InboxAndIncidentsModal } from '@/components/InboxAndIncidentsModal';
import { Loader2 } from 'lucide-react';
import type {
  DashboardStatsDTO,
  EventPermissions,
  EventSummary,
  ParticipantDTO,
  UserSessionDTO,
} from '@/types/domain';

export default function DashboardPage() {
  const router = useRouter();

  const [user, setUser] = useState<UserSessionDTO | null>(null);
  const [authChecking, setAuthChecking] = useState(true);

  // Dashboard Data
  const [stats, setStats] = useState<DashboardStatsDTO['summary'] | null>(null);
  const [activeEvent, setActiveEvent] = useState<EventSummary | null>(null);
  const [permissions, setPermissions] = useState<EventPermissions | null>(null);
  const [participants, setParticipants] = useState<ParticipantDTO[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [healthFilter, setHealthFilter] = useState('ALL');

  // Modals state
  const [selectedParticipantId, setSelectedParticipantId] = useState<
    string | null
  >(null);
  const [editingParticipant, setEditingParticipant] =
    useState<ParticipantDTO | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showInboxModal, setShowInboxModal] = useState(false);

  // Verify auth session
  useEffect(() => {
    let cancelled = false;

    async function checkAuth() {
      try {
        const res = await fetch('/api/auth/me');
        if (!res.ok) {
          router.push('/login');
          return;
        }
        const data = await res.json();
        if (!cancelled) {
          setUser(data.user ?? null);
        }
      } catch {
        router.push('/login');
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

  // Fetch stats (for manual refreshes / event switch)
  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch('/api/stats');
      if (res.ok) {
        const data: DashboardStatsDTO = await res.json();
        setStats(data.summary);
        if (data.event) setActiveEvent(data.event);
        setPermissions(data.permissions ?? null);
      }
    } catch (err) {
      console.error('Error fetching stats:', err);
    }
  }, []);

  // Fetch participants with current filters (for manual refreshes / event switch)
  const fetchParticipants = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (searchTerm) params.append('search', searchTerm);
      if (roleFilter !== 'ALL') params.append('role', roleFilter);
      if (statusFilter !== 'ALL') params.append('status', statusFilter);
      if (healthFilter !== 'ALL') params.append('health', healthFilter);

      const res = await fetch(`/api/participants?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setParticipants(data.participants || []);
      }
    } catch (err) {
      console.error('Error fetching participants:', err);
    } finally {
      setLoading(false);
    }
  }, [searchTerm, roleFilter, statusFilter, healthFilter]);

  // Load stats on mount once authenticated
  useEffect(() => {
    if (authChecking || !user) return;
    let cancelled = false;

    async function loadInitialStats() {
      try {
        const res = await fetch('/api/stats');
        if (!cancelled && res.ok) {
          const data: DashboardStatsDTO = await res.json();
          setStats(data.summary);
          if (data.event) setActiveEvent(data.event);
          setPermissions(data.permissions ?? null);
        }
      } catch (err) {
        console.error('Error fetching stats:', err);
      }
    }

    loadInitialStats();
    return () => {
      cancelled = true;
    };
  }, [authChecking, user]);

  // Load participants on mount and when filters change (debounced)
  useEffect(() => {
    if (authChecking || !user) return;
    let cancelled = false;

    const timeoutId = setTimeout(async () => {
      try {
        setLoading(true);
        const params = new URLSearchParams();
        if (searchTerm) params.append('search', searchTerm);
        if (roleFilter !== 'ALL') params.append('role', roleFilter);
        if (statusFilter !== 'ALL') params.append('status', statusFilter);
        if (healthFilter !== 'ALL') params.append('health', healthFilter);

        const res = await fetch(`/api/participants?${params.toString()}`);
        if (!cancelled && res.ok) {
          const data = await res.json();
          setParticipants(data.participants || []);
        }
      } catch (err) {
        console.error('Error fetching participants:', err);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }, 200);

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, [authChecking, user, searchTerm, roleFilter, statusFilter, healthFilter]);

  const handleRefreshAll = useCallback(() => {
    fetchStats();
    fetchParticipants();
  }, [fetchStats, fetchParticipants]);

  if (authChecking) {
    return (
      <div className="min-h-screen bg-[#F5F6F8] flex items-center justify-center text-slate-600">
        <Loader2 className="w-8 h-8 animate-spin text-[#001558]" />
      </div>
    );
  }

  const currency = activeEvent?.currency || 'USD';

  return (
    <div className="min-h-screen bg-[#F5F6F8] text-slate-800 flex flex-col font-sans">
      <Navbar
        user={user}
        onOpenInbox={() => setShowInboxModal(true)}
        onEventChange={(ev) => {
          setActiveEvent(ev);
          handleRefreshAll();
        }}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Metric Cards */}
        <StatsOverview stats={stats} currency={currency} />

        {/* Main Participants Management Table */}
        <ParticipantTable
          participants={participants}
          loading={loading}
          currency={currency}
          permissions={permissions}
          onRefresh={handleRefreshAll}
          onSelectParticipant={(id) => setSelectedParticipantId(id)}
          onEditParticipant={(p) => setEditingParticipant(p)}
          onNewParticipant={() => setShowCreateModal(true)}
          onOpenImport={() => setShowImportModal(true)}
          searchTerm={searchTerm}
          setSearchTerm={setSearchTerm}
          roleFilter={roleFilter}
          setRoleFilter={setRoleFilter}
          statusFilter={statusFilter}
          setStatusFilter={setStatusFilter}
          healthFilter={healthFilter}
          setHealthFilter={setHealthFilter}
        />
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white py-4 text-center text-xs text-slate-500">
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

      {/* Modals */}
      {selectedParticipantId && (
        <ParticipantDetailModal
          participantId={selectedParticipantId}
          currency={currency}
          permissions={permissions}
          onClose={() => setSelectedParticipantId(null)}
          onParticipantUpdated={handleRefreshAll}
        />
      )}

      {showCreateModal && (
        <ParticipantFormModal
          activeEvent={activeEvent}
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => {
            setShowCreateModal(false);
            handleRefreshAll();
          }}
        />
      )}

      {editingParticipant && (
        <ParticipantFormModal
          initialData={editingParticipant}
          activeEvent={activeEvent}
          onClose={() => setEditingParticipant(null)}
          onSuccess={() => {
            setEditingParticipant(null);
            handleRefreshAll();
          }}
        />
      )}

      {showImportModal && (
        <ImportModal
          activeEvent={activeEvent}
          onClose={() => setShowImportModal(false)}
          onSuccess={handleRefreshAll}
        />
      )}

      {showInboxModal && (
        <InboxAndIncidentsModal
          isOpen={showInboxModal}
          onClose={() => setShowInboxModal(false)}
          activeEvent={activeEvent}
          currentUser={user}
          permissions={permissions}
          onSelectParticipant={(pId) => {
            setShowInboxModal(false);
            setSelectedParticipantId(pId);
          }}
        />
      )}
    </div>
  );
}
