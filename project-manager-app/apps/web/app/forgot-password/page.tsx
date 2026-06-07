"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/semse/auth/forgot-password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok && !data.ok) {
        setError(data.error ?? "Error al enviar el correo");
        return;
      }
      setSent(true);
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
          {sent ? (
            <div style={{ textAlign: "center", padding: "8px 0" }}>
              <div style={{ fontSize: "40px", marginBottom: "12px" }}>📨</div>
              <h2 style={{ fontSize: "18px", fontWeight: 700, color: "var(--ink, #f1f5f9)", marginBottom: "10px" }}>
                Correo enviado
              </h2>
              <p style={{ fontSize: "14px", color: "var(--muted, #94a3b8)", marginBottom: "20px" }}>
                Si existe una cuenta con <strong style={{ color: "var(--ink, #f1f5f9)" }}>{email}</strong>, recibirás
                un enlace para restablecer tu contraseña en los próximos minutos.
              </p>
              <Link
                href="/login"
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
                ← Volver al login
              </Link>
            </div>
          ) : (
            <>
              <h2 style={{ fontSize: "18px", fontWeight: 700, color: "var(--ink, #f1f5f9)", marginBottom: "8px" }}>
                Recuperar contraseña
              </h2>
              <p style={{ fontSize: "13px", color: "var(--muted, #94a3b8)", marginBottom: "20px" }}>
                Ingresa tu email y te enviaremos un enlace para restablecer tu contraseña.
              </p>

              <form onSubmit={handleSubmit}>
                <div style={{ marginBottom: "16px" }}>
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
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    placeholder="tu@email.com"
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
                    background: loading ? "var(--faint, #4b6280)" : "linear-gradient(135deg, #3b82f6, #8b5cf6)",
                    color: "#fff",
                    fontSize: "14px",
                    fontWeight: 700,
                    cursor: loading ? "not-allowed" : "pointer",
                    opacity: loading ? 0.7 : 1,
                  }}
                >
                  {loading ? "Enviando…" : "Enviar enlace →"}
                </button>
              </form>

              <p style={{ marginTop: "18px", fontSize: "13px", color: "var(--muted, #94a3b8)", textAlign: "center" }}>
                <Link href="/login" style={{ color: "#93c5fd", textDecoration: "none", fontWeight: 600 }}>
                  ← Volver al login
                </Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
