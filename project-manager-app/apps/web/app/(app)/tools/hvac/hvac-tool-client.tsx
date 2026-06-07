"use client";

import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { ArrowLeft, Calculator, CheckCircle2, ClipboardCheck, ClipboardList, Globe2, LayoutDashboard, Package, ReceiptText, ShieldCheck, Wind } from "lucide-react";
import { Badge, Button, Card, Input, Select } from "@/components/ui";
import { calculateSemseTool, type SemseToolResult, type ToolMode } from "@/app/lib/semse-tools-api";
import { ToolResultPanel } from "../ToolResultPanel";

export type HvacSection = "dashboard" | "estimate" | "scope" | "materials" | "summary" | "milestones" | "inspection" | "research";

type HvacInput = {
  projectType: "ac_only" | "heating_only" | "heat_pump" | "full_system" | "replacement" | "upgrade";
  systemType: "window_unit" | "split_system" | "central_air" | "furnace" | "heat_pump" | "mini_split";
  squareFt: number;
  seer: "low" | "medium" | "high" | "premium";
  zoning: "single" | "multi_zone";
  ductwork: "existing" | "new_installation" | "upgrade";
  efficiency: "standard" | "high_efficiency" | "variable_speed";
  mode: ToolMode;
};

const INITIAL_INPUT: HvacInput = {
  projectType: "replacement",
  systemType: "central_air",
  squareFt: 2000,
  seer: "medium",
  zoning: "single",
  ductwork: "existing",
  efficiency: "high_efficiency",
  mode: "professional",
};

const SECTIONS: Array<{ id: HvacSection; label: string; href: string; icon: LucideIcon }> = [
  { id: "dashboard", label: "Dashboard", href: "/tools/hvac/dashboard", icon: LayoutDashboard },
  { id: "estimate", label: "Estimacion", href: "/tools/hvac/estimate", icon: Calculator },
  { id: "scope", label: "Alcance", href: "/tools/hvac/scope", icon: ClipboardList },
  { id: "materials", label: "Materiales", href: "/tools/hvac/materials", icon: Package },
  { id: "summary", label: "Resumen", href: "/tools/hvac/summary", icon: ReceiptText },
  { id: "milestones", label: "Milestones", href: "/tools/hvac/milestones", icon: ShieldCheck },
  { id: "inspection", label: "Inspeccion", href: "/tools/hvac/inspection", icon: ClipboardCheck },
  { id: "research", label: "Research", href: "/tools/hvac/research", icon: Globe2 },
];

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
}

type HvacToolClientProps = { section: HvacSection };

