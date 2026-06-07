"use client";

import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { ArrowLeft, Calculator, CheckCircle2, ClipboardCheck, ClipboardList, Globe2, LayoutDashboard, Package, ReceiptText, ShieldCheck, Frame } from "lucide-react";
import { Badge, Button, Card, Input, Select } from "@/components/ui";
import { calculateSemseTool, type SemseToolResult, type ToolMode } from "@/app/lib/semse-tools-api";
import { ToolResultPanel } from "../ToolResultPanel";

export type WindowsDoorsSection = "dashboard" | "estimate" | "scope" | "materials" | "summary" | "milestones" | "inspection" | "research";

type WindowsDoorsInput = {
  projectType: "windows_only" | "doors_only" | "mixed" | "full_replacement" | "retrofit";
  materialType: "vinyl" | "wood" | "fiberglass" | "aluminum" | "composite";
  quantity: number;
  glass: "single_pane" | "double_pane" | "triple_pane" | "energy_star";
  style: "double_hung" | "casement" | "sliding" | "fixed" | "entry_door" | "patio";
  installComplexity: "simple" | "moderate" | "complex" | "structural";
  weatherSealing: "standard" | "premium" | "full_weatherization";
  mode: ToolMode;
};

const INITIAL_INPUT: WindowsDoorsInput = {
  projectType: "mixed",
  materialType: "vinyl",
  quantity: 6,
  glass: "double_pane",
  style: "double_hung",
  installComplexity: "moderate",
  weatherSealing: "standard",
  mode: "professional",
};

const SECTIONS: Array<{ id: WindowsDoorsSection; label: string; href: string; icon: LucideIcon }> = [
  { id: "dashboard", label: "Dashboard", href: "/tools/windows-doors/dashboard", icon: LayoutDashboard },
  { id: "estimate", label: "Estimacion", href: "/tools/windows-doors/estimate", icon: Calculator },
  { id: "scope", label: "Alcance", href: "/tools/windows-doors/scope", icon: ClipboardList },
  { id: "materials", label: "Materiales", href: "/tools/windows-doors/materials", icon: Package },
  { id: "summary", label: "Resumen", href: "/tools/windows-doors/summary", icon: ReceiptText },
  { id: "milestones", label: "Milestones", href: "/tools/windows-doors/milestones", icon: ShieldCheck },
  { id: "inspection", label: "Inspeccion", href: "/tools/windows-doors/inspection", icon: ClipboardCheck },
  { id: "research", label: "Research", href: "/tools/windows-doors/research", icon: Globe2 },
];

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
}

type WindowsDoorsToolClientProps = { section: WindowsDoorsSection };

