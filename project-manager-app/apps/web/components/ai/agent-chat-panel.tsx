"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { NAMED_AGENTS, type NamedAgentRole } from "@semse/agents";
import {
  chatWithPrometeo,
  fetchPrometeoOperationalContext,
  assistantPublishJob,
  uploadPrometeoAttachment,
  type AssistantPublishJobResponse,
  type PrometeoAttachment,
  type PrometeoChatResponse,
  type PrometeoOperationalContext,
  type PrometeoRouteView,
} from "../../app/semse-api";
import { useAgentPanelState, type PanelAgentId } from "./agent-panel-state";
import { DraftPreviewCard } from "./draft-preview-card";
import {
  PROMETEO_ATTACHMENT_ACCEPT,
  classifyPrometeoAttachment,
  formatPrometeoAttachmentSize,
  getPrometeoAttachmentValidationError,
} from "./prometeo-attachments";

// ── Tipos ─────────────────────────────────────────────────────

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  agentId: string;
  ts: number;
  blocks?: PrometeoChatResponse["blocks"];
  mission?: PrometeoChatResponse["mission"];
  proposedActions?: PrometeoChatResponse["proposedActions"];
  executionResults?: PrometeoChatResponse["executionResults"];
  citations?: PrometeoChatResponse["citations"];
  attachments?: PrometeoAttachment[];
}

type AttachmentDraftStatus = "ready" | "uploading" | "uploaded" | "error";

type AttachmentDraft = {
  id: string;
  file: File;
  source: PrometeoAttachment["source"];
  previewUrl?: string;
  status: AttachmentDraftStatus;
  error?: string;
  remote?: PrometeoAttachment;
};

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

function attachmentIcon(type: PrometeoAttachment["type"]): string {
  if (type === "image") return "🖼";
  if (type === "video") return "🎬";
  if (type === "audio") return "🎙";
  if (type === "document") return "📄";
  return "📎";
}

function describeToolOutput(output: unknown): string | null {
  if (output === undefined || output === null) return null;
  const payload = typeof output === "object" && output !== null && "data" in output
    ? (output as { data?: unknown }).data
    : output;

  if (Array.isArray(payload)) return `${payload.length} registro${payload.length === 1 ? "" : "s"}`;
  if (typeof payload === "string") return payload.slice(0, 180);
  if (typeof payload === "number" || typeof payload === "boolean") return String(payload);
  if (typeof payload === "object" && payload !== null) {
    const keys = Object.keys(payload).slice(0, 4);
    return keys.length > 0 ? `Datos disponibles: ${keys.join(", ")}` : "Resultado disponible";
  }
  return null;
}

