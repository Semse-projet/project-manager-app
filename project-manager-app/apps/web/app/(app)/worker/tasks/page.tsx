"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { CheckSquare, Clock, AlertCircle, RefreshCw, Inbox } from "lucide-react";
import { HtmlInCanvasPanel, StatCard, StatusBadge } from "@semse/ui";
import { fetchTasks, updateTaskStatus, fetchJobs } from "../../../semse-api";
import { NotificationBanner } from "../../../components/notifications/NotificationBanner";

type TaskStatus = "pending" | "in_progress" | "done" | "blocked";
type TaskPriority = "high" | "medium" | "low";

interface WorkerTask {
  id: string;
  title: string;
  jobTitle: string;
  jobId: string;
  milestone: string;
  dueDate: string;
  priority: TaskPriority;
  status: TaskStatus;
}

const STATUS_MAP: Record<TaskStatus, { variant: "success" | "warning" | "info" | "neutral" | "error"; label: string }> = {
  pending:     { variant: "warning", label: "Pendiente"   },
  in_progress: { variant: "info",    label: "En progreso" },
  done:        { variant: "success", label: "Completada"  },
  blocked:     { variant: "error",   label: "Bloqueada"   },
};

const PRIORITY_COLOR: Record<TaskPriority, string> = {
  high:   "#ef4444",
  medium: "#fbbf24",
  low:    "#6b7280",
};

const NEXT_STATUS: Partial<Record<TaskStatus, TaskStatus>> = {
  pending:     "in_progress",
  in_progress: "done",
  blocked:     "pending",
};

function rawToTask(t: Record<string, unknown>, jobTitleMap: Record<string, string>): WorkerTask {
  const jobId = String(t.jobId ?? "");
  return {
    id:        String(t.id ?? ""),
    title:     String(t.title ?? t.name ?? "Tarea"),
    jobTitle:  jobTitleMap[jobId] ?? String(t.jobTitle ?? jobId),
    jobId,
    milestone: String(t.milestoneTitle ?? t.milestone ?? t.milestoneId ?? ""),
    dueDate:   typeof t.dueDate === "string" ? t.dueDate.slice(0, 10) : (typeof t.due === "string" ? t.due.slice(0, 10) : ""),
    priority:  (["high", "medium", "low"].includes(String(t.priority)) ? t.priority : "medium") as TaskPriority,
    status:    (["pending", "in_progress", "done", "blocked"].includes(String(t.status)) ? t.status : "pending") as TaskStatus,
  };
}

