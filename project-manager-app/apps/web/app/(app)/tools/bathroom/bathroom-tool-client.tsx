"use client";

import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  ArrowLeft,
  Calculator,
  CheckCircle2,
  ClipboardCheck,
  ClipboardList,
  Globe2,
  LayoutDashboard,
  Package,
  ReceiptText,
  ShieldCheck,
  Waves,
} from "lucide-react";
import { Badge, Button, Card, Input, Select, Textarea } from "@/components/ui";
import {
  calculateSemseTool,
  type SemseToolResult,
  type ToolMode,
} from "@/app/lib/semse-tools-api";
import { ToolResultPanel } from "../ToolResultPanel";

export type BathroomSection =
  | "dashboard"
  | "estimate"
  | "scope"
  | "materials"
  | "summary"
  | "milestones"
  | "inspection"
  | "research";

type BathroomInput = {
  scope: "cosmetic" | "tile_floor" | "tub_shower" | "full_remodel";
  bathroomSqFt: "small" | "medium" | "large" | "extra_large";
  plumbingWork: "no_move" | "fixtures_only" | "relocate";
  materialQuality: "budget" | "standard" | "premium";
  includesShower: boolean;
  includesTub: boolean;
  demoRequired: boolean;
  clientProvidesMaterials: boolean;
  mode: ToolMode;
};

type ScopeState = {
  projectName: string;
  clientName: string;
  address: string;
  description: string;
  bathroomSize: "small" | "medium" | "large" | "extra_large";
  existingCondition: "good" | "aging" | "damaged" | "unknown";
  permitsRequired: boolean;
  tentativeDate: string;
  internalNotes: string;
};

type MaterialLine = {
  id: string;
  name: string;
  quantity: number;
  unit: "box" | "sqft" | "fixture" | "ea";
  unitCost: number;
  status: "estimated" | "confirmed" | "needs_review";
};

type Milestone = {
  id: string;
  name: string;
  status: "pending" | "in_progress" | "completed";
  date: string;
  progress: number;
  amount: number;
  evidenceRequired: string[];
};

const INITIAL_INPUT: BathroomInput = {
  scope: "full_remodel",
  bathroomSqFt: "medium",
  plumbingWork: "fixtures_only",
  materialQuality: "standard",
  includesShower: true,
  includesTub: true,
  demoRequired: true,
  clientProvidesMaterials: false,
  mode: "professional",
};

const INITIAL_SCOPE: ScopeState = {
  projectName: "Master Bathroom Remodel - Lopez",
  clientName: "Carlos Lopez",
  address: "1520 S Michigan Ave, Chicago, IL",
  description: "Full bathroom remodel: flooring, tile work, fixtures, plumbing for shower and tub.",
  bathroomSize: "medium",
  existingCondition: "aging",
  permitsRequired: true,
  tentativeDate: "2026-07-01",
  internalNotes: "Client wants ceramic tile. Check for water damage under sink before demo.",
};

const INITIAL_MATERIALS: MaterialLine[] = [
  { id: "mat-tile", name: "Ceramic tile flooring (12x12)", quantity: 60, unit: "sqft", unitCost: 6, status: "estimated" },
  { id: "mat-grout", name: "Grout & thinset", quantity: 8, unit: "box", unitCost: 18, status: "estimated" },
  { id: "mat-vanity", name: "Bathroom vanity + sink", quantity: 1, unit: "fixture", unitCost: 450, status: "confirmed" },
  { id: "mat-toilet", name: "Toilet (2-piece)", quantity: 1, unit: "fixture", unitCost: 280, status: "estimated" },
  { id: "mat-shower", name: "Shower valve + surround", quantity: 1, unit: "fixture", unitCost: 800, status: "needs_review" },
];

