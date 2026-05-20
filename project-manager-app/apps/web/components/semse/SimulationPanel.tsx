"use client";
import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle, CheckCircle2, ChevronDown, ChevronUp, Code2,
  FileCode2, GitPullRequest, Lock, RefreshCw, Shield, Zap,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

type SimPatch = {
  id: string;
  recommendation: { type: string; area: string; action: string; maturityGain: number };
  patch: {
    filesToCreate: string[];
    filesToModify: string[];
    safeToApply: boolean;
    testCommand: string;
    estimatedLines: number;
  };
  impactAnalysis: {
    status: "safe" | "review" | "risky";
    breakingRisk: string;
    rollbackable: boolean;
    notes: string[];
  };
  previewDiff: string;
  autonomyNote: string;
};

type SimReport = {
  patchCount: number;
  safePatchCount: number;
  patches: SimPatch[];
  autonomyLevel: number;
  autonomyPolicy: string;
  guardrails: string[];
};

type ApplyResult = {
  applied: boolean;
  filesCreated: string[];
  filesSkipped: string[];
  reason?: string;
  content: Record<string, string>;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function statusColor(s: SimPatch["impactAnalysis"]["status"]) {
  return s === "safe" ? "#86efac" : s === "review" ? "#fcd34d" : "#fca5a5";
}

// ── PatchCard ─────────────────────────────────────────────────────────────────

function PatchCard({ patch, onApply }: { patch: SimPatch; onApply: (id: string) => Promise<void> }) {
  const [open, setOpen]         = useState(false);
  const [applying, setApplying] = useState(false);
  const [result, setResult]     = useState<ApplyResult | null>(null);
  const [error, setError]       = useState<string | null>(null);
  const isSafe = patch.patch.safeToApply;

  const handleApply = async () => {
    if (!isSafe) return;
    const confirmed = window.confirm(
      `¿Confirmas aplicar el patch?\n\n` +
      `Área: ${patch.recommendation.area}\n` +
      `Acción: ${patch.recommendation.action}\n` +
      `Archivos a crear: ${patch.patch.filesToCreate.join(", ")}\n\n` +
      `El patch se escribirá en el disco local. Esta acción se registrará en el AuditLog.`
    );
    if (!confirmed) return;

    setApplying(true); setError(null);
    try {
      await onApply(patch.id);
      const res = await fetch("/api/semse/ops/apply", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ recId: patch.id, confirmed: true }),
      });
      const json = await res.json() as { data: ApplyResult };
      setResult(json.data ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al aplicar");
    } finally {
      setApplying(false);
    }
  };

  return (
    <div style={{ borderRadius: 12, border: `1px solid ${statusColor(patch.impactAnalysis.status)}30`, overflow: "hidden", background: "rgba(255,255,255,.02)" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 16px" }}>
        <Shield size={13} color={statusColor(patch.impactAnalysis.status)} />
        <span style={{ fontSize: 10, fontWeight: 800, color: statusColor(patch.impactAnalysis.status), background: `${statusColor(patch.impactAnalysis.status)}15`, padding: "2px 8px", borderRadius: 99 }}>
          {patch.impactAnalysis.status.toUpperCase()}
        </span>
        <span style={{ fontSize: 12, fontWeight: 700, color: "var(--ink)", flex: 1 }}>{patch.recommendation.area}</span>
        <span style={{ fontSize: 11, color: "#86efac", fontWeight: 700 }}>+{patch.recommendation.maturityGain}</span>
        <span style={{ fontSize: 10, color: "var(--muted)", fontFamily: "monospace" }}>
          {patch.patch.filesToCreate.length} archivo(s)
        </span>

        {/* Apply button */}
        {!result && (
          <button
            onClick={handleApply}
            disabled={!isSafe || applying}
            title={!isSafe ? patch.autonomyNote : "Aprobar y aplicar este patch"}
            style={{
              display: "flex", alignItems: "center", gap: 5,
              padding: "6px 12px", borderRadius: 8, fontSize: 11, fontWeight: 700,
              border: "none", cursor: isSafe ? "pointer" : "not-allowed",
              background: isSafe ? "rgba(134,239,172,.15)" : "rgba(255,255,255,.05)",
              color: isSafe ? "#86efac" : "#475569",
              opacity: applying ? 0.6 : 1,
            }}>
            {applying ? <RefreshCw size={11} style={{ animation: "spin 1s linear infinite" }} /> : isSafe ? <CheckCircle2 size={11} /> : <Lock size={11} />}
            {applying ? "Aplicando…" : isSafe ? "Aplicar" : "No seguro"}
          </button>
        )}

        <button onClick={() => setOpen((p) => !p)}
          style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted)" }}>
          {open ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
        </button>
      </div>

      {/* Result banner */}
      {result && (
        <div style={{ margin: "0 16px 12px", padding: "10px 14px", background: result.applied ? "rgba(134,239,172,.1)" : "rgba(234,179,8,.1)", borderRadius: 10, border: `1px solid ${result.applied ? "rgba(134,239,172,.3)" : "rgba(234,179,8,.3)"}` }}>
          {result.applied ? (
            <>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#86efac" }}>✅ Patch aplicado</div>
              <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 4 }}>
                {result.filesCreated.join(", ")}
              </div>
              {result.filesSkipped.length > 0 && (
                <div style={{ fontSize: 10, color: "#fcd34d", marginTop: 2 }}>Omitidos: {result.filesSkipped.join(", ")}</div>
              )}
            </>
          ) : (
            <>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#fcd34d" }}>⚠ No aplicado</div>
              <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 4 }}>{result.reason}</div>
            </>
          )}
        </div>
      )}

      {error && (
        <div style={{ margin: "0 16px 12px", padding: "8px 12px", background: "rgba(239,68,68,.1)", borderRadius: 8, fontSize: 11, color: "#fca5a5" }}>{error}</div>
      )}

      {/* Expanded */}
      {open && (
        <div style={{ padding: "0 16px 14px", display: "grid", gap: 10 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div>
              <div style={{ fontSize: 10, fontWeight: 800, color: "var(--muted)", marginBottom: 6 }}>ARCHIVOS A CREAR</div>
              {patch.patch.filesToCreate.map((f) => (
                <div key={f} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "#86efac", padding: "3px 0" }}>
                  <FileCode2 size={10} /> {f}
                </div>
              ))}
              {patch.patch.filesToModify.length > 0 && (
                <>
                  <div style={{ fontSize: 10, fontWeight: 800, color: "var(--muted)", margin: "8px 0 4px" }}>ARCHIVOS A MODIFICAR</div>
                  {patch.patch.filesToModify.map((f) => (
                    <div key={f} style={{ fontSize: 11, color: "#fcd34d", padding: "2px 0" }}>~ {f}</div>
                  ))}
                </>
              )}
            </div>
            <div>
              <div style={{ fontSize: 10, fontWeight: 800, color: "var(--muted)", marginBottom: 6 }}>ANÁLISIS DE IMPACTO</div>
              {patch.impactAnalysis.notes.map((n, i) => (
                <div key={i} style={{ fontSize: 11, color: "var(--muted)", padding: "2px 0" }}>• {n}</div>
              ))}
              <div style={{ marginTop: 6, fontSize: 10, color: "#94a3b8" }}>
                breakingRisk: {patch.impactAnalysis.breakingRisk} · rollbackable: {String(patch.impactAnalysis.rollbackable)}
              </div>
            </div>
          </div>

          {/* Diff preview */}
          <div style={{ background: "rgba(0,0,0,.3)", borderRadius: 10, padding: "10px 14px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
              <Code2 size={11} color="#818cf8" />
              <span style={{ fontSize: 10, fontWeight: 800, color: "#818cf8" }}>PREVIEW DIFF</span>
            </div>
            <pre style={{ fontSize: 10, color: "#86efac", margin: 0, whiteSpace: "pre-wrap", fontFamily: "monospace", maxHeight: 180, overflow: "auto" }}>
              {patch.previewDiff}
            </pre>
          </div>

          {/* Test command */}
          {patch.patch.testCommand !== "— acción operacional, no código" && (
            <div style={{ fontSize: 10, color: "var(--muted)", padding: "6px 10px", background: "rgba(255,255,255,.03)", borderRadius: 8, fontFamily: "monospace" }}>
              $ {patch.patch.testCommand}
            </div>
          )}

          <div style={{ fontSize: 10, color: "rgba(148,163,184,.5)", fontStyle: "italic" }}>{patch.autonomyNote}</div>
        </div>
      )}
    </div>
  );
}

