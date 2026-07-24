"use client";

/**
 * Agentes — Catálogo de agentes SEMSE OS
 * Muestra los 16 agentes nombrados y 8 especializados del ecosistema
 */

import { useState } from "react";
import { MessageSquare } from "lucide-react";
import { useAgentPanelState, type PanelAgentId } from "../../../components/ai/agent-panel-state";

// ──────────────────────────────────────────────────────────────────────────────
// AGENT CATALOG — mirrored from @semse/agents
// ──────────────────────────────────────────────────────────────────────────────

const NAMED_AGENTS = [
  { id: "assistant",      name: "Prometeo",       emoji: "◈",  color: "#3b82f6", role: "Asistente general",           desc: "Orquestador principal del ecosistema SEMSE" },
  { id: "marta",          name: "Marta",           emoji: "⚖", color: "#8b5cf6", role: "Legal & Compliance",          desc: "Contratos, cláusulas y cumplimiento normativo" },
  { id: "planner",        name: "Planner",         emoji: "🗓", color: "#06b6d4", role: "Planificación",              desc: "Crea planes de trabajo y cronogramas" },
  { id: "felix",          name: "Félix",           emoji: "🔍", color: "#10b981", role: "Evidencias",                desc: "Fotos, documentos y verificación de trabajo" },
  { id: "escrow",         name: "Escrow",          emoji: "🏦", color: "#f59e0b", role: "Operaciones escrow",        desc: "Monitorea el estado de fondos retenidos" },
  { id: "justus",         name: "Justus",          emoji: "⚡", color: "#f59e0b", role: "Finanzas & Disputas",       desc: "Escrow, facturas, cobros y resolución de conflictos" },
  { id: "legal",          name: "Legal",           emoji: "📜", color: "#6366f1", role: "Marco legal",               desc: "Referencia de contratos y cumplimiento normativo" },
  { id: "vesper",         name: "Vesper",          emoji: "🌙", color: "#0ea5e9", role: "Análisis nocturno",         desc: "Análisis de datos y reportes en background" },
  { id: "security",       name: "Security",        emoji: "🛡", color: "#dc2626", role: "Seguridad",                 desc: "Monitorea amenazas y accesos sospechosos" },
  { id: "pulse",          name: "Pulse",           emoji: "📊", color: "#f97316", role: "Métricas & Salud",          desc: "KPIs, actividad y salud operativa del sistema" },
  { id: "binary",         name: "Binary",          emoji: "⚙", color: "#64748b", role: "Infraestructura",           desc: "Estado del sistema, logs y servicios técnicos" },
  { id: "tech",           name: "Tech",            emoji: "💻", color: "#8b5cf6", role: "Soporte técnico",           desc: "Resolución de problemas técnicos de la plataforma" },
  { id: "design",         name: "Design",          emoji: "🎨", color: "#ec4899", role: "UX & Diseño",              desc: "Guías de estilo y decisiones de interfaz" },
  { id: "marketing",      name: "Marketing",       emoji: "📣", color: "#f59e0b", role: "Crecimiento",              desc: "Estrategias de adquisición y retención" },
  { id: "health",         name: "Health",          emoji: "💚", color: "#22c55e", role: "Bienestar",                desc: "Monitorea la salud del ecosistema y sus actores" },
  { id: "evidence_coach", name: "Evidence Coach",  emoji: "📷", color: "#14b8a6", role: "Evidencias",               desc: "Guía a profesionales en carga de evidencia" },
] as const;