const INITIAL_MILESTONES: Milestone[] = [
  {
    id: "m1",
    name: "Demo & Prep",
    status: "completed",
    date: "2026-07-01",
    progress: 100,
    amount: 1200,
    evidenceRequired: ["Demo photos", "Damage assessment"],
  },
  {
    id: "m2",
    name: "Plumbing & Electrical",
    status: "in_progress",
    date: "2026-07-05",
    progress: 40,
    amount: 1600,
    evidenceRequired: ["Rough-in photos", "Inspection approval"],
  },
  {
    id: "m3",
    name: "Flooring & Tile",
    status: "pending",
    date: "2026-07-10",
    progress: 0,
    amount: 2400,
    evidenceRequired: ["Installation photos", "Quality inspection"],
  },
  {
    id: "m4",
    name: "Fixtures & Finish",
    status: "pending",
    date: "2026-07-15",
    progress: 0,
    amount: 1600,
    evidenceRequired: ["Final photos", "Client approval"],
  },
];

const SECTIONS: Array<{ id: BathroomSection; label: string; href: string; icon: LucideIcon }> = [
  { id: "dashboard", label: "Dashboard", href: "/tools/bathroom/dashboard", icon: LayoutDashboard },
  { id: "estimate", label: "Estimacion", href: "/tools/bathroom/estimate", icon: Calculator },
  { id: "scope", label: "Alcance", href: "/tools/bathroom/scope", icon: ClipboardList },
  { id: "materials", label: "Materiales", href: "/tools/bathroom/materials", icon: Package },
  { id: "summary", label: "Resumen", href: "/tools/bathroom/summary", icon: ReceiptText },
  { id: "milestones", label: "Milestones", href: "/tools/bathroom/milestones", icon: ShieldCheck },
  { id: "inspection", label: "Inspeccion", href: "/tools/bathroom/inspection", icon: ClipboardCheck },
  { id: "research", label: "Research", href: "/tools/bathroom/research", icon: Globe2 },
];

const SCOPE_NAMES: Record<BathroomInput["scope"], string> = {
  cosmetic: "Cosmetic Updates",
  tile_floor: "Floor Tile Only",
  tub_shower: "Tub/Shower Work",
  full_remodel: "Full Remodel",
};

