"use client";

import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  BarChart3,
  BatteryCharging,
  Cable,
  Calculator,
  CheckCircle2,
  CheckSquare,
  CircuitBoard,
  ClipboardCheck,
  ClipboardList,
  DollarSign,
  ExternalLink,
  FileCheck2,
  FileText,
  FolderPlus,
  Gauge,
  Globe2,
  HardHat,
  LayoutDashboard,
  Lightbulb,
  ListChecks,
  Package,
  PlugZap,
  Plus,
  ReceiptText,
  Search,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  Upload,
  UserPlus,
  Wrench,
  Zap,
} from "lucide-react";
import { Badge, Button, Card, Input, Select, Textarea } from "@/components/ui";
import {
  calculateSemseTool,
  researchElectricalTool,
  type ElectricalResearchCategory,
  type ElectricalResearchResponse,
  type SemseToolResult,
  type ToolMode,
} from "@/app/lib/semse-tools-api";
import { ToolResultPanel } from "../ToolResultPanel";

export type ElectricalSection =
  | "dashboard"
  | "estimate"
  | "scope"
  | "materials"
  | "summary"
  | "milestones"
  | "inspection"
  | "load-analysis"
  | "research";

type CalculatorTab = "wiring" | "panel" | "breakers" | "outlets" | "lighting" | "labor" | "materials";
type PaymentReadiness = "not_ready" | "ready_to_release" | "released" | "held";
type CircuitStatus = "within_range" | "review" | "near_limit" | "overloaded" | "incomplete";

type ElectricalInput = {
  watts: number;
  voltage: 120 | 208 | 220 | 240 | 277 | 480;
  powerFactor: number;
  phase: 1 | 3;
  isContinuous: boolean;
  runFeet: number;
  numCircuits: number;
  panelUpgrade: boolean;
  outdoorWork: boolean;
  mode: ToolMode;
};

type ElectricalMaterialLine = {
  id: string;
  name: string;
  quantity: number;
  unit: "ft" | "ea" | "box" | "roll" | "hr" | "allowance";
  unitCost: number;
  source: "algorithm" | "manual" | "catalog";
  status: "estimated" | "confirmed" | "needs_review";
};

type ElectricalMilestone = {
  id: string;
  name: string;
  status: "pending" | "in_progress" | "completed" | "approved" | "changes_requested" | "rejected" | "ready_to_pay" | "paid";
  date: string;
  progress: number;
  amount: number;
  evidenceRequired: string[];
  paymentReadiness: PaymentReadiness;
};

type RoughInItem = {
  id: string;
  task: string;
  status: "pending" | "in_progress" | "completed" | "failed" | "not_applicable";
  photoRequired: boolean;
  responsible: string;
  date: string;
  note: string;
};

type CircuitRow = {
  id: string;
  circuitNumber: number;
  breakerAmps: number;
  loadAmps: number;
};

type ScopeState = {
  projectName: string;
  clientName: string;
  address: string;
  description: string;
  projectType: "residential" | "commercial" | "industrial";
  areaSqFt: number;
  finishLevel: "basic" | "standard" | "premium" | "strict_code";
  existingCondition: "new_construction" | "remodel" | "repair" | "troubleshooting" | "upgrade" | "emergency";
  access: "open" | "limited" | "occupied" | "after_hours";
  permitsRequired: boolean;
  tentativeDate: string;
  internalNotes: string;
};

type WiringState = {
  cableType: "THHN" | "Romex / NM-B" | "MC Cable" | "SER Cable" | "UF-B" | "Low Voltage";
  awg: "14" | "12" | "10" | "8" | "6" | "4" | "2" | "1/0" | "2/0";
  lengthFt: number;
  conductorCount: number;
  installType: "open_wall" | "finished_wall" | "attic" | "crawlspace" | "underground" | "emt_conduit" | "pvc_conduit" | "commercial_exposed";
  adjustmentFactor: 1 | 1.1 | 1.25 | 1.5;
};

type LaborState = {
  professionalType: "helper" | "journeyman" | "master" | "crew";
  hourlyRate: number;
  estimatedHours: number;
  difficulty: "low" | "medium" | "high" | "very_high";
  occupiedHome: boolean;
  afterHours: boolean;
  tightAccess: boolean;
  oldWiring: boolean;
  unknownCondition: boolean;
};

const INITIAL_ENGINE_INPUT: ElectricalInput = {
  watts: 2400,
  voltage: 120,
  powerFactor: 0.9,
  phase: 1,
  isContinuous: false,
  runFeet: 75,
  numCircuits: 1,
  panelUpgrade: false,
  outdoorWork: false,
  mode: "professional",
};

const ELECTRICAL_VOLTAGES: ElectricalInput["voltage"][] = [120, 208, 220, 240, 277, 480];

const INITIAL_SCOPE: ScopeState = {
  projectName: "Kitchen rewire - Martinez",
  clientName: "Ana Martinez",
  address: "1840 W Madison St, Chicago, IL",
  description: "Dedicated circuits, outlet replacements, rough-in photos and labeled panel closeout.",
  projectType: "residential",
  areaSqFt: 820,
  finishLevel: "standard",
  existingCondition: "remodel",
  access: "occupied",
  permitsRequired: true,
  tentativeDate: "2026-06-08",
  internalNotes: "Confirm panel directory before rough-in inspection.",
};

const INITIAL_WIRING: WiringState = {
  cableType: "THHN",
  awg: "12",
  lengthFt: 250,
  conductorCount: 3,
  installType: "emt_conduit",
  adjustmentFactor: 1.25,
};

const INITIAL_LABOR: LaborState = {
  professionalType: "journeyman",
  hourlyRate: 82,
  estimatedHours: 18,
  difficulty: "medium",
  occupiedHome: true,
  afterHours: false,
  tightAccess: true,
  oldWiring: false,
  unknownCondition: false,
};

const SECTIONS: Array<{ id: ElectricalSection; label: string; href: string; icon: LucideIcon }> = [
  { id: "dashboard", label: "Dashboard", href: "/tools/electrical/dashboard", icon: LayoutDashboard },
  { id: "estimate", label: "Estimacion", href: "/tools/electrical/estimate", icon: Calculator },
  { id: "scope", label: "Alcance", href: "/tools/electrical/scope", icon: ClipboardList },
  { id: "materials", label: "Materiales", href: "/tools/electrical/materials", icon: Package },
  { id: "summary", label: "Resumen", href: "/tools/electrical/summary", icon: ReceiptText },
  { id: "milestones", label: "Milestones", href: "/tools/electrical/milestones", icon: ShieldCheck },
  { id: "inspection", label: "Rough-In", href: "/tools/electrical/inspection", icon: ClipboardCheck },
  { id: "load-analysis", label: "Carga", href: "/tools/electrical/load-analysis", icon: Gauge },
  { id: "research", label: "Research", href: "/tools/electrical/research", icon: Globe2 },
];

const CALCULATOR_TABS: Array<{ id: CalculatorTab; label: string; icon: LucideIcon }> = [
  { id: "wiring", label: "Cableado", icon: Cable },
  { id: "panel", label: "Panel", icon: CircuitBoard },
  { id: "breakers", label: "Breakers", icon: Zap },
  { id: "outlets", label: "Outlets", icon: PlugZap },
  { id: "lighting", label: "Lighting", icon: Lightbulb },
  { id: "labor", label: "Labor", icon: HardHat },
  { id: "materials", label: "Materials", icon: Package },
];

const WIRE_UNIT_COST: Record<WiringState["awg"], number> = {
  "14": 0.65,
  "12": 0.85,
  "10": 1.18,
  "8": 1.95,
  "6": 2.85,
  "4": 4.15,
  "2": 6.2,
  "1/0": 9.75,
  "2/0": 12.4,
};

const INSTALL_LABOR_MULTIPLIER: Record<WiringState["installType"], number> = {
  open_wall: 1,
  finished_wall: 1.2,
  attic: 1.15,
  crawlspace: 1.15,
  underground: 1.35,
  emt_conduit: 1.25,
  pvc_conduit: 1.18,
  commercial_exposed: 1.22,
};

const DIFFICULTY_MULTIPLIER: Record<LaborState["difficulty"], number> = {
  low: 1,
  medium: 1.15,
  high: 1.35,
  very_high: 1.6,
};

const INITIAL_MATERIALS: ElectricalMaterialLine[] = [
  { id: "mat-wire-12", name: "Cable THHN 12 AWG", quantity: 250, unit: "ft", unitCost: 0.85, source: "algorithm", status: "estimated" },
  { id: "mat-wire-14", name: "Cable THHN 14 AWG", quantity: 300, unit: "ft", unitCost: 0.65, source: "catalog", status: "confirmed" },
  { id: "mat-panel", name: "Panel 200A", quantity: 1, unit: "ea", unitCost: 320, source: "catalog", status: "needs_review" },
  { id: "mat-breaker-20", name: "Breaker 20A 1P", quantity: 12, unit: "ea", unitCost: 6.5, source: "catalog", status: "estimated" },
  { id: "mat-outlet", name: "Outlet duplex 20A", quantity: 20, unit: "ea", unitCost: 2.1, source: "catalog", status: "estimated" },
  { id: "mat-box", name: "Caja octagonal", quantity: 15, unit: "ea", unitCost: 1.25, source: "catalog", status: "estimated" },
  { id: "mat-emt", name: "Tuberia EMT 3/4 in", quantity: 150, unit: "ft", unitCost: 1.45, source: "catalog", status: "estimated" },
];

