"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useLanguage } from "../../../../lib/language-context";
import { fetchOrganizations, redeemSkillAttestation, SemseApiError, type SkillSummaryView } from "../../../semse-api";

const COPY = {
  es: {
    title: "Experiencia compartida",
    intro:
      "Una persona puede entregarte un código con un resumen de su experiencia confirmada. Verás oficio, cantidad de tareas y meses; nunca empresas, clientes ni fotos. No es una licencia ni una certificación.",
    noOrg: "No hay una empresa asociada a tu cuenta.",
    code: "Código que te entregó la persona",
    redeem: "Ver el resumen",
    invalid: "El código no es válido, venció o fue revocado.",
    unavailable: "Esta función aún no está habilitada.",
    forbidden: "Tu cuenta no puede canjear códigos.",
    tasks: "tareas confirmadas",
    generated: "Generado"
  },
  en: {
    title: "Shared experience",
    intro:
      "A person can hand you a code with a summary of their confirmed experience. You will see trade, task count and months; never companies, clients or photos. It is not a license or certification.",
    noOrg: "No company is associated with your account.",
    code: "Code the person gave you",
    redeem: "View summary",
    invalid: "The code is invalid, expired or revoked.",
    unavailable: "This feature is not enabled yet.",
    forbidden: "Your account cannot redeem codes.",
    tasks: "confirmed tasks",
    generated: "Generated"
  }
} as const;

export default function SkillAttestationsPage() {
  const { language } = useLanguage();
  const c = COPY[language];
  const [orgId, setOrgId] = useState<string | null>(null);
  const [token, setToken] = useState("");
  const [summary, setSummary] = useState<SkillSummaryView | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const orgs = await fetchOrganizations();
        const id = typeof orgs[0]?.id === "string" ? (orgs[0].id as string) : null;
        setOrgId(id);
        if (!id) setMessage(c.noOrg);
      } catch {
        setMessage(c.unavailable);
      }
    })();
  }, [c.noOrg, c.unavailable]);

  const describe = useCallback(
    (error: unknown) => {
      if (error instanceof SemseApiError && error.status === 403) return c.forbidden;
      if (error instanceof SemseApiError && error.status === 404) return c.invalid;
      return String((error as Error).message);
    },
    [c.forbidden, c.invalid]
  );

  async function redeem(event: FormEvent) {
    event.preventDefault();
    if (!orgId) return;
    setBusy(true);
    setSummary(null);
    try {
      setSummary(await redeemSkillAttestation(orgId, token.trim()));
      setMessage(null);
    } catch (error) {
      setMessage(describe(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main style={{ maxWidth: 640, margin: "0 auto", padding: 16, display: "grid", gap: 16 }}>
      <h1>{c.title}</h1>
      <p>{c.intro}</p>
      {message ? <p role="status">{message}</p> : null}
      <form onSubmit={(event) => void redeem(event)} style={{ display: "grid", gap: 8 }}>
        <label>
          {c.code}
          <input required minLength={16} value={token} onChange={(event) => setToken(event.target.value)} style={{ width: "100%", minHeight: 44 }} />
        </label>
        <button type="submit" disabled={busy || !orgId || token.trim().length < 16} style={{ minHeight: 44 }}>
          {c.redeem}
        </button>
      </form>
      {summary ? (
        <section style={{ display: "grid", gap: 8 }}>
          <ul style={{ listStyle: "none", padding: 0, display: "grid", gap: 6 }}>
            {summary.trades.map((trade) => (
              <li key={trade.trade}>
                <strong>{trade.trade}</strong> · {trade.confirmedCount} {c.tasks} · {trade.since} → {trade.until}
              </li>
            ))}
          </ul>
          <small>{summary.disclaimer}</small>
          <small>
            {c.generated}: {new Date(summary.generatedAt).toLocaleString()}
          </small>
        </section>
      ) : null}
    </main>
  );
}
