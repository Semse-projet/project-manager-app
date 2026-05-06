"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, ClipboardList, Clock3, FolderKanban } from "lucide-react";
import { Badge, Card } from "@/components/ui";
import { fetchBuildOpsMilestones, type BuildOpsMilestone } from "../../../lib/buildops-api";

const fallbackMilestones: BuildOpsMilestone[] = [];

function badgeVariant(status: BuildOpsMilestone["status"]) {
  if (status === "approved" || status === "paid") return "brand";
  if (status === "submitted" || status === "awaiting_review") return "info";
  if (status === "rejected") return "warn";
  return "default";
}

export default function BuildOpsMilestonesPage() {
  const [milestones, setMilestones] = useState<BuildOpsMilestone[]>(fallbackMilestones);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;

    async function load() {
      try {
        const data = await fetchBuildOpsMilestones();
        if (!alive) return;
        setMilestones(data);
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

  const pendingCount = milestones.filter((milestone) => ["draft", "awaiting_review", "submitted"].includes(milestone.status)).length;
  const approvedCount = milestones.filter((milestone) => milestone.status === "approved").length;
  const paidCount = milestones.filter((milestone) => milestone.status === "paid").length;

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
      <div className="grid gap-6">
        <section className="flex items-start justify-between gap-4">
          <div className="grid gap-2">
            <Badge variant="brand" className="w-fit">BuildOps</Badge>
            <h1 className="text-3xl font-bold tracking-tight text-ink">Milestones</h1>
            <p className="max-w-3xl text-sm text-muted">
              Project milestones with evidence counts. This view sits on top of the existing milestone table and keeps the release flow visible.
            </p>
            <div className="flex flex-wrap gap-2 pt-1 text-sm text-muted">
              <span className="inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1">
                <Clock3 size={14} />
                Pending {pendingCount}
              </span>
              <span className="inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1">
                <ClipboardList size={14} />
                Approved {approvedCount}
              </span>
              <span className="inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1">
                <FolderKanban size={14} />
                Paid {paidCount}
              </span>
            </div>
            {error ? <p className="text-sm text-red-400">{error}</p> : null}
            {loading ? <p className="text-sm text-muted">Loading milestones...</p> : null}
          </div>
          <Link href="/buildops/projects" className="inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-[#0a0a14] transition-all hover:bg-brand-bright">
            <ArrowRight size={16} />
            Projects
          </Link>
        </section>

        <div className="grid gap-3">
          {milestones.length === 0 ? (
            <Card className="grid gap-2 text-sm text-muted">
              <div className="text-ink font-semibold">No milestones yet</div>
              <div>Create projects and milestones from the core job flow; BuildOps will surface them here once they exist.</div>
            </Card>
          ) : null}
          {milestones.map((milestone) => (
            <Card key={milestone.id} className="grid gap-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="grid gap-1">
                  <div className="flex items-center gap-2">
                    <ClipboardList size={16} className="text-brand" />
                    <h2 className="text-lg font-semibold text-ink">{milestone.title}</h2>
                  </div>
                  <p className="text-sm text-muted">
                    {milestone.projectTitle} · Sequence {milestone.sequence} · ${milestone.amount.toFixed(2)}
                  </p>
                  <p className="text-xs text-muted">
                    {milestone.description ?? "No description"}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={badgeVariant(milestone.status)}>{milestone.status}</Badge>
                  <Badge variant="default">{milestone.evidenceCount} evidence</Badge>
                </div>
              </div>
              <div className="flex items-center justify-between border-t border-white/[0.06] pt-3 text-sm text-muted">
                <span>{milestone.id}</span>
                <span>{milestone.approvedAt ? new Date(milestone.approvedAt).toLocaleDateString() : "Not approved"}</span>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </main>
  );
}
