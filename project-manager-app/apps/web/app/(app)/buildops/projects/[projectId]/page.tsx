"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { ArrowLeft, CheckSquare, FileText, FolderKanban, MessageSquare, Plus } from "lucide-react";
import { Badge, Card } from "@/components/ui";
import { fetchBuildOpsProject, type BuildOpsProject } from "../../../../lib/buildops-api";

const fallbackProject: BuildOpsProject = {
  id: "loading",
  tenantId: "",
  orgId: "",
  createdBy: "",
  title: "Loading...",
  description: null,
  trade: "",
  projectType: "",
  clientName: "",
  professionalName: null,
  location: "",
  budgetEstimate: null,
  status: "draft",
  riskScore: 0,
  riskLevel: "low",
  startDate: null,
  dueDate: null,
  sourceTool: null,
  sourceToolInput: null,
  sourceToolResult: null,
  completion: 0,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

export default function BuildOpsProjectDetailPage() {
  const params = useParams<{ projectId: string }>();
  const projectId = typeof params?.projectId === "string" ? params.projectId : "";
  const [project, setProject] = useState<BuildOpsProject>(fallbackProject);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;

    async function load() {
      try {
        const data = await fetchBuildOpsProject(projectId);
        if (!alive) return;
        setProject(data);
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
  }, [projectId]);

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
      <div className="grid gap-6">
        <div className="flex items-center justify-between gap-3">
          <Link href="/buildops/projects" className="inline-flex items-center gap-2 text-sm text-muted hover:text-ink">
            <ArrowLeft size={16} />
            Back to projects
          </Link>
          <Badge variant="brand">BuildOps</Badge>
        </div>

        <section className="grid gap-2">
          <div className="flex items-center gap-2">
            <FolderKanban size={18} className="text-brand" />
            <h1 className="text-3xl font-bold tracking-tight text-ink">{project.title}</h1>
          </div>
          <p className="max-w-3xl text-sm text-muted">
            Shell detail page. Later this will connect to tasks, evidence and reports.
          </p>
          {error ? <p className="text-sm text-red-400">{error}</p> : null}
          {loading ? <p className="text-sm text-muted">Loading project...</p> : null}
        </section>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {[
            { label: "Trade", value: project.trade },
            { label: "Status", value: project.status },
            { label: "Budget", value: project.budgetEstimate != null ? `$${project.budgetEstimate.toLocaleString()}` : "—" },
            { label: "Risk score", value: `${project.riskScore}/100` },
          ].map((item) => (
            <Card key={item.label} className="grid gap-2">
              <div className="text-xs uppercase tracking-[0.2em] text-muted">{item.label}</div>
              <div className="text-xl font-bold text-ink">{item.value}</div>
            </Card>
          ))}
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <Card className="grid gap-4 border-brand/20 bg-brand/[0.04]">
            <h2 className="text-lg font-semibold text-ink">Project summary</h2>
            <div className="grid gap-3 text-sm text-muted">
              <div><span className="text-ink font-semibold">Client:</span> {project.clientName}</div>
              <div><span className="text-ink font-semibold">Professional:</span> {project.professionalName ?? "—"}</div>
              <div><span className="text-ink font-semibold">Location:</span> {project.location}</div>
              <div><span className="text-ink font-semibold">Type:</span> {project.projectType}</div>
              <div><span className="text-ink font-semibold">Source tool:</span> {project.sourceTool ?? "manual"}</div>
              <div><span className="text-ink font-semibold">Project ID:</span> {project.id}</div>
            </div>
            <div className="flex flex-wrap gap-2 pt-2">
              <Badge variant="info">{project.completion}% complete</Badge>
              <Badge variant="info">Risk {project.riskLevel}</Badge>
              <Badge variant="info">{project.sourceTool ? "From tool result" : "Manual project"}</Badge>
            </div>
          </Card>

          <Card className="grid gap-4">
            <h2 className="text-lg font-semibold text-ink">Quick actions</h2>
            <div className="grid gap-3">
              <Link href={`/buildops/tasks/new?projectId=${project.id}`} className="inline-flex items-center justify-between rounded-xl border border-brand/20 bg-brand/[0.04] px-4 py-3 text-sm font-semibold text-ink transition-all hover:bg-brand/[0.08]">
                <span className="inline-flex items-center gap-2">
                  <Plus size={16} />
                  Create task
                </span>
                <ArrowLeft size={14} />
              </Link>
              <button disabled className="inline-flex items-center justify-between rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-sm font-semibold text-ink opacity-60">
                <span className="inline-flex items-center gap-2">
                  <FileText size={16} />
                  Add evidence
                </span>
                <ArrowLeft size={14} />
              </button>
              <button disabled className="inline-flex items-center justify-between rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-sm font-semibold text-ink opacity-60">
                <span className="inline-flex items-center gap-2">
                  <CheckSquare size={16} />
                  Approve milestone
                </span>
                <ArrowLeft size={14} />
              </button>
              <button disabled className="inline-flex items-center justify-between rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-sm font-semibold text-ink opacity-60">
                <span className="inline-flex items-center gap-2">
                  <MessageSquare size={16} />
                  Message team
                </span>
                <ArrowLeft size={14} />
              </button>
            </div>
          </Card>
        </div>
      </div>
    </main>
  );
}
