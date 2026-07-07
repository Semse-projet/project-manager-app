"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Bot, Lock, Send, Sparkles, Trash2, User } from "lucide-react";
import { sendLaborChatMessage } from "../../../labor-api";
import { fieldInput, sectionCard } from "./trackerUi";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
  degraded?: boolean;
};

const STORAGE_KEY = "semse_labor_chat_v1";
const THREAD_KEY = "semse_labor_chat_thread_v1";

const WELCOME_MESSAGE: ChatMessage = {
  id: "welcome",
  role: "assistant",
  content:
    "Hola, soy Cronos, tu asistente de horas. Puedo responder preguntas sobre tus registros, proyectos libres y tendencias del Labor Engine.\n\nCorro sobre Ollama local: tus horas y tarifas nunca salen de este servidor.\n\nPrueba: \"¿Cuántas horas llevo esta semana?\"",
  timestamp: Date.now(),
};

const SUGGESTIONS = [
  "¿Cuántas horas llevo esta semana?",
  "¿Tengo un timer activo ahora mismo?",
  "¿Cuál es mi proyecto libre con más horas?",
  "Resume mi mes en dos frases",
];

function loadMessages(): ChatMessage[] {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (!stored) return [WELCOME_MESSAGE];
    const parsed = JSON.parse(stored) as ChatMessage[];
    return parsed.length > 0 ? parsed : [WELCOME_MESSAGE];
  } catch {
    return [WELCOME_MESSAGE];
  }
}

function loadThreadId(): string {
  try {
    const stored = window.localStorage.getItem(THREAD_KEY);
    if (stored) return stored;
  } catch {
    // ignore
  }
  const id = typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `thread-${Date.now()}`;
  try {
    window.localStorage.setItem(THREAD_KEY, id);
  } catch {
    // ignore
  }
  return id;
}

function formatTime(timestamp: number) {
  return new Date(timestamp).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" });
}

