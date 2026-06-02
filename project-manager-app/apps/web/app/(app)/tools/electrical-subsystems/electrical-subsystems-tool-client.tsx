"use client";
import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { ArrowLeft, Calculator, ClipboardCheck, ClipboardList, Globe2, LayoutDashboard, Package, ReceiptText, ShieldCheck, Zap } from "lucide-react";
import { Badge, Button, Card, Input, Select } from "@/components/ui";
import { calculateSemseTool, type SemseToolResult, type ToolMode } from "@/app/lib/semse-tools-api";
import { ToolResultPanel } from "../ToolResultPanel";

export type ElectricalSubsystemsSection = "dashboard" | "estimate" | "scope" | "materials" | "summary" | "milestones" | "inspection" | "research";
type ElectricalSubsystemsInput = { units: number; subsystemType: "hvac_control" | "solar_integration" | "ev_charging" | "battery_backup" | "automation"; complexity: "basic" | "standard" | "advanced" | "smart"; upgrade: boolean; mode: ToolMode };

const INITIAL_INPUT: ElectricalSubsystemsInput = { units: 1, subsystemType: "solar_integration", complexity: "advanced", upgrade: false, mode: "professional" };
const SECTIONS: Array<{ id: ElectricalSubsystemsSection; label: string; href: string; icon: LucideIcon }> = [
  { id: "dashboard", label: "Dashboard", href: "/tools/electrical-subsystems/dashboard", icon: LayoutDashboard },
  { id: "estimate", label: "Estimacion", href: "/tools/electrical-subsystems/estimate", icon: Calculator },
  { id: "scope", label: "Alcance", href: "/tools/electrical-subsystems/scope", icon: ClipboardList },
  { id: "materials", label: "Materiales", href: "/tools/electrical-subsystems/materials", icon: Package },
  { id: "summary", label: "Resumen", href: "/tools/electrical-subsystems/summary", icon: ReceiptText },
  { id: "milestones", label: "Milestones", href: "/tools/electrical-subsystems/milestones", icon: ShieldCheck },
  { id: "inspection", label: "Inspeccion", href: "/tools/electrical-subsystems/inspection", icon: ClipboardCheck },
  { id: "research", label: "Research", href: "/tools/electrical-subsystems/research", icon: Globe2 },
];

function formatCurrency(v: number) { return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(v); }

