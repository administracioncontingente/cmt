'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Mail,
  Send,
  Sparkles,
  Users,
} from 'lucide-react';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useToast } from '@/components/ui/ToastProvider';
import { formatCurrency } from '@/lib/finance';
import {
  BULK_EMAIL_BATCH_SIZE,
  BULK_TEMPLATE_VARIABLES,
  renderBulkTemplateText,
} from '@/lib/bulkEmail';

interface BulkRecipientDTO {
  id: string;
  fullName: string;
  firstName: string;
  rut: string;
  email: string;
  guardianEmail: string | null;
  contingentRole: string;
  status: string;
  remainingAmount: number;
  paidAmount: number;
  healthLabel: string;
}

interface BulkAudienceResponse {
  senderEmail: string | null;
  resendConfigured: boolean;
  currency: string;
  eventName: string;
  eventCode: string;
  totalMatched: number;
  skippedInvalidCount: number;
  recipients: BulkRecipientDTO[];
}

interface BulkEmailPanelProps {
  eventId?: string;
  userEmail?: string;
  canManageCrm: boolean;
}

const INPUT_CLASS =
  'w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-xs text-slate-800 placeholder-slate-400 focus:border-[#001558] focus:ring-2 focus:ring-[#FEB135]/50 focus:outline-none transition-all';

