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

        <Card className="grid gap-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-ink">Concrete calculator</h2>
              <p className="text-sm text-muted">
                Slabs, mix ratios, reinforcement and curado-friendly output for field execution.
              </p>
            </div>
            <Link
              href="/tools/concrete"
              className="inline-flex items-center justify-center rounded-lg border border-white/[0.1] bg-white/[0.04] px-4 py-2 text-sm font-semibold text-ink transition-all hover:border-white/[0.18] hover:bg-white/[0.07]"
            >
              Open concrete flow
            </Link>
          </div>
        </Card>

        <Card className="grid gap-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-ink">Plumbing calculator</h2>
              <p className="text-sm text-muted">
                Pipe runs, fixtures, valves, water heater replacement and pressure-test friendly output.
              </p>
            </div>
            <Link
              href="/tools/plumbing"
              className="inline-flex items-center justify-center rounded-lg border border-white/[0.1] bg-white/[0.04] px-4 py-2 text-sm font-semibold text-ink transition-all hover:border-white/[0.18] hover:bg-white/[0.07]"
            >
              Open plumbing flow
            </Link>
          </div>
        </Card>

        <Card className="grid gap-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-ink">HVAC calculator</h2>
              <p className="text-sm text-muted">
                Tonnage, duct runs, zones, heat-pump risk and airflow-oriented output for field execution.
              </p>
            </div>
            <Link
              href="/tools/hvac"
              className="inline-flex items-center justify-center rounded-lg border border-white/[0.1] bg-white/[0.04] px-4 py-2 text-sm font-semibold text-ink transition-all hover:border-white/[0.18] hover:bg-white/[0.07]"
            >
              Open HVAC flow
            </Link>
          </div>
        </Card>

        <Card className="grid gap-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-ink">Painting calculator</h2>
              <p className="text-sm text-muted">
                Area neta, galones, primer, mano de obra, riesgo y evidencia para trabajos residenciales rápidos.
              </p>
            </div>
            <Link
              href="/tools/painting"
              className="inline-flex items-center justify-center rounded-lg border border-white/[0.1] bg-white/[0.04] px-4 py-2 text-sm font-semibold text-ink transition-all hover:border-white/[0.18] hover:bg-white/[0.07]"
            >
              Open painting flow
            </Link>
          </div>
        </Card>

        <Card className="grid gap-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-ink">Drywall calculator</h2>
              <p className="text-sm text-muted">
                Paneles, tornillos, compound, finish level, textura y evidencia para reparación o instalación interior.
              </p>
            </div>
            <Link
              href="/tools/drywall"
              className="inline-flex items-center justify-center rounded-lg border border-white/[0.1] bg-white/[0.04] px-4 py-2 text-sm font-semibold text-ink transition-all hover:border-white/[0.18] hover:bg-white/[0.07]"
            >
              Open drywall flow
            </Link>
          </div>
        </Card>

        <Card className="grid gap-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-ink">Flooring calculator</h2>
              <p className="text-sm text-muted">
                Área, desperdicio, underlayment, preparación de subfloor y evidencia para remodelación interior.
              </p>
            </div>
            <Link
              href="/tools/flooring"
              className="inline-flex items-center justify-center rounded-lg border border-white/[0.1] bg-white/[0.04] px-4 py-2 text-sm font-semibold text-ink transition-all hover:border-white/[0.18] hover:bg-white/[0.07]"
            >
              Open flooring flow
            </Link>
          </div>
        </Card>

        <Card className="grid gap-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-ink">Carpentry calculator</h2>
              <p className="text-sm text-muted">
                Cabinets, doors, closets, trim and finish carpentry with board-foot takeoff and evidence-ready closeout.
              </p>
            </div>
            <Link
              href="/tools/carpentry"
              className="inline-flex items-center justify-center rounded-lg border border-white/[0.1] bg-white/[0.04] px-4 py-2 text-sm font-semibold text-ink transition-all hover:border-white/[0.18] hover:bg-white/[0.07]"
            >
              Open carpentry flow
            </Link>
          </div>
        </Card>
      </div>
    </main>
  );
}
