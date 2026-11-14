"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { X } from "lucide-react";
import type { CopilotMissionSuggestion, CopilotSuggestedAction } from "@semse/schemas";
import { useCopilotContext } from "../../../lib/hooks/useCopilotContext";
import {
  askPrometeoChat,
  createMissionFromCopilot,
  executeCopilotAction,
  sendCopilotMessage,
} from "../../../lib/bff/prometeo";
import { buildChatHistory, buildWidgetChatRequest, classifyChatReply, describeChatFailure } from "../../../lib/prometeo-widget-chat";
import { safeChatRoute, toChatActionViews, type ChatActionView } from "../../../lib/prometeo-chat-actions";
import { requestEvidenceAnalysis, type EvidenceAnalysisState } from "../../../lib/prometeo-chat-evidence";

/** Tope de espera del chat real: pasado este tiempo la consulta termina como fallo visible, no queda colgada. */
const CHAT_TIMEOUT_MS = 45_000;
import { ContextDetector } from "./ContextDetector";
import { CopilotChat, type CopilotMessage } from "./CopilotChat";
import { QuickActions } from "./QuickActions";
import { PrometeoMascot } from "./PrometeoMascot";
import type { MascotMood } from "../../../lib/prometeo-mascot";
import { MissionSuggestion } from "./MissionSuggestion";
import { useModalOpen } from "../../../lib/use-modal-open";