// ── Main panel ────────────────────────────────────────────────────────────────

export function SimulationPanel() {
  const [report,  setReport]  = useState<SimReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);
  const [lastAt,  setLastAt]  = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await fetch("/api/semse/ops/simulation?limit=6");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json() as { data: SimReport };
      setReport(json.data ?? null);
      setLastAt(new Date().toLocaleTimeString("es-MX"));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const noop = async (_id: string) => {};

  return (
    <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 16, padding: 20 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
        <div style={{ width: 38, height: 38, borderRadius: 12, background: "rgba(99,102,241,.15)", display: "grid", placeItems: "center", flexShrink: 0 }}>
          <Zap size={18} color="#818cf8" />
        </div>
        <div style={{ flex: 1 }}>
          <h2 style={{ margin: 0, fontSize: 15, fontWeight: 800 }}>Simulation Engine</h2>
          <p style={{ margin: 0, fontSize: 11, color: "var(--muted)" }}>
            Autonomy Level 3→4 · patches safe/unsafe · {lastAt ?? "cargando…"}
          </p>
        </div>
        <button onClick={load} disabled={loading}
          style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 14px", borderRadius: 10, background: "rgba(99,102,241,.15)", border: "none", cursor: "pointer", fontSize: 12, color: "#818cf8", fontWeight: 700 }}>
          <RefreshCw size={12} style={{ animation: loading ? "spin 1s linear infinite" : "none" }} />
          Simular
        </button>
      </div>

      {error && (
        <div style={{ padding: "10px 14px", background: "rgba(239,68,68,.1)", borderRadius: 10, fontSize: 12, color: "#fca5a5", marginBottom: 14 }}>{error}</div>
      )}

      {report && (
        <div style={{ display: "grid", gap: 16 }}>
          {/* Summary */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
            {[
              { label: "Patches totales", value: report.patchCount,     color: "#818cf8" },
              { label: "Safe to apply",   value: report.safePatchCount,  color: "#86efac" },
              { label: "Autonomy level",  value: `Level ${report.autonomyLevel}`, color: "#67e8f9" },
            ].map(({ label, value, color }) => (
              <div key={label} style={{ padding: "10px 14px", background: "rgba(255,255,255,.03)", borderRadius: 10, border: "1px solid var(--border)" }}>
                <div style={{ fontSize: 9, color: "var(--muted)", fontWeight: 700, marginBottom: 4 }}>{label}</div>
                <div style={{ fontSize: 18, fontWeight: 900, color }}>{value}</div>
              </div>
            ))}
          </div>

          {/* Policy banner */}
          <div style={{ padding: "8px 14px", background: "rgba(99,102,241,.06)", border: "1px solid rgba(99,102,241,.2)", borderRadius: 10, display: "flex", alignItems: "center", gap: 8 }}>
            <AlertTriangle size={11} color="#818cf8" />
            <span style={{ fontSize: 11, color: "#818cf8" }}>{report.autonomyPolicy}</span>
          </div>

          {/* Patches */}
          <div style={{ display: "grid", gap: 8 }}>
            {report.patches.map((p) => (
              <PatchCard key={p.id} patch={p} onApply={noop} />
            ))}
          </div>

          {/* Guardrails */}
          <details style={{ marginTop: 4 }}>
            <summary style={{ fontSize: 11, color: "var(--muted)", cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
              <Lock size={10} /> Guardrails de seguridad ({report.guardrails.length})
            </summary>
            <div style={{ marginTop: 8, display: "grid", gap: 4 }}>
              {report.guardrails.map((g, i) => (
                <div key={i} style={{ fontSize: 10, color: "#94a3b8", padding: "3px 0" }}>🔒 {g}</div>
              ))}
            </div>
          </details>
        </div>
      )}

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
