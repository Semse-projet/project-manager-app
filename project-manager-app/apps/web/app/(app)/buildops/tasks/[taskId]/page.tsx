"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { ArrowLeft, CheckSquare, Clock3, FolderKanban } from "lucide-react";
import { Badge, Card } from "@/components/ui";
import { fetchBuildOpsTask, type BuildOpsTask } from "../../../../lib/buildops-api";

const fallbackTask: BuildOpsTask = {
  id: "loading",
  tenantId: "",
  orgId: "",
  projectId: null,
  createdBy: "",
  title: "Loading...",
  description: null,
  status: "todo",
  priority: "medium",
  assigneeName: null,
  assigneeUserId: null,
  dueDate: null,
  completion: 0,
  sourceTool: null,
  evidenceRequired: null,
  projectTitle: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

export default function BuildOpsTaskDetailPage() {
  const params = useParams<{ taskId: string }>();
  const taskId = typeof params?.taskId === "string" ? params.taskId : "";
  const [task, setTask] = useState<BuildOpsTask>(fallbackTask);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;

    async function load() {
      try {
        const data = await fetchBuildOpsTask(taskId);
        if (!alive) return;
        setTask(data);
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
  }, [taskId]);

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
      <div className="grid gap-6">
        <div className="flex items-center justify-between gap-3">
          <Link href="/buildops/tasks" className="inline-flex items-center gap-2 text-sm text-muted hover:text-ink">
            <ArrowLeft size={16} />
            Back to tasks
          </Link>
          <Badge variant="brand">BuildOps</Badge>
        </div>

        <section className="grid gap-2">
          <div className="flex items-center gap-2">
            <CheckSquare size={18} className="text-brand" />
            <h1 className="text-3xl font-bold tracking-tight text-ink">{task.title}</h1>
          </div>
          <p className="max-w-3xl text-sm text-muted">
            Task detail shell. Later this will connect to evidence, logs and milestone linkage.
          </p>
          {error ? <p className="text-sm text-red-400">{error}</p> : null}
          {loading ? <p className="text-sm text-muted">Loading task...</p> : null}
        </section>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {[
            { label: "Status", value: task.status },
            { label: "Priority", value: task.priority },
            { label: "Assignee", value: task.assigneeName ?? "Unassigned" },
            { label: "Due date", value: task.dueDate ? new Date(task.dueDate).toLocaleDateString() : "—" },
          ].map((item) => (
            <Card key={item.label} className="grid gap-2">
              <div className="text-xs uppercase tracking-[0.2em] text-muted">{item.label}</div>
              <div className="text-xl font-bold text-ink">{item.value}</div>
            </Card>
          ))}
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <Card className="grid gap-4 border-brand/20 bg-brand/[0.04]">
            <h2 className="text-lg font-semibold text-ink">Task summary</h2>
            <div className="grid gap-3 text-sm text-muted">
              <div><span className="text-ink font-semibold">Description:</span> {task.description ?? "—"}</div>
              <div><span className="text-ink font-semibold">Project:</span> {task.projectTitle ?? task.projectId ?? "—"}</div>
              <div><span className="text-ink font-semibold">Source tool:</span> {task.sourceTool ?? "manual"}</div>
              <div><span className="text-ink font-semibold">Task ID:</span> {task.id}</div>
            </div>
            <div className="flex flex-wrap gap-2 pt-2">
              <Badge variant="info">{task.completion}% complete</Badge>
              <Badge variant={task.status === "done" ? "brand" : task.status === "blocked" ? "warn" : "info"}>{task.status}</Badge>
              <Badge variant={task.priority === "urgent" ? "warn" : "info"}>{task.priority}</Badge>
            </div>
          </Card>

          <Card className="grid gap-4">
            <h2 className="text-lg font-semibold text-ink">Quick actions</h2>
            <div className="grid gap-3">
              <Link href={`/buildops/tasks/new?projectId=${encodeURIComponent(task.projectId ?? "")}`} className="inline-flex items-center justify-between rounded-xl border border-brand/20 bg-brand/[0.04] px-4 py-3 text-sm font-semibold text-ink transition-all hover:bg-brand/[0.08]">
                <span className="inline-flex items-center gap-2">
                  <Clock3 size={16} />
                  New follow-up task
                </span>
                <ArrowLeft size={14} />
              </Link>
              <Link href="/buildops/projects" className="inline-flex items-center justify-between rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-sm font-semibold text-ink transition-all hover:bg-white/[0.06]">
                <span className="inline-flex items-center gap-2">
                  <FolderKanban size={16} />
                  Open projects
                </span>
                <ArrowLeft size={14} />
              </Link>
            </div>
          </Card>
        </div>
      </div>
    </main>
  );
}
