import { useState, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  LayoutDashboard, Briefcase, Users, Shield, Settings, Star,
  Clock, CheckCircle2, AlertTriangle, DollarSign, FileText,
  BarChart3, TrendingUp, Hammer, HardHat, Eye, Building2,
  ChevronRight, Search, Bell, Wrench, ClipboardList, Wallet,
  Scale, Database, Brain, Network, Lock, Layers, Cpu, Zap,
  ArrowRight, XCircle, CircleDot
} from "lucide-react";
import { toast } from "sonner";

// ==================== TYPES ====================

type Role = "worker" | "client" | "admin";

interface Job {
  id: string;
  title: string;
  client: string;
  worker?: string;
  status: "pending" | "in_progress" | "review" | "completed" | "disputed";
  budget: number;
  progress: number;
  category: string;
  createdAt: string;
}

interface TaskItem {
  id: string;
  title: string;
  status: "pending" | "in_progress" | "completed";
  priority: "low" | "medium" | "high";
  dueDate: string;
}

// ==================== MOCK DATA ====================

const mockJobs: Job[] = [
  { id: "J001", title: "Remodelación Cocina", client: "María García", worker: "Carlos López", status: "in_progress", budget: 15000, progress: 65, category: "Remodelación", createdAt: "2025-03-15" },
  { id: "J002", title: "Instalación Eléctrica", client: "Pedro Ruiz", worker: "Ana Torres", status: "review", budget: 8500, progress: 90, category: "Electricidad", createdAt: "2025-03-10" },
  { id: "J003", title: "Pintura Exterior", client: "Laura Méndez", status: "pending", budget: 5000, progress: 0, category: "Pintura", createdAt: "2025-03-20" },
  { id: "J004", title: "Plomería Baño Principal", client: "Roberto Sánchez", worker: "Miguel Herrera", status: "completed", budget: 3200, progress: 100, category: "Plomería", createdAt: "2025-02-28" },
  { id: "J005", title: "Construcción Terraza", client: "Ana Martínez", worker: "José Ramírez", status: "in_progress", budget: 25000, progress: 40, category: "Construcción", createdAt: "2025-03-01" },
  { id: "J006", title: "Impermeabilización Techo", client: "Diego Flores", status: "disputed", budget: 7800, progress: 50, category: "Impermeabilización", createdAt: "2025-03-05" },
];

const mockTasks: TaskItem[] = [
  { id: "T001", title: "Comprar materiales para cocina", status: "completed", priority: "high", dueDate: "2025-03-18" },
  { id: "T002", title: "Revisar planos eléctricos", status: "in_progress", priority: "medium", dueDate: "2025-03-22" },
  { id: "T003", title: "Cotizar pintura exterior", status: "pending", priority: "low", dueDate: "2025-03-25" },
  { id: "T004", title: "Inspección de seguridad", status: "pending", priority: "high", dueDate: "2025-03-20" },
  { id: "T005", title: "Entregar evidencia fotográfica", status: "in_progress", priority: "medium", dueDate: "2025-03-23" },
];

// ==================== HELPER COMPONENTS ====================

function StatCard({ title, value, icon: Icon, trend, color }: { title: string; value: string | number; icon: React.ElementType; trend?: string; color: string }) {
  const colorMap: Record<string, string> = {
    blue: "text-blue-400 bg-blue-500/10",
    green: "text-green-400 bg-green-500/10",
    purple: "text-purple-400 bg-purple-500/10",
    amber: "text-amber-400 bg-amber-500/10",
    red: "text-red-400 bg-red-500/10",
    pink: "text-pink-400 bg-pink-500/10",
  };
  return (
    <Card className="border-border/50">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">{title}</p>
            <p className="text-2xl font-bold mt-1">{value}</p>
            {trend && <p className="text-xs text-green-400 mt-1 flex items-center gap-1"><TrendingUp className="w-3 h-3" />{trend}</p>}
          </div>
          <div className={`p-3 rounded-xl ${colorMap[color] || colorMap.blue}`}><Icon className="w-6 h-6" /></div>
        </div>
      </CardContent>
    </Card>
  );
}

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; className: string }> = {
    pending: { label: "Pendiente", className: "bg-yellow-500/10 text-yellow-300 border-yellow-500/30" },
    in_progress: { label: "En Progreso", className: "bg-blue-500/10 text-blue-300 border-blue-500/30" },
    review: { label: "En Revisión", className: "bg-purple-500/10 text-purple-300 border-purple-500/30" },
    completed: { label: "Completado", className: "bg-green-500/10 text-green-300 border-green-500/30" },
    disputed: { label: "Disputado", className: "bg-red-500/10 text-red-300 border-red-500/30" },
  };
  const c = config[status] || config.pending;
  return <Badge variant="outline" className={c.className}>{c.label}</Badge>;
}

