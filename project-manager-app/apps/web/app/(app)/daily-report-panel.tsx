"use client";

import { useCallback, useEffect, useState } from "react";
import { useLanguage } from "../../lib/language-context";
import {
  fetchDailyReport,
  fetchDailyReports,
  fetchMyCrews,
  fetchOrganizations,
  fetchOrgCrews,
  generateDailyReport,
  publishDailyReport,
  reviewDailyReport,
  SemseApiError,
  type DailyReportView,
  type SupervisedCrewView
} from "../semse-api";

const COPY = {
  es: {
    titleSupervisor: "Reporte diario",
    titleManager: "Reportes diarios de cuadrillas",
    intro:
      "Foto de las horas registradas y las tareas cerradas del día. No calcula nómina ni usa ubicación; si algo falta, aparece en las limitaciones. Una persona distinta de quien lo genera debe revisarlo.",
    noCrew: "No hay cuadrillas disponibles.",
    unavailable: "Los reportes diarios aún no están habilitados.",
    crew: "Cuadrilla",
    date: "Fecha",
    notes: "Notas (opcional)",
    generate: "Generar o actualizar borrador",
    reports: "Reportes",
    none: "Todavía no hay reportes.",
    open: "Ver",
    total: "Horas de la cuadrilla",
    openEntries: "Registros abiertos (sin horas)",
    tasks: "Tareas cerradas",
    limitations: "Limitaciones",
    hash: "Huella del contenido",
    approve: "Aprobar",
    returnIt: "Devolver",
    publish: "Publicar",
    note: "Nota de revisión (obligatoria al devolver)",
    status: { DRAFT: "Borrador", REVIEWED: "Revisado", PUBLISHED: "Publicado" } as Record<string, string>,
    hoursShort: "h",
    generated: "Borrador generado."
  },
  en: {
    titleSupervisor: "Daily report",
    titleManager: "Crew daily reports",
    intro:
      "A snapshot of the day's recorded hours and closed tasks. It does not compute payroll or use location; anything missing shows up under limitations. A different person than the one who generates it must review it.",
    noCrew: "No crews available.",
    unavailable: "Daily reports are not enabled yet.",
    crew: "Crew",
    date: "Date",
    notes: "Notes (optional)",
    generate: "Generate or refresh draft",
    reports: "Reports",
    none: "No reports yet.",
    open: "View",
    total: "Crew hours",
    openEntries: "Open records (no hours)",
    tasks: "Closed tasks",
    limitations: "Limitations",
    hash: "Content fingerprint",
    approve: "Approve",
    returnIt: "Return",
    publish: "Publish",
    note: "Review note (required when returning)",
    status: { DRAFT: "Draft", REVIEWED: "Reviewed", PUBLISHED: "Published" } as Record<string, string>,
    hoursShort: "h",
    generated: "Draft generated."
  }
} as const;

