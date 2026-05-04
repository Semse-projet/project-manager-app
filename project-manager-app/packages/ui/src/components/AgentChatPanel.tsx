"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { cn } from "../lib/cn";

export interface AgentChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  ts?: number;
}

export interface AgentChatAgent {
  id: string;
  name: string;
  color?: string;
  emoji?: string;
  description?: string;
}

export interface AgentChatPanelProps {
  title?: string;
  statusLabel?: string;
  messages: AgentChatMessage[];
  input: string;
  inputPlaceholder?: string;
  onInputChange: (value: string) => void;
  onSend: () => void;
  thinking?: boolean;
  suggestions?: string[];
  onSuggestionClick?: (value: string) => void;
  agents?: AgentChatAgent[];
  activeAgentId?: string;
  onAgentSelect?: (agentId: string) => void;
  footer?: ReactNode;
  className?: string;
}

export function AgentChatPanel({
  title = "Prometeo",
  statusLabel = "Agente activo",
  messages,
  input,
  inputPlaceholder = "Escribe una instrucción...",
  onInputChange,
  onSend,
  thinking = false,
  suggestions = [],
  onSuggestionClick,
  agents = [],
  activeAgentId,
  onAgentSelect,
  footer,
  className,
}: AgentChatPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = scrollRef.current;
    if (element) {
      element.scrollTop = element.scrollHeight;
    }
  }, [messages, thinking]);

  return (
    <section className={cn("flex h-[540px] w-[360px] flex-col overflow-hidden rounded-[28px] border border-white/10 bg-[#0a0f18] text-white shadow-2xl shadow-black/30", className)}>
      <header className="border-b border-white/10 bg-[#0d1220] px-4 py-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="truncate text-sm font-semibold">{title}</h2>
            <p className="text-[11px] text-slate-400">{statusLabel}</p>
          </div>
          {agents.length > 0 ? (
            <div className="flex flex-wrap justify-end gap-1.5">
              {agents.map((agent) => {
                const active = agent.id === activeAgentId;
                return (
                  <button
                    key={agent.id}
                    type="button"
                    onClick={() => onAgentSelect?.(agent.id)}
                    className={cn(
                      "rounded-xl border px-2 py-1 text-[11px] font-semibold transition-colors",
                      active ? "border-white/20 bg-white/10 text-white" : "border-white/10 bg-transparent text-slate-400 hover:text-white"
                    )}
                  >
                    <span className="mr-1">{agent.emoji ?? "◈"}</span>
                    {agent.name}
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>
      </header>

      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className={cn(
              "max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-6",
              message.role === "user"
                ? "ml-auto bg-sky-500/15 text-sky-50"
                : "bg-white/6 text-slate-100"
            )}
          >
            {message.content}
          </div>
        ))}
        {thinking ? (
          <div className="max-w-[85%] rounded-2xl bg-white/6 px-3 py-2 text-sm text-slate-300">
            Pensando...
          </div>
        ) : null}
      </div>

      {suggestions.length > 0 ? (
        <div className="flex flex-wrap gap-2 border-t border-white/10 px-4 py-3">
          {suggestions.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              onClick={() => onSuggestionClick?.(suggestion)}
              className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-300 transition-colors hover:bg-white/10 hover:text-white"
            >
              {suggestion}
            </button>
          ))}
        </div>
      ) : null}

      <div className="border-t border-white/10 p-4">
        <div className="flex gap-2">
          <input
            value={input}
            onChange={(event) => onInputChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                onSend();
              }
            }}
            className="flex-1 rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none placeholder:text-slate-500 focus:border-sky-500/40"
            placeholder={inputPlaceholder}
          />
          <button
            type="button"
            onClick={onSend}
            disabled={thinking}
            className="rounded-2xl bg-sky-500 px-4 py-2 text-sm font-semibold text-white transition-opacity disabled:opacity-50"
          >
            Enviar
          </button>
        </div>
        {footer ? <div className="mt-3">{footer}</div> : null}
      </div>
    </section>
  );
}
