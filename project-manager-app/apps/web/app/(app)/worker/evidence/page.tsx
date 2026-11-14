"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Upload, Camera, FileText, Image as ImageIcon, RefreshCw, CheckCircle2, AlertTriangle, Eye } from "lucide-react";
import { HtmlInCanvasPanel, StatusBadge } from "@semse/ui";
import { fetchMyJobs, fetchJobMilestones, fetchJobEvidence, registerJobEvidence, planUpload, sendNotification } from "../../../semse-api";
import { NotificationBanner } from "../../../components/notifications/NotificationBanner";
import { PanelState } from "../../../workspace/components/PanelState";
import { useWorkspaceQuery, isWorkspaceAccessError } from "../../../workspace/lib/use-workspace-query";
import {
  evidenceStatus as readEvidenceStatus, evidenceStatusLabel, evidenceUploadProxyUrl,
  resolveAccessibleJobId, uploadRealEvidenceFile, uploadEvidenceBatch,
  type EvidenceRow, type EvidenceKind, type EvidenceUploadResult,
} from "../../../workspace/lib/evidence-model";

type FieldCapturePhase = "UNSPECIFIED" | "BEFORE_CONCEALMENT" | "DURING_INSTALL" | "AFTER_CONCEALMENT";
const KIND_OPTIONS = [{ value: "PHOTO", label: "Foto" }, { value: "VIDEO", label: "Video" }, { value: "DOCUMENT", label: "Documento" }] as const;
const FIELD_CAPTURE_PHASES: Array<{ value: FieldCapturePhase; label: string }> = [
  { value: "UNSPECIFIED", label: "Sin etapa de captura" },
  { value: "BEFORE_CONCEALMENT", label: "Antes de cerrar pared / sheetrock" },
  { value: "DURING_INSTALL", label: "Durante la instalación" },
  { value: "AFTER_CONCEALMENT", label: "Después de cerrar pared" },
];
function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}
function mimeToKind(mime: string): EvidenceKind {
  return mime.startsWith("image/") ? "PHOTO" : mime.startsWith("video/") ? "VIDEO" : "DOCUMENT";
}
function describeFieldCapture(row: EvidenceRow): string | null {
  const metadata = row.metadata;
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null;
  const capture = (metadata as Record<string, unknown>).fieldCapture;
  if (!capture || typeof capture !== "object" || Array.isArray(capture)) return null;
  const record = capture as Record<string, unknown>;
  const zone = asString(record.zoneLabel);
  if (!zone) return null;
  return [asString(record.floorLabel), zone, FIELD_CAPTURE_PHASES.find((option) => option.value === record.phase)?.label].filter(Boolean).join(" · ") + " · Ubicación declarada, no verificada";
}
function statusVariant(status: string): "success" | "warning" | "error" | "info" {
  if (["approved", "passed", "accepted"].includes(status)) return "success";
  if (["rejected", "failed"].includes(status)) return "error";
  if (["pending", "under_review", "manual_review"].includes(status)) return "warning";
  return "info";
}
const control = "min-h-11 w-full min-w-0 rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 text-sm text-[var(--ink)]";
const secondary = "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-[var(--border)] px-3 text-sm text-[var(--brand)] disabled:opacity-50";

export default function WorkerEvidencePage() {
  return <Suspense fallback={<PanelState title="Cargando evidencia" loading />}><WorkerEvidenceHub /></Suspense>;
}

