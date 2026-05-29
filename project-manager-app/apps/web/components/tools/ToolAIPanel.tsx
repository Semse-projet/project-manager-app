"use client";

import { useState, useRef } from "react";
import { Bot, Send, Loader2, ChevronDown, ChevronUp, Zap } from "lucide-react";
import type { SemseToolResult } from "@/app/lib/semse-tools-api";

type Message = { role: "user" | "assistant"; content: string; provider?: string };

const QUICK_QUESTIONS: Record<string, string[]> = {
  electrical: [
    "What permits are typically required for this scope?",
    "Are there any NEC code concerns I should flag?",
    "What are the biggest risk items in this estimate?",
  ],
  drywall: [
    "What finish level makes sense for this scope?",
    "How should I account for waste in my material order?",
    "What are common change-order triggers for drywall work?",
  ],
  painting: [
    "How many coats should I budget for this surface?",
    "What surface prep is critical to flag before pricing?",
    "What are the weather risk windows I need to plan around?",
  ],
  bathroom: [
    "What permits does a bathroom remodel typically require?",
    "What waterproofing method should I specify?",
    "What are the biggest sequencing risks in this scope?",
  ],
  kitchen: [
    "What permits are required for a kitchen remodel?",
    "What are the most common change-order triggers here?",
    "How should I sequence trades to avoid delays?",
  ],
  plumbing: [
    "What permits are required for this plumbing scope?",
    "Are there any code concerns with the fixture layout?",
    "What are the hidden cost risks in this estimate?",
  ],
  hvac: [
    "Is the equipment sizing appropriate for this scope?",
    "What permits are needed for this HVAC work?",
    "What efficiency ratings should I specify?",
  ],
  roofing: [
    "What underlayment and flashing specs should I include?",
    "What are the weather risk windows for this project?",
    "What warranty considerations should I flag?",
  ],
  default: [
    "What are the biggest risks in this estimate?",
    "What scope items am I likely missing?",
    "What would you change about this estimate?",
  ],
};

function getQuickQuestions(trade: string): string[] {
  return QUICK_QUESTIONS[trade] ?? QUICK_QUESTIONS.default;
}

async function askAI(trade: string, question: string, context?: Record<string, unknown>): Promise<{ answer: string; provider: string; model?: string }> {
  const res = await fetch("/api/semse/tools/ai-assist", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ trade, question, context }),
  });
  if (!res.ok) throw new Error(`AI request failed: ${res.status}`);
  const json = await res.json() as { data?: { answer: string; provider: string; model?: string } };
  return json.data ?? { answer: "No response from AI.", provider: "unknown" };
}

function ProviderBadge({ provider, model }: { provider: string; model?: string }) {
  const isOllama = provider === "ollama";
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        padding: "2px 8px",
        borderRadius: 6,
        fontSize: 11,
        fontWeight: 700,
        background: isOllama ? "rgba(139,92,246,.15)" : "rgba(59,130,246,.12)",
        color: isOllama ? "#a78bfa" : "#60a5fa",
        border: `1px solid ${isOllama ? "rgba(139,92,246,.3)" : "rgba(59,130,246,.25)"}`,
      }}
    >
      {isOllama ? <Zap size={10} /> : <Bot size={10} />}
      {isOllama ? (model ?? "Ollama") : (provider === "anthropic" ? "Claude" : provider)}
    </span>
  );
}