// ==================== WORKER DASHBOARD ====================

function WorkerDashboard() {
  const myJobs = mockJobs.filter(j => j.worker);
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Trabajos Activos" value={myJobs.filter(j => j.status === "in_progress").length} icon={Briefcase} color="blue" />
        <StatCard title="En Revisión" value={myJobs.filter(j => j.status === "review").length} icon={Eye} color="purple" />
        <StatCard title="Completados" value={myJobs.filter(j => j.status === "completed").length} icon={CheckCircle2} trend="+2 este mes" color="green" />
        <StatCard title="Ingresos" value="$26,700" icon={DollarSign} trend="+15%" color="amber" />
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card className="border-border/50">
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><Briefcase className="w-4 h-4 text-primary" />Mis Trabajos</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-3">
              {myJobs.map(job => (
                <div key={job.id} className="p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors cursor-pointer" onClick={() => toast.info(`Detalle del trabajo: ${job.title}`)}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2"><span className="text-sm font-medium">{job.title}</span><StatusBadge status={job.status} /></div>
                    <span className="text-sm font-mono text-muted-foreground">${job.budget.toLocaleString()}</span>
                  </div>
                  <div className="flex items-center gap-2"><Progress value={job.progress} className="h-1.5 flex-1" /><span className="text-xs text-muted-foreground">{job.progress}%</span></div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50">
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><ClipboardList className="w-4 h-4 text-primary" />Mis Tareas</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {mockTasks.map(task => (
                <div key={task.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full ${task.status === "completed" ? "bg-green-400" : task.status === "in_progress" ? "bg-blue-400" : "bg-yellow-400"}`} />
                    <div>
                      <p className="text-sm font-medium">{task.title}</p>
                      <p className="text-xs text-muted-foreground">Vence: {task.dueDate}</p>
                    </div>
                  </div>
                  <Badge variant="outline" className={task.priority === "high" ? "text-red-300 border-red-500/30" : task.priority === "medium" ? "text-yellow-300 border-yellow-500/30" : "text-green-300 border-green-500/30"}>
                    {task.priority}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ==================== CLIENT DASHBOARD ====================

function ClientDashboard() {
  const myJobs = mockJobs.filter(j => j.client);
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Proyectos Activos" value={myJobs.filter(j => j.status !== "completed").length} icon={Building2} color="blue" />
        <StatCard title="Presupuesto Total" value="$64,500" icon={DollarSign} color="amber" />
        <StatCard title="Completados" value={myJobs.filter(j => j.status === "completed").length} icon={CheckCircle2} color="green" />
        <StatCard title="En Disputa" value={myJobs.filter(j => j.status === "disputed").length} icon={AlertTriangle} color="red" />
      </div>

      <Card className="border-border/50">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2"><Building2 className="w-4 h-4 text-primary" />Mis Proyectos</CardTitle>
            <Button size="sm" onClick={() => toast.info("Crear nuevo proyecto (funcionalidad próximamente)")}><Briefcase className="w-4 h-4 mr-2" />Nuevo Proyecto</Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {myJobs.map(job => (
              <div key={job.id} className="p-4 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors cursor-pointer" onClick={() => toast.info(`Detalle: ${job.title}`)}>
                <div className="flex items-center justify-between mb-2">
                  <div><p className="text-sm font-medium">{job.title}</p><p className="text-xs text-muted-foreground">{job.category} - {job.worker || "Sin asignar"}</p></div>
                  <div className="text-right"><StatusBadge status={job.status} /><p className="text-sm font-mono mt-1">${job.budget.toLocaleString()}</p></div>
                </div>
                <div className="flex items-center gap-2"><Progress value={job.progress} className="h-1.5 flex-1" /><span className="text-xs text-muted-foreground">{job.progress}%</span></div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ==================== ADMIN DASHBOARD ====================

function AdminDashboard() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Trabajos" value={mockJobs.length} icon={Briefcase} trend="+12% vs mes anterior" color="blue" />
        <StatCard title="Profesionales" value={24} icon={Users} trend="+3 nuevos" color="purple" />
        <StatCard title="Ingresos Plataforma" value="$12,450" icon={DollarSign} trend="+18%" color="green" />
        <StatCard title="Disputas Abiertas" value={mockJobs.filter(j => j.status === "disputed").length} icon={Scale} color="red" />
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card className="border-border/50">
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><BarChart3 className="w-4 h-4 text-primary" />Operaciones</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[
                { label: "Tasa de Completitud", value: 78, color: "bg-green-500" },
                { label: "Satisfacción Cliente", value: 92, color: "bg-blue-500" },
                { label: "Tiempo Promedio Resolución", value: 65, color: "bg-purple-500" },
                { label: "Retención Profesionales", value: 88, color: "bg-amber-500" },
              ].map(item => (
                <div key={item.label} className="space-y-1">
                  <div className="flex justify-between text-sm"><span className="text-muted-foreground">{item.label}</span><span className="font-mono">{item.value}%</span></div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden"><div className={`h-full ${item.color} rounded-full transition-all`} style={{ width: `${item.value}%` }} /></div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50">
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-primary" />Alertas Recientes</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[
                { type: "dispute", message: "Disputa abierta en J006 - Impermeabilización", time: "Hace 2h", icon: Scale, color: "text-red-400 bg-red-500/10" },
                { type: "review", message: "Trabajo J002 pendiente de aprobación QA", time: "Hace 4h", icon: Eye, color: "text-purple-400 bg-purple-500/10" },
                { type: "new", message: "Nuevo profesional registrado: Ana Torres", time: "Hace 6h", icon: Users, color: "text-blue-400 bg-blue-500/10" },
                { type: "payment", message: "Pago liberado para J004 - $3,200", time: "Hace 1d", icon: DollarSign, color: "text-green-400 bg-green-500/10" },
              ].map((alert, i) => (
                <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-muted/30 cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => toast.info(alert.message)}>
                  <div className={`p-2 rounded-lg ${alert.color}`}><alert.icon className="w-4 h-4" /></div>
                  <div className="flex-1 min-w-0"><p className="text-sm">{alert.message}</p><p className="text-xs text-muted-foreground">{alert.time}</p></div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0 mt-1" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-border/50">
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Briefcase className="w-4 h-4 text-primary" />Todos los Trabajos</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-border/50">
                <th className="text-left py-2 px-3 text-muted-foreground font-medium">ID</th>
                <th className="text-left py-2 px-3 text-muted-foreground font-medium">Proyecto</th>
                <th className="text-left py-2 px-3 text-muted-foreground font-medium">Cliente</th>
                <th className="text-left py-2 px-3 text-muted-foreground font-medium">Profesional</th>
                <th className="text-left py-2 px-3 text-muted-foreground font-medium">Estado</th>
                <th className="text-right py-2 px-3 text-muted-foreground font-medium">Presupuesto</th>
                <th className="text-right py-2 px-3 text-muted-foreground font-medium">Progreso</th>
              </tr></thead>
              <tbody>
                {mockJobs.map(job => (
                  <tr key={job.id} className="border-b border-border/20 hover:bg-muted/30 cursor-pointer" onClick={() => toast.info(`Detalle: ${job.title}`)}>
                    <td className="py-2 px-3 font-mono text-xs text-muted-foreground">{job.id}</td>
                    <td className="py-2 px-3 font-medium">{job.title}</td>
                    <td className="py-2 px-3 text-muted-foreground">{job.client}</td>
                    <td className="py-2 px-3 text-muted-foreground">{job.worker || "-"}</td>
                    <td className="py-2 px-3"><StatusBadge status={job.status} /></td>
                    <td className="py-2 px-3 text-right font-mono">${job.budget.toLocaleString()}</td>
                    <td className="py-2 px-3 text-right"><div className="flex items-center gap-2 justify-end"><Progress value={job.progress} className="h-1.5 w-16" /><span className="text-xs">{job.progress}%</span></div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ==================== PROMETEO SECTION ====================

function PrometeoSection() {
  const [activeModule, setActiveModule] = useState("architecture");

  const modules = [
    { id: "architecture", label: "Arquitectura", icon: Network, description: "Arquitectura de microservicios del sistema Prometeo" },
    { id: "agents", label: "Agentes IA", icon: Brain, description: "Sistema multi-agente para automatización inteligente" },
    { id: "cortex", label: "Cortex", icon: Cpu, description: "Motor de procesamiento central y orquestación" },
    { id: "trust", label: "TrustEngine", icon: Shield, description: "Motor de confianza y verificación de identidad" },
    { id: "knowledge", label: "Knowledge Matrix", icon: Database, description: "Base de conocimiento distribuida" },
    { id: "permissions", label: "Permisos", icon: Lock, description: "Sistema granular de control de acceso" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-xl font-bold flex items-center gap-2"><Zap className="w-5 h-5 text-amber-400" />Prometeo Engine</h3>
        <p className="text-sm text-muted-foreground">Infraestructura inteligente que potencia SEMSE OS</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {modules.map(mod => (
          <button key={mod.id} onClick={() => setActiveModule(mod.id)} className={`p-3 rounded-lg border text-left transition-all ${activeModule === mod.id ? "border-primary bg-primary/10" : "border-border/50 hover:border-border"}`}>
            <mod.icon className={`w-5 h-5 mb-2 ${activeModule === mod.id ? "text-primary" : "text-muted-foreground"}`} />
            <p className="text-xs font-medium">{mod.label}</p>
          </button>
        ))}
      </div>

      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {(() => { const m = modules.find(m => m.id === activeModule); const Icon = m?.icon || Network; return <Icon className="w-5 h-5 text-primary" />; })()}
            {modules.find(m => m.id === activeModule)?.label}
          </CardTitle>
          <CardDescription>{modules.find(m => m.id === activeModule)?.description}</CardDescription>
        </CardHeader>
        <CardContent>
          {activeModule === "architecture" && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[
                  { name: "API Gateway", desc: "Enrutamiento y autenticación", status: "active", icon: Network },
                  { name: "Auth Service", desc: "OAuth 2.0 + JWT + MFA", status: "active", icon: Lock },
                  { name: "Job Orchestrator", desc: "Gestión de trabajos y hitos", status: "active", icon: Briefcase },
                  { name: "Payment Engine", desc: "Escrow y liberación de pagos", status: "active", icon: DollarSign },
                  { name: "Notification Hub", desc: "Push, email, SMS, in-app", status: "active", icon: Bell },
                  { name: "AI Pipeline", desc: "Procesamiento ML/NLP", status: "beta", icon: Brain },
                ].map(svc => (
                  <div key={svc.name} className="p-4 rounded-lg bg-muted/30 border border-border/30">
                    <div className="flex items-center gap-2 mb-2">
                      <svc.icon className="w-4 h-4 text-primary" />
                      <span className="text-sm font-medium">{svc.name}</span>
                      <Badge variant="outline" className={svc.status === "active" ? "bg-green-500/10 text-green-300 border-green-500/30 text-xs" : "bg-amber-500/10 text-amber-300 border-amber-500/30 text-xs"}>{svc.status}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">{svc.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeModule === "agents" && (
            <div className="space-y-4">
              {[
                { name: "MatchMaker Agent", desc: "Empareja clientes con profesionales óptimos usando ML", capabilities: ["Análisis de habilidades", "Scoring de compatibilidad", "Optimización geográfica"] },
                { name: "QA Inspector Agent", desc: "Verifica calidad de trabajo mediante análisis de evidencia", capabilities: ["Análisis de imágenes", "Verificación de hitos", "Detección de anomalías"] },
                { name: "Dispute Resolver Agent", desc: "Media en conflictos usando análisis de contexto", capabilities: ["NLP de comunicaciones", "Análisis de evidencia", "Sugerencia de resolución"] },
                { name: "Price Estimator Agent", desc: "Estima presupuestos basado en datos históricos", capabilities: ["Análisis de mercado", "Ajuste por complejidad", "Predicción de costos"] },
              ].map(agent => (
                <div key={agent.name} className="p-4 rounded-lg bg-muted/30 border border-border/30">
                  <div className="flex items-center gap-2 mb-2"><Brain className="w-4 h-4 text-purple-400" /><span className="font-medium text-sm">{agent.name}</span></div>
                  <p className="text-xs text-muted-foreground mb-3">{agent.desc}</p>
                  <div className="flex flex-wrap gap-2">{agent.capabilities.map(cap => <Badge key={cap} variant="outline" className="text-xs bg-purple-500/10 text-purple-300 border-purple-500/30">{cap}</Badge>)}</div>
                </div>
              ))}
            </div>
          )}

          {activeModule === "cortex" && (
            <div className="space-y-4">
              <div className="p-4 rounded-lg bg-gradient-to-r from-purple-500/10 to-blue-500/10 border border-purple-500/20">
                <h4 className="font-medium mb-2 flex items-center gap-2"><Cpu className="w-4 h-4 text-purple-400" />Motor de Procesamiento Central</h4>
                <p className="text-sm text-muted-foreground">Cortex es el cerebro de SEMSE OS. Orquesta todos los microservicios, gestiona el flujo de datos entre agentes y mantiene la coherencia del sistema.</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                {[
                  { label: "Latencia Promedio", value: "45ms", color: "text-green-400" },
                  { label: "Throughput", value: "12K req/s", color: "text-blue-400" },
                  { label: "Uptime", value: "99.97%", color: "text-green-400" },
                  { label: "Agentes Activos", value: "4/4", color: "text-purple-400" },
                ].map(m => (
                  <div key={m.label} className="p-3 rounded-lg bg-muted/30 text-center">
                    <p className="text-xs text-muted-foreground">{m.label}</p>
                    <p className={`text-xl font-bold font-mono ${m.color}`}>{m.value}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeModule === "trust" && (
            <div className="space-y-4">
              <div className="p-4 rounded-lg bg-gradient-to-r from-green-500/10 to-emerald-500/10 border border-green-500/20">
                <h4 className="font-medium mb-2 flex items-center gap-2"><Shield className="w-4 h-4 text-green-400" />Motor de Confianza</h4>
                <p className="text-sm text-muted-foreground">TrustEngine calcula y mantiene scores de confianza para todos los participantes del ecosistema SEMSE.</p>
              </div>
              <div className="space-y-3">
                {[
                  { factor: "Verificación KYC", weight: 25, status: "Obligatorio" },
                  { factor: "Historial de Trabajos", weight: 30, status: "Automático" },
                  { factor: "Reviews de Clientes", weight: 20, status: "Automático" },
                  { factor: "Puntualidad en Pagos", weight: 15, status: "Automático" },
                  { factor: "Certificaciones", weight: 10, status: "Opcional" },
                ].map(f => (
                  <div key={f.factor} className="flex items-center gap-4 p-3 rounded-lg bg-muted/30">
                    <div className="flex-1"><p className="text-sm font-medium">{f.factor}</p><p className="text-xs text-muted-foreground">{f.status}</p></div>
                    <div className="w-24"><div className="h-2 bg-muted rounded-full overflow-hidden"><div className="h-full bg-green-500 rounded-full" style={{ width: `${f.weight * 4}%` }} /></div></div>
                    <span className="text-sm font-mono w-8 text-right">{f.weight}%</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeModule === "knowledge" && (
            <div className="space-y-4">
              <div className="p-4 rounded-lg bg-gradient-to-r from-blue-500/10 to-cyan-500/10 border border-blue-500/20">
                <h4 className="font-medium mb-2 flex items-center gap-2"><Database className="w-4 h-4 text-blue-400" />Knowledge Matrix</h4>
                <p className="text-sm text-muted-foreground">Base de conocimiento distribuida que alimenta los agentes IA con datos históricos, patrones de mercado y mejores prácticas.</p>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: "Documentos", value: "12,450", icon: FileText },
                  { label: "Vectores", value: "2.1M", icon: Layers },
                  { label: "Categorías", value: "156", icon: Database },
                  { label: "Actualizaciones/día", value: "340", icon: Zap },
                ].map(s => (
                  <div key={s.label} className="p-3 rounded-lg bg-muted/30 text-center">
                    <s.icon className="w-5 h-5 mx-auto mb-2 text-blue-400" />
                    <p className="text-lg font-bold font-mono">{s.value}</p>
                    <p className="text-xs text-muted-foreground">{s.label}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeModule === "permissions" && (
            <div className="space-y-4">
              <div className="p-4 rounded-lg bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/20">
                <h4 className="font-medium mb-2 flex items-center gap-2"><Lock className="w-4 h-4 text-amber-400" />Control de Acceso Granular</h4>
                <p className="text-sm text-muted-foreground">Sistema RBAC extendido con permisos a nivel de recurso, acción y contexto.</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-border/50">
                    <th className="text-left py-2 px-3 text-muted-foreground font-medium">Permiso</th>
                    <th className="text-center py-2 px-3 text-muted-foreground font-medium">Worker</th>
                    <th className="text-center py-2 px-3 text-muted-foreground font-medium">Client</th>
                    <th className="text-center py-2 px-3 text-muted-foreground font-medium">Admin</th>
                  </tr></thead>
                  <tbody>
                    {[
                      { perm: "Ver trabajos propios", w: true, c: true, a: true },
                      { perm: "Crear trabajos", w: false, c: true, a: true },
                      { perm: "Asignar profesionales", w: false, c: false, a: true },
                      { perm: "Gestionar disputas", w: false, c: false, a: true },
                      { perm: "Ver reportes financieros", w: false, c: false, a: true },
                      { perm: "Subir evidencia", w: true, c: true, a: true },
                      { perm: "Aprobar hitos", w: false, c: true, a: true },
                      { perm: "Configurar sistema", w: false, c: false, a: true },
                    ].map(row => (
                      <tr key={row.perm} className="border-b border-border/20">
                        <td className="py-2 px-3">{row.perm}</td>
                        <td className="py-2 px-3 text-center">{row.w ? <CheckCircle2 className="w-4 h-4 text-green-400 mx-auto" /> : <XCircle className="w-4 h-4 text-red-400/50 mx-auto" />}</td>
                        <td className="py-2 px-3 text-center">{row.c ? <CheckCircle2 className="w-4 h-4 text-green-400 mx-auto" /> : <XCircle className="w-4 h-4 text-red-400/50 mx-auto" />}</td>
                        <td className="py-2 px-3 text-center">{row.a ? <CheckCircle2 className="w-4 h-4 text-green-400 mx-auto" /> : <XCircle className="w-4 h-4 text-red-400/50 mx-auto" />}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ==================== MAIN PAGE ====================

const roleConfig: Record<Role, { label: string; icon: React.ElementType; color: string; description: string }> = {
  worker: { label: "Profesional", icon: HardHat, color: "text-blue-400", description: "Vista del profesional/trabajador" },
  client: { label: "Cliente", icon: Building2, color: "text-green-400", description: "Vista del cliente que contrata servicios" },
  admin: { label: "Administrador", icon: Shield, color: "text-purple-400", description: "Vista del administrador de la plataforma" },
};

export default function SEMSEPage() {
  const [activeRole, setActiveRole] = useState<Role>("admin");
  const [activeSection, setActiveSection] = useState("dashboard");

  const sections = useMemo(() => {
    const base = [{ id: "dashboard", label: "Dashboard", icon: LayoutDashboard }];
    if (activeRole === "admin") {
      base.push({ id: "prometeo", label: "Prometeo", icon: Zap });
    }
    return base;
  }, [activeRole]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Hammer className="w-6 h-6 text-amber-400" />
            SEMSE OS
          </h1>
          <p className="text-muted-foreground mt-1">
            Sistema de gestión de proyectos de construcción y servicios
          </p>
        </div>
        <div className="flex items-center gap-2">
          {(Object.entries(roleConfig) as [Role, typeof roleConfig[Role]][]).map(([role, config]) => (
            <Button key={role} variant={activeRole === role ? "default" : "outline"} size="sm" onClick={() => { setActiveRole(role); setActiveSection("dashboard"); }} className="gap-2">
              <config.icon className={`w-4 h-4 ${activeRole === role ? "" : config.color}`} />
              {config.label}
            </Button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/30 border border-border/30">
        {(() => { const cfg = roleConfig[activeRole]; return (<><cfg.icon className={`w-5 h-5 ${cfg.color}`} /><span className="text-sm font-medium">{cfg.label}</span><span className="text-xs text-muted-foreground">- {cfg.description}</span></>); })()}
      </div>

      {sections.length > 1 && (
        <div className="flex gap-2">
          {sections.map(sec => (
            <Button key={sec.id} variant={activeSection === sec.id ? "default" : "ghost"} size="sm" onClick={() => setActiveSection(sec.id)} className="gap-2">
              <sec.icon className="w-4 h-4" />{sec.label}
            </Button>
          ))}
        </div>
      )}

      {activeSection === "dashboard" && activeRole === "worker" && <WorkerDashboard />}
      {activeSection === "dashboard" && activeRole === "client" && <ClientDashboard />}
      {activeSection === "dashboard" && activeRole === "admin" && <AdminDashboard />}
      {activeSection === "prometeo" && <PrometeoSection />}
    </div>
  );
}
