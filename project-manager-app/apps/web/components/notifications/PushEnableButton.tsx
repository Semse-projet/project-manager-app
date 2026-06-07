"use client";

import { Bell, BellOff, BellRing } from "lucide-react";
import { usePushNotifications } from "@/hooks/usePushNotifications";

export function PushEnableButton() {
  const { permission, subscribed, loading, error, requestPermission } = usePushNotifications();

  if (permission === "unsupported") return null;
  if (permission === "denied") return (
    <button
      title="Notificaciones bloqueadas — habilitar en configuración del navegador"
      style={{ background: "none", border: "none", cursor: "not-allowed", padding: "6px", color: "var(--faint)", display: "flex" }}
    >
      <BellOff size={16} />
    </button>
  );
  if (permission === "granted" && subscribed) return (
    <button
      title="Notificaciones push activas"
      style={{ background: "none", border: "none", cursor: "default", padding: "6px", color: "#10b981", display: "flex" }}
    >
      <BellRing size={16} />
    </button>
  );

  return (
    <button
      onClick={() => void requestPermission()}
      disabled={loading}
      title="Activar notificaciones push"
      style={{
        background: "none", border: "none", cursor: loading ? "not-allowed" : "pointer",
        padding: "6px", color: "var(--muted)", display: "flex",
        opacity: loading ? 0.5 : 1,
        transition: "color .15s",
      }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "var(--ink)"; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "var(--muted)"; }}
    >
      <Bell size={16} />
      {error && <span style={{ position: "absolute", fontSize: 9, color: "#ef4444" }}>!</span>}
    </button>
  );
}
