"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Activity, ArrowRight, Bot, Brain, CheckCircle2, DollarSign, Eye,
  Layers, Maximize2, Minimize2, RefreshCw, Send, Shield, Zap,
} from "lucide-react";
import { AdminPageHeader } from "../../../components/admin/AdminPageHeader";

// ── Types ─────────────────────────────────────────────────────────────────────

type AgentStatus = {
  name: string;
  active: boolean;
  processedMessages: number;
  lastEventAt?: string;
  errors: number;
  paused: boolean;
};

type BusStatus = { agents: AgentStatus[]; policy: string };

type BusEvent = {
  agent: string;
  event: string;
  from?: string;
  to?: string;
  projectId?: string;
  processedAt?: string;
  error?: string;
  totalProcessed?: number;
};

type ClassifyResult = {
  trade: string; urgency: string; complexity: string;
  estimatedHours: number; suggestedBudgetMin: number; suggestedBudgetMax: number;
  requiredSkills: string[]; matchScore: number;
  reasoningSteps: string[];
};

type PlanResult = {
  trade: string;
  phases: Array<{ name: string; durationDays: number; tasks: string[]; milestoneTitle: string }>;
  totalDays: number;
  criticalPath: string[];
  reasoningSteps: string[];
};

type PaymentResult = {
  canRelease: boolean; blockers: string[]; escrowStatus: string; requiredActions: string[];
  reasoningSteps: string[];
};

type PlaygroundTab = "classify" | "plan" | "payment";

// ── Agent icons ───────────────────────────────────────────────────────────────

const AGENT_META: Record<string, { icon: typeof Bot; color: string; role: string }> = {
  marketplace: { icon: Layers,       color: "#818cf8", role: "Conecta demanda con oferta" },
  buildops:    { icon: Zap,          color: "#67e8f9", role: "Organiza proyectos y milestones" },
  protools:    { icon: Brain,        color: "#fcd34d", role: "Calcula materiales y costos" },
  evidence:    { icon: Eye,          color: "#86efac", role: "Protege con fotos y trazabilidad" },
  crowd:       { icon: DollarSign,   color: "#fb923c", role: "Gestiona pagos y escrow" },
  prometeo:    { icon: Bot,          color: "#c084fc", role: "Explica con RAG y fuentes reales" },
};

const MAX_HISTORY_SAMPLES = 20;

// ── Sparkline (client-side session history — no backend series exists yet) ────

function Sparkline({ data, color }: { data: number[]; color: string }) {
  const w = 72, h = 22;
  if (data.length < 2) {
    return (
      <div style={{ width: w, height: h, display: "flex", alignItems: "center" }}>
        <span style={{ fontSize: 9, color: "var(--muted)" }}>recolectando…</span>
      </div>
    );
  }
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const points = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * w;
      const y = h - ((v - min) / range) * (h - 4) - 2;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <svg width={w} height={h} role="img" aria-label="Tendencia de mensajes procesados en esta sesión">
      <polyline points={points} fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" opacity={0.9} />
    </svg>
  );
}

// ── Agent Card ────────────────────────────────────────────────────────────────

