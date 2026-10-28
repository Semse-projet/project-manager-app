"use client";

import { useCallback, useEffect, useState } from "react";
import { useLanguage } from "../../../../lib/language-context";
import {
  assignTaskToCrewMembers,
  createCrewTask,
  fetchCrewTasks,
  fetchCrewRoster,
  fetchMyCrews,
  fetchTaskAllocations,
  releaseTaskAllocation,
  reviewAllocationSkill,
  SemseApiError,
  type CrewTaskView,
  type SupervisedCrewView,
  type TaskAllocationView
} from "../../../semse-api";

const COPY = {
  es: {
    title: "Mi cuadrilla",
    intro: "Asigna una tarea a personas de tu cuadrilla. Solo puedes asignar dentro de tu cuadrilla.",
    noCrew: "No supervisas ninguna cuadrilla.",
    unavailable: "Las cuadrillas o asignaciones aún no están habilitadas.",
    crew: "Cuadrilla",
    taskId: "Tarea",
    pickTask: "Elige una tarea",
    newTask: "Nueva tarea",
    newTaskTitle: "Título de la nueva tarea",
    createTask: "Crear tarea",
    created: "Tarea creada.",
    members: "Personas",
    reason: "Motivo (opcional)",
    assign: "Asignar",
    load: "Ver asignaciones",
    none: "Esa tarea no tiene asignaciones en esta cuadrilla.",
    release: "Liberar",
    tradeLabel: "Oficio de la experiencia",
    confirmWork: "Confirmar trabajo",
    rejectWork: "Rechazar",
    reviewed: "Revisión registrada.",
    releaseReason: "Motivo para liberar",
    pickMember: "Elige al menos una persona.",
    done: "Listo.",
    untitled: "Tarea sin título",
    status: {
      ASSIGNED: "Asignada",
      ACKNOWLEDGED: "Enterado",
      IN_PROGRESS: "En curso",
      BLOCKED: "Bloqueada",
      SUBMITTED: "Enviada",
      RELEASED: "Liberada"
    } as Record<string, string>
  },
  en: {
    title: "My crew",
    intro: "Assign a task to people in your crew. You can only assign within your own crew.",
    noCrew: "You do not supervise any crew.",
    unavailable: "Crews or assignments are not enabled yet.",
    crew: "Crew",
    taskId: "Task",
    pickTask: "Pick a task",
    newTask: "New task",
    newTaskTitle: "New task title",
    createTask: "Create task",
    created: "Task created.",
    members: "People",
    reason: "Reason (optional)",
    assign: "Assign",
    load: "View assignments",
    none: "That task has no assignments in this crew.",
    release: "Release",
    tradeLabel: "Trade of the experience",
    confirmWork: "Confirm work",
    rejectWork: "Reject",
    reviewed: "Review recorded.",
    releaseReason: "Reason to release",
    pickMember: "Pick at least one person.",
    done: "Done.",
    untitled: "Untitled task",
    status: {
      ASSIGNED: "Assigned",
      ACKNOWLEDGED: "Acknowledged",
      IN_PROGRESS: "In progress",
      BLOCKED: "Blocked",
      SUBMITTED: "Submitted",
      RELEASED: "Released"
    } as Record<string, string>
  }
} as const;

