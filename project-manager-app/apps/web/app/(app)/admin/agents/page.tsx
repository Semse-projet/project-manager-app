"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Activity, Bot, Brain, CheckCircle2, DollarSign, Eye,
  Layers, RefreshCw, Send, Shield, Zap,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

type AgentStatus = {
  name: string;
  active: boolean;
  processedMessages: number;
  lastEventAt?: string;
  errors: number;
};

type BusStatus = { agents: AgentStatus[]; policy: string };

type ClassifyResult = {
  trade: string; urgency: string; complexity: string;
  estimatedHours: number; suggestedBudgetMin: number; suggestedBudgetMax: number;
  requiredSkills: string[]; matchScore: number;
};

type PlanResult = {
  trade: string;
  phases: Array<{ name: string; durationDays: number; tasks: string[]; milestoneTitle: string }>;
  totalDays: number;
  criticalPath: string[];
};

type PaymentResult = {
  canRelease: boolean; blockers: string[]; escrowStatus: string; requiredActions: string[];
};

// ── Agent icons ───────────────────────────────────────────────────────────────

const AGENT_META: Record<string, { icon: typeof Bot; color: string; role: string }> = {
  marketplace: { icon: Layers,       color: "#818cf8", role: "Conecta demanda con oferta" },
  buildops:    { icon: Zap,          color: "#67e8f9", role: "Organiza proyectos y milestones" },
  protools:    { icon: Brain,        color: "#fcd34d", role: "Calcula materiales y costos" },
  evidence:    { icon: Eye,          color: "#86efac", role: "Protege con fotos y trazabilidad" },
  crowd:       { icon: DollarSign,   color: "#fb923c", role: "Gestiona pagos y escrow" },
  prometeo:    { icon: Bot,          color: "#c084fc", role: "Explica con RAG y fuentes reales" },
};

// ── Agent Card ────────────────────────────────────────────────────────────────

function AgentCard({ agent }: { agent: AgentStatus }) {
  const meta = AGENT_META[agent.name] ?? { icon: Bot, color: "#94a3b8", role: "Agente SEMSE" };
  const Icon = meta.icon;
  return (
    <div style={{ background: "var(--surface)", border: `1px solid ${agent.active ? meta.color + "40" : "var(--border)"}`, borderRadius: 14, padding: "16px 18px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
        <div style={{ width: 40, height: 40, borderRadius: 12, background: `${meta.color}15`, display: "grid", placeItems: "center" }}>
          <Icon size={18} color={meta.color} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: "var(--ink)", textTransform: "capitalize" }}>{agent.name}</div>
          <div style={{ fontSize: 11, color: "var(--muted)" }}>{meta.role}</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 10, fontWeight: 700, color: agent.active ? "#86efac" : "#475569" }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: agent.active ? "#86efac" : "#475569" }} />
          {agent.active ? "activo" : "idle"}
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
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
    </div>
  );
}

// ── Playground ────────────────────────────────────────────────────────────────

