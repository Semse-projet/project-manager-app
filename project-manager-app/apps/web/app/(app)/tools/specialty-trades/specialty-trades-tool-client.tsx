"use client";
import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { ArrowLeft, Calculator, ClipboardCheck, ClipboardList, Globe2, LayoutDashboard, Package, ReceiptText, ShieldCheck, Wrench } from "lucide-react";
import { Badge, Button, Card, Input, Select } from "@/components/ui";
import { calculateSemseTool, type SemseToolResult, type ToolMode } from "@/app/lib/semse-tools-api";
import { ToolResultPanel } from "../ToolResultPanel";

export type SpecialtyTradesSection = "dashboard" | "estimate" | "scope" | "materials" | "summary" | "milestones" | "inspection" | "research";
type SpecialtyTradesInput = { units: number; tradeType: "pool_installation" | "sauna_spa" | "custom_carpentry" | "stone_masonry" | "fireplace"; complexity: "basic" | "standard" | "advanced" | "luxury"; custom: boolean; mode: ToolMode };

const INITIAL_INPUT: SpecialtyTradesInput = { units: 1, tradeType: "pool_installation", complexity: "advanced", custom: false, mode: "professional" };
const SECTIONS: Array<{ id: SpecialtyTradesSection; label: string; href: string; icon: LucideIcon }> = [
  { id: "dashboard", label: "Dashboard", href: "/tools/specialty-trades/dashboard", icon: LayoutDashboard },
  { id: "estimate", label: "Estimacion", href: "/tools/specialty-trades/estimate", icon: Calculator },
  { id: "scope", label: "Alcance", href: "/tools/specialty-trades/scope", icon: ClipboardList },
  { id: "materials", label: "Materiales", href: "/tools/specialty-trades/materials", icon: Package },
  { id: "summary", label: "Resumen", href: "/tools/specialty-trades/summary", icon: ReceiptText },
  { id: "milestones", label: "Milestones", href: "/tools/specialty-trades/milestones", icon: ShieldCheck },
  { id: "inspection", label: "Inspeccion", href: "/tools/specialty-trades/inspection", icon: ClipboardCheck },
  { id: "research", label: "Research", href: "/tools/specialty-trades/research", icon: Globe2 },
];

function formatCurrency(v: number) { return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(v); }

