"use client";

import { Suspense, useEffect, useState, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import { Building2, CheckCircle2, Loader2, UserPlus, XCircle } from "lucide-react";
import { useLanguage } from "../../../../lib/language-context";
import { acceptInvitation, previewInvitation } from "../../../semse-api";
import { Button, Field, PageHeader, PageStack, Panel, touchInputStyle } from "../../../../components/module-surface/ui";

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
    invalid: "Esta invitación no es válida, venció o es para otra cuenta.",
    intro: "Únete al equipo de la empresa en SEMSE.",
    loading: "Comprobando la invitación…",
    invalidHint: "Pide a la empresa que te envíe una invitación nueva.",
    doneHint: "Ya puedes ver tus tareas y registrar tus horas."
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
    invalid: "This invitation is invalid, expired, or meant for another account.",
    intro: "Join the company team on SEMSE.",
    loading: "Checking the invitation…",
    invalidHint: "Ask the company to send you a new invitation.",
    doneHint: "You can now see your tasks and record your hours."
  }
} as const;

function AcceptInvitation() {
  const { language } = useLanguage();
  const c = COPY[language];
  const token = useSearchParams().get("token") ?? "";
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
    if (token.length < 10) {
      setState("invalid");
      return;
    }
    previewInvitation(token)
      .then((preview) => {
        setCompany(preview.companyName);
        setState("ready");
      })
      .catch(() => setState("invalid"));
  }, [token]);

  async function accept() {
    try {
      await acceptInvitation(token);
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
        body: JSON.stringify({ token, name: name.trim(), password })
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

  const resultCard = (tone: "ok" | "error", Icon: typeof CheckCircle2, title: string, hint: string) => (
    <Panel>
      <div role={tone === "error" ? "alert" : "status"} style={{ display: "grid", justifyItems: "center", gap: 8, padding: "16px 8px", textAlign: "center" }}>
        <Icon size={36} style={{ color: `var(--${tone})` }} aria-hidden />
        <strong style={{ fontSize: 15, color: "var(--ink)" }}>{title}</strong>
        <span style={{ fontSize: 13, color: "var(--muted)" }}>{hint}</span>
      </div>
    </Panel>
  );

  return (
    <PageStack maxWidth={520}>
      <PageHeader icon={Building2} title={c.title} description={c.intro} />
      {state === "loading" ? (
        <Panel>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: 16, color: "var(--muted)", fontSize: 13 }}>
            <Loader2 size={16} className="animate-spin" aria-hidden /> {c.loading}
          </div>
        </Panel>
      ) : null}
      {state === "ready" && company ? (
        <Panel>
          <div style={{ display: "grid", gap: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 12,
                  display: "grid",
                  placeItems: "center",
                  flexShrink: 0,
                  background: "color-mix(in srgb, var(--ok) 14%, transparent)"
                }}
              >
                <UserPlus size={18} style={{ color: "var(--ok)" }} aria-hidden />
              </div>
              <p style={{ margin: 0, fontSize: 15, fontWeight: 600, color: "var(--ink)" }}>{c.invited(company)}</p>
            </div>
            {hasSession ? (
              <Button variant="primary" size="touch" icon={CheckCircle2} fullWidth onClick={() => void accept()}>
                {c.accept}
              </Button>
            ) : (
              <form onSubmit={(event) => void createAccount(event)} style={{ display: "grid", gap: 14 }}>
                <strong style={{ fontSize: 13, color: "var(--muted)" }}>{c.createAccount}</strong>
                <Field label={c.name}>
                  <input required minLength={2} autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} style={touchInputStyle} />
                </Field>
                <Field label={c.password}>
                  <input
                    required
                    type="password"
                    minLength={15}
                    maxLength={128}
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    style={touchInputStyle}
                  />
                </Field>
                <Button type="submit" variant="primary" size="touch" icon={UserPlus} busy={busy} fullWidth>
                  {c.create}
                </Button>
              </form>
            )}
          </div>
        </Panel>
      ) : null}
      {state === "done" ? resultCard("ok", CheckCircle2, c.done, c.doneHint) : null}
      {state === "invalid" ? resultCard("error", XCircle, c.invalid, c.invalidHint) : null}
    </PageStack>
  );
}

export default function AcceptInvitationPage() {
  return (
    <Suspense fallback={null}>
      <AcceptInvitation />
    </Suspense>
  );
}
