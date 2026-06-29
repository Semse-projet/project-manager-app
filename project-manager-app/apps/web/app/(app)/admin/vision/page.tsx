"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Eye, ShieldCheck, AlertTriangle, CheckCircle, XCircle,
  Activity, RefreshCw, MapPin, Layers, Camera, HardHat,
  Zap, TrendingUp, FlaskConical, Package, ScanSearch, UserCheck, Brain,
} from "lucide-react";
import { StatusBadge } from "@semse/ui";
import { fetchJobs, fetchVisionByJob, detectMaterial, classifySpace, analyzePortfolio, safetyCheckEnriched } from "../../../semse-api";
import { NotificationBanner } from "../../../components/notifications/NotificationBanner";

interface VisionAnalysis {
  id: string;
  evidenceId: string;
  status: string;
  qualityScore?: number;
  blurScore?: number;
  brightnessScore?: number;
  duplicateRisk?: number;
  riskLevel?: string;
  riskReasons?: string[];
  requiresHumanReview?: boolean;
  canAutoApprove?: boolean;
  recommendedAction?: string;
  rawResult?: Record<string, unknown>;
  createdAt?: string;
}

interface JobOption { id: string; title: string; status: string }

function score(v: unknown): number { return typeof v === "number" ? Math.round(v * 100) : 0; }
function pct(v: unknown): string { return `${score(v)}%`; }