const INITIAL_MILESTONES: ElectricalMilestone[] = [
  {
    id: "m1",
    name: "Inicio del Proyecto",
    status: "approved",
    date: "2026-06-08",
    progress: 100,
    amount: 540,
    evidenceRequired: ["Fotos antes", "Foto del panel", "Permiso"],
    paymentReadiness: "released",
  },
  {
    id: "m2",
    name: "Rough-In Electrico",
    status: "in_progress",
    date: "2026-06-10",
    progress: 62,
    amount: 720,
    evidenceRequired: ["Foto de rough-in", "Foto del circuito etiquetado"],
    paymentReadiness: "not_ready",
  },
  {
    id: "m3",
    name: "Inspeccion Rough-In",
    status: "pending",
    date: "2026-06-11",
    progress: 0,
    amount: 360,
    evidenceRequired: ["Resultado de inspeccion", "Firma del inspector"],
    paymentReadiness: "not_ready",
  },
  {
    id: "m4",
    name: "Instalacion Final",
    status: "pending",
    date: "2026-06-13",
    progress: 0,
    amount: 540,
    evidenceRequired: ["Fotos despues", "Recibo de materiales"],
    paymentReadiness: "not_ready",
  },
  {
    id: "m5",
    name: "Inspeccion Final",
    status: "pending",
    date: "2026-06-14",
    progress: 0,
    amount: 270,
    evidenceRequired: ["Resultado de inspeccion final"],
    paymentReadiness: "not_ready",
  },
  {
    id: "m6",
    name: "Cierre y Entrega",
    status: "pending",
    date: "2026-06-15",
    progress: 0,
    amount: 270,
    evidenceRequired: ["Firma del cliente", "Panel etiquetado"],
    paymentReadiness: "not_ready",
  },
];

const INITIAL_ROUGH_IN: RoughInItem[] = [
  { id: "ri-1", task: "Verificar canalizaciones", status: "completed", photoRequired: true, responsible: "J. Rivera", date: "2026-06-10", note: "EMT alineado y soportado." },
  { id: "ri-2", task: "Revisar cajas y soportes", status: "completed", photoRequired: true, responsible: "J. Rivera", date: "2026-06-10", note: "Cajas firmes en cocina." },
  { id: "ri-3", task: "Verificar cableado", status: "in_progress", photoRequired: true, responsible: "M. Cruz", date: "2026-06-10", note: "Pendiente circuito dedicado." },
  { id: "ri-4", task: "Revisar conexiones y empalmes", status: "pending", photoRequired: true, responsible: "M. Cruz", date: "2026-06-10", note: "" },
  { id: "ri-5", task: "Confirmar grounding", status: "completed", photoRequired: true, responsible: "J. Rivera", date: "2026-06-10", note: "Grounding conductor visible." },
  { id: "ri-6", task: "Confirmar stapling/support spacing", status: "in_progress", photoRequired: false, responsible: "M. Cruz", date: "2026-06-10", note: "" },
  { id: "ri-7", task: "Separacion low voltage/high voltage", status: "completed", photoRequired: false, responsible: "J. Rivera", date: "2026-06-10", note: "" },
  { id: "ri-8", task: "Proteccion en penetraciones", status: "pending", photoRequired: true, responsible: "M. Cruz", date: "2026-06-10", note: "" },
  { id: "ri-9", task: "Confirmar circuitos dedicados", status: "pending", photoRequired: true, responsible: "J. Rivera", date: "2026-06-10", note: "" },
  { id: "ri-10", task: "Etiquetado temporal", status: "pending", photoRequired: true, responsible: "M. Cruz", date: "2026-06-10", note: "" },
];

const INITIAL_CIRCUITS: CircuitRow[] = [
  { id: "c1", circuitNumber: 1, breakerAmps: 20, loadAmps: 12.4 },
  { id: "c2", circuitNumber: 2, breakerAmps: 20, loadAmps: 9.8 },
  { id: "c3", circuitNumber: 3, breakerAmps: 15, loadAmps: 7.2 },
  { id: "c4", circuitNumber: 4, breakerAmps: 20, loadAmps: 14.1 },
  { id: "c5", circuitNumber: 5, breakerAmps: 20, loadAmps: 11.6 },
  { id: "c6", circuitNumber: 6, breakerAmps: 15, loadAmps: 6.3 },
  { id: "c7", circuitNumber: 7, breakerAmps: 30, loadAmps: 20.2 },
  { id: "c8", circuitNumber: 8, breakerAmps: 30, loadAmps: 18.7 },
];

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function materialLineTotal(line: ElectricalMaterialLine) {
  return Math.round(line.quantity * line.unitCost * 100) / 100;
}

function calculateWireCost(wiring: WiringState) {
  return wiring.lengthFt * WIRE_UNIT_COST[wiring.awg] * wiring.conductorCount * wiring.adjustmentFactor;
}

function calculateWiringLabor(wiring: WiringState, labor: LaborState) {
  const baseHours = Math.max(1, wiring.lengthFt / 55) * INSTALL_LABOR_MULTIPLIER[wiring.installType];
  return baseHours * labor.hourlyRate * DIFFICULTY_MULTIPLIER[labor.difficulty];
}

function calculateLaborCost(labor: LaborState) {
  let multiplier = DIFFICULTY_MULTIPLIER[labor.difficulty];
  if (labor.occupiedHome) multiplier += 0.08;
  if (labor.afterHours) multiplier += 0.25;
  if (labor.tightAccess) multiplier += 0.15;
  if (labor.oldWiring) multiplier += 0.2;
  if (labor.unknownCondition) multiplier += 0.12;
  return labor.estimatedHours * labor.hourlyRate * multiplier;
}

function circuitLoadPercent(row: CircuitRow) {
  if (row.breakerAmps <= 0 || row.loadAmps <= 0) return 0;
  return (row.loadAmps / row.breakerAmps) * 100;
}

function circuitStatus(row: CircuitRow): CircuitStatus {
  if (row.breakerAmps <= 0 || row.loadAmps <= 0) return "incomplete";
  const percent = circuitLoadPercent(row);
  if (percent > 100) return "overloaded";
  if (percent > 80) return "near_limit";
  if (percent > 70) return "review";
  return "within_range";
}

function circuitStatusLabel(status: CircuitStatus) {
  const labels: Record<CircuitStatus, string> = {
    within_range: "Dentro de norma",
    review: "Revisar",
    near_limit: "Cerca del limite",
    overloaded: "Sobrecarga",
    incomplete: "Dato incompleto",
  };
  return labels[status];
}

function statusVariant(status: string): "default" | "success" | "info" | "warn" | "error" | "brand" {
  if (["approved", "completed", "ready_to_pay", "paid", "released", "within_range"].includes(status)) return "success";
  if (["in_progress", "review", "ready_to_release"].includes(status)) return "info";
  if (["changes_requested", "near_limit", "needs_review", "not_ready"].includes(status)) return "warn";
  if (["rejected", "failed", "overloaded", "held"].includes(status)) return "error";
  return "default";
}

