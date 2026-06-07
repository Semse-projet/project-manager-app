"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useLanguage } from "../../../../../lib/language-context";
import { ArrowLeft, BadgeCheck, CheckSquare } from "lucide-react";
import { Badge, Card } from "@/components/ui";
import { buildOpsTaskPriorityLabel, buildOpsTaskStatusLabel } from "../../../../lib/buildops-i18n";
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
  const { t } = useLanguage();
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
      setError(err instanceof Error ? err.message : t("common.serverError"));
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
            {t("buildops.backToTasks")}
          </Link>
          <Badge variant="brand">BuildOps</Badge>
        </div>

        <section className="grid gap-2">
          <div className="flex items-center gap-2">
            <CheckSquare size={18} className="text-brand" />
            <h1 className="text-3xl font-bold tracking-tight text-ink">{t("buildops.newTask")}</h1>
          </div>
          <p className="max-w-3xl text-sm text-muted">
            {t("buildops.newTaskIntro")}
          </p>
          {projectIdFromQuery ? <p className="text-sm text-muted">{t("buildops.projectContext")}: {projectIdFromQuery}</p> : null}
          {error ? <p className="text-sm text-red-400">{error}</p> : null}
        </section>

        <Card className="grid gap-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Field label={t("buildops.title")}>
              <input className={inputClass} value={input.title} onChange={(event) => setInput({ ...input, title: event.target.value })} />
            </Field>
            <Field label={t("buildops.projectIdLabel")}>
              <input className={inputClass} value={input.projectId} onChange={(event) => setInput({ ...input, projectId: event.target.value })} />
            </Field>
            <Field label={t("buildops.assigneeName")}>
              <input className={inputClass} value={input.assigneeName} onChange={(event) => setInput({ ...input, assigneeName: event.target.value })} />
            </Field>
            <Field label={t("buildops.assigneeUserId")}>
              <input className={inputClass} value={input.assigneeUserId} onChange={(event) => setInput({ ...input, assigneeUserId: event.target.value })} />
            </Field>
            <Field label={t("buildops.statusLabel")}>
              <select className={inputClass} value={input.status} onChange={(event) => setInput({ ...input, status: event.target.value as BuildOpsTaskStatus })}>
                <option value="todo">{buildOpsTaskStatusLabel(t, "todo")}</option>
                <option value="in_progress">{buildOpsTaskStatusLabel(t, "in_progress")}</option>
                <option value="blocked">{buildOpsTaskStatusLabel(t, "blocked")}</option>
                <option value="done">{buildOpsTaskStatusLabel(t, "done")}</option>
                <option value="canceled">{buildOpsTaskStatusLabel(t, "canceled")}</option>
              </select>
            </Field>
            <Field label={t("buildops.priority")}>
              <select className={inputClass} value={input.priority} onChange={(event) => setInput({ ...input, priority: event.target.value as BuildOpsTaskPriority })}>
                <option value="low">{buildOpsTaskPriorityLabel(t, "low")}</option>
                <option value="medium">{buildOpsTaskPriorityLabel(t, "medium")}</option>
                <option value="high">{buildOpsTaskPriorityLabel(t, "high")}</option>
                <option value="urgent">{buildOpsTaskPriorityLabel(t, "urgent")}</option>
              </select>
            </Field>
            <Field label={t("buildops.dueDate")}>
              <input className={inputClass} type="date" value={input.dueDate} onChange={(event) => setInput({ ...input, dueDate: event.target.value })} />
            </Field>
            <Field label={t("buildops.sourceToolLabel")}>
              <input className={inputClass} value={input.sourceTool} onChange={(event) => setInput({ ...input, sourceTool: event.target.value })} />
            </Field>
          </div>

          <Field label={t("buildops.description")}>
            <textarea className={`${inputClass} min-h-[120px]`} value={input.description} onChange={(event) => setInput({ ...input, description: event.target.value })} />
          </Field>

          <div className="flex items-center gap-3">
            <button onClick={() => void handleSave()} disabled={saving || !input.title.trim()} className="inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-[#0a0a14] transition-all hover:bg-brand-bright disabled:opacity-60">
              <BadgeCheck size={16} />
              {saving ? t("buildops.savingTask") : t("buildops.saveTask")}
            </button>
            <span className="text-sm text-muted">{t("buildops.savedTaskPrisma")}</span>
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
