"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { FileText, Upload } from "lucide-react";
import { fetchJobEvidence, fetchJobMilestones, planUpload, registerJobEvidence, semseRuntimeEnabled } from "../../../semse-api";
import { PanelState } from "../../../workspace/components/PanelState";
import { useWorkspaceQuery, isWorkspaceAccessError } from "../../../workspace/lib/use-workspace-query";
import {
  EVIDENCE_KIND_LABELS, evidenceKindForFile, evidenceStatus, evidenceStatusLabel, evidenceText,
  evidenceUploadProxyUrl, uploadRealEvidenceFile, type EvidenceKind,
} from "../../../workspace/lib/evidence-model";

type EvidencePageProps = { params: Promise<{ jobId: string }> };
const control = "min-h-11 w-full min-w-0 rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 text-sm text-[var(--ink)]";
const action = "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-[var(--border)] px-3 text-sm text-[var(--brand)] disabled:opacity-50";

export default function JobEvidencePage({ params }: EvidencePageProps) {
  const runtimeEnabled = semseRuntimeEnabled();
  const [jobId, setJobId] = useState("");
  const [routeError, setRouteError] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [kind, setKind] = useState<EvidenceKind>("PHOTO");
  const [milestoneId, setMilestoneId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const uploadLock = useRef(false);
  const mounted = useRef(true);
  const routeVersion = useRef(0);
  const fileInput = useRef<HTMLInputElement>(null);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => {
    let current = true;
    routeVersion.current += 1;
    setJobId(""); setRouteError(null); setFile(null); setMilestoneId(""); setFeedback(null); setUploadError(null);
    Promise.resolve(params).then((resolved) => {
      if (current) setJobId(resolved.jobId);
    }, (error: unknown) => {
      if (current) setRouteError(error instanceof Error ? error.message : "No se pudo resolver el trabajo.");
    });
    return () => { current = false; };
  }, [params]);
  const evidenceLoader = useCallback(() => fetchJobEvidence(encodeURIComponent(jobId)), [jobId]);
  const milestonesLoader = useCallback(() => fetchJobMilestones(encodeURIComponent(jobId)), [jobId]);
  const itemsQuery = useWorkspaceQuery(jobId ? `job-evidence:${jobId}` : null, evidenceLoader);
  const milestonesQuery = useWorkspaceQuery(jobId ? `job-evidence-milestones:${jobId}` : null, milestonesLoader);
  const items = itemsQuery.data ?? [];
  const milestones = milestonesQuery.data ?? [];
  const validMilestoneId = milestones.some((row) => evidenceText(row.id) === milestoneId) ? milestoneId : "";

  async function handleRegister() {
    if (uploadLock.current || !runtimeEnabled || !jobId || !file) return;
    const selectedFile = file;
    const uploadVersion = routeVersion.current;
    uploadLock.current = true; setSubmitting(true); setUploadError(null); setFeedback(null);
    try {
      await uploadRealEvidenceFile(selectedFile, { jobId, kind, ...(validMilestoneId ? { milestoneId: validMilestoneId } : {}) }, {
        plan: planUpload,
        put: async (key, realFile, contentType) => {
          const response = await fetch(evidenceUploadProxyUrl(key), {
            method: "PUT", headers: { "content-type": contentType }, body: realFile,
          });
          if (!response.ok) {
            const message = await response.text().catch(() => "");
            throw new Error(`No se pudo subir el archivo (${response.status}).${message ? ` ${message}` : ""}`);
          }
        },
        register: registerJobEvidence,
      });
      if (!mounted.current || uploadVersion !== routeVersion.current) return;
      setFeedback(`Bytes subidos y evidencia registrada: ${selectedFile.name}. La carga no implica validación ni aprobación del hito.`);
      setFile(null); setMilestoneId("");
      if (fileInput.current) fileInput.current.value = "";
      itemsQuery.retry();
    } catch (error) {
      if (mounted.current && uploadVersion === routeVersion.current) setUploadError(error instanceof Error ? error.message : "No se pudo subir y registrar la evidencia. Se conserva el archivo seleccionado.");
    } finally {
      uploadLock.current = false;
      if (mounted.current) setSubmitting(false);
    }
  }

  return <div className="mx-auto grid w-full min-w-0 max-w-5xl gap-6 px-4 py-8 text-[var(--ink)] sm:px-6">
    <nav aria-label="Ruta de navegación" className="flex min-w-0 flex-wrap items-center gap-2 text-sm text-[var(--muted)]">
      <Link href="/" className={action}>Trabajos</Link><span aria-hidden>/</span>
      {jobId && <Link href={`/jobs/${encodeURIComponent(jobId)}`} className={action}>Detalle</Link>}<span aria-hidden>/</span><span>Evidencia</span>
    </nav>
    <header><p className="text-xs font-semibold uppercase tracking-widest text-[var(--brand)]">Trazabilidad</p><h1 className="mt-1 text-2xl font-bold">Evidencia</h1><p className="mt-2 text-sm text-[var(--muted)]">Selecciona un archivo de tu dispositivo. Se preparará la carga, se enviarán sus bytes reales y después se registrará la evidencia canónica.</p></header>
    {!runtimeEnabled && <PanelState title="Carga real no disponible" description="El runtime de evidencia no está habilitado. No se simularán archivos ni se registrarán keys sin contenido." />}
    {routeError && <PanelState title="No se pudo resolver el trabajo" description={routeError} error />}
    {!jobId && !routeError && <PanelState title="Resolviendo trabajo" loading />}
    {jobId && <div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,260px)]">
      <div className="grid min-w-0 gap-6">
        <section className="min-w-0 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5" aria-labelledby="upload-evidence-title">
          <h2 id="upload-evidence-title" className="mb-4 font-semibold">Subir archivo real</h2>
          {uploadError && <div className="mb-4"><PanelState title="No se pudo completar la carga" description={uploadError} error /></div>}
          {feedback && <p role="status" className="mb-4 rounded-lg border border-[var(--border)] p-3 text-sm">{feedback}</p>}
          <fieldset disabled={submitting || !runtimeEnabled} className="grid min-w-0 gap-4 border-0 p-0">
            <label className="grid min-w-0 gap-2 text-sm text-[var(--muted)]">Archivo del dispositivo
              <input ref={fileInput} type="file" data-testid="evidence-file-input" className={`${control} py-2`} onChange={(event) => {
                const selected = event.target.files?.[0] ?? null;
                setFile(selected); setUploadError(null); setFeedback(null);
                if (selected) setKind(evidenceKindForFile(selected));
              }} />
            </label>
            {file && <p className="text-sm text-[var(--muted)] [overflow-wrap:anywhere]">{file.name} · {(file.size / 1024 / 1024).toFixed(1)} MiB</p>}
            <div className="grid min-w-0 gap-4 sm:grid-cols-2">
              <label className="grid min-w-0 gap-2 text-sm text-[var(--muted)]">Tipo
                <select className={control} data-testid="evidence-kind-select" value={kind} onChange={(event) => setKind(event.target.value as EvidenceKind)}>{Object.entries(EVIDENCE_KIND_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
              </label>
              <label className="grid min-w-0 gap-2 text-sm text-[var(--muted)]">Hito (opcional)
                <select className={control} value={validMilestoneId} disabled={milestonesQuery.loading || Boolean(milestonesQuery.error)} onChange={(event) => setMilestoneId(event.target.value)}><option value="">Sin hito específico</option>{milestones.map((row) => evidenceText(row.id) && <option key={evidenceText(row.id)} value={evidenceText(row.id)}>{evidenceText(row.title) || evidenceText(row.id)}</option>)}</select>
              </label>
            </div>
            <p className="rounded-lg border border-[var(--border)] bg-[var(--bg)] p-3 text-xs text-[var(--muted)]">Hasta 25 MiB por archivo, sujeto al límite del servidor. Esta pantalla solo admite subida directa; si el plan solicita external_transfer (transferencia externa), se rechazará con explicación y no se registrará evidencia. No se fabrican archivos ni partes multipart.</p>
            <button type="button" data-testid="register-evidence-button" className={`${action} justify-self-start bg-[var(--brand-dim)]`} disabled={!file || submitting || !runtimeEnabled} onClick={() => void handleRegister()}><Upload size={16} />{submitting ? "Subiendo y registrando…" : "Subir y registrar evidencia"}</button>
          </fieldset>
          {milestonesQuery.loading && <div className="mt-4"><PanelState title="Cargando hitos" loading /></div>}
          {milestonesQuery.error && <div className="mt-4"><PanelState title={isWorkspaceAccessError(milestonesQuery.error) ? "Sin acceso a los hitos" : "Consulta parcial: no se pudieron cargar los hitos"} description={`${milestonesQuery.error} El selector no permite asociar hitos no consultados; puedes cargar a nivel de trabajo.`} error onRetry={milestonesQuery.retry} /></div>}
          <div className="mt-4 flex flex-wrap gap-2"><Link href={`/jobs/${encodeURIComponent(jobId)}`} className={action}>Volver al detalle</Link><Link href={`/worker/evidence?jobId=${encodeURIComponent(jobId)}`} className={action}>Hub de evidencia profesional</Link><Link href={`/jobs/${encodeURIComponent(jobId)}/escrow`} className={action}>Consultar escrow</Link></div>
        </section>
        <section className="grid min-w-0 gap-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5" aria-labelledby="registered-evidence-title">
          <h2 id="registered-evidence-title" className="font-semibold">Evidencia registrada</h2>
          {itemsQuery.loading && <PanelState title="Cargando evidencia" loading />}
          {itemsQuery.error && <PanelState title={isWorkspaceAccessError(itemsQuery.error) ? "Sin acceso a la evidencia" : "No se pudo leer la evidencia"} description={itemsQuery.error} error onRetry={itemsQuery.retry} />}
          {itemsQuery.data?.length === 0 && <PanelState title="Sin evidencia aún" description="Sube el primer archivo real para documentar el avance del trabajo." />}
          <ul className="grid min-w-0 gap-2">{items.map((item, index) => <li key={evidenceText(item.id) || index} className="flex min-w-0 flex-wrap items-start gap-3 rounded-xl border border-[var(--border)] bg-[var(--bg)] p-4">
            <FileText size={18} className="shrink-0 text-[var(--brand)]" aria-hidden />
            <div className="min-w-0 flex-1 [overflow-wrap:anywhere]"><p className="text-sm font-semibold">{evidenceText(item.filename) || evidenceText(item.key) || `Evidencia ${index + 1}`}</p><p className="mt-1 text-xs text-[var(--muted)]">{EVIDENCE_KIND_LABELS[evidenceText(item.kind)] || evidenceText(item.kind) || "Tipo no disponible"} · {evidenceStatusLabel(evidenceStatus(item))}</p><p className="mt-1 text-xs text-[var(--muted)]">{evidenceText(item.milestoneId) || "Sin hito específico"} · {evidenceText(item.createdAt) || "Fecha no disponible"}</p></div>
            {evidenceText(item.key) && <Link href={evidenceUploadProxyUrl(evidenceText(item.key))} target="_blank" rel="noreferrer" className={action}>Ver archivo</Link>}
          </li>)}</ul>
        </section>
      </div>
      <aside className="grid min-w-0 content-start gap-4">
        {itemsQuery.data && <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5"><h2 className="text-sm font-semibold">Total registrado</h2><p className="mt-2 text-3xl font-bold">{items.length}</p><p className="mt-1 text-xs text-[var(--muted)]">Archivos devueltos por la fuente autorizada</p><dl className="mt-4 grid gap-2 text-sm">{Object.entries(EVIDENCE_KIND_LABELS).map(([value, label]) => <div key={value} className="flex justify-between gap-2"><dt>{label}</dt><dd>{items.filter((item) => evidenceText(item.kind).toUpperCase() === value).length}</dd></div>)}</dl></section>}
        <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4"><h2 className="text-sm font-semibold">Evidencia y gobernanza</h2><p className="mt-2 text-xs text-[var(--muted)]">El backend conserva la autorización por recurso, tenant y organización. Registrar un archivo no aprueba hitos ni altera pagos; sus estados de validación se muestran tal como fueron recibidos.</p></section>
      </aside>
    </div>}
  </div>;
}
