"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, BadgeCheck, CheckSquare } from "lucide-react";
import { Badge, Card } from "@/components/ui";
import { createBuildOpsTask, type BuildOpsTaskPriority, type BuildOpsTaskStatus } from "../../../../lib/buildops-api";

type TaskInput = {
  title: string;
  description: string;
  projectId: string;
  assigneeName: string;
  assigneeUserId: string;
  dueDate: string;
  status: BuildOpsTaskStatus;
  priority: BuildOpsTaskPriority;
  sourceTool: string;
};

const INITIAL_INPUT: TaskInput = {
  title: "",
  description: "",
  projectId: "",
  assigneeName: "",
  assigneeUserId: "",
  dueDate: "",
  status: "todo",
  priority: "medium",
  sourceTool: "",
};

export default function NewBuildOpsTaskPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const projectIdFromQuery = searchParams?.get("projectId") ?? "";
  const [input, setInput] = useState<TaskInput>({
    ...INITIAL_INPUT,
    projectId: projectIdFromQuery,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setSaving(true);
    setError(null);

    try {
      const task = await createBuildOpsTask({
        title: input.title,
        description: input.description || undefined,
        projectId: input.projectId || undefined,
        assigneeName: input.assigneeName || undefined,
        assigneeUserId: input.assigneeUserId || undefined,
        dueDate: input.dueDate || undefined,
        status: input.status,
        priority: input.priority,
        sourceTool: input.sourceTool || undefined,
      });
      router.push(`/buildops/tasks/${task.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar la tarea.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6">
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
            <h1 className="text-3xl font-bold tracking-tight text-ink">New task</h1>
          </div>
          <p className="max-w-3xl text-sm text-muted">
            Create a BuildOps task for execution, due dates, assignment and project tracking.
          </p>
          {projectIdFromQuery ? <p className="text-sm text-muted">Project context: {projectIdFromQuery}</p> : null}
          {error ? <p className="text-sm text-red-400">{error}</p> : null}
        </section>

        <Card className="grid gap-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Title">
              <input className={inputClass} value={input.title} onChange={(event) => setInput({ ...input, title: event.target.value })} />
            </Field>
            <Field label="Project ID">
              <input className={inputClass} value={input.projectId} onChange={(event) => setInput({ ...input, projectId: event.target.value })} />
            </Field>
            <Field label="Assignee name">
              <input className={inputClass} value={input.assigneeName} onChange={(event) => setInput({ ...input, assigneeName: event.target.value })} />
            </Field>
            <Field label="Assignee user ID">
              <input className={inputClass} value={input.assigneeUserId} onChange={(event) => setInput({ ...input, assigneeUserId: event.target.value })} />
            </Field>
            <Field label="Status">
              <select className={inputClass} value={input.status} onChange={(event) => setInput({ ...input, status: event.target.value as BuildOpsTaskStatus })}>
                <option value="todo">Todo</option>
                <option value="in_progress">In progress</option>
                <option value="blocked">Blocked</option>
                <option value="done">Done</option>
                <option value="canceled">Canceled</option>
              </select>
            </Field>
            <Field label="Priority">
              <select className={inputClass} value={input.priority} onChange={(event) => setInput({ ...input, priority: event.target.value as BuildOpsTaskPriority })}>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </Field>
            <Field label="Due date">
              <input className={inputClass} type="date" value={input.dueDate} onChange={(event) => setInput({ ...input, dueDate: event.target.value })} />
            </Field>
            <Field label="Source tool">
              <input className={inputClass} value={input.sourceTool} onChange={(event) => setInput({ ...input, sourceTool: event.target.value })} />
            </Field>
          </div>

          <Field label="Description">
            <textarea className={`${inputClass} min-h-[120px]`} value={input.description} onChange={(event) => setInput({ ...input, description: event.target.value })} />
          </Field>

          <div className="flex items-center gap-3">
            <button onClick={() => void handleSave()} disabled={saving || !input.title.trim()} className="inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-[#0a0a14] transition-all hover:bg-brand-bright disabled:opacity-60">
              <BadgeCheck size={16} />
              {saving ? "Saving..." : "Save task"}
            </button>
            <span className="text-sm text-muted">Saved to Prisma as a BuildOps task.</span>
          </div>
        </Card>
      </div>
    </main>
  );
}

const inputClass = "rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-sm text-ink outline-none focus:border-brand/40";

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="grid gap-2 text-sm text-muted">
      <span className="font-medium text-ink">{label}</span>
      {children}
    </label>
  );
}
