"use client";

/**
 * Agentes — Catálogo de agentes SEMSE Project
 *
 * "Conversacionales" es un catálogo de personas/UX distinto (marketplace
 * legacy, sin relación con RuntimeAgentRole) — no se toca en este cambio.
 *
 * "Especializados" refleja los RuntimeAgentRole reales de packages/agents.
 * Su estado operacional (reachability) y su madurez vienen EXCLUSIVAMENTE
 * del Capability Reality Registry (ADR-032/037) — este archivo no mantiene
 * ni infiere su propio mapping rol→estado. Lo único local es la
 * presentación (nombre/emoji/color/descripción), que es cosmética y no
 * hace ninguna afirmación de verdad operacional.
 */

import { useEffect, useState } from "react";
import { MessageSquare } from "lucide-react";
import { useAgentPanelState, type PanelAgentId } from "../../../components/ai/agent-panel-state";
import { fetchCapabilityRegistry } from "../../semse-api";
import { deriveSpecializedAgents, reachabilityPresentation, type SpecializedAgent } from "./agent-role-presentation";

// ──────────────────────────────────────────────────────────────────────────────
// Conversational catalog — untouched, unrelated to RuntimeAgentRole
// ──────────────────────────────────────────────────────────────────────────────

const NAMED_AGENTS = [
  { id: "assistant",      name: "Prometeo",       emoji: "◈",  color: "var(--brand)", role: "Asistente general",           desc: "Orquestador principal del ecosistema SEMSE" },
  { id: "marta",          name: "Marta",           emoji: "⚖", color: "var(--violet)", role: "Legal & Compliance",          desc: "Contratos, cláusulas y cumplimiento normativo" },
  { id: "planner",        name: "Planner",         emoji: "🗓", color: "var(--info)", role: "Planificación",              desc: "Crea planes de trabajo y cronogramas" },
  { id: "felix",          name: "Félix",           emoji: "🔍", color: "var(--ok)", role: "Evidencias",                desc: "Fotos, documentos y verificación de trabajo" },
  { id: "escrow",         name: "Escrow",          emoji: "🏦", color: "var(--warn)", role: "Operaciones escrow",        desc: "Monitorea el estado de fondos retenidos" },
  { id: "justus",         name: "Justus",          emoji: "⚡", color: "var(--warn)", role: "Finanzas & Disputas",       desc: "Escrow, facturas, cobros y resolución de conflictos" },
  { id: "legal",          name: "Legal",           emoji: "📜", color: "#6366f1", role: "Marco legal",               desc: "Referencia de contratos y cumplimiento normativo" },
  { id: "vesper",         name: "Vesper",          emoji: "🌙", color: "#0ea5e9", role: "Análisis nocturno",         desc: "Análisis de datos y reportes en background" },
  { id: "security",       name: "Security",        emoji: "🛡", color: "#dc2626", role: "Seguridad",                 desc: "Monitorea amenazas y accesos sospechosos" },
  { id: "pulse",          name: "Pulse",           emoji: "📊", color: "#f97316", role: "Métricas & Salud",          desc: "KPIs, actividad y salud operativa del sistema" },
  { id: "binary",         name: "Binary",          emoji: "⚙", color: "#64748b", role: "Infraestructura",           desc: "Estado del sistema, logs y servicios técnicos" },
  { id: "tech",           name: "Tech",            emoji: "💻", color: "var(--violet)", role: "Soporte técnico",           desc: "Resolución de problemas técnicos de la plataforma" },
  { id: "design",         name: "Design",          emoji: "🎨", color: "#ec4899", role: "UX & Diseño",              desc: "Guías de estilo y decisiones de interfaz" },
  { id: "marketing",      name: "Marketing",       emoji: "📣", color: "var(--warn)", role: "Crecimiento",              desc: "Estrategias de adquisición y retención" },
  { id: "health",         name: "Health",          emoji: "💚", color: "#22c55e", role: "Bienestar",                desc: "Monitorea la salud del ecosistema y sus actores" },
  { id: "evidence_coach", name: "Evidence Coach",  emoji: "📷", color: "#14b8a6", role: "Evidencias",               desc: "Guía a profesionales en carga de evidencia" },
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
// Specialized catalog data (reachability/maturity/presentation) comes from
// ./agent-role-presentation.ts, which sources everything except cosmetics
// from the Capability Registry response — see that file's own doc comment.
// ──────────────────────────────────────────────────────────────────────────────

const TABS = ["Conversacionales", "Especializados"] as const;
type Tab = typeof TABS[number];

export default function AgentsPage() {
  const [tab, setTab] = useState<Tab>("Conversacionales");
  const [selected, setSelected] = useState<string | null>(null);
  const { openPanel, setSelectedAgentId, setActiveConversationId } = useAgentPanelState();

  const [specializedAgents, setSpecializedAgents] = useState<SpecializedAgent[]>([]);
  const [capState, setCapState] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    let cancelled = false;
    setCapState("loading");
    fetchCapabilityRegistry()
      .then((capabilities) => {
        if (cancelled) return;
        setSpecializedAgents(deriveSpecializedAgents(capabilities));
        setCapState("ready");
      })
      .catch(() => {
        if (cancelled) return;
        // Loading/error never fabricates availability — an empty, explicit
        // error state beats guessing every role is fine.
        setSpecializedAgents([]);
        setCapState("error");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div style={{ maxWidth: "1000px", margin: "0 auto" }}>
      {/* Header */}
      <div style={{ marginBottom: "24px" }}>
        <h1 style={{ fontSize: "22px", fontWeight: 800, color: "var(--ink)", marginBottom: "4px" }}>
          Catálogo de Agentes
        </h1>
        <p style={{ fontSize: "13px", color: "var(--muted)" }}>
          {NAMED_AGENTS.length} agentes conversacionales ·{" "}
          {capState === "ready" ? `${specializedAgents.length} agentes especializados del backend SEMSE Project` : "cargando agentes especializados del backend…"}
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

      {tab === "Especializados" && capState === "error" && (
        <p style={{ fontSize: "12px", color: "var(--error)", marginBottom: "16px" }}>
          No se pudo cargar el estado operacional desde el Capability Registry. Reintentá más tarde — no se muestra ningún agente como disponible mientras esto falla.
        </p>
      )}

      {/* Agent Grid */}
      {tab === "Conversacionales" ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "10px" }}>
          {NAMED_AGENTS.map(agent => {
            const isSelected = selected === agent.id;
            const routedAgent = PANEL_AGENT_ROUTE_MAP[agent.id];
            const directChat = routedAgent === agent.id;
            return (
              <button
                key={agent.id}
                onClick={() => setSelected(isSelected ? null : agent.id)}
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
                <div style={{
                  width: "40px", height: "40px", borderRadius: "12px",
                  background: `${agent.color}20`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: "20px",
                }}>
                  {agent.emoji}
                </div>
                <div>
                  <p style={{ fontSize: "13px", fontWeight: 800, color: "var(--ink)", marginBottom: "2px" }}>{agent.name}</p>
                  <p style={{ fontSize: "10px", fontWeight: 700, color: agent.color, marginBottom: "4px", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                    {agent.role}
                  </p>
                  <p style={{ fontSize: "11px", color: "var(--muted)", lineHeight: 1.4 }}>{agent.desc}</p>
                </div>
                <div style={{ marginTop: "auto", display: "flex", alignItems: "center", gap: "5px" }}>
                  <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: "var(--ok)" }} />
                  <span style={{ fontSize: "10px", color: "var(--faint)" }}>
                    {directChat ? "Chat directo" : `Canalizado vía ${PANEL_AGENT_LABELS[routedAgent ?? "assistant"]}`}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "10px" }}>
          {specializedAgents.map(agent => {
            const isSelected = selected === agent.id;
            // Loading never renders a status dot at all — no color implies
            // "fine" while the real state is still unknown.
            const status = capState === "loading" ? null : reachabilityPresentation(agent.reachability);
            return (
              <button
                key={agent.id}
                onClick={() => setSelected(isSelected ? null : agent.id)}
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
                <div style={{
                  width: "40px", height: "40px", borderRadius: "12px",
                  background: `${agent.color}20`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: "20px",
                }}>
                  {agent.emoji}
                </div>
                <div>
                  <p style={{ fontSize: "13px", fontWeight: 800, color: "var(--ink)", marginBottom: "2px" }}>{agent.name}</p>
                  <p style={{ fontSize: "10px", fontWeight: 700, color: "var(--faint)", marginBottom: "4px", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                    Madurez: {agent.maturity}
                  </p>
                  <p style={{ fontSize: "11px", color: "var(--muted)", lineHeight: 1.4 }}>{agent.desc}</p>
                </div>
                <div style={{ marginTop: "auto", display: "flex", alignItems: "center", gap: "5px" }}>
                  {status && <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: status.dot }} />}
                  <span style={{ fontSize: "10px", color: "var(--faint)" }}>
                    {status ? status.label : "Verificando estado…"}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Selected agent detail */}
      {selected && tab === "Conversacionales" && (() => {
        const agent = NAMED_AGENTS.find(a => a.id === selected);
        if (!agent) return null;
        const routedAgent = PANEL_AGENT_ROUTE_MAP[agent.id] ?? "assistant";
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
                <p style={{ fontSize: "12px", color: agent.color, fontWeight: 600 }}>{agent.role}</p>
              </div>
            </div>
            <p style={{ fontSize: "13px", color: "var(--ink)", lineHeight: 1.6, marginBottom: "14px" }}>{agent.desc}</p>
            {!directChat && (
              <p style={{ fontSize: "12px", color: "var(--muted)", marginBottom: "12px" }}>
                Este agente abre su conversación dentro de <strong>{PANEL_AGENT_LABELS[routedAgent]}</strong>, que hoy es uno de los 6 agentes operativos del panel.
              </p>
            )}
            <button
              onClick={() => {
                setSelectedAgentId(routedAgent);
                setActiveConversationId(null);
                openPanel(routedAgent);
              }}
              style={{
                padding: "9px 18px", borderRadius: "8px", border: "none",
                background: agent.color, color: "#fff",
                fontSize: "13px", fontWeight: 700, cursor: "pointer",
                display: "inline-flex", alignItems: "center", gap: "6px",
              }}
            >
              <MessageSquare size={13} /> {directChat ? `Chatear con ${agent.name}` : `Abrir en ${PANEL_AGENT_LABELS[routedAgent]}`}
            </button>
          </div>
        );
      })()}

      {selected && tab === "Especializados" && (() => {
        const agent = specializedAgents.find(a => a.id === selected);
        if (!agent) return null;
        const status = reachabilityPresentation(agent.reachability);
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
                <p style={{ fontSize: "12px", color: agent.color, fontWeight: 600 }}>Madurez: {agent.maturity}</p>
              </div>
            </div>
            <p style={{ fontSize: "13px", color: "var(--ink)", lineHeight: 1.6, marginBottom: "10px" }}>{agent.desc}</p>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <div style={{ width: "7px", height: "7px", borderRadius: "50%", background: status.dot }} />
              <span style={{ fontSize: "12px", color: "var(--muted)" }}>{status.label}</span>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
