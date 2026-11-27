'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info';

export interface ToastOptions {
  type?: ToastType;
  title?: string;
  message: string;
  durationMs?: number;
}

interface ToastItem {
  id: string;
  type: ToastType;
  title?: string;
  message: string;
}

export interface ToastContextValue {
  showToast: (options: ToastOptions) => void;
  toast: {
    success: (message: string, title?: string) => void;
    error: (message: string, title?: string) => void;
    info: (message: string, title?: string) => void;
  };
}

const DEFAULT_DURATION_MS = 4500;
const MAX_VISIBLE_TOASTS = 4;

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(
    new Map()
  );
  const idCounterRef = useRef(0);

  const dismissToast = useCallback((id: string) => {
    const existingTimer = timersRef.current.get(id);
    if (existingTimer) {
      clearTimeout(existingTimer);
      timersRef.current.delete(id);
    }
    setToasts((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const showToast = useCallback(
    ({ type = 'info', title, message, durationMs }: ToastOptions) => {
      idCounterRef.current += 1;
      const id = `toast-${idCounterRef.current}`;
      const effectiveDuration = durationMs ?? DEFAULT_DURATION_MS;

      setToasts((prev) => {
        const next = [...prev, { id, type, title, message }];
        return next.length > MAX_VISIBLE_TOASTS
          ? next.slice(next.length - MAX_VISIBLE_TOASTS)
          : next;
      });

      if (effectiveDuration > 0) {
        const timer = setTimeout(() => {
          timersRef.current.delete(id);
          setToasts((prev) => prev.filter((item) => item.id !== id));
        }, effectiveDuration);
        timersRef.current.set(id, timer);
      }
    },
    []
  );

  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      timers.forEach((timer) => clearTimeout(timer));
      timers.clear();
    };
  }, []);

  const toast = useMemo(
    () => ({
      success: (message: string, title?: string) =>
        showToast({ type: 'success', message, title }),
      error: (message: string, title?: string) =>
        showToast({ type: 'error', message, title }),
      info: (message: string, title?: string) =>
        showToast({ type: 'info', message, title }),
    }),
    [showToast]
  );

  const contextValue = useMemo(
    () => ({ showToast, toast }),
    [showToast, toast]
  );

  return (
    <ToastContext.Provider value={contextValue}>
      {children}

      <div
        aria-live="polite"
        aria-atomic="false"
        className="fixed bottom-4 right-4 z-50 flex flex-col gap-2.5 w-full max-w-sm px-4 sm:px-0 pointer-events-none print:hidden"
      >
        {toasts.map((item) => {
          const isSuccess = item.type === 'success';
          const isError = item.type === 'error';

          return (
            <div
              key={item.id}
              role={isError ? 'alert' : 'status'}
              className={`pointer-events-auto bg-white rounded-2xl shadow-lg border p-3.5 flex items-start gap-3 transition-all ${
                isSuccess
                  ? 'border-emerald-200'
                  : isError
                    ? 'border-red-200'
                    : 'border-[#001558]/20'
              }`}
            >
              <div
                className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                  isSuccess
                    ? 'bg-emerald-50 text-emerald-600'
                    : isError
                      ? 'bg-red-50 text-red-600'
                      : 'bg-[#EEF2FF] text-[#001558]'
                }`}
              >
                {isSuccess ? (
                  <CheckCircle2 className="w-4 h-4" />
                ) : isError ? (
                  <AlertCircle className="w-4 h-4" />
                ) : (
                  <Info className="w-4 h-4" />
                )}
              </div>

              <div className="flex-1 min-w-0 pt-0.5">
                {item.title && (
                  <p className="text-xs font-extrabold text-[#001558] leading-tight mb-0.5">
                    {item.title}
                  </p>
                )}
                <p className="text-xs text-slate-700 leading-relaxed break-words">
                  {item.message}
                </p>
              </div>

              <button
                type="button"
                onClick={() => dismissToast(item.id)}
                aria-label="Cerrar notificación"
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors shrink-0 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast debe utilizarse dentro de un ToastProvider');
  }
  return context;
}
