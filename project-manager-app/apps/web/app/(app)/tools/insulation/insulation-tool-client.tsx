"use client";
import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { ArrowLeft, Calculator, ClipboardCheck, ClipboardList, Globe2, LayoutDashboard, Package, ReceiptText, ShieldCheck, Home } from "lucide-react";
import { Badge, Button, Card, Input, Select } from "@/components/ui";
import { calculateSemseTool, type SemseToolResult, type ToolMode } from "@/app/lib/semse-tools-api";
import { ToolResultPanel } from "../ToolResultPanel";

export type InsulationSection = "dashboard" | "estimate" | "scope" | "materials" | "summary" | "milestones" | "inspection" | "research";
type InsulationInput = { squareFeet: number; material: "fiberglass" | "cellulose" | "foam" | "mineral_wool"; rValue: "R13" | "R15" | "R19" | "R21"; location: "attic" | "walls" | "basement" | "crawlspace"; removal: boolean; mode: ToolMode };

const INITIAL_INPUT: InsulationInput = { squareFeet: 1200, material: "fiberglass", rValue: "R19", location: "attic", removal: false, mode: "professional" };
const SECTIONS: Array<{ id: InsulationSection; label: string; href: string; icon: LucideIcon }> = [
  { id: "dashboard", label: "Dashboard", href: "/tools/insulation/dashboard", icon: LayoutDashboard },
  { id: "estimate", label: "Estimacion", href: "/tools/insulation/estimate", icon: Calculator },
  { id: "scope", label: "Alcance", href: "/tools/insulation/scope", icon: ClipboardList },
  { id: "materials", label: "Materiales", href: "/tools/insulation/materials", icon: Package },
  { id: "summary", label: "Resumen", href: "/tools/insulation/summary", icon: ReceiptText },
  { id: "milestones", label: "Milestones", href: "/tools/insulation/milestones", icon: ShieldCheck },
  { id: "inspection", label: "Inspeccion", href: "/tools/insulation/inspection", icon: ClipboardCheck },
  { id: "research", label: "Research", href: "/tools/insulation/research", icon: Globe2 },
];

function formatCurrency(v: number) { return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(v); }

