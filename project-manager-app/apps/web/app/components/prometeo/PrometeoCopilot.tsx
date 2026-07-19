"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Bot, X } from "lucide-react";
import type { CopilotMissionSuggestion, CopilotSuggestedAction } from "@semse/schemas";
import { useCopilotContext } from "../../../lib/hooks/useCopilotContext";
import {
  createMissionFromCopilot,
  executeCopilotAction,
  sendCopilotMessage,
} from "../../../lib/bff/prometeo";
import { ContextDetector } from "./ContextDetector";
import { CopilotChat, type CopilotMessage } from "./CopilotChat";
import { QuickActions } from "./QuickActions";
import { MissionSuggestion } from "./MissionSuggestion";

function newId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `msg-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function PrometeoCopilot() {
  const router = useRouter();
  const { context, loading } = useCopilotContext();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<CopilotMessage[]>([]);
  const [pending, setPending] = useState(false);
  const [sessionId, setSessionId] = useState<string | undefined>();
  const [suggestion, setSuggestion] = useState<CopilotMissionSuggestion | null>(null);

  async function handleSend(text: string) {
    setMessages((prev) => [...prev, { id: newId(), role: "user", content: text }]);
    setPending(true);
    setSuggestion(null);
    try {
      const res = await sendCopilotMessage({
        message: text,
        sessionId,
        context: context ? { module: context.module } : undefined,
      });
      setSessionId(res.sessionId);
      setMessages((prev) => [...prev, { id: newId(), role: "assistant", content: res.response }]);
      if (res.missionSuggestion) setSuggestion(res.missionSuggestion);
    } catch (e) {
      setMessages((prev) => [
        ...prev,
        {
          id: newId(),
          role: "assistant",
          content: e instanceof Error ? e.message : "Ocurrió un error.",
        },
      ]);
    } finally {
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
      router.push(mission.workspaceUrl);
    } catch {
      // surface as a chat message so the user isn't left guessing
      setMessages((prev) => [
        ...prev,
        { id: newId(), role: "assistant", content: "No se pudo crear la misión." },
      ]);
    } finally {
      setPending(false);
    }
  }

  async function handleQuickAction(action: CopilotSuggestedAction) {
    if (!context) return;
    setPending(true);
    try {
      const res = await executeCopilotAction({
        action: action.action,
        targetResource: {
          resourceId: context.resource.id ?? context.module,
          resourceType: context.resource.type,
        },
      });
      if (res.requiresWorkspace) {
        router.push("/workspace");
        return;
      }
      setMessages((prev) => [
        ...prev,
        { id: newId(), role: "assistant", content: `Acción "${action.description}" ejecutada.` },
      ]);
    } catch (e) {
      setMessages((prev) => [
        ...prev,
        {
          id: newId(),
          role: "assistant",
          content: e instanceof Error ? e.message : "No se pudo ejecutar la acción.",
        },
      ]);
    } finally {
      setPending(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-24 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-slate-900 text-white shadow-lg transition hover:bg-slate-800"
        aria-label="Abrir Prometeo Copilot"
      >
        <Bot className="h-6 w-6" />
      </button>
    );
  }

  return (
    <div className="fixed bottom-24 right-6 z-50 flex h-[32rem] max-h-[calc(100vh-8rem)] w-96 max-w-[calc(100vw-3rem)] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
      <header className="flex items-center justify-between border-b border-slate-100 px-3 py-2">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-900 text-white">
            <Bot className="h-4 w-4" />
          </span>
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
      <CopilotChat messages={messages} onSend={handleSend} pending={pending} />
    </div>
  );
}
