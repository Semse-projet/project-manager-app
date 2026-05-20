"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Bell, CheckCheck, X } from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

type Notification = {
  id: string;
  type: string;
  title: string;
  body: string;
  readAt: string | null;
  createdAt: string;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const TYPE_COLORS: Record<string, string> = {
  milestone_submitted:   "#818cf8",
  evidence_gap:          "#fca5a5",
  payment_blocked:       "#fb923c",
  change_order:          "#fcd34d",
  job_assigned:          "#86efac",
  plan_approved:         "#67e8f9",
  dispute_opened:        "#f87171",
  reservation_created:   "#a78bfa",
};

function notifColor(type: string): string {
  return TYPE_COLORS[type] ?? "#94a3b8";
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "ahora";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function NotificationBell() {
  const [open,    setOpen]    = useState(false);
  const [notifs,  setNotifs]  = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const unread = notifs.filter((n) => !n.readAt).length;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/semse/notifications?limit=15");
      if (!res.ok) return;
      const json = await res.json() as { data: Notification[] | { notifications: Notification[] } };
      const items = Array.isArray(json.data) ? json.data : (json.data as { notifications: Notification[] }).notifications ?? [];
      setNotifs(items);
    } catch { /* silent */ } finally {
      setLoading(false);
    }
  }, []);

  const markAllRead = async () => {
    try {
      await fetch("/api/semse/notifications/read-all", { method: "POST" });
      setNotifs((prev) => prev.map((n) => ({ ...n, readAt: new Date().toISOString() })));
    } catch { /* silent */ }
  };

  useEffect(() => {
    void load();
    // Poll every 30s as fallback (SSE will eventually replace)
    const t = setInterval(() => void load(), 30_000);
    return () => clearInterval(t);
  }, [load]);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        onClick={() => { setOpen((p) => !p); if (!open) void load(); }}
        style={{ position: "relative", width: 34, height: 34, borderRadius: 10, background: "rgba(255,255,255,.05)", border: "1px solid var(--border)", display: "grid", placeItems: "center", cursor: "pointer" }}>
        <Bell size={15} color="var(--muted)" />
        {unread > 0 && (
          <span style={{ position: "absolute", top: -2, right: -2, minWidth: 16, height: 16, borderRadius: 99, background: "#ef4444", color: "#fff", fontSize: 9, fontWeight: 900, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 4px" }}>
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div style={{ position: "absolute", right: 0, top: "calc(100% + 8px)", width: 320, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, boxShadow: "0 8px 32px rgba(0,0,0,.4)", zIndex: 200, overflow: "hidden" }}>
          {/* Header */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "12px 14px", borderBottom: "1px solid var(--border)" }}>
            <Bell size={13} color="#818cf8" />
            <span style={{ fontSize: 13, fontWeight: 800, flex: 1 }}>Notificaciones</span>
            {unread > 0 && (
              <button onClick={markAllRead}
                style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10, color: "#818cf8", background: "none", border: "none", cursor: "pointer", fontWeight: 700 }}>
                <CheckCheck size={11} /> Marcar todo leído
              </button>
            )}
            <button onClick={() => setOpen(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted)" }}>
              <X size={13} />
            </button>
          </div>

          {/* List */}
          <div style={{ maxHeight: 380, overflowY: "auto" }}>
            {loading && notifs.length === 0 && (
              <div style={{ padding: "20px", textAlign: "center", fontSize: 12, color: "var(--muted)" }}>Cargando…</div>
            )}
            {!loading && notifs.length === 0 && (
              <div style={{ padding: "24px", textAlign: "center", fontSize: 12, color: "var(--muted)" }}>Sin notificaciones</div>
            )}
            {notifs.map((n) => (
              <div key={n.id}
                style={{ padding: "12px 14px", borderBottom: "1px solid var(--border)", background: n.readAt ? "transparent" : "rgba(99,102,241,.04)", display: "flex", gap: 10 }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: notifColor(n.type), flexShrink: 0, marginTop: 4 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "var(--ink)", overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>{n.title}</div>
                  <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>{n.body}</div>
                </div>
                <div style={{ fontSize: 9, color: "var(--muted)", flexShrink: 0, marginTop: 2 }}>{relativeTime(n.createdAt)}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
