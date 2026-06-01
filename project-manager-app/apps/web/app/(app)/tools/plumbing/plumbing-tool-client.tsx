"use client";

import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { ArrowLeft, Calculator, CheckCircle2, ClipboardCheck, ClipboardList, Globe2, LayoutDashboard, Package, ReceiptText, ShieldCheck, Droplet } from "lucide-react";
import { Badge, Button, Card, Input, Select } from "@/components/ui";
import { calculateSemseTool, type SemseToolResult, type ToolMode } from "@/app/lib/semse-tools-api";
import { ToolResultPanel } from "../ToolResultPanel";

export type PlumbingSection = "dashboard" | "estimate" | "scope" | "materials" | "summary" | "milestones" | "inspection" | "research";

type PlumbingInput = {
  projectType: "repair" | "replacement" | "new_installation" | "bathroom_rough" | "kitchen_rough" | "full_house";
  pipeType: "pvc" | "copper" | "pex" | "cast_iron";
  linearFt: number;
  fixtureCount: number;
  complexity: "simple" | "moderate" | "complex" | "structural";
  accessibilityLevel: "easy" | "moderate" | "difficult" | "walls_behind";
  codeCompliance: "standard" | "full_inspection" | "permit_required";
  mode: ToolMode;
};

const INITIAL_INPUT: PlumbingInput = {
  projectType: "repair",
  pipeType: "pex",
  linearFt: 50,
  fixtureCount: 3,
  complexity: "moderate",
  accessibilityLevel: "moderate",
  codeCompliance: "standard",
  mode: "professional",
};

const SECTIONS: Array<{ id: PlumbingSection; label: string; href: string; icon: LucideIcon }> = [
  { id: "dashboard", label: "Dashboard", href: "/tools/plumbing/dashboard", icon: LayoutDashboard },
  { id: "estimate", label: "Estimacion", href: "/tools/plumbing/estimate", icon: Calculator },
  { id: "scope", label: "Alcance", href: "/tools/plumbing/scope", icon: ClipboardList },
  { id: "materials", label: "Materiales", href: "/tools/plumbing/materials", icon: Package },
  { id: "summary", label: "Resumen", href: "/tools/plumbing/summary", icon: ReceiptText },
  { id: "milestones", label: "Milestones", href: "/tools/plumbing/milestones", icon: ShieldCheck },
  { id: "inspection", label: "Inspeccion", href: "/tools/plumbing/inspection", icon: ClipboardCheck },
  { id: "research", label: "Research", href: "/tools/plumbing/research", icon: Globe2 },
];

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
}

type PlumbingToolClientProps = { section: PlumbingSection };