const SPECIALIZED_AGENTS = [
  { id: "pricing",        name: "Pricing Engine",   emoji: "💰", color: "#f59e0b", desc: "Estimación inteligente de precios por categoría" },
  { id: "job-planner",    name: "Job Planner",       emoji: "📋", color: "#06b6d4", desc: "Generación automática de milestones y cronogramas" },
  { id: "trust-match",    name: "Trust Match",       emoji: "🤝", color: "#10b981", desc: "Matching de clientes y profesionales por confianza" },
  { id: "evidence-coach", name: "Evidence Coach BE", emoji: "🔬", color: "#14b8a6", desc: "Validación y clasificación de evidencia fotográfica" },
  { id: "risk",           name: "Risk Analyzer",     emoji: "⚠", color: "#ef4444", desc: "Evaluación de riesgo en contratos y transacciones" },
  { id: "dispute",        name: "Dispute Resolver",  emoji: "⚖", color: "#8b5cf6", desc: "Análisis y sugerencias para resolución de disputas" },
  { id: "orchestrator",   name: "Orchestrator",      emoji: "◈", color: "#3b82f6", desc: "Coordinación de flujos multi-agente del backend" },
  { id: "ecv",            name: "ECV Agent",         emoji: "✓",  color: "#22c55e", desc: "Verificación electrónica de credenciales" },
] as const;

const PANEL_AGENT_ROUTE_MAP: Record<string, PanelAgentId> = {
  assistant: "assistant",
  marta: "marta",
  planner: "planner",
  felix: "felix",
  pulse: "pulse",
  justus: "justus",
  escrow: "justus",
  legal: "marta",
  evidence_coach: "felix",
  vesper: "pulse",
  binary: "pulse",
  security: "assistant",
  tech: "assistant",
  design: "assistant",
  marketing: "assistant",
  health: "assistant",
};

const PANEL_AGENT_LABELS: Record<PanelAgentId, string> = {
  assistant: "Prometeo",
  marta: "Marta",
  planner: "Planner",
  felix: "Felix",
  pulse: "Pulse",
  justus: "Justus",
};

// ──────────────────────────────────────────────────────────────────────────────

const TABS = ["Conversacionales", "Especializados"] as const;
type Tab = typeof TABS[number];

