"use client";
import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { ArrowLeft, Calculator, CheckCircle2, ClipboardCheck, ClipboardList, Globe2, LayoutDashboard, Package, ReceiptText, ShieldCheck, Layers } from "lucide-react";
import { Badge, Button, Card, Input, Select } from "@/components/ui";
import { calculateSemseTool, type SemseToolResult, type ToolMode } from "@/app/lib/semse-tools-api";
import { ToolResultPanel } from "../ToolResultPanel";

export type TileSection = "dashboard" | "estimate" | "scope" | "materials" | "summary" | "milestones" | "inspection" | "research";

type TileInput = {
  squareFeet: number;
  material: "ceramic" | "porcelain" | "natural_stone" | "glass" | "specialty";
  size: "12x12" | "18x18" | "24x24" | "mixed";
  finish: "matte" | "glossy" | "textured" | "custom";
  grout: "standard" | "epoxy" | "specialty";
  substrate: "existing" | "new_installation" | "removal";
  pattern: "straight" | "diagonal" | "herringbone" | "custom";
  mode: ToolMode;
};

const INITIAL_INPUT: TileInput = {
  squareFeet: 200,
  material: "ceramic",
  size: "12x12",
  finish: "matte",
  grout: "standard",
  substrate: "new_installation",
  pattern: "straight",
  mode: "professional",
};

const SECTIONS: Array<{ id: TileSection; label: string; href: string; icon: LucideIcon }> = [
  { id: "dashboard", label: "Dashboard", href: "/tools/tile/dashboard", icon: LayoutDashboard },
  { id: "estimate", label: "Estimacion", href: "/tools/tile/estimate", icon: Calculator },
  { id: "scope", label: "Alcance", href: "/tools/tile/scope", icon: ClipboardList },
  { id: "materials", label: "Materiales", href: "/tools/tile/materials", icon: Package },
  { id: "summary", label: "Resumen", href: "/tools/tile/summary", icon: ReceiptText },
  { id: "milestones", label: "Milestones", href: "/tools/tile/milestones", icon: ShieldCheck },
  { id: "inspection", label: "Inspeccion", href: "/tools/tile/inspection", icon: ClipboardCheck },
  { id: "research", label: "Research", href: "/tools/tile/research", icon: Globe2 },
];

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
}

type TileToolClientProps = { section: TileSection };

export function TileToolClient({ section }: TileToolClientProps) {
  const [input, setInput] = useState<TileInput>(INITIAL_INPUT);
  const [result, setResult] = useState<SemseToolResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const costPerSqft = useMemo(() => {
    const materialCost: Record<typeof input.material, number> = {
      ceramic: 3.5, porcelain: 6.0, natural_stone: 12.0, glass: 8.0, specialty: 15.0,
    };
    const base = materialCost[input.material];
    const finishFactor = { matte: 1.0, glossy: 1.1, textured: 1.2, custom: 1.5 }[input.finish];
    const groutFactor = { standard: 1.0, epoxy: 1.3, specialty: 1.5 }[input.grout];
    const subFactor = { existing: 1.2, new_installation: 1.0, removal: 1.4 }[input.substrate];
    const patternFactor = { straight: 1.0, diagonal: 1.1, herringbone: 1.3, custom: 1.6 }[input.pattern];
    return base * finishFactor * groutFactor * subFactor * patternFactor;
  }, [input.material, input.finish, input.grout, input.substrate, input.pattern]);

  const estimatedCost = useMemo(() => input.squareFeet * costPerSqft * 1.12, [input.squareFeet, costPerSqft]);

  async function calculate() {
    setLoading(true);
    setError(null);
    try {
      const response = await calculateSemseTool({ tool: "tile", mode: input.mode, input });
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
              <Card className="p-4"><div className="text-sm text-muted">Area</div><div className="text-2xl font-bold">{input.squareFeet} sqft</div></Card>
              <Card className="p-4"><div className="text-sm text-muted">Material</div><div className="text-lg font-bold">{input.material}</div></Card>
              <Card className="p-4"><div className="text-sm text-muted">Est. Cost</div><div className="text-2xl font-bold">{formatCurrency(estimatedCost)}</div></Card>
            </div>
          </div>
        );
      case "estimate":
        return (
          <div className="grid gap-6">
            <Card className="p-6">
              <h3 className="mb-4 font-semibold">Tile Parameters</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <Input label="Square Feet" type="number" value={input.squareFeet} onChange={(e) => setInput({...input, squareFeet: Number(e.target.value)})} />
                <Select label="Material" value={input.material} onChange={(e) => setInput({...input, material: e.target.value as any})}>
                  <option value="ceramic">Ceramic</option>
                  <option value="porcelain">Porcelain</option>
                  <option value="natural_stone">Natural Stone</option>
                  <option value="glass">Glass</option>
                  <option value="specialty">Specialty</option>
                </Select>
                <Select label="Size" value={input.size} onChange={(e) => setInput({...input, size: e.target.value as any})}>
                  <option value="12x12">12x12</option>
                  <option value="18x18">18x18</option>
                  <option value="24x24">24x24</option>
                  <option value="mixed">Mixed</option>
                </Select>
                <Select label="Pattern" value={input.pattern} onChange={(e) => setInput({...input, pattern: e.target.value as any})}>
                  <option value="straight">Straight</option>
                  <option value="diagonal">Diagonal</option>
                  <option value="herringbone">Herringbone</option>
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
        return <Card className="p-6"><h3 className="mb-4 font-semibold">Project Scope</h3><p className="text-sm text-muted">Area: {input.squareFeet} sqft • Material: {input.material} • Size: {input.size}</p></Card>;
      case "materials":
        return <Card className="p-6"><h3 className="mb-4 font-semibold">Materials Takeoff</h3><p className="text-sm text-muted">Tiles: {input.squareFeet} sqft • Grout: {input.grout} • Cost/sqft: {formatCurrency(costPerSqft)}</p></Card>;
      case "summary":
        return <Card className="p-6"><h3 className="mb-4 font-semibold">Tile Summary</h3><p className="text-sm text-muted">Est: {formatCurrency(estimatedCost)} • {input.squareFeet} sqft • {input.material}</p></Card>;
      case "milestones":
        return <Card className="p-6"><h3 className="mb-4 font-semibold">Project Milestones</h3><p className="text-sm text-muted">Substrate prep, waterproofing, layout, tile installation, grouting, sealing...</p></Card>;
      case "inspection":
        return <Card className="p-6"><h3 className="mb-4 font-semibold">Quality Checklist</h3><p className="text-sm text-muted">Straight lines, grout uniformity, no cracks, proper spacing, seal application...</p></Card>;
      case "research":
        return <Card className="p-6"><h3 className="mb-4 font-semibold">Tile Research</h3><Input placeholder="Search tile types, grout selection, waterproofing, design trends..." /></Card>;
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
          <div className="flex items-center gap-3"><Layers className="h-8 w-8" /><h1 className="text-3xl font-bold tracking-tight text-ink">Tile Tool</h1></div>
          <p className="max-w-3xl text-sm text-muted">Complete tile estimation with materials, labor, and design options.</p>
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
