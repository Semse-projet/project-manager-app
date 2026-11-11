"use client";

import { useState, type FormEvent, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { LanguageProvider, useLanguage } from "@/lib/language-context";
import { LanguageSwitch } from "../_auth/LanguageSwitch";
import { PasswordStrength } from "../_auth/PasswordStrength";

const COPY = {
  es: {
    invalidTitle: "Enlace inválido",
    invalidBody: "Este enlace de recuperación no es válido o ya fue usado.",
    requestNew: "Solicitar nuevo enlace",
    successTitle: "Contraseña actualizada",
    successBody: "Tu contraseña fue actualizada correctamente. Ya puedes iniciar sesión.",
    goToLogin: "Ir al login →",
    title: "Nueva contraseña",
    intro: "Ingresa y confirma tu nueva contraseña.",
    newPassword: "Nueva contraseña",
    newPasswordPlaceholder: "Mínimo 15 caracteres",
    confirmPassword: "Confirmar contraseña",
    confirmPlaceholder: "Repite la contraseña",
    mismatch: "Las contraseñas no coinciden",
    length: "La contraseña debe tener entre 15 y 128 caracteres",
    resetFailed: "No se pudo restablecer la contraseña. El enlace puede haber caducado.",
    networkError: "No se pudo conectar con el servidor",
    submit: "Actualizar contraseña →",
    submitting: "Actualizando…",
    backToLogin: "← Volver al login",
    loading: "Cargando…",
  },
  en: {
    invalidTitle: "Invalid link",
    invalidBody: "This recovery link is not valid or has already been used.",
    requestNew: "Request a new link",
    successTitle: "Password updated",
    successBody: "Your password was updated. You can now sign in.",
    goToLogin: "Go to sign in →",
    title: "New password",
    intro: "Enter and confirm your new password.",
    newPassword: "New password",
    newPasswordPlaceholder: "At least 15 characters",
    confirmPassword: "Confirm password",
    confirmPlaceholder: "Repeat the password",
    mismatch: "Passwords do not match",
    length: "Password must be between 15 and 128 characters",
    resetFailed: "Could not reset the password. The link may have expired.",
    networkError: "Could not reach the server",
    submit: "Update password →",
    submitting: "Updating…",
    backToLogin: "← Back to sign in",
    loading: "Loading…",
  },
} as const;

type ResetPasswordErrorKey = "mismatch" | "length" | "resetFailed" | "networkError";

function ResetPasswordForm() {
  const { language } = useLanguage();
  const c = COPY[language];
  const searchParams = useSearchParams();
  const token = searchParams?.get("token") ?? "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ResetPasswordErrorKey | null>(null);
  const [success, setSuccess] = useState(false);

  const passwordMismatch = confirm.length > 0 && password !== confirm;

  if (!token) {
    return (
      <div style={{ textAlign: "center", padding: "8px 0" }}>
        <div style={{ fontSize: "40px", marginBottom: "12px" }}>🔗</div>
        <h2 style={{ fontSize: "18px", fontWeight: 700, color: "var(--ink, #f1f5f9)", marginBottom: "10px" }}>
          {c.invalidTitle}
        </h2>
        <p style={{ fontSize: "14px", color: "var(--muted, #94a3b8)", marginBottom: "20px" }}>
          {c.invalidBody}
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
          {c.requestNew}
        </Link>
      </div>
    );
  }

  if (success) {
    return (
      <div style={{ textAlign: "center", padding: "8px 0" }}>
        <div style={{ fontSize: "40px", marginBottom: "12px" }}>✅</div>
        <h2 style={{ fontSize: "18px", fontWeight: 700, color: "var(--ink, #f1f5f9)", marginBottom: "10px" }}>
          {c.successTitle}
        </h2>
        <p style={{ fontSize: "14px", color: "var(--muted, #94a3b8)", marginBottom: "20px" }}>
          {c.successBody}
        </p>
        <Link
          href="/login?reset=1"
          style={{
            display: "inline-block",
            padding: "10px 20px",
            borderRadius: "8px",
            background: "linear-gradient(135deg, var(--brand), var(--violet))",
            color: "#fff",
            fontSize: "13px",
            fontWeight: 600,
            textDecoration: "none",
          }}
        >
          {c.goToLogin}
        </Link>
      </div>
    );
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      setError("mismatch");
      return;
    }
    if (password.length < 15 || password.length > 128) {
      setError("length");
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
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean };

      if (!res.ok || !data.ok) {
        setError("resetFailed");
        return;
      }

      setSuccess(true);
    } catch {
      setError("networkError");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <h2 style={{ fontSize: "18px", fontWeight: 700, color: "var(--ink, #f1f5f9)", marginBottom: "8px" }}>
        {c.title}
      </h2>
      <p style={{ fontSize: "13px", color: "var(--muted, #94a3b8)", marginBottom: "20px" }}>
        {c.intro}
      </p>

      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: "14px" }}>
          <label style={labelStyle}>{c.newPassword}</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={15}
            maxLength={128}
            autoComplete="new-password"
            placeholder={c.newPasswordPlaceholder}
            style={inputStyle}
          />
          <PasswordStrength password={password} />
        </div>

        <div style={{ marginBottom: "20px" }}>
          <label style={labelStyle}>{c.confirmPassword}</label>
          <input
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
            minLength={15}
            maxLength={128}
            autoComplete="new-password"
            placeholder={c.confirmPlaceholder}
            style={{
              ...inputStyle,
              borderColor: passwordMismatch ? "var(--error)" : "var(--border, #1f2d3d)",
            }}
          />
          {passwordMismatch && (
            <span style={{ fontSize: "11px", color: "var(--error)", marginTop: "4px", display: "block" }}>
              {c.mismatch}
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
          disabled={loading || passwordMismatch}
          style={{
            width: "100%",
            padding: "12px",
            borderRadius: "10px",
            border: "none",
            background:
              loading || passwordMismatch
                ? "var(--faint, #4b6280)"
                : "linear-gradient(135deg, var(--brand), var(--violet))",
            color: "#fff",
            fontSize: "14px",
            fontWeight: 700,
            cursor: loading || passwordMismatch ? "not-allowed" : "pointer",
            opacity: loading || passwordMismatch ? 0.7 : 1,
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
  );
}

export default function ResetPasswordPage() {
  return (
    <LanguageProvider>
      <ResetPasswordShell />
    </LanguageProvider>
  );
}

function ResetPasswordShell() {
  const { language } = useLanguage();
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
          <Suspense fallback={<div style={{ color: "var(--muted, #94a3b8)", textAlign: "center" }}>{COPY[language].loading}</div>}>
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
