"use client";

import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  ArrowLeft,
  Calculator,
  CheckCircle2,
  ClipboardCheck,
  ClipboardList,
  Globe2,
  LayoutDashboard,
  Package,
  ReceiptText,
  ShieldCheck,
  ChefHat,
} from "lucide-react";
import { Badge, Button, Card, Input, Select, Textarea } from "@/components/ui";
import { calculateSemseTool, type SemseToolResult, type ToolMode } from "@/app/lib/semse-tools-api";
import { ToolResultPanel } from "../ToolResultPanel";

export type KitchenSection =
  | "dashboard"
  | "estimate"
  | "scope"
  | "materials"
  | "summary"
  | "milestones"
  | "inspection"
  | "research";

type KitchenInput = {
  scope: "cabinet_update" | "countertops" | "flooring" | "full_remodel";
  kitchenSize: "small" | "medium" | "large" | "extra_large";
  appliances: "no_appliances" | "basic_appliances" | "premium_appliances";
  materialQuality: "budget" | "standard" | "premium";
  plumbingElectrical: "no" | "minor" | "relocate";
  clientProvidesMaterials: boolean;
  mode: ToolMode;
};

const INITIAL_INPUT: KitchenInput = {
  scope: "full_remodel",
  kitchenSize: "medium",
  appliances: "basic_appliances",
  materialQuality: "standard",
  plumbingElectrical: "no",
  clientProvidesMaterials: false,
  mode: "professional",
};

const SCOPE_NAMES: Record<KitchenInput["scope"], string> = {
  cabinet_update: "Cabinet Update",
  countertops: "Countertops",
  flooring: "Flooring",
  full_remodel: "Full Remodel",
};

const SCOPE_RANGE: Record<KitchenInput["scope"], { min: number; max: number }> = {
  cabinet_update: { min: 2000, max: 6000 },
  countertops: { min: 1500, max: 5000 },
  flooring: { min: 1000, max: 4000 },
  full_remodel: { min: 10000, max: 50000 },
};

const SECTIONS: Array<{ id: KitchenSection; label: string; href: string; icon: LucideIcon }> = [
  { id: "dashboard", label: "Dashboard", href: "/tools/kitchen/dashboard", icon: LayoutDashboard },
  { id: "estimate", label: "Estimacion", href: "/tools/kitchen/estimate", icon: Calculator },
  { id: "scope", label: "Alcance", href: "/tools/kitchen/scope", icon: ClipboardList },
  { id: "materials", label: "Materiales", href: "/tools/kitchen/materials", icon: Package },
  { id: "summary", label: "Resumen", href: "/tools/kitchen/summary", icon: ReceiptText },
  { id: "milestones", label: "Milestones", href: "/tools/kitchen/milestones", icon: ShieldCheck },
  { id: "inspection", label: "Inspeccion", href: "/tools/kitchen/inspection", icon: ClipboardCheck },
  { id: "research", label: "Research", href: "/tools/kitchen/research", icon: Globe2 },
];

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
}

type KitchenToolClientProps = { section: KitchenSection };