function WorkerEvidenceHub() {
  const searchParams = useSearchParams();
  const requestedJobId = searchParams.get("jobId") ?? "";
  const [selectedJobId, setSelectedJobId] = useState("");
  const [selectedMilestoneId, setSelectedMilestoneId] = useState("");
  const [kind, setKind] = useState<EvidenceKind>("PHOTO");
  const [captureZoneLabel, setCaptureZoneLabel] = useState("");
  const [captureFloorLabel, setCaptureFloorLabel] = useState("");
  const [capturePhase, setCapturePhase] = useState<FieldCapturePhase>("UNSPECIFIED");
  const [files, setFiles] = useState<File[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadResults, setUploadResults] = useState<EvidenceUploadResult[]>([]);
  const [uploadNote, setUploadNote] = useState<{ msg: string; ok: boolean } | null>(null);
  const uploadLock = useRef(false);
  const mounted = useRef(true);
  const selectionRequest = useRef<string | null>(null);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);

  const jobsLoader = useCallback(() => fetchMyJobs(), []);
  const jobsQuery = useWorkspaceQuery("worker-evidence-jobs", jobsLoader);
  const jobs = jobsQuery.data ?? [];
  useEffect(() => {
    if (!jobsQuery.data || uploadLock.current) return;
    const requestChanged = selectionRequest.current !== requestedJobId;
    selectionRequest.current = requestedJobId;
    const nextJobId = !requestChanged && jobsQuery.data.some((job) => job.id === selectedJobId)
      ? selectedJobId : resolveAccessibleJobId(jobsQuery.data, requestedJobId);
    if (nextJobId === selectedJobId) return;
    setSelectedJobId(nextJobId);
    setSelectedMilestoneId(""); setFiles([]); setUploadResults([]);
    setCaptureZoneLabel(""); setCaptureFloorLabel(""); setCapturePhase("UNSPECIFIED");
  }, [jobsQuery.data, requestedJobId, selectedJobId, uploading]);
  const activeJobId = jobs.some((job) => job.id === selectedJobId) ? selectedJobId : "";
  const milestonesLoader = useCallback(() => fetchJobMilestones(encodeURIComponent(activeJobId)), [activeJobId]);
  const evidenceLoader = useCallback(() => fetchJobEvidence(encodeURIComponent(activeJobId)), [activeJobId]);
  const milestonesQuery = useWorkspaceQuery(activeJobId ? `worker-evidence-milestones:${activeJobId}` : null, milestonesLoader);
  const evidenceQuery = useWorkspaceQuery(activeJobId ? `worker-evidence:${activeJobId}` : null, evidenceLoader);
  const milestones = milestonesQuery.data ?? [];
  const evidenceFeed = evidenceQuery.data ?? [];
  const validMilestoneId = milestones.some((row) => asString(row.id) === selectedMilestoneId) ? selectedMilestoneId : "";

  function handleFiles(incoming: File[]) {
    if (uploadLock.current || !incoming.length) return;
    setFiles(incoming); setUploadNote(null); setUploadResults([]);
    if (incoming.length === 1) setKind(mimeToKind(incoming[0].type));
  }
  async function handleUpload() {
    if (!activeJobId || !files.length || uploadLock.current) return;
    const zoneLabel = captureZoneLabel.trim();
    const floorLabel = captureFloorLabel.trim();
    const hasFieldCapture = Boolean(zoneLabel || floorLabel || capturePhase !== "UNSPECIFIED");
    if (hasFieldCapture && (!zoneLabel || capturePhase === "UNSPECIFIED")) {
      setUploadNote({ msg: "Para documentar la zona debes indicar una zona y la etapa de obra.", ok: false });
      return;
    }
    const jobId = activeJobId;
    const selectedFiles = files.slice();
    uploadLock.current = true; setUploading(true); setUploadNote(null); setUploadResults([]);
    try {
      const results = await uploadEvidenceBatch(selectedFiles, async (file) => {
        if (!mounted.current) throw new Error("Carga cancelada al salir de la página.");
        const fileKind = selectedFiles.length === 1 ? kind : mimeToKind(file.type);
        return uploadRealEvidenceFile(file, {
          jobId, kind: fileKind,
          ...(validMilestoneId ? { milestoneId: validMilestoneId } : {}),
          ...(fileKind === "PHOTO" && hasFieldCapture ? {
            metadata: {
              fieldCapture: {
                schemaVersion: 1, zoneLabel, ...(floorLabel ? { floorLabel } : {}),
                phase: capturePhase, trust: "CLAIMED_BY_WORKER",
              },
            },
          } : {}),
        }, {
          plan: planUpload,
          put: async (key, realFile, contentType) => {
            const uploadRes = await fetch(evidenceUploadProxyUrl(key), {
              method: "PUT", headers: { "content-type": contentType }, body: realFile,
            });
            if (!uploadRes.ok) {
              const text = await uploadRes.text().catch(() => "");
              throw new Error(`No se pudo subir "${realFile.name}" (${uploadRes.status}).${text ? ` ${text}` : ""}`);
            }
          },
          // The orchestrator passes the encoded Job.id only after the real PUT succeeded.
          register: async (selectedJobId, payload) => await registerJobEvidence(selectedJobId, payload),
        });
      });
      if (!mounted.current) return;
      setUploadResults(results);
      const successful = results.filter((result) => result.ok).length;
      setFiles(results.filter((result) => !result.ok).map((result) => result.file));
      setUploadNote({ msg: `${successful} de ${results.length} archivos registrados.${successful < results.length ? " Se conservan los archivos fallidos para reintentar; los exitosos no se volverán a enviar." : ""}`, ok: successful === results.length });
      if (successful) {
        evidenceQuery.retry();
        try {
          await sendNotification({ title: "Evidencia registrada", body: `${successful} archivo(s) registrado(s) en "${jobs.find((job) => job.id === jobId)?.title ?? "trabajo"}".`, kind: "approval", targetRole: "client", linkHref: `/client/jobs/${encodeURIComponent(jobId)}` });
        } catch (error) {
          if (mounted.current) setUploadNote({ msg: `${successful} archivos registrados. No se pudo enviar la notificación: ${error instanceof Error ? error.message : "error de notificación"}. Revisa los resultados por archivo antes de reintentar.`, ok: false });
        }
      }
    } finally {
      uploadLock.current = false;
      if (mounted.current) setUploading(false);
    }
  }

  return <div className="mx-auto grid w-full min-w-0 max-w-3xl gap-5 text-[var(--ink)]">
    <HtmlInCanvasPanel as="section" canvasClassName="rounded-2xl" minHeight={82}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><Link href="/worker/dashboard" className={secondary}>Volver al panel</Link><h1 className="mt-3 text-2xl font-bold">Evidencias</h1><p className="mt-1 text-sm text-[var(--muted)]">Sube archivos reales para documentar tus trabajos.</p></div>
        <div className="flex flex-wrap items-center gap-2"><NotificationBanner audience="worker" /><button type="button" aria-label="Actualizar trabajos, hitos y evidencia" className={secondary} disabled={uploading} onClick={() => { jobsQuery.retry(); milestonesQuery.retry(); evidenceQuery.retry(); }}><RefreshCw size={16} /></button></div>
      </div>
    </HtmlInCanvasPanel>
    {jobsQuery.loading && <PanelState title="Cargando trabajos" loading />}
    {jobsQuery.error && <PanelState title={isWorkspaceAccessError(jobsQuery.error) ? "Sin acceso a los trabajos" : "No se pudieron cargar los trabajos"} description={jobsQuery.error} error onRetry={jobsQuery.retry} />}
    {requestedJobId && jobsQuery.data && !jobs.some((job) => job.id === requestedJobId) && <PanelState title="El trabajo solicitado no está disponible" description="El jobId del enlace no figura en tu lista accesible. Selecciona otro trabajo; el enlace no concede permisos." error />}
    {jobsQuery.data?.length === 0 && <PanelState title="Sin trabajos disponibles" description="No se devolvieron trabajos asignados para esta sesión." />}
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 text-sm text-[var(--muted)]"><strong className="text-[var(--ink)]">Qué necesita el agente de evidencia</strong><ul className="mt-2 list-disc pl-5"><li>Fotos del antes y después</li><li>Video corto del resultado</li><li>Documento o comprobante si corresponde</li></ul><p className="mt-2">La carga no implica validación, aprobación del hito ni liberación de fondos.</p></div>
    <HtmlInCanvasPanel as="section" canvasClassName="rounded-2xl" minHeight={320}>
      <fieldset disabled={uploading} className="grid min-w-0 gap-4 border-0 p-0">
        <legend className="mb-3 text-base font-semibold">Subir evidencia real</legend>
        <div className="grid min-w-0 gap-3 sm:grid-cols-2">
          <label className="grid min-w-0 gap-2 text-sm text-[var(--muted)]">Trabajo
            <select className={control} value={activeJobId} disabled={jobsQuery.loading || !jobs.length} onChange={e => { setSelectedJobId(e.target.value); setSelectedMilestoneId(""); setFiles([]); setCaptureZoneLabel(""); setCaptureFloorLabel(""); setCapturePhase("UNSPECIFIED"); setUploadResults([]); setUploadNote(null); }}>
              <option value="">Selecciona un trabajo</option>{jobs.map((job) => <option key={job.id} value={job.id}>{job.title}</option>)}
            </select>
          </label>
          <label className="grid min-w-0 gap-2 text-sm text-[var(--muted)]">Hito (opcional)
            <select className={control} value={validMilestoneId} disabled={milestonesQuery.loading || Boolean(milestonesQuery.error) || !activeJobId} onChange={e => setSelectedMilestoneId(e.target.value)}>
              <option value="">Sin hito específico</option>{milestones.map((row) => asString(row.id) && <option key={asString(row.id)} value={asString(row.id)}>{asString(row.title) ?? asString(row.id)}</option>)}
            </select>
          </label>
        </div>
        {milestonesQuery.loading && <PanelState title="Cargando hitos" loading />}
        {milestonesQuery.error && <PanelState title={isWorkspaceAccessError(milestonesQuery.error) ? "Sin acceso a los hitos" : "Consulta parcial: no se pudieron cargar los hitos"} description={`${milestonesQuery.error} Puedes cargar evidencia a nivel de trabajo, pero no seleccionar un hito no consultado.`} error onRetry={milestonesQuery.retry} />}
        <div className="flex flex-wrap gap-2" aria-label="Tipo de evidencia">{KIND_OPTIONS.map((option) => <button type="button" key={option.value} className={secondary} aria-pressed={kind === option.value} style={{ background: kind === option.value ? "var(--brand-dim)" : "transparent" }} onClick={() => setKind(option.value)}>{option.label}</button>)}</div>
        <fieldset className="min-w-0 rounded-xl border border-[var(--border)] p-3">
          <legend className="px-2 text-sm font-semibold">Contexto de la fotografía en obra (opcional)</legend>
          <p className="mb-3 text-xs text-[var(--muted)]">Ubicación declarada, no verificada. No representa coordenadas, medidas ni estado as-built verificados.</p>
          <div className="grid min-w-0 gap-3 sm:grid-cols-3">
            <label className="grid min-w-0 gap-2 text-sm text-[var(--muted)]">Piso / nivel<input className={control} value={captureFloorLabel} onChange={e => setCaptureFloorLabel(e.target.value)} maxLength={60} placeholder="Ej.: Piso 7" /></label>
            <label className="grid min-w-0 gap-2 text-sm text-[var(--muted)]">Zona / pared<input className={control} value={captureZoneLabel} onChange={e => setCaptureZoneLabel(e.target.value)} maxLength={100} placeholder="Ej.: Pared norte" /></label>
            <label className="grid min-w-0 gap-2 text-sm text-[var(--muted)]">Etapa de obra<select className={control} value={capturePhase} onChange={e => setCapturePhase(e.target.value as FieldCapturePhase)}>{FIELD_CAPTURE_PHASES.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
          </div>
        </fieldset>
        <div className="grid min-w-0 gap-3 rounded-xl border-2 border-dashed border-[var(--border)] bg-[var(--bg)] p-5" style={{ borderColor: dragOver ? "var(--brand)" : undefined }} onDragOver={e => { e.preventDefault(); if (!uploading) setDragOver(true); }} onDragLeave={() => setDragOver(false)} onDrop={e => { e.preventDefault(); setDragOver(false); handleFiles(Array.from(e.dataTransfer.files)); }}>
          <div className="flex items-center gap-2"><Upload size={20} className="text-[var(--brand)]" /><span>Arrastra archivos o selecciónalos en tu dispositivo</span></div>
          <label htmlFor="evidence-upload" className="text-sm text-[var(--muted)]">Fotos, video o documentos · hasta 25 MiB por archivo · solo subida directa</label>
          <input id="evidence-upload" className={`${control} py-2`} type="file" multiple accept="image/*,video/*,.pdf,.doc,.docx,.zip,.rar,.7z,.heic,.dwg,.xlsx" onChange={e => handleFiles(e.target.files ? Array.from(e.target.files) : [])} />
        </div>
        {files.length > 0 && <div className="grid min-w-0 gap-3">
          <ul className="grid gap-1 text-sm text-[var(--muted)]">{files.map((file, index) => <li key={index} className="[overflow-wrap:anywhere]">{file.name} · {(file.size / 1024 / 1024).toFixed(1)} MiB</li>)}</ul>
          <div className="flex flex-wrap gap-2"><button type="button" className={`${secondary} bg-[var(--brand-dim)]`} disabled={!activeJobId || uploading} onClick={() => void handleUpload()}><Upload size={16} />{uploading ? "Subiendo y registrando…" : `Subir ${files.length} archivo(s)`}</button><button type="button" className={secondary} onClick={() => { setFiles([]); setUploadResults([]); }}>Cancelar selección</button></div>
        </div>}
      </fieldset>
      {uploadNote && <div role={uploadNote.ok ? "status" : "alert"} className="mt-4 flex items-start gap-2 rounded-lg border border-[var(--border)] p-3 text-sm" style={{ color: uploadNote.ok ? "var(--ink)" : "var(--error)" }}>{uploadNote.ok ? <CheckCircle2 size={18} className="shrink-0" /> : <AlertTriangle size={18} className="shrink-0" />}<span>{uploadNote.msg}</span></div>}
      {uploadResults.length > 0 && <ul aria-label="Resultado por archivo" className="mt-3 grid min-w-0 gap-2 text-sm">{uploadResults.map((result, index) => <li key={index} className="[overflow-wrap:anywhere]" style={{ color: result.ok ? "var(--ink)" : "var(--error)" }}>{result.file.name}: {result.ok ? "Bytes subidos y evidencia registrada" : result.error}</li>)}</ul>}
    </HtmlInCanvasPanel>
    <HtmlInCanvasPanel as="section" canvasClassName="rounded-2xl" minHeight={200}>
      <h2 className="mb-3 font-semibold">Historial de evidencias{activeJobId ? ` — ${jobs.find((job) => job.id === activeJobId)?.title ?? ""}` : ""}</h2>
      {evidenceQuery.loading && <PanelState title="Cargando historial" loading />}
      {evidenceQuery.error && <PanelState title={isWorkspaceAccessError(evidenceQuery.error) ? "Sin acceso a la evidencia" : "No se pudo cargar el historial"} description={evidenceQuery.error} error onRetry={evidenceQuery.retry} />}
      {!activeJobId && <PanelState title="Selecciona un trabajo autorizado" />}
      {evidenceQuery.data?.length === 0 && <PanelState title="Sin evidencia registrada para este trabajo" />}
      <ul className="grid min-w-0 gap-2">{evidenceFeed.map((row, index) => {
        const status = readEvidenceStatus(row);
        const fieldCaptureLabel = describeFieldCapture(row);
        const key = asString(row.key);
        const previewUrl = key ? evidenceUploadProxyUrl(key) : undefined;
        const image = row.kind === "PHOTO";
        const milestone = milestones.find((item) => item.id === row.milestoneId);
        return <li key={asString(row.id) ?? index} className="flex min-w-0 flex-wrap items-start gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
          {image ? <ImageIcon size={20} className="shrink-0 text-[var(--brand)]" /> : <FileText size={20} className="shrink-0 text-[var(--brand)]" />}
          <div className="min-w-0 flex-1 [overflow-wrap:anywhere]"><p className="text-sm font-semibold">{asString(row.filename) ?? key ?? `Evidencia ${index + 1}`}</p><p className="mt-1 text-xs text-[var(--muted)]">{asString(milestone?.title) ?? asString(row.milestoneId) ?? "Sin hito específico"} · {KIND_OPTIONS.find((option) => option.value === row.kind)?.label ?? asString(row.kind) ?? "Tipo no disponible"}</p>{fieldCaptureLabel && <p className="mt-1 text-xs text-[var(--muted)]">{fieldCaptureLabel}</p>}<p className="mt-1 text-xs text-[var(--muted)]">{asString(row.createdAt) ?? "Fecha no disponible"}</p></div>
          <div className="grid gap-2"><StatusBadge variant={statusVariant(status)} text={evidenceStatusLabel(status)} size="sm" />{previewUrl && <Link href={previewUrl} target="_blank" rel="noreferrer" className={secondary}><Eye size={14} />Ver archivo</Link>}</div>
        </li>;
      })}</ul>
    </HtmlInCanvasPanel>
  </div>;
}
