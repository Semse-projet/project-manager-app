"use client";
import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { ArrowLeft, Calculator, ClipboardCheck, ClipboardList, Globe2, LayoutDashboard, Package, ReceiptText, ShieldCheck, Fence } from "lucide-react";
import { Badge, Button, Card, Input, Select } from "@/components/ui";
import { calculateSemseTool, type SemseToolResult, type ToolMode } from "@/app/lib/semse-tools-api";
import { ToolResultPanel } from "../ToolResultPanel";

export type FencingSection = "dashboard" | "estimate" | "scope" | "materials" | "summary" | "milestones" | "inspection" | "research";
type FencingInput = { linearFt: number; material: "wood" | "vinyl" | "metal" | "composite"; height: "3ft" | "4ft" | "6ft" | "8ft"; style: "picket" | "privacy" | "ranch" | "lattice"; postSpacing: number; gates: number; mode: ToolMode };

const INITIAL_INPUT: FencingInput = { linearFt: 200, material: "wood", height: "6ft", style: "privacy", postSpacing: 6, gates: 1, mode: "professional" };
const SECTIONS: Array<{ id: FencingSection; label: string; href: string; icon: LucideIcon }> = [
  { id: "dashboard", label: "Dashboard", href: "/tools/fencing/dashboard", icon: LayoutDashboard },
  { id: "estimate", label: "Estimacion", href: "/tools/fencing/estimate", icon: Calculator },
  { id: "scope", label: "Alcance", href: "/tools/fencing/scope", icon: ClipboardList },
  { id: "materials", label: "Materiales", href: "/tools/fencing/materials", icon: Package },
  { id: "summary", label: "Resumen", href: "/tools/fencing/summary", icon: ReceiptText },
  { id: "milestones", label: "Milestones", href: "/tools/fencing/milestones", icon: ShieldCheck },
  { id: "inspection", label: "Inspeccion", href: "/tools/fencing/inspection", icon: ClipboardCheck },
  { id: "research", label: "Research", href: "/tools/fencing/research", icon: Globe2 },
];

function formatCurrency(v: number) { return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(v); }

