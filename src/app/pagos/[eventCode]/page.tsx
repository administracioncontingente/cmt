import React, { Suspense } from 'react';
import PagosPortalPage from '../page';

export default function PagosByEventPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#F5F6F8] flex items-center justify-center text-[#001558] font-bold font-sans text-sm">
          Cargando portal de comprobantes de pago...
        </div>
      }
    >
      <PagosPortalPage />
    </Suspense>
  );
}
