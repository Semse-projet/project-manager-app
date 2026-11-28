"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Award, KeyRound, Search, ShieldCheck } from "lucide-react";
import { useLanguage } from "../../../../lib/language-context";
import { fetchOrganizations, redeemSkillAttestation, SemseApiError, type SkillSummaryView } from "../../../semse-api";
import {
  Banner,
  Button,
  Field,
  List,
  ListRow,
  PageHeader,
  PageStack,
  Panel,
  Pill,
  touchInputStyle,
  type Notice
} from "../../../../components/module-surface/ui";

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
    generated: "Generado",
    redeemPanel: "Canjear un código",
    summaryPanel: "Resumen de experiencia"
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
    generated: "Generated",
    redeemPanel: "Redeem a code",
    summaryPanel: "Experience summary"
  }
} as const;

export default function SkillAttestationsPage() {
  const { language } = useLanguage();
  const c = COPY[language];
  const [orgId, setOrgId] = useState<string | null>(null);
  const [token, setToken] = useState("");
  const [summary, setSummary] = useState<SkillSummaryView | null>(null);
  const [notice, setNotice] = useState<Notice>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const orgs = await fetchOrganizations();
        const id = typeof orgs[0]?.id === "string" ? (orgs[0].id as string) : null;
        setOrgId(id);
        if (!id) setNotice({ tone: "warn", text: c.noOrg });
      } catch {
        setNotice({ tone: "warn", text: c.unavailable });
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
      setNotice(null);
    } catch (error) {
      setNotice({ tone: "error", text: describe(error) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <PageStack maxWidth={760}>
      <PageHeader icon={ShieldCheck} tone="ok" title={c.title} description={c.intro} />
      {notice ? (
        <Banner tone={notice.tone} onDismiss={() => setNotice(null)}>
          {notice.text}
        </Banner>
      ) : null}
      <Panel title={c.redeemPanel} icon={KeyRound}>
        <form onSubmit={(event) => void redeem(event)} style={{ display: "grid", gap: 14 }}>
          <Field label={c.code}>
            <input
              required
              minLength={16}
              value={token}
              onChange={(event) => setToken(event.target.value)}
              style={{ ...touchInputStyle, fontFamily: "var(--font-mono)" }}
              autoComplete="off"
              spellCheck={false}
            />
          </Field>
          <Button type="submit" variant="primary" size="touch" icon={Search} busy={busy} disabled={!orgId || token.trim().length < 16} fullWidth>
            {c.redeem}
          </Button>
        </form>
      </Panel>
      {summary ? (
        <Panel title={c.summaryPanel} icon={Award} padded={false}>
          <List>
            {summary.trades.map((trade, index) => (
              <ListRow key={trade.trade} first={index === 0}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                  <strong style={{ flex: "1 1 160px", fontSize: 14, color: "var(--ink)", textTransform: "capitalize" }}>{trade.trade}</strong>
                  <Pill tone="ok">
                    {trade.confirmedCount} {c.tasks}
                  </Pill>
                </div>
                <span style={{ fontSize: 12, color: "var(--muted)" }}>
                  {trade.since} → {trade.until}
                </span>
              </ListRow>
            ))}
          </List>
          <div style={{ padding: "12px 16px", borderTop: "1px solid var(--border)", display: "grid", gap: 4, background: "var(--raised)" }}>
            <span style={{ fontSize: 12, color: "var(--muted)", lineHeight: 1.5 }}>{summary.disclaimer}</span>
            <span style={{ fontSize: 11, color: "var(--faint)" }}>
              {c.generated}: {new Date(summary.generatedAt).toLocaleString()}
            </span>
          </div>
        </Panel>
      ) : null}
    </PageStack>
  );
}
