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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-[#001558] border border-[#0d349e] rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#0d349e] flex items-center justify-between bg-[#000c33]/70">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#000c33] border border-[#FEB135]/40 text-[#FEB135] flex items-center justify-center">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-black text-white">
                Carga Masiva de Participantes
              </h2>
              <p className="text-xs text-slate-300">
                Importación desde archivo Excel (.xlsx) o CSV
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-[#000c33] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5 text-xs bg-[#001558]">
          {/* Instructions & Template Download */}
          <div className="bg-[#000c33]/70 rounded-xl p-4 border border-[#0d349e] flex items-center justify-between">
            <div>
              <p className="font-bold text-white">
                ¿No tienes el formato oficial de columnas?
              </p>
              <p className="text-[11px] text-slate-300 mt-0.5">
                Descarga la plantilla con encabezados estándar para completar los datos.
              </p>
            </div>
            <a
              href="/api/import"
              download="Plantilla_Carga_Participantes_AGSCH.xlsx"
              className="px-3.5 py-2 bg-[#001558] hover:bg-[#002280] text-[#FEB135] font-semibold rounded-xl flex items-center gap-1.5 shrink-0 border border-[#FEB135]/40 transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              Descargar Plantilla
            </a>
          </div>

          {/* Error notice */}
          {error && (
            <div className="p-3 rounded-xl bg-red-950/80 border border-red-700 text-red-200 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Results feedback */}
          {result && (
            <div className="p-4 rounded-xl bg-[#000c33]/80 border border-[#0d349e] space-y-3">
              <div className="flex items-center gap-2 text-[#FEB135] font-bold text-sm">
                <CheckCircle2 className="w-4 h-4" />
                <span>Importación procesada con éxito</span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="bg-[#001558] p-2.5 rounded-lg border border-[#0d349e]">
                  <span className="text-slate-400 text-[10px] block">Filas Leídas</span>
                  <span className="text-white font-bold text-sm">{result.totalRows}</span>
                </div>
                <div className="bg-emerald-950/60 p-2.5 rounded-lg border border-emerald-700/50">
                  <span className="text-emerald-300 text-[10px] block">Nuevos Creados</span>
                  <span className="text-emerald-200 font-bold text-sm">
                    {result.importedCount}
                  </span>
                </div>
                <div className="bg-[#002280]/60 p-2.5 rounded-lg border border-[#0d349e]">
                  <span className="text-[#FEB135] text-[10px] block">Actualizados</span>
                  <span className="text-white font-bold text-sm">
                    {result.updatedCount}
                  </span>
                </div>
              </div>

              {result.errorsCount > 0 && (
                <div className="pt-2 border-t border-[#0d349e]">
                  <p className="text-[#FEB135] font-semibold mb-1 text-[11px]">
                    {result.errorsCount} fila(s) con observaciones:
                  </p>
                  <div className="max-h-28 overflow-y-auto space-y-1 text-[10px] text-slate-300">
                    {result.errors.map((e: any, idx: number) => (
                      <div key={idx} className="bg-[#001558] p-1.5 rounded border border-[#0d349e]">
                        Fila {e.row} {e.rut ? `(${e.rut})` : ''}: {e.reason}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Dropzone */}
          <div className="border-2 border-dashed border-[#0d349e] hover:border-[#FEB135] rounded-2xl p-6 text-center bg-[#000c33]/40 transition-colors">
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
              <div className="w-12 h-12 rounded-2xl bg-[#001558] border border-[#FEB135]/40 text-[#FEB135] flex items-center justify-center mb-2">
                <Upload className="w-6 h-6" />
              </div>
              <p className="font-bold text-white">
                {file ? file.name : 'Haz clic para seleccionar o arrastra tu archivo aquí'}
              </p>
              <p className="text-[11px] text-slate-400 mt-1">
                Formatos soportados: Excel (.xlsx, .xls) o CSV
              </p>
            </label>
          </div>

          {file && (
            <div className="flex items-center justify-between p-3 rounded-xl bg-[#000c33]/80 border border-[#0d349e]">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-[#FEB135]" />
                <span className="text-white font-medium">{file.name}</span>
                <span className="text-slate-400">
                  ({Math.round(file.size / 1024)} KB)
                </span>
              </div>
              <button
                type="button"
                onClick={() => setFile(null)}
                className="text-slate-400 hover:text-red-400 text-xs font-semibold cursor-pointer"
              >
                Remover
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-[#0d349e] flex justify-end gap-2.5 bg-[#000c33]/80">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-[#000c33] hover:bg-[#031c6a] text-slate-200 border border-[#0d349e] rounded-xl text-xs font-semibold transition-colors cursor-pointer"
          >
            {result ? 'Listo' : 'Cancelar'}
          </button>
          {!result && (
            <button
              type="button"
              onClick={handleUpload}
              disabled={!file || uploading}
              className="px-5 py-2 bg-[#FEB135] hover:bg-[#e59c22] text-[#001558] font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-lg shadow-[#FEB135]/20 disabled:opacity-50 cursor-pointer transition-all"
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
