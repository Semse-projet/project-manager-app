"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { normalizeSafeRedirectPath } from "@/lib/safe-redirect";
import { flushProductEvents, trackProductEvent } from "@/lib/product-intelligence";
import { LanguageProvider, useLanguage } from "@/lib/language-context";
import { LanguageSwitch } from "../_auth/LanguageSwitch";
import { PasswordStrength } from "../_auth/PasswordStrength";

type AccountRole = "CLIENT" | "PRO";

const COPY = {
  es: {
    tagline: "Plataforma de gestión de obras y servicios",
    title: "Crear cuenta",
    accountType: "Tipo de cuenta",
    roleClient: "Cliente",
    roleClientDesc: "Publica trabajos, gestiona proyectos y pagos",
    rolePro: "Profesional",
    roleProDesc: "Recibe trabajos, gestiona obras y cobra",
    nameClient: "Nombre de empresa / persona",
    nameClientPlaceholder: "ACME Corp o Juan Pérez",
    namePro: "Nombre completo",
    nameProPlaceholder: "Juan Pérez",
    email: "Email",
    emailPlaceholder: "tu@email.com",
    password: "Contraseña",
    passwordPlaceholder: "Mínimo 15 caracteres",
    confirmPassword: "Confirmar contraseña",
    confirmPlaceholder: "Repite la contraseña",
    mismatch: "Las contraseñas no coinciden",
    length: "La contraseña debe tener entre 15 y 128 caracteres",
    accountExists: "Ya existe una cuenta con ese email. ¿Quieres iniciar sesión?",
    tooManyAttempts: "Demasiados intentos. Intenta de nuevo más tarde.",
    registerFailed: "No se pudo crear la cuenta",
    networkError: "No se pudo conectar con el servidor",
    goToLogin: "Ir al login",
    submit: "Crear cuenta →",
    submitting: "Creando cuenta…",
    haveAccount: "¿Ya tienes cuenta?",
    signIn: "Iniciar sesión",
  },
  en: {
    tagline: "Construction and services management platform",
    title: "Create account",
    accountType: "Account type",
    roleClient: "Client",
    roleClientDesc: "Post jobs, manage projects and payments",
    rolePro: "Professional",
    roleProDesc: "Get jobs, run projects and get paid",
    nameClient: "Company or person name",
    nameClientPlaceholder: "ACME Corp or Jane Doe",
    namePro: "Full name",
    nameProPlaceholder: "Jane Doe",
    email: "Email",
    emailPlaceholder: "you@email.com",
    password: "Password",
    passwordPlaceholder: "At least 15 characters",
    confirmPassword: "Confirm password",
    confirmPlaceholder: "Repeat the password",
    mismatch: "Passwords do not match",
    length: "Password must be between 15 and 128 characters",
    accountExists: "An account with that email already exists. Do you want to sign in?",
    tooManyAttempts: "Too many attempts. Please try again later.",
    registerFailed: "Could not create the account",
    networkError: "Could not reach the server",
    goToLogin: "Go to sign in",
    submit: "Create account →",
    submitting: "Creating account…",
    haveAccount: "Already have an account?",
    signIn: "Sign in",
  },
} as const;

type RegisterErrorKey = "mismatch" | "length" | "accountExists" | "tooManyAttempts" | "registerFailed" | "networkError";

const ROLE_OPTIONS = [
  { role: "CLIENT", label: "roleClient", icon: "🏢", desc: "roleClientDesc", color: "var(--brand)" },
  { role: "PRO", label: "rolePro", icon: "🪖", desc: "roleProDesc", color: "var(--ok)" },
] as const satisfies readonly { role: AccountRole; label: keyof typeof COPY.es; icon: string; desc: keyof typeof COPY.es; color: string }[];

export default function RegisterPage() {
  return (
    <LanguageProvider>
      <RegisterForm />
    </LanguageProvider>
  );
}

