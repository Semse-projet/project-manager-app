"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ClipboardList, Eye, HardHat, Inbox, ListChecks, Plus, ThumbsDown, ThumbsUp, Undo2, UserPlus, Users } from "lucide-react";
import { useLanguage } from "../../../../lib/language-context";
import { buildCrewRoomTaskTitle } from "../../../../lib/crew-room-task-title";
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
  shortId,
  touchInputStyle,
  type Notice,
  type Tone
} from "../../../../components/module-surface/ui";

const STATUS_TONE: Record<string, Tone> = {
  ASSIGNED: "brand",
  ACKNOWLEDGED: "signal",
  IN_PROGRESS: "warn",
  BLOCKED: "error",
  SUBMITTED: "ok",
  RELEASED: "muted"
};

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
    newTaskTitle: "Trabajo a realizar",
    room: "Habitación o área",
    roomPlaceholder: "Ej. Hab. 205, pasillo norte",
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
    manage: "Gestionar obras",
    taskPanel: "Tarea",
    assignPanel: "Asignar personas",
    allocationsPanel: "Asignaciones de la tarea",
    noMembers: "Esta cuadrilla no tiene personas todavía.",
    pickTaskHint: "Elige una tarea y pulsa «Ver asignaciones».",
    or: "o crea una nueva",
    noCrewHint: "Cuando te nombren supervisor de una cuadrilla, podrás asignar tareas desde aquí.",
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
    newTaskTitle: "Work to be done",
    room: "Room or area",
    roomPlaceholder: "E.g. Room 205, north hallway",
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
    manage: "Manage worksites",
    taskPanel: "Task",
    assignPanel: "Assign people",
    allocationsPanel: "Task assignments",
    noMembers: "This crew has no people yet.",
    pickTaskHint: "Pick a task and press “View assignments”.",
    or: "or create a new one",
    noCrewHint: "Once you are named supervisor of a crew, you can assign tasks from here.",
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
  const [room, setRoom] = useState("");
  const [reason, setReason] = useState("");
  const [releaseReason, setReleaseReason] = useState("");
  const [trades, setTrades] = useState<Record<string, string>>({});
  const [allocations, setAllocations] = useState<TaskAllocationView[]>([]);
  const [notice, setNotice] = useState<Notice>(null);
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
        setNotice({ tone: "error", text: describe(error) });
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
        setNotice({ tone: "error", text: describe(error) });
      }
    })();
  }, [crewId, describe]);

  const loadAllocations = useCallback(async () => {
    if (!crewId || !taskId.trim()) return;
    try {
      setAllocations(await fetchTaskAllocations(crewId, taskId.trim()));
      setNotice(null);
    } catch (error) {
      setNotice({ tone: "error", text: describe(error) });
    }
  }, [crewId, taskId, describe]);

  async function run(action: () => Promise<void>) {
    setBusy(true);
    try {
      await action();
      await loadAllocations();
    } catch (error) {
      setNotice({ tone: "error", text: describe(error) });
    } finally {
      setBusy(false);
    }
  }

  function toggle(userId: string) {
    setPicked((current) => (current.includes(userId) ? current.filter((id) => id !== userId) : [...current, userId]));
  }

  function createTask() {
    const title = buildCrewRoomTaskTitle(room, newTitle);
    if (!title) return;
    setBusy(true);
    void (async () => {
      try {
        const created = await createCrewTask(crewId, { title });
        setTasks(await fetchCrewTasks(crewId));
        setTaskId(created.taskId);
        setNewTitle("");
        setRoom("");
        setNotice({ tone: "ok", text: c.created });
      } catch (error) {
        setNotice({ tone: "error", text: describe(error) });
      } finally {
        setBusy(false);
      }
    })();
  }

  return (
    <PageStack maxWidth={860}>
      <PageHeader
        icon={Users}
        tone="ok"
        title={c.title}
        description={c.intro}
        actions={
          <Link
            href="/worker/crews"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "7px 12px",
              borderRadius: 10,
              fontSize: 13,
              fontWeight: 600,
              textDecoration: "none",
              color: "var(--ink)",
              background: "var(--raised)",
              border: "1px solid var(--border)"
            }}
          >
            <HardHat size={14} aria-hidden /> {c.manage}
          </Link>
        }
      />
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
          <Panel title={c.taskPanel} icon={ClipboardList}>
            <div style={{ display: "grid", gap: 14 }}>
              <div style={{ display: "grid", gap: 14, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
                <Field label={c.crew}>
                  <select value={crewId} onChange={(event) => setCrewId(event.target.value)} style={touchInputStyle}>
                    {crews.map((crew) => (
                      <option key={crew.crewId} value={crew.crewId}>
                        {crew.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label={c.taskId}>
                  <select value={taskId} onChange={(event) => setTaskId(event.target.value)} style={touchInputStyle}>
                    <option value="">{c.pickTask}</option>
                    {tasks.map((task) => (
                      <option key={task.taskId} value={task.taskId}>
                        {task.title}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
              <div
                style={{
                  display: "grid",
                  gap: 12,
                  padding: 14,
                  borderRadius: 12,
                  background: "var(--raised)",
                  border: "1px dashed var(--border)"
                }}
              >
                <span style={{ fontSize: 12, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".04em" }}>
                  {c.or}
                </span>
                <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
                  <Field label={c.room}>
                    <input value={room} maxLength={60} placeholder={c.roomPlaceholder} onChange={(event) => setRoom(event.target.value)} style={touchInputStyle} />
                  </Field>
                  <Field label={c.newTaskTitle}>
                    <input value={newTitle} maxLength={130} onChange={(event) => setNewTitle(event.target.value)} style={touchInputStyle} />
                  </Field>
                </div>
                <div>
                  <Button icon={Plus} size="touch" disabled={busy || !crewId || !buildCrewRoomTaskTitle(room, newTitle)} onClick={createTask}>
                    {c.createTask}
                  </Button>
                </div>
              </div>
            </div>
          </Panel>

          <Panel title={c.assignPanel} icon={UserPlus}>
            <div style={{ display: "grid", gap: 14 }}>
              <fieldset style={{ border: "none", margin: 0, padding: 0 }}>
                <legend style={{ fontSize: 12, fontWeight: 700, color: "var(--muted)", marginBottom: 8 }}>{c.members}</legend>
                {members.length === 0 ? (
                  <span style={{ fontSize: 13, color: "var(--faint)" }}>{c.noMembers}</span>
                ) : (
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {members.map((userId) => (
                      <CheckChip key={userId} checked={picked.includes(userId)} onChange={() => toggle(userId)}>
                        <span title={userId}>{shortId(userId, 12)}</span>
                      </CheckChip>
                    ))}
                  </div>
                )}
              </fieldset>
              <Field label={c.reason}>
                <input value={reason} maxLength={500} onChange={(event) => setReason(event.target.value)} style={touchInputStyle} />
              </Field>
              <div style={{ display: "grid", gap: 8, gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))" }}>
                <Button
                  variant="primary"
                  size="touch"
                  icon={UserPlus}
                  disabled={busy || !taskId.trim()}
                  onClick={() => {
                    if (picked.length === 0) {
                      setNotice({ tone: "warn", text: c.pickMember });
                      return;
                    }
                    void run(async () => {
                      await assignTaskToCrewMembers(crewId, taskId.trim(), picked, reason.trim() || undefined);
                      setNotice({ tone: "ok", text: c.done });
                    });
                  }}
                >
                  {c.assign}
                </Button>
                <Button size="touch" icon={Eye} disabled={busy || !taskId.trim()} onClick={() => void loadAllocations()}>
                  {c.load}
                </Button>
              </div>
            </div>
          </Panel>

          <Panel title={c.allocationsPanel} icon={ListChecks} padded={allocations.length === 0}>
            {allocations.length === 0 ? (
              <Empty icon={Inbox} title={c.none} description={c.pickTaskHint} />
            ) : (
              <>
                <div style={{ padding: "14px 16px 0" }}>
                  <input
                    aria-label={c.releaseReason}
                    placeholder={c.releaseReason}
                    maxLength={500}
                    value={releaseReason}
                    onChange={(event) => setReleaseReason(event.target.value)}
                    style={touchInputStyle}
                  />
                </div>
                <List>
                  {allocations.map((item, index) => (
                    <ListRow key={item.allocationId} first={index === 0}>
                      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                        <span style={{ flex: "1 1 220px", minWidth: 0 }}>
                          <strong style={{ display: "block", fontSize: 14, color: "var(--ink)" }}>{item.taskTitle ?? c.untitled}</strong>
                          <span style={{ fontSize: 12, color: "var(--muted)" }} title={item.userId}>
                            {shortId(item.userId, 12)}
                          </span>
                        </span>
                        <Pill tone={STATUS_TONE[item.status] ?? "muted"}>{c.status[item.status] ?? item.status}</Pill>
                        {item.status !== "RELEASED" ? (
                          <Button
                            variant="ghost"
                            size="touch"
                            icon={Undo2}
                            disabled={busy || releaseReason.trim().length < 3}
                            onClick={() => void run(async () => void (await releaseTaskAllocation(crewId, item.taskId, item.userId, releaseReason.trim())))}
                          >
                            {c.release}
                          </Button>
                        ) : null}
                      </div>
                      {item.status === "SUBMITTED" ? (
                        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                          <input
                            aria-label={c.tradeLabel}
                            placeholder={c.tradeLabel}
                            maxLength={40}
                            value={trades[item.allocationId] ?? ""}
                            onChange={(event) => setTrades((current) => ({ ...current, [item.allocationId]: event.target.value }))}
                            style={{ ...touchInputStyle, flex: "1 1 160px", width: "auto" }}
                          />
                          <Button
                            variant="primary"
                            size="touch"
                            icon={ThumbsUp}
                            disabled={busy || (trades[item.allocationId] ?? "").trim().length < 2}
                            onClick={() =>
                              void run(async () => {
                                await reviewAllocationSkill(item.allocationId, { decision: "CONFIRM", trade: (trades[item.allocationId] ?? "").trim() });
                                setNotice({ tone: "ok", text: c.reviewed });
                              })
                            }
                          >
                            {c.confirmWork}
                          </Button>
                          <Button
                            variant="danger"
                            size="touch"
                            icon={ThumbsDown}
                            disabled={busy}
                            onClick={() =>
                              void run(async () => {
                                await reviewAllocationSkill(item.allocationId, { decision: "REJECT" });
                                setNotice({ tone: "ok", text: c.reviewed });
                              })
                            }
                          >
                            {c.rejectWork}
                          </Button>
                        </div>
                      ) : null}
                    </ListRow>
                  ))}
                </List>
              </>
            )}
          </Panel>
        </>
      )}
    </PageStack>
  );
}
