"use client";

import { useState, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import { normalizeSafeRedirectPath } from "@/lib/safe-redirect";

const DEMO_LOGIN_ENABLED =
  process.env.NEXT_PUBLIC_SEMSE_DEMO_LOGIN_ENABLED?.trim() === "true" ||
  process.env.NODE_ENV !== "production";

// ── Demo account presets ─────────────────────────────────────────────────────

const PRESETS = [
  {
    label: "Profesional",
    email: "worker@demo.semse",
    color: "#10b981",
    icon: "🪖",
    desc: "Field Ops · Time Tracker · Evidencia",
  },
  {
    label: "Cliente",
    email: "client@demo.semse",
    color: "#3b82f6",
    icon: "🏢",
    desc: "Publicar trabajos · Milestones · Pagos",
  },
  {
    label: "Admin",
    email: "admin@demo.semse",
    color: "#8b5cf6",
    icon: "⚙️",
    desc: "Operaciones · Disputas · Config",
  },
] as const;

// ── Component ────────────────────────────────────────────────────────────────

export default function LoginPage() {
  const searchParams = useSearchParams();
  const [email, setEmail]       = useState(DEMO_LOGIN_ENABLED ? "client@demo.semse" : "");
  const [password, setPassword] = useState(DEMO_LOGIN_ENABLED ? "demo1234" : "");
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const redirectTo = normalizeSafeRedirectPath(searchParams?.get("from")) ?? undefined;

  const activePreset = DEMO_LOGIN_ENABLED ? PRESETS.find(p => p.email === email) ?? null : null;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/semse/auth/token", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password, redirectTo }),
      });

      const data = (await res.json()) as { ok?: boolean; redirectTo?: string; error?: string };

      if (!res.ok || !data.ok) {
        setError(data.error ?? "Error al iniciar sesión");
        return;
      }

      window.location.assign(data.redirectTo ?? "/client/dashboard");
    } catch {
      setError("No se pudo conectar con el servidor");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "var(--bg, #050810)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
      }}
    >
      <div style={{ width: "100%", maxWidth: "440px" }}>

        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: "36px" }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "10px",
              marginBottom: "8px",
            }}
          >
            <div
              style={{
                width: "40px",
                height: "40px",
                borderRadius: "12px",
                background: "linear-gradient(135deg, #3b82f6, #8b5cf6)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "18px",
              }}
            >
              ⚡
            </div>
            <span
              style={{
                fontSize: "24px",
                fontWeight: 900,
                color: "var(--ink, #f1f5f9)",
                letterSpacing: "-0.5px",
              }}
            >
              SEMSE OS
            </span>
          </div>
          <p style={{ color: "var(--muted, #94a3b8)", fontSize: "14px" }}>
            Plataforma de gestión de obras y servicios
          </p>
        </div>

        {/* Card */}
        <div
          style={{
            background: "var(--surface, #0c1017)",
            border: "1px solid var(--border, #1f2d3d)",
            borderRadius: "16px",
            padding: "28px",
          }}
        >
          <h2
            style={{
              fontSize: "18px",
              fontWeight: 700,
              color: "var(--ink, #f1f5f9)",
              marginBottom: "20px",
            }}
          >
            Iniciar sesión
          </h2>

          {redirectTo && (
            <div
              style={{
                marginBottom: "16px",
                padding: "10px 12px",
                borderRadius: "10px",
                background: "rgba(59,130,246,.12)",
                border: "1px solid rgba(59,130,246,.25)",
                color: "#93c5fd",
                fontSize: "12px",
              }}
            >
              Después de entrar volverás a <strong>{redirectTo}</strong>
            </div>
          )}

          {DEMO_LOGIN_ENABLED && (
            <div style={{ marginBottom: "20px" }}>
              <p
                style={{
                  fontSize: "11px",
                  fontWeight: 600,
                  color: "var(--muted, #94a3b8)",
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  marginBottom: "10px",
                }}
              >
                Entrar como
              </p>
              <div style={{ display: "flex", gap: "8px" }}>
                {PRESETS.map((p) => {
                  const active = email === p.email;
                  return (
                    <button
                      key={p.email}
                      type="button"
                      onClick={() => { setEmail(p.email); setError(null); }}
                      style={{
                        flex: 1,
                        padding: "10px 8px",
                        borderRadius: "10px",
                        border: `1.5px solid ${active ? p.color : "var(--border, #1f2d3d)"}`,
                        background: active ? `${p.color}18` : "transparent",
                        color: active ? p.color : "var(--muted, #94a3b8)",
                        cursor: "pointer",
                        textAlign: "center",
                        transition: "all 0.15s ease",
                      }}
                    >
                      <div style={{ fontSize: "18px", marginBottom: "4px" }}>{p.icon}</div>
                      <div style={{ fontSize: "11px", fontWeight: 700 }}>{p.label}</div>
                    </button>
                  );
                })}
              </div>
              {activePreset && (
                <p
                  style={{
                    fontSize: "12px",
                    color: "var(--muted, #94a3b8)",
                    marginTop: "8px",
                    textAlign: "center",
                  }}
                >
                  {activePreset.desc}
                </p>
              )}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: "14px" }}>
              <label
                style={{
                  display: "block",
                  fontSize: "12px",
                  fontWeight: 600,
                  color: "var(--muted, #94a3b8)",
                  marginBottom: "6px",
                }}
              >
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: "8px",
                  border: "1px solid var(--border, #1f2d3d)",
                  background: "var(--raised, #111827)",
                  color: "var(--ink, #f1f5f9)",
                  fontSize: "14px",
                  outline: "none",
                  boxSizing: "border-box",
                }}
              />
            </div>

            <div style={{ marginBottom: "20px" }}>
              <label
                style={{
                  display: "block",
                  fontSize: "12px",
                  fontWeight: 600,
                  color: "var(--muted, #94a3b8)",
                  marginBottom: "6px",
                }}
              >
                Contraseña
              </label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: "8px",
                  border: "1px solid var(--border, #1f2d3d)",
                  background: "var(--raised, #111827)",
                  color: "var(--ink, #f1f5f9)",
                  fontSize: "14px",
                  outline: "none",
                  boxSizing: "border-box",
                }}
              />
            </div>

            {error && (
              <div
                style={{
                  padding: "10px 14px",
                  borderRadius: "8px",
                  background: "rgba(239,68,68,.12)",
                  border: "1px solid rgba(239,68,68,.3)",
                  color: "#ef4444",
                  fontSize: "13px",
                  marginBottom: "16px",
                }}
              >
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                width: "100%",
                padding: "12px",
                borderRadius: "10px",
                border: "none",
                background: loading
                  ? "var(--faint, #4b6280)"
                  : "linear-gradient(135deg, #3b82f6, #8b5cf6)",
                color: "#fff",
                fontSize: "14px",
                fontWeight: 700,
                cursor: loading ? "not-allowed" : "pointer",
                transition: "opacity 0.15s",
                opacity: loading ? 0.7 : 1,
              }}
            >
              {loading ? "Ingresando…" : "Ingresar →"}
            </button>
          </form>

          {DEMO_LOGIN_ENABLED && (
            <p
              style={{
                marginTop: "18px",
                fontSize: "12px",
                color: "var(--faint, #4b6280)",
                textAlign: "center",
              }}
            >
              Modo demo · contraseña:{" "}
              <code
                style={{
                  background: "var(--raised, #111827)",
                  padding: "1px 6px",
                  borderRadius: "4px",
                  fontSize: "11px",
                }}
              >
                demo1234
              </code>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