function RegisterForm() {
  const { language } = useLanguage();
  const c = COPY[language];
  const searchParams = useSearchParams();
  const redirectTo = normalizeSafeRedirectPath(searchParams?.get("from")) ?? undefined;
  const loginHref = redirectTo ? `/login?from=${encodeURIComponent(redirectTo)}` : "/login";
  const [role, setRole] = useState<AccountRole>("CLIENT");

  useEffect(() => {
    trackProductEvent("auth.register_view", { hasFrom: Boolean(redirectTo), role: "CLIENT" });
    // Solo al montar: describe la llegada a la vista con el rol inicial.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<RegisterErrorKey | null>(null);

  const passwordMismatch = confirm.length > 0 && password !== confirm;

  // PI-11 — abandono de formulario: campos llenos sin envío al salir.
  // Solo el CONTEO de campos llenos; nunca sus valores.
  const abandonState = useRef({ filled: 0, submitted: false });
  useEffect(() => {
    abandonState.current.filled = [name, email, password].filter((v) => v.trim().length > 0).length;
  }, [name, email, password]);
  useEffect(() => {
    const onLeave = () => {
      const { filled, submitted } = abandonState.current;
      if (filled > 0 && !submitted) {
        trackProductEvent("friction.form_abandon", { filledFields: filled });
        void flushProductEvents();
      }
    };
    window.addEventListener("pagehide", onLeave);
    return () => window.removeEventListener("pagehide", onLeave);
  }, []);

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
      const res = await fetch("/api/semse/auth/register", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password, name, role, redirectTo }),
      });

      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; redirectTo?: string };

      if (!res.ok || !data.ok) {
        // The register API answers in Spanish; pick the page's own copy by status.
        if (res.status === 409) setError("accountExists");
        else if (res.status === 429) setError("tooManyAttempts");
        else setError("registerFailed");
        return;
      }

      abandonState.current.submitted = true;
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
      <div style={{ width: "100%", maxWidth: "480px" }}>
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
          <h2 style={{ fontSize: "18px", fontWeight: 700, color: "var(--ink, #f1f5f9)", marginBottom: "20px" }}>
            {c.title}
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
              {c.accountType}
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
                    <div style={{ fontSize: "12px", fontWeight: 700 }}>{c[opt.label]}</div>
                    <div style={{ fontSize: "10px", marginTop: "2px", opacity: 0.8 }}>{c[opt.desc]}</div>
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
                {role === "CLIENT" ? c.nameClient : c.namePro}
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                placeholder={role === "CLIENT" ? c.nameClientPlaceholder : c.nameProPlaceholder}
                style={inputStyle}
              />
            </div>

            {/* Email */}
            <div style={{ marginBottom: "14px" }}>
              <label style={labelStyle}>{c.email}</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder={c.emailPlaceholder}
                style={inputStyle}
              />
            </div>

            {/* Password */}
            <div style={{ marginBottom: "14px" }}>
              <label style={labelStyle}>{c.password}</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={15}
                maxLength={128}
                autoComplete="new-password"
                placeholder={c.passwordPlaceholder}
                style={inputStyle}
              />
              <PasswordStrength password={password} />
            </div>

            {/* Confirm password */}
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
                {error === "accountExists" && (
                  <>
                    {" "}
                    <Link href={loginHref} style={{ color: "#93c5fd", textDecoration: "underline" }}>
                      {c.goToLogin}
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
                    : "linear-gradient(135deg, var(--brand), var(--violet))",
                color: "#fff",
                fontSize: "14px",
                fontWeight: 700,
                cursor: loading || passwordMismatch ? "not-allowed" : "pointer",
                transition: "opacity 0.15s",
                opacity: loading || passwordMismatch ? 0.7 : 1,
              }}
            >
              {loading ? c.submitting : c.submit}
            </button>
          </form>

          <p style={{ marginTop: "18px", fontSize: "13px", color: "var(--muted, #94a3b8)", textAlign: "center" }}>
            {c.haveAccount}{" "}
            <Link href={loginHref} style={{ color: "#93c5fd", textDecoration: "none", fontWeight: 600 }}>
              {c.signIn}
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
