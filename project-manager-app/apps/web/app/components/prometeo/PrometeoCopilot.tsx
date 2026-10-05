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
import { buildWidgetChatRequest, classifyChatReply, describeChatFailure } from "../../../lib/prometeo-widget-chat";

/** Tope de espera del chat real: pasado este tiempo la consulta termina como fallo visible, no queda colgada. */
const CHAT_TIMEOUT_MS = 45_000;
import { ContextDetector } from "./ContextDetector";
import { CopilotChat, type CopilotMessage } from "./CopilotChat";
import { QuickActions } from "./QuickActions";
import { PrometeoMascot } from "./PrometeoMascot";
import type { MascotMood } from "../../../lib/prometeo-mascot";
import { MissionSuggestion } from "./MissionSuggestion";

function newId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `msg-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function PrometeoCopilot() {
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
  const { context, loading } = useCopilotContext();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<CopilotMessage[]>([]);
  const [pending, setPending] = useState(false);
  const [sessionId, setSessionId] = useState<string | undefined>();
  const [suggestion, setSuggestion] = useState<CopilotMissionSuggestion | null>(null);
  const [chatThreadId, setChatThreadId] = useState<string | undefined>();
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
          buildWidgetChatRequest({ message: text, threadId: chatThreadId, context, route: startedAt ?? undefined }),
          controller.signal,
        );
        if (pathnameRef.current !== startedAt) return;
        const reply = classifyChatReply(real);
        if (reply.kind === "answer") {
          if (real.threadId) setChatThreadId(real.threadId);
          setMessages((prev) => [...prev, { id: newId(), role: "assistant", content: reply.text }]);
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

  async function handleAcceptMission(s: CopilotMissionSuggestion) {
    if (!sessionId) return;
    setPending(true);
    try {
      const mission = await createMissionFromCopilot({
        copilotSessionId: sessionId,
        missionType: s.type,
        title: s.title,
      });
      setSuggestion(null);
      flashMood("success", 2500);
      router.push(mission.workspaceUrl);
    } catch {
      flashMood("error");
      // surface as a chat message so the user isn't left guessing
      setMessages((prev) => [
        ...prev,
        { id: newId(), role: "assistant", content: "No se pudo crear la misión." },
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
    return (
      <div className="fixed bottom-16 right-3 z-50">
        <PrometeoMascot size={140} mood={shownMood} onActivate={() => setOpen(true)} label="Abrir Prometeo Copilot" />
      </div>
    );
  }

  return (
    <div className="fixed bottom-24 right-6 z-50 flex h-[32rem] max-h-[calc(100vh-8rem)] w-96 max-w-[calc(100vw-3rem)] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
      <header className="flex items-center justify-between border-b border-slate-100 px-3 py-2">
        <div className="flex items-center gap-2">
          <span className="flex items-center justify-center overflow-hidden rounded-xl bg-slate-900"><PrometeoMascot size={48} mood={shownMood} label="Prometeo" /></span>
          <span className="text-sm font-semibold text-slate-800">Prometeo Copilot</span>
        </div>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"
          aria-label="Cerrar Copilot"
        >
          <X className="h-4 w-4" />
        </button>
      </header>

      <ContextDetector context={context} loading={loading} />
      {context && (
        <QuickActions
          actions={context.suggestedActions}
          onExecute={handleQuickAction}
          disabled={pending}
        />
      )}
      {suggestion && (
        <MissionSuggestion suggestion={suggestion} onAccept={handleAcceptMission} pending={pending} />
      )}
      <CopilotChat messages={messages} onSend={handleSend} onRetry={handleSend} pending={pending} />
    </div>
  );
}
