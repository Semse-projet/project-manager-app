"use client";
import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { ArrowLeft, Calculator, CheckCircle2, ClipboardCheck, ClipboardList, Globe2, LayoutDashboard, Package, ReceiptText, ShieldCheck, Hammer } from "lucide-react";
import { Badge, Button, Card, Input, Select } from "@/components/ui";
import { calculateSemseTool, type SemseToolResult, type ToolMode } from "@/app/lib/semse-tools-api";
import { ToolResultPanel } from "../ToolResultPanel";

export type DeckSection = "dashboard" | "estimate" | "scope" | "materials" | "summary" | "milestones" | "inspection" | "research";

type DeckInput = {
  squareFeet: number;
  height: number;
  material: "pressure_treated" | "cedar" | "composite" | "exotic_wood";
  joist_size: "2x6" | "2x8" | "2x10" | "2x12";
  railings: "basic" | "standard" | "custom";
  stairs: number;
  complexity: "simple" | "moderate" | "complex";
  mode: ToolMode;
};

const INITIAL_INPUT: DeckInput = {
  squareFeet: 300,
  height: 2,
  material: "pressure_treated",
  joist_size: "2x8",
  railings: "standard",
  stairs: 1,
  complexity: "moderate",
  mode: "professional",
};

const SECTIONS: Array<{ id: DeckSection; label: string; href: string; icon: LucideIcon }> = [
  { id: "dashboard", label: "Dashboard", href: "/tools/deck/dashboard", icon: LayoutDashboard },
  { id: "estimate", label: "Estimacion", href: "/tools/deck/estimate", icon: Calculator },
  { id: "scope", label: "Alcance", href: "/tools/deck/scope", icon: ClipboardList },
  { id: "materials", label: "Materiales", href: "/tools/deck/materials", icon: Package },
  { id: "summary", label: "Resumen", href: "/tools/deck/summary", icon: ReceiptText },
  { id: "milestones", label: "Milestones", href: "/tools/deck/milestones", icon: ShieldCheck },
  { id: "inspection", label: "Inspeccion", href: "/tools/deck/inspection", icon: ClipboardCheck },
  { id: "research", label: "Research", href: "/tools/deck/research", icon: Globe2 },
];

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
}

type DeckToolClientProps = { section: DeckSection };

export function DeckToolClient({ section }: DeckToolClientProps) {
  const [input, setInput] = useState<DeckInput>(INITIAL_INPUT);
  const [result, setResult] = useState<SemseToolResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const costPerSqft = useMemo(() => {
    const materialCost: Record<typeof input.material, number> = {
      pressure_treated: 8.0, cedar: 12.0, composite: 15.0, exotic_wood: 22.0,
    };
    const base = materialCost[input.material];
    const heightFactor = input.height > 3 ? 1.3 : 1.0;
    const complexFactor = { simple: 1.0, moderate: 1.2, complex: 1.6 }[input.complexity];
    const railingFactor = { basic: 1.0, standard: 1.15, custom: 1.4 }[input.railings];
    return base * heightFactor * complexFactor * railingFactor;
  }, [input.material, input.height, input.complexity, input.railings]);

  const estimatedCost = useMemo(() => input.squareFeet * costPerSqft + (input.stairs * 800), [input.squareFeet, costPerSqft, input.stairs]);

  async function calculate() {
    setLoading(true);
    setError(null);
    try {
      const response = await calculateSemseTool({ tool: "deck", mode: input.mode, input });
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
              <Card className="p-4"><div className="text-sm text-muted">Area</div><div className="text-2xl font-bold">{input.squareFeet} sqft</div></Card>
              <Card className="p-4"><div className="text-sm text-muted">Material</div><div className="text-lg font-bold">{input.material}</div></Card>
              <Card className="p-4"><div className="text-sm text-muted">Est. Cost</div><div className="text-2xl font-bold">{formatCurrency(estimatedCost)}</div></Card>
            </div>
          </div>
        );
      case "estimate":
        return (
          <div className="grid gap-6">
            <Card className="p-6">
              <h3 className="mb-4 font-semibold">Deck Parameters</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <Input label="Square Feet" type="number" value={input.squareFeet} onChange={(e) => setInput({...input, squareFeet: Number(e.target.value)})} />
                <Input label="Height (ft)" type="number" value={input.height} onChange={(e) => setInput({...input, height: Number(e.target.value)})} />
                <Select label="Material" value={input.material} onChange={(e) => setInput({...input, material: e.target.value as any})}>
                  <option value="pressure_treated">Pressure Treated</option>
                  <option value="cedar">Cedar</option>
                  <option value="composite">Composite</option>
                  <option value="exotic_wood">Exotic Wood</option>
                </Select>
                <Select label="Joist Size" value={input.joist_size} onChange={(e) => setInput({...input, joist_size: e.target.value as any})}>
                  <option value="2x6">2x6</option>
                  <option value="2x8">2x8</option>
                  <option value="2x10">2x10</option>
                  <option value="2x12">2x12</option>
                </Select>
              </div>
              <Button className="mt-4 w-full" onClick={calculate} disabled={loading}>{loading ? "Calculating..." : "Calculate"}</Button>
            </Card>
            {result && <ToolResultPanel result={result} />}
            {error && <div className="rounded bg-red-500/10 p-4 text-red-500">{error}</div>}
          </div>
        );
      case "scope":
        return <Card className="p-6"><h3 className="mb-4 font-semibold">Project Scope</h3><p className="text-sm text-muted">Area: {input.squareFeet} sqft • Height: {input.height}ft • Material: {input.material}</p></Card>;
      case "materials":
        return <Card className="p-6"><h3 className="mb-4 font-semibold">Materials Takeoff</h3><p className="text-sm text-muted">Decking: {input.squareFeet} sqft • Joist: {input.joist_size} • Cost/sqft: {formatCurrency(costPerSqft)}</p></Card>;
      case "summary":
        return <Card className="p-6"><h3 className="mb-4 font-semibold">Deck Summary</h3><p className="text-sm text-muted">Est: {formatCurrency(estimatedCost)} • {input.squareFeet} sqft • {input.material}</p></Card>;
      case "milestones":
        return <Card className="p-6"><h3 className="mb-4 font-semibold">Project Milestones</h3><p className="text-sm text-muted">Foundation & posts, framing, decking, railings, stairs, finishing...</p></Card>;
      case "inspection":
        return <Card className="p-6"><h3 className="mb-4 font-semibold">Quality Checklist</h3><p className="text-sm text-muted">Structural integrity, board spacing, fastening, railings, post footings...</p></Card>;
      case "research":
        return <Card className="p-6"><h3 className="mb-4 font-semibold">Deck Research</h3><Input placeholder="Search materials, building codes, maintenance, design trends..." /></Card>;
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
          <div className="flex items-center gap-3"><Hammer className="h-8 w-8" /><h1 className="text-3xl font-bold tracking-tight text-ink">Deck Tool</h1></div>
          <p className="max-w-3xl text-sm text-muted">Complete deck estimation with materials, labor, and design options.</p>
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
