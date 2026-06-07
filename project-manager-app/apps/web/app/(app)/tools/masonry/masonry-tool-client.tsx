"use client";
import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { ArrowLeft, Calculator, CheckCircle2, ClipboardCheck, ClipboardList, Globe2, LayoutDashboard, Package, ReceiptText, ShieldCheck, Hammer } from "lucide-react";
import { Badge, Button, Card, Input, Select } from "@/components/ui";
import { calculateSemseTool, type SemseToolResult, type ToolMode } from "@/app/lib/semse-tools-api";
import { ToolResultPanel } from "../ToolResultPanel";

export type MasonrySection = "dashboard" | "estimate" | "scope" | "materials" | "summary" | "milestones" | "inspection" | "research";

type MasonryInput = {
  squareFeet: number;
  material: "brick" | "stone" | "block" | "pavers";
  style: "single_wythe" | "double_wythe" | "veneer" | "specialty";
  mortar: "standard" | "colored" | "specialty";
  labor: "basic" | "skilled" | "master";
  pattern: "running_bond" | "flemish" | "herringbone" | "custom";
  condition: "new" | "repair" | "restoration";
  mode: ToolMode;
};

const INITIAL_INPUT: MasonryInput = {
  squareFeet: 400,
  material: "brick",
  style: "single_wythe",
  mortar: "standard",
  labor: "skilled",
  pattern: "running_bond",
  condition: "new",
  mode: "professional",
};

const SECTIONS: Array<{ id: MasonrySection; label: string; href: string; icon: LucideIcon }> = [
  { id: "dashboard", label: "Dashboard", href: "/tools/masonry/dashboard", icon: LayoutDashboard },
  { id: "estimate", label: "Estimacion", href: "/tools/masonry/estimate", icon: Calculator },
  { id: "scope", label: "Alcance", href: "/tools/masonry/scope", icon: ClipboardList },
  { id: "materials", label: "Materiales", href: "/tools/masonry/materials", icon: Package },
  { id: "summary", label: "Resumen", href: "/tools/masonry/summary", icon: ReceiptText },
  { id: "milestones", label: "Milestones", href: "/tools/masonry/milestones", icon: ShieldCheck },
  { id: "inspection", label: "Inspeccion", href: "/tools/masonry/inspection", icon: ClipboardCheck },
  { id: "research", label: "Research", href: "/tools/masonry/research", icon: Globe2 },
];

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
}

type MasonryToolClientProps = { section: MasonrySection };

export function MasonryToolClient({ section }: MasonryToolClientProps) {
  const [input, setInput] = useState<MasonryInput>(INITIAL_INPUT);
  const [result, setResult] = useState<SemseToolResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const costPerSqft = useMemo(() => {
    const materialCost: Record<typeof input.material, number> = {
      brick: 8.0, stone: 18.0, block: 6.0, pavers: 12.0,
    };
    const base = materialCost[input.material];
    const laborFactor = { basic: 1.0, skilled: 1.4, master: 2.0 }[input.labor];
    const styleFactor = { single_wythe: 1.0, double_wythe: 1.8, veneer: 1.3, specialty: 2.2 }[input.style];
    const patternFactor = { running_bond: 1.0, flemish: 1.1, herringbone: 1.3, custom: 1.6 }[input.pattern];
    const conditionFactor = { new: 1.0, repair: 1.2, restoration: 1.8 }[input.condition];
    return base * laborFactor * styleFactor * patternFactor * conditionFactor;
  }, [input.material, input.labor, input.style, input.pattern, input.condition]);

  const estimatedCost = useMemo(() => input.squareFeet * costPerSqft * 1.1, [input.squareFeet, costPerSqft]);

  async function calculate() {
    setLoading(true);
    setError(null);
    try {
      const response = await calculateSemseTool({ tool: "masonry", mode: input.mode, input });
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
              <h3 className="mb-4 font-semibold">Masonry Parameters</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <Input label="Square Feet" type="number" value={input.squareFeet} onChange={(e) => setInput({...input, squareFeet: Number(e.target.value)})} />
                <Select label="Material" value={input.material} onChange={(e) => setInput({...input, material: e.target.value as any})}>
                  <option value="brick">Brick</option>
                  <option value="stone">Stone</option>
                  <option value="block">Block</option>
                  <option value="pavers">Pavers</option>
                </Select>
                <Select label="Labor Level" value={input.labor} onChange={(e) => setInput({...input, labor: e.target.value as any})}>
                  <option value="basic">Basic</option>
                  <option value="skilled">Skilled</option>
                  <option value="master">Master</option>
                </Select>
                <Select label="Pattern" value={input.pattern} onChange={(e) => setInput({...input, pattern: e.target.value as any})}>
                  <option value="running_bond">Running Bond</option>
                  <option value="flemish">Flemish</option>
                  <option value="herringbone">Herringbone</option>
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
        return <Card className="p-6"><h3 className="mb-4 font-semibold">Project Scope</h3><p className="text-sm text-muted">Area: {input.squareFeet} sqft • Material: {input.material} • Style: {input.style}</p></Card>;
      case "materials":
        return <Card className="p-6"><h3 className="mb-4 font-semibold">Materials Takeoff</h3><p className="text-sm text-muted">Units: {Math.round(input.squareFeet / 1.3)} • Mortar: varies • Cost/sqft: {formatCurrency(costPerSqft)}</p></Card>;
      case "summary":
        return <Card className="p-6"><h3 className="mb-4 font-semibold">Masonry Summary</h3><p className="text-sm text-muted">Est: {formatCurrency(estimatedCost)} • {input.squareFeet} sqft</p></Card>;
      case "milestones":
        return <Card className="p-6"><h3 className="mb-4 font-semibold">Project Milestones</h3><p className="text-sm text-muted">Layout & foundation, material prep, installation, mortar joints, curing...</p></Card>;
      case "inspection":
        return <Card className="p-6"><h3 className="mb-4 font-semibold">Quality Checklist</h3><p className="text-sm text-muted">Level/plumb, joint consistency, mortar fill, pattern alignment, durability...</p></Card>;
      case "research":
        return <Card className="p-6"><h3 className="mb-4 font-semibold">Masonry Research</h3><Input placeholder="Search materials, patterns, building codes, preservation..." /></Card>;
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
          <div className="flex items-center gap-3"><Hammer className="h-8 w-8" /><h1 className="text-3xl font-bold tracking-tight text-ink">Masonry Tool</h1></div>
          <p className="max-w-3xl text-sm text-muted">Complete masonry estimation with materials, labor, and design options.</p>
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
