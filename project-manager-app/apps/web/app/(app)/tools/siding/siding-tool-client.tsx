"use client";

import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { ArrowLeft, Calculator, CheckCircle2, ClipboardCheck, ClipboardList, Globe2, LayoutDashboard, Package, ReceiptText, ShieldCheck, Home } from "lucide-react";
import { Badge, Button, Card, Input, Select } from "@/components/ui";
import { calculateSemseTool, type SemseToolResult, type ToolMode } from "@/app/lib/semse-tools-api";
import { ToolResultPanel } from "../ToolResultPanel";

export type SidingSection = "dashboard" | "estimate" | "scope" | "materials" | "summary" | "milestones" | "inspection" | "research";

type SidingInput = {
  wallAreaSqft: number;
  sidingType: "vinyl" | "fiber_cement" | "wood" | "metal" | "brick_veneer" | "stone";
  colorProfile: "standard" | "premium" | "custom";
  removeOldSiding: boolean;
  wrapExisting: boolean;
  insulationUpgrade: boolean;
  accessibilityLevel: "ground" | "single_story" | "multi_story" | "scaffolding";
  mode: ToolMode;
};

const INITIAL_INPUT: SidingInput = {
  wallAreaSqft: 1200,
  sidingType: "vinyl",
  colorProfile: "standard",
  removeOldSiding: false,
  wrapExisting: false,
  insulationUpgrade: false,
  accessibilityLevel: "single_story",
  mode: "professional",
};

const SECTIONS: Array<{ id: SidingSection; label: string; href: string; icon: LucideIcon }> = [
  { id: "dashboard", label: "Dashboard", href: "/tools/siding/dashboard", icon: LayoutDashboard },
  { id: "estimate", label: "Estimacion", href: "/tools/siding/estimate", icon: Calculator },
  { id: "scope", label: "Alcance", href: "/tools/siding/scope", icon: ClipboardList },
  { id: "materials", label: "Materiales", href: "/tools/siding/materials", icon: Package },
  { id: "summary", label: "Resumen", href: "/tools/siding/summary", icon: ReceiptText },
  { id: "milestones", label: "Milestones", href: "/tools/siding/milestones", icon: ShieldCheck },
  { id: "inspection", label: "Inspeccion", href: "/tools/siding/inspection", icon: ClipboardCheck },
  { id: "research", label: "Research", href: "/tools/siding/research", icon: Globe2 },
];

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
}

type SidingToolClientProps = { section: SidingSection };

