"use client";
import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { ArrowLeft, Calculator, ClipboardCheck, ClipboardList, Globe2, LayoutDashboard, Package, ReceiptText, ShieldCheck, DoorOpen } from "lucide-react";
import { Badge, Button, Card, Input, Select } from "@/components/ui";
import { calculateSemseTool, type SemseToolResult, type ToolMode } from "@/app/lib/semse-tools-api";
import { ToolResultPanel } from "../ToolResultPanel";

export type DoorsModsSection = "dashboard" | "estimate" | "scope" | "materials" | "summary" | "milestones" | "inspection" | "research";
type DoorsModsInput = { units: number; modType: "retrofit_weather" | "accessibility" | "security_upgrade" | "smart_lock" | "frame_repair"; material: "wood" | "steel" | "fiberglass"; complexity: "simple" | "moderate" | "complex"; mode: ToolMode };

const INITIAL_INPUT: DoorsModsInput = { units: 2, modType: "smart_lock", material: "wood", complexity: "moderate", mode: "professional" };
const SECTIONS: Array<{ id: DoorsModsSection; label: string; href: string; icon: LucideIcon }> = [
  { id: "dashboard", label: "Dashboard", href: "/tools/doors-mods/dashboard", icon: LayoutDashboard },
  { id: "estimate", label: "Estimacion", href: "/tools/doors-mods/estimate", icon: Calculator },
  { id: "scope", label: "Alcance", href: "/tools/doors-mods/scope", icon: ClipboardList },
  { id: "materials", label: "Materiales", href: "/tools/doors-mods/materials", icon: Package },
  { id: "summary", label: "Resumen", href: "/tools/doors-mods/summary", icon: ReceiptText },
  { id: "milestones", label: "Milestones", href: "/tools/doors-mods/milestones", icon: ShieldCheck },
  { id: "inspection", label: "Inspeccion", href: "/tools/doors-mods/inspection", icon: ClipboardCheck },
  { id: "research", label: "Research", href: "/tools/doors-mods/research", icon: Globe2 },
];

function formatCurrency(v: number) { return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(v); }