function titleize(value: string) {
  return value.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function computeRiskScore({
  scope,
  labor,
  circuits,
  roughIn,
}: {
  scope: ScopeState;
  labor: LaborState;
  circuits: CircuitRow[];
  roughIn: RoughInItem[];
}) {
  const panelUsageAbove80 = circuits.some((circuit) => circuitLoadPercent(circuit) > 80);
  const missingPhotos = roughIn.some((item) => item.photoRequired && item.status !== "completed");
  let risk = 14;
  if (labor.oldWiring) risk += 14;
  if (labor.unknownCondition) risk += 10;
  if (scope.permitsRequired) risk += 12;
  if (scope.existingCondition === "remodel") risk += 8;
  if (scope.access === "after_hours") risk += 10;
  if (scope.access === "limited") risk += 8;
  if (panelUsageAbove80) risk += 16;
  if (missingPhotos) risk += 12;
  if (scope.finishLevel === "strict_code") risk += 8;
  return Math.min(100, Math.round(risk));
}

function riskLevel(score: number) {
  if (score > 80) return "Critico";
  if (score > 60) return "Alto";
  if (score > 30) return "Medio";
  return "Bajo";
}

function readinessFor(milestone: ElectricalMilestone, clientApproval: boolean, openDispute: boolean, pendingChangeOrder: boolean) {
  if (openDispute) return "held" satisfies PaymentReadiness;
  if (
    milestone.status === "approved" &&
    milestone.evidenceRequired.length > 0 &&
    clientApproval &&
    !pendingChangeOrder
  ) {
    return "ready_to_release" satisfies PaymentReadiness;
  }
  return "not_ready" satisfies PaymentReadiness;
}

function FieldGroup({ title, icon: Icon, children }: { title: string; icon: LucideIcon; children: ReactNode }) {
  return (
    <section className="grid gap-4 rounded-lg border border-white/[0.08] bg-white/[0.03] p-4">
      <div className="flex items-center gap-2">
        <Icon size={16} className="text-amber-300" />
        <h2 className="text-sm font-semibold text-ink">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function StatTile({
  label,
  value,
  sub,
  icon: Icon,
  tone = "default",
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  icon: LucideIcon;
  tone?: "default" | "amber" | "blue" | "green";
}) {
  const toneClass = {
    default: "border-white/[0.08] bg-[#101827] text-slate-300",
    amber: "border-amber-400/25 bg-amber-400/[0.08] text-amber-200",
    blue: "border-blue-400/25 bg-blue-400/[0.08] text-blue-200",
    green: "border-emerald-400/25 bg-emerald-400/[0.08] text-emerald-200",
  }[tone];

  return (
    <article className={`min-h-[118px] rounded-lg border p-4 ${toneClass}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[0.68rem] font-semibold uppercase tracking-widest text-muted">{label}</p>
          <strong className="mt-2 block text-2xl font-bold leading-none text-ink">{value}</strong>
        </div>
        <div className="rounded-lg border border-white/[0.08] bg-black/20 p-2">
          <Icon size={18} />
        </div>
      </div>
      {sub ? <p className="mt-3 text-xs text-muted">{sub}</p> : null}
    </article>
  );
}

function RowAction({ href, icon: Icon, label }: { href: string; icon: LucideIcon; label: string }) {
  return (
    <Link
      href={href}
      className="flex min-h-[54px] items-center justify-between rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 text-sm font-semibold text-ink transition-all hover:border-amber-300/30 hover:bg-amber-300/[0.06]"
    >
      <span className="inline-flex items-center gap-2">
        <Icon size={16} className="text-amber-300" />
        {label}
      </span>
      <ArrowRight size={14} className="text-muted" />
    </Link>
  );
}

function MiniBarChart({ values }: { values: Array<{ label: string; value: number }> }) {
  const max = Math.max(...values.map((item) => item.value));
  return (
    <div className="grid h-[220px] grid-cols-7 items-end gap-3 rounded-lg border border-white/[0.08] bg-[#0a1020] p-4">
      {values.map((item) => (
        <div key={item.label} className="grid h-full grid-rows-[1fr_auto] gap-2">
          <div className="flex items-end">
            <div
              className="w-full rounded-t bg-gradient-to-t from-amber-500 to-blue-400"
              style={{ height: `${Math.max(10, (item.value / max) * 100)}%` }}
            />
          </div>
          <span className="text-center text-[0.68rem] font-semibold text-muted">{item.label}</span>
        </div>
      ))}
    </div>
  );
}

function ElectricalDashboardPage({ summary }: { summary: ReturnType<typeof useElectricalSummary> }) {
  const revenue = [
    { label: "Nov", value: 12800 },
    { label: "Dic", value: 16400 },
    { label: "Ene", value: 14250 },
    { label: "Feb", value: 18900 },
    { label: "Mar", value: 22100 },
    { label: "Abr", value: 24680 },
    { label: "May", value: 28150 },
  ];

  const recentProjects = [
    ["Remodelacion Residencial - Smith", "$4,860", "Rough-in"],
    ["Oficina Corporativa - Piso 4", "$12,420", "Estimacion"],
    ["Tienda Comercial - Centro", "$8,740", "Inspeccion"],
    ["Panel Upgrade - Johnson", "$3,250", "Pago listo"],
    ["Kitchen Rewire - Martinez", "$2,700", "Evidencia"],
  ];

  const alerts = [
    "3 estimaciones pendientes",
    "2 inspecciones programadas",
    "5 facturas vencidas",
    "1 circuito con carga alta",
    "2 milestones sin evidencia",
  ];

  return (
    <div className="grid gap-6">
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Proyectos Activos" value="12" sub="Electricidad en operacion" icon={Wrench} tone="amber" />
        <StatTile label="Estimaciones" value="8" sub="3 listas para cliente" icon={FileText} tone="blue" />
        <StatTile label="Ingresos" value="$24,680" sub="Estimado mensual" icon={DollarSign} tone="green" />
        <StatTile label="Margen Promedio" value={`${summary.marginPercent}%`} sub={`Riesgo ${riskLevel(summary.riskScore)}`} icon={BarChart3} tone="default" />
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <Card className="grid gap-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-ink">Ingresos ultimos 6 meses</h2>
              <p className="text-sm text-muted">Estimaciones electricas convertidas y listas para BuildOps.</p>
            </div>
            <Badge variant="brand">Electrical</Badge>
          </div>
          <MiniBarChart values={revenue} />
        </Card>

        <div className="grid gap-4">
          <Card className="grid gap-3">
            <h2 className="text-lg font-semibold text-ink">Accesos rapidos</h2>
            <div className="grid gap-2">
              <RowAction href="/tools/electrical/estimate" icon={Calculator} label="Nueva Estimacion" />
              <RowAction href="/buildops/projects/new" icon={FolderPlus} label="Nuevo Proyecto" />
              <RowAction href="/client/professionals" icon={UserPlus} label="Nuevo Cliente" />
              <RowAction href="/tools/electrical/materials" icon={Package} label="Lista de Materiales" />
              <RowAction href="/tools/electrical/load-analysis" icon={Gauge} label="Carga de Circuito" />
              <RowAction href="/tools/electrical/inspection" icon={ClipboardCheck} label="Inspeccion Rough-In" />
              <RowAction href="/tools/electrical/research" icon={Globe2} label="Research Web" />
            </div>
          </Card>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <Card className="grid gap-4">
          <h2 className="text-lg font-semibold text-ink">Proyectos recientes</h2>
          <div className="grid gap-2">
            {recentProjects.map(([name, amount, state]) => (
              <div key={name} className="flex items-center justify-between gap-4 rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-ink">{name}</p>
                  <p className="text-xs text-muted">{state}</p>
                </div>
                <strong className="shrink-0 text-sm text-amber-200">{amount}</strong>
              </div>
            ))}
          </div>
        </Card>

        <Card className="grid gap-4 border-amber-400/20 bg-amber-400/[0.04]">
          <div className="flex items-center gap-2">
            <ShieldAlert size={18} className="text-amber-300" />
            <h2 className="text-lg font-semibold text-ink">Alertas y pendientes</h2>
          </div>
          <div className="grid gap-2">
            {alerts.map((alert, index) => (
              <div key={alert} className="flex items-center justify-between rounded-lg border border-amber-300/15 bg-black/20 px-3 py-3 text-sm text-amber-100">
                <span>{alert}</span>
                <Badge variant={index > 2 ? "warn" : "info"}>{index > 2 ? "review" : "open"}</Badge>
              </div>
            ))}
          </div>
        </Card>
      </section>
    </div>
  );
}

function ElectricalEstimateCalculator({
  engineInput,
  setEngineInput,
  wiring,
  setWiring,
  labor,
  setLabor,
  addMaterialLine,
}: {
  engineInput: ElectricalInput;
  setEngineInput: (input: ElectricalInput) => void;
  wiring: WiringState;
  setWiring: (input: WiringState) => void;
  labor: LaborState;
  setLabor: (input: LaborState) => void;
  addMaterialLine: (line: ElectricalMaterialLine) => void;
}) {
  const [activeTab, setActiveTab] = useState<CalculatorTab>("wiring");
  const [result, setResult] = useState<SemseToolResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const wireCost = calculateWireCost(wiring);
  const wireLabor = calculateWiringLabor(wiring, labor);
  const wireContingency = (wireCost + wireLabor) * 0.1;
  const wireTotal = wireCost + wireLabor + wireContingency;

  async function calculateWithEngine() {
    setLoading(true);
    setError(null);

    try {
      const response = await calculateSemseTool({
        tool: "electrical",
        mode: engineInput.mode,
        input: engineInput,
      });
      setResult(response);
    } catch (exception) {
      setError(exception instanceof Error ? exception.message : "Unknown tools error");
    } finally {
      setLoading(false);
    }
  }

  function addWiringToEstimate() {
    addMaterialLine({
      id: `wire-${Date.now()}`,
      name: `${wiring.cableType} ${wiring.awg} AWG`,
      quantity: wiring.lengthFt * wiring.conductorCount,
      unit: "ft",
      unitCost: WIRE_UNIT_COST[wiring.awg] * wiring.adjustmentFactor,
      source: "algorithm",
      status: "estimated",
    });
  }

  return (
    <div className="grid gap-6">
      <Card className="grid gap-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-ink">Calculadora Electrica</h2>
            <p className="text-sm text-muted">Cableado, panel, breakers, outlets, lighting, labor y materiales.</p>
          </div>
          <Badge variant="brand">AlgorithmRun ready</Badge>
        </div>

        <div className="grid grid-cols-2 gap-2 md:grid-cols-4 xl:grid-cols-7">
          {CALCULATOR_TABS.map((tab) => {
            const Icon = tab.icon;
            const active = tab.id === activeTab;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg border px-3 text-sm font-semibold transition-all ${
                  active
                    ? "border-amber-300/50 bg-amber-300/[0.12] text-amber-100"
                    : "border-white/[0.08] bg-white/[0.03] text-muted hover:bg-white/[0.06]"
                }`}
              >
                <Icon size={15} />
                {tab.label}
              </button>
            );
          })}
        </div>

        {activeTab === "wiring" ? (
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
            <div className="grid gap-4 sm:grid-cols-2">
              <Select
                label="Tipo de cable"
                value={wiring.cableType}
                onChange={(event) => setWiring({ ...wiring, cableType: event.target.value as WiringState["cableType"] })}
              >
                {["THHN", "Romex / NM-B", "MC Cable", "SER Cable", "UF-B", "Low Voltage"].map((option) => (
                  <option key={option}>{option}</option>
                ))}
              </Select>
              <Select
                label="Calibre AWG"
                value={wiring.awg}
                onChange={(event) => setWiring({ ...wiring, awg: event.target.value as WiringState["awg"] })}
              >
                {Object.keys(WIRE_UNIT_COST).map((option) => (
                  <option key={option}>{option}</option>
                ))}
              </Select>
              <Input
                label="Longitud (ft)"
                type="number"
                min={0}
                value={wiring.lengthFt}
                onChange={(event) => setWiring({ ...wiring, lengthFt: Number(event.target.value) })}
              />
              <Input
                label="Conductores"
                type="number"
                min={1}
                value={wiring.conductorCount}
                onChange={(event) => setWiring({ ...wiring, conductorCount: Number(event.target.value) })}
              />
              <Select
                label="Tipo de instalacion"
                value={wiring.installType}
                onChange={(event) => setWiring({ ...wiring, installType: event.target.value as WiringState["installType"] })}
              >
                <option value="open_wall">Open wall</option>
                <option value="finished_wall">Finished wall</option>
                <option value="attic">Attic</option>
                <option value="crawlspace">Crawlspace</option>
                <option value="underground">Underground</option>
                <option value="emt_conduit">Conduit EMT</option>
                <option value="pvc_conduit">PVC conduit</option>
                <option value="commercial_exposed">Commercial exposed</option>
              </Select>
              <Select
                label="Factor de ajuste"
                value={wiring.adjustmentFactor}
                onChange={(event) => setWiring({ ...wiring, adjustmentFactor: Number(event.target.value) as WiringState["adjustmentFactor"] })}
              >
                <option value={1}>100%</option>
                <option value={1.1}>110%</option>
                <option value={1.25}>125%</option>
                <option value={1.5}>150%</option>
              </Select>
            </div>

            <div className="grid gap-3 rounded-lg border border-amber-300/20 bg-amber-300/[0.05] p-4">
              <h3 className="text-sm font-semibold text-amber-100">Resultado</h3>
              {[
                ["Costo de materiales", wireCost],
                ["Mano de obra", wireLabor],
                ["Subtotal", wireCost + wireLabor],
                ["Contingencia", wireContingency],
                ["Total", wireTotal],
              ].map(([label, value]) => (
                <div key={label} className="flex items-center justify-between text-sm">
                  <span className="text-muted">{label}</span>
                  <strong className="text-ink">{formatCurrency(Number(value))}</strong>
                </div>
              ))}
              <Button type="button" onClick={addWiringToEstimate} className="mt-2">
                <Plus size={15} />
                Agregar a Estimacion
              </Button>
            </div>
          </div>
        ) : null}

        {activeTab === "panel" ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <Select label="Tipo de trabajo" defaultValue="panel_upgrade">
              <option value="panel_replacement">Panel replacement</option>
              <option value="panel_upgrade">Panel upgrade</option>
              <option value="subpanel">Subpanel installation</option>
              <option value="service_upgrade">Service upgrade</option>
              <option value="main_breaker">Main breaker replacement</option>
              <option value="meter_main">Meter/main combo</option>
            </Select>
            <Select label="Amperaje" defaultValue="200A">
              <option>100A</option>
              <option>150A</option>
              <option>200A</option>
              <option>320A/400A</option>
            </Select>
            <Select label="Ubicacion" defaultValue="indoor">
              <option value="indoor">Indoor panel</option>
              <option value="outdoor">Outdoor panel</option>
              <option value="subpanel">Subpanel</option>
            </Select>
            <Select label="Fases" defaultValue="single">
              <option value="single">Single phase</option>
              <option value="three">Three phase</option>
            </Select>
            <Select label="Condicion existente" defaultValue="old_panel">
              <option value="easy_access">Easy access</option>
              <option value="limited_access">Limited access</option>
              <option value="old_panel">Old panel</option>
              <option value="unsafe">Unsafe condition</option>
              <option value="permit_required">Permit required</option>
            </Select>
            <div className="rounded-lg border border-white/[0.08] bg-white/[0.03] p-4">
              <p className="text-sm font-semibold text-ink">Costos sugeridos</p>
              <p className="mt-2 text-sm text-muted">Panel, breakers, conduit, wire, grounding, labor, permit allowance e inspection allowance.</p>
            </div>
          </div>
        ) : null}

        {activeTab === "breakers" ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Select label="Tipo de breaker" defaultValue="gfci">
              <option>Standard</option>
              <option>GFCI</option>
              <option>AFCI</option>
              <option>Dual Function</option>
              <option>2-pole</option>
              <option>Tandem</option>
            </Select>
            <Select label="Amperaje" defaultValue="20A">
              <option>15A</option>
              <option>20A</option>
              <option>30A</option>
              <option>40A</option>
              <option>50A</option>
              <option>60A</option>
            </Select>
            <Input label="Cantidad" type="number" defaultValue={8} />
            <Select label="Marca" defaultValue="Square D">
              <option>Square D</option>
              <option>Siemens</option>
              <option>Eaton</option>
              <option>GE</option>
              <option>Unknown</option>
            </Select>
          </div>
        ) : null}

        {activeTab === "outlets" ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Select label="Tipo" defaultValue="GFCI outlet">
              <option>Standard outlet</option>
              <option>GFCI outlet</option>
              <option>Weather resistant outlet</option>
              <option>USB outlet</option>
              <option>Dedicated appliance outlet</option>
              <option>Dryer outlet</option>
              <option>Range outlet</option>
              <option>EV charger outlet</option>
            </Select>
            <Input label="Cantidad" type="number" defaultValue={14} />
            <Select label="Ubicacion" defaultValue="Kitchen">
              <option>Kitchen</option>
              <option>Bathroom</option>
              <option>Exterior</option>
              <option>Garage</option>
              <option>Basement</option>
              <option>Living area</option>
              <option>Commercial area</option>
            </Select>
            <Select label="Condicion" defaultValue="Add circuit">
              <option>New install</option>
              <option>Replacement</option>
              <option>Troubleshooting</option>
              <option>Add circuit</option>
            </Select>
          </div>
        ) : null}

        {activeTab === "lighting" ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            <Select label="Tipo" defaultValue="Recessed lights">
              <option>Recessed lights</option>
              <option>Ceiling fixture</option>
              <option>Pendant light</option>
              <option>Chandelier</option>
              <option>Exterior light</option>
              <option>Motion light</option>
              <option>Emergency light</option>
              <option>Commercial lighting</option>
            </Select>
            <Input label="Cantidad" type="number" defaultValue={12} />
            <Input label="Altura de techo" type="number" defaultValue={9} />
            <Select label="Tipo de techo" defaultValue="Drywall">
              <option>Drywall</option>
              <option>Drop ceiling</option>
              <option>Exposed joist</option>
              <option>Concrete</option>
              <option>Commercial grid</option>
            </Select>
            <Select label="Control" defaultValue="Dimmer">
              <option>Standard switch</option>
              <option>Dimmer</option>
              <option>3-way</option>
              <option>Smart switch</option>
              <option>Occupancy sensor</option>
            </Select>
          </div>
        ) : null}

        {activeTab === "labor" ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Select
              label="Tipo de profesional"
              value={labor.professionalType}
              onChange={(event) => setLabor({ ...labor, professionalType: event.target.value as LaborState["professionalType"] })}
            >
              <option value="helper">Electrician helper</option>
              <option value="journeyman">Journeyman electrician</option>
              <option value="master">Master electrician</option>
              <option value="crew">Crew</option>
            </Select>
            <Input label="Tarifa por hora" type="number" value={labor.hourlyRate} onChange={(event) => setLabor({ ...labor, hourlyRate: Number(event.target.value) })} />
            <Input label="Horas estimadas" type="number" value={labor.estimatedHours} onChange={(event) => setLabor({ ...labor, estimatedHours: Number(event.target.value) })} />
            <Select label="Dificultad" value={labor.difficulty} onChange={(event) => setLabor({ ...labor, difficulty: event.target.value as LaborState["difficulty"] })}>
              <option value="low">Baja</option>
              <option value="medium">Media</option>
              <option value="high">Alta</option>
              <option value="very_high">Riesgo alto</option>
            </Select>
            {[
              ["occupiedHome", "Occupied home"],
              ["afterHours", "Commercial after-hours"],
              ["tightAccess", "Tight access"],
              ["oldWiring", "Old wiring"],
              ["unknownCondition", "Unknown existing condition"],
            ].map(([key, label]) => (
              <label key={key} className="flex min-h-[42px] items-center justify-between rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 text-sm text-ink">
                <span>{label}</span>
                <input
                  type="checkbox"
                  checked={Boolean(labor[key as keyof LaborState])}
                  onChange={(event) => setLabor({ ...labor, [key]: event.target.checked })}
                />
              </label>
            ))}
          </div>
        ) : null}

        {activeTab === "materials" ? (
          <div className="grid gap-3 md:grid-cols-3">
            {["Wire", "Conduit", "Fittings", "Boxes", "Outlets", "Switches", "Breakers", "Panel", "Grounding", "Fasteners", "Labels", "Plates", "Miscellaneous"].map((item) => (
              <div key={item} className="rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-3 text-sm font-medium text-ink">
                {item}
              </div>
            ))}
          </div>
        ) : null}
      </Card>

      <Card className="grid gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-ink">SEMSE Tools API</h2>
            <p className="text-sm text-muted">Carga, breaker, conductor, milestones, evidencia y riesgo desde el engine existente.</p>
          </div>
          <Button type="button" onClick={() => void calculateWithEngine()} loading={loading}>
            <Zap size={15} />
            {loading ? "Calculando" : "Run engine"}
          </Button>
        </div>

        <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
          <Input label="Watts" type="number" value={engineInput.watts} onChange={(event) => setEngineInput({ ...engineInput, watts: Number(event.target.value) })} />
          <Select label="Voltage" value={engineInput.voltage} onChange={(event) => setEngineInput({ ...engineInput, voltage: Number(event.target.value) as ElectricalInput["voltage"] })}>
            {ELECTRICAL_VOLTAGES.map((voltage) => (
              <option key={voltage} value={voltage}>{voltage}V</option>
            ))}
          </Select>
          <Input label="Power factor" type="number" step={0.01} value={engineInput.powerFactor} onChange={(event) => setEngineInput({ ...engineInput, powerFactor: Number(event.target.value) })} />
          <Input label="Run distance" type="number" value={engineInput.runFeet} onChange={(event) => setEngineInput({ ...engineInput, runFeet: Number(event.target.value) })} />
          <Input label="Circuits" type="number" value={engineInput.numCircuits} onChange={(event) => setEngineInput({ ...engineInput, numCircuits: Number(event.target.value) })} />
          <Select label="Phase" value={engineInput.phase} onChange={(event) => setEngineInput({ ...engineInput, phase: Number(event.target.value) as ElectricalInput["phase"] })}>
            <option value={1}>Single</option>
            <option value={3}>Three</option>
          </Select>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          {[
            ["isContinuous", "Continuous load"],
            ["panelUpgrade", "Panel upgrade"],
            ["outdoorWork", "Outdoor work"],
          ].map(([key, label]) => (
            <label key={key} className="flex min-h-[44px] items-center justify-between rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 text-sm text-ink">
              <span>{label}</span>
              <input
                type="checkbox"
                checked={Boolean(engineInput[key as keyof ElectricalInput])}
                onChange={(event) => setEngineInput({ ...engineInput, [key]: event.target.checked })}
              />
            </label>
          ))}
        </div>

        {error ? <div className="rounded-lg border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm text-red-200">{error}</div> : null}
      </Card>

      {result ? <ToolResultPanel result={result} /> : null}
    </div>
  );
}

