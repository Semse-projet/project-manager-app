"use client";

import { useCallback, useEffect, useState } from "react";
import { Ban, Check, CheckSquare, Inbox, Play, Send } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useLanguage } from "../../../../lib/language-context";
import {
  fetchMyTaskAllocations,
  SemseApiError,
  updateTaskAllocationStatus,
  type TaskAllocationView
} from "../../../semse-api";
import {
  Banner,
  Button,
  Empty,
  PageHeader,
  PageStack,
  Panel,
  Pill,
  Stat,
  StatGrid,
  touchInputStyle,
  type Notice,
  type Tone
} from "../../../../components/module-surface/ui";

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
    noneHint: "Cuando tu supervisor te asigne una tarea, aparecerá aquí.",
    pending: "Por empezar",
    active: "Activas",
    blocked: "Bloqueadas",
    blockNeedsNote: "Escribe el motivo antes de bloquear la tarea.",
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
    noneHint: "When your supervisor assigns you a task, it will show up here.",
    pending: "To start",
    active: "Active",
    blocked: "Blocked",
    blockNeedsNote: "Write the reason before blocking the task.",
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

const STATUS_TONE: Record<string, Tone> = { ASSIGNED: "brand", ACKNOWLEDGED: "signal", IN_PROGRESS: "warn", BLOCKED: "error", SUBMITTED: "ok" };

const ACTION_STYLE: Record<NextStatus, { icon: LucideIcon; variant: "primary" | "secondary" | "danger" }> = {
  ACKNOWLEDGED: { icon: Check, variant: "secondary" },
  IN_PROGRESS: { icon: Play, variant: "primary" },
  BLOCKED: { icon: Ban, variant: "danger" },
  SUBMITTED: { icon: Send, variant: "primary" }
};

export default function MyAssignmentsPage() {
  const { language } = useLanguage();
  const c = COPY[language];
  const [items, setItems] = useState<TaskAllocationView[]>([]);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState<Notice>(null);
  const [busy, setBusy] = useState(false);

  const describe = useCallback(
    (error: unknown) => (error instanceof SemseApiError && error.status === 404 ? c.unavailable : String((error as Error).message)),
    [c.unavailable]
  );

  const load = useCallback(async () => {
    try {
      setItems(await fetchMyTaskAllocations());
      setNotice(null);
    } catch (error) {
      setNotice({ tone: "error", text: describe(error) });
    }
  }, [describe]);

  useEffect(() => {
    void load();
  }, [load]);

  async function move(item: TaskAllocationView, next: NextStatus) {
    const note = (notes[item.allocationId] ?? "").trim();
    if (next === "BLOCKED" && !note) {
      setNotice({ tone: "warn", text: c.blockNeedsNote });
      return;
    }
    setBusy(true);
    try {
      await updateTaskAllocationStatus(item.allocationId, next, note || undefined);
      setNotes((current) => ({ ...current, [item.allocationId]: "" }));
      await load();
    } catch (error) {
      setNotice({ tone: "error", text: describe(error) });
    } finally {
      setBusy(false);
    }
  }

  const count = (statuses: string[]) => items.filter((item) => statuses.includes(item.status)).length;

  return (
    <PageStack maxWidth={820}>
      <PageHeader icon={CheckSquare} title={c.title} description={c.intro} />
      {notice ? (
        <Banner tone={notice.tone} onDismiss={() => setNotice(null)}>
          {notice.text}
        </Banner>
      ) : null}
      {items.length > 0 ? (
        <StatGrid>
          <Stat label={c.pending} value={count(["ASSIGNED", "ACKNOWLEDGED"])} tone="brand" />
          <Stat label={c.active} value={count(["IN_PROGRESS"])} tone="warn" />
          <Stat label={c.blocked} value={count(["BLOCKED"])} tone="error" />
        </StatGrid>
      ) : null}
      {items.length === 0 ? (
        <Panel>
          <Empty icon={Inbox} title={c.none} description={c.noneHint} />
        </Panel>
      ) : (
        <div style={{ display: "grid", gap: 12 }}>
          {items.map((item) => {
            const nextSteps = NEXT[item.status] ?? [];
            return (
              <Panel key={item.allocationId}>
                <div style={{ display: "grid", gap: 10 }}>
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 10, flexWrap: "wrap" }}>
                    <strong style={{ flex: "1 1 200px", fontSize: 15, color: "var(--ink)" }}>{item.taskTitle ?? c.untitled}</strong>
                    <Pill tone={STATUS_TONE[item.status] ?? "muted"}>{c.status[item.status] ?? item.status}</Pill>
                  </div>
                  {item.assignReason ? (
                    <div style={{ fontSize: 13, color: "var(--muted)" }}>
                      <span style={{ fontWeight: 700 }}>{c.reason}:</span> {item.assignReason}
                    </div>
                  ) : null}
                  {item.statusNote ? (
                    <div
                      style={{
                        fontSize: 13,
                        color: "var(--ink)",
                        padding: "8px 12px",
                        borderRadius: 10,
                        background: "var(--raised)",
                        border: "1px solid var(--border)"
                      }}
                    >
                      {item.statusNote}
                    </div>
                  ) : null}
                  {nextSteps.length > 0 ? (
                    <>
                      <input
                        aria-label={c.note}
                        placeholder={c.note}
                        maxLength={500}
                        value={notes[item.allocationId] ?? ""}
                        onChange={(event) => setNotes((current) => ({ ...current, [item.allocationId]: event.target.value }))}
                        style={touchInputStyle}
                      />
                      <div style={{ display: "grid", gap: 8, gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))" }}>
                        {nextSteps.map((next) => (
                          <Button
                            key={next}
                            variant={ACTION_STYLE[next].variant}
                            icon={ACTION_STYLE[next].icon}
                            size="touch"
                            disabled={busy}
                            onClick={() => void move(item, next)}
                          >
                            {item.status === "BLOCKED" && next === "IN_PROGRESS" ? c.resume : c.actions[next]}
                          </Button>
                        ))}
                      </div>
                    </>
                  ) : null}
                </div>
              </Panel>
            );
          })}
        </div>
      )}
    </PageStack>
  );
}
