'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { AppShell, useAppShell } from '@/components/AppShell';
import { StatsOverview, type StatsQuickFilter } from '@/components/StatsOverview';
import { ParticipantTable } from '@/components/ParticipantTable';
import { ParticipantDetailModal } from '@/components/ParticipantDetailModal';
import { ParticipantFormModal } from '@/components/ParticipantFormModal';
import { ImportModal } from '@/components/ImportModal';
import type { ParticipantDTO, ParticipantsListResponseDTO } from '@/types/domain';

function DashboardContent() {
  const {
    activeEvent,
    permissions,
    statsData,
    currency,
    loadingStats,
    eventVersion,
    refreshStats,
  } = useAppShell();

  // Table Data & Pagination
  const [participants, setParticipants] = useState<ParticipantDTO[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [limit, setLimit] = useState(50);
  const [pagination, setPagination] = useState({ page: 1, eventVersion: 0 });
  const [refreshNonce, setRefreshNonce] = useState(0);

  // Filters & Sorting
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [healthFilter, setHealthFilter] = useState('ALL');
  const [medicalFilter, setMedicalFilter] = useState('ALL');
  const [sortBy, setSortBy] = useState('name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  // Modals state
  const [selectedParticipantId, setSelectedParticipantId] = useState<string | null>(null);
  const [editingParticipant, setEditingParticipant] = useState<ParticipantDTO | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);

  const currentPage =
    pagination.eventVersion === eventVersion ? pagination.page : 1;

  const setPage = useCallback(
    (nextPage: number) => {
      setPagination({ page: Math.max(1, nextPage), eventVersion });
    },
    [eventVersion]
  );

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm.trim());
    }, 200);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Load participants whenever query parameters or active event change
  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    const timer = setTimeout(async () => {
      try {
        setLoading(true);
        const params = new URLSearchParams();
        params.set('page', String(currentPage));
        params.set('limit', String(limit));
        params.set('sortBy', sortBy);
        params.set('sortDir', sortDir);
        if (debouncedSearch) params.set('search', debouncedSearch);
        if (roleFilter !== 'ALL') params.set('role', roleFilter);
        if (statusFilter !== 'ALL') params.set('status', statusFilter);
        if (healthFilter !== 'ALL') params.set('health', healthFilter);
        if (medicalFilter !== 'ALL') params.set('medical', medicalFilter);

        const res = await fetch(`/api/participants?${params.toString()}`, {
          signal: controller.signal,
        });
        if (!cancelled && res.ok) {
          const data = (await res.json()) as ParticipantsListResponseDTO;
          setParticipants(data.participants || []);
          setTotalCount(data.totalCount ?? 0);
          setTotalPages(Math.max(1, data.totalPages ?? 1));
        }
      } catch (err: unknown) {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        console.error('Error fetching participants:', err);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }, 0);

    return () => {
      cancelled = true;
      clearTimeout(timer);
      controller.abort();
    };
  }, [
    currentPage,
    limit,
    sortBy,
    sortDir,
    debouncedSearch,
    roleFilter,
    statusFilter,
    healthFilter,
    medicalFilter,
    eventVersion,
    refreshNonce,
  ]);

  const handleRefreshAll = useCallback(() => {
    void refreshStats();
    setRefreshNonce((n) => n + 1);
  }, [refreshStats]);

  const handleSearchChange = useCallback(
    (value: string) => {
      setSearchTerm(value);
      setPage(1);
    },
    [setPage]
  );

  const handleRoleChange = useCallback(
    (value: string) => {
      setRoleFilter(value);
      setPage(1);
    },
    [setPage]
  );

  const handleStatusChange = useCallback(
    (value: string) => {
      setStatusFilter(value);
      setPage(1);
    },
    [setPage]
  );

  const handleHealthChange = useCallback(
    (value: string) => {
      setHealthFilter(value);
      setPage(1);
    },
    [setPage]
  );

  const handleMedicalChange = useCallback(
    (value: string) => {
      setMedicalFilter(value);
      setPage(1);
    },
    [setPage]
  );

  const handleSortByChange = useCallback(
    (value: string) => {
      setSortBy(value);
      setPage(1);
    },
    [setPage]
  );

  const handleSortDirChange = useCallback(
    (value: 'asc' | 'desc') => {
      setSortDir(value);
      setPage(1);
    },
    [setPage]
  );

  const handleLimitChange = useCallback(
    (nextLimit: number) => {
      setLimit(nextLimit);
      setPage(1);
    },
    [setPage]
  );

  const handleQuickFilter = useCallback(
    (filter: StatsQuickFilter) => {
      if (filter.role !== undefined) setRoleFilter(filter.role);
      if (filter.status !== undefined) setStatusFilter(filter.status);
      if (filter.health !== undefined) setHealthFilter(filter.health);
      setPage(1);
    },
    [setPage]
  );

  const handleResetFilters = useCallback(() => {
    setSearchTerm('');
    setDebouncedSearch('');
    setRoleFilter('ALL');
    setStatusFilter('ALL');
    setHealthFilter('ALL');
    setMedicalFilter('ALL');
    setPage(1);
  }, [setPage]);

  return (
    <>
      {/* Metric Cards & Executive Summary */}
      <StatsOverview
        stats={statsData?.summary ?? null}
        statsData={statsData}
        loading={loadingStats}
        currency={currency}
        activeRoleFilter={roleFilter}
        activeHealthFilter={healthFilter}
        activeStatusFilter={statusFilter}
        onQuickFilter={handleQuickFilter}
      />

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
        setSearchTerm={handleSearchChange}
        roleFilter={roleFilter}
        setRoleFilter={handleRoleChange}
        statusFilter={statusFilter}
        setStatusFilter={handleStatusChange}
        healthFilter={healthFilter}
        setHealthFilter={handleHealthChange}
        medicalFilter={medicalFilter}
        setMedicalFilter={handleMedicalChange}
        sortBy={sortBy}
        setSortBy={handleSortByChange}
        sortDir={sortDir}
        setSortDir={handleSortDirChange}
        totalCount={totalCount}
        page={currentPage}
        totalPages={totalPages}
        limit={limit}
        onPageChange={setPage}
        onLimitChange={handleLimitChange}
        onResetFilters={handleResetFilters}
      />

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
    </>
  );
}

export default function DashboardPage() {
  return (
    <AppShell>
      <DashboardContent />
    </AppShell>
  );
}
