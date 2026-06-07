"use client";
import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { ArrowLeft, Calculator, ClipboardCheck, ClipboardList, Globe2, LayoutDashboard, Package, ReceiptText, ShieldCheck, Users } from "lucide-react";
import { Badge, Button, Card, Input, Select } from "@/components/ui";
import { calculateSemseTool, type SemseToolResult, type ToolMode } from "@/app/lib/semse-tools-api";
import { ToolResultPanel } from "../ToolResultPanel";

export type LaborSection = "dashboard" | "estimate" | "scope" | "materials" | "summary" | "milestones" | "inspection" | "research";
type LaborInput = { hours: number; laborType: "unskilled" | "semi_skilled" | "skilled" | "specialist"; experience: "entry" | "intermediate" | "senior" | "master"; complexity: "simple" | "moderate" | "complex"; benefits: boolean; mode: ToolMode };

const INITIAL_INPUT: LaborInput = { hours: 40, laborType: "skilled", experience: "senior", complexity: "moderate", benefits: true, mode: "professional" };
const SECTIONS: Array<{ id: LaborSection; label: string; href: string; icon: LucideIcon }> = [
  { id: "dashboard", label: "Dashboard", href: "/tools/labor/dashboard", icon: LayoutDashboard },
  { id: "estimate", label: "Estimacion", href: "/tools/labor/estimate", icon: Calculator },
  { id: "scope", label: "Alcance", href: "/tools/labor/scope", icon: ClipboardList },
  { id: "materials", label: "Materiales", href: "/tools/labor/materials", icon: Package },
  { id: "summary", label: "Resumen", href: "/tools/labor/summary", icon: ReceiptText },
  { id: "milestones", label: "Milestones", href: "/tools/labor/milestones", icon: ShieldCheck },
  { id: "inspection", label: "Inspeccion", href: "/tools/labor/inspection", icon: ClipboardCheck },
  { id: "research", label: "Research", href: "/tools/labor/research", icon: Globe2 },
];

function formatCurrency(v: number) { return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(v); }

