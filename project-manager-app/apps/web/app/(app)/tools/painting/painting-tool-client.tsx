"use client";

import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  AlertTriangle,
  ArrowLeft,
  Brush,
  Calculator,
  CheckCircle2,
  ClipboardCheck,
  ClipboardList,
  DollarSign,
  Globe2,
  LayoutDashboard,
  Package,
  ReceiptText,
  ShieldCheck,
} from "lucide-react";
import { Badge, Button, Card, Input, Select, Textarea } from "@/components/ui";
import {
  calculateSemseTool,
  researchElectricalTool,
  type SemseToolResult,
  type ToolMode,
} from "@/app/lib/semse-tools-api";
import { ToolResultPanel } from "../ToolResultPanel";

export type PaintingSection =
  | "dashboard"
  | "estimate"
  | "scope"
  | "materials"
  | "summary"
  | "milestones"
  | "inspection"
  | "research";

type PaintingInput = {
  roomLengthFt: number;
  roomWidthFt: number;
  wallHeightFt: number;
  doors: number;
  windows: number;
  coats: number;
  surfaceType: "smooth" | "textured" | "newDrywall" | "exterior";
  includeCeiling: boolean;
  includePrimer: boolean;
  paintQuality: "economy" | "standard" | "premium";
  surfaceCondition: "good" | "minor_repairs" | "extensive_prep" | "peeling";
  mode: ToolMode;
};

type ScopeState = {
  projectName: string;
  clientName: string;
  address: string;
  description: string;
  projectType: "interior" | "exterior" | "accent";
  areaSqFt: number;
  roofType?: string;
  exteriorMaterial?: "wood" | "vinyl" | "metal" | "masonry" | "stucco";
  permitsRequired: boolean;
  tentativeDate: string;
  internalNotes: string;
};

