'use client';

import React, { useEffect, useId } from 'react';
import { AlertTriangle, Info, Loader2, X } from 'lucide-react';

export interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'primary';
  loading?: boolean;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
}

export function ConfirmDialog({
  isOpen,
  title,
  description,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  variant = 'primary',
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !loading) {
        onCancel();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, loading, onCancel]);

  if (!isOpen) {
    return null;
  }

  const isDanger = variant === 'danger';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs print:hidden"
      onClick={(e) => {
        if (e.target === e.currentTarget && !loading) {
          onCancel();
        }
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        className="w-full max-w-md bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden"
      >
        <div className="p-6">
          <div className="flex items-start gap-4">
            <div
              className={`w-11 h-11 rounded-xl border flex items-center justify-center shrink-0 ${
                isDanger
                  ? 'bg-red-50 border-red-200 text-red-600'
                  : 'bg-[#EEF2FF] border-[#001558]/20 text-[#001558]'
              }`}
            >
              {isDanger ? (
                <AlertTriangle className="w-5 h-5" />
              ) : (
                <Info className="w-5 h-5" />
              )}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <h2
                  id={titleId}
                  className="text-base font-extrabold text-[#001558] leading-snug"
                >
                  {title}
                </h2>
                <button
                  type="button"
                  onClick={onCancel}
                  disabled={loading}
                  aria-label="Cerrar diálogo"
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors disabled:opacity-50 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <p
                id={descriptionId}
                className="mt-2 text-sm text-slate-600 leading-relaxed"
              >
                {description}
              </p>
            </div>
          </div>
        </div>

        <div className="px-6 py-4 bg-[#F5F6F8] border-t border-slate-200 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="px-4 py-2 rounded-xl bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs font-bold transition-colors disabled:opacity-50 cursor-pointer"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={() => void onConfirm()}
            disabled={loading}
            className={`px-4 py-2 rounded-xl text-white text-xs font-bold transition-colors flex items-center gap-2 shadow-xs disabled:opacity-60 cursor-pointer ${
              isDanger
                ? 'bg-red-600 hover:bg-red-700'
                : 'bg-[#001558] hover:bg-[#0b2370]'
            }`}
          >
            {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            <span>{confirmLabel}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
