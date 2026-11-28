"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { CalendarClock, Check, Clock, History, Inbox, ListChecks, X } from "lucide-react";
import { useLanguage } from "../../../../lib/language-context";
import {
  createLaborPolicy,
  fetchLaborPolicies,
  fetchOrganizations,
  fetchOrgLaborCorrections,
  reviewLaborCorrection,
  SemseApiError,
  type LaborCorrectionView,
  type LaborPolicyView
} from "../../../semse-api";
import {
  Banner,
  Button,
  CheckChip,
  Empty,
  Field,
  List,
  ListRow,
  PageHeader,
  PageStack,
  Panel,
  Pill,
  Stat,
  StatGrid,
  touchInputStyle,
  type Notice
} from "../../../../components/module-surface/ui";

const COPY = {
  es: {
    title: "Horario y correcciones",
    intro:
      "Define el horario de tu empresa y revisa las correcciones de horas que piden tus trabajadores. Esto no calcula nómina ni pagos.",
    noOrg: "No hay una empresa asociada a tu cuenta.",
    unavailable: "El horario y las correcciones aún no están habilitados para tu empresa.",
    policy: "Política de horario",
    name: "Nombre",
    days: "Días",
    start: "Entrada",
    end: "Salida",
    breakMinutes: "Descanso esperado (minutos)",
    overtime: "Overtime a proponer después de (horas por día, opcional)",
    save: "Publicar política",
    versions: "Versiones publicadas",
    none: "Aún no hay políticas.",
    queue: "Correcciones por revisar",
    noQueue: "No hay correcciones pendientes.",
    approve: "Aprobar",
    reject: "Rechazar",
    note: "Nota (opcional)",
    weekday: ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"],
    saved: "Política publicada.",
    statPending: "Correcciones pendientes",
    statVersions: "Versiones publicadas",
    statCurrent: "Horario vigente",
    noneHint: "Publica tu primera política con el formulario de arriba.",
    noQueueHint: "Cuando un trabajador pida corregir sus horas, aparecerá aquí.",
    breakShort: "Descanso",
    proposedEnd: "Nuevo fin"
  },
  en: {
    title: "Schedule and corrections",
    intro: "Set your company schedule and review the hour corrections your workers request. This does not calculate payroll or payments.",
    noOrg: "No company is associated with your account.",
    unavailable: "Schedule and corrections are not enabled for your company yet.",
    policy: "Schedule policy",
    name: "Name",
    days: "Days",
    start: "Start",
    end: "End",
    breakMinutes: "Expected break (minutes)",
    overtime: "Propose overtime after (hours per day, optional)",
    save: "Publish policy",
    versions: "Published versions",
    none: "No policies yet.",
    queue: "Corrections to review",
    noQueue: "No pending corrections.",
    approve: "Approve",
    reject: "Reject",
    note: "Note (optional)",
    weekday: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
    saved: "Policy published.",
    statPending: "Pending corrections",
    statVersions: "Published versions",
    statCurrent: "Current schedule",
    noneHint: "Publish your first policy with the form above.",
    noQueueHint: "When a worker asks to correct their hours, it will show up here.",
    breakShort: "Break",
    proposedEnd: "New end"
  }
} as const;

