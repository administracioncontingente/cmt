'use client';

import React, { useState } from 'react';
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

interface ImportModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

export function ImportModal({ onClose, onSuccess }: ImportModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setError(null);
      setResult(null);
    }
  };

  const handleUpload = async () => {
    if (!file) {
      setError('Por favor selecciona un archivo Excel (.xlsx) o CSV');
      return;
    }

    try {
      setUploading(true);
      setError(null);

      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/import', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Error al procesar el archivo');
      }

      setResult(data);
      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Error durante la carga masiva');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-950 border border-emerald-700/50 text-emerald-400 flex items-center justify-center">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">
                Carga Masiva de Participantes
              </h2>
              <p className="text-xs text-slate-400">
                Importación desde archivo Excel (.xlsx) o CSV
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5 text-xs">
          {/* Instructions & Template Download */}
          <div className="bg-slate-950/80 rounded-xl p-4 border border-slate-800 flex items-center justify-between">
            <div>
              <p className="font-semibold text-slate-200">
                ¿No tienes el formato oficial de columnas?
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Descarga la plantilla con encabezados estándar para completar los datos.
              </p>
            </div>
            <a
              href="/api/import"
              download="Plantilla_Carga_Participantes_AGSCH.xlsx"
              className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-indigo-300 rounded-xl font-medium flex items-center gap-1.5 shrink-0 border border-slate-700 transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              Descargar Plantilla
            </a>
          </div>

          {/* Error notice */}
          {error && (
            <div className="p-3 rounded-xl bg-red-950/70 border border-red-800 text-red-300 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Results feedback */}
          {result && (
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
              <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
                <CheckCircle2 className="w-4 h-4" />
                <span>Importación procesada con éxito</span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800">
                  <span className="text-slate-400 text-[10px] block">Filas Leídas</span>
                  <span className="text-white font-bold text-sm">{result.totalRows}</span>
                </div>
                <div className="bg-emerald-950/40 p-2.5 rounded-lg border border-emerald-800/40">
                  <span className="text-emerald-400 text-[10px] block">Nuevos Creados</span>
                  <span className="text-emerald-300 font-bold text-sm">
                    {result.importedCount}
                  </span>
                </div>
                <div className="bg-blue-950/40 p-2.5 rounded-lg border border-blue-800/40">
                  <span className="text-blue-400 text-[10px] block">Actualizados</span>
                  <span className="text-blue-300 font-bold text-sm">
                    {result.updatedCount}
                  </span>
                </div>
              </div>

              {result.errorsCount > 0 && (
                <div className="pt-2 border-t border-slate-800">
                  <p className="text-amber-400 font-semibold mb-1 text-[11px]">
                    {result.errorsCount} fila(s) con observaciones:
                  </p>
                  <div className="max-h-28 overflow-y-auto space-y-1 text-[10px] text-slate-400">
                    {result.errors.map((e: any, idx: number) => (
                      <div key={idx} className="bg-slate-900 p-1.5 rounded">
                        Fila {e.row} {e.rut ? `(${e.rut})` : ''}: {e.reason}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Dropzone */}
          <div className="border-2 border-dashed border-slate-700 hover:border-indigo-500 rounded-2xl p-6 text-center bg-slate-950/40 transition-colors">
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
              <div className="w-12 h-12 rounded-2xl bg-indigo-950/60 border border-indigo-700/40 text-indigo-400 flex items-center justify-center mb-2">
                <Upload className="w-6 h-6" />
              </div>
              <p className="font-semibold text-slate-200">
                {file ? file.name : 'Haz clic para seleccionar o arrastra tu archivo aquí'}
              </p>
              <p className="text-[11px] text-slate-500 mt-1">
                Formatos soportados: Excel (.xlsx, .xls) o CSV
              </p>
            </label>
          </div>

          {file && (
            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-800">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-emerald-400" />
                <span className="text-slate-200 font-medium">{file.name}</span>
                <span className="text-slate-500">
                  ({Math.round(file.size / 1024)} KB)
                </span>
              </div>
              <button
                type="button"
                onClick={() => setFile(null)}
                className="text-slate-500 hover:text-red-400 text-xs"
              >
                Remover
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-800 flex justify-end gap-2.5 bg-slate-950/80">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-medium transition-colors cursor-pointer"
          >
            {result ? 'Listo' : 'Cancelar'}
          </button>
          {!result && (
            <button
              type="button"
              onClick={handleUpload}
              disabled={!file || uploading}
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-medium flex items-center gap-1.5 shadow-md shadow-emerald-600/30 disabled:opacity-50 cursor-pointer transition-all"
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
