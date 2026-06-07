"use client";

import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { ArrowLeft, Calculator, CheckCircle2, ClipboardCheck, ClipboardList, Globe2, LayoutDashboard, Package, ReceiptText, ShieldCheck, Sparkles } from "lucide-react";
import { Badge, Button, Card, Input, Select } from "@/components/ui";
import { calculateSemseTool, type SemseToolResult, type ToolMode } from "@/app/lib/semse-tools-api";
import { ToolResultPanel } from "../ToolResultPanel";

export type CleaningSection = "dashboard" | "estimate" | "scope" | "materials" | "summary" | "milestones" | "inspection" | "research";

type CleaningInput = {
  serviceType: "standard" | "deep" | "move_inout" | "post_construction" | "commercial";
  squareFt: number;
  bedrooms: number;
  bathrooms: number;
  condition: "light" | "moderate" | "heavy" | "post_construction";
  addOns: string[];
  frequency: "one_time" | "weekly" | "biweekly" | "monthly";
  suppliesIncluded: boolean;
  mode: ToolMode;
};

const INITIAL: CleaningInput = {
  serviceType: "deep",
  squareFt: 1200,
  bedrooms: 3,
  bathrooms: 2,
  condition: "moderate",
  addOns: [],
  frequency: "one_time",
  suppliesIncluded: true,
  mode: "professional",
};

const SECTIONS: Array<{ id: CleaningSection; label: string; href: string; icon: LucideIcon }> = [
  { id: "dashboard", label: "Dashboard", href: "/tools/cleaning/dashboard", icon: LayoutDashboard },
  { id: "estimate", label: "Estimacion", href: "/tools/cleaning/estimate", icon: Calculator },
  { id: "scope", label: "Alcance", href: "/tools/cleaning/scope", icon: ClipboardList },
  { id: "materials", label: "Materiales", href: "/tools/cleaning/materials", icon: Package },
  { id: "summary", label: "Resumen", href: "/tools/cleaning/summary", icon: ReceiptText },
  { id: "milestones", label: "Milestones", href: "/tools/cleaning/milestones", icon: ShieldCheck },
  { id: "inspection", label: "Inspeccion", href: "/tools/cleaning/inspection", icon: ClipboardCheck },
  { id: "research", label: "Research", href: "/tools/cleaning/research", icon: Globe2 },
];

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
}

const RATE_PER_SQFT = 0.10;

type CleaningToolClientProps = { section: CleaningSection };

export function CleaningToolClient({ section }: CleaningToolClientProps) {
  const [input, setInput] = useState<CleaningInput>(INITIAL);
  const [result, setResult] = useState<SemseToolResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const baseCost = useMemo(() => input.squareFt * RATE_PER_SQFT, [input.squareFt]);
  const estimatedCost = useMemo(() => {
    let cost = baseCost;
    if (input.serviceType === "deep") cost *= 1.5;
    if (input.serviceType === "post_construction") cost *= 1.8;
    if (input.frequency === "weekly") cost *= 0.8;
    return Math.round(cost);
  }, [baseCost, input.serviceType, input.frequency]);

  async function calculate() {
    setLoading(true);
    setError(null);
    try {
      const response = await calculateSemseTool({ tool: "cleaning", mode: input.mode, input });
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
              <Card className="p-4"><div className="text-sm text-muted">Service Type</div><div className="text-lg font-bold">{input.serviceType}</div></Card>
              <Card className="p-4"><div className="text-sm text-muted">Area</div><div className="text-2xl font-bold">{input.squareFt} sqft</div></Card>
              <Card className="p-4"><div className="text-sm text-muted">Est. Cost</div><div className="text-2xl font-bold">{formatCurrency(estimatedCost)}</div></Card>
            </div>
          </div>
        );

      case "estimate":
        return (
          <div className="grid gap-6">
            <Card className="p-6">
              <h3 className="mb-4 font-semibold">Cleaning Parameters</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <Select label="Service Type" value={input.serviceType} onChange={(e) => setInput({...input, serviceType: e.target.value as any})}>
                  <option value="standard">Standard</option>
                  <option value="deep">Deep</option>
                  <option value="move_inout">Move In/Out</option>
                  <option value="post_construction">Post-Construction</option>
                  <option value="commercial">Commercial</option>
                </Select>
                <Input label="Square Feet" type="number" value={input.squareFt} onChange={(e) => setInput({...input, squareFt: Number(e.target.value)})} />
                <Input label="Bedrooms" type="number" value={input.bedrooms} onChange={(e) => setInput({...input, bedrooms: Number(e.target.value)})} />
                <Input label="Bathrooms" type="number" value={input.bathrooms} onChange={(e) => setInput({...input, bathrooms: Number(e.target.value)})} />
                <Select label="Condition" value={input.condition} onChange={(e) => setInput({...input, condition: e.target.value as any})}>
                  <option value="light">Light</option>
                  <option value="moderate">Moderate</option>
                  <option value="heavy">Heavy</option>
                  <option value="post_construction">Post-Construction</option>
                </Select>
              </div>
              <Button className="mt-4 w-full" onClick={calculate} disabled={loading}>{loading ? "Calculating..." : "Calculate"}</Button>
            </Card>
            {result && <ToolResultPanel result={result} />}
            {error && <div className="rounded bg-red-500/10 p-4 text-red-500">{error}</div>}
          </div>
        );

      case "scope":
        return <Card className="p-6"><h3 className="mb-4 font-semibold">Cleaning Scope</h3><p className="text-sm text-muted">Rooms, bathrooms, kitchen, floors, windows...</p></Card>;

      case "materials":
        return <Card className="p-6"><h3 className="mb-4 font-semibold">Supplies & Equipment</h3><p className="text-sm text-muted">Cleaning solutions, equipment, protective gear...</p></Card>;

      case "summary":
        return <Card className="p-6"><h3 className="mb-4 font-semibold">Cleaning Summary</h3><p className="text-sm text-muted">Est: {formatCurrency(estimatedCost)} • {input.squareFt} sqft</p></Card>;

      case "milestones":
        return <Card className="p-6"><h3 className="mb-4 font-semibold">Service Schedule</h3><p className="text-sm text-muted">Scheduled for {input.frequency}</p></Card>;

      case "inspection":
        return <Card className="p-6"><h3 className="mb-4 font-semibold">Quality Inspection</h3><p className="text-sm text-muted">All surfaces cleaned, dust-free, client approval...</p></Card>;

      case "research":
        return <Card className="p-6"><h3 className="mb-4 font-semibold">Cleaning Research</h3><Input placeholder="Search cleaning techniques, products..." /></Card>;

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
          <div className="flex items-center gap-3"><Sparkles className="h-8 w-8" /><h1 className="text-3xl font-bold tracking-tight text-ink">Cleaning Tool</h1></div>
          <p className="max-w-3xl text-sm text-muted">Professional cleaning estimation for residential and commercial properties.</p>
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