export function BulkEmailPanel({
  eventId,
  userEmail,
  canManageCrm,
}: BulkEmailPanelProps) {
  const { toast } = useToast();

  // Audience filters
  const [statusFilter, setStatusFilter] = useState('CONFIRMADO');
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [financialFilter, setFinancialFilter] = useState('ALL');
  const [medicalFilter, setMedicalFilter] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');

  const [loadingAudience, setLoadingAudience] = useState(true);
  const [audience, setAudience] = useState<BulkAudienceResponse | null>(null);

  // Composer
  const [subject, setSubject] = useState(
    'Información importante del contingente • {{evento}}'
  );
  const [body, setBody] = useState(
    'Hola {{nombre}},\n\nTe compartimos una actualización oficial sobre {{evento}}.\n\nRecuerda que puedes revisar tus cuotas (saldo pendiente: {{saldo_pendiente}}), completar tu ficha médica y confirmar tus tallas del kit ingresando directamente al Portal del Participante:\n{{link_portal}}\n\nSiempre Listos,\nEquipo Contingente AGSCH'
  );
  const [includeGuardian, setIncludeGuardian] = useState(false);
  const [includePortalCta, setIncludePortalCta] = useState(true);
  const [testEmail, setTestEmail] = useState(userEmail || '');

  // Sending state
  const [sendingTest, setSendingTest] = useState(false);
  const [showSendConfirm, setShowSendConfirm] = useState(false);
  const [sendingBulk, setSendingBulk] = useState(false);
  const [progress, setProgress] = useState<{
    processed: number;
    total: number;
    sent: number;
    failed: number;
    errors: Array<{ email: string; error: string }>;
  } | null>(null);

  const loadAudience = useCallback(async () => {
    if (!eventId) return;
    setLoadingAudience(true);
    try {
      const params = new URLSearchParams({
        eventId,
        status: statusFilter,
        role: roleFilter,
        financial: financialFilter,
        medical: medicalFilter,
      });
      if (searchTerm.trim()) params.set('search', searchTerm.trim());

      const res = await fetch(`/api/inbox/bulk?${params.toString()}`);
      if (res.ok) {
        const data = (await res.json()) as BulkAudienceResponse;
        setAudience(data);
      }
    } catch (err) {
      console.error('Error loading bulk email audience:', err);
    } finally {
      setLoadingAudience(false);
    }
  }, [
    eventId,
    statusFilter,
    roleFilter,
    financialFilter,
    medicalFilter,
    searchTerm,
  ]);

  useEffect(() => {
    if (!eventId) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      if (cancelled) return;
      await loadAudience();
    }, 180);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [eventId, loadAudience]);

  const recipients = useMemo(
    () => audience?.recipients || [],
    [audience]
  );
  const canSend =
    canManageCrm &&
    Boolean(audience?.senderEmail || audience?.resendConfigured) &&
    recipients.length > 0 &&
    subject.trim().length >= 3 &&
    body.trim().length >= 10;

  const previewSample = useMemo(() => {
    const first = recipients[0];
    const origin =
      typeof window !== 'undefined' ? window.location.origin : 'https://cmt-daqj.vercel.app';
    const ctx = {
      firstName: first?.firstName || 'Camila',
      fullName: first?.fullName || 'Camila Sepúlveda',
      rut: first?.rut || '21.345.678-4',
      contingentRole: first?.contingentRole || 'Participante',
      eventName: audience?.eventName || 'Evento AGSCH',
      remainingAmount: first?.remainingAmount ?? 600,
      paidAmount: first?.paidAmount ?? 1200,
      currency: audience?.currency || 'USD',
      portalUrl: `${origin}/portal`,
      eventPageUrl: audience?.eventCode
        ? `${origin}/eventos/${encodeURIComponent(audience.eventCode)}`
        : `${origin}/eventos`,
    };
    return {
      subject: renderBulkTemplateText(subject, ctx),
      body: renderBulkTemplateText(body, ctx),
      targetLabel: first ? `${first.fullName} (${first.email})` : 'Ejemplo',
    };
  }, [recipients, audience, subject, body]);

  const handleInsertVar = (token: string) => {
    setBody((prev) => `${prev}${prev.endsWith(' ') || prev.endsWith('\n') || !prev ? '' : ' '}${token}`);
  };

  const handleSendTest = async () => {
    if (!eventId || !canManageCrm) return;
    setSendingTest(true);
    try {
      const res = await fetch('/api/inbox/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventId,
          mode: 'test',
          subject,
          body,
          includePortalCta,
          testEmail: testEmail.trim() || userEmail,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        message?: string;
        error?: string;
      };
      if (!res.ok) {
        throw new Error(data.error || 'No se pudo enviar el correo de prueba');
      }
      toast.success(data.message || 'Correo de prueba enviado');
    } catch (err: unknown) {
      toast.error(
        err instanceof Error ? err.message : 'Error enviando prueba'
      );
    } finally {
      setSendingTest(false);
    }
  };

  const handleExecuteBulkSend = async () => {
    if (!eventId || !canSend) return;
    setShowSendConfirm(false);
    setSendingBulk(true);

    const ids = recipients.map((r) => r.id);
    const total = ids.length;
    let processed = 0;
    let sent = 0;
    let failed = 0;
    const errors: Array<{ email: string; error: string }> = [];

    setProgress({ processed: 0, total, sent: 0, failed: 0, errors: [] });

    try {
      for (let i = 0; i < ids.length; i += BULK_EMAIL_BATCH_SIZE) {
        const batchIds = ids.slice(i, i + BULK_EMAIL_BATCH_SIZE);
        const res = await fetch('/api/inbox/bulk', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            eventId,
            mode: 'batch',
            participantIds: batchIds,
            subject,
            body,
            includeGuardian,
            includePortalCta,
          }),
        });

        const data = (await res.json().catch(() => ({}))) as {
          sentCount?: number;
          failedCount?: number;
          results?: Array<{ email: string; ok: boolean; error?: string }>;
          error?: string;
        };

        if (!res.ok) {
          failed += batchIds.length;
          errors.push({
            email: `Lote ${Math.floor(i / BULK_EMAIL_BATCH_SIZE) + 1}`,
            error: data.error || `HTTP ${res.status}`,
          });
        } else {
          sent += data.sentCount ?? 0;
          failed += data.failedCount ?? 0;
          for (const r of data.results || []) {
            if (!r.ok && r.error) {
              errors.push({ email: r.email, error: r.error });
            }
          }
        }

        processed += batchIds.length;
        setProgress({ processed, total, sent, failed, errors: [...errors] });
      }

      if (failed === 0) {
        toast.success(`Envío masivo completado: ${sent} correos enviados`);
      } else {
        toast.error(
          `Envío finalizado: ${sent} enviados, ${failed} con error`
        );
      }
    } finally {
      setSendingBulk(false);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-[#F5F6F8] space-y-5">
      {/* Sender status */}
      {!audience?.senderEmail && !audience?.resendConfigured && !loadingAudience && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 text-xs text-red-800 flex items-start gap-2.5 font-semibold">
          <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
          <span>
            No hay una cuenta de Google Workspace conectada en este evento.
            Conéctala desde la barra superior antes de realizar envíos masivos.
          </span>
        </div>
      )}

      {audience?.senderEmail && (
        <div className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3 text-xs shadow-2xs">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700">
              <Mail className="w-4 h-4" />
            </div>
            <div>
              <p className="font-extrabold text-[#001558]">
                Remitente activo: {audience.senderEmail}
              </p>
              <p className="text-[11px] text-slate-500">
                Envío individual por participante en lotes de {BULK_EMAIL_BATCH_SIZE} (límite Google Workspace: hasta 2.000/día).
              </p>
            </div>
          </div>
          <span className="px-3 py-1 rounded-full bg-[#EEF2FF] border border-[#001558]/20 text-[#001558] font-black">
            {recipients.length} destinatarios listos
          </span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left: Segmentation + Recipient List */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 space-y-4 shadow-2xs">
          <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-slate-200">
            <h3 className="text-xs font-black text-[#001558] uppercase tracking-wider flex items-center gap-2">
              <Users className="w-4 h-4 text-[#FEB135]" />
              1. Segmentar Destinatarios
            </h3>
            {loadingAudience && (
              <Loader2 className="w-4 h-4 animate-spin text-[#001558]" />
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">
                Estado de Inscripción
              </label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className={INPUT_CLASS}
              >
                <option value="CONFIRMADO">Inscritos (INSCRITO = SI)</option>
                <option value="ALL_ACTIVE">Todos no retirados</option>
                <option value="RETIRADO">Solo Bajas / Retirados</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">
                Rol (PARTICIPA)
              </label>
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className={INPUT_CLASS}
              >
                <option value="ALL">Todos los roles</option>
                <option value="JOVEN">Jóvenes / Participantes</option>
                <option value="DIRIGENTE">Dirigentes / Responsables</option>
                <option value="IST">IST</option>
                <option value="CMT">CMT</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">
                Estado de Cuotas
              </label>
              <select
                value={financialFilter}
                onChange={(e) => setFinancialFilter(e.target.value)}
                className={INPUT_CLASS}
              >
                <option value="ALL">Todos</option>
                <option value="EN_MORA">Con deuda / En mora</option>
                <option value="AL_DIA">Al día</option>
                <option value="PAGADO_TOTAL">Pagado 100%</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">
                Ficha Médica
              </label>
              <select
                value={medicalFilter}
                onChange={(e) => setMedicalFilter(e.target.value)}
                className={INPUT_CLASS}
              >
                <option value="ALL">Todas</option>
                <option value="PENDING">Ficha pendiente</option>
                <option value="COMPLETED">Ficha completada</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1">
              Filtro adicional (grupo, unidad, nombre o RUT)
            </label>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Ej: Tropa Cóndor, Grupo San Francisco..."
              className={INPUT_CLASS}
            />
          </div>

          <label className="flex items-center gap-2 bg-[#FFFBF0] border border-[#FEB135]/60 rounded-xl px-3 py-2.5 text-xs text-[#001558] cursor-pointer">
            <input
              type="checkbox"
              checked={includeGuardian}
              onChange={(e) => setIncludeGuardian(e.target.checked)}
              className="w-4 h-4 accent-[#001558]"
            />
            <span className="font-bold">
              Incluir correo de apoderado en copia (CC) cuando exista
            </span>
          </label>

          {/* Audience summary box */}
          <div className="bg-[#F5F6F8] border border-slate-200 rounded-xl p-3 text-xs space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-slate-600">Participantes filtrados:</span>
              <strong className="text-[#001558]">
                {audience?.totalMatched ?? 0}
              </strong>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-600">Con correo válido:</span>
              <strong className="text-emerald-700">{recipients.length}</strong>
            </div>
            {(audience?.skippedInvalidCount ?? 0) > 0 && (
              <div className="flex items-center justify-between text-[11px] text-amber-700">
                <span>Omitidos (sin correo real):</span>
                <strong>{audience?.skippedInvalidCount}</strong>
              </div>
            )}
          </div>

          {/* Sample recipient preview list */}
          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-3 py-2 bg-[#F5F6F8] border-b border-slate-200 text-[11px] font-extrabold text-[#001558] uppercase">
              Muestra de destinatarios ({Math.min(recipients.length, 6)} de{' '}
              {recipients.length})
            </div>
            <div className="divide-y divide-slate-100 max-h-48 overflow-y-auto">
              {recipients.length === 0 ? (
                <p className="p-4 text-center text-xs text-slate-500">
                  Ningún participante coincide con los filtros actuales.
                </p>
              ) : (
                recipients.slice(0, 6).map((r) => (
                  <div
                    key={r.id}
                    className="px-3 py-2 text-[11px] flex items-center justify-between gap-2"
                  >
                    <div className="min-w-0">
                      <p className="font-bold text-[#001558] truncate">
                        {r.fullName}
                      </p>
                      <p className="text-slate-500 truncate">{r.email}</p>
                    </div>
                    <span className="font-mono text-[10px] text-slate-600 shrink-0">
                      {formatCurrency(
                        r.remainingAmount,
                        audience?.currency || 'USD'
                      )}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right: Composer & Preview */}
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 space-y-4 shadow-2xs">
          <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-slate-200">
            <h3 className="text-xs font-black text-[#001558] uppercase tracking-wider flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#FEB135]" />
              2. Redactar Comunicado Personalizado
            </h3>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-[#001558] mb-1">
              Asunto del Correo *
            </label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              disabled={sendingBulk}
              placeholder="Ej: Recordatorio de cuota y ficha médica • {{evento}}"
              className={INPUT_CLASS}
            />
          </div>

          <div>
            <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
              <label className="text-[11px] font-bold text-[#001558]">
                Mensaje *
              </label>
              <div className="flex flex-wrap gap-1">
                {BULK_TEMPLATE_VARIABLES.slice(0, 6).map((v) => (
                  <button
                    key={v.key}
                    type="button"
                    onClick={() => handleInsertVar(v.key)}
                    title={v.description}
                    className="px-2 py-0.5 rounded-md bg-[#EEF2FF] hover:bg-[#dce4ff] text-[#001558] font-mono text-[10px] font-bold border border-[#001558]/15 cursor-pointer"
                  >
                    +{v.key}
                  </button>
                ))}
              </div>
            </div>
            <textarea
              rows={7}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              disabled={sendingBulk}
              className={INPUT_CLASS}
            />
          </div>

          <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
            <input
              type="checkbox"
              checked={includePortalCta}
              onChange={(e) => setIncludePortalCta(e.target.checked)}
              className="w-4 h-4 accent-[#001558]"
            />
            <span>
              Incluir botón institucional <strong>Ir al Portal del Participante</strong> al final del correo
            </span>
          </label>

          {/* Live Preview */}
          <div className="bg-[#F5F6F8] border border-slate-200 rounded-xl p-3.5 space-y-1.5 text-xs">
            <div className="flex items-center justify-between text-[10px] font-extrabold text-slate-500 uppercase">
              <span>Vista previa personalizada</span>
              <span className="truncate max-w-[260px]">
                {previewSample.targetLabel}
              </span>
            </div>
            <p className="font-extrabold text-[#001558]">
              Asunto: {previewSample.subject}
            </p>
            <p className="text-slate-700 whitespace-pre-wrap leading-relaxed text-[11px]">
              {previewSample.body}
            </p>
          </div>

          {/* Progress */}
          {progress && (
            <div className="bg-[#EEF2FF] border border-[#001558]/20 rounded-xl p-4 space-y-2 text-xs">
              <div className="flex items-center justify-between font-extrabold text-[#001558]">
                <span className="inline-flex items-center gap-1.5">
                  {sendingBulk ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  )}
                  Progreso: {progress.processed} / {progress.total}
                </span>
                <span>
                  {progress.sent} enviados • {progress.failed} fallidos
                </span>
              </div>
              <div className="w-full bg-white rounded-full h-2 overflow-hidden border border-slate-200">
                <div
                  className="bg-[#001558] h-2 transition-all duration-300"
                  style={{
                    width: `${
                      progress.total > 0
                        ? Math.round((progress.processed / progress.total) * 100)
                        : 0
                    }%`,
                  }}
                />
              </div>
              {progress.errors.length > 0 && (
                <div className="max-h-24 overflow-y-auto text-[11px] text-red-700 space-y-0.5 pt-1">
                  {progress.errors.slice(0, 10).map((er, idx) => (
                    <p key={idx}>
                      • {er.email}: {er.error}
                    </p>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Action Row: Test send + Launch bulk */}
          <div className="pt-3 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-1">
              <input
                type="email"
                value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)}
                placeholder="correo-prueba@ejemplo.cl"
                disabled={sendingTest || sendingBulk}
                className={`${INPUT_CLASS} max-w-[220px]`}
              />
              <button
                type="button"
                disabled={sendingTest || sendingBulk || !canManageCrm}
                onClick={() => void handleSendTest()}
                className="px-3.5 py-2 rounded-xl bg-white hover:bg-slate-100 border border-slate-300 text-[#001558] text-xs font-extrabold whitespace-nowrap cursor-pointer disabled:opacity-50"
              >
                {sendingTest ? 'Enviando...' : 'Enviar Prueba'}
              </button>
            </div>

            <button
              type="button"
              disabled={!canSend || sendingBulk}
              onClick={() => setShowSendConfirm(true)}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-[#FEB135] hover:bg-[#e59c22] text-[#001558] text-xs font-black uppercase tracking-wider shadow-xs disabled:opacity-50 cursor-pointer"
            >
              {sendingBulk ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
              Enviar a {recipients.length} participantes
            </button>
          </div>
        </div>
      </div>

      <ConfirmDialog
        isOpen={showSendConfirm}
        title="Confirmar envío masivo de correos"
        description={`Se enviarán ${recipients.length} correos personalizados individuales desde ${audience?.senderEmail || 'tu proveedor configurado'}. ¿Deseas iniciar el envío ahora?`}
        confirmLabel={`Sí, enviar ${recipients.length} correos`}
        cancelLabel="Cancelar"
        variant="primary"
        loading={sendingBulk}
        onCancel={() => setShowSendConfirm(false)}
        onConfirm={handleExecuteBulkSend}
      />
    </div>
  );
}