export function InsulationToolClient({ section }: { section: InsulationSection }) {
  const [input, setInput] = useState<InsulationInput>(INITIAL_INPUT);
  const [result, setResult] = useState<SemseToolResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const costPerSqft = useMemo(() => {
    const matCost: Record<typeof input.material, number> = { fiberglass: 0.5, cellulose: 0.8, foam: 1.5, mineral_wool: 1.2 };
    const base = matCost[input.material];
    const rFactor = { R13: 0.8, R15: 1, R19: 1.2, R21: 1.4 }[input.rValue];
    const locFactor = { attic: 1, walls: 1.3, basement: 1.2, crawlspace: 1.1 }[input.location];
    const removalFactor = input.removal ? 1.3 : 1;
    return base * rFactor * locFactor * removalFactor;
  }, [input.material, input.rValue, input.location, input.removal]);

  const estimatedCost = useMemo(() => input.squareFeet * costPerSqft * 1.15, [input.squareFeet, costPerSqft]);

  async function calculate() {
    setLoading(true);
    try {
      const response = await calculateSemseTool({ tool: "insulation", mode: input.mode, input });
      setResult(response);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  function renderSection(): ReactNode {
    switch (section) {
      case "dashboard": return <div className="grid gap-6"><div className="grid gap-4 sm:grid-cols-3"><Card className="p-4"><div className="text-sm text-muted">Area</div><div className="text-2xl font-bold">{input.squareFeet} sqft</div></Card><Card className="p-4"><div className="text-sm text-muted">R-Value</div><div className="text-lg font-bold">{input.rValue}</div></Card><Card className="p-4"><div className="text-sm text-muted">Est. Cost</div><div className="text-2xl font-bold">{formatCurrency(estimatedCost)}</div></Card></div></div>;
      case "estimate": return <div className="grid gap-6"><Card className="p-6"><h3 className="mb-4 font-semibold">Insulation Parameters</h3><div className="grid gap-4 sm:grid-cols-2"><Input label="Square Feet" type="number" value={input.squareFeet} onChange={(e) => setInput({...input, squareFeet: Number(e.target.value)})} /><Select label="Material" value={input.material} onChange={(e) => setInput({...input, material: e.target.value as any})}><option value="fiberglass">Fiberglass</option><option value="cellulose">Cellulose</option><option value="foam">Foam</option><option value="mineral_wool">Mineral Wool</option></Select><Select label="R-Value" value={input.rValue} onChange={(e) => setInput({...input, rValue: e.target.value as any})}><option value="R13">R13</option><option value="R15">R15</option><option value="R19">R19</option><option value="R21">R21</option></Select><Select label="Location" value={input.location} onChange={(e) => setInput({...input, location: e.target.value as any})}><option value="attic">Attic</option><option value="walls">Walls</option><option value="basement">Basement</option><option value="crawlspace">Crawlspace</option></Select></div><div className="mt-4 flex items-center gap-2"><input type="checkbox" checked={input.removal} onChange={(e) => setInput({...input, removal: e.target.checked})} /><label>Include removal of old insulation</label></div><Button className="mt-4 w-full" onClick={calculate} disabled={loading}>{loading ? "Calculating..." : "Calculate"}</Button></Card>{result && <ToolResultPanel result={result} />}{error && <div className="rounded bg-red-500/10 p-4 text-red-500">{error}</div>}</div>;
      case "scope": return <Card className="p-6"><h3 className="mb-4 font-semibold">Project Scope</h3><p className="text-sm text-muted">Area: {input.squareFeet} sqft • {input.material} • {input.rValue} • Location: {input.location} • Removal: {input.removal ? "Yes" : "No"}</p></Card>;
      case "materials": return <Card className="p-6"><h3 className="mb-4 font-semibold">Materials Takeoff</h3><p className="text-sm text-muted">Material: {input.material} • Cost/sqft: {formatCurrency(costPerSqft)} • Total material: {formatCurrency(input.squareFeet * costPerSqft * 0.4)}</p></Card>;
      case "summary": return <Card className="p-6"><h3 className="mb-4 font-semibold">Insulation Summary</h3><p className="text-sm text-muted">Est: {formatCurrency(estimatedCost)} • {input.squareFeet} sqft • {input.material}</p></Card>;
      case "milestones": return <Card className="p-6"><h3 className="mb-4 font-semibold">Project Milestones</h3><p className="text-sm text-muted">Site inspection, old insulation removal, vapor barrier prep, new insulation installation, air sealing, final inspection</p></Card>;
      case "inspection": return <Card className="p-6"><h3 className="mb-4 font-semibold">Quality Checklist</h3><p className="text-sm text-muted">Coverage completeness, R-value verification, air sealing around gaps, moisture/vapor control, settling inspection</p></Card>;
      case "research": return <Card className="p-6"><h3 className="mb-4 font-semibold">Insulation Research</h3><Input placeholder="Search R-values, energy savings, installation methods, manufacturers..." /></Card>;
      default: return null;
    }
  }

  return <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6"><div className="grid gap-6"><div className="flex items-center justify-between gap-3"><Link href="/tools" className="inline-flex items-center gap-2 text-sm text-muted hover:text-ink"><ArrowLeft size={16} /> Back to tools hub</Link><Badge variant="brand">SEMSE Pro Tools</Badge></div><section className="grid gap-3"><div className="flex items-center gap-3"><Home className="h-8 w-8" /><h1 className="text-3xl font-bold tracking-tight text-ink">Insulation Tool</h1></div><p className="max-w-3xl text-sm text-muted">Complete insulation estimation with materials, R-values, and installation options.</p></section><div className="flex gap-2 overflow-x-auto pb-2">{SECTIONS.map((s) => {const Icon = s.icon; const isActive = section === s.id; return <Link key={s.id} href={s.href} className={`inline-flex items-center gap-2 rounded px-3 py-2 text-sm font-medium transition ${isActive ? "bg-blue-600 text-white" : "bg-slate-800 text-muted hover:bg-slate-700"}`}><Icon size={16} /> {s.label}</Link>;})}</div><div className="grid gap-6">{renderSection()}</div></div></main>;
}
