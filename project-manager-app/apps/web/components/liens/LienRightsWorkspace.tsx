"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  CalendarClock,
  CalendarPlus,
  Eye,
  FileSignature,
  Mail,
  PenLine,
  RefreshCw,
  Scale,
  Send,
  ShieldAlert,
  Stamp,
  Wand2
} from "lucide-react";
import {
  createLienCalendar,
  fetchCanonicalProjects,
  fetchLienCalendars,
  fetchLienNoticePreview,
  fetchLienNotices,
  fetchLienWaivers,
  generateLienNotices,
  runLienDeadlineCheck,
  sendLienNotice,
  signLienWaiver,
  type CanonicalProject,
  type LienCalendar,
  type LienNotice,
  type LienRecipientType,
  type LienWaiver
} from "../../app/lib/module-surfaces-api";
import {
  Banner,
  Button,
  ConfirmDialog,
  Empty,
  Field,
  Loading,
  Panel,
  Pill,
  Stat,
  StatGrid,
  daysUntil,
  formatDate,
  inputStyle,
  shortId,
  type Tone
} from "../module-surface/ui";
import { SignaturePad } from "./SignaturePad";

/* ───────────────────────────── vocab ───────────────────────────── */

const US_STATES = [
  "Alabama", "Alaska", "Arizona", "Arkansas", "California", "Colorado", "Connecticut", "Delaware", "Florida",
  "Georgia", "Hawaii", "Idaho", "Illinois", "Indiana", "Iowa", "Kansas", "Kentucky", "Louisiana", "Maine",
  "Maryland", "Massachusetts", "Michigan", "Minnesota", "Mississippi", "Missouri", "Montana", "Nebraska",
  "Nevada", "New Hampshire", "New Jersey", "New Mexico", "New York", "North Carolina", "North Dakota", "Ohio",
  "Oklahoma", "Oregon", "Pennsylvania", "Rhode Island", "South Carolina", "South Dakota", "Tennessee", "Texas",
  "Utah", "Vermont", "Virginia", "Washington", "West Virginia", "Wisconsin", "Wyoming"
];

const CALENDAR_STATUS: Record<string, { label: string; tone: Tone }> = {
  CREATED: { label: "En plazo", tone: "muted" },
  ALERTED_30D: { label: "Alerta 30 días", tone: "signal" },
  ALERTED_7D: { label: "Alerta 7 días", tone: "warn" },
  ALERTED_3D: { label: "Alerta 3 días", tone: "error" },
  NOTICE_SENT: { label: "Aviso enviado", tone: "brand" },
  NOTICE_DELIVERED: { label: "Aviso entregado", tone: "ok" },
  NOTICE_FAILED: { label: "Entrega fallida", tone: "error" }
};

const NOTICE_STATUS: Record<string, { label: string; tone: Tone }> = {
  DRAFT: { label: "Borrador", tone: "muted" },
  NOTICE_SENT: { label: "Enviado", tone: "brand" },
  DELIVERY_PENDING: { label: "En tránsito", tone: "signal" },
  NOTICE_DELIVERED: { label: "Entregado", tone: "ok" },
  DELIVERY_FAILED: { label: "Falló la entrega", tone: "error" }
};

const RECIPIENT_LABEL: Record<string, string> = {
  owner: "Propietario",
  general_contractor: "Contratista general",
  lender: "Prestamista",
  architect: "Arquitecto"
};

const NOTICE_TYPE_LABEL: Record<string, string> = {
  preliminary: "Aviso preliminar",
  final: "Aviso final",
  status_lien: "Gravamen (lien)"
};

function deadlineTone(days: number | null): Tone {
  if (days === null) return "muted";
  if (days < 0) return "error";
  if (days <= 3) return "error";
  if (days <= 7) return "warn";
  if (days <= 30) return "signal";
  return "ok";
}