function PlaygroundSection() {
  const [tab, setTab] = useState<"classify" | "plan" | "payment">("classify");

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

  return (
    <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 16, padding: 20 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 18 }}>
        <Send size={15} color="#818cf8" />
        <h2 style={{ margin: 0, fontSize: 15, fontWeight: 800 }}>Playground de Agentes</h2>
      </div>

      <div style={{ display: "flex", gap: 4, marginBottom: 18, background: "rgba(255,255,255,.03)", padding: 4, borderRadius: 10, border: "1px solid var(--border)", width: "fit-content" }}>
        {([["classify", "Marketplace"], ["plan", "BuildOps"], ["payment", "Crowd"]] as [string, string][]).map(([t, label]) => (
          <button key={t} onClick={() => setTab(t as typeof tab)} style={{ padding: "6px 14px", borderRadius: 7, border: "none", cursor: "pointer", fontSize: 11, fontWeight: 700, background: tab === t ? "rgba(99,102,241,.2)" : "transparent", color: tab === t ? "#818cf8" : "var(--muted)" }}>
            {label}
          </button>
        ))}
      </div>

      {tab === "classify" && (
        <div style={{ display: "grid", gap: 12 }}>
          <textarea value={desc} onChange={(e) => setDesc(e.target.value)} rows={3}
            style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid var(--border)", background: "rgba(255,255,255,.05)", color: "var(--ink)", fontSize: 12, resize: "vertical", boxSizing: "border-box" }} />
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <input type="number" value={area} onChange={(e) => setArea(e.target.value)} placeholder="Área (sqft)" style={{ width: 120, padding: "8px 10px", borderRadius: 8, border: "1px solid var(--border)", background: "rgba(255,255,255,.05)", color: "var(--ink)", fontSize: 12 }} />
            <button onClick={runClassify} disabled={classifying} style={{ padding: "8px 20px", borderRadius: 8, background: "rgba(99,102,241,.15)", border: "none", cursor: "pointer", color: "#818cf8", fontWeight: 700, fontSize: 12 }}>
              {classifying ? "Clasificando…" : "Clasificar"}
            </button>
          </div>
          {classifyResult && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, padding: 12, background: "rgba(99,102,241,.06)", borderRadius: 10 }}>
              {[
                { label: "Trade",    value: classifyResult.trade },
                { label: "Urgencia", value: classifyResult.urgency },
                { label: "Horas",    value: `${classifyResult.estimatedHours}h` },
                { label: "Budget",   value: `$${classifyResult.suggestedBudgetMin.toLocaleString()}–$${classifyResult.suggestedBudgetMax.toLocaleString()}` },
                { label: "Match",    value: `${classifyResult.matchScore}%` },
                { label: "Complejidad", value: classifyResult.complexity },
              ].map(({ label, value }) => (
                <div key={label}>
                  <div style={{ fontSize: 9, color: "var(--muted)", fontWeight: 700 }}>{label}</div>
                  <div style={{ fontSize: 13, fontWeight: 800, color: "#818cf8" }}>{value}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === "plan" && (
        <div style={{ display: "grid", gap: 12 }}>
          <div style={{ display: "flex", gap: 10 }}>
            <select value={planTrade} onChange={(e) => setPlanTrade(e.target.value)} style={{ flex: 1, padding: "8px 10px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--ink)", fontSize: 12 }}>
              {["electrical","plumbing","drywall","painting","hvac","roofing","carpentry","cleaning"].map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <input type="number" value={planHours} onChange={(e) => setPlanHours(e.target.value)} placeholder="Horas" style={{ width: 90, padding: "8px 10px", borderRadius: 8, border: "1px solid var(--border)", background: "rgba(255,255,255,.05)", color: "var(--ink)", fontSize: 12 }} />
            <button onClick={runPlan} disabled={planning} style={{ padding: "8px 20px", borderRadius: 8, background: "rgba(103,232,249,.1)", border: "none", cursor: "pointer", color: "#67e8f9", fontWeight: 700, fontSize: 12 }}>
              {planning ? "Planificando…" : "Crear plan"}
            </button>
          </div>
          {planResult && (
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
        </div>
      )}

      {tab === "payment" && (
        <div style={{ display: "grid", gap: 12 }}>
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
          {paymentResult && (
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
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AgentsPage() {
  const [status,  setStatus]  = useState<BusStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [lastAt,  setLastAt]  = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/semse/agents/status");
      if (!res.ok) return;
      const json = await res.json() as { data: BusStatus };
      setStatus(json.data ?? null);
      setLastAt(new Date().toLocaleTimeString("es-MX"));
    } catch { /* silent */ } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    void load();
    const t = setInterval(() => void load(), 15_000);
    return () => clearInterval(t);
  }, [load]);

  const totalMessages = status?.agents.reduce((s, a) => s + a.processedMessages, 0) ?? 0;
  const activeAgents  = status?.agents.filter((a) => a.active).length ?? 0;
  const totalErrors   = status?.agents.reduce((s, a) => s + a.errors, 0) ?? 0;

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "28px 20px", color: "var(--ink)" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 24 }}>
        <div style={{ width: 44, height: 44, borderRadius: 14, background: "rgba(99,102,241,.15)", display: "grid", placeItems: "center" }}>
          <Bot size={20} color="#818cf8" />
        </div>
        <div style={{ flex: 1 }}>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 900 }}>SEMSE Agents</h1>
          <p style={{ margin: 0, fontSize: 12, color: "var(--muted)" }}>
            6 agentes especializados · Message bus · {lastAt ?? "cargando…"}
          </p>
        </div>
        <button onClick={load} disabled={loading}
          style={{ padding: "8px 14px", borderRadius: 10, background: "rgba(255,255,255,.05)", border: "1px solid var(--border)", cursor: "pointer", color: "var(--muted)" }}>
          <RefreshCw size={12} style={{ animation: loading ? "spin 1s linear infinite" : "none" }} />
        </button>
      </div>

      {/* Summary */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 20 }}>
        {[
          { label: "Agentes activos",  value: `${activeAgents}/6`,    color: "#86efac", icon: Activity },
          { label: "Mensajes total",   value: String(totalMessages),  color: "#818cf8", icon: Send },
          { label: "Errores total",    value: String(totalErrors),    color: totalErrors > 0 ? "#fca5a5" : "#86efac", icon: Shield },
          { label: "Principio",        value: "Sin violar fronteras", color: "#67e8f9", icon: Layers },
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
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14, marginBottom: 24 }}>
          {status.agents.map((a) => <AgentCard key={a.name} agent={a} />)}
        </div>
      )}

      {/* Playground */}
      <PlaygroundSection />

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
