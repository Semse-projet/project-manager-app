"use client";

import { useState } from "react";
import { Send } from "lucide-react";
import { MarkdownLite } from "./MarkdownLite";

export type CopilotMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  /** `degraded`: el asistente no pudo responder; no es una respuesta de Prometeo y ofrece reintentar. */
  status?: "degraded";
  retryText?: string;
};

export function CopilotChat({
  messages,
  onSend,
  onRetry,
  pending,
}: {
  messages: CopilotMessage[];
  onSend: (text: string) => void;
  onRetry?: (text: string) => void;
  pending: boolean;
}) {
  const [input, setInput] = useState("");

  function submit() {
    const text = input.trim();
    if (!text || pending) return;
    onSend(text);
    setInput("");
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex-1 space-y-2 overflow-y-auto px-3 py-3">
        {messages.length === 0 && (
          <p className="text-sm text-slate-400">
            Pregúntame algo sobre lo que estás viendo. Puedo sugerir acciones y abrir misiones.
          </p>
        )}
        {messages.map((m) => (
          <div
            key={m.id}
            className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${
              m.role === "user"
                ? "ml-auto bg-slate-900 text-white"
                : m.status === "degraded"
                  ? "border border-amber-300 bg-amber-50 text-amber-900"
                  : "bg-slate-100 text-slate-800"
            }`}
            role={m.status === "degraded" ? "alert" : undefined}
          >
            {m.role === "assistant" ? <MarkdownLite text={m.content} /> : m.content}
            {m.status === "degraded" && m.retryText && onRetry && (
              <button
                type="button"
                onClick={() => onRetry(m.retryText!)}
                disabled={pending}
                className="mt-2 block rounded-lg border border-amber-400 px-2 py-1 text-xs font-semibold text-amber-900 disabled:opacity-40"
              >
                Reintentar
              </button>
            )}
          </div>
        ))}
        {pending && <p className="text-xs text-slate-400">Prometeo está pensando…</p>}
      </div>

      <div className="flex items-center gap-2 border-t border-slate-100 p-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          placeholder="Escribe un mensaje…"
          className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400"
        />
        <button
          type="button"
          onClick={submit}
          disabled={pending || !input.trim()}
          className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-900 text-white disabled:opacity-40"
          aria-label="Enviar"
        >
          <Send className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
