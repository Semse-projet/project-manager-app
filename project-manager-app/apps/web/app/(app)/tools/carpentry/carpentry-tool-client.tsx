"use client";

import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { ArrowLeft, Calculator, CheckCircle2, ClipboardCheck, ClipboardList, Globe2, LayoutDashboard, Package, ReceiptText, ShieldCheck, Hammer } from "lucide-react";
import { Badge, Button, Card, Input, Select } from "@/components/ui";
import { calculateSemseTool, type SemseToolResult, type ToolMode } from "@/app/lib/semse-tools-api";
import { ToolResultPanel } from "../ToolResultPanel";

export type CarpentrySection = "dashboard" | "estimate" | "scope" | "materials" | "summary" | "milestones" | "inspection" | "research";

type CarpentryInput = {
  projectType: "cabinet" | "door" | "closet" | "shelf" | "trim" | "table" | "repair" | "custom";
  material: "pine" | "plywood" | "mdf" | "oak" | "treated";
  lengthIn: number;
  widthIn: number;
  thicknessIn: number;
  quantity: number;
  finishType: "none" | "paint" | "stain" | "polyurethane";
  complexity: "basic" | "medium" | "complex";
  hardwareCount: number;
  mode: ToolMode;
};

const INITIAL_INPUT: CarpentryInput = {
  projectType: "closet",
  material: "plywood",
  lengthIn: 96,
  widthIn: 24,
  thicknessIn: 0.75,
  quantity: 6,
  finishType: "paint",
  complexity: "medium",
  hardwareCount: 12,
  mode: "professional",
};

const SECTIONS: Array<{ id: CarpentrySection; label: string; href: string; icon: LucideIcon }> = [
  { id: "dashboard", label: "Dashboard", href: "/tools/carpentry/dashboard", icon: LayoutDashboard },
  { id: "estimate", label: "Estimacion", href: "/tools/carpentry/estimate", icon: Calculator },
  { id: "scope", label: "Alcance", href: "/tools/carpentry/scope", icon: ClipboardList },
  { id: "materials", label: "Materiales", href: "/tools/carpentry/materials", icon: Package },
  { id: "summary", label: "Resumen", href: "/tools/carpentry/summary", icon: ReceiptText },
  { id: "milestones", label: "Milestones", href: "/tools/carpentry/milestones", icon: ShieldCheck },
  { id: "inspection", label: "Inspeccion", href: "/tools/carpentry/inspection", icon: ClipboardCheck },
  { id: "research", label: "Research", href: "/tools/carpentry/research", icon: Globe2 },
];

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
}

type CarpentryToolClientProps = { section: CarpentrySection };

export function CarpentryToolClient({ section }: CarpentryToolClientProps) {
  const [input, setInput] = useState<CarpentryInput>(INITIAL_INPUT);
  const [result, setResult] = useState<SemseToolResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pieceSize = useMemo(() => (input.lengthIn * input.widthIn * input.thicknessIn) / 144, [input]);
  const totalBoardFeet = useMemo(() => pieceSize * input.quantity, [pieceSize, input.quantity]);
  const estimatedCost = useMemo(() => totalBoardFeet * 3.5, [totalBoardFeet]);

  async function calculate() {
    setLoading(true);
    setError(null);
    try {
      const response = await calculateSemseTool({ tool: "carpentry", mode: input.mode, input });
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
              <Card className="p-4"><div className="text-sm text-muted">Project Type</div><div className="text-lg font-bold">{input.projectType}</div></Card>
              <Card className="p-4"><div className="text-sm text-muted">Total Board Feet</div><div className="text-2xl font-bold">{totalBoardFeet.toFixed(1)}</div></Card>
              <Card className="p-4"><div className="text-sm text-muted">Est. Cost</div><div className="text-2xl font-bold">{formatCurrency(estimatedCost)}</div></Card>
            </div>
          </div>
        );

      case "estimate":
        return (
          <div className="grid gap-6">
            <Card className="p-6">
              <h3 className="mb-4 font-semibold">Carpentry Parameters</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <Select label="Project Type" value={input.projectType} onChange={(e) => setInput({...input, projectType: e.target.value as any})}>
                  <option value="cabinet">Cabinet</option>
                  <option value="door">Door</option>
                  <option value="closet">Closet</option>
                  <option value="shelf">Shelf</option>
                  <option value="trim">Trim</option>
                  <option value="table">Table</option>
                  <option value="repair">Repair</option>
                  <option value="custom">Custom</option>
                </Select>
                <Select label="Material" value={input.material} onChange={(e) => setInput({...input, material: e.target.value as any})}>
                  <option value="pine">Pine</option>
                  <option value="plywood">Plywood</option>
                  <option value="mdf">MDF</option>
                  <option value="oak">Oak</option>
                  <option value="treated">Treated</option>
                </Select>
                <Input label="Length (in)" type="number" value={input.lengthIn} onChange={(e) => setInput({...input, lengthIn: Number(e.target.value)})} />
                <Input label="Width (in)" type="number" value={input.widthIn} onChange={(e) => setInput({...input, widthIn: Number(e.target.value)})} />
                <Input label="Quantity" type="number" value={input.quantity} onChange={(e) => setInput({...input, quantity: Number(e.target.value)})} />
                <Select label="Finish" value={input.finishType} onChange={(e) => setInput({...input, finishType: e.target.value as any})}>
                  <option value="none">None</option>
                  <option value="paint">Paint</option>
                  <option value="stain">Stain</option>
                  <option value="polyurethane">Polyurethane</option>
                </Select>
              </div>
              <Button className="mt-4 w-full" onClick={calculate} disabled={loading}>{loading ? "Calculating..." : "Calculate"}</Button>
            </Card>
            {result && <ToolResultPanel result={result} />}
            {error && <div className="rounded bg-red-500/10 p-4 text-red-500">{error}</div>}
          </div>
        );

      case "scope":
        return <Card className="p-6"><h3 className="mb-4 font-semibold">Project Scope</h3><p className="text-sm text-muted">Fabrication, installation, finishing details...</p></Card>;

      case "materials":
        return <Card className="p-6"><h3 className="mb-4 font-semibold">Materials Takeoff</h3><p className="text-sm text-muted">{totalBoardFeet.toFixed(1)} board feet of {input.material}</p></Card>;

      case "summary":
        return <Card className="p-6"><h3 className="mb-4 font-semibold">Carpentry Summary</h3><p className="text-sm text-muted">Est: {formatCurrency(estimatedCost)} • {totalBoardFeet.toFixed(1)} BF</p></Card>;

      case "milestones":
        return <Card className="p-6"><h3 className="mb-4 font-semibold">Project Milestones</h3><p className="text-sm text-muted">Design, fabrication, installation, finishing...</p></Card>;

      case "inspection":
        return <Card className="p-6"><h3 className="mb-4 font-semibold">Quality Checklist</h3><p className="text-sm text-muted">Fit, alignment, finish, hardware, durability...</p></Card>;

      case "research":
        return <Card className="p-6"><h3 className="mb-4 font-semibold">Carpentry Research</h3><Input placeholder="Search carpentry techniques, finishes..." /></Card>;

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
          <div className="flex items-center gap-3"><Hammer className="h-8 w-8" /><h1 className="text-3xl font-bold tracking-tight text-ink">Carpentry Tool</h1></div>
          <p className="max-w-3xl text-sm text-muted">Complete carpentry estimation with materials, labor, and finishing options.</p>
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
