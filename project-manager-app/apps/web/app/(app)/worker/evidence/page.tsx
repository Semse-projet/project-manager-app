"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Upload, Camera, FileText, Image as ImageIcon, Clock, ChevronDown, RefreshCw, CheckCircle2, AlertTriangle, Eye } from "lucide-react";
import { HtmlInCanvasPanel, StatusBadge } from "@semse/ui";
import {
  fetchJobs,
  fetchJobMilestones,
  fetchJobEvidence,
  registerJobEvidence,
  planUpload,
  createMultipartUploadSession,
  uploadMultipartPart,
  completeMultipartUploadSession,
  sendNotification,
  type JobRecordView,
} from "../../../semse-api";
import { NotificationBanner } from "../../../components/notifications/NotificationBanner";

type EvidenceRow = Record<string, unknown>;
type MilestoneRow = Record<string, unknown>;

const KIND_OPTIONS = [
  { value: "PHOTO",    label: "Foto" },
  { value: "VIDEO",    label: "Video" },
  { value: "DOCUMENT", label: "Documento" },
] as const;

type EvidenceKind = "PHOTO" | "VIDEO" | "DOCUMENT";

function mimeToKind(mime: string): EvidenceKind {
  if (mime.startsWith("image/")) return "PHOTO";
  if (mime.startsWith("video/")) return "VIDEO";
  return "DOCUMENT";
}

function asString(v: unknown): string | undefined {
  return typeof v === "string" && v.trim().length > 0 ? v : undefined;
}

