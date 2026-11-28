import React, { Suspense } from 'react';
import { EventPublicPageClient } from '@/components/EventPublicPageClient';

export default function EventPublicDetailPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#F5F6F8] flex items-center justify-center text-[#001558] font-bold font-sans text-sm">
          Cargando página informativa del evento...
        </div>
      }
    >
      <EventPublicPageClient />
    </Suspense>
  );
}