type MaterialLine = {
  id: string;
  name: string;
  quantity: number;
  unit: "gal" | "ea" | "box" | "sqft";
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

const INITIAL_INPUT: PaintingInput = {
  roomLengthFt: 16,
  roomWidthFt: 12,
  wallHeightFt: 9,
  doors: 2,
  windows: 3,
  coats: 2,
  surfaceType: "smooth",
  includeCeiling: false,
  includePrimer: true,
  paintQuality: "standard",
  surfaceCondition: "good",
  mode: "professional",
};

const INITIAL_SCOPE: ScopeState = {
  projectName: "Bedroom & living room - Garcia",
  clientName: "Luis Garcia",
  address: "2450 N Lincoln Ave, Chicago, IL",
  description: "Interior walls + ceilings, 2 coats, primer included.",
  projectType: "interior",
  areaSqFt: 550,
  permitsRequired: false,
  tentativeDate: "2026-06-15",
  internalNotes: "Client prefers low-VOC. Verify color approval before primer.",
};

const INITIAL_MATERIALS: MaterialLine[] = [
  { id: "mat-paint", name: "Interior Paint (standard)", quantity: 12, unit: "gal", unitCost: 32, status: "estimated" },
  { id: "mat-primer", name: "Primer (primer)", quantity: 6, unit: "gal", unitCost: 24, status: "estimated" },
  { id: "mat-tape", name: "Painter's tape", quantity: 2, unit: "box", unitCost: 12, status: "confirmed" },
  { id: "mat-drop", name: "Drop cloth (plastic)", quantity: 4, unit: "ea", unitCost: 8, status: "estimated" },
];

const INITIAL_MILESTONES: Milestone[] = [
  {
    id: "m1",
    name: "Preparacion y proteccion",
    status: "completed",
    date: "2026-06-15",
    progress: 100,
    amount: 240,
    evidenceRequired: ["Fotos antes", "Materiales verificados"],
  },
  {
    id: "m2",
    name: "Primer aplicado",
    status: "in_progress",
    date: "2026-06-16",
    progress: 50,
    amount: 400,
    evidenceRequired: ["Foto de aplicacion", "Tiempo de secado"],
  },
  {
    id: "m3",
    name: "Capas finales",
    status: "pending",
    date: "2026-06-17",
    progress: 0,
    amount: 520,
    evidenceRequired: ["Foto de acabado", "Inspeccion cliente"],
  },
  {
    id: "m4",
    name: "Limpieza y cierre",
    status: "pending",
    date: "2026-06-18",
    progress: 0,
    amount: 180,
    evidenceRequired: ["Fotos despues", "Aprobacion cliente"],
  },
];

const SECTIONS: Array<{ id: PaintingSection; label: string; href: string; icon: LucideIcon }> = [
  { id: "dashboard", label: "Dashboard", href: "/tools/painting/dashboard", icon: LayoutDashboard },
  { id: "estimate", label: "Estimacion", href: "/tools/painting/estimate", icon: Calculator },
  { id: "scope", label: "Alcance", href: "/tools/painting/scope", icon: ClipboardList },
  { id: "materials", label: "Materiales", href: "/tools/painting/materials", icon: Package },
  { id: "summary", label: "Resumen", href: "/tools/painting/summary", icon: ReceiptText },
  { id: "milestones", label: "Milestones", href: "/tools/painting/milestones", icon: ShieldCheck },
  { id: "inspection", label: "Inspeccion", href: "/tools/painting/inspection", icon: ClipboardCheck },
  { id: "research", label: "Research", href: "/tools/painting/research", icon: Globe2 },
];

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function calculateNetArea(input: PaintingInput): number {
  const wallArea = 2 * (input.roomLengthFt + input.roomWidthFt) * input.wallHeightFt;
  const ceilingArea = input.includeCeiling ? input.roomLengthFt * input.roomWidthFt : 0;
  const openingArea = (input.doors * 20 + input.windows * 10); // rough estimate
  return Math.max(0, wallArea + ceilingArea - openingArea);
}

function calculateGallonsNeeded(input: PaintingInput): number {
  const netArea = calculateNetArea(input);
  const sqFtPerGallon = 350; // typical coverage
  const baseGallons = (netArea / sqFtPerGallon) * input.coats;
  return Math.ceil(baseGallons * 1.1); // 10% waste factor
}

type PaintingToolClientProps = {
  section: PaintingSection;
};

export function PaintingToolClient({ section }: PaintingToolClientProps) {
  const [input, setInput] = useState<PaintingInput>(INITIAL_INPUT);
  const [scope, setScope] = useState<ScopeState>(INITIAL_SCOPE);
  const [materials, setMaterials] = useState<MaterialLine[]>(INITIAL_MATERIALS);
  const [milestones, setMilestones] = useState<Milestone[]>(INITIAL_MILESTONES);
  const [result, setResult] = useState<SemseToolResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [researchLoading, setResearchLoading] = useState(false);

  const gallonsNeeded = useMemo(() => calculateGallonsNeeded(input), [input]);
  const netArea = useMemo(() => calculateNetArea(input), [input]);

  async function calculate() {
    setLoading(true);
    setError(null);
    try {
      const response = await calculateSemseTool({
        tool: "painting",
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

  async function handleResearch(query: string) {
    setResearchLoading(true);
    try {
      const response = await researchElectricalTool({ query });
      console.log("Research result:", response);
    } catch (exception) {
      setError(exception instanceof Error ? exception.message : "Research failed");
    } finally {
      setResearchLoading(false);
    }
  }

  function renderSection(): ReactNode {
    switch (section) {
      case "dashboard":
        return (
          <div className="grid gap-6">
            <div className="grid gap-4 sm:grid-cols-3">
              <Card className="p-4">
                <div className="text-sm text-muted">Net Area</div>
                <div className="text-2xl font-bold">{netArea.toFixed(0)} sqft</div>
              </Card>
              <Card className="p-4">
                <div className="text-sm text-muted">Gallons Needed</div>
                <div className="text-2xl font-bold">{gallonsNeeded} gal</div>
              </Card>
              <Card className="p-4">
                <div className="text-sm text-muted">Est. Labor</div>
                <div className="text-2xl font-bold">{Math.ceil(netArea / 200)}-{Math.ceil(netArea / 150)} hrs</div>
              </Card>
            </div>

            <Card className="p-6">
              <h3 className="mb-4 font-semibold">Project Status</h3>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span>Preparation</span>
                  <span className="text-green-500">Complete</span>
                </div>
                <div className="flex justify-between">
                  <span>Primer</span>
                  <span className="text-yellow-500">In Progress (50%)</span>
                </div>
                <div className="flex justify-between">
                  <span>Final Coats</span>
                  <span className="text-gray-500">Pending</span>
                </div>
              </div>
            </Card>
          </div>
        );

      case "estimate":
        return (
          <div className="grid gap-6">
            <Card className="p-6">
              <h3 className="mb-4 font-semibold">Input Parameters</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <Input label="Room Length (ft)" type="number" value={input.roomLengthFt} onChange={(e) => setInput({...input, roomLengthFt: Number(e.target.value)})} />
                <Input label="Room Width (ft)" type="number" value={input.roomWidthFt} onChange={(e) => setInput({...input, roomWidthFt: Number(e.target.value)})} />
                <Input label="Wall Height (ft)" type="number" value={input.wallHeightFt} onChange={(e) => setInput({...input, wallHeightFt: Number(e.target.value)})} />
                <Input label="Doors" type="number" value={input.doors} onChange={(e) => setInput({...input, doors: Number(e.target.value)})} />
                <Input label="Windows" type="number" value={input.windows} onChange={(e) => setInput({...input, windows: Number(e.target.value)})} />
                <Input label="Coats" type="number" value={input.coats} onChange={(e) => setInput({...input, coats: Number(e.target.value)})} />
                <Select label="Surface Type" value={input.surfaceType} onChange={(e) => setInput({...input, surfaceType: e.target.value as any})}>
                  <option value="smooth">Smooth</option>
                  <option value="textured">Textured</option>
                  <option value="newDrywall">New Drywall</option>
                  <option value="exterior">Exterior</option>
                </Select>
                <Select label="Paint Quality" value={input.paintQuality} onChange={(e) => setInput({...input, paintQuality: e.target.value as any})}>
                  <option value="economy">Economy</option>
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
              <Select label="Project Type" value={scope.projectType} onChange={(e) => setScope({...scope, projectType: e.target.value as any})}>
                <option value="interior">Interior</option>
                <option value="exterior">Exterior</option>
                <option value="accent">Accent Walls</option>
              </Select>
              <Input label="Area (sqft)" type="number" value={scope.areaSqFt} onChange={(e) => setScope({...scope, areaSqFt: Number(e.target.value)})} />
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
              <h3 className="mb-4 font-semibold">Materials List</h3>
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
                      <td colSpan={4} className="text-right font-semibold">Total Materials:</td>
                      <td className="text-right font-bold">{formatCurrency(materials.reduce((sum, m) => sum + m.quantity * m.unitCost, 0))}</td>
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
            <h3 className="mb-4 font-semibold">Project Summary</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <div className="text-sm text-muted">Net Paintable Area</div>
                <div className="text-2xl font-bold">{netArea.toFixed(0)} sqft</div>
              </div>
              <div>
                <div className="text-sm text-muted">Paint Needed</div>
                <div className="text-2xl font-bold">{gallonsNeeded} gallons</div>
              </div>
              <div>
                <div className="text-sm text-muted">Estimated Labor</div>
                <div className="text-2xl font-bold">{Math.ceil(netArea / 175)} hours</div>
              </div>
              <div>
                <div className="text-sm text-muted">Status</div>
                <div className="text-2xl font-bold text-yellow-500">In Progress</div>
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
                  <div className="text-sm text-muted">{m.date}</div>
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
              <div className="flex items-center gap-2">
                <input type="checkbox" defaultChecked className="rounded" />
                <span>Surface properly cleaned and prepped</span>
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" defaultChecked className="rounded" />
                <span>Primer applied evenly, 2 coats</span>
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" className="rounded" />
                <span>Paint mixed to correct consistency</span>
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" className="rounded" />
                <span>Proper drying time between coats</span>
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" className="rounded" />
                <span>Trim and edges clean and crisp</span>
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" className="rounded" />
                <span>No runs, drips, or sags visible</span>
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" className="rounded" />
                <span>Client final approval received</span>
              </div>
            </div>
          </Card>
        );

      case "research":
        return (
          <Card className="p-6">
            <h3 className="mb-4 font-semibold">Surface Prep Research & Guide</h3>
            <div className="space-y-4">
              <Input placeholder="Search painting techniques, materials, prep..." />
              <Button onClick={() => handleResearch("surface preparation for textured walls")} disabled={researchLoading}>
                {researchLoading ? "Searching..." : "Search TradeGuide"}
              </Button>
              <div className="rounded bg-blue-500/5 p-4 text-sm text-muted">
                <p>Connected to SEMSE Trade Knowledge Library with 15+ painting guides, surface prep methods, and material recommendations.</p>
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
            <Brush className="h-8 w-8" />
            <h1 className="text-3xl font-bold tracking-tight text-ink">Painting Tool</h1>
          </div>
          <p className="max-w-3xl text-sm text-muted">
            Complete painting estimation, scope management, materials tracking, milestones, and research-backed guidance for interior & exterior projects.
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
