"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";

type AccountRole = "CLIENT" | "PRO";

const ROLE_OPTIONS: { role: AccountRole; label: string; icon: string; desc: string; color: string }[] = [
  {
    role: "CLIENT",
    label: "Cliente",
    icon: "🏢",
    desc: "Publica trabajos, gestiona proyectos y pagos",
    color: "#3b82f6",
  },
  {
    role: "PRO",
    label: "Profesional",
    icon: "🪖",
    desc: "Recibe trabajos, gestiona obras y cobra",
    color: "#10b981",
  },
];

function PasswordStrength({ password }: { password: string }) {
  if (!password) return null;
  const score = [
    password.length >= 8,
    /[A-Z]/.test(password),
    /[0-9]/.test(password),
    /[^A-Za-z0-9]/.test(password),
  ].filter(Boolean).length;

  const labels = ["Muy débil", "Débil", "Regular", "Fuerte", "Muy fuerte"];
  const colors = ["#ef4444", "#f97316", "#eab308", "#22c55e", "#10b981"];

  return (
    <div style={{ marginTop: "6px" }}>
      <div style={{ display: "flex", gap: "4px", marginBottom: "4px" }}>
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            style={{
              flex: 1,
              height: "3px",
              borderRadius: "2px",
              background: i < score ? colors[score] : "var(--border, #1f2d3d)",
              transition: "background 0.2s",
            }}
          />
        ))}
      </div>
      <span style={{ fontSize: "11px", color: score >= 3 ? "#22c55e" : "var(--muted, #94a3b8)" }}>
        {labels[score] ?? "Débil"}
      </span>
    </div>
  );
}

export default function RegisterPage() {
  const [role, setRole] = useState<AccountRole>("CLIENT");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const passwordMismatch = confirm.length > 0 && password !== confirm;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      setError("Las contraseñas no coinciden");
      return;
    }
    if (password.length < 8) {
      setError("La contraseña debe tener al menos 8 caracteres");
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/semse/auth/register", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password, name, role }),
      });

      const data = (await res.json()) as { ok?: boolean; redirectTo?: string; error?: string };

      if (!res.ok || !data.ok) {
        if (res.status === 409) {
          setError("Ya existe una cuenta con ese email. ¿Quieres iniciar sesión?");
        } else {
          setError(data.error ?? "No se pudo crear la cuenta");
        }
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
      <div style={{ width: "100%", maxWidth: "480px" }}>
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: "32px" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: "10px", marginBottom: "8px" }}>
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
            <span style={{ fontSize: "24px", fontWeight: 900, color: "var(--ink, #f1f5f9)", letterSpacing: "-0.5px" }}>
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
          <h2 style={{ fontSize: "18px", fontWeight: 700, color: "var(--ink, #f1f5f9)", marginBottom: "20px" }}>
            Crear cuenta
          </h2>

          {/* Role selector */}
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
              Tipo de cuenta
            </p>
            <div style={{ display: "flex", gap: "10px" }}>
              {ROLE_OPTIONS.map((opt) => {
                const active = role === opt.role;
                return (
                  <button
                    key={opt.role}
                    type="button"
                    onClick={() => setRole(opt.role)}
                    style={{
                      flex: 1,
                      padding: "12px 10px",
                      borderRadius: "10px",
                      border: `1.5px solid ${active ? opt.color : "var(--border, #1f2d3d)"}`,
                      background: active ? `${opt.color}18` : "transparent",
                      color: active ? opt.color : "var(--muted, #94a3b8)",
                      cursor: "pointer",
                      textAlign: "center",
                      transition: "all 0.15s ease",
                    }}
                  >
                    <div style={{ fontSize: "20px", marginBottom: "4px" }}>{opt.icon}</div>
                    <div style={{ fontSize: "12px", fontWeight: 700 }}>{opt.label}</div>
                    <div style={{ fontSize: "10px", marginTop: "2px", opacity: 0.8 }}>{opt.desc}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit}>
            {/* Name */}
            <div style={{ marginBottom: "14px" }}>
              <label style={labelStyle}>
                {role === "CLIENT" ? "Nombre de empresa / persona" : "Nombre completo"}
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                placeholder={role === "CLIENT" ? "ACME Corp o Juan Pérez" : "Juan Pérez"}
                style={inputStyle}
              />
            </div>

            {/* Email */}
            <div style={{ marginBottom: "14px" }}>
              <label style={labelStyle}>Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="tu@email.com"
                style={inputStyle}
              />
            </div>

            {/* Password */}
            <div style={{ marginBottom: "14px" }}>
              <label style={labelStyle}>Contraseña</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="Mínimo 8 caracteres"
                style={inputStyle}
              />
              <PasswordStrength password={password} />
            </div>

            {/* Confirm password */}
            <div style={{ marginBottom: "20px" }}>
              <label style={labelStyle}>Confirmar contraseña</label>
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
                placeholder="Repite la contraseña"
                style={{
                  ...inputStyle,
                  borderColor: passwordMismatch ? "#ef4444" : "var(--border, #1f2d3d)",
                }}
              />
              {passwordMismatch && (
                <span style={{ fontSize: "11px", color: "#ef4444", marginTop: "4px", display: "block" }}>
                  Las contraseñas no coinciden
                </span>
              )}
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
                {error.includes("iniciar sesión") && (
                  <>
                    {" "}
                    <Link href="/login" style={{ color: "#93c5fd", textDecoration: "underline" }}>
                      Ir al login
                    </Link>
                  </>
                )}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || passwordMismatch}
              style={{
                width: "100%",
                padding: "12px",
                borderRadius: "10px",
                border: "none",
                background:
                  loading || passwordMismatch
                    ? "var(--faint, #4b6280)"
                    : "linear-gradient(135deg, #3b82f6, #8b5cf6)",
                color: "#fff",
                fontSize: "14px",
                fontWeight: 700,
                cursor: loading || passwordMismatch ? "not-allowed" : "pointer",
                transition: "opacity 0.15s",
                opacity: loading || passwordMismatch ? 0.7 : 1,
              }}
            >
              {loading ? "Creando cuenta…" : "Crear cuenta →"}
            </button>
          </form>

          <p style={{ marginTop: "18px", fontSize: "13px", color: "var(--muted, #94a3b8)", textAlign: "center" }}>
            ¿Ya tienes cuenta?{" "}
            <Link href="/login" style={{ color: "#93c5fd", textDecoration: "none", fontWeight: 600 }}>
              Iniciar sesión
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: "12px",
  fontWeight: 600,
  color: "var(--muted, #94a3b8)",
  marginBottom: "6px",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: "8px",
  border: "1px solid var(--border, #1f2d3d)",
  background: "var(--raised, #111827)",
  color: "var(--ink, #f1f5f9)",
  fontSize: "14px",
  outline: "none",
  boxSizing: "border-box",
};
