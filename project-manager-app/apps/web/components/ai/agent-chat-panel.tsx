"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { NAMED_AGENTS, type NamedAgentRole } from "@semse/agents";
import { AgentChatPanel as SharedAgentChatPanel } from "@semse/ui";
import {
  chatWithPrometeo,
  fetchPrometeoOperationalContext,
  assistantPublishJob,
  type AssistantPublishJobResponse,
  type PrometeoChatResponse,
  type PrometeoOperationalContext,
  type PrometeoRouteView,
} from "../../app/semse-api";
import { cn } from "../../lib/cn";
import { useAgentPanelState, type PanelAgentId } from "./agent-panel-state";
import { DraftPreviewCard } from "./draft-preview-card";

// ── Tipos ─────────────────────────────────────────────────────

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  agentId: string;
  ts: number;
}

type PanelStatus = "idle" | "open" | "minimized";

// ── Panel agents — 6 agentes curados del catálogo @semse/agents ─

const PANEL_AGENT_IDS = ["assistant", "marta", "felix", "pulse", "justus", "planner"] as const;
type AgentId = PanelAgentId;

const PANEL_AGENT_SET = new Set<string>(PANEL_AGENT_IDS);

/** Emojis de display para el panel de chat (preocupación de UI) */
const PANEL_EMOJIS: Record<AgentId, string> = {
  assistant: "◈",
  marta:     "⚖",
  felix:     "🔍",
  pulse:     "📊",
  justus:    "⚡",
  planner:   "🗓",
};

interface PanelAgent {
  id: AgentId;
  name: string;
  emoji: string;
  color: string;
  desc: string;
}

const PANEL_AGENT_FALLBACKS: Record<AgentId, Omit<PanelAgent, "id">> = {
  assistant: { name: "Prometeo", emoji: "◈", color: "#3b82f6", desc: "Orquestador principal del ecosistema SEMSE" },
  marta: { name: "Marta", emoji: "⚖", color: "#8b5cf6", desc: "Legal, cumplimiento y contratos" },
  felix: { name: "Felix", emoji: "🔍", color: "#10b981", desc: "Evidencia, documentos y verificación" },
  pulse: { name: "Pulse", emoji: "📊", color: "#f97316", desc: "Métricas, salud operativa y actividad" },
  justus: { name: "Justus", emoji: "⚡", color: "#ef4444", desc: "Pagos, escrow y disputas" },
  planner: { name: "Planner", emoji: "🗓", color: "#06b6d4", desc: "Agenda, hitos y próximos pasos" },
};

function isPanelAgentId(value: string | null | undefined): value is AgentId {
  return typeof value === "string" && PANEL_AGENT_SET.has(value);
}

function getPanelAgent(id: AgentId): PanelAgent {
  const fallback = PANEL_AGENT_FALLBACKS[id];
  const namedAgent = NAMED_AGENTS[id as NamedAgentRole];
  return {
    id,
    name: namedAgent?.name ?? fallback.name,
    emoji: PANEL_EMOJIS[id],
    color: namedAgent?.color ?? fallback.color,
    desc: namedAgent?.description ?? fallback.desc,
  };
}

function displayText(value: unknown, fallback = ""): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (value && typeof value === "object" && "message" in value) {
    const message = (value as { message?: unknown }).message;
    if (typeof message === "string") return message;
  }
  return fallback;
}

const QUICK_AGENTS: PanelAgent[] = PANEL_AGENT_IDS.map((id) => getPanelAgent(id));

// ── Constantes ────────────────────────────────────────────────

const RUNTIME_ENABLED =
  typeof process !== "undefined"
    ? process.env.NEXT_PUBLIC_SEMSE_RUNTIME_ENABLED?.trim() === "true"
    : false;

const SUGGESTIONS: Record<AgentId, string[]> = {
  assistant: ["Dame un resumen operativo", "Qué riesgos ves ahora", "Qué debería hacer después"],
  marta:     ["Resumen de escrow y pagos", "Qué bloquea liberar fondos", "Qué revisar en el contrato"],
  felix:     ["Qué evidencia falta", "Qué documentos revisarías", "Estado de verificación actual"],
  pulse:     ["Resumen de KPIs", "Dónde está el cuello de botella", "Qué métrica cayó primero"],
  justus:    ["Hay disputas abiertas", "Qué evidencia pedirías", "Cuál es el siguiente paso legal"],
  planner:   ["Ordena los próximos hitos", "Qué prioridad recomiendas", "Dame un plan de acción corto"],
};

