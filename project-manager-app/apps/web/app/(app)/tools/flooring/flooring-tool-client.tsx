"use client";

import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { ArrowLeft, Calculator, CheckCircle2, ClipboardCheck, ClipboardList, Globe2, LayoutDashboard, Package, ReceiptText, ShieldCheck, Layers3 } from "lucide-react";
import { Badge, Button, Card, Input, Select } from "@/components/ui";
import { calculateSemseTool, type SemseToolResult, type ToolMode } from "@/app/lib/semse-tools-api";
import { ToolResultPanel } from "../ToolResultPanel";

export type FlooringSection = "dashboard" | "estimate" | "scope" | "materials" | "summary" | "milestones" | "inspection" | "research";

type FlooringInput = {
  lengthFt: number;
  widthFt: number;
  flooringType: "vinyl" | "laminate" | "tile" | "hardwood" | "bamboo" | "stone";
  pattern: "straight" | "diagonal" | "herringbone" | "random";
  underlaymentType: "none" | "foam" | "cork" | "luxury";
  removeOldFloor: boolean;
  floorPrepLevel: "none" | "minor" | "major" | "structural";
  laborComplexity: "simple" | "moderate" | "complex";
  mode: ToolMode;
};

const INITIAL_INPUT: FlooringInput = {
  lengthFt: 20,
  widthFt: 14,
  flooringType: "laminate",
  pattern: "straight",
  underlaymentType: "foam",
  removeOldFloor: false,
  floorPrepLevel: "minor",
  laborComplexity: "moderate",
  mode: "professional",
};

const SECTIONS: Array<{ id: FlooringSection; label: string; href: string; icon: LucideIcon }> = [
  { id: "dashboard", label: "Dashboard", href: "/tools/flooring/dashboard", icon: LayoutDashboard },
  { id: "estimate", label: "Estimacion", href: "/tools/flooring/estimate", icon: Calculator },
  { id: "scope", label: "Alcance", href: "/tools/flooring/scope", icon: ClipboardList },
  { id: "materials", label: "Materiales", href: "/tools/flooring/materials", icon: Package },
  { id: "summary", label: "Resumen", href: "/tools/flooring/summary", icon: ReceiptText },
  { id: "milestones", label: "Milestones", href: "/tools/flooring/milestones", icon: ShieldCheck },
  { id: "inspection", label: "Inspeccion", href: "/tools/flooring/inspection", icon: ClipboardCheck },
  { id: "research", label: "Research", href: "/tools/flooring/research", icon: Globe2 },
];

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
}

type FlooringToolClientProps = { section: FlooringSection };

