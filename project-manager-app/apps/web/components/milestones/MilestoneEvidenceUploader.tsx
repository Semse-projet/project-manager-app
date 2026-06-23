"use client";

/**
 * MilestoneEvidenceUploader
 *
 * Muestra los evidence items de un milestone y permite:
 * - subir archivo para items missing/rejected
 * - correr Evidence Review Agent después del upload
 * - refrescar el MilestoneGovernancePanel automáticamente
 *
 * Flujo:
 *   POST /api/semse/evidence/presign → uploadUrl + key
 *   PUT file to storage (via proxy)
 *   POST /api/semse/evidence { key, kind, milestoneId } → evidenceId
 *   PATCH /api/semse/milestones/[id]/evidence-items/[itemId] { status: "submitted", evidenceId }
 *   POST /api/semse/milestones/[id]/evidence-items/[itemId]/review (optional)
 *   onUploaded() → caller refreshes governance panel
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, Camera, CheckCircle, ChevronDown, ChevronUp, Clock, FileText, HardHat, RefreshCw, ShieldCheck, Upload, XCircle } from "lucide-react";
import { EvidenceItemDetailPanel } from "./EvidenceItemDetailPanel";
import { safetyCheckEnriched } from "../../app/semse-api";

// ── Types ─────────────────────────────────────────────────────────────────────

type ItemStatus = "missing" | "submitted" | "approved" | "rejected";
type ItemKind   = "PHOTO" | "VIDEO" | "DOCUMENT";

type EvidenceItem = {
  id:          string;
  label:       string;
  description?: string | null;
  kind:        ItemKind;
  phase:       string;
  required:    boolean;
  status:      ItemStatus;
  reviewNote?: string | null;
};

type UploadState = "idle" | "presigning" | "uploading" | "registering" | "linking" | "reviewing" | "done" | "error";

type SafetyResult = {
  helmetDetected: boolean;
  vestDetected: boolean;
  harnessDetected: boolean;
  complianceScore: number;
  violations: string[];
  insight?: string | null;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function kindFromFile(file: File): ItemKind {
  if (file.type.startsWith("image/")) return "PHOTO";
  if (file.type.startsWith("video/")) return "VIDEO";
  return "DOCUMENT";
}

function statusColor(s: ItemStatus): string {
  if (s === "approved")  return "#86efac";
  if (s === "submitted") return "#fbbf24";
  if (s === "rejected")  return "#f87171";
  return "var(--muted)"; // missing
}

function statusLabel(s: ItemStatus): string {
  if (s === "approved")  return "Aprobada";
  if (s === "submitted") return "En revisión";
  if (s === "rejected")  return "Rechazada";
  return "Faltante";
}

function StatusIcon({ status }: { status: ItemStatus }) {
  if (status === "approved")  return <CheckCircle size={13} color="#86efac" />;
  if (status === "submitted") return <Clock size={13} color="#fbbf24" />;
  if (status === "rejected")  return <XCircle size={13} color="#f87171" />;
  return <Camera size={13} color="var(--muted)" />;
}

// ── Upload logic ──────────────────────────────────────────────────────────────

async function uploadEvidenceForItem(
  file: File,
  milestoneId: string,
  itemId: string,
  runReview: boolean,
): Promise<{ ok: boolean; error?: string; reviewFindings?: string; uploadedKey?: string }> {
  try {
    // 1. Presign
    const presignRes = await fetch("/api/semse/evidence/presign", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ filename: file.name, contentType: file.type, fileSizeBytes: file.size, source: "local_device" }),
    });
    const presignJson = await presignRes.json() as { data?: { uploadUrl?: string; key?: string } };
    const uploadUrl = presignJson.data?.uploadUrl;
    const key = presignJson.data?.key;
    if (!uploadUrl || !key) return { ok: false, error: "No se obtuvo URL de upload" };

    // 2. Upload file to storage via proxy
    const proxyUrl = `/api/semse/uploads/files/${encodeURIComponent(key)}`;
    const putRes = await fetch(proxyUrl, {
      method: "PUT",
      headers: { "content-type": file.type, "content-length": String(file.size) },
      body: file,
    });
    if (!putRes.ok) return { ok: false, error: `Error al subir archivo (${putRes.status})` };

    // 3. Register evidence record
    const kind = kindFromFile(file);
    const regRes = await fetch("/api/semse/evidence", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ key, kind, milestoneId }),
    });
    const regJson = await regRes.json() as { data?: { id?: string } };
    const evidenceId = regJson.data?.id;
    if (!evidenceId) return { ok: false, error: "No se registró la evidencia correctamente" };

    // 4. Link evidence to the specific item → mark as submitted
    const patchRes = await fetch(`/api/semse/milestones/${milestoneId}/evidence-items/${itemId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status: "submitted", evidenceId }),
    });
    if (!patchRes.ok) return { ok: false, error: "No se pudo vincular la evidencia al item" };

    // 5. Optionally run evidence review agent
    if (runReview) {
      try {
        const reviewRes = await fetch(`/api/semse/milestones/${milestoneId}/evidence-items/${itemId}/review`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ locale: "es" }),
        });
        const reviewJson = await reviewRes.json() as { data?: { reviewStatus?: string; confidence?: number } };
        const findings = reviewJson.data?.reviewStatus;
        return { ok: true, reviewFindings: findings, uploadedKey: key };
      } catch {
        return { ok: true, uploadedKey: key }; // review failed silently, upload still OK
      }
    }

    return { ok: true, uploadedKey: key };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Error desconocido" };
  }
}

// ── Main component ─────────────────────────────────────────────────────────────

interface Props {
  milestoneId:  string;
  onUploaded?:  () => void;  // called after successful upload → parent refreshes governance
  showAll?:     boolean;     // show approved items too (default: show all)
  maxItems?:    number;
}

export function MilestoneEvidenceUploader({ milestoneId, onUploaded, showAll = false, maxItems = 10 }: Props) {
  const [items, setItems] = useState<EvidenceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploadStates, setUploadStates] = useState<Record<string, UploadState>>({});
  const [uploadErrors, setUploadErrors] = useState<Record<string, string>>({});
  const [reviewFindings, setReviewFindings] = useState<Record<string, string>>({});
  const [expandedDetail, setExpandedDetail] = useState<Record<string, boolean>>({});
  const [safetyResults, setSafetyResults] = useState<Record<string, SafetyResult | "scanning" | "error">>({});
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/semse/milestones/${milestoneId}/evidence-items`);
      const json = await res.json() as { data?: EvidenceItem[] };
      if (!res.ok) throw new Error("No se pudieron cargar los items de evidencia");
      setItems(json.data ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar evidencia");
    } finally {
      setLoading(false);
    }
  }, [milestoneId]);

  useEffect(() => { void load(); }, [load]);

  const handleFileSelect = useCallback(async (item: EvidenceItem, file: File) => {
    setUploadStates((s) => ({ ...s, [item.id]: "presigning" }));
    setUploadErrors((e) => { const n = { ...e }; delete n[item.id]; return n; });

    const result = await uploadEvidenceForItem(file, milestoneId, item.id, true);

    if (result.ok) {
      setUploadStates((s) => ({ ...s, [item.id]: "done" }));
      if (result.reviewFindings) {
        setReviewFindings((r) => ({ ...r, [item.id]: result.reviewFindings! }));
      }
      // Auto safety check for photos
      if (item.kind === "PHOTO" && result.uploadedKey) {
        const imageUrl = (typeof window !== "undefined" ? window.location.origin : "") +
          `/api/semse/uploads/files/${encodeURIComponent(result.uploadedKey)}`;
        setSafetyResults((s) => ({ ...s, [item.id]: "scanning" }));
        safetyCheckEnriched(imageUrl).then((r) => {
          setSafetyResults((s) => ({ ...s, [item.id]: r as SafetyResult }));
        }).catch(() => {
          setSafetyResults((s) => ({ ...s, [item.id]: "error" as const }));
        });
      }
      // Reload items + notify parent
      await load();
      onUploaded?.();
    } else {
      setUploadStates((s) => ({ ...s, [item.id]: "error" }));
      setUploadErrors((e) => ({ ...e, [item.id]: result.error ?? "Error al subir" }));
    }
  }, [milestoneId, load, onUploaded]);

  const uploadLabels: Record<UploadState, string> = {
    idle:       "Subir",
    presigning: "Preparando...",
    uploading:  "Subiendo archivo...",
    registering:"Registrando...",
    linking:    "Vinculando...",
    reviewing:  "Revisando con IA...",
    done:       "Subido",
    error:      "Error",
  };

  if (loading) {
    return (
      <div style={{ padding: 14, borderRadius: 12, background: "var(--surface)", border: "1px solid var(--border)", fontSize: 12, color: "var(--muted)" }}>
        Cargando evidencia...
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: 12, borderRadius: 12, background: "rgba(239,68,68,.06)", border: "1px solid rgba(239,68,68,.2)", color: "#fca5a5", fontSize: 12 }}>
        {error}
      </div>
    );
  }

  const displayItems = showAll
    ? items.slice(0, maxItems)
    : items.filter((i) => i.status !== "approved").slice(0, maxItems);

  if (displayItems.length === 0 && !showAll) {
    const approvedCount = items.filter((i) => i.status === "approved").length;
    return (
      <div style={{ padding: 12, borderRadius: 12, background: "rgba(134,239,172,.06)", border: "1px solid rgba(134,239,172,.2)", fontSize: 12, color: "#86efac", display: "flex", alignItems: "center", gap: 8 }}>
        <CheckCircle size={13} />
        {approvedCount > 0 ? `Toda la evidencia requerida fue aprobada (${approvedCount} items)` : "Sin evidencia requerida pendiente"}
      </div>
    );
  }

  return (
    <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: 14, display: "grid", gap: 10 }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Upload size={14} color="var(--muted)" />
          <span style={{ fontSize: 12, fontWeight: 800, color: "var(--ink)" }}>Evidencia requerida</span>
        </div>
        <button type="button" onClick={() => void load()} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted)" }}>
          <RefreshCw size={12} />
        </button>
      </div>

      {/* Items */}
      {displayItems.map((item) => {
        const state = uploadStates[item.id] ?? "idle";
        const canUpload = item.status === "missing" || item.status === "rejected";
        const isBusy = state !== "idle" && state !== "done" && state !== "error";
        const err = uploadErrors[item.id];
        const finding = reviewFindings[item.id];

        return (
          <div
            key={item.id}
            style={{
              padding: "10px 12px",
              borderRadius: 10,
              background: "rgba(255,255,255,.03)",
              border: `1px solid ${statusColor(item.status)}33`,
              display: "grid",
              gap: 6,
            }}
          >
            {/* Item header */}
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <StatusIcon status={item.status} />
              <span style={{ fontSize: 12, fontWeight: 700, color: "var(--ink)", flex: 1 }}>{item.label}</span>
              <span style={{ fontSize: 10, fontWeight: 800, color: statusColor(item.status), textTransform: "uppercase" }}>
                {statusLabel(item.status)}
              </span>
              {item.required && (
                <span style={{ fontSize: 9, color: "var(--muted)", border: "1px solid var(--border)", borderRadius: 4, padding: "1px 4px" }}>
                  requerido
                </span>
              )}
            </div>

            {/* Description */}
            {item.description && (
              <div style={{ fontSize: 11, color: "var(--muted)", paddingLeft: 21 }}>
                {item.description}
              </div>
            )}

            {/* Kind indicator */}
            <div style={{ paddingLeft: 21, display: "flex", alignItems: "center", gap: 6, fontSize: 10, color: "var(--muted)" }}>
              {item.kind === "PHOTO" ? <Camera size={11} /> : item.kind === "VIDEO" ? <Camera size={11} /> : <FileText size={11} />}
              {item.kind.toLowerCase()} · fase: {item.phase}
            </div>

            {/* Upload action */}
            {canUpload && (
              <div style={{ paddingLeft: 21, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <input
                  type="file"
                  ref={(el) => { fileInputRefs.current[item.id] = el; }}
                  accept={item.kind === "PHOTO" ? "image/*" : item.kind === "VIDEO" ? "video/*" : "*/*"}
                  style={{ display: "none" }}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void handleFileSelect(item, file);
                    if (e.target) e.target.value = "";
                  }}
                />
                <button
                  type="button"
                  disabled={isBusy}
                  onClick={() => fileInputRefs.current[item.id]?.click()}
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 6,
                    padding: "6px 12px", borderRadius: 8,
                    border: "1px solid rgba(99,102,241,.4)",
                    background: isBusy ? "rgba(99,102,241,.05)" : "rgba(99,102,241,.12)",
                    color: "#818cf8", fontSize: 11, fontWeight: 700,
                    cursor: isBusy ? "not-allowed" : "pointer",
                    opacity: isBusy ? 0.7 : 1,
                  }}
                >
                  {isBusy ? (
                    <RefreshCw size={11} style={{ animation: "spin 1s linear infinite" }} />
                  ) : (
                    <Upload size={11} />
                  )}
                  {uploadLabels[state]}
                </button>
                {state === "done" && !err && (
                  <span style={{ fontSize: 11, color: "#86efac", display: "flex", alignItems: "center", gap: 4 }}>
                    <CheckCircle size={11} />
                    Subido correctamente
                  </span>
                )}
              </div>
            )}

            {/* Error */}
            {err && (
              <div style={{ paddingLeft: 21, fontSize: 11, color: "#fca5a5" }}>
                ⚠ {err}
              </div>
            )}

            {/* Review finding */}
            {finding && (
              <div style={{ paddingLeft: 21, fontSize: 11, color: finding === "approved_suggestion" ? "#86efac" : "#fbbf24" }}>
                Revisión IA: {finding.replace(/_/g, " ")}
              </div>
            )}

            {/* Safety auto-check result */}
            {(() => {
              const safety = safetyResults[item.id];
              if (!safety) return null;
              if (safety === "scanning") {
                return (
                  <div style={{ paddingLeft: 21, display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "var(--muted)" }}>
                    <HardHat size={12} style={{ animation: "pulse 1.5s ease-in-out infinite" }} />
                    Verificando EPP...
                  </div>
                );
              }
              if (safety === "error") return null;
              const score = Math.round(safety.complianceScore * 100);
              const ok = score >= 70;
              return (
                <div style={{
                  marginLeft: 21,
                  padding: "6px 10px",
                  borderRadius: 8,
                  background: ok ? "rgba(134,239,172,.06)" : "rgba(251,191,36,.06)",
                  border: `1px solid ${ok ? "rgba(134,239,172,.2)" : "rgba(251,191,36,.2)"}`,
                  fontSize: 11,
                  display: "grid",
                  gap: 4,
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 700, color: ok ? "#86efac" : "#fbbf24" }}>
                    {ok ? <ShieldCheck size={12} /> : <AlertTriangle size={12} />}
                    EPP {score}% — {ok ? "Conforme" : "Revisar"}
                  </div>
                  {safety.violations.length > 0 && (
                    <div style={{ color: "#fca5a5", fontSize: 10 }}>
                      {safety.violations.join(" · ")}
                    </div>
                  )}
                  {safety.insight && (
                    <div style={{ color: "var(--muted)", fontSize: 10, fontStyle: "italic" }}>{safety.insight}</div>
                  )}
                </div>
              );
            })()}

            {/* Ver detalle / historial */}
            <div style={{ paddingLeft: 21 }}>
              <button
                type="button"
                onClick={() => setExpandedDetail((d) => ({ ...d, [item.id]: !d[item.id] }))}
                style={{ display: "flex", alignItems: "center", gap: 4, background: "none", border: "none", cursor: "pointer", color: "var(--muted)", fontSize: 10 }}
              >
                {expandedDetail[item.id] ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
                {expandedDetail[item.id] ? "Ocultar detalle" : "Ver detalle / historial"}
              </button>
            </div>
            {expandedDetail[item.id] && (
              <EvidenceItemDetailPanel
                milestoneId={milestoneId}
                itemId={item.id}
                onReplaced={() => { void load(); onUploaded?.(); }}
              />
            )}

            {/* Rejected review note */}
            {item.status === "rejected" && item.reviewNote && (
              <div style={{ fontSize: 11, color: "#fca5a5", borderLeft: "2px solid rgba(239,68,68,.3)", paddingLeft: 8, marginLeft: 13 }}>
                {(() => {
                  try { return JSON.parse(item.reviewNote).__agentReview?.auditReason ?? item.reviewNote; }
                  catch { return item.reviewNote; }
                })()}
              </div>
            )}
          </div>
        );
      })}

      {items.length > maxItems && (
        <div style={{ fontSize: 11, color: "var(--muted)", textAlign: "center" }}>
          +{items.length - maxItems} items más
        </div>
      )}
    </div>
  );
}