export default function MyCrewPage() {
  const { language } = useLanguage();
  const c = COPY[language];
  const [crews, setCrews] = useState<SupervisedCrewView[]>([]);
  const [crewId, setCrewId] = useState("");
  const [members, setMembers] = useState<string[]>([]);
  const [picked, setPicked] = useState<string[]>([]);
  const [taskId, setTaskId] = useState("");
  const [tasks, setTasks] = useState<CrewTaskView[]>([]);
  const [newTitle, setNewTitle] = useState("");
  const [reason, setReason] = useState("");
  const [releaseReason, setReleaseReason] = useState("");
  const [trades, setTrades] = useState<Record<string, string>>({});
  const [allocations, setAllocations] = useState<TaskAllocationView[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const describe = useCallback(
    (error: unknown) => (error instanceof SemseApiError && error.status === 404 ? c.unavailable : String((error as Error).message)),
    [c.unavailable]
  );

  useEffect(() => {
    void (async () => {
      try {
        const mine = await fetchMyCrews();
        setCrews(mine);
        if (mine[0]) setCrewId(mine[0].crewId);
      } catch (error) {
        setMessage(describe(error));
      }
    })();
  }, [describe]);

  useEffect(() => {
    if (!crewId) return;
    setPicked([]);
    setAllocations([]);
    void (async () => {
      try {
        const roster = await fetchCrewRoster(crewId);
        setMembers(roster.members.map((m) => m.userId));
        setTasks(await fetchCrewTasks(crewId));
        setTaskId("");
      } catch (error) {
        setMessage(describe(error));
      }
    })();
  }, [crewId, describe]);

  const loadAllocations = useCallback(async () => {
    if (!crewId || !taskId.trim()) return;
    try {
      setAllocations(await fetchTaskAllocations(crewId, taskId.trim()));
      setMessage(null);
    } catch (error) {
      setMessage(describe(error));
    }
  }, [crewId, taskId, describe]);

  async function run(action: () => Promise<void>) {
    setBusy(true);
    try {
      await action();
      await loadAllocations();
    } catch (error) {
      setMessage(describe(error));
    } finally {
      setBusy(false);
    }
  }

  function toggle(userId: string) {
    setPicked((current) => (current.includes(userId) ? current.filter((id) => id !== userId) : [...current, userId]));
  }

  return (
    <main style={{ maxWidth: 720, margin: "0 auto", padding: 16, display: "grid", gap: 16 }}>
      <h1>{c.title}</h1>
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
            {c.taskId}
            <select value={taskId} onChange={(event) => setTaskId(event.target.value)} style={{ width: "100%", minHeight: 44 }}>
              <option value="">{c.pickTask}</option>
              {tasks.map((task) => (
                <option key={task.taskId} value={task.taskId}>
                  {task.title}
                </option>
              ))}
            </select>
          </label>
          <span style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "end" }}>
            <label style={{ flex: "1 1 220px" }}>
              {c.newTaskTitle}
              <input value={newTitle} maxLength={200} onChange={(event) => setNewTitle(event.target.value)} style={{ width: "100%", minHeight: 44 }} />
            </label>
            <button
              disabled={busy || newTitle.trim().length < 2}
              style={{ minHeight: 44 }}
              onClick={() => {
                setBusy(true);
                void (async () => {
                  try {
                    const created = await createCrewTask(crewId, { title: newTitle.trim() });
                    setTasks(await fetchCrewTasks(crewId));
                    setTaskId(created.taskId);
                    setNewTitle("");
                    setMessage(c.created);
                  } catch (error) {
                    setMessage(describe(error));
                  } finally {
                    setBusy(false);
                  }
                })();
              }}
            >
              {c.createTask}
            </button>
          </span>
          <fieldset style={{ display: "grid", gap: 4 }}>
            <legend>{c.members}</legend>
            {members.map((userId) => (
              <label key={userId} style={{ display: "flex", gap: 8, alignItems: "center", minHeight: 44 }}>
                <input type="checkbox" checked={picked.includes(userId)} onChange={() => toggle(userId)} />
                {userId}
              </label>
            ))}
          </fieldset>
          <label>
            {c.reason}
            <input value={reason} maxLength={500} onChange={(event) => setReason(event.target.value)} style={{ width: "100%", minHeight: 44 }} />
          </label>
          <span style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              disabled={busy || !taskId.trim()}
              style={{ minHeight: 44 }}
              onClick={() => {
                if (picked.length === 0) {
                  setMessage(c.pickMember);
                  return;
                }
                void run(async () => {
                  await assignTaskToCrewMembers(crewId, taskId.trim(), picked, reason.trim() || undefined);
                  setMessage(c.done);
                });
              }}
            >
              {c.assign}
            </button>
            <button disabled={busy || !taskId.trim()} style={{ minHeight: 44 }} onClick={() => void loadAllocations()}>
              {c.load}
            </button>
          </span>
          {allocations.length === 0 ? (
            <p>{c.none}</p>
          ) : (
            <>
              <input
                aria-label={c.releaseReason}
                placeholder={c.releaseReason}
                maxLength={500}
                value={releaseReason}
                onChange={(event) => setReleaseReason(event.target.value)}
                style={{ width: "100%", minHeight: 44 }}
              />
              <ul style={{ listStyle: "none", padding: 0, display: "grid", gap: 8 }}>
                {allocations.map((item) => (
                  <li key={item.allocationId} style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                    <span style={{ flex: "1 1 220px" }}>
                      {item.taskTitle ?? c.untitled} · {item.userId}
                    </span>
                    <span>{c.status[item.status] ?? item.status}</span>
                    {item.status !== "RELEASED" ? (
                      <button
                        disabled={busy || releaseReason.trim().length < 3}
                        style={{ minHeight: 44 }}
                        onClick={() => void run(async () => void (await releaseTaskAllocation(crewId, item.taskId, item.userId, releaseReason.trim())))}
                      >
                        {c.release}
                      </button>
                    ) : null}
                    {item.status === "SUBMITTED" ? (
                      <span style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", flexBasis: "100%" }}>
                        <input
                          aria-label={c.tradeLabel}
                          placeholder={c.tradeLabel}
                          maxLength={40}
                          value={trades[item.allocationId] ?? ""}
                          onChange={(event) => setTrades((current) => ({ ...current, [item.allocationId]: event.target.value }))}
                          style={{ flex: "1 1 160px", minHeight: 44 }}
                        />
                        <button
                          disabled={busy || (trades[item.allocationId] ?? "").trim().length < 2}
                          style={{ minHeight: 44 }}
                          onClick={() =>
                            void run(async () => {
                              await reviewAllocationSkill(item.allocationId, { decision: "CONFIRM", trade: (trades[item.allocationId] ?? "").trim() });
                              setMessage(c.reviewed);
                            })
                          }
                        >
                          {c.confirmWork}
                        </button>
                        <button
                          disabled={busy}
                          style={{ minHeight: 44 }}
                          onClick={() =>
                            void run(async () => {
                              await reviewAllocationSkill(item.allocationId, { decision: "REJECT" });
                              setMessage(c.reviewed);
                            })
                          }
                        >
                          {c.rejectWork}
                        </button>
                      </span>
                    ) : null}
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      )}
    </main>
  );
}