function daysLabel(days: number | null): string {
  if (days === null) return "—";
  if (days < 0) return `vencido hace ${Math.abs(days)} d`;
  if (days === 0) return "vence hoy";
  return `en ${days} d`;
}

function money(value?: string | number | null): string {
  if (value === null || value === undefined || value === "") return "Total (incondicional)";
  const n = Number(value);
  return Number.isFinite(n) ? n.toLocaleString("es", { style: "currency", currency: "USD" }) : String(value);
}

/* ───────────────────────────── workspace ───────────────────────────── */

type Props = {
  /** `admin` adds the manual deadline-check trigger (requires ops:dashboard:write). */
  mode: "admin" | "workspace";
};

export function LienRightsWorkspace({ mode }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const projectId = searchParams.get("projectId") ?? "";

  const [projects, setProjects] = useState<CanonicalProject[] | null>(null);
  const [projectsError, setProjectsError] = useState<string | null>(null);

  const [calendars, setCalendars] = useState<LienCalendar[]>([]);
  const [notices, setNotices] = useState<LienNotice[]>([]);
  const [drafts, setDrafts] = useState<LienNotice[]>([]);
  const [waivers, setWaivers] = useState<LienWaiver[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const [preview, setPreview] = useState<{ notice: LienNotice; html: string } | null>(null);
  const [confirmSend, setConfirmSend] = useState<LienNotice | null>(null);
  const [signing, setSigning] = useState<LienWaiver | null>(null);

  useEffect(() => {
    fetchCanonicalProjects()
      .then(setProjects)
      .catch((e: unknown) => setProjectsError(e instanceof Error ? e.message : "No se pudieron cargar los proyectos"));
  }, []);

  const selectProject = (id: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (id) params.set("projectId", id);
    else params.delete("projectId");
    setDrafts([]);
    router.replace(`?${params.toString()}`);
  };

  const load = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    setError(null);
    try {
      const [cal, sent, pend] = await Promise.all([
        fetchLienCalendars(projectId),
        fetchLienNotices(projectId),
        fetchLienWaivers(projectId)
      ]);
      setCalendars(cal ?? []);
      setNotices(sent ?? []);
      setWaivers(pend ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo cargar la información de liens");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function run(key: string, task: () => Promise<void>) {
    setBusy(key);
    setError(null);
    setFlash(null);
    try {
      await task();
    } catch (e) {
      setError(e instanceof Error ? e.message : "La acción falló");
    } finally {
      setBusy(null);
    }
  }

  // `GET notices` only returns non-DRAFT notices, so freshly generated drafts
  // are kept locally until they are sent.
  const allNotices = useMemo(() => {
    const sentIds = new Set(notices.map((n) => n.id));
    return [...drafts.filter((d) => !sentIds.has(d.id)), ...notices].sort(
      (a, b) => new Date(b.generatedAt ?? b.createdAt).getTime() - new Date(a.generatedAt ?? a.createdAt).getTime()
    );
  }, [drafts, notices]);

  const nextDeadline = useMemo(() => {
    const dates = calendars.flatMap((c) =>
      [c.preliminaryNoticeDeadline, c.waiverDeadline, c.finalNoticeDeadline, c.statusLienDeadline].filter(
        (d): d is string => Boolean(d) && (daysUntil(d) ?? -1) >= 0
      )
    );
    dates.sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
    return dates[0] ?? null;
  }, [calendars]);

  const calendarState = (id: string) => calendars.find((c) => c.id === id)?.stateName ?? shortId(id);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Project picker */}
      <Panel title="Proyecto" icon={Scale} actions={mode === "admin" ? (
        <Button
          icon={CalendarClock}
          busy={busy === "check"}
          onClick={() =>
            void run("check", async () => {
              const result = await runLienDeadlineCheck();
              setFlash(result?.message ?? "Plazos revisados");
              await load();
            })
          }
          title="Ejecuta ahora el revisor de plazos que el worker corre cada hora"
        >
          Revisar plazos ahora
        </Button>
      ) : undefined}>
        <div style={{ display: "grid", gap: 12, gridTemplateColumns: "minmax(0, 1fr) auto", alignItems: "end" }}>
          <Field
            label="Proyecto canónico"
            hint="Los derechos de gravamen se calculan por proyecto y estado de EE. UU. donde se ejecuta la obra."
          >
            <select value={projectId} onChange={(e) => selectProject(e.target.value)} style={inputStyle}>
              <option value="">Selecciona un proyecto…</option>
              {(projects ?? []).map((p) => (
                <option key={p.id} value={p.id}>
                  {shortId(p.id, 10)} · job {shortId(p.jobId, 10)} · {p.status}
                </option>
              ))}
              {projectId && projects && !projects.some((p) => p.id === projectId) ? (
                <option value={projectId}>{projectId}</option>
              ) : null}
            </select>
          </Field>
          <Button icon={RefreshCw} onClick={() => void load()} disabled={!projectId} busy={loading}>
            Actualizar
          </Button>
        </div>
        {projectsError ? <p style={{ margin: "8px 0 0", fontSize: 12, color: "var(--error)" }}>{projectsError}</p> : null}
      </Panel>

      {error ? <Banner tone="error" onDismiss={() => setError(null)}>{error}</Banner> : null}
      {flash ? <Banner tone="ok" onDismiss={() => setFlash(null)}>{flash}</Banner> : null}

      {!projectId ? (
        <Panel>
          <Empty
            icon={Scale}
            title="Elige un proyecto para ver sus derechos de gravamen"
            description="Verás el calendario de plazos legales por estado, los avisos preliminares por correo certificado y los waivers pendientes de firma que bloquean la liberación del escrow."
          />
        </Panel>
      ) : loading && calendars.length === 0 ? (
        <Loading label="Cargando calendario de liens…" />
      ) : (
        <>
          <StatGrid>
            <Stat label="Estados con calendario" value={calendars.length} />
            <Stat
              label="Próximo plazo"
              value={nextDeadline ? daysLabel(daysUntil(nextDeadline)) : "—"}
              tone={deadlineTone(daysUntil(nextDeadline))}
              hint={nextDeadline ? formatDate(nextDeadline) : "Sin plazos futuros"}
            />
            <Stat
              label="Waivers por firmar"
              value={waivers.length}
              tone={waivers.length ? "warn" : "ok"}
              hint={waivers.length ? "Bloquean la liberación de fondos" : "Nada bloquea el pago"}
            />
            <Stat label="Avisos enviados" value={notices.length} tone="brand" />
          </StatGrid>

          {waivers.length > 0 ? (
            <Banner tone="warn">
              <strong>Hay {waivers.length} waiver(s) pendiente(s).</strong> Mientras exista un waiver en estado PENDING, la
              liberación del escrow de este proyecto queda bloqueada por el gate de pagos.
            </Banner>
          ) : null}

          <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 420px), 1fr))" }}>
            <CalendarsPanel
              calendars={calendars}
              busy={busy}
              onCreate={(input) =>
                run("create", async () => {
                  await createLienCalendar(projectId, input);
                  setFlash(`Calendario de ${input.stateName} creado con los plazos de LienGrid.`);
                  await load();
                })
              }
              onGenerate={(calendar, recipient) =>
                run(`gen:${calendar.id}`, async () => {
                  const result = await generateLienNotices(projectId, calendar.id, recipient);
                  const created = Array.isArray(result) ? result : result ? [result] : [];
                  setDrafts((prev) => [...created, ...prev]);
                  setFlash(`${created.length} aviso(s) en borrador generados para ${calendar.stateName}. Revísalos antes de enviar.`);
                })
              }
            />
            <WaiversPanel waivers={waivers} onSign={setSigning} />
          </div>

          <NoticesPanel
            notices={allNotices}
            calendarState={calendarState}
            busy={busy}
            onPreview={(notice) =>
              run(`preview:${notice.id}`, async () => {
                const data = await fetchLienNoticePreview(projectId, notice.id);
                setPreview({ notice, html: String(data?.html ?? data?.noticeContent ?? data?.content ?? "") });
              })
            }
            onSend={setConfirmSend}
          />
        </>
      )}

      {preview ? (
        <NoticePreviewDialog
          notice={preview.notice}
          html={preview.html}
          onClose={() => setPreview(null)}
          onSend={preview.notice.status === "DRAFT" ? () => { setConfirmSend(preview.notice); setPreview(null); } : undefined}
        />
      ) : null}

      <ConfirmDialog
        open={Boolean(confirmSend)}
        title="Enviar aviso por correo certificado"
        confirmLabel="Enviar ahora"
        busy={busy === "send"}
        onCancel={() => setConfirmSend(null)}
        onConfirm={() =>
          confirmSend &&
          void run("send", async () => {
            await sendLienNotice(projectId, confirmSend.id);
            setDrafts((prev) => prev.filter((d) => d.id !== confirmSend.id));
            setConfirmSend(null);
            setFlash("Aviso enviado por correo certificado. El seguimiento de entrega se actualizará automáticamente.");
            await load();
          })
        }
      >
        Se enviará una carta certificada real a <strong>{RECIPIENT_LABEL[confirmSend?.recipientType ?? ""] ?? confirmSend?.recipientType}</strong>{" "}
        a través de Lob. Este envío tiene costo y no se puede deshacer. Solo el profesional asignado al proyecto puede
        enviarlo.
      </ConfirmDialog>

      {signing ? (
        <SignWaiverDialog
          waiver={signing}
          busy={busy === "sign"}
          onCancel={() => setSigning(null)}
          onSign={(signature) =>
            void run("sign", async () => {
              await signLienWaiver(projectId, signing.id, signature);
              setSigning(null);
              setFlash("Waiver firmado. Ya no bloquea la liberación de fondos.");
              await load();
            })
          }
        />
      ) : null}
    </div>
  );
}