export default function WorkerTasksPage() {
  const [tasks, setTasks]     = useState<WorkerTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter]   = useState<"all" | "pending" | "done">("all");
  const [updating, setUpdating] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [rawTasks, jobs] = await Promise.all([
        fetchTasks().catch(() => [] as Record<string, unknown>[]),
        fetchJobs().catch(() => []),
      ]);
      const jobTitleMap: Record<string, string> = {};
      for (const j of jobs) jobTitleMap[j.id] = j.title;
      setTasks(rawTasks.map(t => rawToTask(t, jobTitleMap)));
    } catch { /* keep empty */ }
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function handleAdvance(task: WorkerTask) {
    const next = NEXT_STATUS[task.status];
    if (!next || updating) return;
    setUpdating(task.id);
    try {
      await updateTaskStatus(task.id, next);
      setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: next } : t));
    } catch { /* keep */ }
    setUpdating(null);
  }

  const pending   = tasks.filter(t => t.status === "pending").length;
  const inProgress = tasks.filter(t => t.status === "in_progress").length;
  const done      = tasks.filter(t => t.status === "done").length;
  const blocked   = tasks.filter(t => t.status === "blocked").length;

  const filtered = tasks.filter(t =>
    filter === "all"     ? true :
    filter === "pending" ? ["pending", "in_progress", "blocked"].includes(t.status) :
    t.status === "done"
  );

  const card: React.CSSProperties = {
    background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "12px",
  };

  return (
    <div style={{ maxWidth: "860px", margin: "0 auto" }}>
      {/* Header */}
      <HtmlInCanvasPanel as="section" style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: "24px", flexWrap: "wrap" }} canvasClassName="rounded-2xl" minHeight={82}>
        <div>
          <Link href="/worker/dashboard" style={{ display: "inline-flex", alignItems: "center", gap: "5px", color: "var(--muted)", fontSize: "12px", fontWeight: 600, textDecoration: "none", marginBottom: "8px" }}>
            <span style={{ fontSize: "14px" }}>←</span> Dashboard
          </Link>
          <h1 style={{ fontSize: "22px", fontWeight: 800, color: "var(--ink)", marginBottom: "4px" }}>Mis tareas</h1>
          <p style={{ fontSize: "13px", color: "var(--muted)" }}>Tareas de milestone asignadas en tus trabajos activos</p>
        </div>
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <NotificationBanner audience="worker" />
          <button
            onClick={() => void load()}
            disabled={loading}
            style={{ padding: "8px", borderRadius: "8px", border: "1px solid var(--border)", background: "var(--surface)", color: "var(--muted)", cursor: "pointer", display: "flex" }}
            title="Recargar"
          >
            <RefreshCw size={15} style={{ animation: loading ? "spin 1s linear infinite" : "none" }} />
          </button>
        </div>
      </HtmlInCanvasPanel>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: "12px", marginBottom: "24px" }}>
        <StatCard label="Pendientes"   value={pending}    icon={Clock}        color="amber"  loading={loading} />
        <StatCard label="En progreso"  value={inProgress} icon={CheckSquare}  color="blue"   loading={loading} />
        <StatCard label="Completadas"  value={done}       icon={CheckSquare}  color="green"  loading={loading} />
        <StatCard label="Bloqueadas"   value={blocked}    icon={AlertCircle}  color="red"    loading={loading} />
      </div>

      {/* Filter tabs */}
      <HtmlInCanvasPanel as="div" style={{ display: "flex", gap: "4px", background: "var(--surface)", padding: "4px", borderRadius: "10px", border: "1px solid var(--border)", marginBottom: "16px", width: "fit-content" }} canvasClassName="rounded-2xl" minHeight={46}>
        {(["all", "pending", "done"] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{
            padding: "6px 14px", borderRadius: "7px", border: "none",
            background: filter === f ? "var(--brand)" : "transparent",
            color: filter === f ? "#fff" : "var(--muted)",
            fontSize: "13px", fontWeight: 600, cursor: "pointer",
          }}>
            {f === "all" ? "Todas" : f === "pending" ? "Pendientes" : "Completadas"}
          </button>
        ))}
      </HtmlInCanvasPanel>

      {/* List */}
      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {[1,2,3].map(i => <div key={i} style={{ height: "72px", borderRadius: "12px", background: "var(--raised)", animation: "pulse 1.5s ease-in-out infinite" }} />)}
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ ...card, padding: "48px 24px", textAlign: "center" }}>
          <Inbox size={36} style={{ color: "var(--faint)", margin: "0 auto 12px" }} />
          <p style={{ fontSize: "14px", fontWeight: 700, color: "var(--ink)" }}>No hay tareas en esta vista</p>
          <p style={{ fontSize: "12px", color: "var(--muted)", marginTop: "6px" }}>
            {tasks.length === 0 ? "Las tareas aparecen cuando un cliente asigna un milestone." : "Cambia el filtro para ver otras tareas."}
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {filtered.map(task => {
            const s = STATUS_MAP[task.status];
            const overdue = task.status !== "done" && task.dueDate && new Date(task.dueDate) < new Date();
            const next = NEXT_STATUS[task.status];
            const isUpdating = updating === task.id;
            return (
              <div key={task.id} style={{ ...card, display: "flex", alignItems: "center", gap: "14px", padding: "14px 16px" }}>
                <div style={{ width: "4px", height: "44px", borderRadius: "4px", background: PRIORITY_COLOR[task.priority], flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: "13px", fontWeight: 700, color: "var(--ink)", marginBottom: "2px" }}>{task.title}</p>
                  <p style={{ fontSize: "11px", color: "var(--muted)" }}>
                    {task.jobTitle ? task.jobTitle : task.jobId}
                    {task.milestone ? ` · ${task.milestone}` : ""}
                  </p>
                  {task.dueDate && (
                    <p style={{ fontSize: "11px", color: overdue ? "#ef4444" : "var(--faint)", marginTop: "2px", display: "flex", alignItems: "center", gap: "4px" }}>
                      {overdue && <AlertCircle size={10} />}
                      <Clock size={10} /> {task.dueDate}
                      {overdue && " · VENCIDA"}
                    </p>
                  )}
                </div>
                <StatusBadge variant={s.variant} text={s.label} size="sm" />
                {next && (
                  <button
                    onClick={() => void handleAdvance(task)}
                    disabled={isUpdating}
                    style={{ padding: "6px 12px", borderRadius: "8px", border: "1px solid var(--border)", background: "var(--bg)", color: "var(--ink)", fontSize: "11px", fontWeight: 700, cursor: "pointer", flexShrink: 0, opacity: isUpdating ? 0.6 : 1 }}
                  >
                    {isUpdating ? "…" : task.status === "pending" ? "Iniciar" : task.status === "in_progress" ? "Completar" : "Desbloquear"}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
