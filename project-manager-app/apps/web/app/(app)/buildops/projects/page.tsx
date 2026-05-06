"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, FolderKanban, Plus } from "lucide-react";
import { Badge, Card } from "@/components/ui";
import { fetchBuildOpsProjects, type BuildOpsProject } from "../../../lib/buildops-api";

const sampleProjects: BuildOpsProject[] = [];

export default function BuildOpsProjectsPage() {
  const [projects, setProjects] = useState<BuildOpsProject[]>(sampleProjects);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;

    async function load() {
      try {
        const data = await fetchBuildOpsProjects();
        if (!alive) return;
        setProjects(data);
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

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
      <div className="grid gap-6">
        <section className="flex items-start justify-between gap-4">
          <div className="grid gap-2">
            <Badge variant="brand" className="w-fit">
              BuildOps
            </Badge>
            <h1 className="text-3xl font-bold tracking-tight text-ink">Projects</h1>
            <p className="max-w-3xl text-sm text-muted">
              Track active jobs, drafts and quotes. Real BuildOps data comes from Prisma now.
            </p>
            {error ? <p className="text-sm text-red-400">{error}</p> : null}
            {loading ? <p className="text-sm text-muted">Loading projects...</p> : null}
          </div>
          <Link href="/buildops/projects/new" className="inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-[#0a0a14] transition-all hover:bg-brand-bright">
            <Plus size={16} />
            New project
          </Link>
        </section>

        <div className="grid gap-3">
          {projects.length === 0 ? (
            <Card className="grid gap-2 text-sm text-muted">
              <div className="text-ink font-semibold">No projects yet</div>
              <div>Create one from a tool result or start a fresh BuildOps project.</div>
            </Card>
          ) : null}
          {projects.map((project) => (
            <Card key={project.id} className="grid gap-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="grid gap-1">
                  <div className="flex items-center gap-2">
                    <FolderKanban size={16} className="text-brand" />
                    <h2 className="text-lg font-semibold text-ink">{project.title}</h2>
                  </div>
                  <p className="text-sm text-muted">{project.trade}</p>
                  <p className="text-xs text-muted">{project.clientName} · {project.location}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={project.riskLevel === "critical" || project.riskLevel === "high" ? "warn" : project.riskLevel === "medium" ? "info" : "default"}>{project.riskLevel} risk</Badge>
                  <Badge variant="info">{project.status}</Badge>
                  <Badge variant="brand">{project.budgetEstimate != null ? `$${project.budgetEstimate.toLocaleString()}` : "No budget"}</Badge>
                </div>
              </div>
              <div className="flex items-center justify-between border-t border-white/[0.06] pt-3 text-sm text-muted">
                <span>{project.id}</span>
                <Link href={`/buildops/projects/${project.id}`} className="inline-flex items-center gap-2 text-brand">
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
