"use client";
import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle, ChevronDown, ChevronUp, Code2, GitPullRequest,
  RefreshCw, Sparkles, Target, Zap,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

type EffortLevel = "low" | "medium" | "high";
type RecType = "add_tests" | "add_frontend" | "fix_risk" | "add_trade_docs" | "review_module" | "improve_observability" | "complete_feature" | "resolve_alert";

type Rec = {
  id: string;
  type: RecType;
  priority: number;
  area: string;
  action: string;
  rationale: string;
  estimatedImpact: string;
  maturityGain: number;
  effort: EffortLevel;
  draftPRTitle: string;
  draftPRScope: string[];
  autonomyNote: string;
};

type Report = {
  generatedAt: string;
  systemScore: number;
  totalActions: number;
  recommendations: Rec[];
  topPriority: Rec | null;
  autonomyLevel: number;
  autonomyPolicy: string;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const TYPE_LABELS: Record<RecType, string> = {
  add_tests:            "Tests",
  add_frontend:         "Frontend",
  fix_risk:             "Fix Risk",
  add_trade_docs:       "Docs",
  review_module:        "Review",
  improve_observability:"SSE/Obs",
  complete_feature:     "Feature",
  resolve_alert:        "Alert",
};

const TYPE_COLORS: Record<RecType, string> = {
  add_tests:            "#67e8f9",
  add_frontend:         "#a78bfa",
  fix_risk:             "#fca5a5",
  add_trade_docs:       "#86efac",
  review_module:        "#fcd34d",
  improve_observability:"#818cf8",
  complete_feature:     "#fb923c",
  resolve_alert:        "#f87171",
};

const EFFORT_COLORS: Record<EffortLevel, string> = {
  low:    "#86efac",
  medium: "#fcd34d",
  high:   "#fb923c",
};

function PriorityBadge({ n }: { n: number }) {
  const color = n <= 2 ? "#fca5a5" : n <= 4 ? "#fcd34d" : "#94a3b8";
  return (
    <span style={{ fontSize: 10, fontWeight: 900, color, background: `${color}20`, padding: "2px 7px", borderRadius: 99 }}>
      P{n}
    </span>
  );
}

function RecCard({ rec, rank }: { rec: Rec; rank: number }) {
  const [open, setOpen] = useState(rank < 2);
  const typeColor = TYPE_COLORS[rec.type];

  return (
    <div style={{ borderRadius: 12, border: "1px solid var(--border)", overflow: "hidden", background: "rgba(255,255,255,.02)" }}>

      {/* Header row */}
      <button onClick={() => setOpen((p) => !p)}
        style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", background: "none", border: "none", cursor: "pointer", textAlign: "left" }}>
        <PriorityBadge n={rec.priority} />
        <span style={{ fontSize: 10, fontWeight: 800, color: typeColor, background: `${typeColor}18`, padding: "2px 8px", borderRadius: 99, minWidth: 52, textAlign: "center" }}>
          {TYPE_LABELS[rec.type]}
        </span>
        <span style={{ fontSize: 12, fontWeight: 700, color: "var(--ink)", flex: 1 }}>{rec.area}</span>
        <span style={{ fontSize: 11, color: "var(--muted)", flex: 2 }}>{rec.action}</span>
        <span style={{ fontSize: 10, color: EFFORT_COLORS[rec.effort], fontWeight: 700 }}>{rec.effort}</span>
        <span style={{ fontSize: 11, color: "#86efac", fontWeight: 700, minWidth: 32 }}>+{rec.maturityGain}</span>
        {open ? <ChevronUp size={12} color="var(--muted)" /> : <ChevronDown size={12} color="var(--muted)" />}
      </button>

      {/* Expanded detail */}
      {open && (
        <div style={{ padding: "0 16px 14px", display: "grid", gap: 12 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div>
              <div style={{ fontSize: 10, fontWeight: 800, color: "var(--muted)", marginBottom: 4 }}>RAZÓN</div>
              <div style={{ fontSize: 11, color: "var(--ink)", lineHeight: 1.5 }}>{rec.rationale}</div>
            </div>
            <div>
              <div style={{ fontSize: 10, fontWeight: 800, color: "var(--muted)", marginBottom: 4 }}>IMPACTO</div>
              <div style={{ fontSize: 11, color: "#86efac", lineHeight: 1.5 }}>{rec.estimatedImpact}</div>
            </div>
          </div>

          {/* PR Draft */}
          <div style={{ background: "rgba(99,102,241,.06)", border: "1px solid rgba(99,102,241,.2)", borderRadius: 10, padding: "10px 14px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
              <GitPullRequest size={12} color="#818cf8" />
              <span style={{ fontSize: 10, fontWeight: 800, color: "#818cf8" }}>DRAFT PR</span>
            </div>
            <div style={{ fontSize: 12, fontWeight: 700, color: "var(--ink)", marginBottom: 8, fontFamily: "monospace" }}>
              {rec.draftPRTitle}
            </div>
            <div style={{ display: "grid", gap: 4 }}>
              {rec.draftPRScope.map((s, i) => (
                <div key={i} style={{ fontSize: 11, color: "var(--muted)", display: "flex", gap: 6 }}>
                  <span style={{ color: "#818cf8" }}>•</span> {s}
                </div>
              ))}
            </div>
          </div>

          <div style={{ fontSize: 10, color: "rgba(148,163,184,.6)", fontStyle: "italic" }}>{rec.autonomyNote}</div>
        </div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function RecommendationsPanel() {
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState<string | null>(null);
  const [lastAt, setLastAt] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await fetch("/api/semse/ops/recommendations");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json() as { data: Report };
      setReport(json.data);
      setLastAt(new Date().toLocaleTimeString("es-MX"));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  return (
    <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 16, padding: 20 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
        <div style={{ width: 38, height: 38, borderRadius: 12, background: "rgba(99,102,241,.15)", display: "grid", placeItems: "center", flexShrink: 0 }}>
          <Sparkles size={18} color="#818cf8" />
        </div>
        <div style={{ flex: 1 }}>
          <h2 style={{ margin: 0, fontSize: 15, fontWeight: 800 }}>Recommendation Engine</h2>
          <p style={{ margin: 0, fontSize: 11, color: "var(--muted)" }}>
            Autonomy Level 2 — propone, humano decide
            {lastAt && <> · {lastAt}</>}
          </p>
        </div>
        <button onClick={load} disabled={loading}
          style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 14px", borderRadius: 10, background: "rgba(99,102,241,.15)", border: "none", cursor: loading ? "wait" : "pointer", fontSize: 12, color: "#818cf8", fontWeight: 700 }}>
          <RefreshCw size={12} style={{ animation: loading ? "spin 1s linear infinite" : "none" }} />
          Generar
        </button>
      </div>

      {error && (
        <div style={{ padding: "10px 14px", background: "rgba(239,68,68,.1)", border: "1px solid rgba(239,68,68,.3)", borderRadius: 10, fontSize: 12, color: "#fca5a5", marginBottom: 14 }}>
          {error}
        </div>
      )}

      {report && (
        <div style={{ display: "grid", gap: 16 }}>
          {/* Summary bar */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
            {[
              { label: "Score sistema", value: `${report.systemScore}/100`, icon: Target, color: "#86efac" },
              { label: "Acciones",      value: String(report.totalActions),  icon: Zap,    color: "#818cf8" },
              { label: "Nivel",         value: `Autonomy ${report.autonomyLevel}`, icon: Code2,  color: "#67e8f9" },
              { label: "Top prioridad", value: report.topPriority?.area ?? "—", icon: AlertTriangle, color: "#fcd34d" },
            ].map(({ label, value, icon: Icon, color }) => (
              <div key={label} style={{ padding: "10px 14px", background: "rgba(255,255,255,.03)", borderRadius: 10, border: "1px solid var(--border)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                  <Icon size={11} color={color} />
                  <span style={{ fontSize: 9, color: "var(--muted)", fontWeight: 700 }}>{label}</span>
                </div>
                <div style={{ fontSize: 15, fontWeight: 800, color }}>{value}</div>
              </div>
            ))}
          </div>

          {/* Policy note */}
          <div style={{ padding: "8px 14px", background: "rgba(99,102,241,.06)", border: "1px solid rgba(99,102,241,.2)", borderRadius: 10, fontSize: 11, color: "#818cf8" }}>
            <Code2 size={10} style={{ verticalAlign: "middle", marginRight: 4 }} />
            {report.autonomyPolicy}
          </div>

          {/* Recommendations list */}
          <div style={{ display: "grid", gap: 8 }}>
            {report.recommendations.map((rec, i) => (
              <RecCard key={rec.id} rec={rec} rank={i} />
            ))}
          </div>

          {report.recommendations.length === 0 && (
            <div style={{ textAlign: "center", padding: "20px", fontSize: 13, color: "var(--muted)" }}>
              ✨ Sistema en estado óptimo — sin acciones prioritarias
            </div>
          )}
        </div>
      )}

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
