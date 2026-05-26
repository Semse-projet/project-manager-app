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

        <Card className="grid gap-4 border-white/10 bg-white/[0.03]">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-ink">Unified Dashboard</h2>
              <p className="text-sm text-muted">
                Vista operativa combinada: proyectos, milestones, riesgo, escrow sandbox y acceso rápido a todos los trade engines.
              </p>
            </div>
            <Link
              href="/tools/dashboard"
              className="inline-flex items-center justify-center rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-[#0a0a14] transition-all hover:bg-brand-bright"
            >
              Open dashboard
            </Link>
          </div>
        </Card>

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

        <Card className="grid gap-4 border-amber-400/20 bg-amber-400/[0.04]">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-ink">Electrical operations module</h2>
              <p className="text-sm text-muted">
                Dashboard, calculator, scope, materials, milestones, evidence, payments, rough-in, circuit load analysis and web research.
              </p>
            </div>
            <Link
              href="/tools/electrical/dashboard"
              className="inline-flex items-center justify-center rounded-lg bg-amber-300 px-4 py-2 text-sm font-semibold text-[#0a0a14] transition-all hover:bg-amber-200"
            >
              Open electrical dashboard
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

        <Card className="grid gap-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-ink">Tile calculator</h2>
              <p className="text-sm text-muted">
                Tile layout, waterproofing, grout and shower-ready evidence for bathrooms, kitchens and repair work.
              </p>
            </div>
            <Link
              href="/tools/tile"
              className="inline-flex items-center justify-center rounded-lg border border-white/[0.1] bg-white/[0.04] px-4 py-2 text-sm font-semibold text-ink transition-all hover:border-white/[0.18] hover:bg-white/[0.07]"
            >
              Open tile flow
            </Link>
          </div>
        </Card>

        <Card className="grid gap-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-ink">Insulation calculator</h2>
              <p className="text-sm text-muted">
                Area, R-value, air sealing, attic / wall / crawlspace access and evidence-ready energy efficiency output.
              </p>
            </div>
            <Link
              href="/tools/insulation"
              className="inline-flex items-center justify-center rounded-lg border border-white/[0.1] bg-white/[0.04] px-4 py-2 text-sm font-semibold text-ink transition-all hover:border-white/[0.18] hover:bg-white/[0.07]"
            >
              Open insulation flow
            </Link>
          </div>
        </Card>

        <Card className="grid gap-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-ink">Windows / Doors calculator</h2>
              <p className="text-sm text-muted">
                Replacement windows, doors, flashing, trim and weatherproofing with evidence-ready closeout.
              </p>
            </div>
            <Link
              href="/tools/windows-doors"
              className="inline-flex items-center justify-center rounded-lg border border-white/[0.1] bg-white/[0.04] px-4 py-2 text-sm font-semibold text-ink transition-all hover:border-white/[0.18] hover:bg-white/[0.07]"
            >
              Open windows / doors flow
            </Link>
          </div>
        </Card>

        <Card className="grid gap-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-ink">Demolition calculator</h2>
              <p className="text-sm text-muted">
                Selective demo, debris haul-off, utilities and hazardous-material flags with stronger evidence controls.
              </p>
            </div>
            <Link
              href="/tools/demolition"
              className="inline-flex items-center justify-center rounded-lg border border-white/[0.1] bg-white/[0.04] px-4 py-2 text-sm font-semibold text-ink transition-all hover:border-white/[0.18] hover:bg-white/[0.07]"
            >
              Open demolition flow
            </Link>
          </div>
        </Card>

        <Card className="grid gap-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-ink">Masonry / Block calculator</h2>
              <p className="text-sm text-muted">
                Block, brick, stone veneer, mortar, reinforcement, evidence and exterior closeout.
              </p>
            </div>
            <Link
              href="/tools/masonry"
              className="inline-flex items-center justify-center rounded-lg border border-white/[0.1] bg-white/[0.04] px-4 py-2 text-sm font-semibold text-ink transition-all hover:border-white/[0.18] hover:bg-white/[0.07]"
            >
              Open masonry flow
            </Link>
          </div>
        </Card>

        <Card className="grid gap-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-ink">Deck calculator</h2>
              <p className="text-sm text-muted">
                Decking, framing, railing, stairs, demo and exterior closeout with evidence.
              </p>
            </div>
            <Link
              href="/tools/deck"
              className="inline-flex items-center justify-center rounded-lg border border-white/[0.1] bg-white/[0.04] px-4 py-2 text-sm font-semibold text-ink transition-all hover:border-white/[0.18] hover:bg-white/[0.07]"
            >
              Open deck flow
            </Link>
          </div>
        </Card>

        <Card className="grid gap-4 border-brand/20 bg-brand/[0.04]">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-ink">Construction Manager / Field Ops</h2>
              <p className="text-sm text-muted">
                Project setup, crew coordination, daily logs, change orders, inspections and closeout for active jobs.
              </p>
            </div>
            <Link
              href="/tools/project-manager"
              className="inline-flex items-center justify-center rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-[#0a0a14] transition-all hover:bg-brand-bright"
            >
              Open field ops flow
            </Link>
          </div>
        </Card>

        <Card className="grid gap-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-ink">Labor / Daily Field Ops</h2>
              <p className="text-sm text-muted">
                Crew sign-in, task load, material moves, cleanup, safety and closeout for daily field work.
              </p>
            </div>
            <Link
              href="/tools/labor"
              className="inline-flex items-center justify-center rounded-lg border border-white/[0.1] bg-white/[0.04] px-4 py-2 text-sm font-semibold text-ink transition-all hover:border-white/[0.18] hover:bg-white/[0.07]"
            >
              Open labor flow
            </Link>
          </div>
        </Card>

        <Card className="grid gap-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-ink">Fencing calculator</h2>
              <p className="text-sm text-muted">
                Fence panels, posts, gates, slope, demo and exterior closeout with evidence.
              </p>
            </div>
            <Link
              href="/tools/fencing"
              className="inline-flex items-center justify-center rounded-lg border border-white/[0.1] bg-white/[0.04] px-4 py-2 text-sm font-semibold text-ink transition-all hover:border-white/[0.18] hover:bg-white/[0.07]"
            >
              Open fencing flow
            </Link>
          </div>
        </Card>

        <Card className="grid gap-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-ink">Landscaping / Drainage calculator</h2>
              <p className="text-sm text-muted">
                Sod, mulch, plants, irrigation, drainage, grading and exterior closeout with evidence.
              </p>
            </div>
            <Link
              href="/tools/landscaping"
              className="inline-flex items-center justify-center rounded-lg border border-white/[0.1] bg-white/[0.04] px-4 py-2 text-sm font-semibold text-ink transition-all hover:border-white/[0.18] hover:bg-white/[0.07]"
            >
              Open landscaping flow
            </Link>
          </div>
        </Card>

        <Card className="grid gap-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-ink">Siding Installation</h2>
              <p className="text-sm text-muted">
                Exterior siding with hidden damage detection, inspection gates, flashing risk and change order prediction.
              </p>
            </div>
            <Link href="/tools/siding" className="inline-flex items-center justify-center rounded-lg border border-white/[0.1] bg-white/[0.04] px-4 py-2 text-sm font-semibold text-ink transition-all hover:border-white/[0.18] hover:bg-white/[0.07]">
              Open siding flow
            </Link>
          </div>
        </Card>

        <Card className="grid gap-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-ink">Bathroom Remodel</h2>
              <p className="text-sm text-muted">
                Scope, tile, plumbing, waterproofing, fixtures, risk and evidence — cosmetic update to full gut remodel.
              </p>
            </div>
            <Link
              href="/tools/bathroom"
              className="inline-flex items-center justify-center rounded-lg border border-white/[0.1] bg-white/[0.04] px-4 py-2 text-sm font-semibold text-ink transition-all hover:border-white/[0.18] hover:bg-white/[0.07]"
            >
              Open bathroom flow
            </Link>
          </div>
        </Card>

        <Card className="grid gap-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-ink">Kitchen Remodel</h2>
              <p className="text-sm text-muted">
                Cabinets, countertops, appliances, plumbing, risk and milestones — cabinet update to full kitchen renovation.
              </p>
            </div>
            <Link
              href="/tools/kitchen"
              className="inline-flex items-center justify-center rounded-lg border border-white/[0.1] bg-white/[0.04] px-4 py-2 text-sm font-semibold text-ink transition-all hover:border-white/[0.18] hover:bg-white/[0.07]"
            >
              Open kitchen flow
            </Link>
          </div>
        </Card>

        <Card className="grid gap-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-ink">Cleaning Service</h2>
              <p className="text-sm text-muted">
                Crew sizing, hours, add-ons, risk and milestones for standard, deep, move-out and post-construction cleaning.
              </p>
            </div>
            <Link
              href="/tools/cleaning"
              className="inline-flex items-center justify-center rounded-lg border border-white/[0.1] bg-white/[0.04] px-4 py-2 text-sm font-semibold text-ink transition-all hover:border-white/[0.18] hover:bg-white/[0.07]"
            >
              Open cleaning flow
            </Link>
          </div>
        </Card>

        <Card className="grid gap-4 border-brand/20 bg-brand/[0.04]">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-ink">Solar / Renewable calculator</h2>
              <p className="text-sm text-muted">
                Roof suitability, panel count, electrical upgrade, permit and inspection-ready solar output.
              </p>
            </div>
            <Link
              href="/tools/solar"
              className="inline-flex items-center justify-center rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-[#0a0a14] transition-all hover:bg-brand-bright"
            >
              Open solar flow
            </Link>
          </div>
        </Card>
      </div>
    </main>
  );
}
