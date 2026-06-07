"use client";

import Link from "next/link";
import { Fragment, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent } from "react";
import {
  ArrowLeft,
  Bot,
  CheckCircle2,
  Clock3,
  Inbox,
  Link2,
  MessageSquare,
  Phone,
  RefreshCw,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  UserRound,
  Wifi,
  XCircle,
} from "lucide-react";
import {
  semseRuntimeEnabled,
} from "../../../semse-api";
import { NotificationBanner } from "../../../components/notifications/NotificationBanner";

type ApiEnvelope<T> = {
  data?: T;
  error?: { message?: string };
};

type CommunicationProvider = "WHATSAPP_CLOUD" | "OPENWA_LAB" | "SMS" | "EMAIL" | "WEB_CHAT";
type CommunicationThreadStatus = "OPEN" | "PENDING" | "CLOSED" | "ARCHIVED";

type CommunicationThread = {
  id: string;
  tenantId: string;
  orgId: string | null;
  channel: CommunicationProvider;
  channelAccountId: string | null;
  externalThreadId: string | null;
  contactPhone: string | null;
  contactName: string | null;
  contactUserId: string | null;
  contractorLeadId: string | null;
  jobId: string | null;
  projectId: string | null;
  status: CommunicationThreadStatus;
  assignedToUserId: string | null;
  intent: string | null;
  source: string;
  lastMessageAt: string | null;
  metadataJson: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
};

type CommunicationMessage = {
  id: string;
  tenantId: string;
  threadId: string;
  direction: "INBOUND" | "OUTBOUND";
  provider: CommunicationProvider;
  externalMessageId: string | null;
  senderUserId: string | null;
  contactPhone: string | null;
  body: string | null;
  mediaJson: Record<string, unknown>[] | null;
  rawPayloadJson: Record<string, unknown> | null;
  status: string;
  sentAt: string | null;
  deliveredAt: string | null;
  readAt: string | null;
  createdAt: string;
};

type CommunicationChannelAccount = {
  id: string;
  provider: CommunicationProvider;
  label: string;
  phoneNumberId: string | null;
  displayPhone: string | null;
  status: string;
  _envConfigured?: boolean;
  _warning?: string;
};

type CommunicationInboundResult = {
  thread: CommunicationThread;
  message: CommunicationMessage;
  lead: { id: string } | null;
};

type CommunicationSendResult = {
  thread: CommunicationThread;
  message: CommunicationMessage;
};

const EMPTY_THREADS: CommunicationThread[] = [];
const EMPTY_MESSAGES: CommunicationMessage[] = [];
const STATUS_OPTIONS: Array<CommunicationThreadStatus | "all"> = ["all", "OPEN", "PENDING", "CLOSED", "ARCHIVED"];

async function fetchSemse<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, { ...init, cache: "no-store" });
  const payload = await response.json().catch(() => ({})) as ApiEnvelope<T>;

  if (!response.ok) {
    // Extract the most human-readable error from the API envelope.
    const rawMsg = payload.error?.message;
    let humanMsg: string;
    if (typeof rawMsg === "string") {
      humanMsg = rawMsg;
    } else if (rawMsg && typeof rawMsg === "object" && "message" in rawMsg) {
      humanMsg = String((rawMsg as { message: unknown }).message);
    } else if (rawMsg && typeof rawMsg === "object" && "code" in rawMsg) {
      const coded = rawMsg as { code?: string; message?: string };
      humanMsg = coded.message ?? coded.code ?? "Error del proveedor";
    } else {
      humanMsg = `Error ${response.status} en ${path}`;
    }
    throw new Error(humanMsg);
  }

  if (!("data" in payload)) {
    throw new Error(`La respuesta de ${path} no tiene el formato esperado.`);
  }

  return payload.data as T;
}

async function fetchCommunicationChannelAccounts(): Promise<CommunicationChannelAccount[]> {
  return fetchSemse<CommunicationChannelAccount[]>("/api/semse/communications/channel-accounts");
}

async function fetchCommunicationThreads(input: {
  status?: CommunicationThreadStatus | "all";
  limit?: number;
  offset?: number;
}): Promise<CommunicationThread[]> {
  const search = new URLSearchParams();
  if (input.status && input.status !== "all") search.set("status", input.status);
  if (input.limit) search.set("limit", String(input.limit));
  if (input.offset) search.set("offset", String(input.offset));
  const suffix = search.size > 0 ? `?${search.toString()}` : "";
  return fetchSemse<CommunicationThread[]>(`/api/semse/communications/threads${suffix}`);
}

async function fetchCommunicationMessages(threadId: string): Promise<CommunicationMessage[]> {
  return fetchSemse<CommunicationMessage[]>(
    `/api/semse/communications/threads/${encodeURIComponent(threadId)}/messages?limit=200`,
  );
}