export function LaborToolClient({ section }: { section: LaborSection }) {
  const [input, setInput] = useState<LaborInput>(INITIAL_INPUT);
  const [result, setResult] = useState<SemseToolResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const baseRate: Record<typeof input.laborType, number> = { unskilled: 20, semi_skilled: 35, skilled: 50, specialist: 80 };

  const hourlyRate = useMemo(() => {
    const base = baseRate[input.laborType];
    const expFactor = { entry: 0.9, intermediate: 1.1, senior: 1.3, master: 1.6 }[input.experience];
    const complexFactor = { simple: 1, moderate: 1.2, complex: 1.5 }[input.complexity];
    const benefitsFactor = input.benefits ? 1.25 : 1;
    return base * expFactor * complexFactor * benefitsFactor;
  }, [input.laborType, input.experience, input.complexity, input.benefits]);

  const estimatedCost = useMemo(() => input.hours * hourlyRate, [input.hours, hourlyRate]);

  async function calculate() {
    setLoading(true);
    try {
      const response = await calculateSemseTool({ tool: "labor", mode: input.mode, input });
      setResult(response);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  function renderSection(): ReactNode {
    switch (section) {
      case "dashboard": return <div className="grid gap-6"><div className="grid gap-4 sm:grid-cols-3"><Card className="p-4"><div className="text-sm text-muted">Hours</div><div className="text-2xl font-bold">{input.hours}</div></Card><Card className="p-4"><div className="text-sm text-muted">Rate/Hour</div><div className="text-lg font-bold">{formatCurrency(hourlyRate)}</div></Card><Card className="p-4"><div className="text-sm text-muted">Total Cost</div><div className="text-2xl font-bold">{formatCurrency(estimatedCost)}</div></Card></div></div>;
      case "estimate": return <div className="grid gap-6"><Card className="p-6"><h3 className="mb-4 font-semibold">Labor Parameters</h3><div className="grid gap-4 sm:grid-cols-2"><Input label="Hours" type="number" value={input.hours} onChange={(e) => setInput({...input, hours: Number(e.target.value)})} /><Select label="Labor Type" value={input.laborType} onChange={(e) => setInput({...input, laborType: e.target.value as any})}><option value="unskilled">Unskilled</option><option value="semi_skilled">Semi-Skilled</option><option value="skilled">Skilled</option><option value="specialist">Specialist</option></Select><Select label="Experience" value={input.experience} onChange={(e) => setInput({...input, experience: e.target.value as any})}><option value="entry">Entry</option><option value="intermediate">Intermediate</option><option value="senior">Senior</option><option value="master">Master</option></Select><Select label="Complexity" value={input.complexity} onChange={(e) => setInput({...input, complexity: e.target.value as any})}><option value="simple">Simple</option><option value="moderate">Moderate</option><option value="complex">Complex</option></Select></div><div className="mt-4 flex items-center gap-2"><input type="checkbox" checked={input.benefits} onChange={(e) => setInput({...input, benefits: e.target.checked})} /><label>Include benefits</label></div><Button className="mt-4 w-full" onClick={calculate} disabled={loading}>{loading ? "Calculating..." : "Calculate"}</Button></Card>{result && <ToolResultPanel result={result} />}{error && <div className="rounded bg-red-500/10 p-4 text-red-500">{error}</div>}</div>;
      case "scope": return <Card className="p-6"><h3 className="mb-4 font-semibold">Project Scope</h3><p className="text-sm text-muted">Hours: {input.hours} • Type: {input.laborType} • Experience: {input.experience} • Complexity: {input.complexity}</p></Card>;
      case "materials": return <Card className="p-6"><h3 className="mb-4 font-semibold">Labor Schedule</h3><p className="text-sm text-muted">Total hours: {input.hours} • Base rate: {formatCurrency(baseRate[input.laborType])} • Benefits: {input.benefits ? "Yes" : "No"}</p></Card>;
      case "summary": return <Card className="p-6"><h3 className="mb-4 font-semibold">Labor Summary</h3><p className="text-sm text-muted">Est: {formatCurrency(estimatedCost)} • Rate: {formatCurrency(hourlyRate)}/hr • {input.hours} hours</p></Card>;
      case "milestones": return <Card className="p-6"><h3 className="mb-4 font-semibold">Project Milestones</h3><p className="text-sm text-muted">Work planning, crew assignment, daily tracking, progress review, safety checks, completion</p></Card>;
      case "inspection": return <Card className="p-6"><h3 className="mb-4 font-semibold">Quality Checklist</h3><p className="text-sm text-muted">Work quality, safety compliance, schedule adherence, material handling, client satisfaction</p></Card>;
      case "research": return <Card className="p-6"><h3 className="mb-4 font-semibold">Labor Research</h3><Input placeholder="Search prevailing wages, labor laws, productivity standards..." /></Card>;
      default: return null;
    }
  }

  return <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6"><div className="grid gap-6"><div className="flex items-center justify-between gap-3"><Link href="/tools" className="inline-flex items-center gap-2 text-sm text-muted hover:text-ink"><ArrowLeft size={16} /> Back to tools hub</Link><Badge variant="brand">SEMSE Pro Tools</Badge></div><section className="grid gap-3"><div className="flex items-center gap-3"><Users className="h-8 w-8" /><h1 className="text-3xl font-bold tracking-tight text-ink">Labor Tool</h1></div><p className="max-w-3xl text-sm text-muted">Complete labor cost estimation with skill levels, experience, and complexity factors.</p></section><div className="flex gap-2 overflow-x-auto pb-2">{SECTIONS.map((s) => {const Icon = s.icon; const isActive = section === s.id; return <Link key={s.id} href={s.href} className={`inline-flex items-center gap-2 rounded px-3 py-2 text-sm font-medium transition ${isActive ? "bg-blue-600 text-white" : "bg-slate-800 text-muted hover:bg-slate-700"}`}><Icon size={16} /> {s.label}</Link>;})}</div><div className="grid gap-6">{renderSection()}</div></div></main>;
}