const SCOPE_RANGE: Record<BathroomInput["scope"], { min: number; max: number }> = {
  cosmetic: { min: 800, max: 2500 },
  tile_floor: { min: 1500, max: 4000 },
  tub_shower: { min: 3000, max: 9000 },
  full_remodel: { min: 6000, max: 20000 },
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

type BathroomToolClientProps = {
  section: BathroomSection;
};

export function BathroomToolClient({ section }: BathroomToolClientProps) {
  const [input, setInput] = useState<BathroomInput>(INITIAL_INPUT);
  const [scope, setScope] = useState<ScopeState>(INITIAL_SCOPE);
  const [materials, setMaterials] = useState<MaterialLine[]>(INITIAL_MATERIALS);
  const [milestones, setMilestones] = useState<Milestone[]>(INITIAL_MILESTONES);
  const [result, setResult] = useState<SemseToolResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const costRange = useMemo(() => SCOPE_RANGE[input.scope], [input.scope]);
  const scopeName = useMemo(() => SCOPE_NAMES[input.scope], [input.scope]);
  const materialsCost = useMemo(() => materials.reduce((sum, m) => sum + m.quantity * m.unitCost, 0), [materials]);

  async function calculate() {
    setLoading(true);
    setError(null);
    try {
      const response = await calculateSemseTool({
        tool: "bathroom",
        mode: input.mode,
        input,
      });
      setResult(response);
    } catch (exception) {
      setError(exception instanceof Error ? exception.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  function renderSection(): ReactNode {
    switch (section) {
      case "dashboard":
        return (
          <div className="grid gap-6">
            <div className="grid gap-4 sm:grid-cols-3">
              <Card className="p-4">
                <div className="text-sm text-muted">Scope</div>
                <div className="text-xl font-bold">{scopeName}</div>
              </Card>
              <Card className="p-4">
                <div className="text-sm text-muted">Est. Cost Range</div>
                <div className="text-xl font-bold">{formatCurrency(costRange.min)}</div>
              </Card>
              <Card className="p-4">
                <div className="text-sm text-muted">Materials</div>
                <div className="text-xl font-bold">{formatCurrency(materialsCost)}</div>
              </Card>
            </div>
            <Card className="p-6">
              <h3 className="mb-4 font-semibold">Project Timeline</h3>
              <div className="space-y-2">
                {milestones.map((m) => (
                  <div key={m.id} className="flex justify-between text-sm">
                    <span>{m.name}</span>
                    <span className={m.status === "completed" ? "text-green-500" : m.status === "in_progress" ? "text-yellow-500" : "text-gray-500"}>{m.status}</span>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        );

      case "estimate":
        return (
          <div className="grid gap-6">
            <Card className="p-6">
              <h3 className="mb-4 font-semibold">Remodel Parameters</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <Select label="Scope" value={input.scope} onChange={(e) => setInput({...input, scope: e.target.value as any})}>
                  <option value="cosmetic">Cosmetic Updates</option>
                  <option value="tile_floor">Floor Tile Only</option>
                  <option value="tub_shower">Tub/Shower Work</option>
                  <option value="full_remodel">Full Remodel</option>
                </Select>
                <Select label="Bathroom Size" value={input.bathroomSqFt} onChange={(e) => setInput({...input, bathroomSqFt: e.target.value as any})}>
                  <option value="small">Small (35 sqft)</option>
                  <option value="medium">Medium (60 sqft)</option>
                  <option value="large">Large (100 sqft)</option>
                  <option value="extra_large">Extra Large (140 sqft)</option>
                </Select>
                <Select label="Plumbing Work" value={input.plumbingWork} onChange={(e) => setInput({...input, plumbingWork: e.target.value as any})}>
                  <option value="no_move">No Moves</option>
                  <option value="fixtures_only">Fixtures Only</option>
                  <option value="relocate">Relocate Lines</option>
                </Select>
                <Select label="Material Quality" value={input.materialQuality} onChange={(e) => setInput({...input, materialQuality: e.target.value as any})}>
                  <option value="budget">Budget</option>
                  <option value="standard">Standard</option>
                  <option value="premium">Premium</option>
                </Select>
              </div>
              <Button className="mt-4 w-full" onClick={calculate} disabled={loading}>
                {loading ? "Calculating..." : "Calculate"}
              </Button>
            </Card>
            {result && <ToolResultPanel result={result} />}
            {error && <div className="rounded bg-red-500/10 p-4 text-red-500">{error}</div>}
          </div>
        );

      case "scope":
        return (
          <Card className="p-6">
            <h3 className="mb-4 font-semibold">Project Scope</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <Input label="Project Name" value={scope.projectName} onChange={(e) => setScope({...scope, projectName: e.target.value})} />
              <Input label="Client Name" value={scope.clientName} onChange={(e) => setScope({...scope, clientName: e.target.value})} />
              <Input label="Address" value={scope.address} onChange={(e) => setScope({...scope, address: e.target.value})} />
              <Input label="Target Date" type="date" value={scope.tentativeDate} onChange={(e) => setScope({...scope, tentativeDate: e.target.value})} />
              <Textarea label="Description" value={scope.description} onChange={(e) => setScope({...scope, description: e.target.value})} />
              <Textarea label="Internal Notes" value={scope.internalNotes} onChange={(e) => setScope({...scope, internalNotes: e.target.value})} />
            </div>
          </Card>
        );

      case "materials":
        return (
          <div className="grid gap-6">
            <Card className="p-6">
              <h3 className="mb-4 font-semibold">Materials & Fixtures</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left">Item</th>
                      <th className="text-right">Qty</th>
                      <th className="text-right">Unit</th>
                      <th className="text-right">Cost</th>
                      <th className="text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {materials.map((m) => (
                      <tr key={m.id} className="border-b">
                        <td>{m.name}</td>
                        <td className="text-right">{m.quantity}</td>
                        <td className="text-right">{m.unit}</td>
                        <td className="text-right">${m.unitCost}</td>
                        <td className="text-right font-semibold">${(m.quantity * m.unitCost).toFixed(0)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colSpan={4} className="text-right font-semibold">Total:</td>
                      <td className="text-right font-bold">{formatCurrency(materialsCost)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </Card>
          </div>
        );

      case "summary":
        return (
          <Card className="p-6">
            <h3 className="mb-4 font-semibold">Remodel Summary</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <div className="text-sm text-muted">Work Type</div>
                <div className="text-2xl font-bold">{scopeName}</div>
              </div>
              <div>
                <div className="text-sm text-muted">Est. Range</div>
                <div className="text-xl font-bold">{formatCurrency(costRange.min)}-{formatCurrency(costRange.max)}</div>
              </div>
              <div>
                <div className="text-sm text-muted">Materials</div>
                <div className="text-2xl font-bold">{formatCurrency(materialsCost)}</div>
              </div>
              <div>
                <div className="text-sm text-muted">Typical Duration</div>
                <div className="text-2xl font-bold">2-4 weeks</div>
              </div>
            </div>
          </Card>
        );

      case "milestones":
        return (
          <Card className="p-6">
            <h3 className="mb-4 font-semibold">Project Milestones</h3>
            <div className="space-y-3">
              {milestones.map((m) => (
                <div key={m.id} className="border-l-4 border-blue-500 pl-4 py-2">
                  <div className="flex justify-between">
                    <span className="font-semibold">{m.name}</span>
                    <span className={m.status === "completed" ? "text-green-500" : m.status === "in_progress" ? "text-yellow-500" : "text-gray-500"}>{m.status}</span>
                  </div>
                  <div className="text-sm text-muted">{m.date} • {formatCurrency(m.amount)}</div>
                  <div className="mt-2 h-2 w-full rounded bg-gray-300">
                    <div className="h-full rounded bg-blue-500" style={{ width: `${m.progress}%` }}></div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        );

      case "inspection":
        return (
          <Card className="p-6">
            <h3 className="mb-4 font-semibold">Quality Inspection Checklist</h3>
            <div className="space-y-2">
              {[
                "Plumbing rough-in inspected and approved",
                "Electrical rough-in inspected",
                "Framing/waterproofing complete",
                "Tile layout and grout lines even",
                "Fixtures installed and tested",
                "Grout sealed and cured",
                "All plumbing lines functional",
                "Client final approval",
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input type="checkbox" className="rounded" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </Card>
        );

      case "research":
        return (
          <Card className="p-6">
            <h3 className="mb-4 font-semibold">Bathroom Remodel Research & Guide</h3>
            <div className="space-y-4">
              <Input placeholder="Search bathroom materials, plumbing, tile techniques..." />
              <Button>Search TradeGuide</Button>
              <div className="rounded bg-blue-500/5 p-4 text-sm text-muted">
                <p>Connected to SEMSE Trade Knowledge Library with bathroom remodel guides, plumbing code references, and material specifications.</p>
              </div>
            </div>
          </Card>
        );

      default:
        return null;
    }
  }

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6">
      <div className="grid gap-6">
        <div className="flex items-center justify-between gap-3">
          <Link href="/tools" className="inline-flex items-center gap-2 text-sm text-muted hover:text-ink">
            <ArrowLeft size={16} />
            Back to tools hub
          </Link>
          <Badge variant="brand">SEMSE Pro Tools</Badge>
        </div>

        <section className="grid gap-3">
          <div className="flex items-center gap-3">
            <Waves className="h-8 w-8" />
            <h1 className="text-3xl font-bold tracking-tight text-ink">Bathroom Tool</h1>
          </div>
          <p className="max-w-3xl text-sm text-muted">
            Complete bathroom remodel estimation, scope management, fixture selection, and code-backed guidance for residential projects.
          </p>
        </section>

        {/* Section Navigation */}
        <div className="flex gap-2 overflow-x-auto pb-2">
          {SECTIONS.map((s) => {
            const Icon = s.icon;
            const isActive = section === s.id;
            return (
              <Link
                key={s.id}
                href={s.href}
                className={`inline-flex items-center gap-2 rounded px-3 py-2 text-sm font-medium transition ${
                  isActive
                    ? "bg-blue-600 text-white"
                    : "bg-slate-800 text-muted hover:bg-slate-700"
                }`}
              >
                <Icon size={16} />
                {s.label}
              </Link>
            );
          })}
        </div>

        {/* Content */}
        <div className="grid gap-6">
          {renderSection()}
        </div>
      </div>
    </main>
  );
}
