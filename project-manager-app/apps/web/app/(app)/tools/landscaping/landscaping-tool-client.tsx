"use client";
import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { ArrowLeft, Calculator, CheckCircle2, ClipboardCheck, ClipboardList, Globe2, LayoutDashboard, Package, ReceiptText, ShieldCheck, Trees } from "lucide-react";
import { Badge, Button, Card, Input, Select } from "@/components/ui";
import { calculateSemseTool, type SemseToolResult, type ToolMode } from "@/app/lib/semse-tools-api";
import { ToolResultPanel } from "../ToolResultPanel";

export type LandscapingSection = "dashboard" | "estimate" | "scope" | "materials" | "summary" | "milestones" | "inspection" | "research";

type LandscapingInput = { squareFeet: number; serviceType: "design" | "install" | "maintenance" | "hardscape" | "planting"; complexity: "simple" | "moderate" | "complex"; materials: "standard" | "premium" | "luxury"; labor: "basic" | "skilled" | "master"; mode: ToolMode };

const INITIAL_INPUT: LandscapingInput = { squareFeet: 1000, serviceType: "install", complexity: "moderate", materials: "standard", labor: "skilled", mode: "professional" };

const SECTIONS: Array<{ id: LandscapingSection; label: string; href: string; icon: LucideIcon }> = [
  { id: "dashboard", label: "Dashboard", href: "/tools/landscaping/dashboard", icon: LayoutDashboard },
  { id: "estimate", label: "Estimacion", href: "/tools/landscaping/estimate", icon: Calculator },
  { id: "scope", label: "Alcance", href: "/tools/landscaping/scope", icon: ClipboardList },
  { id: "materials", label: "Materiales", href: "/tools/landscaping/materials", icon: Package },
  { id: "summary", label: "Resumen", href: "/tools/landscaping/summary", icon: ReceiptText },
  { id: "milestones", label: "Milestones", href: "/tools/landscaping/milestones", icon: ShieldCheck },
  { id: "inspection", label: "Inspeccion", href: "/tools/landscaping/inspection", icon: ClipboardCheck },
  { id: "research", label: "Research", href: "/tools/landscaping/research", icon: Globe2 },
];

function formatCurrency(v: number) { return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(v); }

type LandscapingToolClientProps = { section: LandscapingSection };

export function LandscapingToolClient({ section }: LandscapingToolClientProps) {
  const [input, setInput] = useState<LandscapingInput>(INITIAL_INPUT);
  const [result, setResult] = useState<SemseToolResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const costPerSqft = useMemo(() => {
    const baseCost: Record<typeof input.serviceType, number> = { design: 2, install: 5, maintenance: 1.5, hardscape: 8, planting: 3 };
    const base = baseCost[input.serviceType];
    const complexFactor = { simple: 1, moderate: 1.3, complex: 1.7 }[input.complexity];
    const matFactor = { standard: 1, premium: 1.5, luxury: 2.2 }[input.materials];
    const laborFactor = { basic: 1, skilled: 1.3, master: 1.8 }[input.labor];
    return base * complexFactor * matFactor * laborFactor;
  }, [input.serviceType, input.complexity, input.materials, input.labor]);

  const estimatedCost = useMemo(() => input.squareFeet * costPerSqft * 1.1, [input.squareFeet, costPerSqft]);

  async function calculate() {
    setLoading(true);
    setError(null);
    try {
      const response = await calculateSemseTool({ tool: "landscaping", mode: input.mode, input });
      setResult(response);
    } catch (exception) {
      setError(exception instanceof Error ? exception.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  function renderSection(): ReactNode {
    switch (section) {
      case "dashboard": return <div className="grid gap-6"><div className="grid gap-4 sm:grid-cols-3"><Card className="p-4"><div className="text-sm text-muted">Area</div><div className="text-2xl font-bold">{input.squareFeet} sqft</div></Card><Card className="p-4"><div className="text-sm text-muted">Service</div><div className="text-lg font-bold">{input.serviceType}</div></Card><Card className="p-4"><div className="text-sm text-muted">Est. Cost</div><div className="text-2xl font-bold">{formatCurrency(estimatedCost)}</div></Card></div></div>;
      case "estimate": return <div className="grid gap-6"><Card className="p-6"><h3 className="mb-4 font-semibold">Landscaping Parameters</h3><div className="grid gap-4 sm:grid-cols-2"><Input label="Square Feet" type="number" value={input.squareFeet} onChange={(e) => setInput({...input, squareFeet: Number(e.target.value)})} /><Select label="Service" value={input.serviceType} onChange={(e) => setInput({...input, serviceType: e.target.value as any})}><option value="design">Design</option><option value="install">Install</option><option value="maintenance">Maintenance</option><option value="hardscape">Hardscape</option><option value="planting">Planting</option></Select></div><Button className="mt-4 w-full" onClick={calculate} disabled={loading}>{loading ? "Calculating..." : "Calculate"}</Button></Card>{result && <ToolResultPanel result={result} />}{error && <div className="rounded bg-red-500/10 p-4 text-red-500">{error}</div>}</div>;
      case "scope": return <Card className="p-6"><h3 className="mb-4 font-semibold">Project Scope</h3><p className="text-sm text-muted">Area: {input.squareFeet} sqft • Service: {input.serviceType} • Complexity: {input.complexity}</p></Card>;
      case "materials": return <Card className="p-6"><h3 className="mb-4 font-semibold">Materials & Labor</h3><p className="text-sm text-muted">Cost/sqft: {formatCurrency(costPerSqft)} • Materials: {input.materials} • Labor: {input.labor}</p></Card>;
      case "summary": return <Card className="p-6"><h3 className="mb-4 font-semibold">Landscaping Summary</h3><p className="text-sm text-muted">Est: {formatCurrency(estimatedCost)} • {input.squareFeet} sqft</p></Card>;
      case "milestones": return <Card className="p-6"><h3 className="mb-4 font-semibold">Project Milestones</h3><p className="text-sm text-muted">Design approval, material sourcing, site prep, installation, final cleanup...</p></Card>;
      case "inspection": return <Card className="p-6"><h3 className="mb-4 font-semibold">Quality Checklist</h3><p className="text-sm text-muted">Plant health, drainage, hardscape alignment, landscape appearance, maintenance readiness...</p></Card>;
      case "research": return <Card className="p-6"><h3 className="mb-4 font-semibold">Landscaping Research</h3><Input placeholder="Search plant types, hardscape materials, sustainability..." /></Card>;
      default: return null;
    }
  }

  return <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6"><div className="grid gap-6"><div className="flex items-center justify-between gap-3"><Link href="/tools" className="inline-flex items-center gap-2 text-sm text-muted hover:text-ink"><ArrowLeft size={16} /> Back to tools hub</Link><Badge variant="brand">SEMSE Pro Tools</Badge></div><section className="grid gap-3"><div className="flex items-center gap-3"><Trees className="h-8 w-8" /><h1 className="text-3xl font-bold tracking-tight text-ink">Landscaping Tool</h1></div><p className="max-w-3xl text-sm text-muted">Complete landscaping estimation with design, materials, and labor options.</p></section><div className="flex gap-2 overflow-x-auto pb-2">{SECTIONS.map((s) => {const Icon = s.icon; const isActive = section === s.id; return <Link key={s.id} href={s.href} className={`inline-flex items-center gap-2 rounded px-3 py-2 text-sm font-medium transition ${isActive ? "bg-blue-600 text-white" : "bg-slate-800 text-muted hover:bg-slate-700"}`}><Icon size={16} /> {s.label}</Link>;})}</div><div className="grid gap-6">{renderSection()}</div></div></main>;
}
