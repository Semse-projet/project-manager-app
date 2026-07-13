"use client";

import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  ArrowLeft,
  Calculator,
  ClipboardCheck,
  ClipboardList,
  Globe2,
  HardHat,
  LayoutDashboard,
  ShieldCheck,
  Users,
} from "lucide-react";
import { Badge, Button, Card, Input, Select, Textarea } from "@/components/ui";
import {
  calculateSemseTool,
  researchElectricalTool,
  type SemseToolResult,
  type ToolMode,
} from "@/app/lib/semse-tools-api";
import { ToolResultPanel } from "../ToolResultPanel";

export type ProjectManagerSection =
  | "dashboard"
  | "fieldops"
  | "plan"
  | "coordination"
  | "milestones"
  | "inspection"
  | "research";

type ProjectManagerInput = {
  projectName: string;
  projectType: "remodel" | "newConstruction" | "repair" | "service" | "multitrade";
  budget: number;
  projectedDurationDays: number;
  crewSize: number;
  activeTrades: number;
  openTasks: number;
  inspectionsDue: number;
  changeOrders: number;
  clientMeetingsPerWeek: number;
  weatherRisk: "low" | "medium" | "high";
  permitRequired: boolean;
  safetyIssues: number;
  mode: ToolMode;
};

type PlanState = {
  projectName: string;
  clientName: string;
  address: string;
  description: string;
  startDate: string;
  targetDate: string;
  permitsRequired: boolean;
  internalNotes: string;
};

type TradeLine = {
  id: string;
  trade: string;
  contractor: string;
  phase: string;
  status: "scheduled" | "on_site" | "blocked" | "done";
};

type Milestone = {
  id: string;
  name: string;
  status: "pending" | "in_progress" | "completed";
  date: string;
  progress: number;
  amount: number;
  evidenceRequired: string[];
};

const INITIAL_INPUT: ProjectManagerInput = {
  projectName: "Bathroom remodel",
  projectType: "remodel",
  budget: 45000,
  projectedDurationDays: 21,
  crewSize: 4,
  activeTrades: 4,
  openTasks: 12,
  inspectionsDue: 2,
  changeOrders: 1,
  clientMeetingsPerWeek: 2,
  weatherRisk: "medium",
  permitRequired: true,
  safetyIssues: 1,
  mode: "professional",
};

const INITIAL_PLAN: PlanState = {
  projectName: "Bathroom remodel - Johnson residence",
  clientName: "Sarah Johnson",
  address: "1820 Monroe St, Tallahassee, FL",
  description: "Full bathroom remodel: demo, plumbing rough-in, tile, fixtures, paint and closeout.",
  startDate: "2026-07-20",
  targetDate: "2026-08-10",
  permitsRequired: true,
  internalNotes: "Plumbing inspection must pass before tile. Client approves fixtures by 07/18.",
};

const INITIAL_TRADES: TradeLine[] = [
  { id: "t1", trade: "Demolition", contractor: "Crew A", phase: "Demo & prep", status: "done" },
  { id: "t2", trade: "Plumbing", contractor: "FL Plumbing Co", phase: "Rough-in", status: "on_site" },
  { id: "t3", trade: "Electrical", contractor: "Volt Bros", phase: "Rough-in", status: "scheduled" },
  { id: "t4", trade: "Tile", contractor: "Crew B", phase: "Finishes", status: "blocked" },
];

const INITIAL_MILESTONES: Milestone[] = [
  {
    id: "m1",
    name: "Kickoff y demolicion",
    status: "completed",
    date: "2026-07-20",
    progress: 100,
    amount: 6800,
    evidenceRequired: ["Fotos antes", "Permiso visible en obra"],
  },
  {
    id: "m2",
    name: "Rough-in (plomeria + electrico)",
    status: "in_progress",
    date: "2026-07-27",
    progress: 45,
    amount: 14500,
    evidenceRequired: ["Foto de tuberia", "Inspeccion rough-in aprobada"],
  },
  {
    id: "m3",
    name: "Acabados (tile, fixtures, pintura)",
    status: "pending",
    date: "2026-08-05",
    progress: 0,
    amount: 18200,
    evidenceRequired: ["Fotos de acabados", "Walkthrough con cliente"],
  },
  {
    id: "m4",
    name: "Closeout y entrega",
    status: "pending",
    date: "2026-08-10",
    progress: 0,
    amount: 5500,
    evidenceRequired: ["Inspeccion final", "Aprobacion del cliente", "Punch list cerrada"],
  },
];

