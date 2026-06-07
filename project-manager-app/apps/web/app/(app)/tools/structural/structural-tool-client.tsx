"use client";
import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { ArrowLeft, Calculator, ClipboardCheck, ClipboardList, Globe2, LayoutDashboard, Package, ReceiptText, ShieldCheck, Building2 } from "lucide-react";
import { Badge, Button, Card, Input, Select } from "@/components/ui";
import { calculateSemseTool, type SemseToolResult, type ToolMode } from "@/app/lib/semse-tools-api";
import { ToolResultPanel } from "../ToolResultPanel";

export type StructuralSection = "dashboard" | "estimate" | "scope" | "materials" | "summary" | "milestones" | "inspection" | "research";
type StructuralInput = { linearFt: number; workType: "beam_replacement" | "foundation_repair" | "wall_bracing" | "post_replacement" | "reinforcement"; material: "steel" | "wood" | "concrete"; scale: "small" | "medium" | "large"; mode: ToolMode };

const INITIAL_INPUT: StructuralInput = { linearFt: 100, workType: "beam_replacement", material: "steel", scale: "medium", mode: "professional" };
const SECTIONS: Array<{ id: StructuralSection; label: string; href: string; icon: LucideIcon }> = [
  { id: "dashboard", label: "Dashboard", href: "/tools/structural/dashboard", icon: LayoutDashboard },
  { id: "estimate", label: "Estimacion", href: "/tools/structural/estimate", icon: Calculator },
  { id: "scope", label: "Alcance", href: "/tools/structural/scope", icon: ClipboardList },
  { id: "materials", label: "Materiales", href: "/tools/structural/materials", icon: Package },
  { id: "summary", label: "Resumen", href: "/tools/structural/summary", icon: ReceiptText },
  { id: "milestones", label: "Milestones", href: "/tools/structural/milestones", icon: ShieldCheck },
  { id: "inspection", label: "Inspeccion", href: "/tools/structural/inspection", icon: ClipboardCheck },
  { id: "research", label: "Research", href: "/tools/structural/research", icon: Globe2 },
];

function formatCurrency(v: number) { return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(v); }