async function sendCommunicationMessage(input: {
  channel: CommunicationProvider;
  threadId: string;
  recipientPhone?: string;
  body: string;
  jobId?: string;
  projectId?: string;
  contractorLeadId?: string;
}): Promise<CommunicationSendResult> {
  return fetchSemse<CommunicationSendResult>("/api/semse/communications/send", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
}

async function receiveCommunicationInbound(input: {
  channel: CommunicationProvider;
  contactPhone: string;
  contactName?: string;
  body: string;
}): Promise<CommunicationInboundResult> {
  return fetchSemse<CommunicationInboundResult>("/api/semse/communications/inbound", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
}

async function updateCommunicationThread(threadId: string, input: {
  status?: CommunicationThreadStatus;
  intent?: string;
}): Promise<CommunicationThread> {
  return fetchSemse<CommunicationThread>(
    `/api/semse/communications/threads/${encodeURIComponent(threadId)}`,
    { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(input) },
  );
}

const QUICK_REPLIES = [
  { label: "Confirmación", body: "Hola, recibimos tu mensaje. Nuestro equipo estará en contacto contigo pronto." },
  { label: "Solicitar fotos", body: "Para darte una cotización precisa, ¿podrías enviarnos fotos del área a trabajar?" },
  { label: "Agendar visita", body: "Podemos agendar una visita para evaluar el trabajo. ¿Cuándo tienes disponibilidad esta semana?" },
  { label: "Cotización lista", body: "Tu cotización ya está lista. Te la compartimos por este medio en breve." },
];

function formatTimestamp(value?: string | null) {
  if (!value) return "Sin actividad";
  return new Date(value).toLocaleString("es-MX", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function shortId(value?: string | null) {
  if (!value) return "-";
  return value.length > 10 ? value.slice(0, 10) : value;
}

function statusTone(status: string) {
  const normalized = status.toLowerCase();
  if (normalized === "open") return { bg: "rgba(20,184,166,0.12)", border: "rgba(20,184,166,0.28)", color: "#2dd4bf" };
  if (normalized === "pending") return { bg: "rgba(245,158,11,0.12)", border: "rgba(245,158,11,0.3)", color: "#fbbf24" };
  if (normalized === "closed") return { bg: "rgba(59,130,246,0.12)", border: "rgba(59,130,246,0.28)", color: "#60a5fa" };
  return { bg: "rgba(148,163,184,0.12)", border: "rgba(148,163,184,0.25)", color: "#94a3b8" };
}

function StatusPill({ value }: { value: string }) {
  const tone = statusTone(value);
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        height: "24px",
        padding: "0 9px",
        borderRadius: "999px",
        border: `1px solid ${tone.border}`,
        background: tone.bg,
        color: tone.color,
        fontSize: "11px",
        fontWeight: 800,
      }}
    >
      {value}
    </span>
  );
}

function metadataValue(thread: CommunicationThread, path: string[]): string | null {
  let cursor: unknown = thread.metadataJson;
  for (const key of path) {
    if (!cursor || typeof cursor !== "object" || !(key in cursor)) return null;
    cursor = (cursor as Record<string, unknown>)[key];
  }
  return typeof cursor === "string" && cursor.trim().length > 0 ? cursor : null;
}

export default function AdminCommunicationsPage() {
  const runtimeEnabled = semseRuntimeEnabled();
  const [threads, setThreads] = useState<CommunicationThread[]>(EMPTY_THREADS);
  const [messages, setMessages] = useState<CommunicationMessage[]>(EMPTY_MESSAGES);
  const [channelAccounts, setChannelAccounts] = useState<CommunicationChannelAccount[]>([]);
  const [status, setStatus] = useState<CommunicationThreadStatus | "all">("all");
  const [query, setQuery] = useState("");
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [loading, setLoading] = useState(runtimeEnabled);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [messagesError, setMessagesError] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState(0);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [sendSuccess, setSendSuccess] = useState<string | null>(null);
  const [manualPhone, setManualPhone] = useState("+1");
  const [manualName, setManualName] = useState("");
  const [manualBody, setManualBody] = useState("Necesito una cotizacion para reparar mi cocina esta semana.");
  const [manualLoading, setManualLoading] = useState(false);
  const [manualFeedback, setManualFeedback] = useState<{ kind: "ok" | "error"; message: string } | null>(null);
  const [statusChanging, setStatusChanging] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const replyRef = useRef<HTMLTextAreaElement>(null);

  const loadWorkspace = useCallback(async (options?: { skipLoading?: boolean }) => {
    if (!runtimeEnabled) return;

    if (!options?.skipLoading) setLoading(true);
    setError(null);

    try {
      const [threadData, accountData] = await Promise.all([
        fetchCommunicationThreads({ status, limit: 80 }),
        fetchCommunicationChannelAccounts(),
      ]);

      setThreads(threadData);
      setChannelAccounts(accountData);
      setSelectedThreadId((current) => {
        if (current && threadData.some((thread) => thread.id === current)) return current;
        return threadData[0]?.id ?? null;
      });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudo cargar comunicaciones.");
    } finally {
      setLoading(false);
    }
  }, [runtimeEnabled, status]);

  useEffect(() => {
    void loadWorkspace();
  }, [loadWorkspace, refreshToken]);

  // Auto-poll threads every 20s
  useEffect(() => {
    const timer = setInterval(() => void loadWorkspace({ skipLoading: true }), 20_000);
    return () => clearInterval(timer);
  }, [loadWorkspace]);

  // Auto-poll messages every 8s while a thread is selected
  useEffect(() => {
    if (!runtimeEnabled || !selectedThreadId) return;
    const timer = setInterval(() => setRefreshToken((t) => t + 1), 8_000);
    return () => clearInterval(timer);
  }, [runtimeEnabled, selectedThreadId]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const selectedThread = useMemo(
    () => threads.find((thread) => thread.id === selectedThreadId) ?? null,
    [threads, selectedThreadId],
  );

  const visibleThreads = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return threads;

    return threads.filter((thread) => {
      const fields = [
        thread.contactName,
        thread.contactPhone,
        thread.contractorLeadId,
        thread.projectId,
        thread.jobId,
        thread.intent,
        thread.source,
        metadataValue(thread, ["smartIntake", "summary"]),
      ];
      return fields.some((field) => field?.toLowerCase().includes(needle));
    });
  }, [threads, query]);

  // Keyboard: j/k navigate threads, r focus reply
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (e.key === "j" || e.key === "ArrowDown") {
        setSelectedThreadId((id) => {
          const idx = visibleThreads.findIndex((t) => t.id === id);
          return visibleThreads[Math.min(idx + 1, visibleThreads.length - 1)]?.id ?? id;
        });
      } else if (e.key === "k" || e.key === "ArrowUp") {
        setSelectedThreadId((id) => {
          const idx = visibleThreads.findIndex((t) => t.id === id);
          return visibleThreads[Math.max(idx - 1, 0)]?.id ?? id;
        });
      } else if (e.key === "r") {
        replyRef.current?.focus();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [visibleThreads]);

  useEffect(() => {
    if (!runtimeEnabled || !selectedThreadId) {
      setMessages(EMPTY_MESSAGES);
      return;
    }

    let cancelled = false;
    setMessagesLoading(true);
    setMessagesError(null);

    void fetchCommunicationMessages(selectedThreadId)
      .then((data) => {
        if (!cancelled) setMessages(data);
      })
      .catch((reason) => {
        if (!cancelled) {
          setMessagesError(reason instanceof Error ? reason.message : "No se pudo cargar la conversacion.");
        }
      })
      .finally(() => {
        if (!cancelled) setMessagesLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [runtimeEnabled, selectedThreadId, refreshToken]);

  const stats = useMemo(() => {
    const open = threads.filter((thread) => thread.status === "OPEN").length;
    const linkedLeads = threads.filter((thread) => Boolean(thread.contractorLeadId)).length;
    const linkedWork = threads.filter((thread) => Boolean(thread.jobId || thread.projectId)).length;
    const activeChannels = channelAccounts.filter((account) => account.status.toLowerCase() === "active").length;

    return [
      { label: "Abiertas", value: open, icon: Inbox, color: "#2dd4bf" },
      { label: "Leads", value: linkedLeads, icon: UserRound, color: "#60a5fa" },
      { label: "Jobs/Proyectos", value: linkedWork, icon: Link2, color: "#fbbf24" },
      { label: "Canales", value: activeChannels, icon: Wifi, color: "#a78bfa" },
    ];
  }, [threads, channelAccounts]);

  async function handleSend(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedThread || !reply.trim()) return;

    setSending(true);
    setSendError(null);
    setSendSuccess(null);

    try {
      const result = await sendCommunicationMessage({
        channel: selectedThread.channel,
        threadId: selectedThread.id,
        recipientPhone: selectedThread.contactPhone ?? undefined,
        body: reply.trim(),
        jobId: selectedThread.jobId ?? undefined,
        projectId: selectedThread.projectId ?? undefined,
        contractorLeadId: selectedThread.contractorLeadId ?? undefined,
      });

      setReply("");
      setMessages((current) => [...current, result.message]);
      setSendSuccess("Mensaje enviado.");
      await loadWorkspace({ skipLoading: true });
    } catch (reason) {
      setSendError(reason instanceof Error ? reason.message : "No se pudo enviar el mensaje.");
    } finally {
      setSending(false);
    }
  }

  async function handleStatusChange(newStatus: CommunicationThreadStatus) {
    if (!selectedThread || statusChanging) return;
    setStatusChanging(true);
    try {
      const updated = await updateCommunicationThread(selectedThread.id, { status: newStatus });
      setThreads((prev) => prev.map((t) => t.id === updated.id ? { ...t, status: updated.status } : t));
    } catch {
      // silent — UI reflects old state
    } finally {
      setStatusChanging(false);
    }
  }

  function handleQuickReply(body: string) {
    setReply(body);
    replyRef.current?.focus();
  }

  async function handleManualInbound(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!manualPhone.trim() || !manualBody.trim()) return;

    setManualLoading(true);
    setManualFeedback(null);

    try {
      const result = await receiveCommunicationInbound({
        channel: "WHATSAPP_CLOUD",
        contactPhone: manualPhone.trim(),
        contactName: manualName.trim() || undefined,
        body: manualBody.trim(),
      });

      setSelectedThreadId(result.thread.id);
      setManualFeedback({
        kind: "ok",
        message: result.lead?.id ? `Mensaje recibido y lead ${shortId(result.lead.id)} enlazado.` : "Mensaje recibido.",
      });
      setManualBody("");
      await loadWorkspace({ skipLoading: true });
      setRefreshToken((current) => current + 1);
    } catch (reason) {
      setManualFeedback({
        kind: "error",
        message: reason instanceof Error ? reason.message : "No se pudo simular el inbound.",
      });
    } finally {
      setManualLoading(false);
    }
  }

  return (
    <div className="communications-page" style={{ maxWidth: "1320px", margin: "0 auto", display: "grid", gap: "16px" }}>
      <section
        style={{
          border: "1px solid var(--border)",
          borderRadius: "10px",
          background: "linear-gradient(135deg, rgba(8,47,73,0.92), rgba(15,23,42,0.95))",
          padding: "18px",
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "14px", flexWrap: "wrap" }}>
          <div>
            <Link href="/admin/dashboard" style={{ display: "inline-flex", alignItems: "center", gap: "6px", color: "#7dd3fc", fontSize: "12px", fontWeight: 700, textDecoration: "none", marginBottom: "8px" }}>
              <ArrowLeft size={13} />
              Dashboard
            </Link>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
              <h1 style={{ fontSize: "24px", fontWeight: 850, color: "var(--ink)", margin: 0 }}>SEMSE Inbox</h1>
              <StatusPill value={runtimeEnabled ? "RUNTIME" : "OFFLINE"} />
            </div>
            <p style={{ marginTop: "6px", color: "var(--muted)", fontSize: "13px", maxWidth: "760px" }}>
              Conversaciones, leads, mensajes salientes y puente operativo para WhatsApp Cloud.
            </p>
            {!runtimeEnabled ? <p style={{ fontSize: "12px", color: "#fca5a5", marginTop: "10px" }}>Runtime SEMSE deshabilitado para esta sesion.</p> : null}
            {error ? <p style={{ fontSize: "12px", color: "#fca5a5", marginTop: "10px" }}>{error}</p> : null}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
            <NotificationBanner audience="admin" />
            <button
              onClick={() => setRefreshToken((current) => current + 1)}
              disabled={loading}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "7px",
                minHeight: "36px",
                padding: "0 12px",
                borderRadius: "8px",
                border: "1px solid rgba(125,211,252,0.26)",
                background: "rgba(14,165,233,0.12)",
                color: "#bae6fd",
                fontSize: "12px",
                fontWeight: 800,
                cursor: loading ? "not-allowed" : "pointer",
                opacity: loading ? 0.65 : 1,
              }}
            >
              <RefreshCw size={13} style={{ animation: loading ? "spin 1s linear infinite" : "none" }} />
              Refrescar
            </button>
          </div>
        </div>
      </section>

      <section className="communications-stats" style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: "10px" }}>
        {stats.map((item) => {
          const Icon = item.icon;
          return (
            <article
              key={item.label}
              style={{
                border: "1px solid var(--border)",
                borderRadius: "8px",
                background: "var(--surface)",
                padding: "14px",
                minHeight: "82px",
                display: "flex",
                alignItems: "center",
                gap: "12px",
              }}
            >
              <div style={{ width: "34px", height: "34px", borderRadius: "8px", background: `${item.color}1f`, color: item.color, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <Icon size={17} />
              </div>
              <div style={{ minWidth: 0 }}>
                <p style={{ fontSize: "11px", color: "var(--muted)", fontWeight: 750, margin: 0 }}>{item.label}</p>
                <p style={{ fontSize: "24px", color: "var(--ink)", fontWeight: 850, margin: "2px 0 0" }}>{loading ? "-" : item.value}</p>
              </div>
            </article>
          );
        })}
      </section>

      <section className="communications-workspace" style={{ display: "grid", gridTemplateColumns: "minmax(300px, 0.42fr) minmax(0, 1fr)", gap: "12px", alignItems: "stretch" }}>
        <aside style={{ border: "1px solid var(--border)", borderRadius: "10px", background: "var(--surface)", padding: "14px", minHeight: "600px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: "10px", alignItems: "center", marginBottom: "12px" }}>
            <div>
              <h2 style={{ fontSize: "16px", color: "var(--ink)", fontWeight: 850, margin: 0 }}>Conversaciones</h2>
              <p style={{ fontSize: "12px", color: "var(--muted)", marginTop: "2px" }}>{visibleThreads.length} visibles</p>
            </div>
            {loading ? <RefreshCw size={15} style={{ color: "var(--muted)", animation: "spin 1s linear infinite" }} /> : null}
          </div>

          <div className="communications-filters" style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 132px", gap: "8px", marginBottom: "12px" }}>
            <label style={{ position: "relative", minWidth: 0 }}>
              <Search size={14} style={{ position: "absolute", left: "11px", top: "50%", transform: "translateY(-50%)", color: "var(--muted)" }} />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar"
                style={{ width: "100%", height: "38px", padding: "0 10px 0 34px", borderRadius: "8px", border: "1px solid var(--border)", background: "var(--bg)", color: "var(--ink)", fontSize: "13px" }}
              />
            </label>
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value as CommunicationThreadStatus | "all")}
              style={{ height: "38px", borderRadius: "8px", border: "1px solid var(--border)", background: "var(--bg)", color: "var(--ink)", padding: "0 10px", fontSize: "12px", fontWeight: 700 }}
            >
              {STATUS_OPTIONS.map((option) => (
                <option key={option} value={option}>{option === "all" ? "Todos" : option}</option>
              ))}
            </select>
          </div>

          <div style={{ display: "grid", gap: "8px", maxHeight: "690px", overflowY: "auto", paddingRight: "2px" }}>
            {!loading && visibleThreads.length === 0 ? (
              <div style={{ minHeight: "280px", display: "grid", placeItems: "center", textAlign: "center", color: "var(--muted)" }}>
                <div>
                  <Inbox size={34} style={{ color: "var(--faint)", margin: "0 auto 10px" }} />
                  <p style={{ fontSize: "13px", fontWeight: 750 }}>Sin conversaciones</p>
                  <p style={{ fontSize: "12px", marginTop: "3px" }}>No hay threads para el filtro actual.</p>
                </div>
              </div>
            ) : null}

            {visibleThreads.map((thread) => {
              const active = thread.id === selectedThreadId;
              const summary = metadataValue(thread, ["smartIntake", "summary"]) ?? thread.intent ?? thread.source;
              return (
                <button
                  key={thread.id}
                  onClick={() => setSelectedThreadId(thread.id)}
                  style={{
                    width: "100%",
                    textAlign: "left",
                    border: `1px solid ${active ? "rgba(45,212,191,0.55)" : "var(--border)"}`,
                    borderRadius: "8px",
                    background: active ? "rgba(20,184,166,0.11)" : "var(--bg)",
                    color: "var(--ink)",
                    padding: "12px",
                    cursor: "pointer",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: "8px", alignItems: "flex-start" }}>
                    <div style={{ minWidth: 0 }}>
                      <p style={{ fontSize: "13px", fontWeight: 850, margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {thread.contactName || thread.contactPhone || "Contacto sin nombre"}
                      </p>
                      <p style={{ fontSize: "12px", color: "var(--muted)", marginTop: "3px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {thread.contactPhone || thread.externalThreadId || shortId(thread.id)}
                      </p>
                    </div>
                    <StatusPill value={thread.status} />
                  </div>
                  <p style={{ fontSize: "12px", color: "var(--muted)", marginTop: "10px", minHeight: "18px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {summary}
                  </p>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px", marginTop: "10px", color: "var(--faint)", fontSize: "11px" }}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: "5px" }}>
                      <Clock3 size={11} />
                      {formatTimestamp(thread.lastMessageAt ?? thread.updatedAt)}
                    </span>
                    <span>{thread.channel.replace("_", " ")}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </aside>

        <section style={{ border: "1px solid var(--border)", borderRadius: "10px", background: "var(--surface)", minHeight: "600px", display: "grid", gridTemplateRows: "auto minmax(360px, 1fr) auto", overflow: "hidden" }}>
          {selectedThread ? (
            <>
              <header style={{ padding: "16px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", gap: "12px", flexWrap: "wrap", alignItems: "flex-start" }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "9px", flexWrap: "wrap" }}>
                    <div style={{ width: "34px", height: "34px", borderRadius: "8px", background: "rgba(96,165,250,0.16)", color: "#60a5fa", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <Phone size={16} />
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <h2 style={{ fontSize: "17px", color: "var(--ink)", fontWeight: 850, margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {selectedThread.contactName || selectedThread.contactPhone || "Contacto"}
                      </h2>
                      <p style={{ fontSize: "12px", color: "var(--muted)", marginTop: "2px" }}>{selectedThread.contactPhone || selectedThread.externalThreadId || shortId(selectedThread.id)}</p>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: "7px", flexWrap: "wrap", marginTop: "12px", alignItems: "center" }}>
                    <StatusPill value={selectedThread.status} />
                    {selectedThread.contractorLeadId ? (
                      <Link href={`/admin/contractor-leads/${selectedThread.contractorLeadId}`} style={{ textDecoration: "none" }}>
                        <span style={{ ...chipStyle("#60a5fa"), cursor: "pointer" }}>Lead ↗ {shortId(selectedThread.contractorLeadId)}</span>
                      </Link>
                    ) : null}
                    {selectedThread.projectId ? <span style={chipStyle("#fbbf24")}>Proyecto {shortId(selectedThread.projectId)}</span> : null}
                    {selectedThread.jobId ? <span style={chipStyle("#34d399")}>Job {shortId(selectedThread.jobId)}</span> : null}
                  </div>
                  <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginTop: "10px" }}>
                    {selectedThread.status !== "OPEN" && (
                      <button onClick={() => void handleStatusChange("OPEN")} disabled={statusChanging} style={actionBtnStyle("#2dd4bf", statusChanging)}>Reabrir</button>
                    )}
                    {selectedThread.status !== "PENDING" && (
                      <button onClick={() => void handleStatusChange("PENDING")} disabled={statusChanging} style={actionBtnStyle("#fbbf24", statusChanging)}>Pendiente</button>
                    )}
                    {selectedThread.status !== "CLOSED" && (
                      <button onClick={() => void handleStatusChange("CLOSED")} disabled={statusChanging} style={actionBtnStyle("#94a3b8", statusChanging)}>Cerrar</button>
                    )}
                  </div>
                </div>
                <div style={{ color: "var(--muted)", fontSize: "12px", textAlign: "right" }}>
                  <p style={{ margin: 0 }}>Thread {shortId(selectedThread.id)}</p>
                  <p style={{ marginTop: "4px" }}>{formatTimestamp(selectedThread.lastMessageAt ?? selectedThread.updatedAt)}</p>
                </div>
              </header>

              <div style={{ padding: "16px", overflowY: "auto", background: "linear-gradient(180deg, rgba(15,23,42,0.28), rgba(15,23,42,0))" }}>
                {messagesError ? <p style={{ color: "#fca5a5", fontSize: "12px", marginBottom: "10px" }}>{messagesError}</p> : null}
                {messagesLoading ? (
                  <div style={{ minHeight: "260px", display: "grid", placeItems: "center", color: "var(--muted)", fontSize: "13px" }}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: "8px" }}>
                      <RefreshCw size={14} style={{ animation: "spin 1s linear infinite" }} />
                      Cargando conversacion
                    </span>
                  </div>
                ) : null}

                {!messagesLoading && messages.length === 0 ? (
                  <div style={{ minHeight: "280px", display: "grid", placeItems: "center", textAlign: "center", color: "var(--muted)" }}>
                    <div>
                      <MessageSquare size={34} style={{ color: "var(--faint)", margin: "0 auto 10px" }} />
                      <p style={{ fontSize: "13px", fontWeight: 750 }}>Sin mensajes</p>
                    </div>
                  </div>
                ) : null}

                <div style={{ display: "grid", gap: "10px" }}>
                  {messages.map((message) => {
                    const outbound = message.direction === "OUTBOUND";
                    return (
                      <Fragment key={message.id}>
                        <div style={{ display: "flex", justifyContent: outbound ? "flex-end" : "flex-start" }}>
                          <article
                            style={{
                              maxWidth: "min(680px, 82%)",
                              border: `1px solid ${outbound ? "rgba(45,212,191,0.28)" : "var(--border)"}`,
                              borderRadius: "8px",
                              background: outbound ? "rgba(20,184,166,0.12)" : "var(--bg)",
                              padding: "10px 12px",
                              color: "var(--ink)",
                            }}
                          >
                            <div style={{ display: "flex", alignItems: "center", gap: "7px", marginBottom: "6px", color: outbound ? "#5eead4" : "#93c5fd", fontSize: "11px", fontWeight: 850 }}>
                              {outbound ? <Send size={11} /> : <Phone size={11} />}
                              {outbound ? "SEMSE" : selectedThread.contactName || selectedThread.contactPhone || "Contacto"}
                              <span style={{ color: "var(--faint)", fontWeight: 650 }}>{message.status}</span>
                            </div>
                            <p style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere", fontSize: "13px", lineHeight: 1.5, margin: 0 }}>
                              {message.body || "[media]"}
                            </p>
                            <p style={{ fontSize: "11px", color: "var(--faint)", marginTop: "7px" }}>{formatTimestamp(message.createdAt)}</p>
                          </article>
                        </div>
                        {message === messages[messages.length - 1] ? <div ref={messagesEndRef} /> : null}
                      </Fragment>
                    );
                  })}
                </div>
              </div>

              <form onSubmit={handleSend} style={{ borderTop: "1px solid var(--border)", padding: "14px", display: "grid", gap: "9px", background: "var(--surface)" }}>
                {sendError ? (
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "8px 10px", borderRadius: "7px", background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)" }}>
                    <XCircle size={13} style={{ color: "#fca5a5", flexShrink: 0 }} />
                    <p style={{ color: "#fca5a5", fontSize: "12px", margin: 0, flex: 1 }}>{sendError}</p>
                    <button type="button" onClick={() => setSendError(null)} style={{ color: "#94a3b8", fontSize: "11px", background: "none", border: "none", cursor: "pointer", padding: 0 }}>×</button>
                  </div>
                ) : null}
                {sendSuccess ? <p style={{ color: "#5eead4", fontSize: "12px" }}>{sendSuccess}</p> : null}
                <div style={{ display: "flex", gap: "5px", flexWrap: "wrap" }}>
                  {QUICK_REPLIES.map((qr) => (
                    <button key={qr.label} type="button" onClick={() => handleQuickReply(qr.body)}
                      style={{ fontSize: "11px", fontWeight: 700, padding: "3px 9px", borderRadius: "6px", border: "1px solid rgba(99,102,241,0.3)", background: "rgba(99,102,241,0.08)", color: "#a5b4fc", cursor: "pointer" }}>
                      {qr.label}
                    </button>
                  ))}
                </div>
                <textarea
                  ref={replyRef}
                  value={reply}
                  onChange={(event) => setReply(event.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); e.currentTarget.form?.requestSubmit(); } }}
                  placeholder="Responder… (Enter envía, Shift+Enter nueva línea · j/k navegar · r enfocar)"
                  rows={3}
                  style={{ width: "100%", resize: "vertical", minHeight: "76px", borderRadius: "8px", border: "1px solid var(--border)", background: "var(--bg)", color: "var(--ink)", padding: "11px 12px", fontSize: "13px", lineHeight: 1.45 }}
                />
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: "6px", color: "var(--muted)", fontSize: "12px" }}>
                    <ShieldCheck size={13} />
                    {selectedThread.channel.replace("_", " ")}
                  </span>
                  <button
                    type="submit"
                    disabled={sending || !reply.trim()}
                    style={primaryButtonStyle(sending || !reply.trim())}
                  >
                    {sending ? <RefreshCw size={14} style={{ animation: "spin 1s linear infinite" }} /> : <Send size={14} />}
                    Enviar
                  </button>
                </div>
              </form>
            </>
          ) : (
            <div style={{ minHeight: "600px", display: "grid", placeItems: "center", textAlign: "center", color: "var(--muted)", padding: "24px" }}>
              <div>
                <Inbox size={40} style={{ color: "var(--faint)", margin: "0 auto 12px" }} />
                <p style={{ fontSize: "14px", fontWeight: 800 }}>Selecciona una conversacion</p>
              </div>
            </div>
          )}
        </section>
      </section>

      <section className="communications-ops-grid" style={{ display: "grid", gridTemplateColumns: "minmax(320px, 0.8fr) minmax(0, 1fr) minmax(280px, 0.75fr)", gap: "12px" }}>
        <form onSubmit={handleManualInbound} style={{ border: "1px solid var(--border)", borderRadius: "10px", background: "var(--surface)", padding: "16px", display: "grid", gap: "10px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "9px" }}>
            <div style={{ width: "32px", height: "32px", borderRadius: "8px", background: "rgba(20,184,166,0.14)", color: "#2dd4bf", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Sparkles size={15} />
            </div>
            <div>
              <h2 style={{ fontSize: "15px", fontWeight: 850, color: "var(--ink)", margin: 0 }}>Inbound manual</h2>
              <p style={{ fontSize: "12px", color: "var(--muted)", marginTop: "2px" }}>WHATSAPP_CLOUD mock/live</p>
            </div>
          </div>

          <label style={fieldLabelStyle()}>
            Telefono
            <input value={manualPhone} onChange={(event) => setManualPhone(event.target.value)} style={inputStyle()} />
          </label>
          <label style={fieldLabelStyle()}>
            Nombre
            <input value={manualName} onChange={(event) => setManualName(event.target.value)} placeholder="Opcional" style={inputStyle()} />
          </label>
          <label style={fieldLabelStyle()}>
            Mensaje
            <textarea value={manualBody} onChange={(event) => setManualBody(event.target.value)} rows={4} style={{ ...inputStyle(), height: "auto", minHeight: "92px", paddingTop: "10px", resize: "vertical" }} />
          </label>
          {manualFeedback ? (
            <p style={{ fontSize: "12px", color: manualFeedback.kind === "ok" ? "#5eead4" : "#fca5a5" }}>{manualFeedback.message}</p>
          ) : null}
          <button type="submit" disabled={manualLoading || !manualPhone.trim() || !manualBody.trim()} style={primaryButtonStyle(manualLoading || !manualPhone.trim() || !manualBody.trim())}>
            {manualLoading ? <RefreshCw size={14} style={{ animation: "spin 1s linear infinite" }} /> : <Phone size={14} />}
            Registrar inbound
          </button>
        </form>

        <article style={{ border: "1px solid var(--border)", borderRadius: "10px", background: "var(--surface)", padding: "16px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", marginBottom: "12px" }}>
            <div>
              <h2 style={{ fontSize: "15px", fontWeight: 850, color: "var(--ink)", margin: 0 }}>Puentes activos</h2>
              <p style={{ fontSize: "12px", color: "var(--muted)", marginTop: "2px" }}>Intake, leads, outbox y notificaciones</p>
            </div>
            <Bot size={18} style={{ color: "#93c5fd" }} />
          </div>
          <div style={{ display: "grid", gap: "9px" }}>
            {[
              { label: "Lead capture", value: "Inbound project-like crea ContractorLead", ok: true },
              { label: "Smart intake", value: "Analisis enlazado al thread", ok: true },
              { label: "Outbox", value: "Persistencia antes/despues del provider", ok: true },
              { label: "WhatsApp real", value: channelAccounts.some(a => a.provider === "WHATSAPP_CLOUD" && a._envConfigured) ? "Configurado por variables de entorno (sin cuenta DB)" : channelAccounts.some(a => a.provider === "WHATSAPP_CLOUD") ? "Cuenta DB registrada" : "Depende de credenciales Cloud API", ok: channelAccounts.some((account) => account.provider === "WHATSAPP_CLOUD") },
            ].map((item) => (
              <div key={item.label} style={{ display: "flex", alignItems: "flex-start", gap: "10px", padding: "10px", borderRadius: "8px", border: "1px solid var(--border)", background: "var(--bg)" }}>
                {item.ok ? <CheckCircle2 size={15} style={{ color: "#34d399", marginTop: "2px", flexShrink: 0 }} /> : <XCircle size={15} style={{ color: "#f59e0b", marginTop: "2px", flexShrink: 0 }} />}
                <div style={{ minWidth: 0 }}>
                  <p style={{ fontSize: "13px", fontWeight: 800, color: "var(--ink)", margin: 0 }}>{item.label}</p>
                  <p style={{ fontSize: "12px", color: "var(--muted)", marginTop: "2px" }}>{item.value}</p>
                </div>
              </div>
            ))}
          </div>
        </article>

        <article style={{ border: "1px solid var(--border)", borderRadius: "10px", background: "var(--surface)", padding: "16px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", marginBottom: "12px" }}>
            <div>
              <h2 style={{ fontSize: "15px", fontWeight: 850, color: "var(--ink)", margin: 0 }}>Canales</h2>
              <p style={{ fontSize: "12px", color: "var(--muted)", marginTop: "2px" }}>{channelAccounts.length} cuentas</p>
            </div>
            <Wifi size={18} style={{ color: "#2dd4bf" }} />
          </div>

          <div style={{ display: "grid", gap: "9px" }}>
            {channelAccounts.length === 0 ? (
              <div style={{ border: "1px solid var(--border)", borderRadius: "8px", background: "var(--bg)", padding: "12px", color: "var(--muted)", fontSize: "12px" }}>
                Sin cuentas registradas.
              </div>
            ) : null}
            {channelAccounts.map((account) => (
              <div key={account.id} style={{ border: `1px solid ${account._envConfigured ? "rgba(245,158,11,0.3)" : "var(--border)"}`, borderRadius: "8px", background: "var(--bg)", padding: "11px" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" }}>
                  <p style={{ fontSize: "13px", fontWeight: 850, color: "var(--ink)", margin: 0 }}>{account.label}</p>
                  <StatusPill value={account.status} />
                </div>
                <p style={{ fontSize: "12px", color: "var(--muted)", marginTop: "6px" }}>{account.provider.replace(/_/g, " ")}</p>
                <p style={{ fontSize: "11px", color: "var(--faint)", marginTop: "4px" }}>{account.displayPhone || account.phoneNumberId || shortId(account.id)}</p>
                {account._warning ? (
                  <p style={{ fontSize: "11px", color: "#fbbf24", marginTop: "6px", lineHeight: 1.4 }}>{account._warning}</p>
                ) : null}
              </div>
            ))}
          </div>
        </article>
      </section>

      <style>{`
        @media (max-width: 1180px) {
          .communications-ops-grid {
            grid-template-columns: 1fr 1fr !important;
          }
        }

        @media (max-width: 900px) {
          .communications-stats,
          .communications-workspace,
          .communications-ops-grid {
            grid-template-columns: 1fr !important;
          }

          .communications-filters {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
}

function chipStyle(color: string): CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    height: "24px",
    padding: "0 9px",
    borderRadius: "999px",
    background: `${color}17`,
    border: `1px solid ${color}35`,
    color,
    fontSize: "11px",
    fontWeight: 800,
  };
}

function actionBtnStyle(color: string, disabled: boolean): CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    height: "26px",
    padding: "0 10px",
    borderRadius: "6px",
    border: `1px solid ${color}40`,
    background: `${color}14`,
    color,
    fontSize: "11px",
    fontWeight: 800,
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.5 : 1,
  };
}

function fieldLabelStyle(): CSSProperties {
  return {
    display: "grid",
    gap: "6px",
    color: "var(--muted)",
    fontSize: "12px",
    fontWeight: 750,
  };
}

function inputStyle(): CSSProperties {
  return {
    width: "100%",
    height: "38px",
    borderRadius: "8px",
    border: "1px solid var(--border)",
    background: "var(--bg)",
    color: "var(--ink)",
    padding: "0 10px",
    fontSize: "13px",
  };
}

function primaryButtonStyle(disabled: boolean): CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "7px",
    minHeight: "38px",
    padding: "0 14px",
    borderRadius: "8px",
    border: "1px solid rgba(20,184,166,0.35)",
    background: disabled ? "rgba(20,184,166,0.12)" : "#0f766e",
    color: disabled ? "rgba(204,251,241,0.58)" : "#ecfeff",
    fontSize: "12px",
    fontWeight: 850,
    cursor: disabled ? "not-allowed" : "pointer",
  };
}