export function PlumbingToolClient({ section }: PlumbingToolClientProps) {
  const [input, setInput] = useState<PlumbingInput>(INITIAL_INPUT);
  const [result, setResult] = useState<SemseToolResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const costPerFt = useMemo(() => {
    const baseCost: Record<typeof input.pipeType, number> = {
      pvc: 3.0, copper: 8.0, pex: 4.5, cast_iron: 6.0,
    };
    const base = baseCost[input.pipeType] || 4.0;
    const complexityFactor = { simple: 1.0, moderate: 1.3, complex: 1.7, structural: 2.2 }[input.complexity];
    const accessFactor = { easy: 1.0, moderate: 1.2, difficult: 1.5, walls_behind: 2.0 }[input.accessibilityLevel];
    const complianceFactor = input.codeCompliance === "permit_required" ? 1.4 : 1.0;
    return base * complexityFactor * accessFactor * complianceFactor;
  }, [input.pipeType, input.complexity, input.accessibilityLevel, input.codeCompliance]);

  const estimatedCost = useMemo(() => {
    const pipeCost = input.linearFt * costPerFt;
    const fixtureCost = input.fixtureCount * 150;
    return (pipeCost + fixtureCost) * 1.15;
  }, [input.linearFt, costPerFt, input.fixtureCount]);

  async function calculate() {
    setLoading(true);
    setError(null);
    try {
      const response = await calculateSemseTool({ tool: "plumbing", mode: input.mode, input });
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
              <Card className="p-4"><div className="text-sm text-muted">Project Type</div><div className="text-lg font-bold">{input.projectType.replace(/_/g, ' ')}</div></Card>
              <Card className="p-4"><div className="text-sm text-muted">Linear Feet</div><div className="text-2xl font-bold">{input.linearFt}</div></Card>
              <Card className="p-4"><div className="text-sm text-muted">Est. Cost</div><div className="text-2xl font-bold">{formatCurrency(estimatedCost)}</div></Card>
            </div>
          </div>
        );

      case "estimate":
        return (
          <div className="grid gap-6">
            <Card className="p-6">
              <h3 className="mb-4 font-semibold">Plumbing Parameters</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <Select label="Project Type" value={input.projectType} onChange={(e) => setInput({...input, projectType: e.target.value as any})}>
                  <option value="repair">Repair</option>
                  <option value="replacement">Replacement</option>
                  <option value="new_installation">New Installation</option>
                  <option value="bathroom_rough">Bathroom Rough</option>
                  <option value="kitchen_rough">Kitchen Rough</option>
                  <option value="full_house">Full House</option>
                </Select>
                <Select label="Pipe Type" value={input.pipeType} onChange={(e) => setInput({...input, pipeType: e.target.value as any})}>
                  <option value="pvc">PVC</option>
                  <option value="copper">Copper</option>
                  <option value="pex">PEX</option>
                  <option value="cast_iron">Cast Iron</option>
                </Select>
                <Input label="Linear Feet" type="number" value={input.linearFt} onChange={(e) => setInput({...input, linearFt: Number(e.target.value)})} />
                <Input label="Fixture Count" type="number" value={input.fixtureCount} onChange={(e) => setInput({...input, fixtureCount: Number(e.target.value)})} />
                <Select label="Complexity" value={input.complexity} onChange={(e) => setInput({...input, complexity: e.target.value as any})}>
                  <option value="simple">Simple</option>
                  <option value="moderate">Moderate</option>
                  <option value="complex">Complex</option>
                  <option value="structural">Structural</option>
                </Select>
                <Select label="Code Compliance" value={input.codeCompliance} onChange={(e) => setInput({...input, codeCompliance: e.target.value as any})}>
                  <option value="standard">Standard</option>
                  <option value="full_inspection">Full Inspection</option>
                  <option value="permit_required">Permit Required</option>
                </Select>
              </div>
              <Button className="mt-4 w-full" onClick={calculate} disabled={loading}>{loading ? "Calculating..." : "Calculate"}</Button>
            </Card>
            {result && <ToolResultPanel result={result} />}
            {error && <div className="rounded bg-red-500/10 p-4 text-red-500">{error}</div>}
          </div>
        );

      case "scope":
        return <Card className="p-6"><h3 className="mb-4 font-semibold">Project Scope</h3><p className="text-sm text-muted">Type: {input.projectType} • Pipe: {input.pipeType} • {input.linearFt} ft • {input.fixtureCount} fixtures</p></Card>;

      case "materials":
        return <Card className="p-6"><h3 className="mb-4 font-semibold">Materials Takeoff</h3><p className="text-sm text-muted">{input.pipeType} pipe: {input.linearFt} ft • Fixtures: {input.fixtureCount} @ $150 ea • Labor: ${formatCurrency(input.linearFt * costPerFt)}</p></Card>;

      case "summary":
        return <Card className="p-6"><h3 className="mb-4 font-semibold">Plumbing Summary</h3><p className="text-sm text-muted">Est: {formatCurrency(estimatedCost)} • {input.linearFt} ft • {input.projectType}</p></Card>;

      case "milestones":
        return <Card className="p-6"><h3 className="mb-4 font-semibold">Project Milestones</h3><p className="text-sm text-muted">Inspection & materials, rough-in, fixture install, testing & final inspection...</p></Card>;

      case "inspection":
        return <Card className="p-6"><h3 className="mb-4 font-semibold">Quality Checklist</h3><p className="text-sm text-muted">Pressure test, leak detection, fixture function, code compliance, permit sign-off...</p></Card>;

      case "research":
        return <Card className="p-6"><h3 className="mb-4 font-semibold">Plumbing Research</h3><Input placeholder="Search pipe types, fixture sizing, code requirements..." /></Card>;

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
          <div className="flex items-center gap-3"><Droplet className="h-8 w-8" /><h1 className="text-3xl font-bold tracking-tight text-ink">Plumbing Tool</h1></div>
          <p className="max-w-3xl text-sm text-muted">Complete plumbing estimation with materials, labor, and code compliance.</p>
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
