"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useLanguage } from "../../../../lib/language-context";
import {
  createSkillAttestation,
  fetchMySkillAttestations,
  fetchMySkills,
  revokeSkillAttestation,
  SemseApiError,
  type SkillAttestationListItem,
  type SkillSummaryView
} from "../../../semse-api";

const COPY = {
  es: {
    title: "Mis oficios",
    intro:
      "Tu experiencia confirmada por un responsable. Son hechos: cuántas tareas y entre qué meses. No es una licencia, certificación ni autorización para trabajos regulados.",
    none: "Todavía no tienes experiencia confirmada.",
    unavailable: "Esta función aún no está habilitada.",
    tasks: "tareas confirmadas",
    share: "Compartir un resumen",
    shareIntro:
      "Genera un código para entregarlo a una empresa. Verá solo lo que elijas aquí: oficio, cantidad y meses. Nunca incluye empresas, clientes, tareas ni fotos.",
    pick: "Oficios a compartir (si no eliges ninguno, se comparten todos)",
    days: "Vigencia (días)",
    consent: "Doy mi consentimiento para compartir este resumen con quien reciba el código.",
    create: "Generar código",
    codeTitle: "Tu código (solo se muestra ahora)",
    codeHelp: "Cópialo y entrégalo a la empresa. No se puede volver a ver; si lo pierdes, genera otro.",
    mine: "Resúmenes compartidos",
    noneShared: "No has compartido ningún resumen.",
    revoke: "Revocar",
    status: { ACTIVE: "Vigente", REVOKED: "Revocado" } as Record<string, string>,
    expires: "vence"
  },
  en: {
    title: "My trades",
    intro:
      "Your experience confirmed by a manager. These are facts: how many tasks and between which months. It is not a license, certification or authorization for regulated work.",
    none: "You have no confirmed experience yet.",
    unavailable: "This feature is not enabled yet.",
    tasks: "confirmed tasks",
    share: "Share a summary",
    shareIntro:
      "Generate a code to hand to a company. They will only see what you choose here: trade, count and months. It never includes companies, clients, tasks or photos.",
    pick: "Trades to share (if you pick none, all are shared)",
    days: "Validity (days)",
    consent: "I consent to sharing this summary with whoever receives the code.",
    create: "Generate code",
    codeTitle: "Your code (shown only now)",
    codeHelp: "Copy it and give it to the company. It cannot be shown again; if you lose it, generate another.",
    mine: "Shared summaries",
    noneShared: "You have not shared any summary.",
    revoke: "Revoke",
    status: { ACTIVE: "Active", REVOKED: "Revoked" } as Record<string, string>,
    expires: "expires"
  }
} as const;

export default function MySkillsPage() {
  const { language } = useLanguage();
  const c = COPY[language];
  const [skills, setSkills] = useState<SkillSummaryView | null>(null);
  const [shared, setShared] = useState<SkillAttestationListItem[]>([]);
  const [picked, setPicked] = useState<string[]>([]);
  const [days, setDays] = useState("30");
  const [consent, setConsent] = useState(false);
  const [code, setCode] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const describe = useCallback(
    (error: unknown) => (error instanceof SemseApiError && error.status === 404 ? c.unavailable : String((error as Error).message)),
    [c.unavailable]
  );

  const load = useCallback(async () => {
    try {
      setSkills(await fetchMySkills());
      setShared(await fetchMySkillAttestations());
      setMessage(null);
    } catch (error) {
      setMessage(describe(error));
    }
  }, [describe]);

  useEffect(() => {
    void load();
  }, [load]);

  function toggle(trade: string) {
    setPicked((current) => (current.includes(trade) ? current.filter((t) => t !== trade) : [...current, trade]));
  }

  async function create(event: FormEvent) {
    event.preventDefault();
    if (!consent) return;
    setBusy(true);
    try {
      const created = await createSkillAttestation({
        consent: true,
        ...(picked.length > 0 ? { trades: picked } : {}),
        expiresInDays: Math.min(90, Math.max(1, Number(days) || 30))
      });
      setCode(created.token);
      setConsent(false);
      await load();
    } catch (error) {
      setMessage(describe(error));
    } finally {
      setBusy(false);
    }
  }

  async function revoke(id: string) {
    setBusy(true);
    try {
      await revokeSkillAttestation(id);
      await load();
    } catch (error) {
      setMessage(describe(error));
    } finally {
      setBusy(false);
    }
  }

  const trades = skills?.trades ?? [];

  return (
    <main style={{ maxWidth: 640, margin: "0 auto", padding: 16, display: "grid", gap: 16 }}>
      <h1>{c.title}</h1>
      <p>{c.intro}</p>
      {message ? <p role="status">{message}</p> : null}
      {trades.length === 0 ? (
        <p>{c.none}</p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0, display: "grid", gap: 8 }}>
          {trades.map((trade) => (
            <li key={trade.trade}>
              <strong>{trade.trade}</strong> · {trade.confirmedCount} {c.tasks} · {trade.since} → {trade.until}
            </li>
          ))}
        </ul>
      )}
      {trades.length > 0 ? (
        <form onSubmit={(event) => void create(event)} style={{ display: "grid", gap: 8 }}>
          <h2>{c.share}</h2>
          <p>{c.shareIntro}</p>
          <fieldset style={{ display: "grid", gap: 4 }}>
            <legend>{c.pick}</legend>
            {trades.map((trade) => (
              <label key={trade.trade} style={{ display: "flex", gap: 8, alignItems: "center", minHeight: 44 }}>
                <input type="checkbox" checked={picked.includes(trade.trade)} onChange={() => toggle(trade.trade)} />
                {trade.trade}
              </label>
            ))}
          </fieldset>
          <label>
            {c.days}
            <input type="number" min={1} max={90} value={days} onChange={(event) => setDays(event.target.value)} style={{ width: "100%", minHeight: 44 }} />
          </label>
          <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} />
            {c.consent}
          </label>
          <button type="submit" disabled={busy || !consent} style={{ minHeight: 44 }}>
            {c.create}
          </button>
        </form>
      ) : null}
      {code ? (
        <section style={{ display: "grid", gap: 4 }}>
          <h2>{c.codeTitle}</h2>
          <code style={{ wordBreak: "break-all" }}>{code}</code>
          <small>{c.codeHelp}</small>
        </section>
      ) : null}
      <h2>{c.mine}</h2>
      {shared.length === 0 ? (
        <p>{c.noneShared}</p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0, display: "grid", gap: 8 }}>
          {shared.map((item) => (
            <li key={item.attestationId} style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <span style={{ flex: "1 1 200px" }}>
                {c.status[item.status] ?? item.status} · {c.expires} {new Date(item.expiresAt).toLocaleDateString()}
              </span>
              {item.status === "ACTIVE" ? (
                <button disabled={busy} style={{ minHeight: 44 }} onClick={() => void revoke(item.attestationId)}>
                  {c.revoke}
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
