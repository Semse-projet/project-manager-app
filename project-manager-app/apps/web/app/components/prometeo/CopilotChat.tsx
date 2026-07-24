"use client";

import { useState } from "react";
import { Send } from "lucide-react";

export type CopilotMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

export function CopilotChat({
  messages,
  onSend,
  pending,
}: {
  messages: CopilotMessage[];
  onSend: (text: string) => void;
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
                : "bg-slate-100 text-slate-800"
            }`}
          >
            {m.content}
          </div>
        ))}
        {pending && <p className="text-xs text-slate-400">Prometeo está pensando…</p>}
      </div>

      <div className="flex items-center gap-2 border-t border-slate-100 p-2">
        <input
          id="prometeo-copilot-chat-input"
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
