import Link from "next/link";
import { ArrowRight, FolderKanban, Plus } from "lucide-react";
import { Badge, Card } from "@/components/ui";

const projects = [
  { id: "p-1001", title: "Bathroom remodel", trade: "Tile + Plumbing", status: "in_progress", budget: "$45,000", risk: "Medium" },
  { id: "p-1002", title: "Roof replacement", trade: "Roofing", status: "quoted", budget: "$18,500", risk: "High" },
  { id: "p-1003", title: "Solar retrofit", trade: "Solar", status: "estimating", budget: "$32,000", risk: "High" },
  { id: "p-1004", title: "Fence + drainage", trade: "Fencing + Landscaping", status: "draft", budget: "$9,800", risk: "Low" },
];

export default function BuildOpsProjectsPage() {
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
              Track active jobs, drafts and quotes. This is the shell before DB wiring.
            </p>
          </div>
          <Link href="/buildops/projects/new" className="inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-[#0a0a14] transition-all hover:bg-brand-bright">
            <Plus size={16} />
            New project
          </Link>
        </section>

        <div className="grid gap-3">
          {projects.map((project) => (
            <Card key={project.id} className="grid gap-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="grid gap-1">
                  <div className="flex items-center gap-2">
                    <FolderKanban size={16} className="text-brand" />
                    <h2 className="text-lg font-semibold text-ink">{project.title}</h2>
                  </div>
                  <p className="text-sm text-muted">{project.trade}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={project.risk === "High" ? "warn" : project.risk === "Medium" ? "info" : "default"}>{project.risk} risk</Badge>
                  <Badge variant="info">{project.status}</Badge>
                  <Badge variant="brand">{project.budget}</Badge>
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