function today(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

function hours(minutes: number): string {
  return (minutes / 60).toFixed(2);
}

export function DailyReportPanel({ mode }: { mode: "supervisor" | "manager" }) {
  const { language } = useLanguage();
  const c = COPY[language];
  const [crews, setCrews] = useState<SupervisedCrewView[]>([]);
  const [crewId, setCrewId] = useState("");
  const [date, setDate] = useState(today());
  const [notes, setNotes] = useState("");
  const [reports, setReports] = useState<DailyReportView[]>([]);
  const [selected, setSelected] = useState<DailyReportView | null>(null);
  const [reviewNote, setReviewNote] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const describe = useCallback(
    (error: unknown) => (error instanceof SemseApiError && error.status === 404 ? c.unavailable : String((error as Error).message)),
    [c.unavailable]
  );

  useEffect(() => {
    void (async () => {
      try {
        let list: SupervisedCrewView[];
        if (mode === "manager") {
          const orgs = await fetchOrganizations();
          const orgId = typeof orgs[0]?.id === "string" ? (orgs[0].id as string) : null;
          list = orgId ? await fetchOrgCrews(orgId) : [];
        } else {
          list = await fetchMyCrews();
        }
        setCrews(list);
        if (list[0]) setCrewId(list[0].crewId);
      } catch (error) {
        setMessage(describe(error));
      }
    })();
  }, [mode, describe]);

  const loadReports = useCallback(async () => {
    if (!crewId) return;
    try {
      setReports(await fetchDailyReports(crewId));
      setMessage(null);
    } catch (error) {
      setMessage(describe(error));
    }
  }, [crewId, describe]);

  useEffect(() => {
    setSelected(null);
    void loadReports();
  }, [loadReports]);

  async function run(action: () => Promise<void>) {
    setBusy(true);
    try {
      await action();
      await loadReports();
    } catch (error) {
      setMessage(describe(error));
    } finally {
      setBusy(false);
    }
  }

  async function open(reportDate: string) {
    try {
      setSelected(await fetchDailyReport(crewId, reportDate));
    } catch (error) {
      setMessage(describe(error));
    }
  }

  return (
    <main style={{ maxWidth: 760, margin: "0 auto", padding: 16, display: "grid", gap: 16 }}>
      <h1>{mode === "manager" ? c.titleManager : c.titleSupervisor}</h1>
      <p>{c.intro}</p>
      {message ? <p role="status">{message}</p> : null}
      {crews.length === 0 ? (
        <p>{c.noCrew}</p>
      ) : (
        <>
          <label>
            {c.crew}
            <select value={crewId} onChange={(event) => setCrewId(event.target.value)} style={{ width: "100%", minHeight: 44 }}>
              {crews.map((crew) => (
                <option key={crew.crewId} value={crew.crewId}>
                  {crew.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            {c.date}
            <input type="date" value={date} onChange={(event) => setDate(event.target.value)} style={{ width: "100%", minHeight: 44 }} />
          </label>
          <label>
            {c.notes}
            <input value={notes} maxLength={2000} onChange={(event) => setNotes(event.target.value)} style={{ width: "100%", minHeight: 44 }} />
          </label>
          <button
            disabled={busy || !date}
            style={{ minHeight: 44 }}
            onClick={() =>
              void run(async () => {
                const created = await generateDailyReport(crewId, {
                  reportDate: date,
                  tzOffsetMinutes: -new Date().getTimezoneOffset(),
                  ...(notes.trim() ? { notes: notes.trim() } : {})
                });
                setSelected(await fetchDailyReport(crewId, created.reportDate));
                setMessage(c.generated);
              })
            }
          >
            {c.generate}
          </button>
          <h2>{c.reports}</h2>
          {reports.length === 0 ? (
            <p>{c.none}</p>
          ) : (
            <ul style={{ listStyle: "none", padding: 0, display: "grid", gap: 8 }}>
              {reports.map((report) => (
                <li key={report.reportId} style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                  <span style={{ flex: "1 1 160px" }}>{report.reportDate}</span>
                  <span>{c.status[report.status] ?? report.status}</span>
                  <button style={{ minHeight: 44 }} onClick={() => void open(report.reportDate)}>
                    {c.open}
                  </button>
                </li>
              ))}
            </ul>
          )}
          {selected?.snapshot ? (
            <section style={{ display: "grid", gap: 8 }}>
              <h2>
                {selected.reportDate} · {c.status[selected.status] ?? selected.status}
              </h2>
              <p>
                {c.total}: {hours(selected.snapshot.crewWorkedMinutes)} {c.hoursShort} · {c.openEntries}: {selected.snapshot.openEntries}
              </p>
              <ul style={{ paddingLeft: 16 }}>
                {selected.snapshot.workers.map((worker) => (
                  <li key={worker.userId}>
                    {worker.userId}: {hours(worker.workedMinutes)} {c.hoursShort}
                    {worker.openEntries > 0 ? ` (${worker.openEntries} ${c.openEntries.toLowerCase()})` : ""}
                  </li>
                ))}
              </ul>
              <strong>{c.tasks}</strong>
              <ul style={{ paddingLeft: 16 }}>
                {selected.snapshot.tasksCompleted.length === 0 ? <li>—</li> : selected.snapshot.tasksCompleted.map((task) => <li key={task.taskId}>{task.title}</li>)}
              </ul>
              <strong>{c.limitations}</strong>
              <ul style={{ paddingLeft: 16 }}>
                {selected.snapshot.limitations.map((limit) => (
                  <li key={limit}>{limit}</li>
                ))}
              </ul>
              <small>
                {c.hash}: {selected.contentHash.slice(0, 16)}…
              </small>
              {selected.reviewNote ? <p>{selected.reviewNote}</p> : null}
              {mode === "manager" && selected.status === "DRAFT" ? (
                <>
                  <input
                    aria-label={c.note}
                    placeholder={c.note}
                    maxLength={500}
                    value={reviewNote}
                    onChange={(event) => setReviewNote(event.target.value)}
                    style={{ width: "100%", minHeight: 44 }}
                  />
                  <span style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button
                      disabled={busy}
                      style={{ minHeight: 44 }}
                      onClick={() =>
                        void run(async () => {
                          await reviewDailyReport(selected.reportId, "APPROVE", reviewNote.trim() || undefined);
                          setSelected(await fetchDailyReport(crewId, selected.reportDate));
                        })
                      }
                    >
                      {c.approve}
                    </button>
                    <button
                      disabled={busy || reviewNote.trim().length === 0}
                      style={{ minHeight: 44 }}
                      onClick={() =>
                        void run(async () => {
                          await reviewDailyReport(selected.reportId, "RETURN", reviewNote.trim());
                          setSelected(await fetchDailyReport(crewId, selected.reportDate));
                        })
                      }
                    >
                      {c.returnIt}
                    </button>
                  </span>
                </>
              ) : null}
              {mode === "manager" && selected.status === "REVIEWED" ? (
                <button
                  disabled={busy}
                  style={{ minHeight: 44 }}
                  onClick={() =>
                    void run(async () => {
                      await publishDailyReport(selected.reportId);
                      setSelected(await fetchDailyReport(crewId, selected.reportDate));
                    })
                  }
                >
                  {c.publish}
                </button>
              ) : null}
            </section>
          ) : null}
        </>
      )}
    </main>
  );
}
