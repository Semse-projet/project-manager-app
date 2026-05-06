import Link from "next/link";
import { ArrowLeft, CheckSquare, FileText, FolderKanban, MessageSquare, Plus } from "lucide-react";
import { Badge, Card } from "@/components/ui";

const project = {
  id: "p-1001",
  title: "Bathroom remodel",
  trade: "Tile + Plumbing",
  projectType: "Remodel",
  status: "In progress",
  clientName: "Client demo",
  professionalName: "Pro demo",
  location: "Austin, TX",
  budgetEstimate: "$45,000",
  riskScore: 62,
  milestones: 4,
  tasks: 12,
  evidence: 9,
};

export default function BuildOpsProjectDetailPage() {
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
            Shell detail page. Later this will connect to DB, tasks, estimates, evidence and reports.
          </p>
        </section>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {[
            { label: "Trade", value: project.trade },
            { label: "Status", value: project.status },
            { label: "Budget", value: project.budgetEstimate },
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
              <div><span className="text-ink font-semibold">Professional:</span> {project.professionalName}</div>
              <div><span className="text-ink font-semibold">Location:</span> {project.location}</div>
              <div><span className="text-ink font-semibold">Type:</span> {project.projectType}</div>
              <div><span className="text-ink font-semibold">Project ID:</span> {project.id}</div>
            </div>
            <div className="flex flex-wrap gap-2 pt-2">
              <Badge variant="info">{project.milestones} milestones</Badge>
              <Badge variant="info">{project.tasks} tasks</Badge>
              <Badge variant="info">{project.evidence} evidence items</Badge>
            </div>
          </Card>

          <Card className="grid gap-4">
            <h2 className="text-lg font-semibold text-ink">Quick actions</h2>
            <div className="grid gap-3">
              <button disabled className="inline-flex items-center justify-between rounded-xl border border-brand/20 bg-brand/[0.04] px-4 py-3 text-sm font-semibold text-ink opacity-60">
                <span className="inline-flex items-center gap-2">
                  <Plus size={16} />
                  Add task
                </span>
                <ArrowLeft size={14} />
              </button>
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
