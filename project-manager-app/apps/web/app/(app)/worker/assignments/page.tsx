"use client";

import { useCallback, useEffect, useState } from "react";
import { useLanguage } from "../../../../lib/language-context";
import {
  fetchMyTaskAllocations,
  SemseApiError,
  updateTaskAllocationStatus,
  type TaskAllocationView
} from "../../../semse-api";

type NextStatus = "ACKNOWLEDGED" | "IN_PROGRESS" | "BLOCKED" | "SUBMITTED";

const COPY = {
  es: {
    title: "Mis asignaciones",
    intro: "Tareas que tu supervisor te asignó. Avanzar una tarea no cambia tus horas ni tu pago.",
    none: "No tienes tareas asignadas.",
    unavailable: "Las asignaciones aún no están habilitadas.",
    note: "Motivo o nota",
    reason: "Motivo de la asignación",
    untitled: "Tarea sin título",
    actions: { ACKNOWLEDGED: "Enterado", IN_PROGRESS: "Empezar", BLOCKED: "Bloquear", SUBMITTED: "Enviar" } as Record<NextStatus, string>,
    resume: "Reanudar",
    status: {
      ASSIGNED: "Asignada",
      ACKNOWLEDGED: "Enterado",
      IN_PROGRESS: "En curso",
      BLOCKED: "Bloqueada",
      SUBMITTED: "Enviada"
    } as Record<string, string>
  },
  en: {
    title: "My assignments",
    intro: "Tasks your supervisor assigned to you. Moving a task forward does not change your hours or pay.",
    none: "You have no assigned tasks.",
    unavailable: "Assignments are not enabled yet.",
    note: "Reason or note",
    reason: "Assignment reason",
    untitled: "Untitled task",
    actions: { ACKNOWLEDGED: "Got it", IN_PROGRESS: "Start", BLOCKED: "Block", SUBMITTED: "Submit" } as Record<NextStatus, string>,
    resume: "Resume",
    status: {
      ASSIGNED: "Assigned",
      ACKNOWLEDGED: "Acknowledged",
      IN_PROGRESS: "In progress",
      BLOCKED: "Blocked",
      SUBMITTED: "Submitted"
    } as Record<string, string>
  }
} as const;

/** Mismas transiciones que valida la API; la API sigue siendo la que decide. */
const NEXT: Record<string, NextStatus[]> = {
  ASSIGNED: ["ACKNOWLEDGED", "IN_PROGRESS", "BLOCKED"],
  ACKNOWLEDGED: ["IN_PROGRESS", "BLOCKED"],
  IN_PROGRESS: ["BLOCKED", "SUBMITTED"],
  BLOCKED: ["IN_PROGRESS"],
  SUBMITTED: []
};

export default function MyAssignmentsPage() {
  const { language } = useLanguage();
  const c = COPY[language];
  const [items, setItems] = useState<TaskAllocationView[]>([]);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const describe = useCallback(
    (error: unknown) => (error instanceof SemseApiError && error.status === 404 ? c.unavailable : String((error as Error).message)),
    [c.unavailable]
  );

  const load = useCallback(async () => {
    try {
      setItems(await fetchMyTaskAllocations());
      setMessage(null);
    } catch (error) {
      setMessage(describe(error));
    }
  }, [describe]);

  useEffect(() => {
    void load();
  }, [load]);

  async function move(item: TaskAllocationView, next: NextStatus) {
    const note = (notes[item.allocationId] ?? "").trim();
    if (next === "BLOCKED" && !note) {
      setMessage(c.note);
      return;
    }
    setBusy(true);
    try {
      await updateTaskAllocationStatus(item.allocationId, next, note || undefined);
      setNotes((current) => ({ ...current, [item.allocationId]: "" }));
      await load();
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
      {items.length === 0 ? (
        <p>{c.none}</p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0, display: "grid", gap: 12 }}>
          {items.map((item) => (
            <li key={item.allocationId} style={{ display: "grid", gap: 6 }}>
              <strong>{item.taskTitle ?? c.untitled}</strong>
              {item.assignReason ? <span>{item.assignReason}</span> : null}
              <span>{c.status[item.status] ?? item.status}</span>
              {item.statusNote ? <span>{item.statusNote}</span> : null}
              {(NEXT[item.status] ?? []).length > 0 ? (
                <>
                  <input
                    aria-label={c.note}
                    placeholder={c.note}
                    maxLength={500}
                    value={notes[item.allocationId] ?? ""}
                    onChange={(event) => setNotes((current) => ({ ...current, [item.allocationId]: event.target.value }))}
                    style={{ width: "100%", minHeight: 44 }}
                  />
                  <span style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {(NEXT[item.status] ?? []).map((next) => (
                      <button key={next} disabled={busy} style={{ minHeight: 44 }} onClick={() => void move(item, next)}>
                        {item.status === "BLOCKED" && next === "IN_PROGRESS" ? c.resume : c.actions[next]}
                      </button>
                    ))}
                  </span>
                </>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