const SECTIONS: Array<{ id: ProjectManagerSection; label: string; href: string; icon: LucideIcon }> = [
  { id: "dashboard", label: "Dashboard", href: "/tools/project-manager/dashboard", icon: LayoutDashboard },
  { id: "fieldops", label: "Field Ops", href: "/tools/project-manager/fieldops", icon: Calculator },
  { id: "plan", label: "Plan de obra", href: "/tools/project-manager/plan", icon: ClipboardList },
  { id: "coordination", label: "Trades", href: "/tools/project-manager/coordination", icon: Users },
  { id: "milestones", label: "Milestones", href: "/tools/project-manager/milestones", icon: ShieldCheck },
  { id: "inspection", label: "Closeout", href: "/tools/project-manager/inspection", icon: ClipboardCheck },
  { id: "research", label: "Research", href: "/tools/project-manager/research", icon: Globe2 },
];

const TRADE_STATUS_META: Record<TradeLine["status"], { label: string; css: string }> = {
  scheduled: { label: "Programado", css: "text-blue-400" },
  on_site: { label: "En obra", css: "text-yellow-500" },
  blocked: { label: "Bloqueado", css: "text-red-500" },
  done: { label: "Completado", css: "text-green-500" },
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function scheduleHealth(input: ProjectManagerInput): { label: string; css: string } {
  let score = 0;
  if (input.weatherRisk === "high") score += 2;
  if (input.weatherRisk === "medium") score += 1;
  if (input.changeOrders > 2) score += 2;
  else if (input.changeOrders > 0) score += 1;
  if (input.safetyIssues > 0) score += 2;
  if (input.openTasks > input.projectedDurationDays) score += 1;
  if (input.activeTrades > 4) score += 1;
  if (score >= 4) return { label: "En riesgo", css: "text-red-500" };
  if (score >= 2) return { label: "Atencion", css: "text-yellow-500" };
  return { label: "En control", css: "text-green-500" };
}

type ProjectManagerToolClientProps = {
  section: ProjectManagerSection;
};

export function ProjectManagerToolClient({ section }: ProjectManagerToolClientProps) {
  const [input, setInput] = useState<ProjectManagerInput>(INITIAL_INPUT);
  const [plan, setPlan] = useState<PlanState>(INITIAL_PLAN);
  const [trades, setTrades] = useState<TradeLine[]>(INITIAL_TRADES);
  const [milestones] = useState<Milestone[]>(INITIAL_MILESTONES);
  const [result, setResult] = useState<SemseToolResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [researchLoading, setResearchLoading] = useState(false);

  const health = useMemo(() => scheduleHealth(input), [input]);
  const dailyBurn = useMemo(
    () => (input.projectedDurationDays > 0 ? input.budget / input.projectedDurationDays : 0),
    [input.budget, input.projectedDurationDays],
  );
  const milestonesTotal = useMemo(
    () => milestones.reduce((sum, m) => sum + m.amount, 0),
    [milestones],
  );

  async function calculate() {
    setLoading(true);
    setError(null);
    try {
      const response = await calculateSemseTool({
        tool: "project-manager",
        mode: input.mode,
        input,
      });
      setResult(response);
    } catch (exception) {
      setError(exception instanceof Error ? exception.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  async function handleResearch(query: string) {
    setResearchLoading(true);
    try {
      const response = await researchElectricalTool({ query });
      console.log("Research result:", response);
    } catch (exception) {
      setError(exception instanceof Error ? exception.message : "Research failed");
    } finally {
      setResearchLoading(false);
    }
  }

  function cycleTradeStatus(id: string) {
    const order: TradeLine["status"][] = ["scheduled", "on_site", "blocked", "done"];
    setTrades((prev) =>
      prev.map((t) =>
        t.id === id ? { ...t, status: order[(order.indexOf(t.status) + 1) % order.length] } : t,
      ),
    );
  }

  function renderSection(): ReactNode {
    switch (section) {
      case "dashboard":
        return (
          <div className="grid gap-6">
            <div className="grid gap-4 sm:grid-cols-4">
              <Card className="p-4">
                <div className="text-sm text-muted">Presupuesto</div>
                <div className="text-2xl font-bold">{formatCurrency(input.budget)}</div>
              </Card>
              <Card className="p-4">
                <div className="text-sm text-muted">Duracion</div>
                <div className="text-2xl font-bold">{input.projectedDurationDays} dias</div>
              </Card>
              <Card className="p-4">
                <div className="text-sm text-muted">Burn diario</div>
                <div className="text-2xl font-bold">{formatCurrency(dailyBurn)}</div>
              </Card>
              <Card className="p-4">
                <div className="text-sm text-muted">Cronograma</div>
                <div className={`text-2xl font-bold ${health.css}`}>{health.label}</div>
              </Card>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Card className="p-6">
                <h3 className="mb-4 font-semibold">Carga operativa</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>Crew en obra</span>
                    <span className="font-semibold">{input.crewSize} personas</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Trades activos</span>
                    <span className="font-semibold">{input.activeTrades}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Tareas abiertas</span>
                    <span className="font-semibold">{input.openTasks}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Inspecciones pendientes</span>
                    <span className={input.inspectionsDue > 0 ? "font-semibold text-yellow-500" : "font-semibold"}>
                      {input.inspectionsDue}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Change orders</span>
                    <span className={input.changeOrders > 0 ? "font-semibold text-yellow-500" : "font-semibold"}>
                      {input.changeOrders}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Incidentes de seguridad</span>
                    <span className={input.safetyIssues > 0 ? "font-semibold text-red-500" : "font-semibold text-green-500"}>
                      {input.safetyIssues}
                    </span>
                  </div>
                </div>
              </Card>

              <Card className="p-6">
                <h3 className="mb-4 font-semibold">Estado por trade</h3>
                <div className="space-y-2 text-sm">
                  {trades.map((t) => (
                    <div key={t.id} className="flex justify-between">
                      <span>{t.trade} · {t.phase}</span>
                      <span className={TRADE_STATUS_META[t.status].css}>{TRADE_STATUS_META[t.status].label}</span>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          </div>
        );

      case "fieldops":
        return (
          <div className="grid gap-6">
            <Card className="p-6">
              <h3 className="mb-4 font-semibold">Parametros del proyecto</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <Input label="Project Name" value={input.projectName} onChange={(e) => setInput({ ...input, projectName: e.target.value })} />
                <Select label="Project Type" value={input.projectType} onChange={(e) => setInput({ ...input, projectType: e.target.value as ProjectManagerInput["projectType"] })}>
                  <option value="remodel">Remodel</option>
                  <option value="newConstruction">New construction</option>
                  <option value="repair">Repair</option>
                  <option value="service">Service</option>
                  <option value="multitrade">Multi-trade</option>
                </Select>
                <Input label="Budget (USD)" type="number" value={input.budget} onChange={(e) => setInput({ ...input, budget: Number(e.target.value) })} />
                <Input label="Projected duration (days)" type="number" value={input.projectedDurationDays} onChange={(e) => setInput({ ...input, projectedDurationDays: Number(e.target.value) })} />
                <Input label="Crew size" type="number" value={input.crewSize} onChange={(e) => setInput({ ...input, crewSize: Number(e.target.value) })} />
                <Input label="Active trades" type="number" value={input.activeTrades} onChange={(e) => setInput({ ...input, activeTrades: Number(e.target.value) })} />
                <Input label="Open tasks" type="number" value={input.openTasks} onChange={(e) => setInput({ ...input, openTasks: Number(e.target.value) })} />
                <Input label="Inspections due" type="number" value={input.inspectionsDue} onChange={(e) => setInput({ ...input, inspectionsDue: Number(e.target.value) })} />
                <Input label="Change orders" type="number" value={input.changeOrders} onChange={(e) => setInput({ ...input, changeOrders: Number(e.target.value) })} />
                <Input label="Client meetings / week" type="number" value={input.clientMeetingsPerWeek} onChange={(e) => setInput({ ...input, clientMeetingsPerWeek: Number(e.target.value) })} />
                <Input label="Safety issues" type="number" value={input.safetyIssues} onChange={(e) => setInput({ ...input, safetyIssues: Number(e.target.value) })} />
                <Select label="Weather risk" value={input.weatherRisk} onChange={(e) => setInput({ ...input, weatherRisk: e.target.value as ProjectManagerInput["weatherRisk"] })}>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </Select>
                <Select label="Mode" value={input.mode} onChange={(e) => setInput({ ...input, mode: e.target.value as ToolMode })}>
                  <option value="client">Client</option>
                  <option value="professional">Professional</option>
                  <option value="admin">Admin</option>
                </Select>
                <label className="flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-900 p-3">
                  <input
                    type="checkbox"
                    checked={input.permitRequired}
                    onChange={(e) => setInput({ ...input, permitRequired: e.target.checked })}
                  />
                  <span className="text-sm">Permit required</span>
                </label>
              </div>
              <Button className="mt-4 w-full" onClick={calculate} disabled={loading}>
                {loading ? "Calculando..." : "Calcular field ops"}
              </Button>
            </Card>

            <div className="rounded-xl border border-cyan-500/30 bg-cyan-950/30 p-4 text-sm text-cyan-100">
              <strong>Nota operativa:</strong> este modulo controla obra activa. SEMSE guarda diario, cambios, fotos,
              inspecciones y aprobacion antes de liberar cierre.
            </div>

            {result && <ToolResultPanel result={result} />}
            {error && <div className="rounded bg-red-500/10 p-4 text-red-500">{error}</div>}
          </div>
        );

      case "plan":
        return (
          <Card className="p-6">
            <h3 className="mb-4 font-semibold">Plan de obra</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <Input label="Project Name" value={plan.projectName} onChange={(e) => setPlan({ ...plan, projectName: e.target.value })} />
              <Input label="Client Name" value={plan.clientName} onChange={(e) => setPlan({ ...plan, clientName: e.target.value })} />
              <Input label="Address" value={plan.address} onChange={(e) => setPlan({ ...plan, address: e.target.value })} />
              <Input label="Start Date" type="date" value={plan.startDate} onChange={(e) => setPlan({ ...plan, startDate: e.target.value })} />
              <Input label="Target Date" type="date" value={plan.targetDate} onChange={(e) => setPlan({ ...plan, targetDate: e.target.value })} />
              <label className="flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-900 p-3">
                <input
                  type="checkbox"
                  checked={plan.permitsRequired}
                  onChange={(e) => setPlan({ ...plan, permitsRequired: e.target.checked })}
                />
                <span className="text-sm">Permits required</span>
              </label>
              <Textarea label="Description" value={plan.description} onChange={(e) => setPlan({ ...plan, description: e.target.value })} />
              <Textarea label="Internal Notes" value={plan.internalNotes} onChange={(e) => setPlan({ ...plan, internalNotes: e.target.value })} />
            </div>
          </Card>
        );

      case "coordination":
        return (
          <div className="grid gap-6">
            <Card className="p-6">
              <h3 className="mb-4 font-semibold">Coordinacion de trades</h3>
              <p className="mb-4 text-sm text-muted">
                Toca el estado para avanzarlo: Programado → En obra → Bloqueado → Completado.
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left">Trade</th>
                      <th className="text-left">Contratista</th>
                      <th className="text-left">Fase</th>
                      <th className="text-right">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {trades.map((t) => (
                      <tr key={t.id} className="border-b">
                        <td className="py-2 font-semibold">{t.trade}</td>
                        <td>{t.contractor}</td>
                        <td>{t.phase}</td>
                        <td className="text-right">
                          <button
                            type="button"
                            onClick={() => cycleTradeStatus(t.id)}
                            className={`font-semibold ${TRADE_STATUS_META[t.status].css}`}
                          >
                            {TRADE_STATUS_META[t.status].label}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>

            <Card className="p-6">
              <h3 className="mb-4 font-semibold">Reglas de secuencia</h3>
              <ul className="list-disc space-y-1 pl-5 text-sm text-muted">
                <li>Rough-in de plomeria y electrico debe pasar inspeccion antes de cerrar muros.</li>
                <li>Tile queda bloqueado hasta que rough-in este aprobado.</li>
                <li>Ningun trade libera pago sin evidencia fotografica en SEMSE.</li>
                <li>Change orders se documentan y aprueban antes de ejecutar el cambio.</li>
              </ul>
            </Card>
          </div>
        );

      case "milestones":
        return (
          <Card className="p-6">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-semibold">Milestones del proyecto</h3>
              <span className="text-sm text-muted">Total: {formatCurrency(milestonesTotal)}</span>
            </div>
            <div className="space-y-3">
              {milestones.map((m) => (
                <div key={m.id} className="border-l-4 border-blue-500 py-2 pl-4">
                  <div className="flex justify-between">
                    <span className="font-semibold">{m.name}</span>
                    <span className={m.status === "completed" ? "text-green-500" : m.status === "in_progress" ? "text-yellow-500" : "text-gray-500"}>
                      {m.status}
                    </span>
                  </div>
                  <div className="text-sm text-muted">{m.date} · {formatCurrency(m.amount)}</div>
                  <div className="mt-2 h-2 w-full rounded bg-gray-300">
                    <div className="h-full rounded bg-blue-500" style={{ width: `${m.progress}%` }}></div>
                  </div>
                  <div className="mt-1 text-xs text-muted">
                    Evidencia: {m.evidenceRequired.join(" · ")}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        );

      case "inspection":
        return (
          <Card className="p-6">
            <h3 className="mb-4 font-semibold">Checklist de closeout</h3>
            <div className="space-y-2">
              {[
                { label: "Diario de obra completo (logs de cada dia)", checked: true },
                { label: "Todas las inspecciones aprobadas y archivadas", checked: true },
                { label: "Change orders documentados y firmados", checked: false },
                { label: "Incidentes de seguridad cerrados", checked: false },
                { label: "Punch list revisada con el cliente", checked: false },
                { label: "Fotos finales cargadas a SEMSE Evidence", checked: false },
                { label: "Aprobacion final del cliente registrada", checked: false },
              ].map((item) => (
                <div key={item.label} className="flex items-center gap-2">
                  <input type="checkbox" defaultChecked={item.checked} className="rounded" />
                  <span>{item.label}</span>
                </div>
              ))}
            </div>
            <div className="mt-4 rounded bg-yellow-500/10 p-4 text-sm text-yellow-500">
              El cierre financiero no se libera hasta completar el checklist y validar evidencia en SEMSE.
            </div>
          </Card>
        );

      case "research":
        return (
          <Card className="p-6">
            <h3 className="mb-4 font-semibold">Research y guias de gestion de obra</h3>
            <div className="space-y-4">
              <Input placeholder="Buscar secuencias de obra, permisos, coordinacion de trades..." />
              <Button onClick={() => handleResearch("construction sequencing and trade coordination best practices")} disabled={researchLoading}>
                {researchLoading ? "Buscando..." : "Buscar en TradeGuide"}
              </Button>
              <div className="rounded bg-blue-500/5 p-4 text-sm text-muted">
                <p>
                  Conectado a la SEMSE Trade Knowledge Library: guias de secuenciacion, permisos, inspecciones y
                  coordinacion multi-trade con citas reales.
                </p>
              </div>
            </div>
          </Card>
        );

      default:
        return null;
    }
  }

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6">
      <div className="grid gap-6">
        <div className="flex items-center justify-between gap-3">
          <Link href="/tools" className="inline-flex items-center gap-2 text-sm text-muted hover:text-ink">
            <ArrowLeft size={16} />
            Back to tools hub
          </Link>
          <Badge variant="brand">SEMSE Pro Tools</Badge>
        </div>

        <section className="grid gap-3">
          <div className="flex items-center gap-3">
            <HardHat className="h-8 w-8" />
            <h1 className="text-3xl font-bold tracking-tight text-ink">Construction Manager / Field Ops</h1>
          </div>
          <p className="max-w-3xl text-sm text-muted">
            Plan de obra, crew, coordinacion de trades, change orders, inspecciones y closeout para proyectos activos,
            con calculo de costos de gestion y riesgo de cronograma.
          </p>
        </section>

        {/* Section Navigation */}
        <div className="flex gap-2 overflow-x-auto pb-2">
          {SECTIONS.map((s) => {
            const Icon = s.icon;
            const isActive = section === s.id;
            return (
              <Link
                key={s.id}
                href={s.href}
                className={`inline-flex items-center gap-2 rounded px-3 py-2 text-sm font-medium transition ${
                  isActive
                    ? "bg-blue-600 text-white"
                    : "bg-slate-800 text-muted hover:bg-slate-700"
                }`}
              >
                <Icon size={16} />
                {s.label}
              </Link>
            );
          })}
        </div>

        {/* Content */}
        <div className="grid gap-6">
          {renderSection()}
        </div>
      </div>
    </main>
  );
}
