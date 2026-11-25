import React, { Suspense } from 'react';
import FichaMedicaPage from '../page';

export default function FichaMedicaByIdPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#F5F6F8] flex items-center justify-center text-[#001558] font-bold font-sans text-sm">
          Cargando ficha médica oficial...
        </div>
      }
    >
      <FichaMedicaPage />
    </Suspense>
  );
}