export function ToolAIPanel({ result }: { result: SemseToolResult }) {
  const trade = result.trade ?? "general";
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const context: Record<string, unknown> = {
    trade,
    totalCost: result.cost?.total,
    laborCost: result.cost?.labor,
    materialCost: result.cost?.materials,
    riskLevel: result.risk?.level,
    riskScore: result.risk?.score,
    projectType: result.projectType,
    inputs: result.inputs,
  };

  async function send(question: string) {
    if (!question.trim() || loading) return;
    const userMsg: Message = { role: "user", content: question };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);
    try {
      const res = await askAI(trade, question, context);
      setMessages((prev) => [...prev, { role: "assistant", content: res.answer, provider: `${res.provider}${res.model ? `:${res.model}` : ""}` }]);
    } catch {
      setMessages((prev) => [...prev, { role: "assistant", content: "Error al conectar con el asistente. Verifica que Ollama esté activo.", provider: "error" }]);
    } finally {
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }

  return (
    <div
      style={{
        border: "1px solid rgba(139,92,246,.25)",
        borderRadius: 14,
        overflow: "hidden",
        background: "rgba(139,92,246,.04)",
      }}
    >
      {/* Header */}
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "14px 20px",
          background: "transparent",
          border: "none",
          cursor: "pointer",
          color: "#e2e8f0",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 10,
              background: "linear-gradient(135deg,#7c3aed,#4f46e5)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Bot size={16} color="#fff" />
          </div>
          <div style={{ textAlign: "left" }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: "#e2e8f0" }}>
              Asistente IA — {trade.charAt(0).toUpperCase() + trade.slice(1)}
            </div>
            <div style={{ fontSize: 12, color: "#64748b" }}>
              Ollama · qwen2.5:3b · Preguntas sobre este estimado
            </div>
          </div>
        </div>
        {open ? <ChevronUp size={16} color="#64748b" /> : <ChevronDown size={16} color="#64748b" />}
      </button>

      {open && (
        <div style={{ borderTop: "1px solid rgba(139,92,246,.15)", padding: "16px 20px 20px" }}>
          {/* Quick questions */}
          {messages.length === 0 && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 12, color: "#64748b", marginBottom: 8, fontWeight: 600 }}>
                PREGUNTAS RÁPIDAS
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {getQuickQuestions(trade).map((q) => (
                  <button
                    key={q}
                    onClick={() => send(q)}
                    disabled={loading}
                    style={{
                      padding: "6px 12px",
                      borderRadius: 8,
                      border: "1px solid rgba(139,92,246,.3)",
                      background: "rgba(139,92,246,.08)",
                      color: "#a78bfa",
                      fontSize: 12,
                      cursor: loading ? "not-allowed" : "pointer",
                      textAlign: "left",
                    }}
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Messages */}
          {messages.length > 0 && (
            <div style={{ display: "grid", gap: 12, marginBottom: 16, maxHeight: 360, overflowY: "auto" }}>
              {messages.map((m, i) => (
                <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                  <div
                    style={{
                      width: 26,
                      height: 26,
                      borderRadius: 8,
                      background: m.role === "user" ? "rgba(59,130,246,.2)" : "linear-gradient(135deg,#7c3aed,#4f46e5)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                      marginTop: 2,
                    }}
                  >
                    {m.role === "user" ? (
                      <span style={{ fontSize: 11, color: "#60a5fa", fontWeight: 800 }}>U</span>
                    ) : (
                      <Bot size={12} color="#fff" />
                    )}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div
                      style={{
                        fontSize: 13,
                        color: m.role === "user" ? "#94a3b8" : "#e2e8f0",
                        lineHeight: 1.65,
                        whiteSpace: "pre-wrap",
                      }}
                    >
                      {m.content}
                    </div>
                    {m.role === "assistant" && m.provider && m.provider !== "error" && (
                      <div style={{ marginTop: 6 }}>
                        <ProviderBadge
                          provider={m.provider.split(":")[0] ?? m.provider}
                          model={m.provider.split(":")[1]}
                        />
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {loading && (
                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  <div
                    style={{
                      width: 26,
                      height: 26,
                      borderRadius: 8,
                      background: "linear-gradient(135deg,#7c3aed,#4f46e5)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Loader2 size={12} color="#fff" style={{ animation: "spin 1s linear infinite" }} />
                  </div>
                  <span style={{ fontSize: 13, color: "#64748b" }}>Pensando…</span>
                </div>
              )}
            </div>
          )}

          {/* Input */}
          <div style={{ display: "flex", gap: 8 }}>
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(input); } }}
              placeholder={`Pregunta sobre este estimado de ${trade}…`}
              disabled={loading}
              style={{
                flex: 1,
                padding: "10px 14px",
                borderRadius: 10,
                border: "1px solid rgba(139,92,246,.25)",
                background: "rgba(255,255,255,.04)",
                color: "#e2e8f0",
                fontSize: 13,
                outline: "none",
              }}
            />
            <button
              onClick={() => void send(input)}
              disabled={loading || !input.trim()}
              style={{
                padding: "10px 16px",
                borderRadius: 10,
                background: loading || !input.trim() ? "rgba(139,92,246,.2)" : "linear-gradient(135deg,#7c3aed,#4f46e5)",
                border: "none",
                cursor: loading || !input.trim() ? "not-allowed" : "pointer",
                display: "flex",
                alignItems: "center",
                gap: 6,
                color: "#fff",
                fontWeight: 700,
                fontSize: 13,
              }}
            >
              {loading ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> : <Send size={14} />}
            </button>
          </div>

          {messages.length > 0 && (
            <button
              onClick={() => setMessages([])}
              style={{ marginTop: 10, fontSize: 11, color: "#475569", background: "none", border: "none", cursor: "pointer" }}
            >
              Limpiar conversación
            </button>
          )}
        </div>
      )}
    </div>
  );
}