function ElectricalScopeForm({ scope, setScope }: { scope: ScopeState; setScope: (scope: ScopeState) => void }) {
  return (
    <Card className="grid gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-ink">Alcance del Trabajo</h2>
          <p className="text-sm text-muted">Nombre, cliente, direccion, tipo de proyecto, permisos y notas internas.</p>
        </div>
        <Badge variant="info">Scope draft</Badge>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Input label="Nombre del Proyecto" value={scope.projectName} onChange={(event) => setScope({ ...scope, projectName: event.target.value })} />
        <Input label="Cliente" value={scope.clientName} onChange={(event) => setScope({ ...scope, clientName: event.target.value })} />
        <Input label="Direccion del Proyecto" value={scope.address} onChange={(event) => setScope({ ...scope, address: event.target.value })} className="md:col-span-2" />
        <Textarea label="Descripcion del Trabajo" value={scope.description} onChange={(event) => setScope({ ...scope, description: event.target.value })} className="min-h-[110px] md:col-span-2" />
        <Select label="Tipo de Proyecto" value={scope.projectType} onChange={(event) => setScope({ ...scope, projectType: event.target.value as ScopeState["projectType"] })}>
          <option value="residential">Residencial</option>
          <option value="commercial">Comercial</option>
          <option value="industrial">Industrial</option>
        </Select>
        <Input label="Area Aproximada" type="number" value={scope.areaSqFt} onChange={(event) => setScope({ ...scope, areaSqFt: Number(event.target.value) })} />
        <Select label="Nivel de Acabado" value={scope.finishLevel} onChange={(event) => setScope({ ...scope, finishLevel: event.target.value as ScopeState["finishLevel"] })}>
          <option value="basic">Basico</option>
          <option value="standard">Estandar</option>
          <option value="premium">Premium</option>
          <option value="strict_code">Codigo / inspeccion estricta</option>
        </Select>
        <Select label="Condicion Existente" value={scope.existingCondition} onChange={(event) => setScope({ ...scope, existingCondition: event.target.value as ScopeState["existingCondition"] })}>
          <option value="new_construction">Nueva construccion</option>
          <option value="remodel">Remodelacion</option>
          <option value="repair">Reparacion</option>
          <option value="troubleshooting">Troubleshooting</option>
          <option value="upgrade">Upgrade</option>
          <option value="emergency">Emergencia</option>
        </Select>
        <Select label="Acceso al Area" value={scope.access} onChange={(event) => setScope({ ...scope, access: event.target.value as ScopeState["access"] })}>
          <option value="open">Open access</option>
          <option value="limited">Limited access</option>
          <option value="occupied">Occupied area</option>
          <option value="after_hours">Commercial after-hours</option>
        </Select>
        <Input label="Fecha Tentativa" type="date" value={scope.tentativeDate} onChange={(event) => setScope({ ...scope, tentativeDate: event.target.value })} />
        <label className="flex min-h-[42px] items-center justify-between rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 text-sm text-ink">
          <span>Permisos Requeridos</span>
          <input type="checkbox" checked={scope.permitsRequired} onChange={(event) => setScope({ ...scope, permitsRequired: event.target.checked })} />
        </label>
        <Textarea label="Notas internas" value={scope.internalNotes} onChange={(event) => setScope({ ...scope, internalNotes: event.target.value })} className="min-h-[96px] md:col-span-2" />
      </div>

      <div className="flex flex-wrap gap-2">
        <Button type="button">
          Siguiente
          <ArrowRight size={15} />
        </Button>
        <Button type="button" variant="ghost">
          Guardar borrador
        </Button>
      </div>
    </Card>
  );
}

