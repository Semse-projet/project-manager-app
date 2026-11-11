"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { normalizeSafeRedirectPath } from "@/lib/safe-redirect";
import { flushProductEvents, trackProductEvent } from "@/lib/product-intelligence";
import { LanguageProvider, useLanguage } from "@/lib/language-context";
import { LanguageSwitch } from "../_auth/LanguageSwitch";

// Never advertise demo identities on a production login screen.
const DEMO_LOGIN_ENABLED = process.env.NODE_ENV !== "production";

// The public default demo password is only ever shown or pre-filled outside production.
const SHOW_DEMO_PASSWORD = DEMO_LOGIN_ENABLED && process.env.NODE_ENV !== "production";

// The login API answers in Spanish; the page picks its own copy by status instead.
type LoginErrorKey = "invalidCredentials" | "tooManyAttempts" | "genericError" | "networkError";

function loginErrorKey(status: number): LoginErrorKey {
  if (status === 401) return "invalidCredentials";
  if (status === 429) return "tooManyAttempts";
  return "genericError";
}

const COPY = {
  es: {
    tagline: "Plataforma de gestión de obras y servicios",
    title: "Iniciar sesión",
    passwordReset: "✓ Contraseña actualizada. Ya puedes iniciar sesión con tu nueva contraseña.",
    returnTo: "Después de entrar volverás a",
    signInAs: "Entrar como",
    email: "Email",
    password: "Contraseña",
    submit: "Ingresar →",
    submitting: "Ingresando…",
    demoPassword: "Modo demo · contraseña:",
    forgotPassword: "Olvidé mi contraseña",
    createAccount: "Crear cuenta →",
    invalidCredentials: "No se pudo iniciar sesión con esas credenciales",
    tooManyAttempts: "Demasiados intentos. Intenta de nuevo más tarde.",
    genericError: "Error al iniciar sesión",
    networkError: "No se pudo conectar con el servidor",
    presetWorker: "Profesional",
    presetWorkerDesc: "Field Ops · Time Tracker · Evidencia",
    presetClient: "Cliente",
    presetClientDesc: "Publicar trabajos · Milestones · Pagos",
    presetAdmin: "Admin",
    presetAdminDesc: "Operaciones · Disputas · Config",
  },
  en: {
    tagline: "Construction and services management platform",
    title: "Sign in",
    passwordReset: "✓ Password updated. You can now sign in with your new password.",
    returnTo: "After signing in you will return to",
    signInAs: "Sign in as",
    email: "Email",
    password: "Password",
    submit: "Sign in →",
    submitting: "Signing in…",
    demoPassword: "Demo mode · password:",
    forgotPassword: "Forgot my password",
    createAccount: "Create account →",
    invalidCredentials: "Could not sign in with those credentials",
    tooManyAttempts: "Too many attempts. Please try again later.",
    genericError: "Sign-in failed",
    networkError: "Could not reach the server",
    presetWorker: "Professional",
    presetWorkerDesc: "Field Ops · Time Tracker · Evidence",
    presetClient: "Client",
    presetClientDesc: "Post jobs · Milestones · Payments",
    presetAdmin: "Admin",
    presetAdminDesc: "Operations · Disputes · Settings",
  },
} as const;

// ── Demo account presets ─────────────────────────────────────────────────────

const PRESETS = [
  {
    label: "presetWorker",
    email: "worker@demo.semse",
    color: "var(--ok)",
    icon: "🪖",
    desc: "presetWorkerDesc",
  },
  {
    label: "presetClient",
    email: "client@demo.semse",
    color: "var(--brand)",
    icon: "🏢",
    desc: "presetClientDesc",
  },
  {
    label: "presetAdmin",
    email: "admin@demo.semse",
    color: "var(--violet)",
    icon: "⚙️",
    desc: "presetAdminDesc",
  },
] as const;

// ── Component ────────────────────────────────────────────────────────────────