export function KitchenToolClient({ section }: KitchenToolClientProps) {
  const [input, setInput] = useState<KitchenInput>(INITIAL_INPUT);
  const [result, setResult] = useState<SemseToolResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const costRange = useMemo(() => SCOPE_RANGE[input.scope], [input.scope]);
  const scopeName = useMemo(() => SCOPE_NAMES[input.scope], [input.scope]);

  async function calculate() {
    setLoading(true);
    setError(null);
    try {
      const response = await calculateSemseTool({ tool: "kitchen", mode: input.mode, input });
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
              <Card className="p-4">
                <div className="text-sm text-muted">Scope</div>
                <div className="text-xl font-bold">{scopeName}</div>
              </Card>
              <Card className="p-4">
                <div className="text-sm text-muted">Est. Range</div>
                <div className="text-lg font-bold">{formatCurrency(costRange.min)}</div>
              </Card>
              <Card className="p-4">
                <div className="text-sm text-muted">Status</div>
                <div className="text-xl font-bold text-yellow-500">Planning</div>
              </Card>
            </div>
          </div>
        );

      case "estimate":
        return (
          <div className="grid gap-6">
            <Card className="p-6">
              <h3 className="mb-4 font-semibold">Kitchen Parameters</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <Select label="Scope" value={input.scope} onChange={(e) => setInput({...input, scope: e.target.value as any})}>
                  <option value="cabinet_update">Cabinet Update</option>
                  <option value="countertops">Countertops</option>
                  <option value="flooring">Flooring</option>
                  <option value="full_remodel">Full Remodel</option>
                </Select>
                <Select label="Kitchen Size" value={input.kitchenSize} onChange={(e) => setInput({...input, kitchenSize: e.target.value as any})}>
                  <option value="small">Small (&lt;100 sqft)</option>
                  <option value="medium">Medium (100-200)</option>
                  <option value="large">Large (200-350)</option>
                  <option value="extra_large">Extra Large (350+)</option>
                </Select>
              </div>
              <Button className="mt-4 w-full" onClick={calculate} disabled={loading}>
                {loading ? "Calculating..." : "Calculate"}
              </Button>
            </Card>
            {result && <ToolResultPanel result={result} />}
            {error && <div className="rounded bg-red-500/10 p-4 text-red-500">{error}</div>}
          </div>
        );

      case "scope":
        return <Card className="p-6"><h3 className="mb-4 font-semibold">Project Scope</h3><p className="text-sm text-muted">Kitchen remodel scope and details...</p></Card>;

      case "materials":
        return <Card className="p-6"><h3 className="mb-4 font-semibold">Materials & Fixtures</h3><p className="text-sm text-muted">Cabinetry, countertops, appliances, hardware...</p></Card>;

      case "summary":
        return <Card className="p-6"><h3 className="mb-4 font-semibold">Kitchen Summary</h3><p className="text-sm text-muted">Est. {formatCurrency(costRange.min)} - {formatCurrency(costRange.max)}</p></Card>;

      case "milestones":
        return <Card className="p-6"><h3 className="mb-4 font-semibold">Project Milestones</h3><p className="text-sm text-muted">Demo, rough-in, installation, finishing...</p></Card>;

      case "inspection":
        return <Card className="p-6"><h3 className="mb-4 font-semibold">Quality Inspection</h3><p className="text-sm text-muted">Cabinet alignment, countertop fit, appliance function...</p></Card>;

      case "research":
        return <Card className="p-6"><h3 className="mb-4 font-semibold">Kitchen Research</h3><Input placeholder="Search kitchen materials, design..." /></Card>;

      default:
        return null;
    }
  }

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6">
      <div className="grid gap-6">
        <div className="flex items-center justify-between gap-3">
          <Link href="/tools" className="inline-flex items-center gap-2 text-sm text-muted hover:text-ink">
            <ArrowLeft size={16} /> Back to tools hub
          </Link>
          <Badge variant="brand">SEMSE Pro Tools</Badge>
        </div>

        <section className="grid gap-3">
          <div className="flex items-center gap-3">
            <ChefHat className="h-8 w-8" />
            <h1 className="text-3xl font-bold tracking-tight text-ink">Kitchen Tool</h1>
          </div>
          <p className="max-w-3xl text-sm text-muted">Complete kitchen remodel estimation with cabinetry, appliances, and design guidance.</p>
        </section>

        <div className="flex gap-2 overflow-x-auto pb-2">
          {SECTIONS.map((s) => {
            const Icon = s.icon;
            const isActive = section === s.id;
            return (
              <Link
                key={s.id}
                href={s.href}
                className={`inline-flex items-center gap-2 rounded px-3 py-2 text-sm font-medium transition ${
                  isActive ? "bg-blue-600 text-white" : "bg-slate-800 text-muted hover:bg-slate-700"
                }`}
              >
                <Icon size={16} />
                {s.label}
              </Link>
            );
          })}
        </div>

        <div className="grid gap-6">{renderSection()}</div>
      </div>
    </main>
  );
}