export function DoorsModsToolClient({ section }: { section: DoorsModsSection }) {
  const [input, setInput] = useState<DoorsModsInput>(INITIAL_INPUT);
  const [result, setResult] = useState<SemseToolResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const costPerUnit = useMemo(() => {
    const modCost: Record<typeof input.modType, number> = { retrofit_weather: 600, accessibility: 3000, security_upgrade: 1500, smart_lock: 800, frame_repair: 400 };
    const base = modCost[input.modType];
    const matFactor = { wood: 1, steel: 1.2, fiberglass: 0.9 }[input.material];
    const complexFactor = { simple: 1, moderate: 1.3, complex: 1.6 }[input.complexity];
    return base * matFactor * complexFactor;
  }, [input.modType, input.material, input.complexity]);

  const estimatedCost = useMemo(() => input.units * costPerUnit * 1.15, [input.units, costPerUnit]);

  async function calculate() {
    setLoading(true);
    try {
      const response = await calculateSemseTool({ tool: "doors-mods", mode: input.mode, input });
      setResult(response);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  function renderSection(): ReactNode {
    switch (section) {
      case "dashboard": return <div className="grid gap-6"><div className="grid gap-4 sm:grid-cols-3"><Card className="p-4"><div className="text-sm text-muted">Doors</div><div className="text-2xl font-bold">{input.units}</div></Card><Card className="p-4"><div className="text-sm text-muted">Modification</div><div className="text-lg font-bold">{input.modType.replace(/_/g, " ")}</div></Card><Card className="p-4"><div className="text-sm text-muted">Est. Cost</div><div className="text-2xl font-bold">{formatCurrency(estimatedCost)}</div></Card></div></div>;
      case "estimate": return <div className="grid gap-6"><Card className="p-6"><h3 className="mb-4 font-semibold">Door Modification Parameters</h3><div className="grid gap-4 sm:grid-cols-2"><Input label="Number of Doors" type="number" value={input.units} onChange={(e) => setInput({...input, units: Number(e.target.value)})} /><Select label="Modification Type" value={input.modType} onChange={(e) => setInput({...input, modType: e.target.value as any})}><option value="retrofit_weather">Retrofit Weather Sealing</option><option value="accessibility">Accessibility Modification</option><option value="security_upgrade">Security Upgrade</option><option value="smart_lock">Smart Lock Installation</option><option value="frame_repair">Frame Repair</option></Select><Select label="Material" value={input.material} onChange={(e) => setInput({...input, material: e.target.value as any})}><option value="wood">Wood</option><option value="steel">Steel</option><option value="fiberglass">Fiberglass</option></Select><Select label="Complexity" value={input.complexity} onChange={(e) => setInput({...input, complexity: e.target.value as any})}><option value="simple">Simple</option><option value="moderate">Moderate</option><option value="complex">Complex</option></Select></div><Button className="mt-4 w-full" onClick={calculate} disabled={loading}>{loading ? "Calculating..." : "Calculate"}</Button></Card>{result && <ToolResultPanel result={result} />}{error && <div className="rounded bg-red-500/10 p-4 text-red-500">{error}</div>}</div>;
      case "scope": return <Card className="p-6"><h3 className="mb-4 font-semibold">Project Scope</h3><p className="text-sm text-muted">Doors: {input.units} • Modification: {input.modType} • Material: {input.material} • Complexity: {input.complexity}</p></Card>;
      case "materials": return <Card className="p-6"><h3 className="mb-4 font-semibold">Materials & Hardware</h3><p className="text-sm text-muted">Material: {input.material} • Hardware: {input.modType} • Cost/door: {formatCurrency(costPerUnit)}</p></Card>;
      case "summary": return <Card className="p-6"><h3 className="mb-4 font-semibold">Doors & Modifications Summary</h3><p className="text-sm text-muted">Est: {formatCurrency(estimatedCost)} • {input.units} doors • {input.modType}</p></Card>;
      case "milestones": return <Card className="p-6"><h3 className="mb-4 font-semibold">Project Milestones</h3><p className="text-sm text-muted">Door removal, modification/repair, hardware installation, fitting/adjustment, finishing, testing</p></Card>;
      case "inspection": return <Card className="p-6"><h3 className="mb-4 font-semibold">Quality Checklist</h3><p className="text-sm text-muted">Proper fit and alignment, hardware function, weather seal integrity, accessibility compliance, finish quality</p></Card>;
      case "research": return <Card className="p-6"><h3 className="mb-4 font-semibold">Door Modifications Research</h3><Input placeholder="Search smart locks, accessibility standards, weather sealing, door security..." /></Card>;
      default: return null;
    }
  }

  return <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6"><div className="grid gap-6"><div className="flex items-center justify-between gap-3"><Link href="/tools" className="inline-flex items-center gap-2 text-sm text-muted hover:text-ink"><ArrowLeft size={16} /> Back to tools hub</Link><Badge variant="brand">SEMSE Pro Tools</Badge></div><section className="grid gap-3"><div className="flex items-center gap-3"><DoorOpen className="h-8 w-8" /><h1 className="text-3xl font-bold tracking-tight text-ink">Doors & Modifications Tool</h1></div><p className="max-w-3xl text-sm text-muted">Complete door modifications: retrofits, accessibility, security, smart locks, frame repairs.</p></section><div className="flex gap-2 overflow-x-auto pb-2">{SECTIONS.map((s) => {const Icon = s.icon; const isActive = section === s.id; return <Link key={s.id} href={s.href} className={`inline-flex items-center gap-2 rounded px-3 py-2 text-sm font-medium transition ${isActive ? "bg-blue-600 text-white" : "bg-slate-800 text-muted hover:bg-slate-700"}`}><Icon size={16} /> {s.label}</Link>;})}</div><div className="grid gap-6">{renderSection()}</div></div></main>;
}