function AgentCard({
  agent, history, focused, onViewActivity, onTogglePause, pausing,
}: {
  agent: AgentStatus;
  history: number[];
  focused: boolean;
  onViewActivity: () => void;
  onTogglePause: () => void;
  pausing: boolean;
}) {
  const meta = AGENT_META[agent.name] ?? { icon: Bot, color: "#94a3b8", role: "Agente SEMSE" };
  const Icon = meta.icon;
  const usesLlmPrompt = agent.name === "prometeo";
  return (
    <div
      style={{
        background: "var(--surface)",
        border: `1px solid ${focused ? meta.color : agent.paused ? "#fbbf2460" : agent.active ? meta.color + "40" : "var(--border)"}`,
        borderRadius: 14,
        padding: "16px 18px",
        transition: "border-color .15s ease",
        opacity: agent.paused ? 0.85 : 1,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
        <div style={{ width: 40, height: 40, borderRadius: 12, background: `${meta.color}15`, display: "grid", placeItems: "center" }}>
          <Icon size={18} color={meta.color} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: "var(--ink)", textTransform: "capitalize" }}>{agent.name}</div>
          <div style={{ fontSize: 11, color: "var(--muted)" }}>{meta.role}</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 10, fontWeight: 700, color: agent.paused ? "#fbbf24" : agent.active ? "#86efac" : "#475569" }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: agent.paused ? "#fbbf24" : agent.active ? "#86efac" : "#475569" }} />
          {agent.paused ? "pausado" : agent.active ? "activo" : "idle"}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 12 }}>
        {[
          { label: "Mensajes", value: agent.processedMessages },
          { label: "Errores",  value: agent.errors, alert: agent.errors > 0 },
          { label: "Último",   value: agent.lastEventAt ? new Date(agent.lastEventAt).toLocaleTimeString("es-MX") : "—" },
        ].map(({ label, value, alert }) => (
          <div key={label} style={{ padding: "8px 10px", background: "rgba(255,255,255,.03)", borderRadius: 8 }}>
            <div style={{ fontSize: 9, color: "var(--muted)", fontWeight: 700, marginBottom: 3 }}>{label}</div>
            <div style={{ fontSize: 13, fontWeight: 800, color: alert ? "#fca5a5" : "var(--ink)" }}>{String(value)}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, paddingTop: 10, borderTop: "1px solid var(--border)" }}>
        <Sparkline data={history} color={meta.color} />
        <div style={{ display: "flex", gap: 6 }}>
          <button
            onClick={onViewActivity}
            aria-pressed={focused}
            style={{
              padding: "5px 10px", borderRadius: 7, cursor: "pointer", fontSize: 10, fontWeight: 700,
              border: `1px solid ${meta.color}40`,
              background: focused ? `${meta.color}20` : "transparent",
              color: meta.color,
            }}
          >
            {focused ? "Viendo actividad" : "Ver actividad"}
          </button>
          <button
            onClick={onTogglePause}
            disabled={pausing}
            title={agent.paused ? "Reanudar: el bus volverá a procesar mensajes de este agente" : "Pausar: el bus descartará mensajes dirigidos a este agente hasta reanudar"}
            style={{
              padding: "5px 10px", borderRadius: 7, fontSize: 10, fontWeight: 700, cursor: pausing ? "wait" : "pointer",
              border: `1px solid ${agent.paused ? "#fbbf2460" : "var(--border)"}`,
              background: agent.paused ? "rgba(251,191,36,.15)" : "transparent",
              color: agent.paused ? "#fbbf24" : "var(--muted)",
              opacity: pausing ? 0.6 : 1,
            }}
          >
            {pausing ? "…" : agent.paused ? "Reanudar" : "Pausar"}
          </button>
          <button
            disabled
            title={usesLlmPrompt
              ? "Prometeo sí usa system prompts de LLM, pero hoy están inline en el código (prometeo.controller, evidence-review, etc.), no en un config store editable — falta ese refactor antes de exponer un editor seguro."
              : "Este agente es determinístico (reglas/tablas), no usa prompts de LLM — no aplica un editor de prompts aquí."}
            style={{ padding: "5px 10px", borderRadius: 7, border: "1px solid var(--border)", background: "transparent", color: "var(--muted)", fontSize: 10, fontWeight: 700, cursor: "not-allowed", opacity: 0.5 }}
          >
            Prompts
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Message Bus health ───────────────────────────────────────────────────────

function BusHealthBadge({ sseOk, totalErrors }: { sseOk: boolean; totalErrors: number }) {
  const level: "healthy" | "degraded" | "offline" = !sseOk ? "offline" : totalErrors > 0 ? "degraded" : "healthy";
  const meta = {
    healthy:  { color: "#86efac", label: "Estable" },
    degraded: { color: "#fbbf24", label: "Con errores" },
    offline:  { color: "#fca5a5", label: "Desconectado" },
  }[level];
  return (
    <div
      role="status"
      aria-label={`Message Bus: ${meta.label}`}
      style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 99, background: `${meta.color}1a`, border: `1px solid ${meta.color}4d` }}
    >
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: meta.color, animation: level === "healthy" ? "pulse 2s infinite" : "none" }} />
      <span style={{ fontSize: 10, fontWeight: 700, color: meta.color }}>Message Bus · {meta.label}</span>
    </div>
  );
}

