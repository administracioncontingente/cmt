import React, { Suspense } from 'react';
import FichaMedicaPage from '../page';

export default function FichaMedicaByIdPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#000c33] flex items-center justify-center text-white font-sans">
          Cargando ficha médica...
        </div>
      }
    >
      <FichaMedicaPage />
    </Suspense>
  );
}