type LastReplyMeta = {
  mode: PrometeoChatResponse["mode"];
  route?: PrometeoRouteView;
  provider?: string;
  model?: string;
  context?: PrometeoOperationalContext;
  timestamp?: string;
};

// ── Hook de chat ─────────────────────────────────────────────

function buildWelcomeMessage(agentId: AgentId): ChatMessage {
  const agent = QUICK_AGENTS.find((item) => item.id === agentId);
  return {
    id: "welcome",
    role: "assistant",
    agentId,
    content: `Hola, soy ${agent?.name ?? "Prometeo"}. ¿En qué puedo ayudarte?`,
    ts: Date.now(),
  };
}

function isPublishJobIntent(text: string): boolean {
  const lower = text.toLowerCase();
  return (
    lower.includes("publicar trabajo") ||
    lower.includes("quiero publicar") ||
    lower.includes("necesito publicar") ||
    lower.includes("publish job") ||
    lower.includes("crear trabajo") ||
    lower.includes("nuevo trabajo")
  );
}

function useAgentChat(
  activeAgent: AgentId,
  activeConversationId: string | null,
  selectedProjectId: string | null,
  pathname: string | null,
  setActiveConversationId: (conversationId: string | null) => void,
) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    buildWelcomeMessage(activeAgent),
  ]);
  const [thinking, setThinking] = useState(false);
  const [lastReplyMeta, setLastReplyMeta] = useState<LastReplyMeta | null>(null);
  const [publishJobDraft, setPublishJobDraft] = useState<AssistantPublishJobResponse | null>(null);
  const [publishJobSessionId, setPublishJobSessionId] = useState<string | null>(null);

  useEffect(() => {
    setMessages([buildWelcomeMessage(activeAgent)]);
    setLastReplyMeta(null);
    setPublishJobDraft(null);
    setPublishJobSessionId(null);
  }, [activeAgent]);

  const sendMessage = useCallback(
    async (content: string) => {
      const userMsg: ChatMessage = {
        id: `u-${Date.now()}`,
        role: "user",
        agentId: activeAgent,
        content,
        ts: Date.now(),
      };
      setMessages(prev => [...prev, userMsg]);
      setThinking(true);

      const isAssistant = activeAgent === "assistant";
      const inPublishJobMode = isAssistant && (publishJobDraft !== null || isPublishJobIntent(content));

      try {
        if (inPublishJobMode) {
          const result = await assistantPublishJob({
            message: content,
            draftId: publishJobDraft?.draftId ?? undefined,
            sessionId: publishJobSessionId ?? undefined,
            pageRoute: pathname ?? undefined,
          });

          setPublishJobDraft(result);
          setPublishJobSessionId(result.sessionId);

          setMessages(prev => [
            ...prev,
            {
              id: `a-${Date.now()}`,
              role: "assistant",
              agentId: activeAgent,
              content: result.reply,
              ts: Date.now(),
            },
          ]);
        } else {
          const data = await chatWithPrometeo({
            message: content,
            agentId: activeAgent,
            threadId: activeConversationId ?? undefined,
            projectId: selectedProjectId ?? undefined,
          });

          const { response, threadId } = data;
          if (threadId) setActiveConversationId(threadId);
          setLastReplyMeta({
            mode: data.mode,
            route: data.route,
            provider: data.provider,
            model: data.model ?? data.modelSlug,
            context: data.context,
            timestamp: data.timestamp,
          });

          setMessages(prev => [
            ...prev,
            {
              id: `a-${Date.now()}`,
              role: "assistant",
              agentId: activeAgent,
              content: response,
              ts: Date.now(),
            },
          ]);
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Error de conexión";
        setMessages(prev => [
          ...prev,
          {
            id: `err-${Date.now()}`,
            role: "assistant",
            agentId: "assistant",
            content: `⚠ ${msg}`,
            ts: Date.now(),
          },
        ]);
      } finally {
        setThinking(false);
      }
    },
    [activeAgent, activeConversationId, selectedProjectId, pathname, publishJobDraft, publishJobSessionId, setActiveConversationId]
  );

  const clearHistory = useCallback(() => {
    setActiveConversationId(null);
    setMessages([buildWelcomeMessage(activeAgent)]);
    setLastReplyMeta(null);
    setPublishJobDraft(null);
    setPublishJobSessionId(null);
  }, [activeAgent, setActiveConversationId]);

  return { messages, thinking, sendMessage, clearHistory, lastReplyMeta, publishJobDraft };
}

