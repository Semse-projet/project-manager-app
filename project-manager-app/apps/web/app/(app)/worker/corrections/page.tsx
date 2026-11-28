"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Clock, History, Inbox, Send } from "lucide-react";
import { useLanguage } from "../../../../lib/language-context";
import { fetchLaborEntries, type TimeEntryView } from "../../labor-api";
import {
  fetchMyLaborCorrections,
  requestLaborCorrection,
  SemseApiError,
  type LaborCorrectionView
} from "../../../semse-api";
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
  touchInputStyle,
  type Notice,
  type Tone
} from "../../../../components/module-surface/ui";

const COPY = {
  es: {
    title: "Corregir mis horas",
    intro:
      "Si un registro quedó mal, pide una corrección. Tu responsable la revisa; el registro original no cambia hasta que se apruebe.",
    entry: "Registro",
    pick: "Elige un registro terminado",
    newEnd: "Nueva hora de fin",
    breakMinutes: "Descanso real (minutos)",
    reason: "Motivo (mínimo 5 caracteres)",
    send: "Pedir corrección",
    sent: "Solicitud enviada.",
    mine: "Mis solicitudes",
    none: "No tienes solicitudes.",
    unavailable: "Las correcciones de horas aún no están habilitadas.",
    status: { PENDING: "Pendiente", APPROVED: "Aprobada", REJECTED: "Rechazada", CANCELED: "Cancelada" } as Record<string, string>,
    form: "Nueva solicitud",
    back: "Mi tiempo",
    breakLabel: "Descanso",
    endLabel: "Fin",
    noneHint: "Cuando pidas una corrección, aquí verás si fue aprobada."
  },
  en: {
    title: "Correct my hours",
    intro:
      "If a record is wrong, request a correction. Your manager reviews it; the original record does not change until it is approved.",
    entry: "Record",
    pick: "Pick a finished record",
    newEnd: "New end time",
    breakMinutes: "Actual break (minutes)",
    reason: "Reason (at least 5 characters)",
    send: "Request correction",
    sent: "Request sent.",
    mine: "My requests",
    none: "You have no requests.",
    unavailable: "Hour corrections are not enabled yet.",
    status: { PENDING: "Pending", APPROVED: "Approved", REJECTED: "Rejected", CANCELED: "Canceled" } as Record<string, string>,
    form: "New request",
    back: "My time",
    breakLabel: "Break",
    endLabel: "End",
    noneHint: "Once you request a correction, you will see here whether it was approved."
  }
} as const;

const STATUS_TONE: Record<string, Tone> = { PENDING: "warn", APPROVED: "ok", REJECTED: "error", CANCELED: "muted" };

function describeEntry(entry: TimeEntryView): string {
  const start = new Date(entry.startedAt);
  const end = entry.endedAt ? new Date(entry.endedAt) : null;
  return `${start.toLocaleString()} → ${end ? end.toLocaleTimeString() : "…"} (${entry.breakMinutes} min)`;
}

export default function CorrectHoursPage() {
  const { language } = useLanguage();
  const c = COPY[language];
  const [entries, setEntries] = useState<TimeEntryView[]>([]);
  const [requests, setRequests] = useState<LaborCorrectionView[]>([]);
  const [entryId, setEntryId] = useState("");
  const [endedAt, setEndedAt] = useState("");
  const [breakMinutes, setBreakMinutes] = useState("");
  const [reason, setReason] = useState("");
  const [notice, setNotice] = useState<Notice>(null);
  const [busy, setBusy] = useState(false);

  const describe = useCallback(
    (error: unknown) => (error instanceof SemseApiError && error.status === 404 ? c.unavailable : String((error as Error).message)),
    [c.unavailable]
  );

  const load = useCallback(async () => {
    try {
      setRequests(await fetchMyLaborCorrections());
      setNotice(null);
    } catch (error) {
      setNotice({ tone: "error", text: describe(error) });
    }
  }, [describe]);

  useEffect(() => {
    void load();
    void fetchLaborEntries({ range: "month", limit: 60 })
      .then((rows) => setEntries(rows.filter((row) => row.endedAt !== null && row.status !== "deleted")))
      .catch(() => setEntries([]));
  }, [load]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      await requestLaborCorrection({
        timeEntryId: entryId,
        reason: reason.trim(),
        ...(endedAt ? { endedAt: new Date(endedAt).toISOString() } : {}),
        ...(breakMinutes !== "" ? { breakMinutes: Number(breakMinutes) } : {})
      });
      setReason("");
      setEndedAt("");
      setBreakMinutes("");
      await load();
      setNotice({ tone: "ok", text: c.sent });
    } catch (error) {
      setNotice({ tone: "error", text: describe(error) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <PageStack maxWidth={760}>
      <PageHeader icon={Clock} title={c.title} description={c.intro} back={{ href: "/worker/tracker", label: c.back }} />
      {notice ? (
        <Banner tone={notice.tone} onDismiss={() => setNotice(null)}>
          {notice.text}
        </Banner>
      ) : null}
      <Panel title={c.form} icon={Send}>
        <form onSubmit={(event) => void submit(event)} style={{ display: "grid", gap: 14 }}>
          <Field label={c.entry}>
            <select required value={entryId} onChange={(event) => setEntryId(event.target.value)} style={touchInputStyle}>
              <option value="">{c.pick}</option>
              {entries.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {describeEntry(entry)}
                </option>
              ))}
            </select>
          </Field>
          <div style={{ display: "grid", gap: 14, gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
            <Field label={c.newEnd}>
              <input type="datetime-local" value={endedAt} onChange={(event) => setEndedAt(event.target.value)} style={touchInputStyle} />
            </Field>
            <Field label={c.breakMinutes}>
              <input
                type="number"
                min={0}
                max={1440}
                value={breakMinutes}
                onChange={(event) => setBreakMinutes(event.target.value)}
                style={touchInputStyle}
              />
            </Field>
          </div>
          <Field label={c.reason}>
            <input required minLength={5} maxLength={500} value={reason} onChange={(event) => setReason(event.target.value)} style={touchInputStyle} />
          </Field>
          <Button type="submit" variant="primary" size="touch" icon={Send} busy={busy} disabled={!entryId} fullWidth>
            {c.send}
          </Button>
        </form>
      </Panel>
      <Panel title={c.mine} icon={History} padded={requests.length === 0}>
        {requests.length === 0 ? (
          <Empty icon={Inbox} title={c.none} description={c.noneHint} />
        ) : (
          <List>
            {requests.map((request, index) => (
              <ListRow key={request.correctionId} first={index === 0}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 10, flexWrap: "wrap" }}>
                  <span style={{ flex: "1 1 220px", fontSize: 14, fontWeight: 600, color: "var(--ink)" }}>{request.reason}</span>
                  <Pill tone={STATUS_TONE[request.status] ?? "muted"}>{c.status[request.status] ?? request.status}</Pill>
                </div>
                <span style={{ fontSize: 12, color: "var(--muted)" }}>
                  {c.breakLabel}: {request.original.breakMinutes} → {request.proposed.breakMinutes} min
                  {request.proposed.endedAt ? ` · ${c.endLabel}: ${new Date(request.proposed.endedAt).toLocaleString()}` : ""}
                </span>
                {request.reviewNote ? (
                  <span style={{ fontSize: 12, color: "var(--faint)", fontStyle: "italic" }}>“{request.reviewNote}”</span>
                ) : null}
              </ListRow>
            ))}
          </List>
        )}
      </Panel>
    </PageStack>
  );
}