export default function AgentsPage() {
  const [tab, setTab] = useState<Tab>("Conversacionales");
  const [selected, setSelected] = useState<string | null>(null);
  const { openPanel, setSelectedAgentId, setActiveConversationId } = useAgentPanelState();

  const agents = tab === "Conversacionales" ? NAMED_AGENTS : SPECIALIZED_AGENTS;

  return (
    <div style={{ maxWidth: "1000px", margin: "0 auto" }}>
      {/* Header */}
      <div style={{ marginBottom: "24px" }}>
        <h1 style={{ fontSize: "22px", fontWeight: 800, color: "var(--ink)", marginBottom: "4px" }}>
          Catálogo de Agentes
        </h1>
        <p style={{ fontSize: "13px", color: "var(--muted)" }}>
          {NAMED_AGENTS.length} agentes conversacionales · {SPECIALIZED_AGENTS.length} agentes especializados del backend SEMSE OS
        </p>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: "4px", background: "var(--surface)", padding: "4px", borderRadius: "10px", border: "1px solid var(--border)", marginBottom: "20px", width: "fit-content" }}>
        {TABS.map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              padding: "7px 18px", borderRadius: "7px", border: "none",
              background: tab === t ? "var(--brand)" : "transparent",
              color: tab === t ? "#fff" : "var(--muted)",
              fontSize: "13px", fontWeight: 600, cursor: "pointer",
            }}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Agent Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "10px" }}>
        {agents.map(agent => {
          const isSelected = selected === agent.id;
          const routedAgent = tab === "Conversacionales" ? PANEL_AGENT_ROUTE_MAP[agent.id] : null;
          const directChat = routedAgent === agent.id;
          return (
            <button
              key={agent.id}
              onClick={() => setSelected(isSelected ? null : agent.id)}
              aria-expanded={isSelected}
              aria-label={
                tab === "Conversacionales"
                  ? directChat
                    ? `${agent.name} — ${("role" in agent && agent.role) || ""} — abrir chat directo`
                    : `${agent.name} — ${("role" in agent && agent.role) || ""} — canalizado vía ${PANEL_AGENT_LABELS[routedAgent ?? "assistant"]}`
                  : `${agent.name} — agente especializado del backend, sin chat directo`
              }
              style={{
                display: "flex", flexDirection: "column", alignItems: "flex-start", gap: "10px",
                padding: "16px", borderRadius: "12px", cursor: "pointer", textAlign: "left",
                background: isSelected ? `${agent.color}12` : "var(--surface)",
                border: `1.5px solid ${isSelected ? agent.color : "var(--border)"}`,
                transition: "all 0.15s",
              }}
              onMouseOver={e => { if (!isSelected) e.currentTarget.style.borderColor = agent.color + "60"; }}
              onMouseOut={e => { if (!isSelected) e.currentTarget.style.borderColor = "var(--border)"; }}
            >
              {/* Avatar */}
              <div style={{
                width: "40px", height: "40px", borderRadius: "12px",
                background: `${agent.color}20`,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: "20px",
              }}>
                {agent.emoji}
              </div>

              {/* Info */}
              <div>
                <p style={{ fontSize: "13px", fontWeight: 800, color: "var(--ink)", marginBottom: "2px" }}>{agent.name}</p>
                {"role" in agent && (
                  <p style={{ fontSize: "10px", fontWeight: 700, color: agent.color, marginBottom: "4px", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                    {agent.role}
                  </p>
                )}
                <p style={{ fontSize: "11px", color: "var(--muted)", lineHeight: 1.4 }}>{agent.desc}</p>
              </div>

              {/* Active indicator */}
              <div style={{ marginTop: "auto", display: "flex", alignItems: "center", gap: "5px" }}>
                <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#10b981" }} />
                <span style={{ fontSize: "10px", color: "var(--faint)" }}>
                  {tab === "Conversacionales"
                    ? directChat
                      ? "Chat directo"
                      : `Canalizado vía ${PANEL_AGENT_LABELS[routedAgent ?? "assistant"]}`
                    : "Backend activo"}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Selected agent detail */}
      {selected && (() => {
        const agent = [...NAMED_AGENTS, ...SPECIALIZED_AGENTS].find(a => a.id === selected);
        if (!agent) return null;
        const routedAgent = tab === "Conversacionales" ? PANEL_AGENT_ROUTE_MAP[agent.id] ?? "assistant" : null;
        const directChat = routedAgent === agent.id;
        return (
          <div style={{
            marginTop: "16px",
            padding: "20px",
            background: `${agent.color}08`,
            border: `1px solid ${agent.color}30`,
            borderRadius: "14px",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "12px" }}>
              <div style={{ width: "44px", height: "44px", borderRadius: "12px", background: `${agent.color}20`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "22px" }}>
                {agent.emoji}
              </div>
              <div>
                <p style={{ fontSize: "16px", fontWeight: 800, color: "var(--ink)" }}>{agent.name}</p>
                {"role" in agent && <p style={{ fontSize: "12px", color: agent.color, fontWeight: 600 }}>{agent.role}</p>}
              </div>
            </div>
            <p style={{ fontSize: "13px", color: "var(--ink)", lineHeight: 1.6, marginBottom: "14px" }}>{agent.desc}</p>
            {tab === "Conversacionales" && !directChat && routedAgent && (
              <p style={{ fontSize: "12px", color: "var(--muted)", marginBottom: "12px" }}>
                Este agente abre su conversación dentro de <strong>{PANEL_AGENT_LABELS[routedAgent]}</strong>, que hoy es uno de los 6 agentes operativos del panel.
              </p>
            )}
            {tab === "Conversacionales" && (
              <button
                onClick={() => {
                  const panelAgentId = routedAgent ?? "assistant";
                  setSelectedAgentId(panelAgentId);
                  setActiveConversationId(null);
                  openPanel(panelAgentId);
                }}
                style={{
                  padding: "9px 18px", borderRadius: "8px", border: "none",
                  background: agent.color, color: "#fff",
                  fontSize: "13px", fontWeight: 700, cursor: "pointer",
                  display: "inline-flex", alignItems: "center", gap: "6px",
                }}
              >
                <MessageSquare size={13} /> {directChat ? `Chatear con ${agent.name}` : `Abrir en ${PANEL_AGENT_LABELS[routedAgent ?? "assistant"]}`}
              </button>
            )}
          </div>
        );
      })()}
    </div>
  );
}