export function WindowsDoorsToolClient({ section }: WindowsDoorsToolClientProps) {
  const [input, setInput] = useState<WindowsDoorsInput>(INITIAL_INPUT);
  const [result, setResult] = useState<SemseToolResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const costPerUnit = useMemo(() => {
    const baseCost: Record<typeof input.materialType, number> = {
      vinyl: 250, wood: 400, fiberglass: 350, aluminum: 300, composite: 500,
    };
    const base = baseCost[input.materialType] || 300;
    const glassFactor = { single_pane: 0.8, double_pane: 1.0, triple_pane: 1.3, energy_star: 1.5 }[input.glass];
    const complexityFactor = { simple: 1.0, moderate: 1.2, complex: 1.5, structural: 2.0 }[input.installComplexity];
    const sealFactor = { standard: 1.0, premium: 1.2, full_weatherization: 1.4 }[input.weatherSealing];
    return base * glassFactor * complexityFactor * sealFactor;
  }, [input.materialType, input.glass, input.installComplexity, input.weatherSealing]);

  const estimatedCost = useMemo(() => input.quantity * costPerUnit * 1.12, [input.quantity, costPerUnit]);

  async function calculate() {
    setLoading(true);
    setError(null);
    try {
      const response = await calculateSemseTool({ tool: "windows-doors", mode: input.mode, input });
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
              <Card className="p-4"><div className="text-sm text-muted">Quantity</div><div className="text-2xl font-bold">{input.quantity}</div></Card>
              <Card className="p-4"><div className="text-sm text-muted">Material</div><div className="text-lg font-bold">{input.materialType}</div></Card>
              <Card className="p-4"><div className="text-sm text-muted">Est. Cost</div><div className="text-2xl font-bold">{formatCurrency(estimatedCost)}</div></Card>
            </div>
          </div>
        );

      case "estimate":
        return (
          <div className="grid gap-6">
            <Card className="p-6">
              <h3 className="mb-4 font-semibold">Windows & Doors Parameters</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <Select label="Project Type" value={input.projectType} onChange={(e) => setInput({...input, projectType: e.target.value as any})}>
                  <option value="windows_only">Windows Only</option>
                  <option value="doors_only">Doors Only</option>
                  <option value="mixed">Mixed</option>
                  <option value="full_replacement">Full Replacement</option>
                  <option value="retrofit">Retrofit</option>
                </Select>
                <Select label="Material" value={input.materialType} onChange={(e) => setInput({...input, materialType: e.target.value as any})}>
                  <option value="vinyl">Vinyl</option>
                  <option value="wood">Wood</option>
                  <option value="fiberglass">Fiberglass</option>
                  <option value="aluminum">Aluminum</option>
                  <option value="composite">Composite</option>
                </Select>
                <Input label="Quantity" type="number" value={input.quantity} onChange={(e) => setInput({...input, quantity: Number(e.target.value)})} />
                <Select label="Glass Type" value={input.glass} onChange={(e) => setInput({...input, glass: e.target.value as any})}>
                  <option value="single_pane">Single Pane</option>
                  <option value="double_pane">Double Pane</option>
                  <option value="triple_pane">Triple Pane</option>
                  <option value="energy_star">Energy Star</option>
                </Select>
                <Select label="Style" value={input.style} onChange={(e) => setInput({...input, style: e.target.value as any})}>
                  <option value="double_hung">Double Hung</option>
                  <option value="casement">Casement</option>
                  <option value="sliding">Sliding</option>
                  <option value="fixed">Fixed</option>
                  <option value="entry_door">Entry Door</option>
                  <option value="patio">Patio Door</option>
                </Select>
                <Select label="Complexity" value={input.installComplexity} onChange={(e) => setInput({...input, installComplexity: e.target.value as any})}>
                  <option value="simple">Simple</option>
                  <option value="moderate">Moderate</option>
                  <option value="complex">Complex</option>
                  <option value="structural">Structural</option>
                </Select>
              </div>
              <Button className="mt-4 w-full" onClick={calculate} disabled={loading}>{loading ? "Calculating..." : "Calculate"}</Button>
            </Card>
            {result && <ToolResultPanel result={result} />}
            {error && <div className="rounded bg-red-500/10 p-4 text-red-500">{error}</div>}
          </div>
        );

      case "scope":
        return <Card className="p-6"><h3 className="mb-4 font-semibold">Project Scope</h3><p className="text-sm text-muted">Type: {input.projectType} • Material: {input.materialType} • Qty: {input.quantity} • Style: {input.style}</p></Card>;

      case "materials":
        return <Card className="p-6"><h3 className="mb-4 font-semibold">Materials Takeoff</h3><p className="text-sm text-muted">{input.materialType} {input.style}: {input.quantity} units • Glass: {input.glass} • Cost/unit: {formatCurrency(costPerUnit)}</p></Card>;

      case "summary":
        return <Card className="p-6"><h3 className="mb-4 font-semibold">Windows & Doors Summary</h3><p className="text-sm text-muted">Est: {formatCurrency(estimatedCost)} • {input.quantity} units • {input.materialType}</p></Card>;

      case "milestones":
        return <Card className="p-6"><h3 className="mb-4 font-semibold">Project Milestones</h3><p className="text-sm text-muted">Measurement & ordering, removal of old units, frame preparation, new unit install, sealing & trim...</p></Card>;

      case "inspection":
        return <Card className="p-6"><h3 className="mb-4 font-semibold">Quality Checklist</h3><p className="text-sm text-muted">Alignment, seal integrity, operation, weatherproofing, trim quality, caulking...</p></Card>;

      case "research":
        return <Card className="p-6"><h3 className="mb-4 font-semibold">Windows & Doors Research</h3><Input placeholder="Search materials, styles, energy efficiency ratings, installation methods..." /></Card>;

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
          <div className="flex items-center gap-3"><Frame className="h-8 w-8" /><h1 className="text-3xl font-bold tracking-tight text-ink">Windows & Doors Tool</h1></div>
          <p className="max-w-3xl text-sm text-muted">Complete windows and doors estimation with materials, labor, and installation options.</p>
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
