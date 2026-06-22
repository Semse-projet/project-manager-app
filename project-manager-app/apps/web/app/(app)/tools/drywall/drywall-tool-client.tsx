"use client";

import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { ArrowLeft, Calculator, CheckCircle2, ClipboardCheck, ClipboardList, Globe2, LayoutDashboard, Package, ReceiptText, ShieldCheck, PanelsTopLeft } from "lucide-react";
import { Badge, Button, Card, Input, Select } from "@/components/ui";
import { calculateSemseTool, type SemseToolResult, type ToolMode } from "@/app/lib/semse-tools-api";
import { ToolResultPanel } from "../ToolResultPanel";

export type DrywallSection = "dashboard" | "estimate" | "scope" | "materials" | "summary" | "milestones" | "inspection" | "research";

type DrywallInput = {
  wallAreaSqft: number;
  ceilingAreaSqft: number;
  panelType: "regular" | "moisture-resistant" | "fire-rated";
  panelSize: "4x8" | "4x10" | "4x12";
  finishLevel: 0 | 1 | 2 | 3 | 4 | 5;
  includeCeiling: boolean;
  repairMode: boolean;
  textureMatch: boolean;
  mode: ToolMode;
};

const INITIAL_INPUT: DrywallInput = {
  wallAreaSqft: 420,
  ceilingAreaSqft: 0,
  panelType: "regular",
  panelSize: "4x8",
  finishLevel: 4,
  includeCeiling: false,
  repairMode: false,
  textureMatch: true,
  mode: "professional",
};

const SECTIONS: Array<{ id: DrywallSection; label: string; href: string; icon: LucideIcon }> = [
  { id: "dashboard", label: "Dashboard", href: "/tools/drywall/dashboard", icon: LayoutDashboard },
  { id: "estimate", label: "Estimacion", href: "/tools/drywall/estimate", icon: Calculator },
  { id: "scope", label: "Alcance", href: "/tools/drywall/scope", icon: ClipboardList },
  { id: "materials", label: "Materiales", href: "/tools/drywall/materials", icon: Package },
  { id: "summary", label: "Resumen", href: "/tools/drywall/summary", icon: ReceiptText },
  { id: "milestones", label: "Milestones", href: "/tools/drywall/milestones", icon: ShieldCheck },
  { id: "inspection", label: "Inspeccion", href: "/tools/drywall/inspection", icon: ClipboardCheck },
  { id: "research", label: "Research", href: "/tools/drywall/research", icon: Globe2 },
];

const FINISH_LABELS = ["Level 0", "Level 1", "Level 2", "Level 3", "Level 4", "Level 5"];

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
}

type DrywallToolClientProps = { section: DrywallSection };