function QualityBar({ value, label }: { value: unknown; label: string }) {
  const pctVal = score(value);
  const color = pctVal >= 70 ? "#10b981" : pctVal >= 40 ? "#fbbf24" : "#ef4444";
  return (
    <div style={{ marginBottom: 4 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#9ca3af", marginBottom: 2 }}>
        <span>{label}</span><span style={{ color }}>{pctVal}%</span>
      </div>
      <div style={{ height: 4, background: "#374151", borderRadius: 2 }}>
        <div style={{ height: 4, width: `${pctVal}%`, background: color, borderRadius: 2, transition: "width .3s" }} />
      </div>
    </div>
  );
}

function RiskBadge({ level }: { level: string }) {
  const map: Record<string, { variant: "success" | "warning" | "error" | "info"; label: string }> = {
    low:      { variant: "success", label: "Bajo" },
    medium:   { variant: "warning", label: "Medio" },
    high:     { variant: "error",   label: "Alto" },
    critical: { variant: "error",   label: "Crítico" },
  };
  const cfg = map[level] ?? { variant: "info" as const, label: level };
  return <StatusBadge variant={cfg.variant} text={cfg.label} />;
}

function SafetyIcons({ rawResult }: { rawResult?: Record<string, unknown> }) {
  const safety = rawResult?.safety as Record<string, unknown> | undefined;
  if (!safety) return null;
  return (
    <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
      <span title="Casco" style={{ fontSize: 11, display: "flex", alignItems: "center", gap: 2, color: safety.helmetDetected ? "#10b981" : "#6b7280" }}>
        <HardHat size={13} />{safety.helmetDetected ? "✓" : "✗"}
      </span>
      <span title="Chaleco" style={{ fontSize: 11, display: "flex", alignItems: "center", gap: 2, color: safety.vestDetected ? "#10b981" : "#6b7280" }}>
        <ShieldCheck size={13} />{safety.vestDetected ? "✓" : "✗"}
      </span>
    </div>
  );
}

function AnalysisCard({ item }: { item: VisionAnalysis }) {
  const risk = item.riskLevel ?? "low";
  const [open, setOpen] = useState(false);
  return (
    <div style={{ background: "#1f2937", border: "1px solid #374151", borderRadius: 8, padding: 14, marginBottom: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <Camera size={14} color="#6b7280" />
            <span style={{ fontSize: 12, color: "#9ca3af", fontFamily: "monospace" }}>
              {item.evidenceId?.slice(0, 16)}…
            </span>
            <RiskBadge level={risk} />
            {item.requiresHumanReview && (
              <StatusBadge variant="warning" text="Revisión manual" />
            )}
          </div>
          <QualityBar value={item.qualityScore} label="Calidad general" />
          <QualityBar value={item.blurScore ? Math.min(1, item.blurScore / 500) : 0} label="Nitidez" />
          {(item.duplicateRisk ?? 0) > 0.3 && (
            <div style={{ fontSize: 11, color: "#fbbf24", marginTop: 4 }}>
              ⚠ Riesgo de duplicado: {pct(item.duplicateRisk)}
            </div>
          )}
          <SafetyIcons rawResult={item.rawResult} />
          {item.riskReasons && item.riskReasons.length > 0 && (
            <div style={{ fontSize: 11, color: "#ef4444", marginTop: 4 }}>
              {item.riskReasons.join(" · ")}
            </div>
          )}
        </div>
        <button
          onClick={() => setOpen(o => !o)}
          style={{ fontSize: 11, color: "#6b7280", background: "none", border: "none", cursor: "pointer", marginLeft: 8 }}
        >
          {open ? "Ocultar" : "JSON"}
        </button>
      </div>
      {open && (
        <pre style={{ fontSize: 10, color: "#9ca3af", marginTop: 8, overflow: "auto", maxHeight: 200, background: "#111827", padding: 8, borderRadius: 4 }}>
          {JSON.stringify(item.rawResult ?? {}, null, 2)}
        </pre>
      )}
    </div>
  );
}

function SummaryStats({ analyses }: { analyses: VisionAnalysis[] }) {
  const completed = analyses.filter(a => a.status === "completed");
  const avgQuality = completed.length
    ? completed.reduce((s, a) => s + (a.qualityScore ?? 0), 0) / completed.length
    : 0;
  const duplicates = completed.filter(a => (a.duplicateRisk ?? 0) >= 0.85).length;
  const lowQuality = completed.filter(a => !a.canAutoApprove || (a.qualityScore ?? 0) < 0.6).length;
  const critical = completed.filter(a => a.riskLevel === "critical" || a.riskLevel === "high").length;

  const stats = [
    { label: "Analizadas", value: completed.length, icon: <Camera size={18} color="#3b82f6" /> },
    { label: "Calidad promedio", value: pct(avgQuality), icon: <TrendingUp size={18} color="#10b981" /> },
    { label: "Duplicados", value: duplicates, icon: <Layers size={18} color="#f59e0b" />, warn: duplicates > 0 },
    { label: "Baja calidad", value: lowQuality, icon: <AlertTriangle size={18} color="#fbbf24" />, warn: lowQuality > 0 },
    { label: "Riesgo alto/crítico", value: critical, icon: <XCircle size={18} color="#ef4444" />, warn: critical > 0 },
  ];

  return (
    <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 20 }}>
      {stats.map(s => (
        <div key={s.label} style={{
          flex: "1 1 140px", background: "#1f2937", border: `1px solid ${s.warn ? "#f59e0b" : "#374151"}`,
          borderRadius: 8, padding: "12px 14px",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            {s.icon}
            <span style={{ fontSize: 11, color: "#9ca3af" }}>{s.label}</span>
          </div>
          <div style={{ fontSize: 22, fontWeight: 700, color: s.warn ? "#fbbf24" : "#f9fafb" }}>{s.value}</div>
        </div>
      ))}
    </div>
  );
}

type AnalyzerTab = "material" | "space" | "portfolio" | "safety";

const TABS: { id: AnalyzerTab; label: string; icon: React.ReactNode }[] = [
  { id: "material",  label: "Materiales",  icon: <Package size={14} /> },
  { id: "space",     label: "Espacio",     icon: <ScanSearch size={14} /> },
  { id: "portfolio", label: "Portfolio",   icon: <UserCheck size={14} /> },
  { id: "safety",    label: "Seguridad",   icon: <HardHat size={14} /> },
];

function InsightBox({ text }: { text: string }) {
  return (
    <div style={{ marginTop: 12, background: "#0f172a", border: "1px solid #1e3a5f", borderRadius: 6, padding: "10px 14px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6, fontSize: 11, color: "#60a5fa" }}>
        <Brain size={13} /> Ollama insight
      </div>
      <p style={{ margin: 0, fontSize: 13, color: "#cbd5e1", lineHeight: 1.6 }}>{text}</p>
    </div>
  );
}

function ScoreRow({ label, value, max = 1 }: { label: string; value: number; max?: number }) {
  const pct = Math.round((value / max) * 100);
  const color = pct >= 70 ? "#10b981" : pct >= 40 ? "#fbbf24" : "#ef4444";
  return (
    <div style={{ marginBottom: 6 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#9ca3af", marginBottom: 2 }}>
        <span>{label}</span><span style={{ color }}>{pct}%</span>
      </div>
      <div style={{ height: 4, background: "#374151", borderRadius: 2 }}>
        <div style={{ height: 4, width: `${pct}%`, background: color, borderRadius: 2 }} />
      </div>
    </div>
  );
}

function AnalyzersLab() {
  const [tab, setTab] = useState<AnalyzerTab>("material");
  const [url, setUrl] = useState("");
  const [extra, setExtra] = useState("");
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const run = async () => {
    if (!url.trim()) return;
    setRunning(true); setResult(null); setErr(null);
    try {
      let res: Record<string, unknown>;
      if (tab === "material")  res = await detectMaterial(url, extra || undefined);
      else if (tab === "space") res = await classifySpace(url);
      else if (tab === "portfolio") res = await analyzePortfolio(url);
      else res = await safetyCheckEnriched(url, extra || undefined);
      setResult(res);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Error desconocido");
    } finally {
      setRunning(false);
    }
  };

  const placeholders: Record<AnalyzerTab, string> = {
    material:  "Material esperado (opcional: drywall, wood, brick…)",
    space:     "Categoría esperada (opcional)",
    portfolio: "Hash de imagen (opcional)",
    safety:    "Oficio (opcional: electrical, plumbing…)",
  };

  return (
    <div style={{ background: "#111827", border: "1px solid #1f2937", borderRadius: 10, padding: 20, marginTop: 32 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
        <FlaskConical size={20} color="#a78bfa" />
        <div>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#f9fafb" }}>Analyzers Lab</h2>
          <p style={{ margin: 0, fontSize: 12, color: "#6b7280" }}>OpenCV + Ollama — prueba los 4 nuevos analizadores en tiempo real</p>
        </div>
      </div>

      {/* Tab bar */}
      <div style={{ display: "flex", gap: 4, marginBottom: 16, borderBottom: "1px solid #1f2937", paddingBottom: 8 }}>
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => { setTab(t.id); setResult(null); setErr(null); }}
            style={{
              display: "flex", alignItems: "center", gap: 5, padding: "6px 12px",
              fontSize: 12, border: "none", cursor: "pointer", borderRadius: 6,
              background: tab === t.id ? "#2563eb" : "#1f2937",
              color: tab === t.id ? "#fff" : "#9ca3af",
            }}
          >
            {t.icon}{t.label}
          </button>
        ))}
      </div>

      {/* Inputs */}
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <input
          value={url}
          onChange={e => setUrl(e.target.value)}
          placeholder="URL de la imagen (https://…)"
          style={{ flex: 2, background: "#1f2937", border: "1px solid #374151", borderRadius: 6, color: "#f9fafb", padding: "8px 12px", fontSize: 13 }}
        />
        <input
          value={extra}
          onChange={e => setExtra(e.target.value)}
          placeholder={placeholders[tab]}
          style={{ flex: 1, background: "#1f2937", border: "1px solid #374151", borderRadius: 6, color: "#f9fafb", padding: "8px 12px", fontSize: 13 }}
        />
        <button
          onClick={run}
          disabled={!url.trim() || running}
          style={{
            padding: "8px 18px", background: "#7c3aed", color: "#fff", border: "none",
            borderRadius: 6, cursor: url.trim() && !running ? "pointer" : "not-allowed", fontSize: 13, fontWeight: 600,
          }}
        >
          {running ? "Analizando…" : "Analizar"}
        </button>
      </div>

      {err && (
        <div style={{ background: "#450a0a", border: "1px solid #b91c1c", borderRadius: 6, padding: "8px 12px", color: "#fca5a5", fontSize: 12, marginBottom: 10 }}>
          {err}
        </div>
      )}

      {result && (
        <div style={{ background: "#1f2937", borderRadius: 8, padding: 14 }}>
          {/* Material */}
          {tab === "material" && (
            <>
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 10 }}>
                <span style={{ fontSize: 20, fontWeight: 700, color: "#f9fafb" }}>{String(result.material ?? "—")}</span>
                <span style={{ fontSize: 13, color: "#9ca3af", alignSelf: "center" }}>
                  Condición: <b style={{ color: "#f9fafb" }}>{String(result.condition ?? "—")}</b>
                </span>
                <span style={{ fontSize: 13, color: "#9ca3af", alignSelf: "center" }}>
                  Stock: <b style={{ color: "#f9fafb" }}>{String(result.stockLevel ?? "—")}</b>
                </span>
              </div>
              <ScoreRow label="Confianza" value={Number(result.confidence ?? 0)} />
              {Array.isArray(result.notes) && result.notes.length > 0 && (
                <ul style={{ margin: "8px 0 0", padding: "0 0 0 16px", fontSize: 12, color: "#9ca3af" }}>
                  {(result.notes as string[]).map((n, i) => <li key={i}>{n}</li>)}
                </ul>
              )}
            </>
          )}

          {/* Space */}
          {tab === "space" && (
            <>
              <div style={{ display: "flex", gap: 12, marginBottom: 10, flexWrap: "wrap" }}>
                <span style={{ fontSize: 18, fontWeight: 700, color: "#f9fafb" }}>{String(result.category ?? "—")}</span>
                {Boolean(result.skipQuestionsAllowed) && (
                  <span style={{ fontSize: 11, background: "#065f46", color: "#6ee7b7", borderRadius: 4, padding: "2px 8px", alignSelf: "center" }}>
                    Skip 70% preguntas
                  </span>
                )}
              </div>
              <ScoreRow label="Confianza" value={Number(result.confidence ?? 0)} />
              {Array.isArray(result.suggestedQuestions) && (
                <div style={{ marginTop: 10 }}>
                  <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 4 }}>Preguntas sugeridas</div>
                  <ol style={{ margin: 0, padding: "0 0 0 16px", fontSize: 12, color: "#d1d5db" }}>
                    {(result.suggestedQuestions as string[]).map((q, i) => <li key={i} style={{ marginBottom: 2 }}>{q}</li>)}
                  </ol>
                </div>
              )}
            </>
          )}

          {/* Portfolio */}
          {tab === "portfolio" && (
            <>
              <div style={{ display: "flex", gap: 10, marginBottom: 10, flexWrap: "wrap", alignItems: "center" }}>
                <span style={{
                  fontSize: 13, fontWeight: 700, padding: "3px 10px", borderRadius: 6,
                  background: result.recommendation === "approve" ? "#065f46" : result.recommendation === "reject" ? "#450a0a" : "#78350f",
                  color: result.recommendation === "approve" ? "#6ee7b7" : result.recommendation === "reject" ? "#fca5a5" : "#fcd34d",
                }}>
                  {String(result.recommendation ?? "—").toUpperCase()}
                </span>
              </div>
              <ScoreRow label="Riesgo de fraude" value={Number(result.fraudRisk ?? 0)} />
              <ScoreRow label="Indicadores duplicado" value={Number(result.duplicateScore ?? 0)} />
              <ScoreRow label="Indicadores deepfake" value={Number(result.deepfakeScore ?? 0)} />
              <ScoreRow label="Calidad del portfolio" value={Number(result.qualityScore ?? 0)} />
              {Array.isArray(result.redFlags) && result.redFlags.length > 0 && (
                <div style={{ marginTop: 8 }}>
                  {(result.redFlags as string[]).map((f, i) => (
                    <div key={i} style={{ fontSize: 11, color: "#fca5a5", display: "flex", alignItems: "center", gap: 4, marginBottom: 2 }}>
                      <AlertTriangle size={11} /> {f}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {/* Safety */}
          {tab === "safety" && (
            <>
              <div style={{ display: "flex", gap: 16, marginBottom: 10 }}>
                {[
                  { label: "Casco", key: "helmetDetected" },
                  { label: "Chaleco", key: "vestDetected" },
                  { label: "Arnés", key: "harnessDetected" },
                ].map(({ label, key }) => (
                  <div key={key} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
                    {result[key]
                      ? <CheckCircle size={16} color="#10b981" />
                      : <XCircle size={16} color="#ef4444" />}
                    <span style={{ color: "#f9fafb" }}>{label}</span>
                  </div>
                ))}
              </div>
              <ScoreRow label="Compliance" value={Number(result.complianceScore ?? 0)} />
              {Array.isArray(result.violations) && result.violations.length > 0 && (
                <div style={{ marginTop: 6 }}>
                  {(result.violations as string[]).map((v, i) => (
                    <div key={i} style={{ fontSize: 11, color: "#fca5a5", display: "flex", alignItems: "center", gap: 4, marginBottom: 2 }}>
                      <AlertTriangle size={11} /> {v}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {/* Ollama insight (all tabs) */}
          {typeof result.insight === "string" && result.insight && (
            <InsightBox text={result.insight} />
          )}
        </div>
      )}
    </div>
  );
}

export default function VisionAdminPage() {
  const [jobs, setJobs] = useState<JobOption[]>([]);
  const [selectedJob, setSelectedJob] = useState<string>("");
  const [analyses, setAnalyses] = useState<VisionAnalysis[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchJobs()
      .then(js => setJobs(js.map(j => ({ id: String(j.id ?? ""), title: String(j.title ?? j.id ?? ""), status: String((j as unknown as Record<string, unknown>).status ?? "") }))))
      .catch(() => {});
  }, []);

  const load = useCallback(async (jobId: string) => {
    if (!jobId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchVisionByJob(jobId);
      setAnalyses(data as unknown as VisionAnalysis[]);
    } catch {
      setError("No se pudieron cargar los análisis de visión.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { if (selectedJob) load(selectedJob); }, [selectedJob, load]);

  return (
    <div style={{ padding: "24px 28px", maxWidth: 900, margin: "0 auto", color: "#f9fafb" }}>
      <NotificationBanner audience="admin" />

      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
        <Eye size={24} color="#3b82f6" />
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>Vision AI — Análisis de Evidencias</h1>
          <p style={{ margin: 0, fontSize: 13, color: "#9ca3af" }}>
            Calidad, seguridad PPE, duplicados y consistencia de ubicación por trabajo
          </p>
        </div>
      </div>

      {/* Job selector */}
      <div style={{ display: "flex", gap: 10, marginBottom: 20, alignItems: "center" }}>
        <select
          value={selectedJob}
          onChange={e => setSelectedJob(e.target.value)}
          style={{
            flex: 1, maxWidth: 360, background: "#1f2937", border: "1px solid #374151",
            borderRadius: 6, color: "#f9fafb", padding: "8px 12px", fontSize: 14,
          }}
        >
          <option value="">— Selecciona un trabajo —</option>
          {jobs.map(j => (
            <option key={j.id} value={j.id}>{j.title} ({j.status})</option>
          ))}
        </select>
        <button
          onClick={() => load(selectedJob)}
          disabled={!selectedJob || loading}
          style={{
            display: "flex", alignItems: "center", gap: 6, padding: "8px 14px",
            background: "#2563eb", color: "#fff", border: "none", borderRadius: 6,
            cursor: selectedJob && !loading ? "pointer" : "not-allowed", fontSize: 13,
          }}
        >
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          {loading ? "Cargando…" : "Actualizar"}
        </button>
      </div>

      {error && (
        <div style={{ background: "#450a0a", border: "1px solid #b91c1c", borderRadius: 6, padding: "10px 14px", marginBottom: 16, color: "#fca5a5", fontSize: 13 }}>
          {error}
        </div>
      )}

      {analyses.length > 0 && (
        <>
          <SummaryStats analyses={analyses} />
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <Activity size={16} color="#6b7280" />
            <span style={{ fontSize: 13, color: "#9ca3af" }}>{analyses.length} análisis registrados</span>
          </div>
          {analyses.map(a => <AnalysisCard key={a.id} item={a} />)}
        </>
      )}

      {!loading && selectedJob && analyses.length === 0 && !error && (
        <div style={{ textAlign: "center", padding: "40px 20px", color: "#6b7280" }}>
          <Zap size={32} style={{ marginBottom: 8 }} />
          <div style={{ fontSize: 14 }}>Sin análisis de visión para este trabajo.</div>
          <div style={{ fontSize: 12, marginTop: 4 }}>El QA Agent ejecutará Vision AI automáticamente al revisar evidencias.</div>
        </div>
      )}

      {!selectedJob && (
        <div style={{ textAlign: "center", padding: "60px 20px", color: "#6b7280" }}>
          <MapPin size={40} style={{ marginBottom: 12 }} />
          <div style={{ fontSize: 15 }}>Selecciona un trabajo para ver sus análisis Vision AI</div>
          <div style={{ fontSize: 12, marginTop: 6, color: "#4b5563" }}>
            Calidad de fotos · Detección PPE · Riesgo de duplicados · Consistencia de ubicación
          </div>
        </div>
      )}

      <AnalyzersLab />
    </div>
  );
}
