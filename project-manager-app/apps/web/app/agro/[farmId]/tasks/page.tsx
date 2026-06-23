"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

interface Task {
  id: string;
  title: string;
  type: string;
  status: string;
  priority: string;
  dueAt?: string;
  assignedToId?: string;
  blockReason?: string;
}

const STATUS_STYLES: Record<string, string> = {
  PENDING:     "bg-gray-100 text-gray-600",
  IN_PROGRESS: "bg-blue-100 text-blue-700",
  COMPLETED:   "bg-green-100 text-green-700",
  BLOCKED:     "bg-red-100 text-red-700",
  CANCELLED:   "bg-gray-100 text-gray-400",
};

const PRIORITY_STYLES: Record<string, string> = {
  LOW:    "text-gray-400",
  MEDIUM: "text-blue-500",
  HIGH:   "text-amber-500",
  URGENT: "text-red-600 font-semibold",
};

export default function TasksPage() {
  const { farmId } = useParams<{ farmId: string }>();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>("ALL");

  useEffect(() => {
    if (!farmId) return;
    void load();
  }, [farmId]);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/semse/agro/farms/${farmId}/tasks`);
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message ?? "Error");
      setTasks((json.data as any)?.tasks ?? []);
    } catch (err: any) {
      setError(err?.message ?? "Error cargando tareas");
    } finally {
      setLoading(false);
    }
  }

  const filtered = filter === "ALL" ? tasks : tasks.filter((t) => t.status === filter);

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <nav className="mb-6 flex items-center gap-2 text-xs text-[var(--muted)]">
        <Link href="/agro" className="hover:text-[var(--accent)]">Agro</Link>
        <span>/</span>
        <Link href={`/agro/${farmId}`} className="hover:text-[var(--accent)]">Finca</Link>
        <span>/</span>
        <span className="text-[var(--ink)]">Tareas</span>
      </nav>

      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-[var(--ink)]">Tareas operativas</h1>
      </div>

      <div className="mb-4 flex flex-wrap gap-1">
        {["ALL", "PENDING", "IN_PROGRESS", "BLOCKED", "COMPLETED", "CANCELLED"].map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
              filter === s ? "bg-[var(--accent)] text-white" : "text-[var(--muted)] hover:bg-[var(--surface)]"
            }`}
          >
            {s === "ALL" ? "Todas" : s}
          </button>
        ))}
      </div>

      {error && <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      {loading ? (
        <div className="text-sm text-[var(--muted)]">Cargando...</div>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-[var(--muted)]">No hay tareas con este filtro.</p>
      ) : (
        <div className="space-y-2">
          {filtered.map((task) => (
            <div key={task.id} className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-medium text-[var(--ink)]">{task.title}</p>
                  <p className="mt-0.5 text-xs text-[var(--muted)]">
                    {task.type}
                    {task.dueAt && ` · vence ${new Date(task.dueAt).toLocaleDateString("es-MX")}`}
                    {task.blockReason && ` · bloqueado: ${task.blockReason}`}
                  </p>
                </div>
                <div className="flex flex-shrink-0 items-center gap-2">
                  <span className={`text-xs ${PRIORITY_STYLES[task.priority] ?? ""}`}>{task.priority}</span>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[task.status] ?? ""}`}>
                    {task.status}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