export function StructuralToolClient({ section }: { section: StructuralSection }) {
  const [input, setInput] = useState<StructuralInput>(INITIAL_INPUT);
  const [result, setResult] = useState<SemseToolResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const costPerFt = useMemo(() => {
    const workCost: Record<typeof input.workType, number> = { beam_replacement: 400, foundation_repair: 600, wall_bracing: 300, post_replacement: 250, reinforcement: 350 };
    const base = workCost[input.workType];
    const matFactor = { steel: 1.5, wood: 1, concrete: 1.2 }[input.material];
    const scaleFactor = { small: 1, medium: 1.2, large: 1.5 }[input.scale];
    return base * matFactor * scaleFactor;
  }, [input.workType, input.material, input.scale]);

  const estimatedCost = useMemo(() => input.linearFt * costPerFt * 1.25, [input.linearFt, costPerFt]);

  async function calculate() {
    setLoading(true);
    try {
      const response = await calculateSemseTool({ tool: "structural", mode: input.mode, input });
      setResult(response);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  function renderSection(): ReactNode {
    switch (section) {
      case "dashboard": return <div className="grid gap-6"><div className="grid gap-4 sm:grid-cols-3"><Card className="p-4"><div className="text-sm text-muted">Linear Feet</div><div className="text-2xl font-bold">{input.linearFt}</div></Card><Card className="p-4"><div className="text-sm text-muted">Work Type</div><div className="text-lg font-bold">{input.workType.replace(/_/g, " ")}</div></Card><Card className="p-4"><div className="text-sm text-muted">Est. Cost</div><div className="text-2xl font-bold">{formatCurrency(estimatedCost)}</div></Card></div></div>;
      case "estimate": return <div className="grid gap-6"><Card className="p-6"><h3 className="mb-4 font-semibold">Structural Work Parameters</h3><div className="grid gap-4 sm:grid-cols-2"><Input label="Linear Feet" type="number" value={input.linearFt} onChange={(e) => setInput({...input, linearFt: Number(e.target.value)})} /><Select label="Work Type" value={input.workType} onChange={(e) => setInput({...input, workType: e.target.value as any})}><option value="beam_replacement">Beam Replacement</option><option value="foundation_repair">Foundation Repair</option><option value="wall_bracing">Wall Bracing</option><option value="post_replacement">Post Replacement</option><option value="reinforcement">Structural Reinforcement</option></Select><Select label="Material" value={input.material} onChange={(e) => setInput({...input, material: e.target.value as any})}><option value="steel">Steel</option><option value="wood">Wood</option><option value="concrete">Concrete</option></Select><Select label="Scale" value={input.scale} onChange={(e) => setInput({...input, scale: e.target.value as any})}><option value="small">Small</option><option value="medium">Medium</option><option value="large">Large</option></Select></div><Button className="mt-4 w-full" onClick={calculate} disabled={loading}>{loading ? "Calculating..." : "Calculate"}</Button></Card>{result && <ToolResultPanel result={result} />}{error && <div className="rounded bg-red-500/10 p-4 text-red-500">{error}</div>}</div>;
      case "scope": return <Card className="p-6"><h3 className="mb-4 font-semibold">Project Scope</h3><p className="text-sm text-muted">Linear Feet: {input.linearFt} • Work: {input.workType} • Material: {input.material} • Scale: {input.scale}</p></Card>;
      case "materials": return <Card className="p-6"><h3 className="mb-4 font-semibold">Structural Materials</h3><p className="text-sm text-muted">Material: {input.material} • Cost/ft: {formatCurrency(costPerFt)} • Engineering specs required</p></Card>;
      case "summary": return <Card className="p-6"><h3 className="mb-4 font-semibold">Structural Summary</h3><p className="text-sm text-muted">Est: {formatCurrency(estimatedCost)} • {input.linearFt} ft • {input.workType}</p></Card>;
      case "milestones": return <Card className="p-6"><h3 className="mb-4 font-semibold">Project Milestones</h3><p className="text-sm text-muted">Engineering assessment, permit approval, material procurement, installation, load testing, inspection</p></Card>;
      case "inspection": return <Card className="p-6"><h3 className="mb-4 font-semibold">Quality Checklist</h3><p className="text-sm text-muted">Load capacity verification, proper installation, engineering compliance, safety inspection, code approval</p></Card>;
      case "research": return <Card className="p-6"><h3 className="mb-4 font-semibold">Structural Research</h3><Input placeholder="Search building codes, structural engineering, load calculations..." /></Card>;
      default: return null;
    }
  }

  return <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6"><div className="grid gap-6"><div className="flex items-center justify-between gap-3"><Link href="/tools" className="inline-flex items-center gap-2 text-sm text-muted hover:text-ink"><ArrowLeft size={16} /> Back to tools hub</Link><Badge variant="brand">SEMSE Pro Tools</Badge></div><section className="grid gap-3"><div className="flex items-center gap-3"><Building2 className="h-8 w-8" /><h1 className="text-3xl font-bold tracking-tight text-ink">Structural Work Tool</h1></div><p className="max-w-3xl text-sm text-muted">Structural engineering: beam replacement, foundation repair, bracing, reinforcement work.</p></section><div className="flex gap-2 overflow-x-auto pb-2">{SECTIONS.map((s) => {const Icon = s.icon; const isActive = section === s.id; return <Link key={s.id} href={s.href} className={`inline-flex items-center gap-2 rounded px-3 py-2 text-sm font-medium transition ${isActive ? "bg-blue-600 text-white" : "bg-slate-800 text-muted hover:bg-slate-700"}`}><Icon size={16} /> {s.label}</Link>;})}</div><div className="grid gap-6">{renderSection()}</div></div></main>;
}