// ── Componente principal ──────────────────────────────────────

export function AgentChatPanel() {
  const [input, setInput] = useState("");
  const pathname = usePathname();
  const {
    selectedAgentId,
    activeConversationId,
    agentPanelMode,
    selectedProjectId,
    setSelectedAgentId,
    setActiveConversationId,
    setSelectedProjectId,
    openPanel,
    closePanel,
  } = useAgentPanelState();
  const [context, setContext] = useState<PrometeoOperationalContext | null>(null);
  const activeAgent = isPanelAgentId(selectedAgentId) ? selectedAgentId : "assistant";
  const routeProjectId = useMemo(() => {
    const match = pathname?.match(/\/(?:client|worker)\/projects\/([^/]+)/)
      ?? pathname?.match(/\/projects\/([^/]+)/);
    return match?.[1] ?? null;
  }, [pathname]);
  const effectiveProjectId = routeProjectId ?? selectedProjectId;
  const { messages, thinking, sendMessage, clearHistory, lastReplyMeta, publishJobDraft } = useAgentChat(
    activeAgent,
    activeConversationId,
    effectiveProjectId,
    pathname,
    setActiveConversationId,
  );
  useEffect(() => {
    if (selectedAgentId !== activeAgent) {
      setSelectedAgentId(activeAgent);
    }
  }, [activeAgent, selectedAgentId, setSelectedAgentId]);

  const isOpen = agentPanelMode === "open";
  const agent = getPanelAgent(activeAgent);
  const suggestions = SUGGESTIONS[activeAgent] ?? SUGGESTIONS.assistant;
  const unreadCount = agentPanelMode !== "open" ? messages.filter(m => m.role === "assistant").length - 1 : 0;
  const placeholder = `Pregunta a ${agent.name} por contexto, riesgos o próximos pasos...`;

  useEffect(() => {
    if (!routeProjectId || routeProjectId === selectedProjectId) {
      return;
    }
    setSelectedProjectId(routeProjectId);
    setActiveConversationId(null);
  }, [routeProjectId, selectedProjectId, setActiveConversationId, setSelectedProjectId]);

  useEffect(() => {
    if (!isOpen) return;
    fetchPrometeoOperationalContext(effectiveProjectId ?? undefined)
      .then((ctx) => setContext(ctx))
      .catch(() => setContext(null));
  }, [effectiveProjectId, isOpen]);

  function handleSend() {
    const trimmed = input.trim();
    if (!trimmed || thinking) return;
    setInput("");
    void sendMessage(trimmed);
  }

  function switchAgent(id: AgentId) {
    setSelectedAgentId(id);
    clearHistory();
  }

  const liveContext = lastReplyMeta?.context ?? context;

  const statusBits = [
    RUNTIME_ENABLED ? (liveContext?.mode ?? "local").toUpperCase() : "DEMO",
    liveContext?.activeProject ? `Proyecto: ${liveContext.activeProject.title}` : "Sin proyecto",
  ];
  const statusLabel = `${agent.desc} · ${statusBits.join(" · ")}`;

  return (
    <>
      {isOpen && (
        <div
          style={{
            position: "fixed", inset: 0, zIndex: 300,
            background: "rgba(5, 8, 20, 0.97)",
            backdropFilter: "blur(12px)",
            display: "flex", flexDirection: "column",
          }}
        >
          {/* Header bar */}
          <div style={{
            display: "flex", alignItems: "center", gap: 12,
            padding: "14px 20px", borderBottom: "1px solid rgba(255,255,255,0.08)",
            background: "rgba(15,20,40,0.95)",
          }}>
            {/* Agent quick-switch */}
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {QUICK_AGENTS.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => switchAgent(a.id as AgentId)}
                  style={{
                    padding: "5px 12px", borderRadius: 99, fontSize: 12, fontWeight: 700,
                    border: `1px solid ${a.id === activeAgent ? a.color : "rgba(255,255,255,0.1)"}`,
                    background: a.id === activeAgent ? `${a.color}22` : "transparent",
                    color: a.id === activeAgent ? a.color : "rgba(255,255,255,0.45)",
                    cursor: "pointer", transition: "all 0.15s",
                  }}
                >
                  {a.emoji} {a.name}
                </button>
              ))}
            </div>
            <div style={{ flex: 1 }} />
            {/* Context pill */}
            {liveContext && (
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", whiteSpace: "nowrap" }}>
                {liveContext.activeProject ? `📁 ${liveContext.activeProject.title}` : "Sin proyecto"}
                {" · "}{RUNTIME_ENABLED ? (liveContext.mode ?? "local").toUpperCase() : "DEMO"}
              </div>
            )}
            <button
              type="button"
              onClick={() => closePanel()}
              style={{
                padding: "6px 14px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.12)",
                background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.7)",
                fontSize: 12, fontWeight: 600, cursor: "pointer",
              }}
            >
              Cerrar ✕
            </button>
          </div>

          {/* Agent identity strip */}
          <div style={{
            display: "flex", alignItems: "center", gap: 12,
            padding: "12px 24px",
            borderBottom: "1px solid rgba(255,255,255,0.05)",
          }}>
            <div style={{
              width: 42, height: 42, borderRadius: 14, fontSize: 22,
              display: "grid", placeItems: "center",
              background: `${agent.color}22`, border: `1px solid ${agent.color}44`,
            }}>
              {agent.emoji}
            </div>
            <div>
              <div style={{ fontWeight: 800, fontSize: 16, color: agent.color }}>{agent.name}</div>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.45)" }}>{agent.desc}</div>
            </div>
            {lastReplyMeta?.route && (
              <div style={{ marginLeft: "auto", fontSize: 11, color: "rgba(100,200,255,0.6)", textAlign: "right" }}>
                via {lastReplyMeta.route.primaryAgent} · {lastReplyMeta.mode}
                {lastReplyMeta.provider ? ` · ${lastReplyMeta.provider}` : ""}
              </div>
            )}
          </div>

          {/* Messages area */}
          <div style={{
            flex: 1, overflowY: "auto", padding: "24px",
            display: "flex", flexDirection: "column", gap: 16,
            maxWidth: 860, width: "100%", margin: "0 auto",
          }}>
            {messages.map((message, index) => (
              <div
                key={message.id}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: message.role === "user" ? "flex-end" : "flex-start",
                }}
              >
                <div style={{ display: "flex", justifyContent: message.role === "user" ? "flex-end" : "flex-start", width: "100%" }}>
                  {message.role === "assistant" && (
                    <div style={{
                      width: 32, height: 32, borderRadius: 10, fontSize: 16,
                      display: "grid", placeItems: "center", marginRight: 10, flexShrink: 0,
                      background: `${agent.color}22`, border: `1px solid ${agent.color}33`,
                    }}>
                      {agent.emoji}
                    </div>
                  )}
                  <div
                    style={{
                      maxWidth: "75%", padding: "12px 16px", borderRadius: 18, fontSize: 14,
                      lineHeight: 1.7, whiteSpace: "pre-wrap",
                      background: message.role === "user"
                        ? `linear-gradient(135deg, ${agent.color}33, ${agent.color}22)`
                        : "rgba(255,255,255,0.06)",
                      border: message.role === "user"
                        ? `1px solid ${agent.color}44`
                        : "1px solid rgba(255,255,255,0.08)",
                      color: message.role === "user" ? "#e2e8f0" : "#cbd5e1",
                      borderTopRightRadius: message.role === "user" ? 4 : 18,
                      borderTopLeftRadius: message.role === "assistant" ? 4 : 18,
                    }}
                  >
                    {displayText(message.content)}
                  </div>
                </div>
                {message.role === "assistant" && index === messages.length - 1 && publishJobDraft && (
                  <div style={{ marginLeft: 42, marginTop: 8 }}>
                    <DraftPreviewCard
                      draft={publishJobDraft.draft}
                      prefillHref={publishJobDraft.prefillHref}
                      budgetSuggestion={publishJobDraft.budgetSuggestion}
                    />
                  </div>
                )}
              </div>
            ))}
            {thinking && (
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{
                  width: 32, height: 32, borderRadius: 10, fontSize: 16,
                  display: "grid", placeItems: "center",
                  background: `${agent.color}22`, border: `1px solid ${agent.color}33`,
                }}>
                  {agent.emoji}
                </div>
                <div style={{
                  padding: "12px 16px", borderRadius: 18, borderTopLeftRadius: 4,
                  background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)",
                  fontSize: 14, color: "rgba(255,255,255,0.4)",
                }}>
                  <span style={{ animation: "pulse 1.5s infinite" }}>Pensando...</span>
                </div>
              </div>
            )}
          </div>

          {/* Suggestions */}
          {suggestions.length > 0 && messages.length <= 2 && (
            <div style={{
              padding: "0 24px 12px", display: "flex", flexWrap: "wrap", gap: 8,
              maxWidth: 860, width: "100%", margin: "0 auto",
            }}>
              {suggestions.map(s => (
                <button key={s} type="button" onClick={() => void sendMessage(s)}
                  style={{
                    padding: "7px 14px", borderRadius: 99, fontSize: 12, fontWeight: 600,
                    border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.04)",
                    color: "rgba(255,255,255,0.6)", cursor: "pointer",
                  }}>
                  {s}
                </button>
              ))}
            </div>
          )}

          {/* Input bar */}
          <div style={{
            padding: "16px 24px", borderTop: "1px solid rgba(255,255,255,0.08)",
            background: "rgba(10,15,30,0.95)",
            maxWidth: 860, width: "100%", margin: "0 auto",
          }}>
            <div style={{ display: "flex", gap: 10, alignItems: "flex-end" }}>
              <textarea
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
                }}
                placeholder={placeholder}
                rows={2}
                style={{
                  flex: 1, borderRadius: 16, padding: "12px 16px",
                  border: "1px solid rgba(255,255,255,0.12)",
                  background: "rgba(255,255,255,0.06)", color: "#e2e8f0",
                  fontSize: 14, resize: "none", outline: "none",
                  fontFamily: "inherit",
                }}
              />
              <button
                type="button"
                onClick={handleSend}
                disabled={thinking || !input.trim()}
                style={{
                  padding: "12px 24px", borderRadius: 14, border: "none",
                  background: thinking || !input.trim() ? "rgba(255,255,255,0.08)" : agent.color,
                  color: thinking || !input.trim() ? "rgba(255,255,255,0.3)" : "#0a0a14",
                  fontWeight: 800, fontSize: 14, cursor: thinking ? "not-allowed" : "pointer",
                  transition: "all 0.15s",
                }}
              >
                Enviar
              </button>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8 }}>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.25)" }}>
                Enter para enviar · Shift+Enter para nueva línea
              </div>
              <div style={{ display: "flex", gap: 12 }}>
                {activeAgent !== "assistant" && (
                  <button type="button" onClick={() => switchAgent("assistant")}
                    style={{ fontSize: 11, color: "rgba(100,200,255,0.6)", background: "none", border: "none", cursor: "pointer" }}>
                    ← Volver a Prometeo
                  </button>
                )}
                <button type="button" onClick={clearHistory}
                  style={{ fontSize: 11, color: "rgba(255,100,100,0.5)", background: "none", border: "none", cursor: "pointer" }}>
                  Limpiar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}


      {/* FAB — only shown when panel is closed */}
      {!isOpen && (
        <button
          onClick={() => openPanel(activeAgent)}
          style={{
            position: "fixed", bottom: 24, right: 24, zIndex: 200,
            width: 56, height: 56, borderRadius: 18,
            background: `linear-gradient(135deg, ${agent.color}, ${agent.color}cc)`,
            color: "#0a0a14", border: "none", cursor: "pointer",
            fontSize: 22, fontWeight: 900,
            boxShadow: `0 8px 28px ${agent.color}55`,
            display: "flex", alignItems: "center", justifyContent: "center",
            transition: "transform 0.15s, box-shadow 0.15s",
          }}
          aria-label={`Abrir ${agent.name}`}
        >
          {agent.emoji}
          {unreadCount > 0 && (
            <span style={{
              position: "absolute", top: -4, right: -4,
              width: 20, height: 20, borderRadius: "50%",
              background: "#ef4444", color: "white",
              fontSize: 10, fontWeight: 800,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </button>
      )}
    </>
  );
}
