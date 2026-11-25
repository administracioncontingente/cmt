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

export default function DashboardPage() {
  const router = useRouter();

  const [user, setUser] = useState<any>(null);
  const [authChecking, setAuthChecking] = useState(true);

  // Dashboard Data
  const [stats, setStats] = useState<any>(null);
  const [activeEvent, setActiveEvent] = useState<any>(null);
  const [participants, setParticipants] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [healthFilter, setHealthFilter] = useState('ALL');

  // Modals state
  const [selectedParticipantId, setSelectedParticipantId] = useState<string | null>(null);
  const [editingParticipant, setEditingParticipant] = useState<any | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showInboxModal, setShowInboxModal] = useState(false);

  // Verify auth session
  useEffect(() => {
    async function checkAuth() {
      try {
        const res = await fetch('/api/auth/me');
        if (!res.ok) {
          router.push('/login');
          return;
        }
        const data = await res.json();
        setUser(data.user);
      } catch (err) {
        router.push('/login');
      } finally {
        setAuthChecking(false);
      }
    }
    checkAuth();
  }, [router]);

  // Fetch stats
  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch('/api/stats');
      if (res.ok) {
        const data = await res.json();
        setStats(data.summary);
        if (data.event) setActiveEvent(data.event);
      }
    } catch (err) {
      console.error('Error fetching stats:', err);
    }
  }, []);

  // Fetch participants with current filters
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
        setParticipants(data.participants);
      }
    } catch (err) {
      console.error('Error fetching participants:', err);
    } finally {
      setLoading(false);
    }
  }, [searchTerm, roleFilter, statusFilter, healthFilter]);

  // Load data on initial mount and when filters change (with debounce on search)
  useEffect(() => {
    if (authChecking || !user) return;
    fetchStats();
  }, [authChecking, user, fetchStats]);

  useEffect(() => {
    if (authChecking || !user) return;
    const timeoutId = setTimeout(() => {
      fetchParticipants();
    }, 200);
    return () => clearTimeout(timeoutId);
  }, [authChecking, user, fetchParticipants]);

  const handleRefreshAll = () => {
    fetchStats();
    fetchParticipants();
  };

  if (authChecking) {
    return (
      <div className="min-h-screen bg-[#000c33] flex items-center justify-center text-slate-300">
        <Loader2 className="w-8 h-8 animate-spin text-[#FEB135]" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#000c33] text-slate-100 flex flex-col font-sans">
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
        <StatsOverview stats={stats} />

        {/* Main Participants Management Table */}
        <ParticipantTable
          participants={participants}
          loading={loading}
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
      <footer className="border-t border-[#0d349e] bg-[#001558] py-4 text-center text-xs text-slate-300">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>
            Asociación de Guías y Scouts de Chile • Contingente Nacional al 26° World Scout Jamboree Polonia 2027
          </span>
          <span className="text-[11px] text-slate-400">
            Diseño e Identidad Visual conforme a{' '}
            <a
              href="https://kitdigital.agsch.org"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#FEB135] hover:underline font-bold"
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
          onClose={() => setSelectedParticipantId(null)}
          onParticipantUpdated={handleRefreshAll}
        />
      )}

      {showCreateModal && (
        <ParticipantFormModal
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
          onClose={() => setEditingParticipant(null)}
          onSuccess={() => {
            setEditingParticipant(null);
            handleRefreshAll();
          }}
        />
      )}

      {showImportModal && (
        <ImportModal
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
          onSelectParticipant={(pId) => {
            setShowInboxModal(false);
            setSelectedParticipantId(pId);
          }}
        />
      )}
    </div>
  );
}