export function SpecialtyTradesToolClient({ section }: { section: SpecialtyTradesSection }) {
  const [input, setInput] = useState<SpecialtyTradesInput>(INITIAL_INPUT);
  const [result, setResult] = useState<SemseToolResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const costPerUnit = useMemo(() => {
    const tradeCost: Record<typeof input.tradeType, number> = { pool_installation: 15000, sauna_spa: 8000, custom_carpentry: 5000, stone_masonry: 6000, fireplace: 7000 };
    const base = tradeCost[input.tradeType];
    const complexFactor = { basic: 0.8, standard: 1, advanced: 1.3, luxury: 1.7 }[input.complexity];
    const customFactor = input.custom ? 1.4 : 1;
    return base * complexFactor * customFactor;
  }, [input.tradeType, input.complexity, input.custom]);

  const estimatedCost = useMemo(() => input.units * costPerUnit, [input.units, costPerUnit]);

  async function calculate() {
    setLoading(true);
    try {
      const response = await calculateSemseTool({ tool: "specialty-trades", mode: input.mode, input });
      setResult(response);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  function renderSection(): ReactNode {
    switch (section) {
      case "dashboard": return <div className="grid gap-6"><div className="grid gap-4 sm:grid-cols-3"><Card className="p-4"><div className="text-sm text-muted">Units</div><div className="text-2xl font-bold">{input.units}</div></Card><Card className="p-4"><div className="text-sm text-muted">Trade</div><div className="text-lg font-bold">{input.tradeType.replace(/_/g, " ")}</div></Card><Card className="p-4"><div className="text-sm text-muted">Est. Cost</div><div className="text-2xl font-bold">{formatCurrency(estimatedCost)}</div></Card></div></div>;
      case "estimate": return <div className="grid gap-6"><Card className="p-6"><h3 className="mb-4 font-semibold">Specialty Trade Parameters</h3><div className="grid gap-4 sm:grid-cols-2"><Input label="Units" type="number" value={input.units} onChange={(e) => setInput({...input, units: Number(e.target.value)})} /><Select label="Trade Type" value={input.tradeType} onChange={(e) => setInput({...input, tradeType: e.target.value as any})}><option value="pool_installation">Pool Installation</option><option value="sauna_spa">Sauna/Spa Installation</option><option value="custom_carpentry">Custom Carpentry</option><option value="stone_masonry">Stone Masonry</option><option value="fireplace">Fireplace Installation</option></Select><Select label="Complexity" value={input.complexity} onChange={(e) => setInput({...input, complexity: e.target.value as any})}><option value="basic">Basic</option><option value="standard">Standard</option><option value="advanced">Advanced</option><option value="luxury">Luxury</option></Select></div><div className="mt-4 flex items-center gap-2"><input type="checkbox" checked={input.custom} onChange={(e) => setInput({...input, custom: e.target.checked})} /><label>Custom design</label></div><Button className="mt-4 w-full" onClick={calculate} disabled={loading}>{loading ? "Calculating..." : "Calculate"}</Button></Card>{result && <ToolResultPanel result={result} />}{error && <div className="rounded bg-red-500/10 p-4 text-red-500">{error}</div>}</div>;
      case "scope": return <Card className="p-6"><h3 className="mb-4 font-semibold">Project Scope</h3><p className="text-sm text-muted">Units: {input.units} • Trade: {input.tradeType} • Complexity: {input.complexity} • Custom: {input.custom ? "Yes" : "No"}</p></Card>;
      case "materials": return <Card className="p-6"><h3 className="mb-4 font-semibold">Materials & Components</h3><p className="text-sm text-muted">Trade: {input.tradeType} • Cost/unit: {formatCurrency(costPerUnit)} • High-end finishing</p></Card>;
      case "summary": return <Card className="p-6"><h3 className="mb-4 font-semibold">Specialty Trade Summary</h3><p className="text-sm text-muted">Est: {formatCurrency(estimatedCost)} • {input.units} units • {input.tradeType}</p></Card>;
      case "milestones": return <Card className="p-6"><h3 className="mb-4 font-semibold">Project Milestones</h3><p className="text-sm text-muted">Design approval, permits, material sourcing, expert installation, testing, finishing, warranty setup</p></Card>;
      case "inspection": return <Card className="p-6"><h3 className="mb-4 font-semibold">Quality Checklist</h3><p className="text-sm text-muted">Expert craftsmanship, code compliance, safety testing, aesthetic finish, functionality verification, documentation</p></Card>;
      case "research": return <Card className="p-6"><h3 className="mb-4 font-semibold">Specialty Trades Research</h3><Input placeholder="Search specialty installations, custom finishes, luxury upgrades..." /></Card>;
      default: return null;
    }
  }

  return <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6"><div className="grid gap-6"><div className="flex items-center justify-between gap-3"><Link href="/tools" className="inline-flex items-center gap-2 text-sm text-muted hover:text-ink"><ArrowLeft size={16} /> Back to tools hub</Link><Badge variant="brand">SEMSE Pro Tools</Badge></div><section className="grid gap-3"><div className="flex items-center gap-3"><Wrench className="h-8 w-8" /><h1 className="text-3xl font-bold tracking-tight text-ink">Specialty Trades Tool</h1></div><p className="max-w-3xl text-sm text-muted">Premium specialty installations: pools, spas, saunas, custom carpentry, stone, fireplaces.</p></section><div className="flex gap-2 overflow-x-auto pb-2">{SECTIONS.map((s) => {const Icon = s.icon; const isActive = section === s.id; return <Link key={s.id} href={s.href} className={`inline-flex items-center gap-2 rounded px-3 py-2 text-sm font-medium transition ${isActive ? "bg-blue-600 text-white" : "bg-slate-800 text-muted hover:bg-slate-700"}`}><Icon size={16} /> {s.label}</Link>;})}</div><div className="grid gap-6">{renderSection()}</div></div></main>;
}
