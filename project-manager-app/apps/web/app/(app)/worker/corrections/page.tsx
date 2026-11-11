"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useLanguage } from "../../../../lib/language-context";
import { fetchLaborEntries, type TimeEntryView } from "../../labor-api";
import {
  fetchMyLaborCorrections,
  requestLaborCorrection,
  SemseApiError,
  type LaborCorrectionView
} from "../../../semse-api";

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
    status: { PENDING: "Pendiente", APPROVED: "Aprobada", REJECTED: "Rechazada", CANCELED: "Cancelada" } as Record<string, string>
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
    status: { PENDING: "Pending", APPROVED: "Approved", REJECTED: "Rejected", CANCELED: "Canceled" } as Record<string, string>
  }
} as const;

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
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const describe = useCallback(
    (error: unknown) => (error instanceof SemseApiError && error.status === 404 ? c.unavailable : String((error as Error).message)),
    [c.unavailable]
  );

  const load = useCallback(async () => {
    try {
      setRequests(await fetchMyLaborCorrections());
      setMessage(null);
    } catch (error) {
      setMessage(describe(error));
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
      setMessage(c.sent);
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
      <form onSubmit={(event) => void submit(event)} style={{ display: "grid", gap: 8 }}>
        <label>
          {c.entry}
          <select required value={entryId} onChange={(event) => setEntryId(event.target.value)} style={{ width: "100%", minHeight: 44 }}>
            <option value="">{c.pick}</option>
            {entries.map((entry) => (
              <option key={entry.id} value={entry.id}>
                {describeEntry(entry)}
              </option>
            ))}
          </select>
        </label>
        <label>
          {c.newEnd}
          <input type="datetime-local" value={endedAt} onChange={(event) => setEndedAt(event.target.value)} style={{ width: "100%", minHeight: 44 }} />
        </label>
        <label>
          {c.breakMinutes}
          <input
            type="number"
            min={0}
            max={1440}
            value={breakMinutes}
            onChange={(event) => setBreakMinutes(event.target.value)}
            style={{ width: "100%", minHeight: 44 }}
          />
        </label>
        <label>
          {c.reason}
          <input required minLength={5} maxLength={500} value={reason} onChange={(event) => setReason(event.target.value)} style={{ width: "100%", minHeight: 44 }} />
        </label>
        <button type="submit" disabled={busy || !entryId} style={{ minHeight: 44 }}>
          {c.send}
        </button>
      </form>
      <h2>{c.mine}</h2>
      {requests.length === 0 ? (
        <p>{c.none}</p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0, display: "grid", gap: 8 }}>
          {requests.map((request) => (
            <li key={request.correctionId} style={{ display: "grid", gap: 2 }}>
              <span>{request.reason}</span>
              <span>
                {request.original.breakMinutes} → {request.proposed.breakMinutes} min · {c.status[request.status] ?? request.status}
              </span>
              {request.reviewNote ? <span>{request.reviewNote}</span> : null}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
