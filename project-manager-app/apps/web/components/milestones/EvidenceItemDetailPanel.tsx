"use client";

/**
 * EvidenceItemDetailPanel
 *
 * Muestra detalle completo de un evidence item:
 * - preview de imagen (si es PHOTO y tiene bucketKey)
 * - metadata del archivo
 * - review IA + ops
 * - historial de reemplazos (desde AuditLog)
 * - botón reemplazar si status = rejected | needs_reupload
 *
 * No aprueba evidencia — solo muestra y permite reemplazo.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, CheckCircle, Clock, FileText, History, RefreshCw, Upload, XCircle, HardHat, ShieldCheck, AlertTriangle, Brain } from "lucide-react";
import { safetyCheckEnriched } from "../../app/semse-api";

// ── Types ─────────────────────────────────────────────────────────────────────

type EvidenceItemDetail = {
  id:          string;
  milestoneId: string;
  label:       string;
  description?: string | null;
  status:      string;
  required:    boolean;
  reviewNote?: string | null;
  reviewedAt?: string | null;
  reviewer?:   { id: string; email: string } | null;
  file?: {
    evidenceId:      string;
    bucketKey:       string;
    kind:            string;
    validationStatus?: string;
    aiQualityScore?: string | null;
    uploadedAt?:     string | null;
    uploadedBy?:     { id: string; email: string } | null;
  } | null;
};

type HistoryEntry = {
  id:          string;
  action:      string;
  beforeJson?: Record<string, unknown> | null;
  afterJson?:  Record<string, unknown> | null;
  occurredAt:  string;
  actor?:      { id: string; email: string } | null;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function statusColor(s: string): string {
  if (s === "approved")      return "#86efac";
  if (s === "submitted")     return "#fbbf24";
  if (s === "rejected")      return "#f87171";
  if (s === "needs_reupload") return "#fb923c";
  return "var(--muted)";
}

function statusLabel(s: string): string {
  const m: Record<string, string> = {
    approved:      "Aprobada",
    submitted:     "En revisión",
    rejected:      "Rechazada",
    needs_reupload: "Requiere nueva carga",
    missing:       "Faltante",
    archived:      "Archivada",
  };
  return m[s] ?? s;
}

function parseReviewNote(note: string | null | undefined): { agent?: Record<string, unknown>; admin?: Record<string, unknown> } {
  if (!note) return {};
  try {
    const p = JSON.parse(note);
    return { agent: p.__agentReview, admin: p.adminReview };
  } catch { return {}; }
}

// ── Safety widget ──────────────────────────────────────────────────────────────

type SafetyResult = {
  helmetDetected: boolean;
  vestDetected: boolean;
  harnessDetected: boolean;
  complianceScore: number;
  violations: string[];
  insight?: string;
};

function SafetyWidget({ imageUrl, trade }: { imageUrl: string; trade?: string }) {
  const [result, setResult] = useState<SafetyResult | null>(null);
  const [running, setRunning] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function run() {
    setRunning(true); setErr(null);
    try {
      const res = await safetyCheckEnriched(imageUrl, trade) as unknown as SafetyResult;
      setResult(res);
    } catch (e) {
      setErr("No se pudo ejecutar el análisis de seguridad.");
    } finally {
      setRunning(false);
    }
  }

  if (!result && !err) {
    return (
      <button
        type="button"
        onClick={run}
        disabled={running}
        style={{
          display: "flex", alignItems: "center", gap: 6, padding: "7px 12px",
          borderRadius: 7, border: "1px solid rgba(251,191,36,.3)", background: "rgba(251,191,36,.06)",
          color: "#fbbf24", fontSize: 11, fontWeight: 700, cursor: running ? "not-allowed" : "pointer",
        }}
      >
        <HardHat size={12} />
        {running ? "Verificando seguridad…" : "Verificar seguridad PPE (IA)"}
      </button>
    );
  }

  if (err) return (
    <div style={{ fontSize: 11, color: "#f87171", display: "flex", alignItems: "center", gap: 4 }}>
      <AlertTriangle size={11} /> {err}
    </div>
  );

  if (!result) return null;
  const pct = Math.round(result.complianceScore * 100);
  const color = pct >= 80 ? "#10b981" : pct >= 50 ? "#fbbf24" : "#ef4444";

  return (
    <div style={{ background: "rgba(251,191,36,.04)", border: "1px solid rgba(251,191,36,.2)", borderRadius: 10, padding: 10 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8, fontSize: 11, fontWeight: 800, color: "#fbbf24" }}>
        <HardHat size={13} /> Seguridad PPE
        <button
          type="button"
          onClick={run}
          disabled={running}
          style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", color: "#6b7280", fontSize: 10 }}
        >
          <RefreshCw size={10} />
        </button>
      </div>
      <div style={{ display: "flex", gap: 12, marginBottom: 6 }}>
        {[
          { label: "Casco", icon: <HardHat size={12} />, ok: result.helmetDetected },
          { label: "Chaleco", icon: <ShieldCheck size={12} />, ok: result.vestDetected },
          { label: "Arnés", icon: <CheckCircle size={12} />, ok: result.harnessDetected },
        ].map(({ label, icon, ok }) => (
          <div key={label} style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 11, color: ok ? "#10b981" : "#6b7280" }}>
            {icon} {label} {ok ? "✓" : "✗"}
          </div>
        ))}
        <span style={{ marginLeft: "auto", fontSize: 12, fontWeight: 800, color }}>
          {pct}%
        </span>
      </div>
      {result.violations.length > 0 && result.violations.map((v, i) => (
        <div key={i} style={{ fontSize: 10, color: "#f87171", display: "flex", alignItems: "center", gap: 3, marginBottom: 2 }}>
          <AlertTriangle size={9} /> {v}
        </div>
      ))}
      {result.insight && (
        <div style={{ marginTop: 8, borderTop: "1px solid rgba(255,255,255,.06)", paddingTop: 8 }}>
          <div style={{ fontSize: 10, color: "#60a5fa", display: "flex", alignItems: "center", gap: 4, marginBottom: 4 }}>
            <Brain size={10} /> Insight Ollama
          </div>
          <p style={{ margin: 0, fontSize: 11, color: "#94a3b8", lineHeight: 1.5 }}>{result.insight}</p>
        </div>
      )}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

interface Props {
  milestoneId: string;
  itemId:      string;
  onReplaced?: () => void;
}

export function EvidenceItemDetailPanel({ milestoneId, itemId, onReplaced }: Props) {
  const [detail, setDetail]   = useState<EvidenceItemDetail | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);

  // Replace state
  const [replacing, setReplacing] = useState(false);
  const [replaceError, setReplaceError] = useState<string | null>(null);
  const [replaceReason, setReplaceReason] = useState("");
  const [replaceSuccess, setReplaceSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [dRes, hRes] = await Promise.all([
        fetch(`/api/semse/milestones/${milestoneId}/evidence-items/${itemId}`),
        fetch(`/api/semse/milestones/${milestoneId}/evidence-items/${itemId}/history`),
      ]);
      const dJson = await dRes.json() as { data?: EvidenceItemDetail };
      const hJson = await hRes.json() as { data?: HistoryEntry[] };
      if (!dRes.ok) throw new Error("No se pudo cargar el detalle");
      setDetail(dJson.data ?? null);
      setHistory(hJson.data ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar evidencia");
    } finally {
      setLoading(false);
    }
  }, [milestoneId, itemId]);

  useEffect(() => { void load(); }, [load]);

  async function handleReplaceFile(file: File) {
    if (!replaceReason.trim()) {
      setReplaceError("La razón del reemplazo es obligatoria");
      return;
    }
    setReplacing(true);
    setReplaceError(null);
    try {
      // 1. Presign + upload
      const presignRes = await fetch("/api/semse/evidence/presign", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ filename: file.name, contentType: file.type, fileSizeBytes: file.size, source: "local_device" }),
      });
      const presignJson = await presignRes.json() as { data?: { uploadUrl?: string; key?: string } };
      const uploadUrl = presignJson.data?.uploadUrl;
      const key = presignJson.data?.key;
      if (!uploadUrl || !key) throw new Error("No se obtuvo URL de upload");

      // 2. Upload
      await fetch(`/api/semse/uploads/files/${encodeURIComponent(key)}`, {
        method: "PUT", headers: { "content-type": file.type }, body: file,
      });

      // 3. Register evidence
      const kind = file.type.startsWith("image/") ? "PHOTO" : file.type.startsWith("video/") ? "VIDEO" : "DOCUMENT";
      const regRes = await fetch("/api/semse/evidence", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ key, kind, milestoneId }),
      });
      const regJson = await regRes.json() as { data?: { id?: string } };
      const evidenceId = regJson.data?.id;
      if (!evidenceId) throw new Error("No se registró la evidencia");

      // 4. Replace link
      const replaceRes = await fetch(`/api/semse/milestones/${milestoneId}/evidence-items/${itemId}/replace`, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ evidenceId, replacedReason: replaceReason.trim() }),
      });
      if (!replaceRes.ok) {
        const j = await replaceRes.json() as { error?: { message?: string } };
        throw new Error(j?.error?.message ?? `Error ${replaceRes.status}`);
      }

      setReplaceSuccess(true);
      setReplaceReason("");
      await load();
      onReplaced?.();
    } catch (err) {
      setReplaceError(err instanceof Error ? err.message : "Error al reemplazar");
    } finally {
      setReplacing(false);
    }
  }

  if (loading) return <div style={{ padding: 12, fontSize: 12, color: "var(--muted)" }}>Cargando evidencia...</div>;
  if (error)   return <div style={{ padding: 12, fontSize: 12, color: "#fca5a5" }}>{error}</div>;
  if (!detail) return null;

  const reviewNote = parseReviewNote(detail.reviewNote);
  const canReplace = detail.status === "rejected" || detail.status === "needs_reupload";
  const isImage = detail.file?.kind === "PHOTO";
  const fileUrl = detail.file?.bucketKey
    ? `/api/semse/uploads/files/${encodeURIComponent(detail.file.bucketKey)}`
    : null;

  return (
    <div style={{ background: "var(--surface)", border: `1px solid ${statusColor(detail.status)}33`, borderRadius: 14, padding: 14, display: "grid", gap: 12 }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {detail.file?.kind === "PHOTO" ? <Camera size={14} color="var(--muted)" /> : <FileText size={14} color="var(--muted)" />}
          <span style={{ fontSize: 13, fontWeight: 800, color: "var(--ink)" }}>{detail.label}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 10, fontWeight: 800, color: statusColor(detail.status), textTransform: "uppercase" }}>
            {statusLabel(detail.status)}
          </span>
          <button type="button" onClick={() => void load()} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted)" }}>
            <RefreshCw size={11} />
          </button>
        </div>
      </div>

      {detail.description && (
        <div style={{ fontSize: 11, color: "var(--muted)" }}>{detail.description}</div>
      )}

      {/* File preview */}
      {fileUrl && (
        <div style={{ borderRadius: 10, overflow: "hidden", border: "1px solid var(--border)", background: "rgba(0,0,0,.2)" }}>
          {isImage ? (
            <img src={fileUrl} alt={detail.label} style={{ width: "100%", maxHeight: 200, objectFit: "cover", display: "block" }} />
          ) : (
            <a href={fileUrl} target="_blank" rel="noopener noreferrer"
              style={{ display: "flex", alignItems: "center", gap: 8, padding: "12px 14px", color: "#818cf8", textDecoration: "none", fontSize: 12 }}>
              <FileText size={14} />
              Ver archivo →
            </a>
          )}
        </div>
      )}

      {/* Safety check (photos only) */}
      {isImage && fileUrl && (
        <SafetyWidget imageUrl={typeof window !== "undefined" ? window.location.origin + fileUrl : fileUrl} trade={undefined} />
      )}

      {/* File metadata */}
      {detail.file && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, fontSize: 11, color: "var(--muted)" }}>
          {detail.file.uploadedBy && <span>Subido por: {detail.file.uploadedBy.email}</span>}
          {detail.file.uploadedAt && <span>{new Date(detail.file.uploadedAt).toLocaleDateString("es-MX")}</span>}
          {detail.file.aiQualityScore && <span>Calidad IA: {Math.round(Number(detail.file.aiQualityScore) * 100)}%</span>}
        </div>
      )}

      {/* AI review */}
      {reviewNote.agent && (
        <div style={{ background: "rgba(99,102,241,.06)", border: "1px solid rgba(99,102,241,.2)", borderRadius: 10, padding: 10, display: "grid", gap: 4, fontSize: 11 }}>
          <div style={{ fontWeight: 800, color: "#818cf8" }}>Revisión IA</div>
          {reviewNote.agent.reviewStatus != null && (
            <div>Estado: <span style={{ color: reviewNote.agent.reviewStatus === "approved_suggestion" ? "#86efac" : "#fbbf24" }}>
              {String(reviewNote.agent.reviewStatus).replace(/_/g, " ")}
            </span></div>
          )}
          {reviewNote.agent.auditReason != null && <div style={{ color: "var(--muted)", fontStyle: "italic" }}>{String(reviewNote.agent.auditReason)}</div>}
          {Boolean(reviewNote.agent.disputeRisk) && <div style={{ color: "#f87171" }}>⚠ Riesgo de disputa detectado</div>}
        </div>
      )}

      {/* Admin review */}
      {reviewNote.admin && (
        <div style={{ fontSize: 11, color: "var(--muted)", borderLeft: "2px solid var(--border)", paddingLeft: 8 }}>
          <strong>Revisión ops:</strong> {String(reviewNote.admin.status ?? "")} — {String(reviewNote.admin.reason ?? "")}
        </div>
      )}

      {/* Rejection reason from admin */}
      {detail.status === "rejected" && !reviewNote.admin && detail.reviewNote && (
        <div style={{ fontSize: 11, color: "#fca5a5", borderLeft: "2px solid rgba(239,68,68,.3)", paddingLeft: 8 }}>
          Rechazada: {detail.reviewNote.slice(0, 200)}
        </div>
      )}

      {/* Replace form */}
      {canReplace && (
        <div style={{ display: "grid", gap: 8, paddingTop: 4, borderTop: "1px solid var(--border)" }}>
          <div style={{ fontSize: 12, color: "#fb923c", fontWeight: 700 }}>Reemplazar evidencia</div>
          <textarea
            rows={2}
            value={replaceReason}
            onChange={(e) => setReplaceReason(e.target.value)}
            placeholder="Razón del reemplazo (obligatorio)"
            style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--ink)", fontSize: 11, resize: "none", outline: "none" }}
          />
          {replaceError && <div style={{ fontSize: 11, color: "#fca5a5" }}>{replaceError}</div>}
          {replaceSuccess && <div style={{ fontSize: 11, color: "#86efac", display: "flex", alignItems: "center", gap: 4 }}><CheckCircle size={11} />Reemplazada correctamente</div>}
          <input
            type="file" ref={fileInputRef}
            accept={detail.file?.kind === "VIDEO" ? "video/*" : detail.file?.kind === "DOCUMENT" ? "*/*" : "image/*"}
            style={{ display: "none" }}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void handleReplaceFile(f);
              if (e.target) e.target.value = "";
            }}
          />
          <button
            type="button"
            disabled={replacing}
            onClick={() => fileInputRef.current?.click()}
            style={{
              display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 14px",
              borderRadius: 8, border: "1px solid rgba(251,146,60,.4)", background: "rgba(251,146,60,.08)",
              color: "#fb923c", fontSize: 11, fontWeight: 700, cursor: replacing ? "not-allowed" : "pointer", opacity: replacing ? 0.7 : 1,
            }}
          >
            <Upload size={11} />
            {replacing ? "Reemplazando..." : "Seleccionar nuevo archivo"}
          </button>
        </div>
      )}

      {/* History */}
      <div style={{ paddingTop: 4, borderTop: "1px solid var(--border)" }}>
        <button
          type="button"
          onClick={() => setShowHistory((h) => !h)}
          style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", cursor: "pointer", color: "var(--muted)", fontSize: 11 }}
        >
          <History size={11} />
          {showHistory ? "Ocultar" : "Ver"} historial ({history.length} entradas)
        </button>
        {showHistory && history.length > 0 && (
          <div style={{ marginTop: 8, display: "grid", gap: 8 }}>
            {history.map((h) => (
              <div key={h.id} style={{ padding: "8px 10px", borderRadius: 8, background: "rgba(255,255,255,.02)", border: "1px solid var(--border)", fontSize: 11 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                  <span style={{ fontWeight: 700, color: "var(--ink)" }}>{h.action.replace(/_/g, " ")}</span>
                  <span style={{ color: "var(--muted)" }}>{new Date(h.occurredAt).toLocaleString("es-MX")}</span>
                </div>
                {h.actor && <div style={{ color: "var(--muted)" }}>Por: {h.actor.email}</div>}
                {(h.afterJson as Record<string, unknown> | null)?.replacedReason != null && (
                  <div style={{ color: "var(--muted)", fontStyle: "italic" }}>
                    Razón: {String((h.afterJson as Record<string, unknown>).replacedReason)}
                  </div>
                )}
                <div style={{ color: "var(--muted)" }}>
                  {String((h.beforeJson as Record<string, unknown> | null)?.status ?? "?")} → {String((h.afterJson as Record<string, unknown> | null)?.status ?? "?")}
                </div>
              </div>
            ))}
          </div>
        )}
        {showHistory && history.length === 0 && (
          <div style={{ marginTop: 6, fontSize: 11, color: "var(--muted)" }}>Sin historial de cambios todavía.</div>
        )}
      </div>
    </div>
  );
}
