"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { cn } from "../lib/cn";
import { fetchNotifications, markNotificationRead } from "./semse-api";
import { PushEnableButton } from "../components/notifications/PushEnableButton";

const links = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/", label: "Jobs" },
  { href: "/jobs/new", label: "Publicar" },
  { href: "/field-ops", label: "Field Ops" },
  { href: "/communications", label: "Inbox" },
  { href: "/cortex", label: "Cortex" },
];

function NotificationBell() {
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const { unread: count } = await fetchNotifications({ unreadOnly: true });
        setUnread(count);
      } catch {
        // silent — notifications are best-effort
      }
    };
    void load();
    const timer = setInterval(() => void load(), 30_000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!open) return;
    const handle = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [open]);

  const handleOpen = async () => {
    if (loading) return;
    setOpen((v) => !v);
    if (!open) {
      setLoading(true);
      try {
        const { items: list, unread: count } = await fetchNotifications();
        setItems(list);
        setUnread(count);
      } catch {
        // silent
      } finally {
        setLoading(false);
      }
    }
  };

  const handleRead = async (id: string) => {
    try {
      await markNotificationRead(id);
      setItems((prev) => prev.map((n) => n.id === id ? { ...n, readAt: new Date().toISOString() } : n));
      setUnread((v) => Math.max(0, v - 1));
    } catch {
      // silent
    }
  };

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        onClick={() => void handleOpen()}
        aria-label={`Notificaciones${unread > 0 ? ` (${unread} sin leer)` : ""}`}
        style={{
          position: "relative",
          background: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: "8px",
          padding: "6px 10px",
          color: "var(--muted)",
          fontSize: "14px",
          cursor: "pointer",
          lineHeight: 1,
        }}
      >
        🔔
        {unread > 0 && (
          <span style={{
            position: "absolute",
            top: "-4px",
            right: "-4px",
            background: "var(--brand, #6366f1)",
            color: "#fff",
            borderRadius: "999px",
            fontSize: "10px",
            fontWeight: 700,
            minWidth: "16px",
            height: "16px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "0 4px",
          }}>
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div style={{
          position: "absolute",
          top: "calc(100% + 8px)",
          right: 0,
          width: "320px",
          maxHeight: "400px",
          overflowY: "auto",
          background: "var(--panel, #0d0d20)",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: "12px",
          boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
          zIndex: 100,
        }}>
          <div style={{ padding: "12px 14px", borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "12px", fontWeight: 700, color: "var(--ink)" }}>Notificaciones</span>
            {unread > 0 && <span style={{ fontSize: "11px", color: "var(--brand, #6366f1)" }}>{unread} sin leer</span>}
          </div>
          {loading ? (
            <div style={{ padding: "20px", textAlign: "center", color: "var(--muted)", fontSize: "12px" }}>Cargando…</div>
          ) : items.length === 0 ? (
            <div style={{ padding: "20px", textAlign: "center", color: "var(--muted)", fontSize: "12px" }}>Sin notificaciones</div>
          ) : (
            <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
              {items.slice(0, 20).map((n) => {
                const id = String(n.id ?? "");
                const isRead = Boolean(n.readAt);
                return (
                  <li
                    key={id}
                    onClick={() => !isRead && void handleRead(id)}
                    style={{
                      padding: "10px 14px",
                      borderBottom: "1px solid rgba(255,255,255,0.04)",
                      background: isRead ? "transparent" : "rgba(99,102,241,0.06)",
                      cursor: isRead ? "default" : "pointer",
                    }}
                  >
                    <p style={{ fontSize: "12px", fontWeight: isRead ? 400 : 600, color: "var(--ink)", marginBottom: "2px" }}>
                      {String(n.title ?? "")}
                    </p>
                    <p style={{ fontSize: "11px", color: "var(--muted)", lineHeight: 1.4 }}>
                      {String(n.body ?? "")}
                    </p>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

export function Nav() {
  const pathname = usePathname();

  function isActive(href: string) {
    if (!pathname) return false;
    if (href === "/") return pathname === "/";
    return pathname === href || pathname.startsWith(href + "/");
  }

  return (
    <header className="nav" role="banner">
      <a
        href="#main-content"
        className="absolute -top-10 left-4 z-50 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-[#0a0a14] focus:top-4 transition-all"
      >
        Saltar al contenido
      </a>
      <div className="nav-inner">
        <Link
          className="nav-brand"
          href="/"
          aria-label="SEMSE — inicio"
        >
          <span className="nav-brand-dot" aria-hidden="true" />
          SEMSE
        </Link>

        <nav className="nav-links" aria-label="Navegación principal">
          {links.map(({ href, label }) => {
            const active = isActive(href);
            return (
              <Link
                key={href}
                className={cn("nav-link", active && "active")}
                href={href}
                aria-current={active ? "page" : undefined}
              >
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-2">
          <PushEnableButton />
          <NotificationBell />
          <div
            aria-label="Estado del sistema"
            className="hidden sm:flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.04] px-3 py-1"
          >
            <span
              aria-hidden
              className="inline-block h-1.5 w-1.5 rounded-full bg-brand shadow-[0_0_6px_theme(colors.brand)]"
            />
            <span className="text-[0.68rem] font-semibold tracking-widest uppercase text-muted">
              Operativo
            </span>
          </div>
        </div>
      </div>
    </header>
  );
}
