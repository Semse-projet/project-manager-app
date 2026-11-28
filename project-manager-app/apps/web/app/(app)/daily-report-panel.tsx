"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, Check, ClipboardCheck, Eye, FileText, History, Inbox, RefreshCw, Send, Undo2, Users } from "lucide-react";
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
import {
  Banner,
  Button,
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
  shortId,
  touchInputStyle,
  type Notice,
  type Tone
} from "../../components/module-surface/ui";

const STATUS_TONE: Record<string, Tone> = { DRAFT: "warn", REVIEWED: "brand", PUBLISHED: "ok" };

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
    generated: "Borrador generado.",
    generatePanel: "Generar reporte",
    workers: "Personas",
    noneHint: "Genera el primer borrador con el formulario de arriba.",
    noCrewHint: "Cuando tengas una cuadrilla asignada, podrás generar su reporte del día.",
    review: "Revisión"
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
    generated: "Draft generated.",
    generatePanel: "Generate report",
    workers: "People",
    noneHint: "Generate the first draft with the form above.",
    noCrewHint: "Once you have a crew, you can generate its daily report.",
    review: "Review"
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
  const [notice, setNotice] = useState<Notice>(null);
  const [busy, setBusy] = useState(false);
  const detailRef = useRef<HTMLDivElement>(null);

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
        setNotice({ tone: "error", text: describe(error) });
      }
    })();
  }, [mode, describe]);

  const loadReports = useCallback(async () => {
    if (!crewId) return;
    try {
      setReports(await fetchDailyReports(crewId));
      setNotice(null);
    } catch (error) {
      setNotice({ tone: "error", text: describe(error) });
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
      setNotice({ tone: "error", text: describe(error) });
    } finally {
      setBusy(false);
    }
  }

  async function open(reportDate: string) {
    try {
      setSelected(await fetchDailyReport(crewId, reportDate));
      requestAnimationFrame(() => detailRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
    } catch (error) {
      setNotice({ tone: "error", text: describe(error) });
    }
  }

  const reload = async () => {
    if (selected) setSelected(await fetchDailyReport(crewId, selected.reportDate));
  };

  return (
    <PageStack maxWidth={900}>
      <PageHeader icon={FileText} title={mode === "manager" ? c.titleManager : c.titleSupervisor} description={c.intro} />
      {notice ? (
        <Banner tone={notice.tone} onDismiss={() => setNotice(null)}>
          {notice.text}
        </Banner>
      ) : null}
      {crews.length === 0 ? (
        <Panel>
          <Empty icon={Users} title={c.noCrew} description={c.noCrewHint} />
        </Panel>
      ) : (
        <>
          <Panel title={c.generatePanel} icon={ClipboardCheck}>
            <div style={{ display: "grid", gap: 14 }}>
              <div style={{ display: "grid", gap: 14, gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
                <Field label={c.crew}>
                  <select value={crewId} onChange={(event) => setCrewId(event.target.value)} style={touchInputStyle}>
                    {crews.map((crew) => (
                      <option key={crew.crewId} value={crew.crewId}>
                        {crew.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label={c.date}>
                  <input type="date" value={date} onChange={(event) => setDate(event.target.value)} style={touchInputStyle} />
                </Field>
              </div>
              <Field label={c.notes}>
                <input value={notes} maxLength={2000} onChange={(event) => setNotes(event.target.value)} style={touchInputStyle} />
              </Field>
              <div>
                <Button
                  variant="primary"
                  size="touch"
                  icon={RefreshCw}
                  busy={busy}
                  disabled={!date}
                  onClick={() =>
                    void run(async () => {
                      const created = await generateDailyReport(crewId, {
                        reportDate: date,
                        tzOffsetMinutes: -new Date().getTimezoneOffset(),
                        ...(notes.trim() ? { notes: notes.trim() } : {})
                      });
                      setSelected(await fetchDailyReport(crewId, created.reportDate));
                      setNotice({ tone: "ok", text: c.generated });
                    })
                  }
                >
                  {c.generate}
                </Button>
              </div>
            </div>
          </Panel>

          <div ref={detailRef} style={{ scrollMarginTop: 72 }} />
          {selected?.snapshot ? (
            <Panel
              title={selected.reportDate}
              icon={FileText}
              actions={<Pill tone={STATUS_TONE[selected.status] ?? "muted"}>{c.status[selected.status] ?? selected.status}</Pill>}
            >
              <div style={{ display: "grid", gap: 16 }}>
                <StatGrid>
                  <Stat label={c.total} value={`${hours(selected.snapshot.crewWorkedMinutes)} ${c.hoursShort}`} tone="brand" />
                  <Stat label={c.openEntries} value={selected.snapshot.openEntries} tone={selected.snapshot.openEntries > 0 ? "warn" : "muted"} />
                  <Stat label={c.tasks} value={selected.snapshot.tasksCompleted.length} tone="ok" />
                </StatGrid>

                <section style={{ display: "grid", gap: 8 }}>
                  <h3 style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "var(--muted)" }}>{c.workers}</h3>
                  <div style={{ border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
                    <List>
                      {selected.snapshot.workers.map((worker, index) => (
                        <ListRow key={worker.userId} first={index === 0}>
                          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                            <span style={{ flex: "1 1 160px", fontSize: 13, color: "var(--ink)" }} title={worker.userId}>
                              {shortId(worker.userId, 14)}
                            </span>
                            <strong style={{ fontSize: 14, color: "var(--ink)" }}>
                              {hours(worker.workedMinutes)} {c.hoursShort}
                            </strong>
                            {worker.openEntries > 0 ? (
                              <Pill tone="warn">
                                {worker.openEntries} {c.openEntries.toLowerCase()}
                              </Pill>
                            ) : null}
                          </div>
                        </ListRow>
                      ))}
                    </List>
                  </div>
                </section>

                <section style={{ display: "grid", gap: 8 }}>
                  <h3 style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "var(--muted)" }}>{c.tasks}</h3>
                  {selected.snapshot.tasksCompleted.length === 0 ? (
                    <span style={{ fontSize: 13, color: "var(--faint)" }}>—</span>
                  ) : (
                    <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: 6 }}>
                      {selected.snapshot.tasksCompleted.map((task) => (
                        <li key={task.taskId} style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 13, color: "var(--ink)", overflowWrap: "anywhere" }}>
                          <Check size={14} style={{ color: "var(--ok)", flexShrink: 0, marginTop: 2 }} aria-hidden />
                          {task.title}
                        </li>
                      ))}
                    </ul>
                  )}
                </section>

                {selected.snapshot.limitations.length > 0 ? (
                  <Banner tone="warn">
                    <strong style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                      <AlertTriangle size={14} aria-hidden /> {c.limitations}
                    </strong>
                    <ul style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 2, color: "var(--muted)" }}>
                      {selected.snapshot.limitations.map((limit) => (
                        <li key={limit}>{limit}</li>
                      ))}
                    </ul>
                  </Banner>
                ) : null}

                {selected.reviewNote ? (
                  <div style={{ fontSize: 13, color: "var(--ink)", padding: "10px 12px", borderRadius: 10, background: "var(--raised)", border: "1px solid var(--border)" }}>
                    <span style={{ fontWeight: 700, color: "var(--muted)" }}>{c.review}:</span> {selected.reviewNote}
                  </div>
                ) : null}

                <span style={{ fontSize: 11, color: "var(--faint)", fontFamily: "var(--font-mono)" }}>
                  {c.hash}: {selected.contentHash.slice(0, 16)}…
                </span>

                {mode === "manager" && selected.status === "DRAFT" ? (
                  <div style={{ display: "grid", gap: 10, paddingTop: 12, borderTop: "1px solid var(--border)" }}>
                    <input
                      aria-label={c.note}
                      placeholder={c.note}
                      maxLength={500}
                      value={reviewNote}
                      onChange={(event) => setReviewNote(event.target.value)}
                      style={touchInputStyle}
                    />
                    <div style={{ display: "grid", gap: 8, gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))" }}>
                      <Button
                        variant="primary"
                        size="touch"
                        icon={Check}
                        disabled={busy}
                        onClick={() =>
                          void run(async () => {
                            await reviewDailyReport(selected.reportId, "APPROVE", reviewNote.trim() || undefined);
                            await reload();
                          })
                        }
                      >
                        {c.approve}
                      </Button>
                      <Button
                        variant="danger"
                        size="touch"
                        icon={Undo2}
                        disabled={busy || reviewNote.trim().length === 0}
                        onClick={() =>
                          void run(async () => {
                            await reviewDailyReport(selected.reportId, "RETURN", reviewNote.trim());
                            await reload();
                          })
                        }
                      >
                        {c.returnIt}
                      </Button>
                    </div>
                  </div>
                ) : null}
                {mode === "manager" && selected.status === "REVIEWED" ? (
                  <Button
                    variant="primary"
                    size="touch"
                    icon={Send}
                    disabled={busy}
                    fullWidth
                    onClick={() =>
                      void run(async () => {
                        await publishDailyReport(selected.reportId);
                        await reload();
                      })
                    }
                  >
                    {c.publish}
                  </Button>
                ) : null}
              </div>
            </Panel>
          ) : null}

          <Panel title={c.reports} icon={History} padded={reports.length === 0}>
            {reports.length === 0 ? (
              <Empty icon={Inbox} title={c.none} description={c.noneHint} />
            ) : (
              <List>
                {reports.map((report, index) => (
                  <ListRow key={report.reportId} first={index === 0}>
                    <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                      <strong style={{ flex: "1 1 140px", fontSize: 14, color: "var(--ink)" }}>{report.reportDate}</strong>
                      <Pill tone={STATUS_TONE[report.status] ?? "muted"}>{c.status[report.status] ?? report.status}</Pill>
                      <Button icon={Eye} size="touch" onClick={() => void open(report.reportDate)}>
                        {c.open}
                      </Button>
                    </div>
                  </ListRow>
                ))}
              </List>
            )}
          </Panel>
        </>
      )}
    </PageStack>
  );
}
