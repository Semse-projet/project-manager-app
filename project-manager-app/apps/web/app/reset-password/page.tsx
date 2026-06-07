"use client";

import { useState, type FormEvent, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

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

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams?.get("token") ?? "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const passwordMismatch = confirm.length > 0 && password !== confirm;

  if (!token) {
    return (
      <div style={{ textAlign: "center", padding: "8px 0" }}>
        <div style={{ fontSize: "40px", marginBottom: "12px" }}>🔗</div>
        <h2 style={{ fontSize: "18px", fontWeight: 700, color: "var(--ink, #f1f5f9)", marginBottom: "10px" }}>
          Enlace inválido
        </h2>
        <p style={{ fontSize: "14px", color: "var(--muted, #94a3b8)", marginBottom: "20px" }}>
          Este enlace de recuperación no es válido o ya fue usado.
        </p>
        <Link
          href="/forgot-password"
          style={{
            display: "inline-block",
            padding: "10px 20px",
            borderRadius: "8px",
            background: "var(--raised, #111827)",
            color: "#93c5fd",
            fontSize: "13px",
            fontWeight: 600,
            textDecoration: "none",
          }}
        >
          Solicitar nuevo enlace
        </Link>
      </div>
    );
  }

  if (success) {
    return (
      <div style={{ textAlign: "center", padding: "8px 0" }}>
        <div style={{ fontSize: "40px", marginBottom: "12px" }}>✅</div>
        <h2 style={{ fontSize: "18px", fontWeight: 700, color: "var(--ink, #f1f5f9)", marginBottom: "10px" }}>
          Contraseña actualizada
        </h2>
        <p style={{ fontSize: "14px", color: "var(--muted, #94a3b8)", marginBottom: "20px" }}>
          Tu contraseña fue actualizada correctamente. Ya puedes iniciar sesión.
        </p>
        <Link
          href="/login?reset=1"
          style={{
            display: "inline-block",
            padding: "10px 20px",
            borderRadius: "8px",
            background: "linear-gradient(135deg, #3b82f6, #8b5cf6)",
            color: "#fff",
            fontSize: "13px",
            fontWeight: 600,
            textDecoration: "none",
          }}
        >
          Ir al login →
        </Link>
      </div>
    );
  }

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
      const res = await fetch("/api/semse/auth/reset-password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token, newPassword: password }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };

      if (!res.ok || !data.ok) {
        setError(data.error ?? "No se pudo restablecer la contraseña");
        return;
      }

      setSuccess(true);
    } catch {
      setError("No se pudo conectar con el servidor");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <h2 style={{ fontSize: "18px", fontWeight: 700, color: "var(--ink, #f1f5f9)", marginBottom: "8px" }}>
        Nueva contraseña
      </h2>
      <p style={{ fontSize: "13px", color: "var(--muted, #94a3b8)", marginBottom: "20px" }}>
        Ingresa y confirma tu nueva contraseña.
      </p>

      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: "14px" }}>
          <label style={labelStyle}>Nueva contraseña</label>
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
            opacity: loading || passwordMismatch ? 0.7 : 1,
          }}
        >
          {loading ? "Actualizando…" : "Actualizar contraseña →"}
        </button>
      </form>

      <p style={{ marginTop: "18px", fontSize: "13px", color: "var(--muted, #94a3b8)", textAlign: "center" }}>
        <Link href="/login" style={{ color: "#93c5fd", textDecoration: "none", fontWeight: 600 }}>
          ← Volver al login
        </Link>
      </p>
    </>
  );
}

export default function ResetPasswordPage() {
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
          <Suspense fallback={<div style={{ color: "var(--muted, #94a3b8)", textAlign: "center" }}>Cargando…</div>}>
            <ResetPasswordForm />
          </Suspense>
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
