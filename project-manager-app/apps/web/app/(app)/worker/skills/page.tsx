"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Award, History, KeyRound, Share2, Star } from "lucide-react";
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
import {
  Banner,
  Button,
  CheckChip,
  ConsentCheck,
  Empty,
  Field,
  List,
  ListRow,
  PageHeader,
  PageStack,
  Panel,
  Pill,
  SecretValue,
  Stat,
  StatGrid,
  touchInputStyle,
  type Notice
} from "../../../../components/module-surface/ui";

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
    expires: "vence",
    tradesStat: "Oficios",
    tasksStat: "Tareas confirmadas",
    activeStat: "Códigos vigentes",
    noneHint: "Cuando un responsable confirme una tarea que entregaste, aparecerá aquí.",
    noneSharedHint: "Los códigos que generes aparecerán aquí y podrás revocarlos cuando quieras."
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
    expires: "expires",
    tradesStat: "Trades",
    tasksStat: "Confirmed tasks",
    activeStat: "Active codes",
    noneHint: "When a manager confirms a task you delivered, it will show up here.",
    noneSharedHint: "The codes you generate show up here and you can revoke them anytime."
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
  const [notice, setNotice] = useState<Notice>(null);
  const [busy, setBusy] = useState(false);

  const describe = useCallback(
    (error: unknown) => (error instanceof SemseApiError && error.status === 404 ? c.unavailable : String((error as Error).message)),
    [c.unavailable]
  );

  const load = useCallback(async () => {
    try {
      setSkills(await fetchMySkills());
      setShared(await fetchMySkillAttestations());
      setNotice(null);
    } catch (error) {
      setNotice({ tone: "error", text: describe(error) });
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
      setNotice({ tone: "error", text: describe(error) });
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
      setNotice({ tone: "error", text: describe(error) });
    } finally {
      setBusy(false);
    }
  }

  const trades = skills?.trades ?? [];
  const totalTasks = trades.reduce((sum, trade) => sum + trade.confirmedCount, 0);
  const activeShared = shared.filter((item) => item.status === "ACTIVE").length;

  return (
    <PageStack maxWidth={820}>
      <PageHeader icon={Star} tone="warn" title={c.title} description={c.intro} />
      {notice ? (
        <Banner tone={notice.tone} onDismiss={() => setNotice(null)}>
          {notice.text}
        </Banner>
      ) : null}
      <StatGrid>
        <Stat label={c.tradesStat} value={trades.length} tone="warn" />
        <Stat label={c.tasksStat} value={totalTasks} tone="ok" />
        <Stat label={c.activeStat} value={activeShared} tone="brand" />
      </StatGrid>
      <Panel title={c.title} icon={Award} padded={trades.length === 0}>
        {trades.length === 0 ? (
          <Empty icon={Award} title={c.none} description={c.noneHint} />
        ) : (
          <List>
            {trades.map((trade, index) => (
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
        )}
      </Panel>
      {trades.length > 0 ? (
        <Panel title={c.share} icon={Share2}>
          <form onSubmit={(event) => void create(event)} style={{ display: "grid", gap: 14 }}>
            <p style={{ margin: 0, fontSize: 13, lineHeight: 1.5, color: "var(--muted)" }}>{c.shareIntro}</p>
            <fieldset style={{ border: "none", margin: 0, padding: 0, display: "grid", gap: 8 }}>
              <legend style={{ fontSize: 12, fontWeight: 700, color: "var(--muted)", marginBottom: 8 }}>{c.pick}</legend>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {trades.map((trade) => (
                  <CheckChip key={trade.trade} checked={picked.includes(trade.trade)} onChange={() => toggle(trade.trade)}>
                    {trade.trade}
                  </CheckChip>
                ))}
              </div>
            </fieldset>
            <div style={{ maxWidth: 220 }}>
              <Field label={c.days}>
                <input type="number" min={1} max={90} value={days} onChange={(event) => setDays(event.target.value)} style={touchInputStyle} />
              </Field>
            </div>
            <ConsentCheck checked={consent} onChange={setConsent}>
              {c.consent}
            </ConsentCheck>
            <Button type="submit" variant="primary" size="touch" icon={KeyRound} busy={busy} disabled={!consent} fullWidth>
              {c.create}
            </Button>
            {code ? <SecretValue label={c.codeTitle} value={code} help={c.codeHelp} /> : null}
          </form>
        </Panel>
      ) : null}
      <Panel title={c.mine} icon={History} padded={shared.length === 0}>
        {shared.length === 0 ? (
          <Empty icon={Share2} title={c.noneShared} description={c.noneSharedHint} />
        ) : (
          <List>
            {shared.map((item, index) => (
              <ListRow key={item.attestationId} first={index === 0}>
                <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                  <Pill tone={item.status === "ACTIVE" ? "ok" : "muted"}>{c.status[item.status] ?? item.status}</Pill>
                  <span style={{ flex: "1 1 160px", fontSize: 13, color: "var(--muted)" }}>
                    {c.expires} {new Date(item.expiresAt).toLocaleDateString()}
                  </span>
                  {item.status === "ACTIVE" ? (
                    <Button variant="danger" size="touch" disabled={busy} onClick={() => void revoke(item.attestationId)}>
                      {c.revoke}
                    </Button>
                  ) : null}
                </div>
              </ListRow>
            ))}
          </List>
        )}
      </Panel>
    </PageStack>
  );
}