/* ───────────────────────────── calendars ───────────────────────────── */

function CalendarsPanel({
  calendars,
  busy,
  onCreate,
  onGenerate
}: {
  calendars: LienCalendar[];
  busy: string | null;
  onCreate: (input: { stateName: string; projectStartDate: string }) => void;
  onGenerate: (calendar: LienCalendar, recipient?: LienRecipientType) => void;
}) {
  const [showForm, setShowForm] = useState(false);
  const [stateName, setStateName] = useState("California");
  const [startDate, setStartDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [recipientById, setRecipientById] = useState<Record<string, string>>({});
  const used = new Set(calendars.map((c) => c.stateName));

  return (
    <Panel
      title="Calendario de plazos"
      icon={CalendarClock}
      actions={
        <Button icon={CalendarPlus} variant={showForm ? "ghost" : "secondary"} onClick={() => setShowForm((v) => !v)}>
          {showForm ? "Cerrar" : "Nuevo estado"}
        </Button>
      }
    >
      {showForm ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onCreate({ stateName, projectStartDate: new Date(`${startDate}T00:00:00`).toISOString() });
            setShowForm(false);
          }}
          style={{
            display: "grid",
            gap: 12,
            gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
            alignItems: "end",
            padding: 12,
            marginBottom: 14,
            borderRadius: 12,
            background: "var(--raised)"
          }}
        >
          <Field label="Estado">
            <select value={stateName} onChange={(e) => setStateName(e.target.value)} style={inputStyle}>
              {US_STATES.map((s) => (
                <option key={s} value={s} disabled={used.has(s)}>
                  {s}
                  {used.has(s) ? " (ya existe)" : ""}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Inicio de obra">
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} style={inputStyle} required />
          </Field>
          <Button type="submit" variant="primary" icon={Wand2} busy={busy === "create"} disabled={used.has(stateName)}>
            Calcular plazos
          </Button>
        </form>
      ) : null}

      {calendars.length === 0 ? (
        <Empty
          icon={CalendarClock}
          title="Sin calendario todavía"
          description="Agrega el estado donde se ejecuta la obra y SEMSE calculará los plazos legales de aviso preliminar, waiver y gravamen."
        />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {calendars.map((c) => {
            const status = CALENDAR_STATUS[c.status] ?? { label: c.status, tone: "muted" as Tone };
            const milestones = [
              { label: "Aviso preliminar", date: c.preliminaryNoticeDeadline },
              { label: "Waiver", date: c.waiverDeadline },
              { label: "Aviso final", date: c.finalNoticeDeadline },
              { label: "Gravamen", date: c.statusLienDeadline }
            ].filter((m) => m.date);
            return (
              <article key={c.id} style={{ border: "1px solid var(--border)", borderRadius: 12, padding: 14, background: "var(--bg)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <strong style={{ fontSize: 15, color: "var(--ink)", flex: 1 }}>{c.stateName}</strong>
                  <Pill tone={status.tone}>{status.label}</Pill>
                  {c.requiresCertifiedMail ? <Pill tone="muted" icon={Mail}>Certificado</Pill> : null}
                  {c.requiresNotary ? <Pill tone="violet" icon={Stamp}>Notario</Pill> : null}
                </div>

                <ol style={{ listStyle: "none", margin: "12px 0 0", padding: 0, display: "grid", gap: 6 }}>
                  {milestones.map((m) => {
                    const d = daysUntil(m.date);
                    const tone = deadlineTone(d);
                    return (
                      <li key={m.label} style={{ display: "grid", gridTemplateColumns: "10px 1fr auto auto", alignItems: "center", gap: 10, fontSize: 13 }}>
                        <span style={{ width: 8, height: 8, borderRadius: 99, background: `var(--${tone})` }} />
                        <span style={{ color: "var(--ink)" }}>{m.label}</span>
                        <span style={{ color: "var(--muted)" }}>{formatDate(m.date)}</span>
                        <span style={{ color: `var(--${tone})`, fontWeight: 700, minWidth: 92, textAlign: "right" }}>{daysLabel(d)}</span>
                      </li>
                    );
                  })}
                </ol>

                <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
                  <select
                    aria-label={`Destinatario para ${c.stateName}`}
                    value={recipientById[c.id] ?? ""}
                    onChange={(e) => setRecipientById((prev) => ({ ...prev, [c.id]: e.target.value }))}
                    style={{ ...inputStyle, width: "auto", flex: "1 1 180px" }}
                  >
                    <option value="">Todos los destinatarios requeridos</option>
                    {Object.entries(RECIPIENT_LABEL).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                  <Button
                    icon={FileSignature}
                    busy={busy === `gen:${c.id}`}
                    onClick={() => onGenerate(c, (recipientById[c.id] || undefined) as LienRecipientType | undefined)}
                  >
                    Generar avisos
                  </Button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </Panel>
  );
}

/* ───────────────────────────── waivers ───────────────────────────── */

function WaiversPanel({ waivers, onSign }: { waivers: LienWaiver[]; onSign: (waiver: LienWaiver) => void }) {
  return (
    <Panel title="Waivers pendientes" icon={PenLine}>
      {waivers.length === 0 ? (
        <Empty icon={PenLine} title="No hay waivers por firmar" description="Cuando un hito o escrow requiera una renuncia de gravamen, aparecerá aquí." />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {waivers.map((w) => {
            const d = daysUntil(w.requiredBefore);
            return (
              <article key={w.id} style={{ border: "1px solid var(--border)", borderRadius: 12, padding: 14, background: "var(--bg)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <strong style={{ fontSize: 14, color: "var(--ink)", flex: 1 }}>
                    {w.waiverType === "conditional" ? "Waiver condicional" : "Waiver incondicional"}
                  </strong>
                  <Pill tone={deadlineTone(d)}>{daysLabel(d)}</Pill>
                </div>
                <dl style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "4px 12px", margin: "10px 0 0", fontSize: 13 }}>
                  <dt style={{ color: "var(--muted)" }}>Estado</dt>
                  <dd style={{ margin: 0, color: "var(--ink)" }}>{w.stateName ?? "—"}</dd>
                  <dt style={{ color: "var(--muted)" }}>Monto liberado</dt>
                  <dd style={{ margin: 0, color: "var(--ink)" }}>{money(w.releaseAmount)}</dd>
                  <dt style={{ color: "var(--muted)" }}>Firmar antes de</dt>
                  <dd style={{ margin: 0, color: "var(--ink)" }}>{formatDate(w.requiredBefore)}</dd>
                </dl>
                <div style={{ marginTop: 12 }}>
                  <Button variant="primary" icon={PenLine} onClick={() => onSign(w)}>
                    Revisar y firmar
                  </Button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </Panel>
  );
}

function SignWaiverDialog({
  waiver,
  busy,
  onCancel,
  onSign
}: {
  waiver: LienWaiver;
  busy: boolean;
  onCancel: () => void;
  onSign: (signature: string) => void;
}) {
  const [signature, setSignature] = useState<string | null>(null);
  const [accepted, setAccepted] = useState(false);
  const conditional = waiver.waiverType === "conditional";

  return (
    <ConfirmDialog
      open
      title={conditional ? "Firmar waiver condicional" : "Firmar waiver incondicional"}
      confirmLabel="Firmar waiver"
      busy={busy}
      confirmDisabled={!signature || !accepted}
      onCancel={onCancel}
      onConfirm={() => {
        if (signature && accepted) onSign(signature);
      }}
    >
      <p style={{ margin: "0 0 10px" }}>
        {conditional
          ? "Renuncias a tu derecho de gravamen por el monto indicado, condicionado a recibir efectivamente el pago."
          : "Renuncias a tu derecho de gravamen sin condiciones. Firma solo si ya recibiste el pago."}{" "}
        Monto: <strong style={{ color: "var(--ink)" }}>{money(waiver.releaseAmount)}</strong>.
      </p>
      <SignaturePad onChange={setSignature} height={140} />
      <label style={{ display: "flex", gap: 8, alignItems: "flex-start", marginTop: 8, fontSize: 12, color: "var(--ink)" }}>
        <input type="checkbox" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} style={{ marginTop: 2 }} />
        Entiendo que esta firma es legalmente vinculante y que soy el profesional asignado a este proyecto.
      </label>
      {!signature || !accepted ? (
        <p style={{ margin: "8px 0 0", fontSize: 11, color: "var(--faint)" }}>Dibuja tu firma y acepta la declaración para continuar.</p>
      ) : null}
    </ConfirmDialog>
  );
}

/* ───────────────────────────── notices ───────────────────────────── */

function NoticesPanel({
  notices,
  calendarState,
  busy,
  onPreview,
  onSend
}: {
  notices: LienNotice[];
  calendarState: (id: string) => string;
  busy: string | null;
  onPreview: (notice: LienNotice) => void;
  onSend: (notice: LienNotice) => void;
}) {
  return (
    <Panel title="Avisos legales" icon={Mail} padded={notices.length === 0}>
      {notices.length === 0 ? (
        <Empty
          icon={Mail}
          title="Aún no hay avisos"
          description="Genera los avisos preliminares desde el calendario. Se crean como borrador para que los revises antes del envío certificado."
        />
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", minWidth: 680, borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ textAlign: "left", color: "var(--muted)", fontSize: 11, textTransform: "uppercase", letterSpacing: ".04em" }}>
                {["Aviso", "Destinatario", "Estado", "Generado", "Enviado", "Seguimiento", ""].map((h) => (
                  <th key={h} style={{ padding: "10px 16px", borderBottom: "1px solid var(--border)", fontWeight: 700 }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {notices.map((n) => {
                const status = NOTICE_STATUS[n.status] ?? { label: n.status, tone: "muted" as Tone };
                return (
                  <tr key={n.id} style={{ borderBottom: "1px solid var(--border)" }}>
                    <td style={{ padding: "10px 16px", color: "var(--ink)" }}>
                      <div style={{ fontWeight: 600 }}>{NOTICE_TYPE_LABEL[n.noticeType] ?? n.noticeType}</div>
                      <div style={{ fontSize: 11, color: "var(--faint)" }}>{calendarState(n.lienCalendarId)}</div>
                    </td>
                    <td style={{ padding: "10px 16px", color: "var(--ink)" }}>{RECIPIENT_LABEL[n.recipientType] ?? n.recipientType}</td>
                    <td style={{ padding: "10px 16px" }}>
                      <Pill tone={status.tone}>{status.label}</Pill>
                    </td>
                    <td style={{ padding: "10px 16px", color: "var(--muted)" }}>{formatDate(n.generatedAt)}</td>
                    <td style={{ padding: "10px 16px", color: "var(--muted)" }}>{formatDate(n.sentAt)}</td>
                    <td style={{ padding: "10px 16px", color: "var(--muted)" }}>
                      {n.lobLetterUrl ? (
                        <a href={n.lobLetterUrl} target="_blank" rel="noopener noreferrer" style={{ color: "var(--brand)" }}>
                          {n.lobLetterTrackingId ? shortId(n.lobLetterTrackingId, 10) : "PDF"}
                        </a>
                      ) : (
                        n.lobLetterTrackingId ?? "—"
                      )}
                    </td>
                    <td style={{ padding: "10px 16px" }}>
                      <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                        <Button variant="ghost" icon={Eye} busy={busy === `preview:${n.id}`} onClick={() => onPreview(n)}>
                          Ver
                        </Button>
                        {n.status === "DRAFT" ? (
                          <Button variant="primary" icon={Send} onClick={() => onSend(n)}>
                            Enviar
                          </Button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}

function NoticePreviewDialog({
  notice,
  html,
  onClose,
  onSend
}: {
  notice: LienNotice;
  html: string;
  onClose: () => void;
  onSend?: () => void;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Vista previa del aviso"
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 80,
        display: "grid",
        placeItems: "center",
        padding: 16,
        background: "color-mix(in srgb, var(--bg) 70%, transparent)",
        backdropFilter: "blur(4px)"
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 760,
          maxHeight: "90vh",
          display: "flex",
          flexDirection: "column",
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: 16,
          overflow: "hidden"
        }}
      >
        <header style={{ display: "flex", alignItems: "center", gap: 8, padding: "12px 16px", borderBottom: "1px solid var(--border)" }}>
          <strong style={{ flex: 1, color: "var(--ink)", fontSize: 14 }}>
            {NOTICE_TYPE_LABEL[notice.noticeType] ?? notice.noticeType} · {RECIPIENT_LABEL[notice.recipientType] ?? notice.recipientType}
          </strong>
          {onSend ? (
            <Button variant="primary" icon={Send} onClick={onSend}>
              Enviar
            </Button>
          ) : null}
          <Button variant="ghost" onClick={onClose}>
            Cerrar
          </Button>
        </header>
        {html ? (
          // Notice HTML is server-generated; render it isolated (no scripts,
          // no same-origin access) and on a fixed paper background, as printed.
          <iframe title="Contenido del aviso" sandbox="" srcDoc={html} style={{ flex: 1, minHeight: 480, border: 0, background: "#ffffff" }} />
        ) : (
          <Empty icon={ShieldAlert} title="El aviso no tiene contenido para mostrar" />
        )}
      </div>
    </div>
  );
}
