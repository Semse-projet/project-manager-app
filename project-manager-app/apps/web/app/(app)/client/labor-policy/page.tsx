"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
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
    saved: "Política publicada."
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
    saved: "Policy published."
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
  const [message, setMessage] = useState<string | null>(null);
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
        setMessage(null);
      } catch (error) {
        setMessage(describe(error));
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
          setMessage(c.noOrg);
          return;
        }
        await load(id);
      } catch (error) {
        setMessage(describe(error));
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
      setMessage(describe(error));
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
      setMessage(c.saved);
    });
  }

  return (
    <main style={{ maxWidth: 760, margin: "0 auto", padding: 16, display: "grid", gap: 16 }}>
      <h1>{c.title}</h1>
      <p>{c.intro}</p>
      {message ? <p role="status">{message}</p> : null}
      <h2>{c.policy}</h2>
      <form onSubmit={publish} style={{ display: "grid", gap: 8 }}>
        <label>
          {c.name}
          <input required minLength={2} maxLength={120} value={name} onChange={(event) => setName(event.target.value)} style={{ width: "100%", minHeight: 44 }} />
        </label>
        <fieldset style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <legend>{c.days}</legend>
          {c.weekday.map((label, day) => (
            <label key={label} style={{ display: "flex", gap: 4, alignItems: "center", minHeight: 44 }}>
              <input type="checkbox" checked={weekdays.includes(day)} onChange={() => toggleDay(day)} />
              {label}
            </label>
          ))}
        </fieldset>
        <label>
          {c.start}
          <input type="time" required value={start} onChange={(event) => setStart(event.target.value)} style={{ width: "100%", minHeight: 44 }} />
        </label>
        <label>
          {c.end}
          <input type="time" required value={end} onChange={(event) => setEnd(event.target.value)} style={{ width: "100%", minHeight: 44 }} />
        </label>
        <label>
          {c.breakMinutes}
          <input type="number" min={0} max={480} value={breakMinutes} onChange={(event) => setBreakMinutes(event.target.value)} style={{ width: "100%", minHeight: 44 }} />
        </label>
        <label>
          {c.overtime}
          <input type="number" min={1} max={24} step="0.5" value={overtimeHours} onChange={(event) => setOvertimeHours(event.target.value)} style={{ width: "100%", minHeight: 44 }} />
        </label>
        <button type="submit" disabled={busy || !orgId || weekdays.length === 0} style={{ minHeight: 44 }}>
          {c.save}
        </button>
      </form>
      <h2>{c.versions}</h2>
      {policies.length === 0 ? (
        <p>{c.none}</p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0, display: "grid", gap: 6 }}>
          {policies.map((policy) => (
            <li key={policy.policyId}>
              v{policy.version} · {policy.name} · {fromMinutes(policy.scheduledStartMinute)}–{fromMinutes(policy.scheduledEndMinute)} ·{" "}
              {policy.weekdays.map((d) => c.weekday[d]).join(" ")} · {policy.status}
            </li>
          ))}
        </ul>
      )}
      <h2>{c.queue}</h2>
      {queue.length === 0 ? (
        <p>{c.noQueue}</p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0, display: "grid", gap: 12 }}>
          {queue.map((item) => (
            <li key={item.correctionId} style={{ display: "grid", gap: 6 }}>
              <span>{item.reason}</span>
              <span>
                {item.original.breakMinutes} → {item.proposed.breakMinutes} min
                {item.proposed.endedAt ? ` · → ${new Date(item.proposed.endedAt).toLocaleString()}` : ""}
              </span>
              <input
                aria-label={c.note}
                placeholder={c.note}
                maxLength={500}
                value={notes[item.correctionId] ?? ""}
                onChange={(event) => setNotes((current) => ({ ...current, [item.correctionId]: event.target.value }))}
                style={{ width: "100%", minHeight: 44 }}
              />
              <span style={{ display: "flex", gap: 8 }}>
                <button
                  disabled={busy}
                  style={{ minHeight: 44 }}
                  onClick={() => void run(async () => void (await reviewLaborCorrection(orgId as string, item.correctionId, "approve", notes[item.correctionId]?.trim() || undefined)))}
                >
                  {c.approve}
                </button>
                <button
                  disabled={busy}
                  style={{ minHeight: 44 }}
                  onClick={() => void run(async () => void (await reviewLaborCorrection(orgId as string, item.correctionId, "reject", notes[item.correctionId]?.trim() || undefined)))}
                >
                  {c.reject}
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