function toMinutes(value: string): number {
  const [h, m] = value.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

function fromMinutes(total: number): string {
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export default function LaborPolicyPage() {
  const { language } = useLanguage();
  const c = COPY[language];
  const [orgId, setOrgId] = useState<string | null>(null);
  const [policies, setPolicies] = useState<LaborPolicyView[]>([]);
  const [queue, setQueue] = useState<LaborCorrectionView[]>([]);
  const [name, setName] = useState("");
  const [weekdays, setWeekdays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [start, setStart] = useState("08:00");
  const [end, setEnd] = useState("17:00");
  const [breakMinutes, setBreakMinutes] = useState("60");
  const [overtimeHours, setOvertimeHours] = useState("");
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState<Notice>(null);
  const [busy, setBusy] = useState(false);

  const describe = useCallback(
    (error: unknown) => (error instanceof SemseApiError && error.status === 404 ? c.unavailable : String((error as Error).message)),
    [c.unavailable]
  );

  const load = useCallback(
    async (id: string) => {
      try {
        setPolicies(await fetchLaborPolicies(id));
        setQueue(await fetchOrgLaborCorrections(id, "PENDING"));
        setNotice(null);
      } catch (error) {
        setNotice({ tone: "error", text: describe(error) });
      }
    },
    [describe]
  );

  useEffect(() => {
    void (async () => {
      try {
        const orgs = await fetchOrganizations();
        const id = typeof orgs[0]?.id === "string" ? (orgs[0].id as string) : null;
        setOrgId(id);
        if (!id) {
          setNotice({ tone: "warn", text: c.noOrg });
          return;
        }
        await load(id);
      } catch (error) {
        setNotice({ tone: "error", text: describe(error) });
      }
    })();
  }, [load, describe, c.noOrg]);

  async function run(action: () => Promise<void>) {
    if (!orgId) return;
    setBusy(true);
    try {
      await action();
      await load(orgId);
    } catch (error) {
      setNotice({ tone: "error", text: describe(error) });
    } finally {
      setBusy(false);
    }
  }

  function toggleDay(day: number) {
    setWeekdays((current) => (current.includes(day) ? current.filter((d) => d !== day) : [...current, day].sort()));
  }

  function publish(event: FormEvent) {
    event.preventDefault();
    void run(async () => {
      await createLaborPolicy(orgId as string, {
        name: name.trim(),
        weekdays,
        scheduledStartMinute: toMinutes(start),
        scheduledEndMinute: toMinutes(end),
        expectedBreakMinutes: Number(breakMinutes) || 0,
        ...(overtimeHours !== "" ? { overtimeAfterMinutesPerDay: Math.round(Number(overtimeHours) * 60) } : {})
      });
      setName("");
      setNotice({ tone: "ok", text: c.saved });
    });
  }

  const latest = policies.reduce<LaborPolicyView | null>((best, policy) => (!best || policy.version > best.version ? policy : best), null);

  return (
    <PageStack maxWidth={900}>
      <PageHeader icon={CalendarClock} title={c.title} description={c.intro} />
      {notice ? (
        <Banner tone={notice.tone} onDismiss={() => setNotice(null)}>
          {notice.text}
        </Banner>
      ) : null}
      <StatGrid>
        <Stat label={c.statPending} value={queue.length} tone={queue.length > 0 ? "warn" : "muted"} />
        <Stat label={c.statVersions} value={policies.length} tone="brand" />
        <Stat
          label={c.statCurrent}
          value={latest ? `${fromMinutes(latest.scheduledStartMinute)}–${fromMinutes(latest.scheduledEndMinute)}` : "—"}
          hint={latest ? latest.name : undefined}
        />
      </StatGrid>

      <Panel title={c.queue} icon={ListChecks} padded={queue.length === 0}>
        {queue.length === 0 ? (
          <Empty icon={Inbox} title={c.noQueue} description={c.noQueueHint} />
        ) : (
          <List>
            {queue.map((item, index) => (
              <ListRow key={item.correctionId} first={index === 0}>
                <span style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)" }}>{item.reason}</span>
                <span style={{ fontSize: 12, color: "var(--muted)" }}>
                  {c.breakShort}: {item.original.breakMinutes} → {item.proposed.breakMinutes} min
                  {item.proposed.endedAt ? ` · ${c.proposedEnd}: ${new Date(item.proposed.endedAt).toLocaleString()}` : ""}
                </span>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <input
                    aria-label={c.note}
                    placeholder={c.note}
                    maxLength={500}
                    value={notes[item.correctionId] ?? ""}
                    onChange={(event) => setNotes((current) => ({ ...current, [item.correctionId]: event.target.value }))}
                    style={{ ...touchInputStyle, flex: "1 1 220px", width: "auto" }}
                  />
                  <Button
                    variant="primary"
                    size="touch"
                    icon={Check}
                    disabled={busy}
                    onClick={() => void run(async () => void (await reviewLaborCorrection(orgId as string, item.correctionId, "approve", notes[item.correctionId]?.trim() || undefined)))}
                  >
                    {c.approve}
                  </Button>
                  <Button
                    variant="danger"
                    size="touch"
                    icon={X}
                    disabled={busy}
                    onClick={() => void run(async () => void (await reviewLaborCorrection(orgId as string, item.correctionId, "reject", notes[item.correctionId]?.trim() || undefined)))}
                  >
                    {c.reject}
                  </Button>
                </div>
              </ListRow>
            ))}
          </List>
        )}
      </Panel>

      <Panel title={c.policy} icon={Clock}>
        <form onSubmit={publish} style={{ display: "grid", gap: 14 }}>
          <Field label={c.name}>
            <input required minLength={2} maxLength={120} value={name} onChange={(event) => setName(event.target.value)} style={touchInputStyle} />
          </Field>
          <fieldset style={{ border: "none", margin: 0, padding: 0 }}>
            <legend style={{ fontSize: 12, fontWeight: 700, color: "var(--muted)", marginBottom: 8 }}>{c.days}</legend>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {c.weekday.map((label, day) => (
                <CheckChip key={label} checked={weekdays.includes(day)} onChange={() => toggleDay(day)}>
                  {label}
                </CheckChip>
              ))}
            </div>
          </fieldset>
          <div style={{ display: "grid", gap: 14, gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
            <Field label={c.start}>
              <input type="time" required value={start} onChange={(event) => setStart(event.target.value)} style={touchInputStyle} />
            </Field>
            <Field label={c.end}>
              <input type="time" required value={end} onChange={(event) => setEnd(event.target.value)} style={touchInputStyle} />
            </Field>
            <Field label={c.breakMinutes}>
              <input type="number" min={0} max={480} value={breakMinutes} onChange={(event) => setBreakMinutes(event.target.value)} style={touchInputStyle} />
            </Field>
          </div>
          <Field label={c.overtime}>
            <input type="number" min={1} max={24} step="0.5" value={overtimeHours} onChange={(event) => setOvertimeHours(event.target.value)} style={touchInputStyle} />
          </Field>
          <div>
            <Button type="submit" variant="primary" size="touch" icon={Check} disabled={busy || !orgId || weekdays.length === 0}>
              {c.save}
            </Button>
          </div>
        </form>
      </Panel>

      <Panel title={c.versions} icon={History} padded={policies.length === 0}>
        {policies.length === 0 ? (
          <Empty icon={CalendarClock} title={c.none} description={c.noneHint} />
        ) : (
          <List>
            {policies.map((policy, index) => (
              <ListRow key={policy.policyId} first={index === 0}>
                <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                  <Pill tone="brand">v{policy.version}</Pill>
                  <strong style={{ flex: "1 1 160px", fontSize: 14, color: "var(--ink)" }}>{policy.name}</strong>
                  <Pill tone={policy.status === "ACTIVE" ? "ok" : "muted"}>{policy.status}</Pill>
                </div>
                <span style={{ fontSize: 12, color: "var(--muted)" }}>
                  {fromMinutes(policy.scheduledStartMinute)}–{fromMinutes(policy.scheduledEndMinute)} · {policy.weekdays.map((d) => c.weekday[d]).join(" ")}
                </span>
              </ListRow>
            ))}
          </List>
        )}
      </Panel>
    </PageStack>
  );
}