export default function LoginPage() {
  return (
    <LanguageProvider>
      <LoginForm />
    </LanguageProvider>
  );
}

function LoginForm() {
  const { language } = useLanguage();
  const c = COPY[language];
  const searchParams = useSearchParams();
  const [email, setEmail]       = useState(DEMO_LOGIN_ENABLED ? "client@demo.semse" : "");
  const [password, setPassword] = useState(SHOW_DEMO_PASSWORD ? "demo1234" : "");
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<LoginErrorKey | null>(null);
  const redirectTo = normalizeSafeRedirectPath(searchParams?.get("from")) ?? undefined;
  const passwordReset = searchParams?.get("reset") === "1";

  const activePreset = DEMO_LOGIN_ENABLED ? PRESETS.find(p => p.email === email) ?? null : null;

  useEffect(() => {
    trackProductEvent("auth.login_view", { hasFrom: Boolean(redirectTo) });
    // Solo al montar: el evento describe la llegada a la vista.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; redirectTo?: string };

      if (!res.ok || !data.ok) {
        setError(loginErrorKey(res.status));
        return;
      }

      if (redirectTo) {
        trackProductEvent("auth.context_recovered", { target: data.redirectTo ?? redirectTo });
      }
      await flushProductEvents();
      window.location.assign(data.redirectTo ?? "/client/dashboard");
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
                background: "linear-gradient(135deg, var(--brand), var(--violet))",
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
              SEMSE Project
            </span>
          </div>
          <p style={{ color: "var(--muted, #94a3b8)", fontSize: "14px" }}>
            {c.tagline}
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
            {c.title}
          </h2>

          {passwordReset && (
            <div
              style={{
                marginBottom: "16px",
                padding: "10px 12px",
                borderRadius: "10px",
                background: "rgba(34,197,94,.12)",
                border: "1px solid rgba(34,197,94,.25)",
                color: "#86efac",
                fontSize: "12px",
              }}
            >
              {c.passwordReset}
            </div>
          )}

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
              {c.returnTo} <strong>{redirectTo}</strong>
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
                {c.signInAs}
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
                      <div style={{ fontSize: "11px", fontWeight: 700 }}>{c[p.label]}</div>
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
                  {c[activePreset.desc]}
                </p>
              )}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: "14px" }}>
              <label
                htmlFor="login-email"
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
                id="login-email"
                type="email"
                autoComplete="username"
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
                htmlFor="login-password"
                style={{
                  display: "block",
                  fontSize: "12px",
                  fontWeight: 600,
                  color: "var(--muted, #94a3b8)",
                  marginBottom: "6px",
                }}
              >
                {c.password}
              </label>
              <input
                id="login-password"
                type="password"
                autoComplete="current-password"
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
                role="alert"
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
                background: loading
                  ? "var(--faint, #4b6280)"
                  : "linear-gradient(135deg, var(--brand), var(--violet))",
                color: "#fff",
                fontSize: "14px",
                fontWeight: 700,
                cursor: loading ? "not-allowed" : "pointer",
                transition: "opacity 0.15s",
                opacity: loading ? 0.7 : 1,
              }}
            >
              {loading ? c.submitting : c.submit}
            </button>
          </form>

          {SHOW_DEMO_PASSWORD && (
            <p
              style={{
                marginTop: "14px",
                fontSize: "12px",
                color: "var(--faint, #4b6280)",
                textAlign: "center",
              }}
            >
              {c.demoPassword}{" "}
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

          {/* Footer links */}
          <div
            style={{
              marginTop: "18px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              fontSize: "13px",
            }}
          >
            <Link
              href="/forgot-password"
              style={{ color: "var(--muted, #94a3b8)", textDecoration: "none" }}
            >
              {c.forgotPassword}
            </Link>
            <Link
              href={redirectTo ? `/register?from=${encodeURIComponent(redirectTo)}` : "/register"}
              style={{
                color: "#93c5fd",
                textDecoration: "none",
                fontWeight: 600,
              }}
            >
              {c.createAccount}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
