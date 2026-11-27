'use client';

import React, { useState } from 'react';
import { AppShell, useAppShell } from '@/components/AppShell';
import { CrmWorkspace } from '@/components/InboxAndIncidentsModal';
import { ParticipantDetailModal } from '@/components/ParticipantDetailModal';

function CrmPageContent() {
  const { user, activeEvent, permissions, currency, refreshStats } =
    useAppShell();
  const [selectedParticipantId, setSelectedParticipantId] = useState<
    string | null
  >(null);

  return (
    <div className="space-y-6">
      <CrmWorkspace
        embedded
        activeEvent={activeEvent}
        currentUser={user}
        permissions={permissions}
        onSelectParticipant={(id) => setSelectedParticipantId(id)}
      />

      {selectedParticipantId && (
        <ParticipantDetailModal
          participantId={selectedParticipantId}
          currency={currency}
          permissions={permissions}
          onClose={() => setSelectedParticipantId(null)}
          onParticipantUpdated={() => {
            void refreshStats();
          }}
        />
      )}
    </div>
  );
}

export default function CrmPage() {
  return (
    <AppShell>
      <CrmPageContent />
    </AppShell>
  );
}