function safeCitationUrl(value: string | undefined): string | null {
  if (!value) return null;
  if (value.startsWith("/") && !value.startsWith("//")) return value;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function buildDemoAttachment(draft: AttachmentDraft): PrometeoAttachment {
  const type = classifyPrometeoAttachment(draft.file);
  return {
    id: draft.id,
    type,
    source: draft.source,
    name: draft.file.name,
    mimeType: draft.file.type || "application/octet-stream",
    sizeBytes: draft.file.size,
    metadata: {
      demo: true,
      uploadStatus: "local_only",
      analysisStatus: "not_available",
    },
  };
}

function SentAttachmentPills({ attachments }: { attachments: PrometeoAttachment[] }) {
  if (attachments.length === 0) return null;
  return (
    <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "flex-end", gap: 6, marginTop: 7 }}>
      {attachments.map((attachment) => (
        <span
          key={attachment.id ?? attachment.fileId ?? attachment.name}
          style={{
            maxWidth: 240,
            padding: "5px 8px",
            borderRadius: 9,
            background: "rgba(255,255,255,0.07)",
            border: "1px solid rgba(255,255,255,0.10)",
            color: "rgba(255,255,255,0.65)",
            fontSize: 10,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
          title={attachment.name}
        >
          {attachmentIcon(attachment.type)} {attachment.name ?? "Adjunto"}
        </span>
      ))}
    </div>
  );
}

function AttachmentDraftList({
  drafts,
  onRemove,
}: {
  drafts: AttachmentDraft[];
  onRemove: (id: string) => void;
}) {
  if (drafts.length === 0) return null;

  return (
    <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 10 }} aria-label="Adjuntos preparados">
      {drafts.map((draft) => {
        const type = classifyPrometeoAttachment(draft.file);
        return (
          <div
            key={draft.id}
            style={{
              width: 174,
              flex: "0 0 174px",
              padding: 8,
              borderRadius: 12,
              border: `1px solid ${draft.status === "error" ? "rgba(239,68,68,0.5)" : "rgba(255,255,255,0.11)"}`,
              background: "rgba(255,255,255,0.04)",
            }}
          >
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              {type === "image" && draft.previewUrl ? (
                <div
                  role="img"
                  aria-label={`Vista previa de ${draft.file.name}`}
                  style={{ width: 38, height: 38, borderRadius: 8, background: `center / cover no-repeat url("${draft.previewUrl}") rgba(255,255,255,0.06)` }}
                />
              ) : type === "video" && draft.previewUrl ? (
                <video
                  src={draft.previewUrl}
                  aria-label={`Vista previa de ${draft.file.name}`}
                  muted
                  playsInline
                  style={{ width: 38, height: 38, borderRadius: 8, objectFit: "cover", background: "rgba(255,255,255,0.06)" }}
                />
              ) : (
                <div style={{ width: 38, height: 38, borderRadius: 8, display: "grid", placeItems: "center", background: "rgba(255,255,255,0.06)", fontSize: 18 }}>
                  {attachmentIcon(type)}
                </div>
              )}
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ color: "#e2e8f0", fontSize: 10, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={draft.file.name}>
                  {draft.file.name}
                </div>
                <div style={{ color: "rgba(255,255,255,0.38)", fontSize: 9, marginTop: 2 }}>
                  {formatPrometeoAttachmentSize(draft.file.size)} · {draft.status === "uploading" ? "subiendo" : draft.status === "uploaded" ? "listo" : draft.status === "error" ? "error" : type}
                </div>
              </div>
              <button
                type="button"
                aria-label={`Quitar ${draft.file.name}`}
                onClick={() => onRemove(draft.id)}
                disabled={draft.status === "uploading"}
                style={{ border: 0, background: "transparent", color: "rgba(255,255,255,0.45)", cursor: draft.status === "uploading" ? "not-allowed" : "pointer", padding: 2 }}
              >
                ×
              </button>
            </div>
            {draft.error ? <div style={{ color: "#fca5a5", fontSize: 9, marginTop: 6 }}>{draft.error}</div> : null}
            {(type === "video" || type === "audio") && draft.status !== "error" ? (
              <div style={{ color: "#fbbf24", fontSize: 9, marginTop: 6 }}>El análisis temporal aún no está disponible.</div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
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

function StructuredResponseCards({ message, color }: { message: ChatMessage; color: string }) {
  const actions = message.proposedActions ?? [];
  const mission = message.mission;
  const blocks = message.blocks ?? [];
  const results = message.executionResults ?? [];
  const citations = message.citations ?? [];
  const attachmentBlock = blocks.find((block) => block.type === "attachment_summary");
  const genericBlocks = blocks.filter((block) => (
    block.type !== "attachment_summary"
    && !(mission && block.type === "mission_status")
  ));

  if (!mission && actions.length === 0 && blocks.length === 0 && results.length === 0 && citations.length === 0) return null;

  return (
    <div style={{ marginTop: 8, display: "grid", gap: 8, width: "min(620px, 100%)" }}>
      {mission && (
        <div style={{
          border: "1px solid rgba(255,255,255,0.10)",
          background: "rgba(255,255,255,0.045)",
          borderRadius: 12,
          padding: "10px 12px",
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
            <div style={{ fontSize: 12, fontWeight: 800, color }}>Misión {mission.phase}</div>
            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.45)", textTransform: "uppercase" }}>{mission.status}</div>
          </div>
          {mission.progress ? (
            <div style={{ marginTop: 8 }}>
              <div style={{ height: 5, borderRadius: 99, background: "rgba(255,255,255,0.08)", overflow: "hidden" }}>
                <div style={{ width: `${mission.progress.percent}%`, height: "100%", background: color }} />
              </div>
              <div style={{ marginTop: 4, fontSize: 9, color: "rgba(255,255,255,0.4)" }}>
                {mission.progress.completedSteps}/{mission.progress.totalSteps} pasos · {mission.progress.percent}%
              </div>
            </div>
          ) : null}
          <div style={{ marginTop: 8, display: "grid", gap: 4 }}>
            {mission.steps.slice(0, 5).map((step) => (
              <div key={step.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11, color: "rgba(255,255,255,0.58)" }}>
                <span style={{ width: 7, height: 7, borderRadius: 99, background: step.status === "completed" ? "#10b981" : step.status === "pending" ? "#f59e0b" : "rgba(255,255,255,0.25)" }} />
                <span>{step.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {attachmentBlock && (
        <div style={{
          border: "1px solid rgba(255,255,255,0.10)",
          background: "rgba(255,255,255,0.035)",
          borderRadius: 12,
          padding: "10px 12px",
          fontSize: 11,
          color: "rgba(255,255,255,0.58)",
        }}>
          <strong style={{ color: "rgba(255,255,255,0.75)" }}>{attachmentBlock.title ?? "Adjuntos"}</strong>
          {attachmentBlock.summary ? <div style={{ marginTop: 4 }}>{attachmentBlock.summary}</div> : null}
        </div>
      )}

      {actions.length > 0 && (
        <div style={{ display: "grid", gap: 6 }}>
          {actions.slice(0, 4).map((action) => (
            <div key={action.id} style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 10,
              alignItems: "center",
              border: "1px solid rgba(255,255,255,0.10)",
              background: action.requiresApproval ? "rgba(245,158,11,0.08)" : "rgba(255,255,255,0.035)",
              borderRadius: 12,
              padding: "9px 11px",
            }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: "#e2e8f0" }}>{action.label}</div>
                <div style={{ fontSize: 10, color: "rgba(255,255,255,0.45)" }}>
                  {action.namespace}.{action.tool} · {action.riskLevel}
                </div>
              </div>
              <div style={{ fontSize: 10, color: action.requiresApproval ? "#fbbf24" : "rgba(255,255,255,0.45)", textTransform: "uppercase", whiteSpace: "nowrap" }}>
                {action.status}
              </div>
            </div>
          ))}
        </div>
      )}

      {results.length > 0 && (
        <div style={{ display: "grid", gap: 6 }}>
          {results.slice(0, 6).map((result) => {
            const succeeded = result.status === "succeeded";
            const failed = result.status === "failed" || result.status === "blocked";
            const summary = describeToolOutput(result.output);
            const outputKind = typeof result.output === "object" && result.output !== null && "outputKind" in result.output
              ? displayText((result.output as { outputKind?: unknown }).outputKind)
              : "";
            return (
              <div key={result.id} style={{
                border: `1px solid ${failed ? "rgba(239,68,68,0.30)" : succeeded ? "rgba(16,185,129,0.28)" : "rgba(255,255,255,0.10)"}`,
                background: failed ? "rgba(239,68,68,0.06)" : succeeded ? "rgba(16,185,129,0.055)" : "rgba(255,255,255,0.035)",
                borderRadius: 12,
                padding: "9px 11px",
              }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ color: "#e2e8f0", fontSize: 11, fontWeight: 800 }}>{result.namespace}.{result.tool}</div>
                    <div style={{ color: "rgba(255,255,255,0.42)", fontSize: 9, marginTop: 2 }}>
                      {outputKind || summary || result.errorMessage || "Sin detalle adicional"}
                    </div>
                  </div>
                  <span style={{ color: failed ? "#fca5a5" : succeeded ? "#86efac" : "#fbbf24", fontSize: 9, textTransform: "uppercase", whiteSpace: "nowrap" }}>
                    {result.status}
                  </span>
                </div>
                {result.errorMessage && outputKind !== result.errorMessage ? (
                  <div style={{ color: "#fca5a5", fontSize: 9, marginTop: 5 }}>{result.errorMessage}</div>
                ) : null}
                {result.auditRef ? (
                  <div style={{ color: "rgba(255,255,255,0.28)", fontSize: 8, marginTop: 5 }}>Traza: {result.auditRef}</div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}

      {genericBlocks.length > 0 && genericBlocks.slice(0, 6).map((block) => (
        <div key={block.id} style={{
          border: `1px solid ${block.status === "failed" || block.status === "blocked" ? "rgba(239,68,68,0.30)" : "rgba(255,255,255,0.10)"}`,
          background: "rgba(255,255,255,0.035)",
          borderRadius: 12,
          padding: "9px 11px",
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
            <strong style={{ color: "rgba(255,255,255,0.76)", fontSize: 11 }}>{block.title ?? block.type}</strong>
            <span style={{ color: "rgba(255,255,255,0.38)", fontSize: 9, textTransform: "uppercase" }}>{block.status}</span>
          </div>
          {block.summary ? <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 10, marginTop: 4 }}>{block.summary}</div> : null}
        </div>
      ))}

      {citations.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }} aria-label="Fuentes de la respuesta">
          {citations.slice(0, 6).map((citation) => {
            const content = `${citation.type === "evidence" ? "Evidencia" : citation.type === "tool" ? "Herramienta" : "Fuente"}: ${citation.label ?? citation.id}`;
            const href = safeCitationUrl(citation.url);
            return href ? (
              <a key={citation.id} href={href} target="_blank" rel="noreferrer" style={{ color, fontSize: 9, textDecoration: "none", border: "1px solid rgba(255,255,255,0.10)", padding: "5px 7px", borderRadius: 8 }}>
                {content}
              </a>
            ) : (
              <span key={citation.id} style={{ color: "rgba(255,255,255,0.48)", fontSize: 9, border: "1px solid rgba(255,255,255,0.10)", padding: "5px 7px", borderRadius: 8 }}>
                {content}
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}

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
    async (content: string, attachments: PrometeoAttachment[] = []): Promise<boolean> => {
      const userMsg: ChatMessage = {
        id: `u-${Date.now()}`,
        role: "user",
        agentId: activeAgent,
        content: content || "Adjuntos enviados a Prometeo.",
        ts: Date.now(),
        attachments,
      };
      setMessages(prev => [...prev, userMsg]);
      setThinking(true);

      const isAssistant = activeAgent === "assistant";
      const inPublishJobMode = attachments.length === 0 && isAssistant && (publishJobDraft !== null || isPublishJobIntent(content));

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
            message: content || undefined,
            agentId: activeAgent,
            threadId: activeConversationId ?? undefined,
            projectId: selectedProjectId ?? undefined,
            attachments,
            selectedEntities: selectedProjectId ? [{ type: "project", id: selectedProjectId }] : undefined,
            pageContext: {
              route: pathname ?? undefined,
              module: "agent-chat",
              metadata: { activeAgent },
            },
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
              blocks: data.blocks,
              mission: data.mission,
              proposedActions: data.proposedActions,
              executionResults: data.executionResults,
              citations: data.citations,
            },
          ]);
        }
        return true;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Error de conexión";
        setMessages(prev => [
          ...prev.filter((message) => message.id !== userMsg.id),
          {
            id: `err-${Date.now()}`,
            role: "assistant",
            agentId: "assistant",
            content: `⚠ ${msg}`,
            ts: Date.now(),
          },
        ]);
        return false;
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
  const [attachmentDrafts, setAttachmentDrafts] = useState<AttachmentDraft[]>([]);
  const [composerError, setComposerError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const attachmentDraftsRef = useRef<AttachmentDraft[]>([]);
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
  const isUploading = attachmentDrafts.some((draft) => draft.status === "uploading");

  useEffect(() => {
    attachmentDraftsRef.current = attachmentDrafts;
  }, [attachmentDrafts]);

  useEffect(() => () => {
    for (const draft of attachmentDraftsRef.current) {
      if (draft.previewUrl) URL.revokeObjectURL(draft.previewUrl);
    }
  }, []);

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

  const clearAttachmentDrafts = useCallback(() => {
    setAttachmentDrafts((current) => {
      for (const draft of current) {
        if (draft.previewUrl) URL.revokeObjectURL(draft.previewUrl);
      }
      return [];
    });
    setComposerError(null);
  }, []);

  const addAttachmentFiles = useCallback((files: File[], source: PrometeoAttachment["source"]) => {
    if (files.length === 0) return;
    if (thinking || isUploading) {
      setComposerError("Espera a que termine el turno actual antes de agregar más archivos.");
      return;
    }
    const validationError = getPrometeoAttachmentValidationError([
      ...attachmentDrafts.map((draft) => draft.file),
      ...files,
    ]);
    if (validationError) {
      setComposerError(validationError);
      return;
    }

    const stamp = Date.now();
    const additions = files.map((file, index): AttachmentDraft => {
      const type = classifyPrometeoAttachment(file);
      return {
        id: `attachment-${stamp}-${index}-${file.name}`,
        file,
        source,
        previewUrl: type === "image" || type === "video" ? URL.createObjectURL(file) : undefined,
        status: "ready",
      };
    });
    setAttachmentDrafts((current) => [...current, ...additions]);
    setComposerError(null);
  }, [attachmentDrafts, isUploading, thinking]);

  const removeAttachmentDraft = useCallback((id: string) => {
    setAttachmentDrafts((current) => {
      const removed = current.find((draft) => draft.id === id);
      if (removed?.previewUrl) URL.revokeObjectURL(removed.previewUrl);
      return current.filter((draft) => draft.id !== id);
    });
    setComposerError(null);
  }, []);

  async function handleSend() {
    const trimmed = input.trim();
    if ((!trimmed && attachmentDrafts.length === 0) || thinking || isUploading) return;

    const validationError = getPrometeoAttachmentValidationError(attachmentDrafts.map((draft) => draft.file));
    if (validationError) {
      setComposerError(validationError);
      return;
    }

    setComposerError(null);
    const uploaded = await Promise.all(attachmentDrafts.map(async (draft): Promise<PrometeoAttachment | null> => {
      if (draft.remote) return draft.remote;

      setAttachmentDrafts((current) => current.map((item) => (
        item.id === draft.id ? { ...item, status: "uploading", error: undefined } : item
      )));

      try {
        const remote = RUNTIME_ENABLED
          ? await uploadPrometeoAttachment(draft.file, draft.source)
          : buildDemoAttachment(draft);
        setAttachmentDrafts((current) => current.map((item) => (
          item.id === draft.id ? { ...item, status: "uploaded", remote, error: undefined } : item
        )));
        return remote;
      } catch (error) {
        const message = error instanceof Error ? error.message : "No se pudo subir el adjunto.";
        setAttachmentDrafts((current) => current.map((item) => (
          item.id === draft.id ? { ...item, status: "error", error: message } : item
        )));
        return null;
      }
    }));

    if (uploaded.some((attachment) => attachment === null)) {
      setComposerError("No se envió el turno porque uno o más adjuntos no pudieron cargarse.");
      return;
    }

    const sent = await sendMessage(trimmed, uploaded as PrometeoAttachment[]);
    if (sent) {
      setInput("");
      clearAttachmentDrafts();
    }
  }

  function switchAgent(id: AgentId) {
    if (thinking || isUploading) return;
    setSelectedAgentId(id);
    clearHistory();
    setInput("");
    clearAttachmentDrafts();
  }

  const liveContext = lastReplyMeta?.context ?? context;
  const routeLabel = pathname?.split("/").filter(Boolean).slice(-2).join(" / ") || "Inicio";
  const contextChips = [
    { key: "agent", label: `${agent.emoji} ${agent.name}` },
    { key: "route", label: `⌘ ${routeLabel}` },
    {
      key: "project",
      label: liveContext?.activeProject?.title
        ? `📁 ${liveContext.activeProject.title}`
        : effectiveProjectId
        ? `📁 Proyecto ${effectiveProjectId.slice(0, 8)}`
        : "◎ Alcance general",
    },
  ];

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
                  disabled={thinking || isUploading}
                  style={{
                    padding: "5px 12px", borderRadius: 99, fontSize: 12, fontWeight: 700,
                    border: `1px solid ${a.id === activeAgent ? a.color : "rgba(255,255,255,0.1)"}`,
                    background: a.id === activeAgent ? `${a.color}22` : "transparent",
                    color: a.id === activeAgent ? a.color : "rgba(255,255,255,0.45)",
                    cursor: thinking || isUploading ? "not-allowed" : "pointer", transition: "all 0.15s",
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
                    {message.attachments ? <SentAttachmentPills attachments={message.attachments} /> : null}
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
                {message.role === "assistant" && (
                  <div style={{ marginLeft: 42 }}>
                    <StructuredResponseCards message={message} color={agent.color} />
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
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 9 }} aria-label="Contexto activo de Prometeo">
              {contextChips.map((chip) => (
                <span key={chip.key} style={{ padding: "5px 8px", borderRadius: 99, border: "1px solid rgba(255,255,255,0.10)", background: "rgba(255,255,255,0.035)", color: "rgba(255,255,255,0.5)", fontSize: 9 }}>
                  {chip.label}
                </span>
              ))}
            </div>

            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept={PROMETEO_ATTACHMENT_ACCEPT}
              aria-label="Seleccionar fotos, videos, audio o documentos"
              style={{ display: "none" }}
              onChange={(event) => {
                addAttachmentFiles(Array.from(event.currentTarget.files ?? []), "upload");
                event.currentTarget.value = "";
              }}
            />
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*,video/*"
              capture="environment"
              aria-label="Abrir cámara para capturar foto o video"
              style={{ display: "none" }}
              onChange={(event) => {
                addAttachmentFiles(Array.from(event.currentTarget.files ?? []), "camera");
                event.currentTarget.value = "";
              }}
            />

            <div
              onDragEnter={(event) => { event.preventDefault(); setDragActive(true); }}
              onDragOver={(event) => { event.preventDefault(); setDragActive(true); }}
              onDragLeave={(event) => { event.preventDefault(); setDragActive(false); }}
              onDrop={(event) => {
                event.preventDefault();
                setDragActive(false);
                addAttachmentFiles(Array.from(event.dataTransfer.files), "upload");
              }}
              style={{
                border: `1px solid ${dragActive ? agent.color : "rgba(255,255,255,0.10)"}`,
                borderRadius: 16,
                padding: 10,
                background: dragActive ? `${agent.color}12` : "rgba(255,255,255,0.025)",
                transition: "border-color 0.15s, background 0.15s",
              }}
            >
              <AttachmentDraftList drafts={attachmentDrafts} onRemove={removeAttachmentDraft} />

              <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 8, flexWrap: "wrap" }}>
                <button
                  type="button"
                  aria-label="Adjuntar archivos"
                  title="Adjuntar fotos, video, audio o documentos"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={thinking || isUploading}
                  style={{ border: "1px solid rgba(255,255,255,0.11)", background: "rgba(255,255,255,0.045)", color: "rgba(255,255,255,0.65)", borderRadius: 10, padding: "7px 10px", fontSize: 11, cursor: thinking || isUploading ? "not-allowed" : "pointer" }}
                >
                  ＋ Archivo
                </button>
                <button
                  type="button"
                  aria-label="Tomar foto o video con la cámara"
                  onClick={() => cameraInputRef.current?.click()}
                  disabled={thinking || isUploading}
                  style={{ border: "1px solid rgba(255,255,255,0.11)", background: "rgba(255,255,255,0.045)", color: "rgba(255,255,255,0.65)", borderRadius: 10, padding: "7px 10px", fontSize: 11, cursor: thinking || isUploading ? "not-allowed" : "pointer" }}
                >
                  ◉ Cámara
                </button>
                <span style={{ color: "rgba(255,255,255,0.28)", fontSize: 9 }}>
                  Arrastra o pega archivos · máximo 6 y 50 MB por turno
                </span>
              </div>

              <div style={{ display: "flex", gap: 10, alignItems: "flex-end" }}>
                <textarea
                  value={input}
                  disabled={thinking || isUploading}
                  onChange={event => setInput(event.target.value)}
                  onPaste={(event) => {
                    const files = Array.from(event.clipboardData.files);
                    if (files.length > 0) {
                      event.preventDefault();
                      addAttachmentFiles(files, "clipboard");
                    }
                  }}
                  onKeyDown={event => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault();
                      void handleSend();
                    }
                  }}
                  placeholder={placeholder}
                  aria-label={`Mensaje para ${agent.name}`}
                  rows={2}
                  style={{
                    flex: 1, borderRadius: 12, padding: "11px 13px",
                    border: "1px solid rgba(255,255,255,0.10)",
                    background: "rgba(255,255,255,0.045)", color: "#e2e8f0",
                    fontSize: 14, resize: "none", outline: "none",
                    fontFamily: "inherit",
                  }}
                />
                <button
                  type="button"
                  onClick={() => void handleSend()}
                  disabled={thinking || isUploading || (!input.trim() && attachmentDrafts.length === 0)}
                  style={{
                    padding: "12px 22px", borderRadius: 12, border: "none",
                    background: thinking || isUploading || (!input.trim() && attachmentDrafts.length === 0) ? "rgba(255,255,255,0.08)" : agent.color,
                    color: thinking || isUploading || (!input.trim() && attachmentDrafts.length === 0) ? "rgba(255,255,255,0.3)" : "#0a0a14",
                    fontWeight: 800, fontSize: 13, cursor: thinking || isUploading ? "not-allowed" : "pointer",
                    transition: "all 0.15s",
                  }}
                >
                  {isUploading ? "Subiendo…" : thinking ? "Procesando…" : "Enviar"}
                </button>
              </div>

              <div aria-live="polite" style={{ minHeight: composerError ? 18 : 0, marginTop: composerError ? 7 : 0, color: "#fca5a5", fontSize: 10 }}>
                {composerError}
              </div>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8 }}>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.25)" }}>
                Enter para enviar · Shift+Enter para nueva línea
              </div>
              <div style={{ display: "flex", gap: 12 }}>
                {activeAgent !== "assistant" && (
                  <button type="button" onClick={() => switchAgent("assistant")} disabled={thinking || isUploading}
                    style={{ fontSize: 11, color: "rgba(100,200,255,0.6)", background: "none", border: "none", cursor: thinking || isUploading ? "not-allowed" : "pointer" }}>
                    ← Volver a Prometeo
                  </button>
                )}
                <button type="button" onClick={() => { clearHistory(); setInput(""); clearAttachmentDrafts(); }} disabled={thinking || isUploading}
                  style={{ fontSize: 11, color: "rgba(255,100,100,0.5)", background: "none", border: "none", cursor: thinking || isUploading ? "not-allowed" : "pointer" }}>
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