export function FencingToolClient({ section }: { section: FencingSection }) {
  const [input, setInput] = useState<FencingInput>(INITIAL_INPUT);
  const [result, setResult] = useState<SemseToolResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const costPerFt = useMemo(() => {
    const matCost: Record<typeof input.material, number> = { wood: 15, vinyl: 25, metal: 20, composite: 30 };
    const base = matCost[input.material];
    const heightFactor = { "3ft": 0.8, "4ft": 1, "6ft": 1.3, "8ft": 1.6 }[input.height];
    const styleFactor = { picket: 1, privacy: 1.2, ranch: 1.1, lattice: 1.4 }[input.style];
    return base * heightFactor * styleFactor;
  }, [input.material, input.height, input.style]);

  const estimatedCost = useMemo(() => (input.linearFt * costPerFt) + (input.gates * 400), [input.linearFt, costPerFt, input.gates]);

  async function calculate() {
    setLoading(true);
    try {
      const response = await calculateSemseTool({ tool: "fencing", mode: input.mode, input });
      setResult(response);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  function renderSection(): ReactNode {
    switch (section) {
      case "dashboard": return <div className="grid gap-6"><div className="grid gap-4 sm:grid-cols-3"><Card className="p-4"><div className="text-sm text-muted">Linear Feet</div><div className="text-2xl font-bold">{input.linearFt}</div></Card><Card className="p-4"><div className="text-sm text-muted">Material</div><div className="text-lg font-bold">{input.material}</div></Card><Card className="p-4"><div className="text-sm text-muted">Est. Cost</div><div className="text-2xl font-bold">{formatCurrency(estimatedCost)}</div></Card></div></div>;
      case "estimate": return <div className="grid gap-6"><Card className="p-6"><h3 className="mb-4 font-semibold">Fencing Parameters</h3><div className="grid gap-4 sm:grid-cols-2"><Input label="Linear Feet" type="number" value={input.linearFt} onChange={(e) => setInput({...input, linearFt: Number(e.target.value)})} /><Select label="Material" value={input.material} onChange={(e) => setInput({...input, material: e.target.value as any})}><option value="wood">Wood</option><option value="vinyl">Vinyl</option><option value="metal">Metal</option><option value="composite">Composite</option></Select><Select label="Height" value={input.height} onChange={(e) => setInput({...input, height: e.target.value as any})}><option value="3ft">3ft</option><option value="4ft">4ft</option><option value="6ft">6ft</option><option value="8ft">8ft</option></Select><Select label="Style" value={input.style} onChange={(e) => setInput({...input, style: e.target.value as any})}><option value="picket">Picket</option><option value="privacy">Privacy</option><option value="ranch">Ranch</option><option value="lattice">Lattice</option></Select><Input label="Post Spacing (ft)" type="number" value={input.postSpacing} onChange={(e) => setInput({...input, postSpacing: Number(e.target.value)})} /><Input label="Gates" type="number" value={input.gates} onChange={(e) => setInput({...input, gates: Number(e.target.value)})} /></div><Button className="mt-4 w-full" onClick={calculate} disabled={loading}>{loading ? "Calculating..." : "Calculate"}</Button></Card>{result && <ToolResultPanel result={result} />}{error && <div className="rounded bg-red-500/10 p-4 text-red-500">{error}</div>}</div>;
      case "scope": return <Card className="p-6"><h3 className="mb-4 font-semibold">Project Scope</h3><p className="text-sm text-muted">Linear Feet: {input.linearFt} • Material: {input.material} • Height: {input.height} • Gates: {input.gates}</p></Card>;
      case "materials": return <Card className="p-6"><h3 className="mb-4 font-semibold">Materials Takeoff</h3><p className="text-sm text-muted">Fencing: {input.linearFt} ft • Posts: {Math.round(input.linearFt / input.postSpacing)} • Gates: {input.gates} • Cost/ft: {formatCurrency(costPerFt)}</p></Card>;
      case "summary": return <Card className="p-6"><h3 className="mb-4 font-semibold">Fencing Summary</h3><p className="text-sm text-muted">Est: {formatCurrency(estimatedCost)} • {input.linearFt} ft • {input.material}</p></Card>;
      case "milestones": return <Card className="p-6"><h3 className="mb-4 font-semibold">Project Milestones</h3><p className="text-sm text-muted">Site survey, material delivery, post installation, panel installation, gates, finishing</p></Card>;
      case "inspection": return <Card className="p-6"><h3 className="mb-4 font-semibold">Quality Checklist</h3><p className="text-sm text-muted">Post alignment, panel spacing, gate function, finish quality, property line compliance</p></Card>;
      case "research": return <Card className="p-6"><h3 className="mb-4 font-semibold">Fencing Research</h3><Input placeholder="Search materials, styles, local codes, maintenance..." /></Card>;
      default: return null;
    }
  }

  return <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6"><div className="grid gap-6"><div className="flex items-center justify-between gap-3"><Link href="/tools" className="inline-flex items-center gap-2 text-sm text-muted hover:text-ink"><ArrowLeft size={16} /> Back to tools hub</Link><Badge variant="brand">SEMSE Pro Tools</Badge></div><section className="grid gap-3"><div className="flex items-center gap-3"><Fence className="h-8 w-8" /><h1 className="text-3xl font-bold tracking-tight text-ink">Fencing Tool</h1></div><p className="max-w-3xl text-sm text-muted">Complete fencing estimation with materials, styles, and installation options.</p></section><div className="flex gap-2 overflow-x-auto pb-2">{SECTIONS.map((s) => {const Icon = s.icon; const isActive = section === s.id; return <Link key={s.id} href={s.href} className={`inline-flex items-center gap-2 rounded px-3 py-2 text-sm font-medium transition ${isActive ? "bg-blue-600 text-white" : "bg-slate-800 text-muted hover:bg-slate-700"}`}><Icon size={16} /> {s.label}</Link>;})}</div><div className="grid gap-6">{renderSection()}</div></div></main>;
}
