"use client";

import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { ArrowLeft, Calculator, CheckCircle2, ClipboardCheck, ClipboardList, Globe2, LayoutDashboard, Package, ReceiptText, ShieldCheck, Building } from "lucide-react";
import { Badge, Button, Card, Input, Select } from "@/components/ui";
import { calculateSemseTool, type SemseToolResult, type ToolMode } from "@/app/lib/semse-tools-api";
import { ToolResultPanel } from "../ToolResultPanel";

export type RoofingSection = "dashboard" | "estimate" | "scope" | "materials" | "summary" | "milestones" | "inspection" | "research";

type RoofingInput = {
  roofAreaSqft: number;
  roofPitch: "low" | "moderate" | "steep" | "very_steep";
  materialType: "asphalt_shingles" | "metal" | "tile" | "slate" | "wood_shakes" | "flat_membrane";
  quality: "budget" | "standard" | "premium" | "luxury";
  removeOldRoof: boolean;
  underlaymentUpgrade: boolean;
  ventilationImprovement: boolean;
  guttersIncluded: boolean;
  mode: ToolMode;
};

const INITIAL_INPUT: RoofingInput = {
  roofAreaSqft: 1800,
  roofPitch: "moderate",
  materialType: "asphalt_shingles",
  quality: "standard",
  removeOldRoof: true,
  underlaymentUpgrade: false,
  ventilationImprovement: false,
  guttersIncluded: false,
  mode: "professional",
};

const SECTIONS: Array<{ id: RoofingSection; label: string; href: string; icon: LucideIcon }> = [
  { id: "dashboard", label: "Dashboard", href: "/tools/roofing/dashboard", icon: LayoutDashboard },
  { id: "estimate", label: "Estimacion", href: "/tools/roofing/estimate", icon: Calculator },
  { id: "scope", label: "Alcance", href: "/tools/roofing/scope", icon: ClipboardList },
  { id: "materials", label: "Materiales", href: "/tools/roofing/materials", icon: Package },
  { id: "summary", label: "Resumen", href: "/tools/roofing/summary", icon: ReceiptText },
  { id: "milestones", label: "Milestones", href: "/tools/roofing/milestones", icon: ShieldCheck },
  { id: "inspection", label: "Inspeccion", href: "/tools/roofing/inspection", icon: ClipboardCheck },
  { id: "research", label: "Research", href: "/tools/roofing/research", icon: Globe2 },
];

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
}

type RoofingToolClientProps = { section: RoofingSection };