export function AsistenteTab() {
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME_MESSAGE]);
  const [threadId, setThreadId] = useState("");
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMessages(loadMessages());
    setThreadId(loadThreadId());
  }, []);

  useEffect(() => {
    if (messages.length === 0) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-60)));
    } catch {
      // localStorage no disponible (modo privado, cuota) — la conversación sigue funcionando en memoria.
    }
  }, [messages]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, sending]);

  const handleSend = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || sending) return;

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: trimmed,
      timestamp: Date.now(),
    };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setSending(true);
    setError(null);

    try {
      const result = await sendLaborChatMessage(trimmed, threadId || undefined);
      const assistantMessage: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: result.response,
        timestamp: Date.now(),
        degraded: result.mode === "fallback",
      };
      setMessages((prev) => [...prev, assistantMessage]);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo contactar a Cronos.");
    } finally {
      setSending(false);
    }
  }, [sending, threadId]);

  function handleClear() {
    setMessages([WELCOME_MESSAGE]);
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  }

  return (
    <div style={{ display: "grid", gap: "16px" }}>
      <div style={{ ...sectionCard, padding: "14px 20px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div style={{ width: "34px", height: "34px", borderRadius: "10px", background: "rgba(139,92,246,.14)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Bot size={17} color="#8b5cf6" />
          </div>
          <div>
            <h3 style={{ fontSize: "14px", fontWeight: 800, color: "var(--ink)", margin: 0 }}>Cronos — asistente de horas</h3>
            <p style={{ fontSize: "11px", color: "var(--muted)", margin: "2px 0 0" }}>Responde sobre tus propios registros del Labor Engine</p>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: "5px", padding: "4px 9px", borderRadius: "999px", background: "rgba(16,185,129,.12)", color: "#059669", fontSize: "10px", fontWeight: 800 }}>
            <Lock size={11} /> 100% local · Ollama
          </span>
          <button type="button" onClick={handleClear} style={clearButton()}>
            <Trash2 size={12} /> Limpiar
          </button>
        </div>
      </div>

      <div style={{ ...sectionCard, padding: 0, display: "flex", flexDirection: "column", height: "520px" }}>
        <div ref={scrollRef} style={{ flex: 1, overflowY: "auto", padding: "18px", display: "grid", gap: "14px", alignContent: "start" }}>
          {messages.map((message) => (
            <div
              key={message.id}
              style={{
                display: "flex",
                gap: "10px",
                flexDirection: message.role === "user" ? "row-reverse" : "row",
                alignItems: "flex-start",
              }}
            >
              <div
                style={{
                  width: "28px",
                  height: "28px",
                  borderRadius: "999px",
                  flexShrink: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: message.role === "user" ? "var(--brand-dim, rgba(59,130,246,.14))" : "rgba(139,92,246,.14)",
                }}
              >
                {message.role === "user" ? <User size={13} color="var(--brand)" /> : <Bot size={13} color="#8b5cf6" />}
              </div>
              <div style={{ maxWidth: "78%", display: "grid", gap: "3px" }}>
                <div
                  data-testid={message.role === "assistant" ? "labor-chat-assistant-message" : "labor-chat-user-message"}
                  style={{
                    padding: "10px 14px",
                    borderRadius: "14px",
                    background: message.role === "user" ? "var(--brand)" : "var(--bg)",
                    color: message.role === "user" ? "#fff" : "var(--ink)",
                    border: message.role === "assistant" ? "1px solid var(--border)" : "none",
                    fontSize: "13px",
                    lineHeight: 1.55,
                    whiteSpace: "pre-wrap",
                  }}
                >
                  {message.content}
                  {message.degraded ? (
                    <div style={{ marginTop: "6px", fontSize: "10px", fontWeight: 700, color: "#f59e0b" }}>
                      ⚠ Ollama no respondió — mensaje de respaldo
                    </div>
                  ) : null}
                </div>
                <span style={{ fontSize: "10px", color: "var(--muted)", textAlign: message.role === "user" ? "right" : "left" }}>
                  {formatTime(message.timestamp)}
                </span>
              </div>
            </div>
          ))}

          {sending ? (
            <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
              <div style={{ width: "28px", height: "28px", borderRadius: "999px", background: "rgba(139,92,246,.14)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Bot size={13} color="#8b5cf6" />
              </div>
              <div style={{ padding: "10px 14px", borderRadius: "14px", border: "1px solid var(--border)", background: "var(--bg)", fontSize: "13px", color: "var(--muted)" }}>
                Cronos está pensando...
              </div>
            </div>
          ) : null}
        </div>

        {messages.length <= 1 ? (
          <div style={{ padding: "0 18px 12px", display: "flex", gap: "6px", flexWrap: "wrap" }}>
            {SUGGESTIONS.map((suggestion) => (
              <button key={suggestion} type="button" onClick={() => void handleSend(suggestion)} style={suggestionChip()}>
                <Sparkles size={11} /> {suggestion}
              </button>
            ))}
          </div>
        ) : null}

        {error ? (
          <p style={{ margin: "0 18px 8px", fontSize: "12px", color: "#ef4444" }}>{error}</p>
        ) : null}

        <form
          onSubmit={(event) => {
            event.preventDefault();
            void handleSend(input);
          }}
          style={{ display: "flex", gap: "8px", padding: "14px 18px", borderTop: "1px solid var(--border)" }}
        >
          <input
            data-testid="labor-chat-input"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="Pregúntale a Cronos sobre tus horas..."
            style={{ ...fieldInput(), flex: 1 }}
            disabled={sending}
          />
          <button
            type="submit"
            data-testid="labor-chat-send"
            disabled={sending || !input.trim()}
            style={sendButton(sending || !input.trim())}
          >
            <Send size={14} />
          </button>
        </form>
      </div>
    </div>
  );
}

function clearButton() {
  return {
    display: "inline-flex",
    alignItems: "center",
    gap: "5px",
    height: "28px",
    padding: "0 10px",
    borderRadius: "8px",
    border: "1px solid var(--border)",
    background: "transparent",
    color: "var(--muted)",
    fontSize: "11px",
    fontWeight: 700,
    cursor: "pointer",
  } as const;
}

function suggestionChip() {
  return {
    display: "inline-flex",
    alignItems: "center",
    gap: "5px",
    padding: "6px 11px",
    borderRadius: "999px",
    border: "1px solid var(--border)",
    background: "var(--bg)",
    color: "var(--muted)",
    fontSize: "11px",
    fontWeight: 600,
    cursor: "pointer",
  } as const;
}

function sendButton(disabled: boolean) {
  return {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: "42px",
    borderRadius: "8px",
    border: "none",
    background: "var(--brand)",
    color: "#fff",
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.55 : 1,
  } as const;
}
