"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, CheckSquare, Clock3, Plus } from "lucide-react";
import { Badge, Card } from "@/components/ui";
import { fetchBuildOpsTasks, type BuildOpsTask } from "../../../lib/buildops-api";

const emptyTasks: BuildOpsTask[] = [];

export default function BuildOpsTasksPage() {
  const [tasks, setTasks] = useState<BuildOpsTask[]>(emptyTasks);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;

    async function load() {
      try {
        const data = await fetchBuildOpsTasks();
        if (!alive) return;
        setTasks(data);
      } catch (err) {
        if (!alive) return;
        setError(err instanceof Error ? err.message : "BuildOps error");
      } finally {
        if (alive) setLoading(false);
      }
    }

    void load();

    return () => {
      alive = false;
    };
  }, []);

  const openCount = tasks.filter((task) => ["todo", "in_progress", "blocked"].includes(task.status)).length;
  const doneCount = tasks.filter((task) => task.status === "done").length;

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
      <div className="grid gap-6">
        <section className="flex items-start justify-between gap-4">
          <div className="grid gap-2">
            <Badge variant="brand" className="w-fit">BuildOps</Badge>
            <h1 className="text-3xl font-bold tracking-tight text-ink">Tasks</h1>
            <p className="max-w-3xl text-sm text-muted">
              Task layer for field execution. Link tasks to projects, assign owners and track due dates.
            </p>
            <div className="flex flex-wrap gap-2 pt-1 text-sm text-muted">
              <span className="inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1">
                <CheckSquare size={14} />
                Open {openCount}
              </span>
              <span className="inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1">
                <Clock3 size={14} />
                Done {doneCount}
              </span>
            </div>
            {error ? <p className="text-sm text-red-400">{error}</p> : null}
            {loading ? <p className="text-sm text-muted">Loading tasks...</p> : null}
          </div>
          <Link href="/buildops/tasks/new" className="inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-[#0a0a14] transition-all hover:bg-brand-bright">
            <Plus size={16} />
            New task
          </Link>
        </section>

        <div className="grid gap-3">
          {tasks.length === 0 ? (
            <Card className="grid gap-2 text-sm text-muted">
              <div className="text-ink font-semibold">No tasks yet</div>
              <div>Create a BuildOps task to coordinate execution, due dates and accountability.</div>
            </Card>
          ) : null}
          {tasks.map((task) => (
            <Card key={task.id} className="grid gap-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="grid gap-1">
                  <div className="flex items-center gap-2">
                    <CheckSquare size={16} className="text-brand" />
                    <h2 className="text-lg font-semibold text-ink">{task.title}</h2>
                  </div>
                  <p className="text-sm text-muted">{task.description ?? "No description"}</p>
                  <p className="text-xs text-muted">
                    {task.projectTitle ? `${task.projectTitle} · ` : ""}
                    {task.assigneeName ?? "Unassigned"}
                    {task.dueDate ? ` · Due ${new Date(task.dueDate).toLocaleDateString()}` : ""}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={task.priority === "urgent" ? "warn" : task.priority === "high" ? "info" : "default"}>{task.priority}</Badge>
                  <Badge variant={task.status === "done" ? "brand" : task.status === "blocked" ? "warn" : "info"}>{task.status}</Badge>
                </div>
              </div>
              <div className="flex items-center justify-between border-t border-white/[0.06] pt-3 text-sm text-muted">
                <span>{task.id}</span>
                <Link href={`/buildops/tasks/${task.id}`} className="inline-flex items-center gap-2 text-brand">
                  Open <ArrowRight size={14} />
                </Link>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </main>
  );
}