export function HvacToolClient({ section }: HvacToolClientProps) {
  const [input, setInput] = useState<HvacInput>(INITIAL_INPUT);
  const [result, setResult] = useState<SemseToolResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const costPerSqft = useMemo(() => {
    const baseCost: Record<typeof input.systemType, number> = {
      window_unit: 0.3, split_system: 4.0, central_air: 5.5, furnace: 3.5, heat_pump: 7.0, mini_split: 5.5,
    };
    const base = baseCost[input.systemType] || 5.0;
    const seerFactor = { low: 0.9, medium: 1.0, high: 1.2, premium: 1.5 }[input.seer];
    const efficiencyFactor = { standard: 1.0, high_efficiency: 1.3, variable_speed: 1.5 }[input.efficiency];
    const zoneFactor = input.zoning === "multi_zone" ? 1.4 : 1.0;
    const ductFactor = input.ductwork === "new_installation" ? 1.6 : 1.0;
    return base * seerFactor * efficiencyFactor * zoneFactor * ductFactor;
  }, [input.systemType, input.seer, input.efficiency, input.zoning, input.ductwork]);

  const estimatedCost = useMemo(() => input.squareFt * costPerSqft * 1.1, [input.squareFt, costPerSqft]);

  async function calculate() {
    setLoading(true);
    setError(null);
    try {
      const response = await calculateSemseTool({ tool: "hvac", mode: input.mode, input });
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
              <Card className="p-4"><div className="text-sm text-muted">System Type</div><div className="text-lg font-bold">{input.systemType.replace(/_/g, ' ')}</div></Card>
              <Card className="p-4"><div className="text-sm text-muted">Coverage</div><div className="text-2xl font-bold">{input.squareFt} sqft</div></Card>
              <Card className="p-4"><div className="text-sm text-muted">Est. Cost</div><div className="text-2xl font-bold">{formatCurrency(estimatedCost)}</div></Card>
            </div>
          </div>
        );

      case "estimate":
        return (
          <div className="grid gap-6">
            <Card className="p-6">
              <h3 className="mb-4 font-semibold">HVAC Parameters</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <Select label="System Type" value={input.systemType} onChange={(e) => setInput({...input, systemType: e.target.value as any})}>
                  <option value="window_unit">Window Unit</option>
                  <option value="split_system">Split System</option>
                  <option value="central_air">Central Air</option>
                  <option value="furnace">Furnace</option>
                  <option value="heat_pump">Heat Pump</option>
                  <option value="mini_split">Mini Split</option>
                </Select>
                <Input label="Square Feet" type="number" value={input.squareFt} onChange={(e) => setInput({...input, squareFt: Number(e.target.value)})} />
                <Select label="SEER Rating" value={input.seer} onChange={(e) => setInput({...input, seer: e.target.value as any})}>
                  <option value="low">Low (13-14)</option>
                  <option value="medium">Medium (15-16)</option>
                  <option value="high">High (17-18)</option>
                  <option value="premium">Premium (19+)</option>
                </Select>
                <Select label="Efficiency" value={input.efficiency} onChange={(e) => setInput({...input, efficiency: e.target.value as any})}>
                  <option value="standard">Standard</option>
                  <option value="high_efficiency">High Efficiency</option>
                  <option value="variable_speed">Variable Speed</option>
                </Select>
                <Select label="Zoning" value={input.zoning} onChange={(e) => setInput({...input, zoning: e.target.value as any})}>
                  <option value="single">Single Zone</option>
                  <option value="multi_zone">Multi Zone</option>
                </Select>
                <Select label="Ductwork" value={input.ductwork} onChange={(e) => setInput({...input, ductwork: e.target.value as any})}>
                  <option value="existing">Existing</option>
                  <option value="new_installation">New Installation</option>
                  <option value="upgrade">Upgrade</option>
                </Select>
              </div>
              <Button className="mt-4 w-full" onClick={calculate} disabled={loading}>{loading ? "Calculating..." : "Calculate"}</Button>
            </Card>
            {result && <ToolResultPanel result={result} />}
            {error && <div className="rounded bg-red-500/10 p-4 text-red-500">{error}</div>}
          </div>
        );

      case "scope":
        return <Card className="p-6"><h3 className="mb-4 font-semibold">Project Scope</h3><p className="text-sm text-muted">System: {input.systemType} • Coverage: {input.squareFt} sqft • Type: {input.projectType}</p></Card>;

      case "materials":
        return <Card className="p-6"><h3 className="mb-4 font-semibold">Materials & Equipment</h3><p className="text-sm text-muted">{input.systemType} • SEER: {input.seer} • Ductwork: {input.ductwork} • Cost/sqft: {formatCurrency(costPerSqft)}</p></Card>;

      case "summary":
        return <Card className="p-6"><h3 className="mb-4 font-semibold">HVAC Summary</h3><p className="text-sm text-muted">Est: {formatCurrency(estimatedCost)} • {input.squareFt} sqft • {input.systemType}</p></Card>;

      case "milestones":
        return <Card className="p-6"><h3 className="mb-4 font-semibold">Project Milestones</h3><p className="text-sm text-muted">Site prep & inspection, equipment install, ductwork, testing & commissioning...</p></Card>;

      case "inspection":
        return <Card className="p-6"><h3 className="mb-4 font-semibold">Quality Checklist</h3><p className="text-sm text-muted">Proper sizing, installation per code, airflow testing, thermostat function, warranty registration...</p></Card>;

      case "research":
        return <Card className="p-6"><h3 className="mb-4 font-semibold">HVAC Research</h3><Input placeholder="Search HVAC systems, efficiency ratings, maintenance schedules..." /></Card>;

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
          <div className="flex items-center gap-3"><Wind className="h-8 w-8" /><h1 className="text-3xl font-bold tracking-tight text-ink">HVAC Tool</h1></div>
          <p className="max-w-3xl text-sm text-muted">Complete HVAC estimation with heating, cooling, and efficiency options.</p>
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