function newId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `msg-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export type PrometeoCopilotProps = {
  /** Una señal positiva abre el widget; incrementar para volver a abrirlo tras cerrarlo. */
  openSignal?: number;
  /** La referencia del shell se aceptó. No indica ejecución de negocio ni proyecto creado. */
  onWorkspaceMissionLoaded?: () => void;
};

export function PrometeoCopilot({ openSignal, onWorkspaceMissionLoaded }: PrometeoCopilotProps = {}) {
  const router = useRouter();
  const pathname = usePathname();
  // Consulta en vuelo: se cancela al cambiar de página y al desmontar, y su respuesta nunca se asocia a otro contexto.
  const inflight = useRef<AbortController | null>(null);
  const pathnameRef = useRef(pathname);
  pathnameRef.current = pathname;

  useEffect(() => {
    inflight.current?.abort();
    return () => inflight.current?.abort();
  }, [pathname]);
  const { context, loading, error, refresh } = useCopilotContext();
  const [open, setOpen] = useState(() => typeof openSignal === "number" && Number.isFinite(openSignal) && openSignal > 0);
  useEffect(() => {
    if (typeof openSignal === "number" && Number.isFinite(openSignal) && openSignal > 0) setOpen(true);
  }, [openSignal]);
  const modalOpen = useModalOpen();
  const [messages, setMessages] = useState<CopilotMessage[]>([]);
  const [pending, setPending] = useState(false);
  const [sessionId, setSessionId] = useState<string | undefined>();
  const [suggestion, setSuggestion] = useState<CopilotMissionSuggestion | null>(null);
  const [chatThreadId, setChatThreadId] = useState<string | undefined>();
  // Botones de acciones de chat ya pulsados (`<mensaje>:<acción>`): no se pueden usar dos veces.
  const [usedActions, setUsedActions] = useState<ReadonlySet<string>>(new Set());
  // Resultado de los análisis de evidencias lanzados con el botón (`<mensaje>:<acción>`).
  const [evidenceResults, setEvidenceResults] = useState<Readonly<Record<string, EvidenceAnalysisState>>>({});
  // Estado de ánimo de la mascota: "pensando" mientras responde; luego guía, confirma o se sorprende un momento.
  const [mood, setMood] = useState<MascotMood>("idle");
  const moodTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function flashMood(next: MascotMood, ms = 4000) {
    setMood(next);
    if (moodTimer.current) clearTimeout(moodTimer.current);
    moodTimer.current = setTimeout(() => setMood("idle"), ms);
  }

  useEffect(
    () => () => {
      if (moodTimer.current) clearTimeout(moodTimer.current);
    },
    [],
  );
  const shownMood: MascotMood = pending ? "thinking" : mood;

  async function handleSend(text: string) {
    setMessages((prev) => [...prev, { id: newId(), role: "user", content: text }]);
    setPending(true);
    setSuggestion(null);
    const startedAt = pathnameRef.current;
    const controller = new AbortController();
    inflight.current?.abort();
    inflight.current = controller;
    const timeout = setTimeout(() => controller.abort(new DOMException("timeout", "TimeoutError")), CHAT_TIMEOUT_MS);
    try {
      const res = await sendCopilotMessage({
        message: text,
        sessionId,
        context: context ? { module: context.module } : undefined,
      });
      if (pathnameRef.current !== startedAt) return; // la pantalla cambió: esta respuesta ya no corresponde
      setSessionId(res.sessionId);

      // Con intención de misión el widget propone abrir una misión; sin ella la pregunta se responde con el chat
      // real. Un fallo de ese chat NO se disfraza de respuesta: se muestra como degradación con reintento.
      if (res.requiresWorkspace) {
        setMessages((prev) => [...prev, { id: newId(), role: "assistant", content: res.response }]);
        if (res.missionSuggestion) setSuggestion(res.missionSuggestion);
        flashMood("answered");
        return;
      }

      let degradedReason: string | null = null;
      try {
        const real = await askPrometeoChat(
          buildWidgetChatRequest({
            message: text,
            history: buildChatHistory(messages), // `messages` aún no incluye el mensaje actual
            threadId: chatThreadId,
            context,
            route: startedAt ?? undefined,
          }),
          controller.signal,
        );
        if (pathnameRef.current !== startedAt) return;
        const reply = classifyChatReply(real);
        if (reply.kind === "answer") {
          if (real.threadId) setChatThreadId(real.threadId);
          // El widget solo puede ofrecer acciones con una pantalla a la que ir (la ruta se valida otra vez al pulsar).
          const actions = toChatActionViews(real.proposedActions).filter((a) => a.route || a.kind === "analyze_evidence");
          setMessages((prev) => [...prev, { id: newId(), role: "assistant", content: reply.text, ...(actions.length > 0 ? { actions } : {}) }]);
          flashMood("answered");
          return;
        }
        degradedReason = reply.reason;
      } catch (e) {
        if (pathnameRef.current !== startedAt) return;
        degradedReason = describeChatFailure(controller.signal.aborted ? controller.signal.reason ?? e : e);
      }
      flashMood("error");
      setMessages((prev) => [
        ...prev,
        { id: newId(), role: "assistant", content: `${degradedReason} No es una respuesta de Prometeo.`, status: "degraded", retryText: text },
      ]);
    } catch (e) {
      flashMood("error");
      setMessages((prev) => [
        ...prev,
        {
          id: newId(),
          role: "assistant",
          content: e instanceof Error ? e.message : "Ocurrió un error.",
        },
      ]);
    } finally {
      clearTimeout(timeout);
      if (inflight.current === controller) inflight.current = null;
      setPending(false);
    }
  }

  function handleChatAction(action: ChatActionView, messageId: string) {
    if (action.kind === "analyze_evidence") {
      // analyze_evidence: SOLO con el clic, de un solo uso; el API aplica permiso, pertenencia, tope diario y auditoría.
      const key = `${messageId}:${action.id}`;
      if (!action.evidenceId || usedActions.has(key)) return;
      setUsedActions((prev) => new Set(prev).add(key));
      setEvidenceResults((prev) => ({ ...prev, [key]: { state: "loading" } }));
      void requestEvidenceAnalysis(action.evidenceId).then((outcome) => setEvidenceResults((prev) => ({ ...prev, [key]: outcome })));
      return;
    }
    const route = safeChatRoute(action.route);
    if (!route) return;
    setUsedActions((prev) => new Set(prev).add(`${messageId}:${action.id}`));
    flashMood("success", 2500);
    router.push(route);
  }

  async function handleAcceptMission(s: CopilotMissionSuggestion) {
    if (!sessionId || pending) return;
    setPending(true);
    try {
      const mission = await createMissionFromCopilot({
        copilotSessionId: sessionId,
        missionType: s.type,
        title: s.title,
      });
      setSuggestion(null);
      flashMood("success", 2500);
      // El push puede apuntar a la ruta actual: notificar al shell explícitamente
      // para que refresque su store, sin agregar aquí otra fuente de contexto.
      onWorkspaceMissionLoaded?.();
      router.push(mission.workspaceUrl);
    } catch {
      flashMood("error");
      // surface as a chat message so the user isn't left guessing
      setMessages((prev) => [
        ...prev,
        { id: newId(), role: "assistant", content: "No se pudo abrir la referencia de trabajo. Puedes volver a intentar aceptar la sugerencia." },
      ]);
    } finally {
      setPending(false);
    }
  }

  function pushAssistantMessage(content: string) {
    setMessages((prev) => [...prev, { id: newId(), role: "assistant", content }]);
  }

  async function handleQuickAction(action: CopilotSuggestedAction) {
    if (!context) return;
    setPending(true);
    let res: Awaited<ReturnType<typeof executeCopilotAction>>;
    try {
      // The server records the action and decides whether it needs the governed
      // Workspace. It does not produce a result for read-only actions, so a
      // "completed" status alone says nothing the user can act on.
      res = await executeCopilotAction({
        action: action.action,
        targetResource: {
          resourceId: context.resource.id ?? context.module,
          resourceType: context.resource.type,
        },
      });
    } catch (e) {
      flashMood("error");
      pushAssistantMessage(e instanceof Error ? e.message : "No se pudo ejecutar la acción.");
      setPending(false);
      return;
    }
    setPending(false);

    if (res.status === "failed") {
      pushAssistantMessage(`No se pudo ejecutar "${action.description}".`);
      return;
    }
    if (res.requiresWorkspace || action.action === "workspace.focus") {
      router.push("/workspace");
      return;
    }
    if (action.action === "copilot.ask") {
      pushAssistantMessage("¿Qué quieres saber? Escribe tu pregunta abajo y la respondo con el contexto de esta pantalla.");
      return;
    }
    // Read-only quick actions (summaries, status, comparisons) are real questions
    // for the copilot: send them through the chat, the same path as typing them.
    await handleSend(action.description);
  }

  if (!open) {
    // Un modal abierto manda: no tapar sus botones de confirmación.
    if (modalOpen) return null;
    return (
      <div className="fixed bottom-16 right-3 z-50">
        <PrometeoMascot size={140} mood={shownMood} onActivate={() => setOpen(true)} label="Abrir Prometeo Copilot" />
      </div>
    );
  }

  return (
    <div role="region" aria-label="Prometeo Copilot" className="fixed bottom-3 right-3 z-50 flex h-[32rem] max-h-[calc(100dvh-1.5rem)] w-[calc(100vw-1.5rem)] max-w-sm flex-col overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-2xl sm:bottom-24 sm:right-6 sm:max-h-[calc(100dvh-8rem)] [&_button]:min-h-11 [&_button]:min-w-11 [&_input]:min-h-11 [&_input]:min-w-0">
      <header className="flex shrink-0 items-center justify-between border-b border-[var(--border)] px-3 py-2">
        <div className="flex items-center gap-2">
          <span className="flex items-center justify-center overflow-hidden rounded-xl bg-slate-900"><PrometeoMascot size={48} mood={shownMood} label="Prometeo" /></span>
          <span className="text-sm font-semibold text-[var(--ink)]">Prometeo Copilot</span>
        </div>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="flex min-h-11 min-w-11 items-center justify-center rounded-lg text-[var(--muted)] hover:bg-[var(--brand-dim)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--brand)]"
          aria-label="Cerrar Copilot"
        >
          <X className="h-4 w-4" />
        </button>
      </header>

      {openSignal !== undefined && (
        <p className="shrink-0 border-b border-[var(--border)] px-3 py-2 text-xs text-[var(--muted)]">Referencia de trabajo · sin ejecución vinculada. Aceptar una sugerencia solo abre contexto.</p>
      )}
      {error && (
        <div role="alert" className="shrink-0 border-b border-[var(--border)] px-3 py-2 text-xs text-[var(--error)]">
          <p>No se pudo cargar el contexto de Prometeo.</p>
          <p className="mt-1 break-words">{error}</p>
          <button type="button" onClick={refresh} disabled={loading} className="mt-2 min-h-11 rounded-lg border border-[var(--border)] px-3 text-[var(--brand)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--brand)] disabled:opacity-50">Reintentar contexto</button>
        </div>
      )}
      {loading && context && <p role="status" className="shrink-0 px-3 py-2 text-xs text-[var(--muted)]">Actualizando contexto de Prometeo…</p>}
      <ContextDetector context={context} loading={loading} />
      {context && (
        <QuickActions
          actions={context.suggestedActions}
          onExecute={handleQuickAction}
          disabled={pending || loading || Boolean(error)}
        />
      )}
      {suggestion && (
        <MissionSuggestion suggestion={suggestion} onAccept={handleAcceptMission} pending={pending} />
      )}
      <CopilotChat
        messages={messages}
        onSend={handleSend}
        onRetry={handleSend}
        onAction={handleChatAction}
        usedActions={usedActions}
        evidenceResults={evidenceResults}
        pending={pending}
      />
    </div>
  );
}