export function SidingToolClient({ section }: SidingToolClientProps) {
  const [input, setInput] = useState<SidingInput>(INITIAL_INPUT);
  const [result, setResult] = useState<SemseToolResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const costPerSqft = useMemo(() => {
    const baseCost: Record<typeof input.sidingType, number> = {
      vinyl: 4.5, fiber_cement: 8.0, wood: 7.0, metal: 5.5, brick_veneer: 12.0, stone: 15.0,
    };
    const base = baseCost[input.sidingType] || 5.0;
    const removalFactor = input.removeOldSiding ? 1.3 : 1.0;
    const colorFactor = input.colorProfile === "custom" ? 1.2 : 1.0;
    const accessFactor = { ground: 1.0, single_story: 1.1, multi_story: 1.4, scaffolding: 1.8 }[input.accessibilityLevel];
    return base * removalFactor * colorFactor * accessFactor;
  }, [input.sidingType, input.removeOldSiding, input.colorProfile, input.accessibilityLevel]);

  const estimatedCost = useMemo(() => input.wallAreaSqft * costPerSqft * 1.12, [input.wallAreaSqft, costPerSqft]);

  async function calculate() {
    setLoading(true);
    setError(null);
    try {
      const response = await calculateSemseTool({ tool: "siding", mode: input.mode, input });
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
              <Card className="p-4"><div className="text-sm text-muted">Wall Area</div><div className="text-2xl font-bold">{input.wallAreaSqft.toFixed(0)} sqft</div></Card>
              <Card className="p-4"><div className="text-sm text-muted">Type</div><div className="text-lg font-bold capitalize">{input.sidingType.replace(/_/g, ' ')}</div></Card>
              <Card className="p-4"><div className="text-sm text-muted">Est. Cost</div><div className="text-2xl font-bold">{formatCurrency(estimatedCost)}</div></Card>
            </div>
          </div>
        );

      case "estimate":
        return (
          <div className="grid gap-6">
            <Card className="p-6">
              <h3 className="mb-4 font-semibold">Siding Parameters</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <Input label="Wall Area (sqft)" type="number" value={input.wallAreaSqft} onChange={(e) => setInput({...input, wallAreaSqft: Number(e.target.value)})} />
                <Select label="Type" value={input.sidingType} onChange={(e) => setInput({...input, sidingType: e.target.value as any})}>
                  <option value="vinyl">Vinyl</option>
                  <option value="fiber_cement">Fiber Cement</option>
                  <option value="wood">Wood</option>
                  <option value="metal">Metal</option>
                  <option value="brick_veneer">Brick Veneer</option>
                  <option value="stone">Stone</option>
                </Select>
                <Select label="Access Level" value={input.accessibilityLevel} onChange={(e) => setInput({...input, accessibilityLevel: e.target.value as any})}>
                  <option value="ground">Ground Level</option>
                  <option value="single_story">Single Story</option>
                  <option value="multi_story">Multi Story</option>
                  <option value="scaffolding">Scaffolding Required</option>
                </Select>
                <Select label="Color Profile" value={input.colorProfile} onChange={(e) => setInput({...input, colorProfile: e.target.value as any})}>
                  <option value="standard">Standard</option>
                  <option value="premium">Premium</option>
                  <option value="custom">Custom</option>
                </Select>
              </div>
              <Button className="mt-4 w-full" onClick={calculate} disabled={loading}>{loading ? "Calculating..." : "Calculate"}</Button>
            </Card>
            {result && <ToolResultPanel result={result} />}
            {error && <div className="rounded bg-red-500/10 p-4 text-red-500">{error}</div>}
          </div>
        );

      case "scope":
        return <Card className="p-6"><h3 className="mb-4 font-semibold">Project Scope</h3><p className="text-sm text-muted">Wall area: {input.wallAreaSqft.toFixed(0)} sqft • Type: {input.sidingType} • Access: {input.accessibilityLevel}</p></Card>;

      case "materials":
        return <Card className="p-6"><h3 className="mb-4 font-semibold">Materials Takeoff</h3><p className="text-sm text-muted">{input.sidingType}: {input.wallAreaSqft.toFixed(0)} sqft • Cost/sqft: {formatCurrency(costPerSqft)}</p></Card>;

      case "summary":
        return <Card className="p-6"><h3 className="mb-4 font-semibold">Siding Summary</h3><p className="text-sm text-muted">Est: {formatCurrency(estimatedCost)} • {input.wallAreaSqft.toFixed(0)} sqft • {input.sidingType}</p></Card>;

      case "milestones":
        return <Card className="p-6"><h3 className="mb-4 font-semibold">Project Milestones</h3><p className="text-sm text-muted">Prep & removal, substrate repair, siding install, trim & sealing, final inspection...</p></Card>;

      case "inspection":
        return <Card className="p-6"><h3 className="mb-4 font-semibold">Quality Checklist</h3><p className="text-sm text-muted">Alignment, fastening, seams, water barrier, trim finish, color match...</p></Card>;

      case "research":
        return <Card className="p-6"><h3 className="mb-4 font-semibold">Siding Research</h3><Input placeholder="Search siding materials, durability, maintenance requirements..." /></Card>;

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
          <div className="flex items-center gap-3"><Home className="h-8 w-8" /><h1 className="text-3xl font-bold tracking-tight text-ink">Siding Tool</h1></div>
          <p className="max-w-3xl text-sm text-muted">Complete siding estimation with materials, labor, and installation options.</p>
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
