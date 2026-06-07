"use client";
import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { ArrowLeft, Calculator, CheckCircle2, ClipboardCheck, ClipboardList, Globe2, LayoutDashboard, Package, ReceiptText, ShieldCheck, Zap } from "lucide-react";
import { Badge, Button, Card, Input, Select } from "@/components/ui";
import { calculateSemseTool, type SemseToolResult, type ToolMode } from "@/app/lib/semse-tools-api";
import { ToolResultPanel } from "../ToolResultPanel";

export type SolarSection = "dashboard" | "estimate" | "scope" | "materials" | "summary" | "milestones" | "inspection" | "research";

type SolarInput = { kilowatts: number; systemType: "rooftop" | "ground_mounted" | "hybrid"; panelType: "standard" | "premium" | "ultra_efficient"; batteryStorage: boolean; gridTied: boolean; complexity: "simple" | "moderate" | "complex"; mode: ToolMode };

const INITIAL_INPUT: SolarInput = { kilowatts: 5, systemType: "rooftop", panelType: "standard", batteryStorage: false, gridTied: true, complexity: "moderate", mode: "professional" };

const SECTIONS: Array<{ id: SolarSection; label: string; href: string; icon: LucideIcon }> = [
  { id: "dashboard", label: "Dashboard", href: "/tools/solar/dashboard", icon: LayoutDashboard },
  { id: "estimate", label: "Estimacion", href: "/tools/solar/estimate", icon: Calculator },
  { id: "scope", label: "Alcance", href: "/tools/solar/scope", icon: ClipboardList },
  { id: "materials", label: "Materiales", href: "/tools/solar/materials", icon: Package },
  { id: "summary", label: "Resumen", href: "/tools/solar/summary", icon: ReceiptText },
  { id: "milestones", label: "Milestones", href: "/tools/solar/milestones", icon: ShieldCheck },
  { id: "inspection", label: "Inspeccion", href: "/tools/solar/inspection", icon: ClipboardCheck },
  { id: "research", label: "Research", href: "/tools/solar/research", icon: Globe2 },
];

function formatCurrency(v: number) { return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(v); }

type SolarToolClientProps = { section: SolarSection };

export function SolarToolClient({ section }: SolarToolClientProps) {
  const [input, setInput] = useState<SolarInput>(INITIAL_INPUT);
  const [result, setResult] = useState<SemseToolResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const costPerKw = useMemo(() => {
    const baseKwCost = 2500;
    const panelFactor = { standard: 1, premium: 1.3, ultra_efficient: 1.6 }[input.panelType];
    const systemFactor = { rooftop: 1, ground_mounted: 1.15, hybrid: 1.3 }[input.systemType];
    const batteryFactor = input.batteryStorage ? 1.4 : 1;
    const gridFactor = input.gridTied ? 0.8 : 1.2;
    return baseKwCost * panelFactor * systemFactor * batteryFactor * gridFactor;
  }, [input.panelType, input.systemType, input.batteryStorage, input.gridTied]);

  const estimatedCost = useMemo(() => input.kilowatts * costPerKw * 1.12, [input.kilowatts, costPerKw]);

  async function calculate() {
    setLoading(true);
    setError(null);
    try {
      const response = await calculateSemseTool({ tool: "solar", mode: input.mode, input });
      setResult(response);
    } catch (exception) {
      setError(exception instanceof Error ? exception.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  function renderSection(): ReactNode {
    switch (section) {
      case "dashboard": return <div className="grid gap-6"><div className="grid gap-4 sm:grid-cols-3"><Card className="p-4"><div className="text-sm text-muted">System Size</div><div className="text-2xl font-bold">{input.kilowatts} kW</div></Card><Card className="p-4"><div className="text-sm text-muted">Type</div><div className="text-lg font-bold">{input.systemType}</div></Card><Card className="p-4"><div className="text-sm text-muted">Est. Cost</div><div className="text-2xl font-bold">{formatCurrency(estimatedCost)}</div></Card></div></div>;
      case "estimate": return <div className="grid gap-6"><Card className="p-6"><h3 className="mb-4 font-semibold">Solar Parameters</h3><div className="grid gap-4 sm:grid-cols-2"><Input label="Kilowatts" type="number" value={input.kilowatts} onChange={(e) => setInput({...input, kilowatts: Number(e.target.value)})} /><Select label="Panel Type" value={input.panelType} onChange={(e) => setInput({...input, panelType: e.target.value as any})}><option value="standard">Standard</option><option value="premium">Premium</option><option value="ultra_efficient">Ultra Efficient</option></Select></div><Button className="mt-4 w-full" onClick={calculate} disabled={loading}>{loading ? "Calculating..." : "Calculate"}</Button></Card>{result && <ToolResultPanel result={result} />}{error && <div className="rounded bg-red-500/10 p-4 text-red-500">{error}</div>}</div>;
      case "scope": return <Card className="p-6"><h3 className="mb-4 font-semibold">Project Scope</h3><p className="text-sm text-muted">System: {input.kilowatts} kW {input.systemType} • Panels: {input.panelType}</p></Card>;
      case "materials": return <Card className="p-6"><h3 className="mb-4 font-semibold">Equipment & Installation</h3><p className="text-sm text-muted">Cost/kW: {formatCurrency(costPerKw)} • Battery: {input.batteryStorage ? "Yes" : "No"} • Grid-tied: {input.gridTied ? "Yes" : "No"}</p></Card>;
      case "summary": return <Card className="p-6"><h3 className="mb-4 font-semibold">Solar Summary</h3><p className="text-sm text-muted">Est: {formatCurrency(estimatedCost)} • {input.kilowatts} kW System</p></Card>;
      case "milestones": return <Card className="p-6"><h3 className="mb-4 font-semibold">Project Milestones</h3><p className="text-sm text-muted">Site assessment, permitting, equipment delivery, installation, inspection, activation...</p></Card>;
      case "inspection": return <Card className="p-6"><h3 className="mb-4 font-semibold">Quality Checklist</h3><p className="text-sm text-muted">Panel alignment, electrical safety, system performance, permits, warranty registration...</p></Card>;
      case "research": return <Card className="p-6"><h3 className="mb-4 font-semibold">Solar Research</h3><Input placeholder="Search panel types, incentives, ROI calculations..." /></Card>;
      default: return null;
    }
  }

  return <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6"><div className="grid gap-6"><div className="flex items-center justify-between gap-3"><Link href="/tools" className="inline-flex items-center gap-2 text-sm text-muted hover:text-ink"><ArrowLeft size={16} /> Back to tools hub</Link><Badge variant="brand">SEMSE Pro Tools</Badge></div><section className="grid gap-3"><div className="flex items-center gap-3"><Zap className="h-8 w-8" /><h1 className="text-3xl font-bold tracking-tight text-ink">Solar Tool</h1></div><p className="max-w-3xl text-sm text-muted">Complete solar system estimation with equipment, installation, and storage options.</p></section><div className="flex gap-2 overflow-x-auto pb-2">{SECTIONS.map((s) => {const Icon = s.icon; const isActive = section === s.id; return <Link key={s.id} href={s.href} className={`inline-flex items-center gap-2 rounded px-3 py-2 text-sm font-medium transition ${isActive ? "bg-blue-600 text-white" : "bg-slate-800 text-muted hover:bg-slate-700"}`}><Icon size={16} /> {s.label}</Link>;})}</div><div className="grid gap-6">{renderSection()}</div></div></main>;
}
