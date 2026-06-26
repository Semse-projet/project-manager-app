"use client";

import { useMemo, useState } from "react";
import { Check, Copy } from "lucide-react";

const DEFAULT_PROMPT = [
  "Project: SEMSEproject",
  "Active area: Admin modular ecosystem",
  "Goal: continue the frontend-safe modular restructure",
  "Constraints: keep legacy routes, do not touch backend, Prisma, or Railway",
  "Next step: implement one small hub or navigation change and validate TypeScript",
].join("\n");

export function ContextBridgePanel({
  project = "SEMSEproject",
  branch = "main",
  deploy = "Production",
  goal = "Modular Admin ecosystem restructure",
  prompt = DEFAULT_PROMPT,
}: {
  project?: string;
  branch?: string;
  deploy?: string;
  goal?: string;
  prompt?: string;
}) {
  const [copied, setCopied] = useState(false);
  const context = useMemo(
    () => [
      `Project: ${project}`,
      `Active branch: ${branch}`,
      `Latest deploy: ${deploy}`,
      `Current goal: ${goal}`,
      "",
      "Suggested prompt:",
      prompt,
    ].join("\n"),
    [branch, deploy, goal, project, prompt]
  );

  async function copyContext() {
    await navigator.clipboard.writeText(context);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  return (
    <aside className="rounded-lg border border-white/[0.08] bg-[#101527] p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-widest text-muted">Context Bridge</h2>
          <p className="mt-2 text-sm leading-6 text-muted">Portable context for external tools and operator handoff.</p>
        </div>
        <button
          type="button"
          onClick={() => void copyContext()}
          className="inline-flex min-h-9 items-center gap-2 rounded-md border border-white/[0.1] bg-white/[0.04] px-3 py-2 text-sm font-semibold text-ink transition hover:border-brand/40"
        >
          {copied ? <Check size={16} /> : <Copy size={16} />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>

      <dl className="mt-5 grid gap-3 text-sm">
        <div className="rounded-md border border-white/[0.07] bg-white/[0.03] p-3">
          <dt className="text-[0.68rem] font-semibold uppercase tracking-widest text-muted">Project</dt>
          <dd className="mt-1 font-medium text-ink">{project}</dd>
        </div>
        <div className="rounded-md border border-white/[0.07] bg-white/[0.03] p-3">
          <dt className="text-[0.68rem] font-semibold uppercase tracking-widest text-muted">Branch</dt>
          <dd className="mt-1 font-medium text-ink">{branch}</dd>
        </div>
        <div className="rounded-md border border-white/[0.07] bg-white/[0.03] p-3">
          <dt className="text-[0.68rem] font-semibold uppercase tracking-widest text-muted">Deploy</dt>
          <dd className="mt-1 font-medium text-ink">{deploy}</dd>
        </div>
        <div className="rounded-md border border-white/[0.07] bg-white/[0.03] p-3">
          <dt className="text-[0.68rem] font-semibold uppercase tracking-widest text-muted">Goal</dt>
          <dd className="mt-1 font-medium text-ink">{goal}</dd>
        </div>
      </dl>
    </aside>
  );
}
