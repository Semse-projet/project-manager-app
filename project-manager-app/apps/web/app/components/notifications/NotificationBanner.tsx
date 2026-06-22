"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Bell, CheckCheck, Scale, ShieldAlert, Wallet, X } from "lucide-react";
import { fetchNotifications, markNotificationRead, type NotificationItem } from "../../semse-api";

const KIND_META: Record<string, { color: string; Icon: React.ComponentType<{ size: number }> }> = {
  dispute:  { color: "#ef4444", Icon: Scale       },
  payment:  { color: "#10b981", Icon: Wallet      },
  approval: { color: "#f59e0b", Icon: ShieldAlert },
  system:   { color: "#6366f1", Icon: Bell        },
};

function kindMeta(kind: string) {
  return KIND_META[kind] ?? KIND_META.system;
}

function relativeTime(iso: string): string {
  try {
    const diff = Date.now() - new Date(iso).getTime();
    const m = Math.floor(diff / 60_000);
    if (m < 1)  return "ahora";
    if (m < 60) return `hace ${m} min`;
    const h = Math.floor(m / 60);
    if (h < 24) return `hace ${h} h`;
    return `hace ${Math.floor(h / 24)} d`;
  } catch { return "—"; }
}

export function NotificationBanner({ audience }: { audience: "client" | "worker" | "admin" }) {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const loadNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const { items: raw } = await fetchNotifications();
      const mapped: NotificationItem[] = raw.map((n) => {
        const type = String(n.type ?? n.kind ?? "system");
        const payload = n.payload as Record<string, unknown> | null | undefined;
        const jobId = typeof payload?.jobId === "string" ? payload.jobId : undefined;
        const milestoneId = typeof payload?.milestoneId === "string" ? payload.milestoneId : undefined;
        const disputeId = typeof payload?.disputeId === "string" ? payload.disputeId : undefined;

        let linkHref: string | undefined = typeof n.linkHref === "string" ? n.linkHref : undefined;
        if (!linkHref) {
          if (type === "bid_received"              && jobId) linkHref = `/client/jobs/${jobId}`;
          else if (type === "job_assigned"         && jobId) linkHref = `/worker/jobs/${jobId}`;
          else if (type === "bid_rejected"                 ) linkHref = `/worker/opportunities`;
          else if (type === "milestone_submitted"  && jobId) linkHref = `/client/jobs/${jobId}`;
          else if (type === "milestone_approved"   && jobId) linkHref = `/worker/jobs/${jobId}`;
          else if (type === "milestone_rejected"   && jobId) linkHref = `/worker/jobs/${jobId}`;
          else if (type === "escrow_released"      && jobId) linkHref = `/worker/jobs/${jobId}`;
          else if (type === "job_completed"        && jobId) linkHref = `/worker/jobs/${jobId}/rate`;
          else if (type === "job_completed_client" && jobId) linkHref = `/client/jobs/${jobId}`;
          else if (type === "rating_requested_pro" && jobId) linkHref = `/worker/jobs/${jobId}/rate`;
          else if (type === "rating_requested_client" && jobId) linkHref = `/client/jobs/${jobId}/rate`;
          else if (type === "intake_converted"     && jobId) linkHref = `/client/jobs/${jobId}`;
          else if (type === "dispute_opened"  && disputeId) linkHref = `/client/disputes`;
          else if (type === "dispute_resolved"&& disputeId) linkHref = `/worker/disputes`;
          else if (milestoneId && jobId) linkHref = `/client/jobs/${jobId}`;
        }

        return {
          id: String(n.id ?? ""),
          title: String(n.title ?? ""),
          body: String(n.body ?? ""),
          kind: type as NotificationItem["kind"],
          read: Boolean(n.readAt),
          createdAt: String(n.createdAt ?? new Date().toISOString()),
          linkHref,
          targetRole: typeof n.targetRole === "string" ? n.targetRole as NotificationItem["targetRole"] : undefined,
        };
      });
      setItems(mapped.filter((n) => !n.targetRole || n.targetRole === audience));
    } catch {
      // silencioso — las notificaciones no bloquean la UI
    } finally {
      setLoading(false);
    }
  }, [audience]);

  useEffect(() => {
    void loadNotifications();
    const timer = setInterval(() => { void loadNotifications(); }, 60_000);
    return () => clearInterval(timer);
  }, [loadNotifications]);

  const unread = items.filter((n) => !n.read);

  async function handleMarkRead(id: string) {
    try {
      await markNotificationRead(id);
      setItems((prev) => prev.map((n) => n.id === id ? { ...n, read: true } : n));
    } catch {}
  }

  async function handleMarkAllRead() {
    await Promise.all(unread.map((n) => markNotificationRead(n.id).catch(() => {})));
    setItems((prev) => prev.map((n) => ({ ...n, read: true })));
  }

  if (items.length === 0 && !loading) return null;

  return (
    <div style={{ position: "relative" }}>
      <button
        onClick={() => setOpen((v) => !v)}
        style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 12px", borderRadius: 10, border: `1px solid ${unread.length > 0 ? "rgba(239,68,68,.28)" : "var(--border)"}`, background: unread.length > 0 ? "rgba(239,68,68,.06)" : "var(--surface)", color: unread.length > 0 ? "#ef4444" : "var(--muted)", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
      >
        <Bell size={14} />
        {unread.length > 0 ? (
          <span style={{ minWidth: 18, height: 18, borderRadius: 999, background: "#ef4444", color: "#fff", fontSize: 10, fontWeight: 900, display: "inline-flex", alignItems: "center", justifyContent: "center", padding: "0 4px" }}>
            {unread.length}
          </span>
        ) : null}
      </button>

      {open ? (
        <div
          style={{ position: "absolute", top: "calc(100% + 8px)", right: 0, width: 360, maxHeight: 480, overflowY: "auto", borderRadius: 16, border: "1px solid var(--border)", background: "var(--surface)", boxShadow: "0 16px 40px rgba(0,0,0,.18)", zIndex: 200, display: "grid", gap: 0 }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px", borderBottom: "1px solid var(--border)" }}>
            <strong style={{ fontSize: 13, color: "var(--ink)" }}>Notificaciones {unread.length > 0 ? `(${unread.length} nuevas)` : ""}</strong>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              {unread.length > 0 ? (
                <button
                  onClick={() => void handleMarkAllRead()}
                  style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "4px 9px", borderRadius: 8, border: "1px solid var(--border)", background: "transparent", color: "var(--muted)", fontSize: 11, fontWeight: 700, cursor: "pointer" }}
                >
                  <CheckCheck size={11} /> Marcar leídas
                </button>
              ) : null}
              <button
                onClick={() => setOpen(false)}
                style={{ display: "inline-flex", padding: "4px", borderRadius: 8, border: "none", background: "transparent", color: "var(--muted)", cursor: "pointer" }}
              >
                <X size={14} />
              </button>
            </div>
          </div>

          {items.length === 0 ? (
            <div style={{ padding: "24px 16px", textAlign: "center", fontSize: 13, color: "var(--muted)" }}>
              No hay notificaciones.
            </div>
          ) : (
            <div style={{ display: "grid" }}>
              {items.slice(0, 20).map((item) => {
                const meta = kindMeta(item.kind);
                const Icon = meta.Icon;
                return (
                  <div
                    key={item.id}
                    style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)", background: item.read ? "transparent" : "rgba(99,102,241,.04)", display: "grid", gap: 6 }}
                  >
                    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                        <span style={{ color: meta.color, display: "flex" }}><Icon size={13} /></span>
                        <strong style={{ fontSize: 12, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.title}</strong>
                      </div>
                      <span style={{ fontSize: 10, color: "var(--faint)", flexShrink: 0 }}>{relativeTime(item.createdAt)}</span>
                    </div>
                    <p style={{ margin: 0, fontSize: 12, color: "var(--muted)", lineHeight: 1.55 }}>{item.body}</p>
                    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                      {item.linkHref ? (
                        <Link
                          href={item.linkHref}
                          onClick={() => { void handleMarkRead(item.id); setOpen(false); }}
                          style={{ fontSize: 11, fontWeight: 700, color: meta.color, textDecoration: "none" }}
                        >
                          Ver →
                        </Link>
                      ) : null}
                      {!item.read ? (
                        <button
                          onClick={() => void handleMarkRead(item.id)}
                          style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", background: "transparent", border: "none", cursor: "pointer", padding: 0 }}
                        >
                          Marcar leída
                        </button>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
