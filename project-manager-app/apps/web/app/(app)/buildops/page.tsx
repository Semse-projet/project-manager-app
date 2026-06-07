"use client";

import Link from "next/link";
import { useLanguage } from "../../../lib/language-context";
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
  recentActivity: [],
};

export default function BuildOpsPage() {
  const { t } = useLanguage();
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
    { title: t("buildops.activeProjects"), value: String(overview.activeProjects), hint: t("buildops.jobsInProgressHint"), href: "/buildops/projects", icon: Briefcase, accent: "brand" as const },
    { title: t("buildops.draftEstimates"), value: String(overview.draftEstimates), hint: t("buildops.toolResultsHint"), href: "/tools", icon: FileText, accent: "neutral" as const },
    { title: t("buildops.tasksDue"), value: String(overview.tasksDue), hint: t("buildops.todayNext24hHint"), href: "/buildops/tasks", icon: CheckSquare, accent: "neutral" as const },
    { title: t("buildops.milestonesPending"), value: String(overview.milestonesPending), hint: t("buildops.awaitingApprovalHint"), href: "/buildops/milestones", icon: ClipboardList, accent: "neutral" as const },
    { title: t("buildops.evidencePending"), value: String(overview.evidencePending), hint: t("buildops.uploadDocsHint"), href: "/worker/evidence", icon: FolderKanban, accent: "neutral" as const },
    { title: t("buildops.riskAlerts"), value: String(overview.riskAlerts), hint: t("buildops.needsReviewHint"), href: "/admin/ops", icon: AlertTriangle, accent: "warning" as const },
  ];

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
      <div className="grid gap-6">
        <section className="grid gap-3">
          <Badge variant="brand" className="w-fit">
            SEMSE BuildOps
          </Badge>
          <h1 className="text-3xl font-bold tracking-tight text-ink">{t("page.buildOps")}</h1>
          <p className="max-w-3xl text-sm text-muted">
            {t("buildops.workbenchDesc")}
          </p>
          {error ? <p className="text-sm text-red-400">{error}</p> : null}
          {loading ? <p className="text-sm text-muted">{t("buildops.loadingOverview")}</p> : null}
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
                    {t("ui.open")} <ArrowRight size={14} />
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
                <h2 className="text-lg font-semibold text-ink">{t("buildops.recentActivity")}</h2>
                <p className="text-sm text-muted">{t("buildops.latestEvents")}</p>
              </div>
            </div>
            <div className="grid gap-2">
              {overview.recentActivity.length === 0 ? (
                <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-sm text-muted">
                  {t("ui.noData")}
                </div>
              ) : overview.recentActivity.map((item) => (
                <div key={item} className="rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-sm text-ink">
                  {item}
                </div>
              ))}
            </div>
          </Card>

          <Card className="grid gap-4">
            <h2 className="text-lg font-semibold text-ink">{t("dash.quickActions")}</h2>
            <div className="grid gap-3">
              <Link href="/buildops/projects/new" className="inline-flex items-center justify-between rounded-xl border border-brand/20 bg-brand/[0.04] px-4 py-3 text-sm font-semibold text-ink transition-all hover:bg-brand/[0.08]">
                <span className="inline-flex items-center gap-2">
                  <Plus size={16} />
                  {t("buildops.newProject")}
                </span>
                <ArrowRight size={14} />
              </Link>
              <Link href="/buildops/tasks/new" className="inline-flex items-center justify-between rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-sm font-semibold text-ink transition-all hover:bg-white/[0.06]">
                <span className="inline-flex items-center gap-2">
                  <CheckSquare size={16} />
                  {t("buildops.newTask")}
                </span>
                <ArrowRight size={14} />
              </Link>
              <Link href="/buildops/milestones" className="inline-flex items-center justify-between rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-sm font-semibold text-ink transition-all hover:bg-white/[0.06]">
                <span className="inline-flex items-center gap-2">
                  <ClipboardList size={16} />
                  {t("buildops.reviewMilestones")}
                </span>
                <ArrowRight size={14} />
              </Link>
              <Link href="/tools" className="inline-flex items-center justify-between rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-sm font-semibold text-ink transition-all hover:bg-white/[0.06]">
                <span className="inline-flex items-center gap-2">
                  <FolderKanban size={16} />
                  {t("buildops.openToolsHub")}
                </span>
                <ArrowRight size={14} />
              </Link>
              <Link href="/admin/ops" className="inline-flex items-center justify-between rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-sm font-semibold text-ink transition-all hover:bg-white/[0.06]">
                <span className="inline-flex items-center gap-2">
                  <Briefcase size={16} />
                  {t("buildops.reviewOperations")}
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
