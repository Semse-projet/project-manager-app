"use client";
import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { ArrowLeft, Calculator, ClipboardCheck, ClipboardList, Globe2, LayoutDashboard, Package, ReceiptText, ShieldCheck, Truck } from "lucide-react";
import { Badge, Button, Card, Input, Select } from "@/components/ui";
import { calculateSemseTool, type SemseToolResult, type ToolMode } from "@/app/lib/semse-tools-api";
import { ToolResultPanel } from "../ToolResultPanel";

export type EquipmentRentalSection = "dashboard" | "estimate" | "scope" | "materials" | "summary" | "milestones" | "inspection" | "research";
type EquipmentRentalInput = { days: number; equipmentType: "excavator" | "crane" | "scaffolding" | "compressor" | "lift"; quantity: number; delivery: boolean; mode: ToolMode };

const INITIAL_INPUT: EquipmentRentalInput = { days: 10, equipmentType: "scaffolding", quantity: 1, delivery: true, mode: "professional" };
const SECTIONS: Array<{ id: EquipmentRentalSection; label: string; href: string; icon: LucideIcon }> = [
  { id: "dashboard", label: "Dashboard", href: "/tools/equipment-rental/dashboard", icon: LayoutDashboard },
  { id: "estimate", label: "Estimacion", href: "/tools/equipment-rental/estimate", icon: Calculator },
  { id: "scope", label: "Alcance", href: "/tools/equipment-rental/scope", icon: ClipboardList },
  { id: "materials", label: "Materiales", href: "/tools/equipment-rental/materials", icon: Package },
  { id: "summary", label: "Resumen", href: "/tools/equipment-rental/summary", icon: ReceiptText },
  { id: "milestones", label: "Milestones", href: "/tools/equipment-rental/milestones", icon: ShieldCheck },
  { id: "inspection", label: "Inspeccion", href: "/tools/equipment-rental/inspection", icon: ClipboardCheck },
  { id: "research", label: "Research", href: "/tools/equipment-rental/research", icon: Globe2 },
];

function formatCurrency(v: number) { return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(v); }

export function EquipmentRentalToolClient({ section }: { section: EquipmentRentalSection }) {
  const [input, setInput] = useState<EquipmentRentalInput>(INITIAL_INPUT);
  const [result, setResult] = useState<SemseToolResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const costPerDay = useMemo(() => {
    const equipCost: Record<typeof input.equipmentType, number> = { excavator: 500, crane: 800, scaffolding: 200, compressor: 150, lift: 400 };
    return equipCost[input.equipmentType];
  }, [input.equipmentType]);

  const estimatedCost = useMemo(() => {
    const rentalCost = input.days * costPerDay * input.quantity;
    const deliveryCost = input.delivery ? (input.quantity * 200) : 0;
    return rentalCost + deliveryCost;
  }, [input.days, costPerDay, input.quantity, input.delivery]);

  async function calculate() {
    setLoading(true);
    try {
      const response = await calculateSemseTool({ tool: "equipment-rental", mode: input.mode, input });
      setResult(response);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  function renderSection(): ReactNode {
    switch (section) {
      case "dashboard": return <div className="grid gap-6"><div className="grid gap-4 sm:grid-cols-3"><Card className="p-4"><div className="text-sm text-muted">Days</div><div className="text-2xl font-bold">{input.days}</div></Card><Card className="p-4"><div className="text-sm text-muted">Equipment</div><div className="text-lg font-bold">{input.equipmentType}</div></Card><Card className="p-4"><div className="text-sm text-muted">Est. Cost</div><div className="text-2xl font-bold">{formatCurrency(estimatedCost)}</div></Card></div></div>;
      case "estimate": return <div className="grid gap-6"><Card className="p-6"><h3 className="mb-4 font-semibold">Equipment Rental Parameters</h3><div className="grid gap-4 sm:grid-cols-2"><Input label="Days" type="number" value={input.days} onChange={(e) => setInput({...input, days: Number(e.target.value)})} /><Input label="Quantity" type="number" value={input.quantity} onChange={(e) => setInput({...input, quantity: Number(e.target.value)})} /><Select label="Equipment Type" value={input.equipmentType} onChange={(e) => setInput({...input, equipmentType: e.target.value as any})}><option value="excavator">Excavator</option><option value="crane">Crane</option><option value="scaffolding">Scaffolding</option><option value="compressor">Air Compressor</option><option value="lift">Aerial Lift</option></Select></div><div className="mt-4 flex items-center gap-2"><input type="checkbox" checked={input.delivery} onChange={(e) => setInput({...input, delivery: e.target.checked})} /><label>Include delivery & pickup</label></div><Button className="mt-4 w-full" onClick={calculate} disabled={loading}>{loading ? "Calculating..." : "Calculate"}</Button></Card>{result && <ToolResultPanel result={result} />}{error && <div className="rounded bg-red-500/10 p-4 text-red-500">{error}</div>}</div>;
      case "scope": return <Card className="p-6"><h3 className="mb-4 font-semibold">Rental Scope</h3><p className="text-sm text-muted">Equipment: {input.equipmentType} • Quantity: {input.quantity} • Days: {input.days} • Delivery: {input.delivery ? "Yes" : "No"}</p></Card>;
      case "materials": return <Card className="p-6"><h3 className="mb-4 font-semibold">Equipment Details</h3><p className="text-sm text-muted">Equipment: {input.equipmentType} • Cost/day: {formatCurrency(costPerDay)} • Insurance & maintenance included</p></Card>;
      case "summary": return <Card className="p-6"><h3 className="mb-4 font-semibold">Equipment Rental Summary</h3><p className="text-sm text-muted">Est: {formatCurrency(estimatedCost)} • {input.days} days • {input.quantity} units</p></Card>;
      case "milestones": return <Card className="p-6"><h3 className="mb-4 font-semibold">Project Milestones</h3><p className="text-sm text-muted">Reservation confirmation, delivery scheduling, on-site setup, operational support, dismantling, return</p></Card>;
      case "inspection": return <Card className="p-6"><h3 className="mb-4 font-semibold">Quality Checklist</h3><p className="text-sm text-muted">Equipment condition, safety inspection, operator certification, maintenance log, damage assessment, return condition</p></Card>;
      case "research": return <Card className="p-6"><h3 className="mb-4 font-semibold">Equipment Rental Research</h3><Input placeholder="Search equipment rental rates, insurance, safety requirements..." /></Card>;
      default: return null;
    }
  }

  return <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6"><div className="grid gap-6"><div className="flex items-center justify-between gap-3"><Link href="/tools" className="inline-flex items-center gap-2 text-sm text-muted hover:text-ink"><ArrowLeft size={16} /> Back to tools hub</Link><Badge variant="brand">SEMSE Pro Tools</Badge></div><section className="grid gap-3"><div className="flex items-center gap-3"><Truck className="h-8 w-8" /><h1 className="text-3xl font-bold tracking-tight text-ink">Equipment Rental Tool</h1></div><p className="max-w-3xl text-sm text-muted">Heavy equipment rental: excavators, cranes, scaffolding, compressors, aerial lifts.</p></section><div className="flex gap-2 overflow-x-auto pb-2">{SECTIONS.map((s) => {const Icon = s.icon; const isActive = section === s.id; return <Link key={s.id} href={s.href} className={`inline-flex items-center gap-2 rounded px-3 py-2 text-sm font-medium transition ${isActive ? "bg-blue-600 text-white" : "bg-slate-800 text-muted hover:bg-slate-700"}`}><Icon size={16} /> {s.label}</Link>;})}</div><div className="grid gap-6">{renderSection()}</div></div></main>;
}
