"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  fetchCommMessages,
  fetchCommThreads,
  sendCommMessage,
  type CommMessage,
  type CommThread,
} from "../semse-api";

function timeAgo(iso: string | null): string {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1) return "ahora";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

function channelIcon(channel: string): string {
  if (channel === "WHATSAPP_CLOUD" || channel === "OPENWA_LAB") return "💬";
  if (channel === "SMS") return "📱";
  if (channel === "EMAIL") return "✉️";
  return "🌐";
}

function statusDot(status: string) {
  const color = status === "OPEN" ? "#22c55e" : status === "PENDING" ? "#f59e0b" : "#6b7280";
  return (
    <span
      style={{
        display: "inline-block",
        width: 7,
        height: 7,
        borderRadius: "50%",
        background: color,
        flexShrink: 0,
        marginTop: 2,
      }}
    />
  );
}

export default function CommunicationsPage() {
  const [threads, setThreads] = useState<CommThread[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<CommMessage[]>([]);
  const [loadingThreads, setLoadingThreads] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const selectedThread = threads.find((t) => t.id === selectedId) ?? null;

  const loadThreads = useCallback(async () => {
    try {
      const data = await fetchCommThreads({ limit: 60 });
      setThreads(Array.isArray(data) ? data : []);
    } catch {
      // silent refresh
    } finally {
      setLoadingThreads(false);
    }
  }, []);

  const loadMessages = useCallback(async (threadId: string) => {
    setLoadingMessages(true);
    try {
      const data = await fetchCommMessages(threadId);
      setMessages(Array.isArray(data) ? data : []);
    } catch {
      setMessages([]);
    } finally {
      setLoadingMessages(false);
    }
  }, []);

  useEffect(() => {
    void loadThreads();
    const timer = setInterval(() => void loadThreads(), 20_000);
    return () => clearInterval(timer);
  }, [loadThreads]);

  useEffect(() => {
    if (!selectedId) return;
    void loadMessages(selectedId);
    const timer = setInterval(() => void loadMessages(selectedId), 8_000);
    return () => clearInterval(timer);
  }, [selectedId, loadMessages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSelect = (id: string) => {
    setSelectedId(id);
    setDraft("");
    setError(null);
  };

  const handleSend = async () => {
    if (!selectedThread || !draft.trim() || sending) return;
    setSending(true);
    setError(null);
    try {
      await sendCommMessage({
        threadId: selectedThread.id,
        channel: selectedThread.channel,
        body: draft.trim(),
        recipientPhone: selectedThread.contactPhone ?? undefined,
      });
      setDraft("");
      await loadMessages(selectedThread.id);
      await loadThreads();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al enviar");
    } finally {
      setSending(false);
      textareaRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  };

  return (
    <main id="main-content" style={{ display: "flex", height: "calc(100vh - 56px)", overflow: "hidden" }}>
      {/* Thread list */}
      <aside style={{
        width: 280,
        flexShrink: 0,
        borderRight: "1px solid rgba(255,255,255,0.06)",
        display: "flex",
        flexDirection: "column",
        background: "var(--panel, #0d0d20)",
      }}>
        <div style={{
          padding: "14px 16px 10px",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)" }}>Conversaciones</span>
          {threads.length > 0 && (
            <span style={{ fontSize: 11, color: "var(--muted)", background: "rgba(255,255,255,0.06)", borderRadius: 20, padding: "1px 8px" }}>
              {threads.length}
            </span>
          )}
        </div>

        {loadingThreads ? (
          <div style={{ padding: 20, textAlign: "center", color: "var(--muted)", fontSize: 12 }}>Cargando…</div>
        ) : threads.length === 0 ? (
          <div style={{ padding: 20, textAlign: "center", color: "var(--muted)", fontSize: 12 }}>
            Sin conversaciones aún.<br />Conecta WhatsApp para empezar.
          </div>
        ) : (
          <ul style={{ listStyle: "none", margin: 0, padding: 0, overflowY: "auto", flex: 1 }}>
            {threads.map((t) => {
              const active = t.id === selectedId;
              return (
                <li
                  key={t.id}
                  onClick={() => handleSelect(t.id)}
                  style={{
                    padding: "10px 14px",
                    borderBottom: "1px solid rgba(255,255,255,0.04)",
                    background: active ? "rgba(99,102,241,0.1)" : "transparent",
                    borderLeft: active ? "2px solid var(--brand,#6366f1)" : "2px solid transparent",
                    cursor: "pointer",
                    display: "flex",
                    flexDirection: "column",
                    gap: 3,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 6, justifyContent: "space-between" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                      {statusDot(t.status)}
                      <span style={{ fontSize: 12, fontWeight: 600, color: "var(--ink)" }}>
                        {channelIcon(t.channel)} {t.contactName ?? t.contactPhone ?? "Desconocido"}
                      </span>
                    </div>
                    <span style={{ fontSize: 10, color: "var(--muted)", flexShrink: 0 }}>
                      {timeAgo(t.lastMessageAt)}
                    </span>
                  </div>
                  <span style={{ fontSize: 11, color: "var(--muted)" }}>
                    {t.contactPhone ?? ""}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </aside>

      {/* Message panel */}
      <section style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {!selectedThread ? (
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--muted)", fontSize: 13 }}>
            Selecciona una conversación
          </div>
        ) : (
          <>
            {/* Header */}
            <div style={{
              padding: "12px 18px",
              borderBottom: "1px solid rgba(255,255,255,0.06)",
              display: "flex",
              alignItems: "center",
              gap: 10,
              background: "var(--panel, #0d0d20)",
            }}>
              <span style={{ fontSize: 16 }}>{channelIcon(selectedThread.channel)}</span>
              <div>
                <p style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)", margin: 0 }}>
                  {selectedThread.contactName ?? selectedThread.contactPhone ?? "Desconocido"}
                </p>
                <p style={{ fontSize: 11, color: "var(--muted)", margin: 0 }}>
                  {selectedThread.contactPhone} · {selectedThread.channel.replace("_", " ")} · {selectedThread.status}
                </p>
              </div>
            </div>

            {/* Messages */}
            <div style={{ flex: 1, overflowY: "auto", padding: "16px 18px", display: "flex", flexDirection: "column", gap: 8 }}>
              {loadingMessages ? (
                <div style={{ textAlign: "center", color: "var(--muted)", fontSize: 12, marginTop: 20 }}>Cargando mensajes…</div>
              ) : messages.length === 0 ? (
                <div style={{ textAlign: "center", color: "var(--muted)", fontSize: 12, marginTop: 20 }}>Sin mensajes en este thread.</div>
              ) : (
                messages.map((msg) => {
                  const isOut = msg.direction === "OUTBOUND";
                  return (
                    <div
                      key={msg.id}
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: isOut ? "flex-end" : "flex-start",
                        gap: 2,
                      }}
                    >
                      <div style={{
                        maxWidth: "70%",
                        padding: "8px 12px",
                        borderRadius: isOut ? "14px 14px 4px 14px" : "14px 14px 14px 4px",
                        background: isOut ? "var(--brand, #6366f1)" : "rgba(255,255,255,0.07)",
                        color: isOut ? "#fff" : "var(--ink)",
                        fontSize: 13,
                        lineHeight: 1.5,
                        wordBreak: "break-word",
                      }}>
                        {msg.body ?? <em style={{ opacity: 0.5 }}>(sin texto)</em>}
                      </div>
                      <span style={{ fontSize: 10, color: "var(--muted)", padding: "0 4px" }}>
                        {timeAgo(msg.createdAt)} · {msg.status}
                      </span>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Compose */}
            <div style={{
              padding: "12px 18px",
              borderTop: "1px solid rgba(255,255,255,0.06)",
              background: "var(--panel, #0d0d20)",
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}>
              {error && (
                <p style={{ fontSize: 11, color: "#ef4444", margin: 0 }}>{error}</p>
              )}
              <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
                <textarea
                  ref={textareaRef}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Escribe un mensaje… (Enter para enviar)"
                  rows={2}
                  disabled={sending}
                  style={{
                    flex: 1,
                    resize: "none",
                    background: "rgba(255,255,255,0.05)",
                    border: "1px solid rgba(255,255,255,0.10)",
                    borderRadius: 10,
                    color: "var(--ink)",
                    fontSize: 13,
                    padding: "9px 12px",
                    outline: "none",
                    fontFamily: "inherit",
                    lineHeight: 1.5,
                  }}
                />
                <button
                  onClick={() => void handleSend()}
                  disabled={sending || !draft.trim()}
                  style={{
                    background: "var(--brand, #6366f1)",
                    color: "#fff",
                    border: "none",
                    borderRadius: 10,
                    padding: "9px 18px",
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: sending || !draft.trim() ? "not-allowed" : "pointer",
                    opacity: sending || !draft.trim() ? 0.5 : 1,
                    whiteSpace: "nowrap",
                  }}
                >
                  {sending ? "Enviando…" : "Enviar"}
                </button>
              </div>
            </div>
          </>
        )}
      </section>
    </main>
  );
}
