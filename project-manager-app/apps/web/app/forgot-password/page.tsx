"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { LanguageProvider, useLanguage } from "@/lib/language-context";
import { LanguageSwitch } from "../_auth/LanguageSwitch";

const COPY = {
  es: {
    sentTitle: "Correo enviado",
    sentBefore: "Si existe una cuenta con",
    sentAfter: ", recibirás un enlace para restablecer tu contraseña en los próximos minutos.",
    backToLogin: "← Volver al login",
    title: "Recuperar contraseña",
    intro: "Ingresa tu email y te enviaremos un enlace para restablecer tu contraseña.",
    email: "Email",
    emailPlaceholder: "tu@email.com",
    submit: "Enviar enlace →",
    submitting: "Enviando…",
    sendError: "Error al enviar el correo",
    networkError: "No se pudo conectar con el servidor",
  },
  en: {
    sentTitle: "Email sent",
    sentBefore: "If an account exists for",
    sentAfter: ", you will receive a link to reset your password in the next few minutes.",
    backToLogin: "← Back to sign in",
    title: "Reset your password",
    intro: "Enter your email and we will send you a link to reset your password.",
    email: "Email",
    emailPlaceholder: "you@email.com",
    submit: "Send link →",
    submitting: "Sending…",
    sendError: "Could not send the email",
    networkError: "Could not reach the server",
  },
} as const;

type ForgotPasswordErrorKey = "sendError" | "networkError";

export default function ForgotPasswordPage() {
  return (
    <LanguageProvider>
      <ForgotPasswordForm />
    </LanguageProvider>
  );
}

function ForgotPasswordForm() {
  const { language } = useLanguage();
  const c = COPY[language];
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<ForgotPasswordErrorKey | null>(null);

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
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean };
      if (!res.ok && !data.ok) {
        setError("sendError");
        return;
      }
      setSent(true);
    } catch {
      setError("networkError");
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
        <LanguageSwitch />
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: "32px" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: "10px", marginBottom: "8px" }}>
            <div
              style={{
                width: "40px",
                height: "40px",
                borderRadius: "12px",
                background: "linear-gradient(135deg, var(--brand), var(--violet))",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "18px",
              }}
            >
              ⚡
            </div>
            <span style={{ fontSize: "24px", fontWeight: 900, color: "var(--ink, #f1f5f9)", letterSpacing: "-0.5px" }}>
              SEMSE Project
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
                {c.sentTitle}
              </h2>
              <p style={{ fontSize: "14px", color: "var(--muted, #94a3b8)", marginBottom: "20px" }}>
                {c.sentBefore} <strong style={{ color: "var(--ink, #f1f5f9)" }}>{email}</strong>
                {c.sentAfter}
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
                {c.backToLogin}
              </Link>
            </div>
          ) : (
            <>
              <h2 style={{ fontSize: "18px", fontWeight: 700, color: "var(--ink, #f1f5f9)", marginBottom: "8px" }}>
                {c.title}
              </h2>
              <p style={{ fontSize: "13px", color: "var(--muted, #94a3b8)", marginBottom: "20px" }}>
                {c.intro}
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
                    {c.email}
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    placeholder={c.emailPlaceholder}
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
                      color: "var(--error)",
                      fontSize: "13px",
                      marginBottom: "16px",
                    }}
                  >
                    {c[error]}
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
                    background: loading ? "var(--faint, #4b6280)" : "linear-gradient(135deg, var(--brand), var(--violet))",
                    color: "#fff",
                    fontSize: "14px",
                    fontWeight: 700,
                    cursor: loading ? "not-allowed" : "pointer",
                    opacity: loading ? 0.7 : 1,
                  }}
                >
                  {loading ? c.submitting : c.submit}
                </button>
              </form>

              <p style={{ marginTop: "18px", fontSize: "13px", color: "var(--muted, #94a3b8)", textAlign: "center" }}>
                <Link href="/login" style={{ color: "#93c5fd", textDecoration: "none", fontWeight: 600 }}>
                  {c.backToLogin}
                </Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
