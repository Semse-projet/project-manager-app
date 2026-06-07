"use client";
import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { ArrowLeft, Calculator, CheckCircle2, ClipboardCheck, ClipboardList, Globe2, LayoutDashboard, Package, ReceiptText, ShieldCheck, Hammer } from "lucide-react";
import { Badge, Button, Card, Input, Select } from "@/components/ui";
import { calculateSemseTool, type SemseToolResult, type ToolMode } from "@/app/lib/semse-tools-api";
import { ToolResultPanel } from "../ToolResultPanel";

export type ConcreteSection = "dashboard" | "estimate" | "scope" | "materials" | "summary" | "milestones" | "inspection" | "research";

type ConcreteInput = {
  squareFeet: number;
  thickness: number;
  type: "standard" | "reinforced" | "colored" | "stamped" | "polished";
  finish: "broom" | "smooth" | "exposed_aggregate" | "custom";
  prep: "minimal" | "standard" | "extensive" | "excavation";
  reinforcement: "none" | "rebar" | "wire_mesh" | "post_tension";
  complexity: "simple" | "moderate" | "complex";
  mode: ToolMode;
};

const INITIAL_INPUT: ConcreteInput = {
  squareFeet: 500,
  thickness: 4,
  type: "standard",
  finish: "broom",
  prep: "standard",
  reinforcement: "none",
  complexity: "moderate",
  mode: "professional",
};

const SECTIONS: Array<{ id: ConcreteSection; label: string; href: string; icon: LucideIcon }> = [
  { id: "dashboard", label: "Dashboard", href: "/tools/concrete/dashboard", icon: LayoutDashboard },
  { id: "estimate", label: "Estimacion", href: "/tools/concrete/estimate", icon: Calculator },
  { id: "scope", label: "Alcance", href: "/tools/concrete/scope", icon: ClipboardList },
  { id: "materials", label: "Materiales", href: "/tools/concrete/materials", icon: Package },
  { id: "summary", label: "Resumen", href: "/tools/concrete/summary", icon: ReceiptText },
  { id: "milestones", label: "Milestones", href: "/tools/concrete/milestones", icon: ShieldCheck },
  { id: "inspection", label: "Inspeccion", href: "/tools/concrete/inspection", icon: ClipboardCheck },
  { id: "research", label: "Research", href: "/tools/concrete/research", icon: Globe2 },
];

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
}

type ConcreteToolClientProps = { section: ConcreteSection };

export function ConcreteToolClient({ section }: ConcreteToolClientProps) {
  const [input, setInput] = useState<ConcreteInput>(INITIAL_INPUT);
  const [result, setResult] = useState<SemseToolResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const costPerSqft = useMemo(() => {
    const baseCost: Record<typeof input.type, number> = {
      standard: 4.5, reinforced: 6.5, colored: 7.0, stamped: 12.0, polished: 15.0,
    };
    const base = baseCost[input.type];
    const finishFactor = { broom: 1.0, smooth: 1.1, exposed_aggregate: 1.3, custom: 1.6 }[input.finish];
    const prepFactor = { minimal: 0.8, standard: 1.0, extensive: 1.4, excavation: 2.0 }[input.prep];
    const reinforceFactor = { none: 1.0, rebar: 1.2, wire_mesh: 1.1, post_tension: 1.5 }[input.reinforcement];
    const complexFactor = { simple: 1.0, moderate: 1.2, complex: 1.5 }[input.complexity];
    return base * finishFactor * prepFactor * reinforceFactor * complexFactor;
  }, [input.type, input.finish, input.prep, input.reinforcement, input.complexity]);

  const estimatedCost = useMemo(() => input.squareFeet * costPerSqft * 1.15, [input.squareFeet, costPerSqft]);

  async function calculate() {
    setLoading(true);
    setError(null);
    try {
      const response = await calculateSemseTool({ tool: "concrete", mode: input.mode, input });
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
              <Card className="p-4"><div className="text-sm text-muted">Type</div><div className="text-lg font-bold">{input.type}</div></Card>
              <Card className="p-4"><div className="text-sm text-muted">Est. Cost</div><div className="text-2xl font-bold">{formatCurrency(estimatedCost)}</div></Card>
            </div>
          </div>
        );
      case "estimate":
        return (
          <div className="grid gap-6">
            <Card className="p-6">
              <h3 className="mb-4 font-semibold">Concrete Parameters</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <Input label="Square Feet" type="number" value={input.squareFeet} onChange={(e) => setInput({...input, squareFeet: Number(e.target.value)})} />
                <Input label="Thickness (in)" type="number" value={input.thickness} onChange={(e) => setInput({...input, thickness: Number(e.target.value)})} />
                <Select label="Type" value={input.type} onChange={(e) => setInput({...input, type: e.target.value as any})}>
                  <option value="standard">Standard</option>
                  <option value="reinforced">Reinforced</option>
                  <option value="colored">Colored</option>
                  <option value="stamped">Stamped</option>
                  <option value="polished">Polished</option>
                </Select>
                <Select label="Finish" value={input.finish} onChange={(e) => setInput({...input, finish: e.target.value as any})}>
                  <option value="broom">Broom</option>
                  <option value="smooth">Smooth</option>
                  <option value="exposed_aggregate">Exposed Aggregate</option>
                  <option value="custom">Custom</option>
                </Select>
              </div>
              <Button className="mt-4 w-full" onClick={calculate} disabled={loading}>{loading ? "Calculating..." : "Calculate"}</Button>
            </Card>
            {result && <ToolResultPanel result={result} />}
            {error && <div className="rounded bg-red-500/10 p-4 text-red-500">{error}</div>}
          </div>
        );
      case "scope":
        return <Card className="p-6"><h3 className="mb-4 font-semibold">Project Scope</h3><p className="text-sm text-muted">Area: {input.squareFeet} sqft • Thickness: {input.thickness}\" • Type: {input.type}</p></Card>;
      case "materials":
        return <Card className="p-6"><h3 className="mb-4 font-semibold">Materials Takeoff</h3><p className="text-sm text-muted">Concrete: {input.squareFeet} sqft @ {input.thickness}\" • Cost/sqft: {formatCurrency(costPerSqft)}</p></Card>;
      case "summary":
        return <Card className="p-6"><h3 className="mb-4 font-semibold">Concrete Summary</h3><p className="text-sm text-muted">Est: {formatCurrency(estimatedCost)} • {input.squareFeet} sqft</p></Card>;
      case "milestones":
        return <Card className="p-6"><h3 className="mb-4 font-semibold">Project Milestones</h3><p className="text-sm text-muted">Site prep, forming & reinforcement, pour, finishing, curing...</p></Card>;
      case "inspection":
        return <Card className="p-6"><h3 className="mb-4 font-semibold">Quality Checklist</h3><p className="text-sm text-muted">Flatness, slope, strength, finish quality, curing time, seal application...</p></Card>;
      case "research":
        return <Card className="p-6"><h3 className="mb-4 font-semibold">Concrete Research</h3><Input placeholder="Search concrete types, finishes, durability, maintenance..." /></Card>;
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
          <div className="flex items-center gap-3"><Hammer className="h-8 w-8" /><h1 className="text-3xl font-bold tracking-tight text-ink">Concrete Tool</h1></div>
          <p className="max-w-3xl text-sm text-muted">Complete concrete estimation with materials, labor, and finishing options.</p>
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