// ── Playground: output panel (structured + raw JSON) ────────────────────────

function ResultPanel({
  tab, classifyResult, planResult, paymentResult, busy,
}: {
  tab: PlaygroundTab;
  classifyResult: ClassifyResult | null;
  planResult: PlanResult | null;
  paymentResult: PaymentResult | null;
  busy: boolean;
}) {
  const [view, setView] = useState<"summary" | "reasoning" | "json">("summary");
  const result = tab === "classify" ? classifyResult : tab === "plan" ? planResult : paymentResult;
  const reasoningSteps = result?.reasoningSteps ?? [];

  return (
    <div style={{ height: "100%", minHeight: 200, display: "flex", flexDirection: "column", background: "rgba(255,255,255,.02)", border: "1px solid var(--border)", borderRadius: 12, padding: 14, boxSizing: "border-box" }}>
      <div style={{ display: "flex", alignItems: "center", marginBottom: 10, gap: 4 }}>
        <span style={{ fontSize: 10, fontWeight: 800, color: "var(--muted)", letterSpacing: 0.4, textTransform: "uppercase", flex: 1 }}>
          Output
        </span>
        {result && ([
          ["summary", "Resumen"],
          ["reasoning", "Razonamiento"],
          ["json", "JSON"],
        ] as [typeof view, string][]).map(([v, label]) => (
          <button
            key={v}
            onClick={() => setView(v)}
            style={{ fontSize: 10, fontWeight: 700, color: view === v ? "#818cf8" : "var(--muted)", background: view === v ? "rgba(129,140,248,.12)" : "transparent", border: "none", borderRadius: 6, padding: "3px 8px", cursor: "pointer" }}
          >
            {label}
          </button>
        ))}
      </div>

      {busy && <div style={{ fontSize: 12, color: "var(--muted)" }}>Ejecutando agente…</div>}

      {!busy && !result && (
        <div style={{ fontSize: 12, color: "var(--muted)", flex: 1, display: "flex", alignItems: "center" }}>
          Sin resultados aún. Ejecuta la acción a la izquierda para ver aquí el output estructurado del agente.
        </div>
      )}

      {!busy && result && view === "json" && (
        <pre style={{ margin: 0, fontSize: 11, lineHeight: 1.5, color: "var(--ink)", whiteSpace: "pre-wrap", wordBreak: "break-word", overflow: "auto" }}>
          {JSON.stringify(result, null, 2)}
        </pre>
      )}

      {!busy && result && view === "reasoning" && (
        <div style={{ display: "grid", gap: 8 }}>
          <div style={{ fontSize: 10, color: "var(--muted)" }}>
            Traza real de la lógica determinística del agente (no es un LLM narrando — son los pasos que de verdad ejecutó).
          </div>
          {reasoningSteps.length === 0 && (
            <div style={{ fontSize: 12, color: "var(--muted)" }}>Este resultado no trae pasos de razonamiento.</div>
          )}
          <ol style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 6 }}>
            {reasoningSteps.map((step, i) => (
              <li key={i} style={{ fontSize: 12, color: "var(--ink)", lineHeight: 1.5 }}>{step}</li>
            ))}
          </ol>
        </div>
      )}

      {!busy && view === "summary" && tab === "classify" && classifyResult && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          {[
            { label: "Trade",       value: classifyResult.trade },
            { label: "Urgencia",    value: classifyResult.urgency },
            { label: "Complejidad", value: classifyResult.complexity },
            { label: "Horas est.",  value: `${classifyResult.estimatedHours}h` },
            { label: "Budget",      value: `$${classifyResult.suggestedBudgetMin.toLocaleString()}–$${classifyResult.suggestedBudgetMax.toLocaleString()}` },
            { label: "Match",       value: `${classifyResult.matchScore}%` },
          ].map(({ label, value }) => (
            <div key={label}>
              <div style={{ fontSize: 9, color: "var(--muted)", fontWeight: 700 }}>{label}</div>
              <div style={{ fontSize: 13, fontWeight: 800, color: "#818cf8" }}>{value}</div>
            </div>
          ))}
          {classifyResult.requiredSkills.length > 0 && (
            <div style={{ gridColumn: "1 / -1", marginTop: 4 }}>
              <div style={{ fontSize: 9, color: "var(--muted)", fontWeight: 700, marginBottom: 4 }}>SKILLS REQUERIDAS</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {classifyResult.requiredSkills.map((s) => (
                  <span key={s} style={{ fontSize: 10, padding: "3px 8px", borderRadius: 99, background: "rgba(129,140,248,.12)", color: "#818cf8" }}>{s}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {!busy && view === "summary" && tab === "plan" && planResult && (
        <div style={{ display: "grid", gap: 8 }}>
          <div style={{ fontSize: 11, color: "var(--muted)" }}>Total: {planResult.totalDays} días · {planResult.phases.length} fases</div>
          {planResult.phases.map((phase, i) => (
            <div key={i} style={{ padding: "10px 14px", background: "rgba(103,232,249,.06)", borderRadius: 10, border: "1px solid rgba(103,232,249,.2)" }}>
              <div style={{ display: "flex", gap: 8, marginBottom: 6 }}>
                <span style={{ fontSize: 11, fontWeight: 800, color: "#67e8f9" }}>{phase.name}</span>
                <span style={{ fontSize: 10, color: "var(--muted)" }}>{phase.durationDays} días</span>
              </div>
              <div style={{ fontSize: 10, color: "var(--muted)" }}>{phase.tasks.join(" · ")}</div>
            </div>
          ))}
        </div>
      )}

      {!busy && view === "summary" && tab === "payment" && paymentResult && (
        <div style={{ padding: 14, background: paymentResult.canRelease ? "rgba(134,239,172,.08)" : "rgba(239,68,68,.08)", borderRadius: 10, border: `1px solid ${paymentResult.canRelease ? "rgba(134,239,172,.3)" : "rgba(239,68,68,.3)"}` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <CheckCircle2 size={14} color={paymentResult.canRelease ? "#86efac" : "#fca5a5"} />
            <span style={{ fontWeight: 800, color: paymentResult.canRelease ? "#86efac" : "#fca5a5" }}>
              {paymentResult.canRelease ? "Pago listo para liberar" : "Pago bloqueado"}
            </span>
            <span style={{ fontSize: 10, color: "var(--muted)", marginLeft: "auto" }}>{paymentResult.escrowStatus}</span>
          </div>
          {paymentResult.blockers.map((b, i) => (
            <div key={i} style={{ fontSize: 11, color: "#fca5a5", padding: "3px 0" }}>• {b}</div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Playground ────────────────────────────────────────────────────────────────

function PlaygroundSection() {
  const [tab, setTab] = useState<PlaygroundTab>("classify");
  const [expanded, setExpanded] = useState(false);

  // Classify
  const [desc, setDesc] = useState("Necesito instalar panel eléctrico nuevo y tomacorrientes GFCI en cocina y baños");
  const [area, setArea] = useState("150");
  const [classifyResult, setClassifyResult] = useState<ClassifyResult | null>(null);
  const [classifying, setClassifying] = useState(false);

  // Plan
  const [planTrade, setPlanTrade] = useState("electrical");
  const [planHours, setPlanHours] = useState("16");
  const [planResult, setPlanResult] = useState<PlanResult | null>(null);
  const [planning, setPlanning] = useState(false);

  // Payment
  const [evidenceOk, setEvidenceOk] = useState(true);
  const [changeOrders, setChangeOrders] = useState("0");
  const [dispute, setDispute] = useState(false);
  const [milestoneStatus, setMilestoneStatus] = useState("submitted");
  const [paymentResult, setPaymentResult] = useState<PaymentResult | null>(null);
  const [evaluating, setEvaluating] = useState(false);

  const runClassify = async () => {
    setClassifying(true);
    try {
      const r = await fetch("/api/semse/agents/classify", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ description: desc, area: Number(area) }) });
      const j = await r.json() as { data: ClassifyResult };
      setClassifyResult(j.data);
    } finally { setClassifying(false); }
  };

  const runPlan = async () => {
    setPlanning(true);
    try {
      const r = await fetch("/api/semse/agents/plan", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ trade: planTrade, estimatedHours: Number(planHours) }) });
      const j = await r.json() as { data: PlanResult };
      setPlanResult(j.data);
    } finally { setPlanning(false); }
  };

  const runPayment = async () => {
    setEvaluating(true);
    try {
      const r = await fetch("/api/semse/agents/payment-readiness", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ evidenceApproved: evidenceOk, changeOrdersPending: Number(changeOrders), disputeOpen: dispute, milestoneStatus }) });
      const j = await r.json() as { data: PaymentResult };
      setPaymentResult(j.data);
    } finally { setEvaluating(false); }
  };

  const busy = tab === "classify" ? classifying : tab === "plan" ? planning : evaluating;

  const body = (
    <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 16, padding: 20 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 18 }}>
        <Send size={15} color="#818cf8" />
        <h2 style={{ margin: 0, fontSize: 15, fontWeight: 800, flex: 1 }}>Playground de Agentes</h2>
        <button
          onClick={() => setExpanded((v) => !v)}
          title={expanded ? "Contraer" : "Expandir para depurar respuestas largas"}
          style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 10px", borderRadius: 8, border: "1px solid var(--border)", background: "transparent", color: "var(--muted)", fontSize: 11, fontWeight: 700, cursor: "pointer" }}
        >
          {expanded ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
          {expanded ? "Contraer" : "Expandir"}
        </button>
      </div>

      <div style={{ display: "flex", gap: 4, marginBottom: 18, background: "rgba(255,255,255,.03)", padding: 4, borderRadius: 10, border: "1px solid var(--border)", width: "fit-content" }}>
        {([["classify", "Marketplace"], ["plan", "BuildOps"], ["payment", "Crowd"]] as [PlaygroundTab, string][]).map(([t, label]) => {
          const on = tab === t;
          return (
            <button
              key={t}
              onClick={() => setTab(t)}
              aria-pressed={on}
              style={{
                display: "flex", alignItems: "center", gap: 6, padding: "6px 14px", borderRadius: 7, cursor: "pointer", fontSize: 11, fontWeight: 700,
                border: on ? "1px solid rgba(99,102,241,.5)" : "1px solid transparent",
                background: on ? "rgba(99,102,241,.2)" : "transparent",
                color: on ? "#818cf8" : "var(--muted)",
              }}
            >
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: on ? "#818cf8" : "var(--border)" }} />
              {label}
            </button>
          );
        })}
      </div>

      <div className="playground-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, alignItems: "start" }}>
        <div style={{ display: "grid", gap: 12 }}>
          {tab === "classify" && (
            <>
              <textarea value={desc} onChange={(e) => setDesc(e.target.value)} rows={3}
                style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid var(--border)", background: "rgba(255,255,255,.05)", color: "var(--ink)", fontSize: 12, resize: "vertical", boxSizing: "border-box" }} />
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <input type="number" value={area} onChange={(e) => setArea(e.target.value)} placeholder="Área (sqft)" style={{ width: 120, padding: "8px 10px", borderRadius: 8, border: "1px solid var(--border)", background: "rgba(255,255,255,.05)", color: "var(--ink)", fontSize: 12 }} />
                <button onClick={runClassify} disabled={classifying} style={{ padding: "8px 20px", borderRadius: 8, background: "rgba(99,102,241,.15)", border: "none", cursor: "pointer", color: "#818cf8", fontWeight: 700, fontSize: 12 }}>
                  {classifying ? "Clasificando…" : "Clasificar"}
                </button>
              </div>
            </>
          )}

          {tab === "plan" && (
            <div style={{ display: "flex", gap: 10 }}>
              <select value={planTrade} onChange={(e) => setPlanTrade(e.target.value)} style={{ flex: 1, padding: "8px 10px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--ink)", fontSize: 12 }}>
                {["electrical","plumbing","drywall","painting","hvac","roofing","carpentry","cleaning"].map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
              <input type="number" value={planHours} onChange={(e) => setPlanHours(e.target.value)} placeholder="Horas" style={{ width: 90, padding: "8px 10px", borderRadius: 8, border: "1px solid var(--border)", background: "rgba(255,255,255,.05)", color: "var(--ink)", fontSize: 12 }} />
              <button onClick={runPlan} disabled={planning} style={{ padding: "8px 20px", borderRadius: 8, background: "rgba(103,232,249,.1)", border: "none", cursor: "pointer", color: "#67e8f9", fontWeight: 700, fontSize: 12 }}>
                {planning ? "Planificando…" : "Crear plan"}
              </button>
            </div>
          )}

          {tab === "payment" && (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                {[
                  { label: "Evidencia aprobada", value: evidenceOk, setter: setEvidenceOk },
                  { label: "Disputa activa",     value: dispute,    setter: setDispute },
                ].map(({ label, value, setter }) => (
                  <label key={label} style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", padding: "8px 12px", background: "rgba(255,255,255,.03)", borderRadius: 8 }}>
                    <input type="checkbox" checked={value} onChange={(e) => setter(e.target.checked)} />
                    <span style={{ fontSize: 12, color: "var(--ink)" }}>{label}</span>
                  </label>
                ))}
                <div>
                  <label style={{ fontSize: 10, fontWeight: 700, color: "var(--muted)", display: "block", marginBottom: 4 }}>CHANGE ORDERS</label>
                  <input type="number" value={changeOrders} onChange={(e) => setChangeOrders(e.target.value)} min={0} style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid var(--border)", background: "rgba(255,255,255,.05)", color: "var(--ink)", fontSize: 12 }} />
                </div>
                <div>
                  <label style={{ fontSize: 10, fontWeight: 700, color: "var(--muted)", display: "block", marginBottom: 4 }}>MILESTONE STATUS</label>
                  <select value={milestoneStatus} onChange={(e) => setMilestoneStatus(e.target.value)} style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--ink)", fontSize: 12 }}>
                    {["draft","submitted","approved","not_ready"].map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>
              <button onClick={runPayment} disabled={evaluating} style={{ padding: "10px", borderRadius: 8, background: "rgba(251,146,60,.1)", border: "none", cursor: "pointer", color: "#fb923c", fontWeight: 700, fontSize: 12 }}>
                {evaluating ? "Evaluando…" : "Evaluar pago"}
              </button>
            </>
          )}
        </div>

        <ResultPanel tab={tab} classifyResult={classifyResult} planResult={planResult} paymentResult={paymentResult} busy={busy} />
      </div>

      <style>{`
        @media (max-width: 760px) {
          .playground-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );

  if (!expanded) return body;

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={(e) => { if (e.target === e.currentTarget) setExpanded(false); }}
      style={{ position: "fixed", inset: 0, zIndex: 60, background: "rgba(2,6,23,.72)", backdropFilter: "blur(2px)", display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "32px 20px", overflowY: "auto" }}
    >
      <div style={{ width: "min(1200px, 100%)" }}>{body}</div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AgentsPage() {
  const [status,       setStatus]       = useState<BusStatus | null>(null);
  const [loading,      setLoading]      = useState(false);
  const [lastAt,       setLastAt]       = useState<string | null>(null);
  const [feed,         setFeed]         = useState<BusEvent[]>([]);
  const [sseOk,        setSseOk]        = useState(false);
  const [history,      setHistory]      = useState<Record<string, number[]>>({});
  const [focusedAgent, setFocusedAgent] = useState<string | null>(null);
  const [pausingAgent, setPausingAgent] = useState<string | null>(null);
  const sseRef = useRef<EventSource | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/semse/agents/status");
      if (!res.ok) return;
      const json = await res.json() as { data: BusStatus };
      const data = json.data ?? null;
      setStatus(data);
      setLastAt(new Date().toLocaleTimeString("es-MX"));
      if (data) {
        setHistory((prev) => {
          const next = { ...prev };
          for (const a of data.agents) {
            const series = next[a.name] ?? [];
            next[a.name] = [...series, a.processedMessages].slice(-MAX_HISTORY_SAMPLES);
          }
          return next;
        });
      }
    } catch { /* silent */ } finally { setLoading(false); }
  }, []);

  const togglePause = useCallback(async (agent: AgentStatus) => {
    setPausingAgent(agent.name);
    try {
      await fetch(`/api/semse/agents/${encodeURIComponent(agent.name)}/${agent.paused ? "resume" : "pause"}`, { method: "POST" });
      await load();
    } catch { /* silent */ } finally { setPausingAgent(null); }
  }, [load]);

  // SSE subscription to agents:system channel
  useEffect(() => {
    const es = new EventSource("/api/semse/sse/agents");
    sseRef.current = es;

    es.addEventListener("agent:message", (e) => {
      try {
        const data = JSON.parse(e.data) as BusEvent;
        setSseOk(true);
        setFeed((prev) => [data, ...prev].slice(0, 50));
        // Also refresh bus status on every message
        void load();
      } catch { /* ignore */ }
    });

    es.addEventListener("agent:error", (e) => {
      try {
        const data = JSON.parse(e.data) as BusEvent;
        setFeed((prev) => [{ ...data, error: data.error ?? "error" }, ...prev].slice(0, 50));
      } catch { /* ignore */ }
    });

    es.onerror = () => setSseOk(false);
    es.onopen  = () => setSseOk(true);

    return () => { es.close(); sseRef.current = null; };
  }, [load]);

  useEffect(() => {
    void load();
    const t = setInterval(() => void load(), 15_000);
    return () => clearInterval(t);
  }, [load]);

  const totalMessages = status?.agents.reduce((s, a) => s + a.processedMessages, 0) ?? 0;
  const activeAgents  = status?.agents.filter((a) => a.active).length ?? 0;
  const totalErrors   = status?.agents.reduce((s, a) => s + a.errors, 0) ?? 0;
  const feedMessages  = feed.length;

  const displayedFeed = focusedAgent
    ? feed.filter((ev) => ev.agent === focusedAgent || ev.from === focusedAgent || ev.to === focusedAgent)
    : feed;

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "28px 20px", color: "var(--ink)" }}>
      <AdminPageHeader
        title="SEMSE Agents"
        subtitle={`6 agentes especializados · Message bus · ${lastAt ?? "cargando…"}`}
        icon={Bot}
        iconColor="#818cf8"
        iconBg="rgba(99,102,241,.15)"
        showBack={false}
        actions={
          <>
            <BusHealthBadge sseOk={sseOk} totalErrors={totalErrors} />
            <button onClick={load} disabled={loading}
              style={{ padding: "8px 14px", borderRadius: 10, background: "rgba(255,255,255,.05)", border: "1px solid var(--border)", cursor: "pointer", color: "var(--muted)" }}>
              <RefreshCw size={12} className={loading ? "animate-spin" : undefined} />
            </button>
          </>
        }
      />

      {/* Summary */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 20 }}>
        {[
          { label: "Agentes activos",  value: `${activeAgents}/6`,     color: "#86efac", icon: Activity },
          { label: "Mensajes total",   value: String(totalMessages),   color: "#818cf8", icon: Send },
          { label: "SSE live events",  value: String(feedMessages),    color: sseOk ? "#67e8f9" : "#475569", icon: Zap },
          { label: "Errores total",    value: String(totalErrors),     color: totalErrors > 0 ? "#fca5a5" : "#86efac", icon: Shield },
        ].map(({ label, value, color, icon: Icon }) => (
          <div key={label} style={{ padding: "14px 16px", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <Icon size={13} color={color} />
              <span style={{ fontSize: 10, color: "var(--muted)", fontWeight: 700 }}>{label}</span>
            </div>
            <div style={{ fontSize: 15, fontWeight: 900, color }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Policy */}
      {status?.policy && (
        <div style={{ padding: "8px 14px", background: "rgba(99,102,241,.06)", border: "1px solid rgba(99,102,241,.2)", borderRadius: 10, fontSize: 11, color: "#818cf8", marginBottom: 20 }}>
          <Shield size={10} style={{ verticalAlign: "middle", marginRight: 6 }} />
          {status.policy}
        </div>
      )}

      {/* Agent grid */}
      {status && (
        <div className="semse-agents-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14, marginBottom: 24 }}>
          {status.agents.map((a) => (
            <AgentCard
              key={a.name}
              agent={a}
              history={history[a.name] ?? []}
              focused={focusedAgent === a.name}
              onViewActivity={() => setFocusedAgent((cur) => (cur === a.name ? null : a.name))}
              onTogglePause={() => togglePause(a)}
              pausing={pausingAgent === a.name}
            />
          ))}
        </div>
      )}

      {/* SSE Live Feed */}
      {feed.length > 0 && (
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 16, padding: 18, marginBottom: 24 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
            <Zap size={14} color="#67e8f9" />
            <h2 style={{ margin: 0, fontSize: 14, fontWeight: 800 }}>Actividad en tiempo real</h2>
            {focusedAgent && (
              <span style={{ fontSize: 10, color: "var(--muted)", display: "flex", alignItems: "center", gap: 6 }}>
                filtrando por <strong style={{ color: "var(--ink)", textTransform: "capitalize" }}>{focusedAgent}</strong>
                <button onClick={() => setFocusedAgent(null)} style={{ background: "transparent", border: "none", color: "#818cf8", cursor: "pointer", fontSize: 10, fontWeight: 700 }}>
                  quitar filtro
                </button>
              </span>
            )}
            <span style={{ fontSize: 10, color: "#67e8f9", background: "rgba(103,232,249,.1)", padding: "2px 8px", borderRadius: 99, marginLeft: "auto" }}>
              SSE live · {displayedFeed.length} eventos
            </span>
          </div>
          <div style={{ display: "grid", gap: 6, maxHeight: 240, overflowY: "auto" }}>
            {displayedFeed.length === 0 && (
              <div style={{ fontSize: 11, color: "var(--muted)", padding: "8px 4px" }}>Sin eventos para este agente todavía.</div>
            )}
            {displayedFeed.slice(0, 15).map((ev, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", background: ev.error ? "rgba(239,68,68,.06)" : "rgba(103,232,249,.04)", borderRadius: 10, border: `1px solid ${ev.error ? "rgba(239,68,68,.2)" : "rgba(103,232,249,.15)"}`, fontSize: 11 }}>
                <span style={{ fontWeight: 800, color: AGENT_META[ev.from ?? ev.agent]?.color ?? "#94a3b8", minWidth: 80, textTransform: "capitalize" }}>{ev.from ?? ev.agent}</span>
                <ArrowRight size={10} color="var(--muted)" />
                <span style={{ fontWeight: 700, color: ev.error ? "#fca5a5" : "#67e8f9", minWidth: 70, textTransform: "capitalize" }}>{ev.to ?? "bus"}</span>
                <span style={{ color: "var(--muted)", flex: 1 }}>{ev.event}</span>
                {ev.totalProcessed && <span style={{ fontSize: 9, color: "var(--muted)" }}>#{ev.totalProcessed}</span>}
                {ev.processedAt && <span style={{ fontSize: 9, color: "var(--muted)" }}>{new Date(ev.processedAt).toLocaleTimeString("es-MX")}</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Playground */}
      <PlaygroundSection />

      <style>{`
        @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: .4; } }
        @media (max-width: 760px) {
          .semse-agents-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}
