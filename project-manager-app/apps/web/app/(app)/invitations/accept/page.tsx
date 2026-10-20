"use client";

import { Suspense, useEffect, useRef, useState, type FormEvent } from "react";
import { consumeInvitationToken } from "../../../../lib/invitation-token";
import { useLanguage } from "../../../../lib/language-context";
import { acceptInvitation, previewInvitation } from "../../../semse-api";

const COPY = {
  es: {
    title: "Invitación a una empresa",
    invited: (company: string) => `${company} te invitó como trabajador.`,
    accept: "Aceptar invitación",
    createAccount: "Crea tu cuenta para unirte",
    name: "Nombre completo",
    password: "Contraseña (mínimo 15 caracteres)",
    create: "Crear cuenta y unirme",
    done: "Listo. Ya formas parte de la empresa.",
    invalid: "Esta invitación no es válida, venció o es para otra cuenta."
  },
  en: {
    title: "Company invitation",
    invited: (company: string) => `${company} invited you as a worker.`,
    accept: "Accept invitation",
    createAccount: "Create your account to join",
    name: "Full name",
    password: "Password (at least 15 characters)",
    create: "Create account and join",
    done: "Done. You are now part of the company.",
    invalid: "This invitation is invalid, expired, or meant for another account."
  }
} as const;

function AcceptInvitation() {
  const { language } = useLanguage();
  const c = COPY[language];
  const tokenRef = useRef<string | null>(null);
  const [company, setCompany] = useState<string | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "invalid" | "done">("loading");
  const [hasSession, setHasSession] = useState(false);
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setHasSession(document.cookie.split("; ").some((entry) => entry.startsWith("semse_app_role=")));
  }, []);

  useEffect(() => {
    if (tokenRef.current === null) {
      tokenRef.current = consumeInvitationToken(new URL(window.location.href), path => window.history.replaceState(null, "", path)) ?? "";
    }
    const token = tokenRef.current;
    if (!token) {
      setState("invalid");
      return;
    }
    let alive = true;
    previewInvitation(token)
      .then((preview) => {
        if (!alive) return;
        setCompany(preview.companyName);
        setState("ready");
      })
      .catch(() => { if (alive) setState("invalid"); });
    return () => { alive = false; };
  }, []);

  async function accept() {
    try {
      if (busy || !tokenRef.current) return;
      setBusy(true);
      await acceptInvitation(tokenRef.current);
      setState("done");
    } catch {
      setState("invalid");
    }
  }

  async function createAccount(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      const response = await fetch("/api/semse/invitations/register", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token: tokenRef.current, name: name.trim(), password })
      });
      const result = (await response.json().catch(() => ({}))) as { ok?: boolean; redirectTo?: string };
      if (!response.ok || !result.ok) {
        setState("invalid");
        return;
      }
      setState("done");
      window.location.assign(result.redirectTo ?? "/");
    } catch {
      setState("invalid");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main style={{ maxWidth: 480, margin: "0 auto", padding: 16, display: "grid", gap: 16 }}>
      <h1>{c.title}</h1>
      {state === "ready" && company ? (
        <>
          <p>{c.invited(company)}</p>
          {hasSession ? (
            <button onClick={() => void accept()} style={{ minHeight: 44 }}>
              {c.accept}
            </button>
          ) : (
            <form onSubmit={(event) => void createAccount(event)} style={{ display: "grid", gap: 8 }}>
              <strong>{c.createAccount}</strong>
              <label>
                {c.name}
                <input required minLength={2} autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} style={{ width: "100%", minHeight: 44 }} />
              </label>
              <label>
                {c.password}
                <input
                  required
                  type="password"
                  minLength={15}
                  maxLength={128}
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  style={{ width: "100%", minHeight: 44 }}
                />
              </label>
              <button type="submit" disabled={busy} style={{ minHeight: 44 }}>
                {c.create}
              </button>
            </form>
          )}
        </>
      ) : null}
      {state === "done" ? <p role="status">{c.done}</p> : null}
      {state === "invalid" ? <p role="alert">{c.invalid}</p> : null}
    </main>
  );
}

export default function AcceptInvitationPage() {
  return (
    <Suspense fallback={null}>
      <AcceptInvitation />
    </Suspense>
  );
}