function ElectricalMaterialsTable({
  materials,
  setMaterials,
  summary,
}: {
  materials: ElectricalMaterialLine[];
  setMaterials: (materials: ElectricalMaterialLine[]) => void;
  summary: ReturnType<typeof useElectricalSummary>;
}) {
  function updateLine(id: string, patch: Partial<ElectricalMaterialLine>) {
    setMaterials(materials.map((line) => (line.id === id ? { ...line, ...patch } : line)));
  }

  function addLine() {
    setMaterials([
      ...materials,
      {
        id: `manual-${Date.now()}`,
        name: "Material manual",
        quantity: 1,
        unit: "ea",
        unitCost: 0,
        source: "manual",
        status: "estimated",
      },
    ]);
  }

  function removeLine(id: string) {
    setMaterials(materials.filter((line) => line.id !== id));
  }

  return (
    <div className="grid gap-6">
      <Card className="grid gap-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-ink">Materiales y Costos</h2>
            <p className="text-sm text-muted">Lista editable de materiales con fuente, estado y total.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={addLine}>
              <Plus size={15} />
              Agregar Material
            </Button>
            <Button type="button" variant="ghost">Exportar</Button>
            <Link href="/tools/electrical/summary" className="inline-flex items-center justify-center rounded-lg border border-white/[0.1] bg-white/[0.04] px-4 py-2 text-sm font-semibold text-ink hover:bg-white/[0.07]">
              Enviar a Resumen
            </Link>
          </div>
        </div>

        <div className="overflow-x-auto rounded-lg border border-white/[0.08]">
          <table className="w-full min-w-[860px] text-sm">
            <thead className="bg-white/[0.03] text-muted">
              <tr>
                <th className="px-3 py-3 text-left font-medium">Material</th>
                <th className="px-3 py-3 text-left font-medium">Cantidad</th>
                <th className="px-3 py-3 text-left font-medium">Unidad</th>
                <th className="px-3 py-3 text-left font-medium">Costo Unitario</th>
                <th className="px-3 py-3 text-left font-medium">Total</th>
                <th className="px-3 py-3 text-left font-medium">Fuente</th>
                <th className="px-3 py-3 text-left font-medium">Estado</th>
                <th className="px-3 py-3 text-right font-medium">Accion</th>
              </tr>
            </thead>
            <tbody>
              {materials.map((line) => (
                <tr key={line.id} className="border-t border-white/[0.06]">
                  <td className="px-3 py-2">
                    <Input value={line.name} onChange={(event) => updateLine(line.id, { name: event.target.value })} />
                  </td>
                  <td className="px-3 py-2">
                    <Input type="number" min={0} value={line.quantity} onChange={(event) => updateLine(line.id, { quantity: Number(event.target.value) })} />
                  </td>
                  <td className="px-3 py-2">
                    <Select value={line.unit} onChange={(event) => updateLine(line.id, { unit: event.target.value as ElectricalMaterialLine["unit"] })}>
                      <option value="ft">ft</option>
                      <option value="ea">ea</option>
                      <option value="box">box</option>
                      <option value="roll">roll</option>
                      <option value="hr">hr</option>
                      <option value="allowance">allowance</option>
                    </Select>
                  </td>
                  <td className="px-3 py-2">
                    <Input type="number" min={0} step={0.01} value={line.unitCost} onChange={(event) => updateLine(line.id, { unitCost: Number(event.target.value) })} />
                  </td>
                  <td className="px-3 py-2 font-semibold text-ink">{formatCurrency(materialLineTotal(line))}</td>
                  <td className="px-3 py-2">
                    <Badge variant="info">{line.source}</Badge>
                  </td>
                  <td className="px-3 py-2">
                    <Badge variant={statusVariant(line.status)}>{line.status}</Badge>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button type="button" onClick={() => removeLine(line.id)} className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-red-500/20 bg-red-500/10 text-red-300">
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatTile label="Subtotal Materiales" value={formatCurrency(summary.materialCost)} icon={Package} tone="amber" />
        <StatTile label="Mano de Obra" value={formatCurrency(summary.laborCost)} icon={HardHat} tone="blue" />
        <StatTile label="Permisos" value={formatCurrency(summary.permitCost)} icon={FileCheck2} />
        <StatTile label="Contingencia" value={formatCurrency(summary.contingencyCost)} icon={ShieldAlert} />
        <StatTile label="Total Estimado" value={formatCurrency(summary.salePrice)} icon={DollarSign} tone="green" />
      </section>
    </div>
  );
}

function ElectricalEstimateSummary({ summary }: { summary: ReturnType<typeof useElectricalSummary> }) {
  const marginDegrees = Math.min(360, Math.max(0, summary.marginPercent * 3.6));
  const riskFactors = [
    "Permiso requerido",
    "Pared terminada o remodelacion",
    "Carga sobre 80%",
    "Fotos faltantes",
    "Inspeccion requerida",
    "Material no confirmado",
  ];

  return (
    <div className="grid gap-6">
      <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <Card className="grid gap-5 border-emerald-400/20 bg-emerald-400/[0.04]">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <Badge variant="success">Resumen de Estimacion</Badge>
              <h2 className="mt-3 text-3xl font-bold tracking-tight text-ink">{formatCurrency(summary.salePrice)}</h2>
              <p className="text-sm text-muted">Precio de venta calculado con materiales, labor, overhead, margen y contingencia.</p>
            </div>
            <div className="text-right">
              <p className="text-xs uppercase tracking-widest text-muted">Risk Score</p>
              <strong className="text-3xl font-bold text-amber-200">{summary.riskScore}</strong>
              <p className="text-xs text-muted">{riskLevel(summary.riskScore)}</p>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatTile label="Costo Directo" value={formatCurrency(summary.directCost)} icon={ReceiptText} />
            <StatTile label="Utilidad" value={formatCurrency(summary.profit)} icon={BarChart3} tone="green" />
            <StatTile label="Contingencia" value={formatCurrency(summary.contingencyCost)} icon={ShieldAlert} tone="amber" />
            <StatTile label="Readiness" value={`${summary.readinessScore}%`} icon={BadgeCheck} tone="blue" />
          </div>
        </Card>

        <Card className="grid place-items-center gap-4">
          <div className="grid h-48 w-48 place-items-center rounded-full" style={{ background: `conic-gradient(#facc15 ${marginDegrees}deg, rgba(255,255,255,0.08) 0deg)` }}>
            <div className="grid h-32 w-32 place-items-center rounded-full border border-white/[0.08] bg-[#0d0d20] text-center">
              <div>
                <strong className="block text-3xl text-ink">{summary.marginPercent}%</strong>
                <span className="text-xs uppercase tracking-widest text-muted">Margen</span>
              </div>
            </div>
          </div>
        </Card>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <Card className="grid gap-3">
          <h2 className="text-lg font-semibold text-ink">Resumen financiero</h2>
          {[
            ["Materiales", summary.materialCost],
            ["Mano de obra", summary.laborCost],
            ["Permisos", summary.permitCost],
            ["Overhead", summary.overheadCost],
            ["Utilidad", summary.profit],
            ["Contingencia", summary.contingencyCost],
            ["Precio de Venta", summary.salePrice],
          ].map(([label, amount]) => (
            <div key={label} className="flex items-center justify-between border-b border-white/[0.06] py-2 text-sm last:border-0">
              <span className="text-muted">{label}</span>
              <strong className="text-ink">{formatCurrency(Number(amount))}</strong>
            </div>
          ))}
        </Card>

        <Card className="grid gap-4 border-amber-400/20 bg-amber-400/[0.04]">
          <div className="flex items-center gap-2">
            <AlertTriangle size={18} className="text-amber-300" />
            <h2 className="text-lg font-semibold text-ink">Factores de riesgo</h2>
          </div>
          <div className="grid gap-2">
            {riskFactors.map((factor, index) => (
              <div key={factor} className="flex items-center justify-between rounded-lg border border-white/[0.08] bg-black/20 px-3 py-2 text-sm text-amber-100">
                <span>{factor}</span>
                <Badge variant={index < 3 ? "warn" : "default"}>{index < 3 ? "active" : "monitor"}</Badge>
              </div>
            ))}
          </div>
        </Card>
      </section>

      <div className="flex flex-wrap gap-2">
        <Button type="button">Enviar Estimacion al Cliente</Button>
        <Button type="button" variant="ghost">Guardar como Borrador</Button>
        <Button type="button" variant="ghost">Convertir a BuildOps</Button>
        <Button type="button" variant="ghost">Generar PDF</Button>
      </div>
    </div>
  );
}

function ElectricalMilestonesPage({
  milestones,
  setMilestones,
}: {
  milestones: ElectricalMilestone[];
  setMilestones: (milestones: ElectricalMilestone[]) => void;
}) {
  const [tab, setTab] = useState<"milestones" | "evidence" | "payments">("milestones");
  const evidenceItems = Array.from(new Set(milestones.flatMap((milestone) => milestone.evidenceRequired)));

  function approveMilestone(id: string) {
    setMilestones(
      milestones.map((milestone) =>
        milestone.id === id
          ? {
              ...milestone,
              status: "approved",
              progress: 100,
              paymentReadiness: readinessFor({ ...milestone, status: "approved" }, true, false, false),
            }
          : milestone
      )
    );
  }

  return (
    <Card className="grid gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-ink">Milestones, Evidencia y Pagos</h2>
          <p className="text-sm text-muted">Intake, estimate, BuildOps, milestones, evidence, approval y payment readiness.</p>
        </div>
        <Badge variant="brand">BuildOps bridge</Badge>
      </div>

      <div className="grid grid-cols-3 gap-2 rounded-lg border border-white/[0.08] bg-white/[0.03] p-1">
        {[
          ["milestones", "Milestones"],
          ["evidence", "Evidencia"],
          ["payments", "Pagos"],
        ].map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id as typeof tab)}
            className={`min-h-[38px] rounded-md text-sm font-semibold ${tab === id ? "bg-amber-300 text-[#0a0a14]" : "text-muted hover:bg-white/[0.06]"}`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "milestones" ? (
        <div className="grid gap-3">
          {milestones.map((milestone) => (
            <div key={milestone.id} className="grid gap-3 rounded-lg border border-white/[0.08] bg-white/[0.03] p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold text-ink">{milestone.name}</h3>
                    <Badge variant={statusVariant(milestone.status)}>{titleize(milestone.status)}</Badge>
                  </div>
                  <p className="mt-1 text-xs text-muted">{milestone.date} · {milestone.progress}% · {formatCurrency(milestone.amount)}</p>
                </div>
                <Badge variant={statusVariant(milestone.paymentReadiness)}>{milestone.paymentReadiness}</Badge>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-white/[0.08]">
                <div className="h-full bg-gradient-to-r from-amber-400 to-emerald-400" style={{ width: `${milestone.progress}%` }} />
              </div>
              <div className="flex flex-wrap gap-2">
                {milestone.evidenceRequired.map((item) => (
                  <Badge key={item} variant="info">{item}</Badge>
                ))}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="button" size="sm" onClick={() => approveMilestone(milestone.id)}>Aprobar milestone</Button>
                <Button type="button" size="sm" variant="ghost">Subir evidencia</Button>
                <Button type="button" size="sm" variant="ghost">Solicitar cambios</Button>
                <Button type="button" size="sm" variant="destructive">Rechazar</Button>
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {tab === "evidence" ? (
        <div className="grid gap-3 md:grid-cols-2">
          {evidenceItems.map((item, index) => (
            <div key={item} className="flex items-center justify-between rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-3">
              <span className="inline-flex items-center gap-2 text-sm text-ink">
                {index < 3 ? <CheckCircle2 size={15} className="text-emerald-300" /> : <Upload size={15} className="text-amber-300" />}
                {item}
              </span>
              <Badge variant={index < 3 ? "success" : "warn"}>{index < 3 ? "approved" : "missing"}</Badge>
            </div>
          ))}
        </div>
      ) : null}

      {tab === "payments" ? (
        <div className="grid gap-4 md:grid-cols-3">
          <StatTile label="Ready to release" value={milestones.filter((m) => m.paymentReadiness === "ready_to_release").length} icon={BadgeCheck} tone="green" />
          <StatTile label="Not ready" value={milestones.filter((m) => m.paymentReadiness === "not_ready").length} icon={ShieldAlert} tone="amber" />
          <StatTile label="Released" value={formatCurrency(milestones.filter((m) => m.paymentReadiness === "released").reduce((sum, m) => sum + m.amount, 0))} icon={DollarSign} tone="blue" />
        </div>
      ) : null}
    </Card>
  );
}

function ElectricalRoughInInspection({
  items,
  setItems,
}: {
  items: RoughInItem[];
  setItems: (items: RoughInItem[]) => void;
}) {
  function updateItem(id: string, patch: Partial<RoughInItem>) {
    setItems(items.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }

  const completed = items.filter((item) => item.status === "completed").length;

  return (
    <div className="grid gap-6">
      <section className="grid gap-4 md:grid-cols-4">
        <StatTile label="Checklist" value={`${completed}/${items.length}`} icon={ListChecks} tone="green" />
        <StatTile label="Fotos requeridas" value={items.filter((item) => item.photoRequired).length} icon={Upload} tone="amber" />
        <StatTile label="Fallos" value={items.filter((item) => item.status === "failed").length} icon={AlertTriangle} />
        <StatTile label="Payment gate" value={completed === items.length ? "Ready" : "Hold"} icon={ShieldCheck} tone={completed === items.length ? "green" : "blue"} />
      </section>

      <Card className="grid gap-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-ink">Inspeccion Rough-In</h2>
            <p className="text-sm text-muted">Checklist previo a cerrar paredes.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="ghost">
              <Upload size={15} />
              Agregar Foto
            </Button>
            <Button type="button">Completar Inspeccion</Button>
            <Button type="button" variant="ghost">Crear Change Order</Button>
          </div>
        </div>

        <div className="grid gap-3">
          {items.map((item) => (
            <div key={item.id} className="grid gap-3 rounded-lg border border-white/[0.08] bg-white/[0.03] p-4 lg:grid-cols-[minmax(0,1fr)_170px_160px]">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-sm font-semibold text-ink">{item.task}</h3>
                  {item.photoRequired ? <Badge variant="warn">foto requerida</Badge> : null}
                </div>
                <p className="mt-1 text-xs text-muted">{item.responsible} · {item.date}</p>
                <Input value={item.note} placeholder="Nota" onChange={(event) => updateItem(item.id, { note: event.target.value })} className="mt-3" />
              </div>
              <Select value={item.status} onChange={(event) => updateItem(item.id, { status: event.target.value as RoughInItem["status"] })}>
                <option value="pending">Pendiente</option>
                <option value="in_progress">En progreso</option>
                <option value="completed">Completado</option>
                <option value="failed">Fallo</option>
                <option value="not_applicable">No aplica</option>
              </Select>
              <Badge variant={statusVariant(item.status)} className="h-fit justify-center">{titleize(item.status)}</Badge>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function ElectricalCircuitLoadAnalyzer({ circuits, setCircuits }: { circuits: CircuitRow[]; setCircuits: (circuits: CircuitRow[]) => void }) {
  const totalEstimatedLoad = circuits.reduce((sum, circuit) => sum + circuit.loadAmps, 0);
  const panelCapacity = 200;
  const panelUsage = (totalEstimatedLoad / panelCapacity) * 100;

  function updateCircuit(id: string, patch: Partial<CircuitRow>) {
    setCircuits(circuits.map((circuit) => (circuit.id === id ? { ...circuit, ...patch } : circuit)));
  }

  function addCircuit() {
    const nextNumber = Math.max(...circuits.map((circuit) => circuit.circuitNumber)) + 1;
    setCircuits([...circuits, { id: `c-${Date.now()}`, circuitNumber: nextNumber, breakerAmps: 20, loadAmps: 0 }]);
  }

  return (
    <div className="grid gap-6">
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatTile label="Panel" value="Principal 200A" icon={CircuitBoard} tone="amber" />
        <StatTile label="Voltaje" value="120/240V" icon={Zap} />
        <StatTile label="Fases" value="1 phase" icon={BatteryCharging} />
        <StatTile label="Frecuencia" value="60Hz" icon={Gauge} />
        <StatTile label="Capacidad utilizada" value={`${Math.round(panelUsage)}%`} icon={BarChart3} tone={panelUsage > 80 ? "amber" : "green"} />
      </section>

      <Card className="grid gap-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-ink">Carga del Circuito</h2>
            <p className="text-sm text-muted">Capacidad usada del panel/circuitos y deteccion de riesgos.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="ghost">Ver Diagrama Unifilar</Button>
            <Button type="button" onClick={addCircuit}>
              <Plus size={15} />
              Agregar Circuito
            </Button>
            <Button type="button" variant="ghost">Crear Alerta</Button>
          </div>
        </div>

        <div className="overflow-x-auto rounded-lg border border-white/[0.08]">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-white/[0.03] text-muted">
              <tr>
                <th className="px-3 py-3 text-left font-medium">Circuito</th>
                <th className="px-3 py-3 text-left font-medium">Breaker</th>
                <th className="px-3 py-3 text-left font-medium">Carga A</th>
                <th className="px-3 py-3 text-left font-medium">Porcentaje</th>
                <th className="px-3 py-3 text-left font-medium">Estado</th>
              </tr>
            </thead>
            <tbody>
              {circuits.map((circuit) => {
                const percent = circuitLoadPercent(circuit);
                const status = circuitStatus(circuit);
                return (
                  <tr key={circuit.id} className="border-t border-white/[0.06]">
                    <td className="px-3 py-2 font-semibold text-ink">{circuit.circuitNumber}</td>
                    <td className="px-3 py-2">
                      <Input type="number" value={circuit.breakerAmps} onChange={(event) => updateCircuit(circuit.id, { breakerAmps: Number(event.target.value) })} />
                    </td>
                    <td className="px-3 py-2">
                      <Input type="number" step={0.1} value={circuit.loadAmps} onChange={(event) => updateCircuit(circuit.id, { loadAmps: Number(event.target.value) })} />
                    </td>
                    <td className="px-3 py-2">
                      <div className="grid gap-1">
                        <span className="font-semibold text-ink">{Math.round(percent)}%</span>
                        <div className="h-2 overflow-hidden rounded-full bg-white/[0.08]">
                          <div className={`h-full ${percent > 100 ? "bg-red-400" : percent > 80 ? "bg-amber-400" : "bg-emerald-400"}`} style={{ width: `${Math.min(100, percent)}%` }} />
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <Badge variant={statusVariant(status)}>{circuitStatusLabel(status)}</Badge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function ElectricalResearchWorkbench({ scope }: { scope: ScopeState }) {
  const [query, setQuery] = useState("200A panel upgrade material pricing and permit requirements");
  const [category, setCategory] = useState<ElectricalResearchCategory>("pricing");
  const [location, setLocation] = useState(scope.address);
  const [result, setResult] = useState<ElectricalResearchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const presets: Array<{ label: string; query: string; category: ElectricalResearchCategory }> = [
    { label: "Material prices", query: "THHN wire EMT conduit breakers current pricing", category: "materials" },
    { label: "NEC / code", query: "NEC requirements kitchen dedicated circuits GFCI AFCI", category: "code" },
    { label: "Permit / AHJ", query: "electrical permit panel upgrade inspection requirements", category: "permit" },
    { label: "EV charger", query: "EV charger load management smart panel installation requirements", category: "innovation" },
    { label: "Safety", query: "electrical rough-in inspection safety checklist grounding GFCI AFCI", category: "safety" },
  ];

  async function runResearch(nextQuery = query, nextCategory = category) {
    setLoading(true);
    setError(null);

    try {
      const data = await researchElectricalTool({
        query: nextQuery,
        category: nextCategory,
        location,
        maxResults: 8,
      });
      setResult(data);
    } catch (exception) {
      setError(exception instanceof Error ? exception.message : "No se pudo completar la investigacion.");
    } finally {
      setLoading(false);
    }
  }

  function applyPreset(preset: { query: string; category: ElectricalResearchCategory }) {
    setQuery(preset.query);
    setCategory(preset.category);
    void runResearch(preset.query, preset.category);
  }

  return (
    <div className="grid gap-6">
      <Card className="grid gap-5 border-blue-400/20 bg-blue-400/[0.04]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-ink">Electrical Research Engine</h2>
            <p className="text-sm text-muted">
              Busca precios, codigo, permisos, seguridad, materiales e innovaciones sin exponer llaves del proveedor en el navegador.
            </p>
          </div>
          <Badge variant={result?.provider === "offline" ? "warn" : "info"}>
            {result ? result.provider : "web-ready"}
          </Badge>
        </div>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_220px_260px_auto]">
          <Input
            label="Busqueda"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Ej: Square D QO GFCI breaker compatibility"
          />
          <Select
            label="Categoria"
            value={category}
            onChange={(event) => setCategory(event.target.value as ElectricalResearchCategory)}
          >
            <option value="materials">Materials</option>
            <option value="code">Code</option>
            <option value="permit">Permit</option>
            <option value="pricing">Pricing</option>
            <option value="innovation">Innovation</option>
            <option value="safety">Safety</option>
            <option value="general">General</option>
          </Select>
          <Input label="Ubicacion" value={location} onChange={(event) => setLocation(event.target.value)} />
          <div className="flex items-end">
            <Button type="button" onClick={() => void runResearch()} loading={loading} className="w-full">
              <Search size={15} />
              {loading ? "Buscando" : "Buscar"}
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {presets.map((preset) => (
            <button
              key={preset.label}
              type="button"
              onClick={() => applyPreset(preset)}
              className="inline-flex min-h-[34px] items-center gap-2 rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 text-sm font-semibold text-muted hover:border-blue-300/30 hover:bg-blue-300/[0.08] hover:text-ink"
            >
              <Globe2 size={14} />
              {preset.label}
            </button>
          ))}
        </div>

        {error ? <div className="rounded-lg border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm text-red-200">{error}</div> : null}
      </Card>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Live provider" value={result?.provider ?? "ready"} icon={Globe2} tone="blue" />
        <StatTile label="Sources" value={result?.results.length ?? 0} icon={FileText} />
        <StatTile label="Research gates" value={result?.gates.length ?? 3} icon={ShieldCheck} tone="green" />
        <StatTile label="Scope impact" value={result ? "Review" : "Pending"} icon={AlertTriangle} tone="amber" />
      </section>

      {result ? (
        <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
          <Card className="grid gap-4">
            <div>
              <h3 className="text-lg font-semibold text-ink">Resultados</h3>
              <p className="text-xs text-muted">{result.query} · {new Date(result.generatedAt).toLocaleString()}</p>
            </div>

            {result.answer ? (
              <div className="rounded-lg border border-blue-400/20 bg-blue-400/[0.06] p-4 text-sm text-blue-100">
                {result.answer}
              </div>
            ) : null}

            <div className="grid gap-3">
              {result.results.map((item) => (
                <a
                  key={item.url}
                  href={item.url}
                  target="_blank"
                  rel="noreferrer"
                  className="grid gap-2 rounded-lg border border-white/[0.08] bg-white/[0.03] p-4 transition-all hover:border-blue-300/30 hover:bg-blue-300/[0.05]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h4 className="text-sm font-semibold text-ink">{item.title}</h4>
                      <p className="mt-1 text-xs text-muted">{item.source ?? item.url}</p>
                    </div>
                    <ExternalLink size={15} className="shrink-0 text-blue-300" />
                  </div>
                  <p className="text-sm leading-6 text-slate-300">{item.snippet}</p>
                </a>
              ))}
            </div>
          </Card>

          <div className="grid gap-4 self-start">
            <Card className="grid gap-3">
              <h3 className="text-lg font-semibold text-ink">Acciones recomendadas</h3>
              {result.recommendations.map((item) => (
                <div key={item} className="rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-sm text-slate-300">
                  {item}
                </div>
              ))}
            </Card>

            <Card className="grid gap-3 border-amber-400/20 bg-amber-400/[0.04]">
              <h3 className="text-lg font-semibold text-ink">Gates SEMSE</h3>
              {result.gates.map((item) => (
                <div key={item} className="flex gap-2 rounded-lg border border-amber-300/15 bg-black/20 px-3 py-2 text-sm text-amber-100">
                  <ShieldAlert size={15} className="mt-0.5 shrink-0" />
                  <span>{item}</span>
                </div>
              ))}
            </Card>

            {result.warnings.length > 0 ? (
              <Card className="grid gap-2 border-red-500/20 bg-red-500/[0.05]">
                {result.warnings.map((warning) => (
                  <p key={warning} className="text-sm text-red-200">{warning}</p>
                ))}
              </Card>
            ) : null}
          </div>
        </section>
      ) : (
        <Card className="grid min-h-[260px] place-items-center border-dashed border-white/[0.12] bg-white/[0.02] text-center">
          <div className="grid gap-3 p-8">
            <div className="mx-auto rounded-full border border-blue-400/20 bg-blue-400/[0.08] p-4 text-blue-300">
              <Globe2 size={26} />
            </div>
            <div>
              <h3 className="text-xl font-semibold text-ink">Research listo</h3>
              <p className="mx-auto mt-1 max-w-xl text-sm text-muted">
                Conecta `BRAVE_SEARCH_API_KEY` o `TAVILY_API_KEY` para busqueda web en vivo. Sin llave, la herramienta entrega fuentes confiables y queries listas.
              </p>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}

function useElectricalSummary({
  materials,
  labor,
  scope,
  circuits,
  roughIn,
}: {
  materials: ElectricalMaterialLine[];
  labor: LaborState;
  scope: ScopeState;
  circuits: CircuitRow[];
  roughIn: RoughInItem[];
}) {
  return useMemo(() => {
    const materialCost = materials.reduce((sum, line) => sum + materialLineTotal(line), 0);
    const laborCost = calculateLaborCost(labor);
    const permitCost = scope.permitsRequired ? 275 : 0;
    const overheadCost = (materialCost + laborCost) * 0.12;
    const directCost = materialCost + laborCost + permitCost + overheadCost;
    const marginPercent = 28;
    const profit = directCost * (marginPercent / 100);
    const contingencyCost = directCost * 0.1;
    const salePrice = directCost + profit + contingencyCost;
    const riskScore = computeRiskScore({ scope, labor, circuits, roughIn });
    const readinessScore = Math.round((roughIn.filter((item) => item.status === "completed").length / roughIn.length) * 100);

    return {
      materialCost,
      laborCost,
      permitCost,
      overheadCost,
      directCost,
      marginPercent,
      profit,
      contingencyCost,
      salePrice,
      riskScore,
      readinessScore,
    };
  }, [circuits, labor, materials, roughIn, scope]);
}

function ElectricalToolSidebar({ activeSection }: { activeSection: ElectricalSection }) {
  return (
    <aside className="grid gap-3 self-start rounded-lg border border-white/[0.08] bg-[#0d1324] p-3 lg:sticky lg:top-6">
      <Link href="/tools" className="inline-flex items-center gap-2 rounded-md px-2 py-2 text-sm text-muted hover:bg-white/[0.05] hover:text-ink">
        <ArrowLeft size={15} />
        Tool Hub
      </Link>
      <div className="h-px bg-white/[0.08]" />
      <nav className="grid gap-1">
        {SECTIONS.map((section) => {
          const Icon = section.icon;
          const active = section.id === activeSection;
          return (
            <Link
              key={section.id}
              href={section.href}
              className={`flex min-h-[40px] items-center gap-2 rounded-md px-3 text-sm font-semibold transition-all ${
                active
                  ? "bg-amber-300 text-[#0a0a14]"
                  : "text-muted hover:bg-white/[0.05] hover:text-ink"
              }`}
            >
              <Icon size={16} />
              {section.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}

export function ElectricalToolClient({ section = "dashboard" }: { section?: ElectricalSection }) {
  const [engineInput, setEngineInput] = useState<ElectricalInput>(INITIAL_ENGINE_INPUT);
  const [scope, setScope] = useState<ScopeState>(INITIAL_SCOPE);
  const [wiring, setWiring] = useState<WiringState>(INITIAL_WIRING);
  const [labor, setLabor] = useState<LaborState>(INITIAL_LABOR);
  const [materials, setMaterials] = useState<ElectricalMaterialLine[]>(INITIAL_MATERIALS);
  const [milestones, setMilestones] = useState<ElectricalMilestone[]>(INITIAL_MILESTONES);
  const [roughInItems, setRoughInItems] = useState<RoughInItem[]>(INITIAL_ROUGH_IN);
  const [circuits, setCircuits] = useState<CircuitRow[]>(INITIAL_CIRCUITS);

  const summary = useElectricalSummary({ materials, labor, scope, circuits, roughIn: roughInItems });
  const activeConfig = SECTIONS.find((item) => item.id === section) ?? SECTIONS[0];

  function addMaterialLine(line: ElectricalMaterialLine) {
    setMaterials((current) => [line, ...current]);
  }

  return (
    <main className="min-h-screen bg-[#070b14] px-4 py-6 sm:px-6">
      <div className="mx-auto grid w-full max-w-7xl gap-6">
        <header className="grid gap-4 rounded-lg border border-white/[0.08] bg-[#0d1324] p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="brand">SEMSE Pro Tools</Badge>
              <Badge variant="warn">Electrical</Badge>
            </div>
            <Link href="/tools/dashboard" className="inline-flex items-center gap-2 text-sm font-semibold text-muted hover:text-ink">
              Unified dashboard
              <ArrowRight size={14} />
            </Link>
          </div>
          <div className="grid gap-2">
            <h1 className="text-3xl font-bold tracking-tight text-ink">Herramienta de Electricidad</h1>
            <p className="max-w-4xl text-sm text-muted">
              Dashboard, estimacion, alcance, materiales, resumen, milestones, evidencia, pagos, rough-in y carga del circuito.
            </p>
          </div>
        </header>

        <div className="grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
          <ElectricalToolSidebar activeSection={activeConfig.id} />
          <section className="min-w-0">
            {activeConfig.id === "dashboard" ? <ElectricalDashboardPage summary={summary} /> : null}
            {activeConfig.id === "estimate" ? (
              <ElectricalEstimateCalculator
                engineInput={engineInput}
                setEngineInput={setEngineInput}
                wiring={wiring}
                setWiring={setWiring}
                labor={labor}
                setLabor={setLabor}
                addMaterialLine={addMaterialLine}
              />
            ) : null}
            {activeConfig.id === "scope" ? <ElectricalScopeForm scope={scope} setScope={setScope} /> : null}
            {activeConfig.id === "materials" ? <ElectricalMaterialsTable materials={materials} setMaterials={setMaterials} summary={summary} /> : null}
            {activeConfig.id === "summary" ? <ElectricalEstimateSummary summary={summary} /> : null}
            {activeConfig.id === "milestones" ? <ElectricalMilestonesPage milestones={milestones} setMilestones={setMilestones} /> : null}
            {activeConfig.id === "inspection" ? <ElectricalRoughInInspection items={roughInItems} setItems={setRoughInItems} /> : null}
            {activeConfig.id === "load-analysis" ? <ElectricalCircuitLoadAnalyzer circuits={circuits} setCircuits={setCircuits} /> : null}
            {activeConfig.id === "research" ? <ElectricalResearchWorkbench scope={scope} /> : null}
          </section>
        </div>
      </div>
    </main>
  );
}