export function RoofingToolClient({ section }: RoofingToolClientProps) {
  const [input, setInput] = useState<RoofingInput>(INITIAL_INPUT);
  const [result, setResult] = useState<SemseToolResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const costPerSqft = useMemo(() => {
    const baseCost: Record<typeof input.materialType, number> = {
      asphalt_shingles: 3.5, metal: 8.0, tile: 12.0, slate: 15.0, wood_shakes: 10.0, flat_membrane: 5.0,
    };
    const base = baseCost[input.materialType] || 5.0;
    const pitchMultiplier = { low: 1.0, moderate: 1.15, steep: 1.35, very_steep: 1.6 }[input.roofPitch];
    const qualityMultiplier = { budget: 0.8, standard: 1.0, premium: 1.3, luxury: 1.8 }[input.quality];
    const removalFactor = input.removeOldRoof ? 1.2 : 0.7;
    return base * pitchMultiplier * qualityMultiplier * removalFactor;
  }, [input.materialType, input.roofPitch, input.quality, input.removeOldRoof]);

  const estimatedCost = useMemo(() => input.roofAreaSqft * costPerSqft * 1.1, [input.roofAreaSqft, costPerSqft]);

  async function calculate() {
    setLoading(true);
    setError(null);
    try {
      const response = await calculateSemseTool({ tool: "roofing", mode: input.mode, input });
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
              <Card className="p-4"><div className="text-sm text-muted">Roof Area</div><div className="text-2xl font-bold">{input.roofAreaSqft.toFixed(0)} sqft</div></Card>
              <Card className="p-4"><div className="text-sm text-muted">Material</div><div className="text-lg font-bold capitalize">{input.materialType.replace(/_/g, ' ')}</div></Card>
              <Card className="p-4"><div className="text-sm text-muted">Est. Cost</div><div className="text-2xl font-bold">{formatCurrency(estimatedCost)}</div></Card>
            </div>
          </div>
        );

      case "estimate":
        return (
          <div className="grid gap-6">
            <Card className="p-6">
              <h3 className="mb-4 font-semibold">Roofing Parameters</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <Input label="Roof Area (sqft)" type="number" value={input.roofAreaSqft} onChange={(e) => setInput({...input, roofAreaSqft: Number(e.target.value)})} />
                <Select label="Pitch" value={input.roofPitch} onChange={(e) => setInput({...input, roofPitch: e.target.value as any})}>
                  <option value="low">Low (1:12 - 2:12)</option>
                  <option value="moderate">Moderate (4:12 - 6:12)</option>
                  <option value="steep">Steep (8:12 - 10:12)</option>
                  <option value="very_steep">Very Steep (12:12+)</option>
                </Select>
                <Select label="Material" value={input.materialType} onChange={(e) => setInput({...input, materialType: e.target.value as any})}>
                  <option value="asphalt_shingles">Asphalt Shingles</option>
                  <option value="metal">Metal</option>
                  <option value="tile">Tile</option>
                  <option value="slate">Slate</option>
                  <option value="wood_shakes">Wood Shakes</option>
                  <option value="flat_membrane">Flat Membrane</option>
                </Select>
                <Select label="Quality" value={input.quality} onChange={(e) => setInput({...input, quality: e.target.value as any})}>
                  <option value="budget">Budget</option>
                  <option value="standard">Standard</option>
                  <option value="premium">Premium</option>
                  <option value="luxury">Luxury</option>
                </Select>
              </div>
              <Button className="mt-4 w-full" onClick={calculate} disabled={loading}>{loading ? "Calculating..." : "Calculate"}</Button>
            </Card>
            {result && <ToolResultPanel result={result} />}
            {error && <div className="rounded bg-red-500/10 p-4 text-red-500">{error}</div>}
          </div>
        );

      case "scope":
        return <Card className="p-6"><h3 className="mb-4 font-semibold">Project Scope</h3><p className="text-sm text-muted">Roof area: {input.roofAreaSqft.toFixed(0)} sqft • Pitch: {input.roofPitch} • Material: {input.materialType}</p></Card>;

      case "materials":
        return <Card className="p-6"><h3 className="mb-4 font-semibold">Materials Takeoff</h3><p className="text-sm text-muted">{input.materialType}: {input.roofAreaSqft.toFixed(0)} sqft • Quality: {input.quality} • Cost/sqft: {formatCurrency(costPerSqft)}</p></Card>;

      case "summary":
        return <Card className="p-6"><h3 className="mb-4 font-semibold">Roofing Summary</h3><p className="text-sm text-muted">Est: {formatCurrency(estimatedCost)} • {input.roofAreaSqft.toFixed(0)} sqft • {input.materialType}</p></Card>;

      case "milestones":
        return <Card className="p-6"><h3 className="mb-4 font-semibold">Project Milestones</h3><p className="text-sm text-muted">Inspection & permit, removal, substrate prep, new roof install, flashing & gutters, cleanup...</p></Card>;

      case "inspection":
        return <Card className="p-6"><h3 className="mb-4 font-semibold">Quality Checklist</h3><p className="text-sm text-muted">Shingle/panel alignment, fastening, flashing integrity, gutter function, ventilation, warranty compliance...</p></Card>;

      case "research":
        return <Card className="p-6"><h3 className="mb-4 font-semibold">Roofing Research</h3><Input placeholder="Search roofing materials, lifespan, energy efficiency, maintenance..." /></Card>;

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
          <div className="flex items-center gap-3"><Building className="h-8 w-8" /><h1 className="text-3xl font-bold tracking-tight text-ink">Roofing Tool</h1></div>
          <p className="max-w-3xl text-sm text-muted">Complete roofing estimation with materials, labor, and installation options.</p>
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
