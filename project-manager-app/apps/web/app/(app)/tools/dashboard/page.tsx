"use client";

import Link from "next/link";
import { useLanguage } from "../../../../lib/language-context";
import { useEffect, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  ClipboardList,
  DollarSign,
  ShieldAlert,
  Wrench,
} from "lucide-react";
import { Badge, Card, MetricCard } from "@/components/ui";
import { fetchBuildOpsOverview, fetchBuildOpsMilestones, type BuildOpsMilestone } from "@/app/lib/buildops-api";
import type { BuildOpsOverview } from "@/app/lib/buildops-api";

const RISK_VARIANT: Record<string, "default" | "info" | "warn" | "error"> = {
  low: "default",
  medium: "info",
  high: "warn",
  critical: "error",
};

const MILESTONE_STATUS_VARIANT: Record<BuildOpsMilestone["status"], "default" | "info" | "warn" | "brand"> = {
  draft: "default",
  awaiting_review: "info",
  submitted: "info",
  approved: "brand",
  rejected: "warn",
  paid: "brand",
};

const TRADE_LINKS: { label: string; href: string }[] = [
  { label: "Roofing", href: "/tools/roofing" },
  { label: "Concrete", href: "/tools/concrete" },
  { label: "Electrical", href: "/tools/electrical" },
  { label: "Plumbing", href: "/tools/plumbing" },
  { label: "HVAC", href: "/tools/hvac" },
  { label: "Painting", href: "/tools/painting" },
  { label: "Drywall", href: "/tools/drywall" },
  { label: "Flooring", href: "/tools/flooring" },
  { label: "Carpentry", href: "/tools/carpentry" },
  { label: "Tile", href: "/tools/tile" },
  { label: "Windows & Doors", href: "/tools/windows-doors" },
  { label: "Insulation", href: "/tools/insulation" },
  { label: "Demolition", href: "/tools/demolition" },
  { label: "Masonry", href: "/tools/masonry" },
  { label: "Deck", href: "/tools/deck" },
  { label: "Fencing", href: "/tools/fencing" },
  { label: "Landscaping", href: "/tools/landscaping" },
  { label: "Solar", href: "/tools/solar" },
  { label: "Labor", href: "/tools/labor" },
  { label: "Project Manager", href: "/tools/project-manager" },
];

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
}

