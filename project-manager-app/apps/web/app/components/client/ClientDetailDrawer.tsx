"use client";

import { useEffect } from "react";
import { X } from "lucide-react";

export function ClientDetailDrawer({
  open,
  title,
  subtitle,
  tone = "var(--brand)",
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  subtitle?: string;
  tone?: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose, open]);

  if (!open) return null;

  return (
    <div
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 260,
        display: "flex",
        justifyContent: "flex-end",
        background: "rgba(2,6,23,.48)",
        backdropFilter: "blur(10px)",
      }}
    >
      <aside
        style={{
          width: "min(460px, 100vw)",
          height: "100%",
          background: "var(--surface)",
          borderLeft: "1px solid var(--border)",
          boxShadow: "-24px 0 60px rgba(15,23,42,.24)",
          display: "flex",
          flexDirection: "column",
          animation: "slideInRight .18s ease-out",
        }}
      >
        <div style={{ padding: "22px 22px 16px", borderBottom: "1px solid var(--border)" }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "12px" }}>
            <div>
              <p style={{ fontSize: "11px", fontWeight: 800, color: tone, textTransform: "uppercase", letterSpacing: ".08em", marginBottom: "6px" }}>
                Contexto operativo
              </p>
              <h2 style={{ fontSize: "20px", fontWeight: 800, color: "var(--ink)", marginBottom: "4px" }}>{title}</h2>
              {subtitle ? <p style={{ fontSize: "12px", color: "var(--muted)", lineHeight: 1.5 }}>{subtitle}</p> : null}
            </div>
            <button
              onClick={onClose}
              style={{
                width: "34px",
                height: "34px",
                borderRadius: "10px",
                border: "1px solid var(--border)",
                background: "transparent",
                color: "var(--muted)",
                display: "grid",
                placeItems: "center",
                cursor: "pointer",
                flexShrink: 0,
              }}
            >
              <X size={16} />
            </button>
          </div>
        </div>

        <div style={{ padding: "18px 22px 24px", overflowY: "auto", display: "grid", gap: "14px" }}>{children}</div>
      </aside>
    </div>
  );
}
