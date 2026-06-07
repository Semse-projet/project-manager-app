"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  completeMultipartUploadSession,
  createMultipartUploadSession,
  fetchJobEvidence,
  presignEvidence,
  registerJobEvidence,
  uploadMultipartPart,
  semseRuntimeEnabled
} from "../../../semse-api";
import { Button } from "../../../../components/ui/button";
import { Input, Select } from "../../../../components/ui/input";
import { MetricCard } from "../../../../components/ui/card";
import { FeedbackBanner } from "../../../../components/ui/error-state";
import { EmptyState } from "../../../../components/ui/empty-state";
import { PageSpinner } from "../../../../components/ui/spinner";

type EvidencePageProps = { params: Promise<{ jobId: string }> };
type EvidenceKind = "PHOTO" | "VIDEO" | "DOCUMENT";
type EvidenceSource =
  | "local_device"
  | "camera_capture"
  | "field_ops"
  | "project_copilot"
  | "external_transfer";

type PresignResponse = {
  key?: string;
  recommendedStrategy?: string;
  maxSingleUploadBytes?: number;
  acceptedChannels?: string[];
  uploadGuidance?: string;
  multipart?: {
    recommendedChunkSizeBytes?: number;
    recommendedPartCount?: number;
    requiresOutOfBandTransfer?: boolean;
  } | null;
};

type MultipartSessionResponse = PresignResponse & {
  sessionId?: string;
  provider?: string;
  expiresAt?: string;
  parts?: Array<{
    partNumber?: number;
    startByte?: number;
    endByte?: number;
    uploadUrl?: string;
  }>;
};

const kindMeta: Record<EvidenceKind, { label: string; emoji: string; mime: string }> = {
  PHOTO:    { label: "Foto",      emoji: "📷", mime: "image/jpeg" },
  VIDEO:    { label: "Video",     emoji: "🎬", mime: "video/mp4" },
  DOCUMENT: { label: "Documento", emoji: "📄", mime: "application/pdf" }
};

const sourceOptions: Array<{ value: EvidenceSource; label: string; hint: string }> = [
  { value: "local_device", label: "Equipo local", hint: "Arrastre directo o selección manual." },
  { value: "camera_capture", label: "Captura móvil/cámara", hint: "Fotos rápidas en campo." },
  { value: "field_ops", label: "Field Ops", hint: "Material generado durante operación." },
  { value: "project_copilot", label: "Copiloto del proyecto", hint: "Archivos referenciados desde el copiloto." },
  { value: "external_transfer", label: "Transferencia externa", hint: "Lotes grandes, video largo o ZIP pesado." }
];