export default function ToolsDashboardPage() {
  const { t } = useLanguage();
  const [overview, setOverview] = useState<BuildOpsOverview | null>(null);
  const [milestones, setMilestones] = useState<BuildOpsMilestone[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    async function load() {
      try {
        const [ov, ms] = await Promise.all([fetchBuildOpsOverview(), fetchBuildOpsMilestones()]);
        if (!alive) return;
        setOverview(ov);
        setMilestones(ms);
      } catch (err) {
        if (!alive) return;
        setError(err instanceof Error ? err.message : "Error loading dashboard");
      } finally {
        if (alive) setLoading(false);
      }
    }
    void load();
    return () => { alive = false; };
  }, []);

  const pendingMilestones = milestones.filter((m) => ["draft", "awaiting_review", "submitted"].includes(m.status));
  const approvedMilestones = milestones.filter((m) => m.status === "approved");
  const totalEscrowEstimate = approvedMilestones.reduce((sum, m) => sum + m.amount, 0);

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
      <div className="grid gap-8">
        {/* Header */}
        <section className="flex items-start justify-between gap-4">
          <div className="grid gap-2">
            <Badge variant="brand" className="w-fit">Pro Tools</Badge>
            <h1 className="text-3xl font-bold tracking-tight text-ink">Unified Dashboard</h1>
            <p className="max-w-2xl text-sm text-muted">
              Estado operativo de proyectos, milestones, riesgo y escrow sandbox en una sola vista.
            </p>
          </div>
          <Link
            href="/tools"
            className="inline-flex items-center gap-2 rounded-lg border border-white/[0.08] bg-white/[0.03] px-4 py-2 text-sm font-semibold text-ink transition-all hover:bg-white/[0.06]"
          >
            <Wrench size={15} />
            All tools
          </Link>
        </section>

        {error ? <p className="text-sm text-red-400">{error}</p> : null}
        {loading ? <p className="text-sm text-muted">Loading dashboard...</p> : null}

        {/* Metrics grid */}
        {overview ? (
          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Link href="/buildops/projects">
              <MetricCard label="Active Projects" value={String(overview.activeProjects)} sub="Jobs in progress" />
            </Link>
            <Link href="/buildops/milestones">
              <MetricCard label="Milestones Pending" value={String(pendingMilestones.length)} sub="Awaiting approval or review" />
            </Link>
            <Link href="/buildops/milestones">
              <MetricCard
                label="Approved Milestones"
                value={String(approvedMilestones.length)}
                sub={approvedMilestones.length > 0 ? `${formatCurrency(totalEscrowEstimate)} escrow sandbox` : "None yet"}
              />
            </Link>
            <Link href="/tools">
              <MetricCard label="Draft Estimates" value={String(overview.draftEstimates)} sub="Tool results pending save" />
            </Link>
            <Link href="/worker/evidence">
              <MetricCard label="Evidence Pending" value={String(overview.evidencePending)} sub="Photos / docs to upload" />
            </Link>
            <Link href="/admin/ops">
              <MetricCard label="Risk Alerts" value={String(overview.riskAlerts)} sub="Projects needing review" accent={overview.riskAlerts > 0} />
            </Link>
          </section>
        ) : null}

        {/* Escrow sandbox summary */}
        {approvedMilestones.length > 0 ? (
          <section className="grid gap-3">
            <h2 className="text-lg font-semibold text-ink flex items-center gap-2">
              <DollarSign size={18} className="text-brand" />
              Escrow Sandbox
              <Badge variant="info" className="text-xs">Simulado</Badge>
            </h2>
            <Card className="grid gap-4">
              <div className="flex flex-wrap gap-6 text-sm">
                <div>
                  <div className="text-muted text-xs uppercase tracking-wide">Total aprobado</div>
                  <div className="text-ink font-semibold text-xl">{formatCurrency(totalEscrowEstimate)}</div>
                </div>
                <div>
                  <div className="text-muted text-xs uppercase tracking-wide">Milestones aprobados</div>
                  <div className="text-ink font-semibold text-xl">{approvedMilestones.length}</div>
                </div>
              </div>
              <p className="text-xs text-muted border-t border-white/[0.06] pt-3">
                Los fondos escrow se liberan cuando el cliente aprueba la evidencia de cada milestone.
                Esta vista es sandbox — no ejecuta pagos reales.
              </p>
            </Card>
          </section>
        ) : null}

        {/* Recent milestones */}
        {milestones.length > 0 ? (
          <section className="grid gap-3">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-ink flex items-center gap-2">
                <ClipboardList size={18} className="text-brand" />
                Recent Milestones
              </h2>
              <Link href="/buildops/milestones" className="inline-flex items-center gap-1 text-sm text-brand hover:underline">
                View all <ArrowRight size={14} />
              </Link>
            </div>
            <div className="grid gap-2">
              {milestones.slice(0, 6).map((m) => (
                <Card key={m.id} className="flex items-center justify-between gap-4 py-3">
                  <div className="grid gap-0.5 min-w-0">
                    <div className="text-sm font-medium text-ink truncate">{m.title}</div>
                    <div className="text-xs text-muted truncate">{m.projectTitle} · Seq {m.sequence}</div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="text-sm font-semibold text-ink">{formatCurrency(m.amount)}</span>
                    <Badge variant={MILESTONE_STATUS_VARIANT[m.status]}>{m.status}</Badge>
                  </div>
                </Card>
              ))}
            </div>
          </section>
        ) : null}

        {/* Risk alerts */}
        {(overview?.riskAlerts ?? 0) > 0 ? (
          <Card className="flex items-center gap-3 border-orange-500/20 bg-orange-500/[0.04]">
            <ShieldAlert size={18} className="shrink-0 text-orange-400" />
            <div className="grid gap-0.5">
              <div className="text-sm font-semibold text-ink">{overview!.riskAlerts} proyecto(s) con alertas de riesgo</div>
              <div className="text-xs text-muted">Revisa el panel de administración para proyectos que requieren atención.</div>
            </div>
            <Link href="/admin/ops" className="ml-auto shrink-0 inline-flex items-center gap-1 text-sm text-orange-400 hover:underline">
              Review <ArrowRight size={14} />
            </Link>
          </Card>
        ) : null}

        {/* Trade tools grid */}
        <section className="grid gap-3">
          <h2 className="text-lg font-semibold text-ink flex items-center gap-2">
            <Wrench size={18} className="text-brand" />
            Trade Engines
            <Badge variant="default" className="text-xs">{TRADE_LINKS.length} trades</Badge>
          </h2>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {TRADE_LINKS.map((trade) => (
              <Link
                key={trade.href}
                href={trade.href}
                className="inline-flex items-center justify-between rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2.5 text-sm font-medium text-ink transition-all hover:bg-white/[0.06]"
              >
                {trade.label}
                <ArrowRight size={13} className="text-muted" />
              </Link>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
