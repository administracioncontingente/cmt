'use client';

import React, { useEffect, useId, useRef, useState } from 'react';
import {
  X,
  Upload,
  FileSpreadsheet,
  Download,
  AlertCircle,
  CheckCircle2,
  Loader2,
  FileText,
} from 'lucide-react';
import { useToast } from '@/components/ui/ToastProvider';
import type { EventSummary, ImportResultDTO } from '@/types/domain';

interface ImportModalProps {
  activeEvent?: EventSummary | null;
  onClose: () => void;
  onSuccess: () => void;
}

const ALLOWED_EXTENSIONS = ['.xlsx', '.xls', '.csv'];

function isValidSpreadsheetFile(file: File): boolean {
  const lowerName = file.name.toLowerCase();
  return ALLOWED_EXTENSIONS.some((ext) => lowerName.endsWith(ext));
}

export function ImportModal({
  activeEvent,
  onClose,
  onSuccess,
}: ImportModalProps) {
  const { toast } = useToast();
  const titleId = useId();
  const dragCounterRef = useRef(0);

  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<ImportResultDTO | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !uploading) {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [uploading, onClose]);

  const acceptSelectedFile = (candidate: File) => {
    if (!isValidSpreadsheetFile(candidate)) {
      const msg =
        'Formato de archivo no válido. Solo se permiten planillas Excel (.xlsx, .xls) o CSV (.csv).';
      setError(msg);
      toast.error(msg, 'Archivo incompatible');
      return;
    }

    setFile(candidate);
    setError(null);
    setResult(null);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      acceptSelectedFile(e.target.files[0]);
    }
  };

  const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current += 1;
    setIsDragging(true);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isDragging) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current = Math.max(0, dragCounterRef.current - 1);
    if (dragCounterRef.current === 0) {
      setIsDragging(false);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current = 0;
    setIsDragging(false);

    if (uploading) return;
    const droppedFile = e.dataTransfer.files?.[0];
    if (droppedFile) {
      acceptSelectedFile(droppedFile);
    }
  };

  const handleUpload = async () => {
    if (!file) {
      setError('Por favor selecciona un archivo Excel (.xlsx, .xls) o CSV');
      return;
    }

    try {
      setUploading(true);
      setError(null);

      const formData = new FormData();
      formData.append('file', file);
      if (activeEvent?.id) {
        formData.append('eventId', activeEvent.id);
      }

      const res = await fetch('/api/import', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Error al procesar el archivo');
      }

      const parsedResult = data as ImportResultDTO;
      setResult(parsedResult);
      toast.success(
        `Se procesaron ${parsedResult.totalRows} filas (${parsedResult.importedCount} nuevos, ${parsedResult.updatedCount} actualizados).`,
        'Carga masiva completada'
      );
      onSuccess();
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : 'Error durante la carga masiva';
      setError(msg);
      toast.error(msg, 'Error en importación');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#001558]/40 backdrop-blur-xs p-4 overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget && !uploading) {
          onClose();
        }
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="bg-white border border-slate-200 rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200"
      >
        {/* Header */}
        <div className="px-6 py-4 bg-[#001558] text-white border-b-4 border-b-[#FEB135] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-white/10 border border-[#FEB135]/50 text-[#FEB135] flex items-center justify-center">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h2 id={titleId} className="text-base font-extrabold text-white">
                Carga Masiva de Participantes
              </h2>
              <p className="text-xs text-slate-200">
                {activeEvent?.shortName || activeEvent?.name
                  ? `${activeEvent.shortName || activeEvent.name} • `
                  : ''}
                Importación desde archivo Excel (.xlsx) o CSV
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={uploading}
            aria-label="Cerrar modal"
            className="p-2 rounded-xl text-white/75 hover:text-white hover:bg-white/10 transition-colors cursor-pointer disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5 text-xs bg-white">
          {/* Instructions & Template Download */}
          <div className="bg-[#FFFBF0] border border-[#FEB135]/40 border-l-4 border-l-[#FEB135] text-[#001558] rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <p className="font-bold text-[#001558]">
                ¿No tienes el formato oficial de columnas?
              </p>
              <p className="text-[11px] text-slate-600 mt-0.5">
                Descarga la plantilla con encabezados estándar para completar los datos.
              </p>
            </div>
            <a
              href="/api/import"
              download="Plantilla_Carga_Participantes_AGSCH.xlsx"
              className="px-3.5 py-2 bg-[#001558] hover:bg-[#0b2370] text-white font-bold rounded-xl flex items-center gap-1.5 shrink-0 transition-colors shadow-xs"
            >
              <Download className="w-3.5 h-3.5" />
              Descargar Plantilla
            </a>
          </div>

          {/* Error notice */}
          {error && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-600" />
              <span>{error}</span>
            </div>
          )}

          {/* Results feedback */}
          {result && (
            <div className="p-4 rounded-xl bg-[#F5F6F8] border border-slate-200 space-y-3">
              <div className="flex items-center gap-2 text-emerald-800 font-bold text-sm">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Importación procesada con éxito</span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                  <span className="text-slate-500 text-[10px] block font-semibold">
                    Filas Leídas
                  </span>
                  <span className="text-[#001558] font-extrabold text-sm">
                    {result.totalRows}
                  </span>
                </div>
                <div className="bg-emerald-50 p-2.5 rounded-lg border border-emerald-200">
                  <span className="text-emerald-700 text-[10px] block font-semibold">
                    Nuevos Creados
                  </span>
                  <span className="text-emerald-800 font-extrabold text-sm">
                    {result.importedCount}
                  </span>
                </div>
                <div className="bg-[#EEF2FF] p-2.5 rounded-lg border border-[#001558]/20">
                  <span className="text-[#001558] text-[10px] block font-semibold">
                    Actualizados
                  </span>
                  <span className="text-[#001558] font-extrabold text-sm">
                    {result.updatedCount}
                  </span>
                </div>
              </div>

              {result.errorsCount > 0 && (
                <div className="pt-2 border-t border-slate-200">
                  <p className="text-red-700 font-bold mb-1.5 text-[11px]">
                    {result.errorsCount} fila(s) con observaciones:
                  </p>
                  <div className="max-h-28 overflow-y-auto space-y-1 text-[11px] text-slate-700">
                    {result.errors.map((errItem, idx) => (
                      <div
                        key={idx}
                        className="bg-white p-1.5 rounded border border-red-200"
                      >
                        Fila {errItem.row}{' '}
                        {errItem.rut ? `(${errItem.rut})` : ''}: {errItem.reason}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Dropzone */}
          <div
            onDragEnter={handleDragEnter}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-2xl p-6 text-center transition-all ${
              isDragging
                ? 'border-[#001558] bg-[#FFF8E1] ring-2 ring-[#FEB135]'
                : 'border-slate-300 hover:border-[#001558] bg-[#F5F6F8] hover:bg-[#FFFBF0]/60'
            }`}
          >
            <input
              type="file"
              id="file-upload"
              accept=".xlsx,.xls,.csv"
              onChange={handleFileChange}
              className="hidden"
            />
            <label
              htmlFor="file-upload"
              className="cursor-pointer flex flex-col items-center justify-center"
            >
              <div
                className={`w-12 h-12 rounded-2xl bg-white border flex items-center justify-center mb-2 shadow-xs transition-transform ${
                  isDragging
                    ? 'border-[#001558] text-[#001558] scale-105'
                    : 'border-[#FEB135] text-[#001558]'
                }`}
              >
                <Upload className="w-6 h-6" />
              </div>
              <p className="font-bold text-[#001558]">
                {isDragging
                  ? 'Suelta tu planilla aquí para cargarla'
                  : file
                    ? file.name
                    : 'Haz clic para seleccionar o arrastra tu archivo aquí'}
              </p>
              <p className="text-[11px] text-slate-500 mt-1">
                Formatos soportados: Excel (.xlsx, .xls) o CSV
              </p>
            </label>
          </div>

          {file && (
            <div className="flex items-center justify-between p-3 rounded-xl bg-white border border-slate-200">
              <div className="flex items-center gap-2 min-w-0">
                <FileText className="w-4 h-4 text-[#001558] shrink-0" />
                <span className="text-slate-800 font-semibold truncate">
                  {file.name}
                </span>
                <span className="text-slate-500 shrink-0">
                  ({Math.round(file.size / 1024)} KB)
                </span>
              </div>
              <button
                type="button"
                onClick={() => setFile(null)}
                disabled={uploading}
                className="text-slate-500 hover:text-red-700 text-xs font-semibold cursor-pointer shrink-0 ml-2 disabled:opacity-50"
              >
                Remover
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-slate-200 flex justify-end gap-2.5 bg-[#F5F6F8]">
          <button
            type="button"
            onClick={onClose}
            disabled={uploading}
            className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-xl text-xs font-bold transition-colors cursor-pointer disabled:opacity-50"
          >
            {result ? 'Listo' : 'Cancelar'}
          </button>
          {!result && (
            <button
              type="button"
              onClick={handleUpload}
              disabled={!file || uploading}
              className="px-5 py-2 bg-[#FEB135] hover:bg-[#e59c22] text-[#001558] font-extrabold rounded-xl text-xs flex items-center gap-1.5 shadow-xs disabled:opacity-50 cursor-pointer transition-all"
            >
              {uploading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Procesando planilla...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4" />
                  Iniciar Carga Masiva
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