function formatDate(v: unknown): string {
  if (!v) return "—";
  const d = new Date(String(v));
  if (isNaN(d.getTime())) return String(v);
  return d.toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

const STATUS_MAP: Record<string, { variant: "success" | "warning" | "error" | "info"; label: string }> = {
  approved:     { variant: "success", label: "Aprobada" },
  passed:       { variant: "success", label: "Aprobada" },
  pending:      { variant: "warning", label: "Pendiente" },
  under_review: { variant: "warning", label: "Revisión" },
  rejected:     { variant: "error",   label: "Rechazada" },
  failed:       { variant: "error",   label: "Rechazada" },
};

function evidenceStatus(row: EvidenceRow) {
  const raw = asString(row.validationStatus) ?? asString(row.validation_status) ?? asString(row.status) ?? "pending";
  const normalized = raw.toLowerCase().replace(/-/g, "_");
  return STATUS_MAP[normalized] ?? STATUS_MAP.pending;
}

export default function WorkerEvidencePage() {
  const [jobs, setJobs] = useState<JobRecordView[]>([]);
  const [selectedJobId, setSelectedJobId] = useState("");
  const [milestones, setMilestones] = useState<MilestoneRow[]>([]);
  const [selectedMilestoneId, setSelectedMilestoneId] = useState("");
  const [kind, setKind] = useState<EvidenceKind>("PHOTO");
  const [evidenceFeed, setEvidenceFeed] = useState<EvidenceRow[]>([]);
  const [loadingJobs, setLoadingJobs] = useState(true);
  const [loadingEvidence, setLoadingEvidence] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadNote, setUploadNote] = useState<{ msg: string; ok: boolean } | null>(null);

  const loadJobs = useCallback(async () => {
    setLoadingJobs(true);
    try {
      const data = await fetchJobs();
      setJobs(data);
      if (data.length > 0 && !selectedJobId) setSelectedJobId(data[0].id);
    } catch { /* keep empty */ }
    setLoadingJobs(false);
  }, [selectedJobId]);

  useEffect(() => { void loadJobs(); }, []);

  const loadMilestonesAndEvidence = useCallback(async (jobId: string) => {
    if (!jobId) return;
    setLoadingEvidence(true);
    try {
      const [ms, ev] = await Promise.all([
        fetchJobMilestones(jobId).catch(() => []),
        fetchJobEvidence(jobId).catch(() => []),
      ]);
      setMilestones(ms as MilestoneRow[]);
      setEvidenceFeed(ev as EvidenceRow[]);
      if (ms.length > 0 && !selectedMilestoneId) {
        setSelectedMilestoneId(asString((ms[0] as MilestoneRow).id) ?? "");
      }
    } catch { /* keep empty */ }
    setLoadingEvidence(false);
  }, [selectedMilestoneId]);

  useEffect(() => {
    if (selectedJobId) void loadMilestonesAndEvidence(selectedJobId);
  }, [selectedJobId]);

  function handleFiles(incoming: File[]) {
    if (incoming.length === 0) return;
    setFiles(incoming);
    if (incoming.length === 1) setKind(mimeToKind(incoming[0].type));
    setUploadNote(null);
  }

  async function handleUpload() {
    if (!selectedJobId || files.length === 0 || uploading) return;
    setUploading(true);
    setUploadNote(null);
    try {
      for (const file of files) {
        const fileKind = files.length === 1 ? kind : mimeToKind(file.type);
        const contentType = file.type || "application/octet-stream";

        const plan = await planUpload({ domain: "evidence", filename: file.name, contentType, fileSizeBytes: file.size, source: "local_device" });
        const strategy = asString(plan.recommendedStrategy) ?? "single_put";
        let bucketKey = `jobs/${selectedJobId}/evidence/${Date.now()}_${file.name}`;

        if (strategy === "multipart") {
          const session = await createMultipartUploadSession({
            domain: "evidence", filename: file.name, contentType, fileSizeBytes: file.size, source: "local_device",
          });
          const sessionId = asString(session.sessionId) ?? "";
          const rawParts = Array.isArray(session.parts) ? session.parts as Record<string, unknown>[] : [];
          const completedParts: { partNumber: number; etag: string }[] = [];
          for (const part of rawParts.slice(0, 10)) {
            const partNumber = typeof part.partNumber === "number" ? part.partNumber : 1;
            const result = await uploadMultipartPart({ sessionId, partNumber, contentLength: file.size });
            const etag = asString(result.etag) ?? String(partNumber);
            completedParts.push({ partNumber, etag });
          }
          const completed = await completeMultipartUploadSession({ sessionId, parts: completedParts });
          bucketKey = asString(completed.key) ?? asString(completed.bucketKey) ?? bucketKey;
        }

        await registerJobEvidence(selectedJobId, {
          key: bucketKey,
          kind: fileKind,
          ...(selectedMilestoneId ? { milestoneId: selectedMilestoneId } : {}),
        });
      }

      const jobTitle = jobs.find(j => j.id === selectedJobId)?.title ?? "trabajo";
      sendNotification({
        title: "Evidencia registrada",
        body: `${files.length} archivo${files.length > 1 ? "s" : ""} registrado${files.length > 1 ? "s" : ""} en "${jobTitle}".`,
        kind: "approval",
        targetRole: "client",
        linkHref: `/client/jobs/${selectedJobId}`,
      }).catch(() => {});

      setUploadNote({ msg: `${files.length} archivo${files.length > 1 ? "s" : ""} registrado${files.length > 1 ? "s" : ""} correctamente.`, ok: true });
      setFiles([]);
      await loadMilestonesAndEvidence(selectedJobId);
    } catch (err) {
      setUploadNote({ msg: err instanceof Error ? err.message : "No se pudo registrar la evidencia.", ok: false });
    }
    setUploading(false);
  }

  const card: React.CSSProperties = {
    background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "12px", padding: "18px",
  };

  const filteredFeed = selectedJobId
    ? evidenceFeed.filter(ev => !asString(ev.jobId) || asString(ev.jobId) === selectedJobId)
    : evidenceFeed;

  return (
    <div style={{ maxWidth: "800px", margin: "0 auto" }}>
      <HtmlInCanvasPanel as="section" style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: "24px" }} canvasClassName="rounded-2xl" minHeight={82}>
        <div>
          <Link href="/worker/dashboard" style={{ display: "inline-flex", alignItems: "center", gap: "5px", color: "var(--muted)", fontSize: "12px", fontWeight: 600, textDecoration: "none", marginBottom: "8px" }}>
            <span style={{ fontSize: "14px" }}>←</span> Dashboard
          </Link>
          <h1 style={{ fontSize: "22px", fontWeight: 800, color: "var(--ink)", marginBottom: "4px" }}>Evidencias</h1>
          <p style={{ fontSize: "13px", color: "var(--muted)" }}>Registra fotos y documentos para validar el avance de tus trabajos</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <NotificationBanner audience="worker" />
          <button onClick={() => selectedJobId && void loadMilestonesAndEvidence(selectedJobId)} disabled={loadingEvidence} style={{ padding: "8px", borderRadius: "8px", border: "1px solid var(--border)", background: "var(--surface)", color: "var(--muted)", cursor: "pointer", display: "flex" }}>
            <RefreshCw size={15} style={{ animation: loadingEvidence ? "spin 1s linear infinite" : "none" }} />
          </button>
        </div>
      </HtmlInCanvasPanel>

      {/* Coach signal */}
      <div style={{ marginBottom: "16px", borderRadius: "12px", border: "1px solid rgba(251,191,36,0.3)", background: "rgba(251,191,36,0.07)", padding: "12px 16px" }}>
        <strong style={{ fontSize: "12px", color: "#fbbf24", display: "block", marginBottom: "4px" }}>▶ Qué necesita el agente de evidencia</strong>
        <ul style={{ margin: 0, padding: "0 0 0 16px", fontSize: "12px", color: "var(--muted)", lineHeight: 1.7 }}>
          <li>Fotos del antes y después del trabajo</li>
          <li>Video corto mostrando el resultado final</li>
          <li>Documento o comprobante si aplica (factura, certificado, plano)</li>
        </ul>
        <p style={{ fontSize: "11px", color: "var(--muted)", marginTop: "6px" }}>
          Mínimo 1 foto obligatoria. El agente valida cobertura y calidad antes de permitir la aprobación del milestone.
        </p>
      </div>

      {/* Upload Zone */}
      <HtmlInCanvasPanel as="section" style={{ ...card, marginBottom: "20px" }} canvasClassName="rounded-2xl" minHeight={320}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "14px" }}>
          {/* Job selector */}
          <div>
            <label style={{ fontSize: "11px", fontWeight: 700, color: "var(--muted)", display: "block", marginBottom: "6px" }}>TRABAJO</label>
            <div style={{ position: "relative" }}>
              <select value={selectedJobId} onChange={e => { setSelectedJobId(e.target.value); setSelectedMilestoneId(""); }}
                style={{ width: "100%", padding: "10px 36px 10px 13px", borderRadius: "8px", border: "1px solid var(--border)", background: "var(--bg)", color: "var(--ink)", fontSize: "13px", appearance: "none", cursor: "pointer", outline: "none" }}
              >
                {loadingJobs ? <option value="">Cargando...</option> : jobs.length === 0 ? <option value="">Sin trabajos activos</option> : null}
                {jobs.map(j => <option key={j.id} value={j.id}>{j.title}</option>)}
              </select>
              <ChevronDown size={14} style={{ position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%)", color: "var(--muted)", pointerEvents: "none" }} />
            </div>
          </div>

          {/* Milestone selector */}
          <div>
            <label style={{ fontSize: "11px", fontWeight: 700, color: "var(--muted)", display: "block", marginBottom: "6px" }}>MILESTONE (opcional)</label>
            <div style={{ position: "relative" }}>
              <select value={selectedMilestoneId} onChange={e => setSelectedMilestoneId(e.target.value)}
                style={{ width: "100%", padding: "10px 36px 10px 13px", borderRadius: "8px", border: "1px solid var(--border)", background: "var(--bg)", color: "var(--ink)", fontSize: "13px", appearance: "none", cursor: "pointer", outline: "none" }}
              >
                <option value="">Sin milestone específico</option>
                {milestones.map((m, i) => (
                  <option key={asString(m.id) ?? i} value={asString(m.id) ?? ""}>
                    {asString(m.title) ?? `Milestone ${i + 1}`}{asString(m.status) ? ` · ${asString(m.status)}` : ""}
                  </option>
                ))}
              </select>
              <ChevronDown size={14} style={{ position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%)", color: "var(--muted)", pointerEvents: "none" }} />
            </div>
          </div>
        </div>

        {/* Kind selector */}
        <div style={{ display: "flex", gap: "6px", marginBottom: "14px" }}>
          {KIND_OPTIONS.map(opt => (
            <button key={opt.value} onClick={() => setKind(opt.value)}
              style={{ padding: "6px 14px", borderRadius: "8px", border: `1px solid ${kind === opt.value ? "var(--brand)" : "var(--border)"}`, background: kind === opt.value ? "var(--brand)14" : "transparent", color: kind === opt.value ? "var(--brand)" : "var(--muted)", fontSize: "12px", fontWeight: 700, cursor: "pointer" }}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Drop zone */}
        <label htmlFor="evidence-upload"
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={e => { e.preventDefault(); setDragOver(false); handleFiles(Array.from(e.dataTransfer.files)); }}
          style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "10px", padding: "36px 24px", borderRadius: "12px", cursor: "pointer", border: `2px dashed ${dragOver ? "var(--brand)" : "var(--border)"}`, background: dragOver ? "rgba(99,102,241,.06)" : "var(--bg)", transition: "all 0.15s" }}
        >
          <div style={{ width: "48px", height: "48px", borderRadius: "14px", background: "rgba(99,102,241,.12)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Upload size={22} color="var(--brand)" />
          </div>
          <div style={{ textAlign: "center" }}>
            <p style={{ fontSize: "14px", fontWeight: 700, color: "var(--ink)" }}>Arrastra archivos aquí</p>
            <p style={{ fontSize: "12px", color: "var(--muted)", marginTop: "3px" }}>o haz clic para seleccionar · fotos, video, PDF, ZIP</p>
          </div>
          <div style={{ display: "flex", gap: "8px" }}>
            {[Camera, ImageIcon, FileText].map((Icon, i) => (
              <div key={i} style={{ padding: "5px 10px", borderRadius: "6px", background: "var(--surface)", border: "1px solid var(--border)", display: "flex", alignItems: "center", gap: "4px" }}>
                <Icon size={12} color="var(--muted)" />
                <span style={{ fontSize: "11px", color: "var(--muted)" }}>{i === 0 ? "Fotos" : i === 1 ? "Imágenes/Video" : "PDF/ZIP"}</span>
              </div>
            ))}
          </div>
        </label>
        <input id="evidence-upload" type="file" multiple accept="image/*,video/*,.pdf,.doc,.docx,.zip,.rar,.7z,.heic,.dwg,.xlsx" style={{ display: "none" }} onChange={e => handleFiles(e.target.files ? Array.from(e.target.files) : [])} />

        {files.length > 0 && (
          <div style={{ marginTop: "14px", display: "grid", gap: "10px" }}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
              {files.map((f, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: "6px", padding: "5px 10px", borderRadius: "7px", background: "var(--bg)", border: "1px solid var(--border)" }}>
                  <FileText size={12} color="var(--muted)" />
                  <span style={{ fontSize: "12px", color: "var(--ink)" }}>{f.name}</span>
                  <span style={{ fontSize: "11px", color: "var(--faint)" }}>({(f.size / 1024 / 1024).toFixed(1)} MB)</span>
                </div>
              ))}
            </div>
            <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
              <button onClick={() => void handleUpload()} disabled={uploading || !selectedJobId}
                style={{ display: "inline-flex", alignItems: "center", gap: "7px", padding: "10px 18px", borderRadius: "9px", border: "none", background: "var(--brand)", color: "#fff", fontSize: "13px", fontWeight: 700, cursor: uploading || !selectedJobId ? "not-allowed" : "pointer", opacity: uploading || !selectedJobId ? 0.7 : 1 }}
              >
                {uploading ? <RefreshCw size={14} style={{ animation: "spin 1s linear infinite" }} /> : <Upload size={14} />}
                {uploading ? "Registrando..." : `Registrar ${files.length} archivo${files.length > 1 ? "s" : ""}`}
              </button>
              <button onClick={() => setFiles([])} style={{ padding: "10px 14px", borderRadius: "9px", border: "1px solid var(--border)", background: "transparent", color: "var(--muted)", fontSize: "12px", cursor: "pointer" }}>
                Cancelar
              </button>
            </div>
          </div>
        )}

        {uploadNote && (
          <div style={{ marginTop: "10px", display: "flex", alignItems: "center", gap: "8px", padding: "10px 14px", borderRadius: "10px", border: `1px solid ${uploadNote.ok ? "rgba(16,185,129,.25)" : "rgba(239,68,68,.25)"}`, background: uploadNote.ok ? "rgba(16,185,129,.06)" : "rgba(239,68,68,.06)" }}>
            {uploadNote.ok ? <CheckCircle2 size={14} color="#10b981" /> : <AlertTriangle size={14} color="#ef4444" />}
            <span style={{ fontSize: "12px", color: uploadNote.ok ? "#10b981" : "#ef4444", fontWeight: 700 }}>{uploadNote.msg}</span>
          </div>
        )}
      </HtmlInCanvasPanel>

      {/* Evidence feed */}
      <HtmlInCanvasPanel as="section" canvasClassName="rounded-2xl" minHeight={200}>
        <h2 style={{ fontSize: "14px", fontWeight: 700, color: "var(--ink)", marginBottom: "12px" }}>
          Historial de evidencias {selectedJobId && `— ${jobs.find(j => j.id === selectedJobId)?.title ?? ""}`}
        </h2>
        {loadingEvidence ? (
          <div style={{ display: "grid", gap: "8px" }}>
            {[1,2,3].map(i => <div key={i} style={{ height: "64px", borderRadius: "10px", background: "var(--raised)", animation: "pulse 1.5s ease-in-out infinite" }} />)}
          </div>
        ) : filteredFeed.length === 0 ? (
          <div style={{ padding: "28px", textAlign: "center", fontSize: "13px", color: "var(--muted)", borderRadius: "10px", border: "1px dashed var(--border)" }}>
            No hay evidencias registradas para este trabajo todavía.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {filteredFeed
              .slice()
              .sort((a, b) => new Date(asString(b.createdAt) ?? 0).getTime() - new Date(asString(a.createdAt) ?? 0).getTime())
              .map((ev, idx) => {
                const s = evidenceStatus(ev);
                const isImage = asString(ev.kind) === "PHOTO" || asString(ev.mimeType)?.startsWith("image");
                const name = asString(ev.filename) ?? asString(ev.originalFilename) ?? asString(ev.key) ?? `Evidencia ${idx + 1}`;
                const msTitle = milestones.find(m => asString(m.id) === asString(ev.milestoneId))
                  ? asString((milestones.find(m => asString(m.id) === asString(ev.milestoneId)) as MilestoneRow).title) : undefined;
                const previewUrl = asString(ev.previewUrl) ?? asString(ev.url) ?? asString(ev.signedUrl);
                return (
                  <div key={asString(ev.id) ?? idx} style={{ ...card, display: "flex", alignItems: "center", gap: "14px", padding: "12px 16px" }}>
                    <div style={{ width: "38px", height: "38px", borderRadius: "10px", flexShrink: 0, background: isImage ? "rgba(59,130,246,.12)" : "rgba(139,92,246,.12)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      {isImage ? <ImageIcon size={17} color="#3b82f6" /> : <FileText size={17} color="#8b5cf6" />}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: "13px", fontWeight: 600, color: "var(--ink)", marginBottom: "2px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</p>
                      <p style={{ fontSize: "11px", color: "var(--muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {msTitle ? `${msTitle} · ` : ""}{asString(ev.kind) ?? "—"}
                      </p>
                      <p style={{ fontSize: "11px", color: "var(--faint)", display: "flex", alignItems: "center", gap: "4px", marginTop: "2px" }}>
                        <Clock size={10} /> {formatDate(ev.createdAt ?? ev.capturedAt)}
                      </p>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "6px", flexShrink: 0 }}>
                      <StatusBadge variant={s.variant} text={s.label} size="sm" />
                      {previewUrl && (
                        <Link href={previewUrl} target="_blank" rel="noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: "4px", fontSize: "11px", fontWeight: 700, color: "var(--muted)", textDecoration: "none" }}>
                          <Eye size={11} /> Ver
                        </Link>
                      )}
                    </div>
                  </div>
                );
              })}
          </div>
        )}
      </HtmlInCanvasPanel>
    </div>
  );
}