export function ElectricalSubsystemsToolClient({ section }: { section: ElectricalSubsystemsSection }) {
  const [input, setInput] = useState<ElectricalSubsystemsInput>(INITIAL_INPUT);
  const [result, setResult] = useState<SemseToolResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const costPerUnit = useMemo(() => {
    const baseCost: Record<typeof input.subsystemType, number> = { hvac_control: 2500, solar_integration: 8000, ev_charging: 5000, battery_backup: 12000, automation: 3500 };
    const base = baseCost[input.subsystemType];
    const complexFactor = { basic: 0.8, standard: 1, advanced: 1.4, smart: 1.8 }[input.complexity];
    const upgradeFactor = input.upgrade ? 1.3 : 1;
    return base * complexFactor * upgradeFactor;
  }, [input.subsystemType, input.complexity, input.upgrade]);

  const estimatedCost = useMemo(() => input.units * costPerUnit * 1.1, [input.units, costPerUnit]);

  async function calculate() {
    setLoading(true);
    try {
      const response = await calculateSemseTool({ tool: "electrical-subsystems", mode: input.mode, input });
      setResult(response);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  function renderSection(): ReactNode {
    switch (section) {
      case "dashboard": return <div className="grid gap-6"><div className="grid gap-4 sm:grid-cols-3"><Card className="p-4"><div className="text-sm text-muted">Units</div><div className="text-2xl font-bold">{input.units}</div></Card><Card className="p-4"><div className="text-sm text-muted">Type</div><div className="text-lg font-bold">{input.subsystemType.replace(/_/g, " ")}</div></Card><Card className="p-4"><div className="text-sm text-muted">Est. Cost</div><div className="text-2xl font-bold">{formatCurrency(estimatedCost)}</div></Card></div></div>;
      case "estimate": return <div className="grid gap-6"><Card className="p-6"><h3 className="mb-4 font-semibold">Subsystem Parameters</h3><div className="grid gap-4 sm:grid-cols-2"><Input label="Units" type="number" value={input.units} onChange={(e) => setInput({...input, units: Number(e.target.value)})} /><Select label="Subsystem Type" value={input.subsystemType} onChange={(e) => setInput({...input, subsystemType: e.target.value as any})}><option value="hvac_control">HVAC Control</option><option value="solar_integration">Solar Integration</option><option value="ev_charging">EV Charging</option><option value="battery_backup">Battery Backup</option><option value="automation">Home Automation</option></Select><Select label="Complexity" value={input.complexity} onChange={(e) => setInput({...input, complexity: e.target.value as any})}><option value="basic">Basic</option><option value="standard">Standard</option><option value="advanced">Advanced</option><option value="smart">Smart/IoT</option></Select></div><div className="mt-4 flex items-center gap-2"><input type="checkbox" checked={input.upgrade} onChange={(e) => setInput({...input, upgrade: e.target.checked})} /><label>Existing system upgrade</label></div><Button className="mt-4 w-full" onClick={calculate} disabled={loading}>{loading ? "Calculating..." : "Calculate"}</Button></Card>{result && <ToolResultPanel result={result} />}{error && <div className="rounded bg-red-500/10 p-4 text-red-500">{error}</div>}</div>;
      case "scope": return <Card className="p-6"><h3 className="mb-4 font-semibold">Project Scope</h3><p className="text-sm text-muted">Units: {input.units} • Type: {input.subsystemType} • Complexity: {input.complexity} • Upgrade: {input.upgrade ? "Yes" : "No"}</p></Card>;
      case "materials": return <Card className="p-6"><h3 className="mb-4 font-semibold">Components & Materials</h3><p className="text-sm text-muted">Subsystem: {input.subsystemType} • Cost/unit: {formatCurrency(costPerUnit)} • Integration complexity: {input.complexity}</p></Card>;
      case "summary": return <Card className="p-6"><h3 className="mb-4 font-semibold">Electrical Subsystem Summary</h3><p className="text-sm text-muted">Est: {formatCurrency(estimatedCost)} • {input.units} units • {input.subsystemType}</p></Card>;
      case "milestones": return <Card className="p-6"><h3 className="mb-4 font-semibold">Project Milestones</h3><p className="text-sm text-muted">System design, component procurement, installation, integration testing, commissioning, training</p></Card>;
      case "inspection": return <Card className="p-6"><h3 className="mb-4 font-semibold">Quality Checklist</h3><p className="text-sm text-muted">Functionality verification, safety compliance, performance testing, integration validation, user acceptance</p></Card>;
      case "research": return <Card className="p-6"><h3 className="mb-4 font-semibold">Subsystem Research</h3><Input placeholder="Search smart home systems, solar integration, EV charging standards..." /></Card>;
      default: return null;
    }
  }

  return <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6"><div className="grid gap-6"><div className="flex items-center justify-between gap-3"><Link href="/tools" className="inline-flex items-center gap-2 text-sm text-muted hover:text-ink"><ArrowLeft size={16} /> Back to tools hub</Link><Badge variant="brand">SEMSE Pro Tools</Badge></div><section className="grid gap-3"><div className="flex items-center gap-3"><Zap className="h-8 w-8" /><h1 className="text-3xl font-bold tracking-tight text-ink">Electrical Subsystems Tool</h1></div><p className="max-w-3xl text-sm text-muted">Advanced electrical subsystem integration: HVAC controls, solar, EV charging, battery backup, automation.</p></section><div className="flex gap-2 overflow-x-auto pb-2">{SECTIONS.map((s) => {const Icon = s.icon; const isActive = section === s.id; return <Link key={s.id} href={s.href} className={`inline-flex items-center gap-2 rounded px-3 py-2 text-sm font-medium transition ${isActive ? "bg-blue-600 text-white" : "bg-slate-800 text-muted hover:bg-slate-700"}`}><Icon size={16} /> {s.label}</Link>;})}</div><div className="grid gap-6">{renderSection()}</div></div></main>;
}