export function FlooringToolClient({ section }: FlooringToolClientProps) {
  const [input, setInput] = useState<FlooringInput>(INITIAL_INPUT);
  const [result, setResult] = useState<SemseToolResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const areaSqft = useMemo(() => input.lengthFt * input.widthFt, [input.lengthFt, input.widthFt]);
  
  const costPerSqft = useMemo(() => {
    const baseCost: Record<typeof input.flooringType, number> = {
      vinyl: 1.5, laminate: 2.0, tile: 3.5, hardwood: 5.0, bamboo: 3.0, stone: 6.0,
    };
    const base = baseCost[input.flooringType] || 2.0;
    const prepMultiplier = { none: 0.8, minor: 1.0, major: 1.3, structural: 1.8 }[input.floorPrepLevel];
    const laborMultiplier = { simple: 1.0, moderate: 1.3, complex: 1.7 }[input.laborComplexity];
    return base * prepMultiplier * laborMultiplier;
  }, [input.flooringType, input.floorPrepLevel, input.laborComplexity]);

  const estimatedCost = useMemo(() => areaSqft * costPerSqft * 1.15, [areaSqft, costPerSqft]);

  async function calculate() {
    setLoading(true);
    setError(null);
    try {
      const response = await calculateSemseTool({ tool: "flooring", mode: input.mode, input });
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
              <Card className="p-4"><div className="text-sm text-muted">Area</div><div className="text-2xl font-bold">{areaSqft.toFixed(0)} sqft</div></Card>
              <Card className="p-4"><div className="text-sm text-muted">Type</div><div className="text-lg font-bold capitalize">{input.flooringType}</div></Card>
              <Card className="p-4"><div className="text-sm text-muted">Est. Cost</div><div className="text-2xl font-bold">{formatCurrency(estimatedCost)}</div></Card>
            </div>
          </div>
        );

      case "estimate":
        return (
          <div className="grid gap-6">
            <Card className="p-6">
              <h3 className="mb-4 font-semibold">Flooring Parameters</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <Input label="Length (ft)" type="number" value={input.lengthFt} onChange={(e) => setInput({...input, lengthFt: Number(e.target.value)})} />
                <Input label="Width (ft)" type="number" value={input.widthFt} onChange={(e) => setInput({...input, widthFt: Number(e.target.value)})} />
                <Select label="Type" value={input.flooringType} onChange={(e) => setInput({...input, flooringType: e.target.value as any})}>
                  <option value="vinyl">Vinyl</option>
                  <option value="laminate">Laminate</option>
                  <option value="tile">Tile</option>
                  <option value="hardwood">Hardwood</option>
                  <option value="bamboo">Bamboo</option>
                  <option value="stone">Stone</option>
                </Select>
                <Select label="Pattern" value={input.pattern} onChange={(e) => setInput({...input, pattern: e.target.value as any})}>
                  <option value="straight">Straight</option>
                  <option value="diagonal">Diagonal</option>
                  <option value="herringbone">Herringbone</option>
                  <option value="random">Random</option>
                </Select>
                <Select label="Prep Level" value={input.floorPrepLevel} onChange={(e) => setInput({...input, floorPrepLevel: e.target.value as any})}>
                  <option value="none">None</option>
                  <option value="minor">Minor</option>
                  <option value="major">Major</option>
                  <option value="structural">Structural</option>
                </Select>
                <Select label="Underlayment" value={input.underlaymentType} onChange={(e) => setInput({...input, underlaymentType: e.target.value as any})}>
                  <option value="none">None</option>
                  <option value="foam">Foam</option>
                  <option value="cork">Cork</option>
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
        return <Card className="p-6"><h3 className="mb-4 font-semibold">Project Scope</h3><p className="text-sm text-muted">Floor area: {areaSqft.toFixed(0)} sqft • Type: {input.flooringType} • Pattern: {input.pattern}</p></Card>;

      case "materials":
        return <Card className="p-6"><h3 className="mb-4 font-semibold">Materials Takeoff</h3><p className="text-sm text-muted">Flooring: {areaSqft.toFixed(0)} sqft • Underlayment: {input.underlaymentType} • Cost/sqft: {formatCurrency(costPerSqft)}</p></Card>;

      case "summary":
        return <Card className="p-6"><h3 className="mb-4 font-semibold">Flooring Summary</h3><p className="text-sm text-muted">Est: {formatCurrency(estimatedCost)} • {areaSqft.toFixed(0)} sqft • {input.flooringType}</p></Card>;

      case "milestones":
        return <Card className="p-6"><h3 className="mb-4 font-semibold">Project Milestones</h3><p className="text-sm text-muted">Prep & removal, underlayment install, flooring install, finishing & cleanup...</p></Card>;

      case "inspection":
        return <Card className="p-6"><h3 className="mb-4 font-semibold">Quality Checklist</h3><p className="text-sm text-muted">Flatness, alignment, seams, edge finishing, transitions, durability test...</p></Card>;

      case "research":
        return <Card className="p-6"><h3 className="mb-4 font-semibold">Flooring Research</h3><Input placeholder="Search flooring types, installation techniques, durability..." /></Card>;

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
          <div className="flex items-center gap-3"><Layers3 className="h-8 w-8" /><h1 className="text-3xl font-bold tracking-tight text-ink">Flooring Tool</h1></div>
          <p className="max-w-3xl text-sm text-muted">Complete flooring estimation with materials, labor, and installation options.</p>
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