export function DrywallToolClient({ section }: DrywallToolClientProps) {
  const [input, setInput] = useState<DrywallInput>(INITIAL_INPUT);
  const [result, setResult] = useState<SemseToolResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const totalArea = useMemo(() => input.wallAreaSqft + input.ceilingAreaSqft, [input]);
  const estimatedCost = useMemo(() => totalArea * 2.5, [totalArea]);

  async function calculate() {
    setLoading(true);
    setError(null);
    try {
      const response = await calculateSemseTool({ tool: "drywall", mode: input.mode, input });
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
              <Card className="p-4"><div className="text-sm text-muted">Total Area</div><div className="text-2xl font-bold">{totalArea} sqft</div></Card>
              <Card className="p-4"><div className="text-sm text-muted">Finish Level</div><div className="text-2xl font-bold">{FINISH_LABELS[input.finishLevel]}</div></Card>
              <Card className="p-4"><div className="text-sm text-muted">Est. Cost</div><div className="text-2xl font-bold">{formatCurrency(estimatedCost)}</div></Card>
            </div>
          </div>
        );

      case "estimate":
        return (
          <div className="grid gap-6">
            <Card className="p-6">
              <h3 className="mb-4 font-semibold">Drywall Parameters</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <Input label="Wall Area (sqft)" type="number" value={input.wallAreaSqft} onChange={(e) => setInput({...input, wallAreaSqft: Number(e.target.value)})} />
                <Input label="Ceiling Area (sqft)" type="number" value={input.ceilingAreaSqft} onChange={(e) => setInput({...input, ceilingAreaSqft: Number(e.target.value)})} />
                <Select label="Panel Type" value={input.panelType} onChange={(e) => setInput({...input, panelType: e.target.value as any})}>
                  <option value="regular">Regular</option>
                  <option value="moisture-resistant">Moisture-Resistant</option>
                  <option value="fire-rated">Fire-Rated</option>
                </Select>
                <Select label="Panel Size" value={input.panelSize} onChange={(e) => setInput({...input, panelSize: e.target.value as any})}>
                  <option value="4x8">4x8</option>
                  <option value="4x10">4x10</option>
                  <option value="4x12">4x12</option>
                </Select>
                <Select label="Finish Level" value={String(input.finishLevel)} onChange={(e) => setInput({...input, finishLevel: Number(e.target.value) as any})}>
                  {[0, 1, 2, 3, 4, 5].map((l) => <option key={l} value={l}>{FINISH_LABELS[l]}</option>)}
                </Select>
              </div>
              <Button className="mt-4 w-full" onClick={calculate} disabled={loading}>{loading ? "Calculating..." : "Calculate"}</Button>
            </Card>
            {result && <ToolResultPanel result={result} />}
            {error && <div className="rounded bg-red-500/10 p-4 text-red-500">{error}</div>}
          </div>
        );

      case "scope":
        return <Card className="p-6"><h3 className="mb-4 font-semibold">Project Scope</h3><p className="text-sm text-muted">Drywall installation, mudding, sanding, finishing...</p></Card>;

      case "materials":
        return <Card className="p-6"><h3 className="mb-4 font-semibold">Materials List</h3><p className="text-sm text-muted">Drywall sheets, joint compound, tape, fasteners...</p></Card>;

      case "summary":
        return <Card className="p-6"><h3 className="mb-4 font-semibold">Drywall Summary</h3><p className="text-sm text-muted">Total: {totalArea} sqft • Est: {formatCurrency(estimatedCost)}</p></Card>;

      case "milestones":
        return <Card className="p-6"><h3 className="mb-4 font-semibold">Project Milestones</h3><p className="text-sm text-muted">Framing inspection, install, mudding, sanding, finishing...</p></Card>;

      case "inspection":
        return <Card className="p-6"><h3 className="mb-4 font-semibold">Quality Checklist</h3><p className="text-sm text-muted">Smooth finish, no pops, clean joints, proper paint prep...</p></Card>;

      case "research":
        return <Card className="p-6"><h3 className="mb-4 font-semibold">Drywall Research</h3><Input placeholder="Search drywall techniques, materials..." /></Card>;

      default:
        return null;
    }
  }

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6">
      <div className="grid gap-6">
        <div className="flex items-center justify-between gap-3">
          <Link href="/tools" className="inline-flex items-center gap-2 text-sm text-muted hover:text-ink"><ArrowLeft size={16} /> Back to tools hub</Link>
          <Badge variant="brand">SEMSE Pro Tools</Badge>
        </div>
        <section className="grid gap-3">
          <div className="flex items-center gap-3"><PanelsTopLeft className="h-8 w-8" /><h1 className="text-3xl font-bold tracking-tight text-ink">Drywall Tool</h1></div>
          <p className="max-w-3xl text-sm text-muted">Complete drywall estimation with mudding, finishing levels, and quality assurance.</p>
        </section>
        <div className="flex gap-2 overflow-x-auto pb-2">
          {SECTIONS.map((s) => {
            const Icon = s.icon;
            const isActive = section === s.id;
            return (
              <Link key={s.id} href={s.href} className={`inline-flex items-center gap-2 rounded px-3 py-2 text-sm font-medium transition ${isActive ? "bg-blue-600 text-white" : "bg-slate-800 text-muted hover:bg-slate-700"}`}>
                <Icon size={16} /> {s.label}
              </Link>
            );
          })}
        </div>
        <div className="grid gap-6">{renderSection()}</div>
      </div>
    </main>
  );
}
