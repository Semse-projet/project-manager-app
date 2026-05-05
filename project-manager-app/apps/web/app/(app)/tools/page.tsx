import Link from "next/link";
import { Badge, Card } from "@/components/ui";

export const metadata = {
  title: "SEMSE Tools · SEMSE",
  description: "Hardened trade calculators connected to the SEMSE tools engine.",
};

export default function ToolsHubPage() {
  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
      <div className="grid gap-6">
        <section className="grid gap-3">
          <Badge variant="brand" className="w-fit">
            SEMSE Pro Tools
          </Badge>
          <h1 className="text-3xl font-bold tracking-tight text-ink">Tools hub</h1>
          <p className="max-w-3xl text-sm text-muted">
            Calculators hardened on the backend and exposed as reusable SEMSE flows.
            Start with roofing, then expand to the remaining trade engines.
          </p>
        </section>

        <Card className="grid gap-4 border-brand/20 bg-brand/[0.04]">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-ink">Roofing calculator</h2>
              <p className="text-sm text-muted">
                High-ticket, high-risk flow with materials, milestones, evidence and escrow-ready output.
              </p>
            </div>
            <Link
              href="/tools/roofing"
              className="inline-flex items-center justify-center rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-[#0a0a14] transition-all hover:bg-brand-bright"
            >
              Open roofing flow
            </Link>
          </div>
        </Card>
      </div>
    </main>
  );
}
