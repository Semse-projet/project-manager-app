"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AlertTriangle, ArrowRight, Briefcase, CheckSquare, ClipboardList, FileText, FolderKanban, Plus, Radar } from "lucide-react";
import { Badge, Card } from "@/components/ui";
import { fetchBuildOpsOverview, type BuildOpsOverview } from "../../lib/buildops-api";

const fallbackCards = {
  activeProjects: 0,
  draftEstimates: 0,
  tasksDue: 0,
  milestonesPending: 0,
  evidencePending: 0,
  riskAlerts: 0,
  recentActivity: ["No activity yet"],
};

export default function BuildOpsPage() {
  const [overview, setOverview] = useState<BuildOpsOverview>(fallbackCards);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;

    async function load() {
      try {
        const data = await fetchBuildOpsOverview();
        if (!alive) return;
        setOverview(data);
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

  const dashboardCards = [
    { title: "Active Projects", value: String(overview.activeProjects), hint: "Jobs in progress", href: "/buildops/projects", icon: Briefcase, accent: "brand" as const },
    { title: "Draft Estimates", value: String(overview.draftEstimates), hint: "Tool results ready to save", href: "/tools", icon: FileText, accent: "neutral" as const },
    { title: "Tasks Due", value: String(overview.tasksDue), hint: "Today and next 24h", href: "/buildops/tasks", icon: CheckSquare, accent: "neutral" as const },
    { title: "Milestones Pending", value: String(overview.milestonesPending), hint: "Awaiting approval", href: "/client/milestones", icon: ClipboardList, accent: "neutral" as const },
    { title: "Evidence Pending", value: String(overview.evidencePending), hint: "Photos / docs to upload", href: "/worker/evidence", icon: FolderKanban, accent: "neutral" as const },
    { title: "Risk Alerts", value: String(overview.riskAlerts), hint: "Needs review", href: "/admin/ops", icon: AlertTriangle, accent: "warning" as const },
  ];

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
      <div className="grid gap-6">
        <section className="grid gap-3">
          <Badge variant="brand" className="w-fit">
            SEMSE BuildOps
          </Badge>
          <h1 className="text-3xl font-bold tracking-tight text-ink">BuildOps dashboard</h1>
          <p className="max-w-3xl text-sm text-muted">
            Tool results turn into estimates, projects, tasks, milestones, evidence and reports. This shell is the workbench for field execution.
          </p>
          {error ? <p className="text-sm text-red-400">{error}</p> : null}
          {loading ? <p className="text-sm text-muted">Loading BuildOps...</p> : null}
        </section>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {dashboardCards.map((card) => {
            const Icon = card.icon;
            return (
              <Card key={card.title} className={card.accent === "brand" ? "border-brand/20 bg-brand/[0.04]" : card.accent === "warning" ? "border-amber-500/20 bg-amber-500/[0.05]" : ""}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <div className="rounded-xl border border-white/[0.08] bg-white/[0.04] p-2 text-brand">
                        <Icon size={18} />
                      </div>
                      <div className="text-sm font-semibold text-ink">{card.title}</div>
                    </div>
                    <div className="mt-3 text-3xl font-bold text-ink">{card.value}</div>
                    <div className="mt-1 text-sm text-muted">{card.hint}</div>
                  </div>
                  <Link
                    href={card.href}
                    className="inline-flex items-center gap-2 rounded-lg border border-white/[0.1] bg-white/[0.04] px-3 py-2 text-sm font-semibold text-ink transition-all hover:border-white/[0.18] hover:bg-white/[0.07]"
                  >
                    Open <ArrowRight size={14} />
                  </Link>
                </div>
              </Card>
            );
          })}
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.4fr_0.9fr]">
          <Card className="grid gap-4 border-brand/20 bg-brand/[0.04]">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 rounded-xl border border-white/[0.08] bg-white/[0.04] p-2 text-brand">
                <Radar size={18} />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-ink">Recent activity</h2>
                <p className="text-sm text-muted">Latest BuildOps events from tools and field work.</p>
              </div>
            </div>
            <div className="grid gap-2">
              {overview.recentActivity.map((item) => (
                <div key={item} className="rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-sm text-ink">
                  {item}
                </div>
              ))}
            </div>
          </Card>

          <Card className="grid gap-4">
            <h2 className="text-lg font-semibold text-ink">Quick actions</h2>
            <div className="grid gap-3">
              <Link href="/buildops/projects/new" className="inline-flex items-center justify-between rounded-xl border border-brand/20 bg-brand/[0.04] px-4 py-3 text-sm font-semibold text-ink transition-all hover:bg-brand/[0.08]">
                <span className="inline-flex items-center gap-2">
                  <Plus size={16} />
                  New project
                </span>
                <ArrowRight size={14} />
              </Link>
              <Link href="/buildops/tasks/new" className="inline-flex items-center justify-between rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-sm font-semibold text-ink transition-all hover:bg-white/[0.06]">
                <span className="inline-flex items-center gap-2">
                  <CheckSquare size={16} />
                  New task
                </span>
                <ArrowRight size={14} />
              </Link>
              <Link href="/tools" className="inline-flex items-center justify-between rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-sm font-semibold text-ink transition-all hover:bg-white/[0.06]">
                <span className="inline-flex items-center gap-2">
                  <FolderKanban size={16} />
                  Open tools hub
                </span>
                <ArrowRight size={14} />
              </Link>
              <Link href="/admin/ops" className="inline-flex items-center justify-between rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-sm font-semibold text-ink transition-all hover:bg-white/[0.06]">
                <span className="inline-flex items-center gap-2">
                  <Briefcase size={16} />
                  Review operations
                </span>
                <ArrowRight size={14} />
              </Link>
            </div>
          </Card>
        </div>
      </div>
    </main>
  );
}