export default function JobEvidencePage({ params }: EvidencePageProps) {
  const runtimeEnabled = semseRuntimeEnabled();
  const [jobId, setJobId]         = useState("");
  const [items, setItems]         = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading]     = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const [feedback, setFeedback]   = useState<string | null>(null);
  const [kind, setKind]           = useState<EvidenceKind>("PHOTO");
  const [filename, setFilename]   = useState("evidence-photo.jpg");
  const [milestoneId, setMilestoneId] = useState("");
  const [source, setSource]       = useState<EvidenceSource>("local_device");
  const [fileSizeMb, setFileSizeMb] = useState("8");
  const [uploadAdvice, setUploadAdvice] = useState<PresignResponse | null>(null);
  const [multipartSession, setMultipartSession] = useState<MultipartSessionResponse | null>(null);
  const [multipartProgress, setMultipartProgress] = useState<Record<number, "pending" | "uploading" | "uploaded">>({});
  const [completingMultipart, setCompletingMultipart] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function boot() {
      const resolved = await params;
      if (cancelled) return;
      setJobId(resolved.jobId);
      try {
        const data = await fetchJobEvidence(resolved.jobId);
        if (!cancelled) { setItems(data); setError(null); }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "No se pudo leer la evidencia.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void boot();
    return () => { cancelled = true; };
  }, [params]);

  const stats = useMemo(() => ({
    photos:    items.filter((i) => String(i.kind).toUpperCase() === "PHOTO").length,
    videos:    items.filter((i) => String(i.kind).toUpperCase() === "VIDEO").length,
    documents: items.filter((i) => String(i.kind).toUpperCase() === "DOCUMENT").length
  }), [items]);

  async function handleRegister() {
    if (!jobId || submitting) return;
    setSubmitting(true);
    setError(null);
    setFeedback(null);
    try {
      const presigned = (await presignEvidence({
        filename: filename.trim() || "evidence-file",
        contentType: kindMeta[kind].mime,
        fileSizeBytes: Math.max(1, Number(fileSizeMb || "0")) * 1024 * 1024,
        source
      })) as PresignResponse;
      const key = typeof presigned.key === "string" ? presigned.key : null;
      if (!key) throw new Error("No se pudo obtener la key de evidencia.");
      setUploadAdvice(presigned);
      if (presigned.recommendedStrategy === "external_transfer") {
        const session = (await createMultipartUploadSession({
          domain: "evidence",
          filename: filename.trim() || "evidence-file",
          contentType: kindMeta[kind].mime,
          fileSizeBytes: Math.max(1, Number(fileSizeMb || "0")) * 1024 * 1024,
          source
        })) as MultipartSessionResponse;
        setMultipartSession(session);
        setMultipartProgress(
          Object.fromEntries((session.parts ?? []).map((part, index) => [part.partNumber ?? index + 1, "pending"]))
        );
      } else {
        setMultipartSession(null);
        setMultipartProgress({});
      }
      await registerJobEvidence(jobId, { key, kind, milestoneId: milestoneId.trim() || undefined });
      const refreshed = await fetchJobEvidence(jobId);
      setItems(refreshed);
      setFeedback(`Evidencia registrada: ${filename.trim() || "archivo"}.`);
      setFilename("evidence-photo.jpg");
      setMilestoneId("");
      setSource("local_device");
      setFileSizeMb("8");
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo registrar la evidencia.");
      setMultipartSession(null);
      setMultipartProgress({});
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCompleteMultipart() {
    if (!multipartSession?.sessionId || !multipartSession.parts?.length || completingMultipart) return;
    setCompletingMultipart(true);
    setError(null);
    setFeedback(null);
    try {
      for (const [index, part] of multipartSession.parts.entries()) {
        const partNumber = part.partNumber ?? index + 1;
        const bytes = typeof part.endByte === "number" && typeof part.startByte === "number"
          ? Math.max(1, part.endByte - part.startByte + 1)
          : 1024 * 1024;
        setMultipartProgress((current) => ({ ...current, [partNumber]: "uploading" }));
        await uploadMultipartPart({
          sessionId: multipartSession.sessionId,
          partNumber,
          contentLength: bytes
        });
        setMultipartProgress((current) => ({ ...current, [partNumber]: "uploaded" }));
      }
      const completion = await completeMultipartUploadSession({
        sessionId: multipartSession.sessionId,
        parts: multipartSession.parts.map((part, index) => ({
          partNumber: part.partNumber ?? index + 1,
          etag: `etag-part-${part.partNumber ?? index + 1}`
        }))
      });
      setFeedback(
        `Sesión multipart completada: ${String(completion.status ?? "completed")} · ${String(completion.partsReceived ?? multipartSession.parts.length)} partes confirmadas.`
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo completar la sesión multipart.");
    } finally {
      setCompletingMultipart(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-4 sm:px-6 py-8">
      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb" className="mb-6 flex items-center gap-2 text-xs text-muted">
        <Link href="/" className="hover:text-brand transition-colors">Jobs</Link>
        <span aria-hidden className="text-white/20">/</span>
        <Link href={`/jobs/${jobId}`} className="hover:text-brand transition-colors">Detalle</Link>
        <span aria-hidden className="text-white/20">/</span>
        <span className="text-ink font-medium">Evidencia</span>
      </nav>

      {/* Header */}
      <div className="mb-6">
        <p className="text-[0.68rem] font-semibold tracking-widest uppercase text-brand mb-1">
          Trazabilidad
        </p>
        <h1 className="text-2xl font-bold tracking-tight text-ink">Evidencia</h1>
        <p className="mt-1 text-sm text-muted">
          Registra prueba documental del avance del trabajo.
        </p>
      </div>

      {/* Runtime banner */}
      {!runtimeEnabled ? (
        <div className="mb-6 rounded-xl border border-amber-500/20 bg-amber-500/[0.07] px-4 py-3">
          <p className="text-xs font-semibold text-amber-300">Modo simulación</p>
          <p className="mt-0.5 text-xs text-amber-300/70">
            Configura las variables de entorno del servidor para registrar evidencia real.
          </p>
        </div>
      ) : null}

      {loading ? (
        <PageSpinner />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1fr_260px]">
          {/* Main content */}
          <div className="grid gap-6">
            {/* Stats */}
            <div className="grid grid-cols-3 gap-3">
              <MetricCard label="Fotos"      value={stats.photos} />
              <MetricCard label="Videos"     value={stats.videos} />
              <MetricCard label="Documentos" value={stats.documents} accent={stats.documents > 0} />
            </div>

            {/* Register form */}
            <div className="rounded-2xl border border-white/[0.08] bg-[#0d0d20] p-5">
              <h2 className="mb-4 text-sm font-semibold text-ink">Registrar evidencia</h2>

              {error    ? <div className="mb-4"><FeedbackBanner type="error"   message={error} /></div> : null}
              {feedback ? <div className="mb-4"><FeedbackBanner type="success" message={feedback} /></div> : null}

              <div className="grid gap-4">
                <div className="grid grid-cols-2 gap-4">
                  <Select
                    label="Tipo"
                    data-testid="evidence-kind-select"
                    value={kind}
                    onChange={(e) => setKind(e.target.value as EvidenceKind)}
                  >
                    <option value="PHOTO">Foto</option>
                    <option value="VIDEO">Video</option>
                    <option value="DOCUMENT">Documento</option>
                  </Select>
                  <Input
                    label="Milestone ID"
                    value={milestoneId}
                    onChange={(e) => setMilestoneId(e.target.value)}
                    placeholder="opcional"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <Select
                    label="Canal de ingreso"
                    value={source}
                    onChange={(e) => setSource(e.target.value as EvidenceSource)}
                  >
                    {sourceOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </Select>
                  <Input
                    label="Tamaño estimado (MB)"
                    value={fileSizeMb}
                    onChange={(e) => setFileSizeMb(e.target.value)}
                    placeholder="8"
                  />
                </div>

                <Input
                  label="Nombre del archivo"
                  data-testid="evidence-filename-input"
                  value={filename}
                  onChange={(e) => setFilename(e.target.value)}
                  placeholder="evidence-photo.jpg"
                />

                <div className="flex items-center gap-3 flex-wrap">
                  <Link href={`/jobs/${jobId}`} className="ghost-action-button text-xs">
                    ← Volver al detalle
                  </Link>
                  <Link href={`/worker/evidence`} className="ghost-action-button text-xs">
                    Hub de evidencia
                  </Link>
                  <Link href={`/jobs/${jobId}/escrow`} className="ghost-action-button text-xs">
                    Escrow
                  </Link>
                  <Button
                    data-testid="register-evidence-button"
                    disabled={!runtimeEnabled}
                    loading={submitting}
                    onClick={handleRegister}
                  >
                    Registrar evidencia
                  </Button>
                </div>

                <div className="rounded-xl border border-white/[0.08] bg-[#131328] px-4 py-3 text-xs text-muted">
                  {Number(fileSizeMb || "0") > 25 ? (
                    <p>
                      Archivo grande detectado. Usa <strong className="text-ink">Transferencia externa</strong> para
                      videos largos, ZIPs, CAD o paquetes de evidencia por encima de 25 MB.
                    </p>
                  ) : (
                    <p>
                      Para archivos normales puedes registrar desde equipo local, móvil/cámara, Field Ops o el copiloto del proyecto.
                    </p>
                  )}
                </div>

                {uploadAdvice ? (
                  <div className="rounded-xl border border-sky-500/20 bg-sky-500/[0.08] px-4 py-3 text-xs text-sky-100">
                    <p className="font-semibold text-white">Recomendación de carga</p>
                    <p className="mt-1">{uploadAdvice.uploadGuidance ?? "Sin guía adicional."}</p>
                    <div className="mt-2 grid gap-1 text-sky-100/85">
                      <p>Estrategia: {uploadAdvice.recommendedStrategy ?? "single_put"}</p>
                      <p>
                        Límite recomendado por subida simple:{" "}
                        {typeof uploadAdvice.maxSingleUploadBytes === "number"
                          ? `${Math.round(uploadAdvice.maxSingleUploadBytes / (1024 * 1024))} MB`
                          : "n/d"}
                      </p>
                      {uploadAdvice.multipart ? (
                        <p>
                          Multipart sugerido:{" "}
                          {uploadAdvice.multipart.recommendedPartCount ?? "n/d"} partes de{" "}
                          {typeof uploadAdvice.multipart.recommendedChunkSizeBytes === "number"
                            ? `${Math.round(uploadAdvice.multipart.recommendedChunkSizeBytes / (1024 * 1024))} MB`
                            : "n/d"}
                        </p>
                      ) : null}
                    </div>
                  </div>
                ) : null}

                {multipartSession?.sessionId ? (
                  <div className="rounded-xl border border-teal-500/20 bg-teal-500/[0.08] px-4 py-3 text-xs text-teal-100">
                    <p className="font-semibold text-white">Sesión multipart creada</p>
                    <p className="mt-1">
                      ID: <span className="font-mono">{multipartSession.sessionId}</span> · proveedor: {multipartSession.provider ?? "—"}
                    </p>
                    <p className="mt-1">
                      Partes: {multipartSession.parts?.length ?? 0} · expira: {multipartSession.expiresAt ?? "—"}
                    </p>
                    <div className="mt-3 grid gap-1 text-teal-100/85">
                      {multipartSession.parts?.slice(0, 5).map((part) => (
                        <p key={part.partNumber}>
                          Parte {part.partNumber}: {typeof part.startByte === "number" ? Math.round(part.startByte / (1024 * 1024)) : "?"} MB
                          {" - "}
                          {typeof part.endByte === "number" ? Math.round(part.endByte / (1024 * 1024)) : "?"} MB
                          {" · "}
                          {multipartProgress[part.partNumber ?? 0] ?? "pending"}
                        </p>
                      ))}
                      {(multipartSession.parts?.length ?? 0) > 5 ? (
                        <p>... y {(multipartSession.parts?.length ?? 0) - 5} partes más</p>
                      ) : null}
                    </div>
                    <div className="mt-3">
                      <Button
                        disabled={completingMultipart}
                        loading={completingMultipart}
                        onClick={handleCompleteMultipart}
                      >
                        Completar sesión multipart
                      </Button>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>

            {/* Evidence list */}
            <div className="rounded-2xl border border-white/[0.08] bg-[#0d0d20] p-5">
              <h2 className="mb-4 text-sm font-semibold text-ink">Evidencia registrada</h2>
              {items.length === 0 ? (
                <EmptyState
                  title="Sin evidencia aún"
                  description="Registra la primera evidencia para trazar el avance del trabajo."
                />
              ) : (
                <ul className="grid gap-2">
                  {items.map((item, i) => {
                    const k = String(item.kind ?? "unknown").toUpperCase() as EvidenceKind;
                    const meta = kindMeta[k] ?? { label: k, emoji: "📎" };
                    return (
                      <li key={String(item.id ?? i)}
                        className="flex items-center justify-between gap-4 rounded-xl border border-white/[0.07] bg-[#131328] px-4 py-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <span aria-hidden className="text-xl shrink-0">{meta.emoji}</span>
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-ink">{meta.label}</p>
                            <p className="text-xs text-muted truncate">{String(item.key ?? "—")}</p>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-xs font-semibold text-ink">
                            {String(item.milestoneId ?? "job-level")}
                          </p>
                          <p className="text-[0.68rem] text-muted">{String(item.createdAt ?? "")}</p>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>

          {/* Sidebar */}
          <aside className="grid gap-4 content-start">
            <div className="rounded-2xl border border-white/[0.08] bg-[#131328] p-5">
              <p className="text-[0.68rem] font-semibold tracking-widest uppercase text-muted mb-3">
                Total registrado
              </p>
              <p className="text-3xl font-bold tracking-tight text-ink">{items.length}</p>
              <p className="mt-1 text-xs text-muted">archivos de evidencia</p>
            </div>

            <div className="rounded-2xl border border-white/[0.08] bg-[#131328] p-4">
              <p className="text-[0.68rem] font-semibold tracking-widest uppercase text-muted mb-2">
                Tipos soportados
              </p>
              <ul className="grid gap-1.5">
                {Object.entries(kindMeta).map(([k, v]) => (
                  <li key={k} className="flex items-center gap-2 text-xs text-muted">
                    <span aria-hidden>{v.emoji}</span> {v.label}
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-2xl border border-white/[0.08] bg-[#131328] p-4">
              <p className="text-[0.68rem] font-semibold tracking-widest uppercase text-muted mb-2">
                Canales de carga
              </p>
              <ul className="grid gap-2">
                {sourceOptions.map((option) => (
                  <li key={option.value} className="text-xs text-muted">
                    <span className="font-semibold text-ink">{option.label}:</span> {option.hint}
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-xs text-muted">
                Recomendación: usa transferencia externa para paquetes mayores a 25 MB o cuando recibas archivos pesados de terceros.
              </p>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
