/**
 * SEMSE OS · index.tsx
 * Versión: 3.1 · Sistema completo con jerarquía de roles
 * Stack: React 18 + TypeScript + Tailwind CSS v3 + shadcn/ui
 * Proyecto Prometeo · Florida, USA
 * 
 * Jerarquía:
 * - WORKER (Trabajador): Dashboard, My Jobs, My Tasks, Time Tracker, Evidence, Materials, Incidents, Payments, Profile
 * - CLIENT (Cliente): Dashboard, Create Job, Projects, Evidence, Milestones, Payments, Documents, Reviews, Chat
 * - ADMIN (Administrador): Todas las herramientas + Operaciones, QA, Compliance, Finanzas, Disputas, Reportes, Config
 */

import { useState, useEffect, useMemo, createContext, useContext, type ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  LayoutDashboard, Clock, Users, FolderKanban, CalendarDays, BarChart3,
  Network, DatabaseZap, BotMessageSquare, Blocks, GraduationCap,
  Play, Pause, Square, Briefcase, HardHat, Camera, CreditCard,
  Activity, ShieldCheck, Lock, UserCog, CheckSquare,
  Plus, Filter, MapPin, Star,
  AlertTriangle, CheckCircle,
  FileText, Settings, LogOut,
  Upload, Download, RefreshCw, Edit3, Eye as EyeIcon, DollarSign,
  Package, Home, Building, User
} from 'lucide-react';

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 1. TYPES & CONTEXT
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

type UserRole = 'worker' | 'client' | 'admin';
type ToastType = 'success' | 'error' | 'warning' | 'info';
type PageId = 
  // Worker pages
  | 'dashboard' | 'my_jobs' | 'my_tasks' | 'time_tracker' | 'evidence_upload' | 'materials' | 'my_incidents' | 'my_payments' | 'profile'
  // Client pages
  | 'client_dashboard' | 'create_job' | 'my_projects' | 'project_evidence' | 'milestones' | 'client_payments' | 'documents' | 'reviews'
  // Admin pages
  | 'admin_dashboard' | 'operations' | 'all_jobs' | 'users' | 'qa_center' | 'compliance' | 'finance' | 'disputes' | 'admin_reports' | 'config'
  // Prometeo (all roles)
  | 'architecture' | 'prisma' | 'agents' | 'api' | 'cortex' | 'trust' | 'matrix' | 'permissions';

interface Toast { id: number; msg: string; type: ToastType }

const ToastCtx = createContext<((msg: string, type?: ToastType) => void) | null>(null);

function useToast() {
  const ctx = useContext(ToastCtx);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 2. MOCK DATA
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

interface Job { id: string; title: string; status: 'open' | 'assigned' | 'in_progress' | 'completed' | 'disputed'; client: string; worker?: string; budget: number; location: string; progress: number; createdAt: string; category: string; }
interface Task { id: string; jobId: string; title: string; status: 'pending' | 'in_progress' | 'completed'; assignedTo: string; dueDate: string; }
interface Evidence { id: string; jobId: string; type: 'photo' | 'video' | 'document' | 'note'; url: string; caption: string; uploadedBy: string; uploadedAt: string; milestone?: number; approved?: boolean; aiFlag?: string; }
interface Payment { id: string; jobId: string; amount: number; status: 'pending' | 'escrowed' | 'released' | 'disputed'; type: 'hold' | 'milestone' | 'final'; to: string; date: string; }
interface Incident { id: string; jobId: string; type: 'blockage' | 'damage' | 'missing_material' | 'risk' | 'rework'; severity: 'low' | 'medium' | 'high' | 'critical'; status: 'open' | 'in_progress' | 'resolved'; reportedBy: string; description: string; createdAt: string; }
interface Professional { id: string; name: string; specialty: string; rating: number; jobs: number; trustScore: number; available: boolean; city: string; verified: boolean; earnings: number; }

const MOCK_JOBS: Job[] = [
  { id: 'J001', title: 'Drywall + Textura — Circle 8 Unit 5513', status: 'in_progress', client: 'Rapid Response', worker: 'Carlos Méndez', budget: 12400, location: 'Jacksonville, FL', progress: 65, createdAt: '2026-03-10', category: 'Drywall' },
  { id: 'J002', title: 'Pintura interior — Hoover Unit 214', status: 'assigned', client: 'SEMSE LLC', worker: 'Ana Torres', budget: 4800, location: 'Orlando, FL', progress: 30, createdAt: '2026-03-12', category: 'Pintura' },
  { id: 'J003', title: 'Limpieza post-obra — Oak Ridge', status: 'open', client: 'Pulte Group', budget: 1800, location: 'Tampa, FL', progress: 0, createdAt: '2026-03-18', category: 'Limpieza' },
  { id: 'J004', title: 'Inspección de daños — Hoover Unit 208', status: 'completed', client: 'SEMSE LLC', worker: 'Jorge Soto', budget: 950, location: 'Orlando, FL', progress: 100, createdAt: '2026-03-05', category: 'Inspección' },
  { id: 'J005', title: 'Rodapié + Pisos — Circle 8 Unit 5514', status: 'open', client: 'Rapid Response', budget: 6700, location: 'Jacksonville, FL', progress: 0, createdAt: '2026-03-19', category: 'Pisos' },
];

const MOCK_TASKS: Task[] = [
  { id: 'T001', jobId: 'J001', title: 'Preparar superficie', status: 'completed', assignedTo: 'Carlos Méndez', dueDate: '2026-03-15' },
  { id: 'T002', jobId: 'J001', title: 'Aplicar textura', status: 'in_progress', assignedTo: 'Carlos Méndez', dueDate: '2026-03-20' },
  { id: 'T003', jobId: 'J001', title: 'Lijado final', status: 'pending', assignedTo: 'Carlos Méndez', dueDate: '2026-03-22' },
  { id: 'T004', jobId: 'J002', title: 'Primera mano', status: 'in_progress', assignedTo: 'Ana Torres', dueDate: '2026-03-18' },
];

const MOCK_EVIDENCE: Evidence[] = [
  { id: 'E001', jobId: 'J001', type: 'photo', url: '/evidence/e001.jpg', caption: 'Drywall primer coat completado', uploadedBy: 'Carlos Méndez', uploadedAt: '2026-03-15T09:42:00', milestone: 1, approved: true },
  { id: 'E002', jobId: 'J001', type: 'photo', url: '/evidence/e002.jpg', caption: 'Esquinas selladas, vista general', uploadedBy: 'Carlos Méndez', uploadedAt: '2026-03-15T09:45:00', milestone: 1, approved: true },
  { id: 'E003', jobId: 'J002', type: 'photo', url: '/evidence/e003.jpg', caption: 'Primera mano aplicada', uploadedBy: 'Ana Torres', uploadedAt: '2026-03-18T11:20:00', milestone: 2, approved: false, aiFlag: 'Posible humedad visible' },
];

const MOCK_PAYMENTS: Payment[] = [
  { id: 'P001', jobId: 'J001', amount: 12400, status: 'escrowed', type: 'hold', to: 'Carlos Méndez', date: '2026-03-10' },
  { id: 'P002', jobId: 'J001', amount: 4030, status: 'released', type: 'milestone', to: 'Carlos Méndez', date: '2026-03-16' },
  { id: 'P003', jobId: 'J004', amount: 950, status: 'released', type: 'final', to: 'Jorge Soto', date: '2026-03-15' },
];

const MOCK_INCIDENTS: Incident[] = [
  { id: 'I001', jobId: 'J002', type: 'damage', severity: 'medium', status: 'open', reportedBy: 'Ana Torres', description: 'Daño en pared adyacente', createdAt: '2026-03-18' },
  { id: 'I002', jobId: 'J001', type: 'missing_material', severity: 'low', status: 'resolved', reportedBy: 'Carlos Méndez', description: 'Faltaba masilla, ya se solicitó', createdAt: '2026-03-14' },
];

const MOCK_PROFESSIONALS: Professional[] = [
  { id: 'P001', name: 'Carlos Méndez', specialty: 'Drywall · Textura', rating: 4.8, jobs: 23, trustScore: 87, available: false, city: 'Jacksonville, FL', verified: true, earnings: 48200 },
  { id: 'P002', name: 'Ana Torres', specialty: 'Pintura', rating: 4.7, jobs: 18, trustScore: 92, available: false, city: 'Orlando, FL', verified: true, earnings: 32100 },
  { id: 'P003', name: 'Jorge Soto', specialty: 'Textura · Inspección', rating: 4.9, jobs: 31, trustScore: 95, available: true, city: 'Orlando, FL', verified: true, earnings: 61500 },
  { id: 'P004', name: 'Laura Vega', specialty: 'Rodapié · Pisos', rating: 4.6, jobs: 14, trustScore: 83, available: false, city: 'Jacksonville, FL', verified: true, earnings: 24800 },
];

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 3. SHARED COMPONENTS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const add = (msg: string, type: ToastType = 'info') => {
    const id = Date.now();
    setToasts(p => [...p, { id, msg, type }]);
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 4200);
  };
  const remove = (id: number) => setToasts(p => p.filter(t => t.id !== id));

  const cfg: Record<ToastType, { border: string; text: string; icon: string }> = {
    success: { border: '#10b981', text: '#10b981', icon: '✓' },
    error: { border: '#ef4444', text: '#ef4444', icon: '✕' },
    warning: { border: '#f59e0b', text: '#f59e0b', icon: '⚠' },
    info: { border: '#3b82f6', text: '#3b82f6', icon: 'ℹ' },
  };

  return (
    <ToastCtx.Provider value={add}>
      {children}
      <div className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-2 w-[340px]">
        {toasts.map(t => {
          const c = cfg[t.type];
          return (
            <div key={t.id} onClick={() => remove(t.id)} className="flex items-start gap-3 rounded-xl px-4 py-3 shadow-2xl cursor-pointer animate-in slide-in-from-right-4 bg-card border" style={{ borderLeft: `3px solid ${c.border}` }}>
              <span className="font-bold text-sm mt-0.5 shrink-0" style={{ color: c.text }}>{c.icon}</span>
              <span className="text-sm text-foreground leading-relaxed">{t.msg}</span>
            </div>
          );
        })}
      </div>
    </ToastCtx.Provider>
  );
}

function StatCard({ label, value, delta, icon: Icon, color = 'blue' }: { label: string; value: string | number; delta?: { up: boolean; label: string }; icon: any; color?: 'blue' | 'green' | 'amber' | 'red' | 'violet' | 'cyan'; }) {
  const colors = { blue: 'text-blue-400', green: 'text-green-400', amber: 'text-amber-400', red: 'text-red-400', violet: 'text-violet-400', cyan: 'text-cyan-400' };
  return (
    <Card className="bg-card hover:shadow-lg transition-shadow">
      <CardContent className="p-5">
        <div className="flex items-start justify-between mb-3">
          <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">{label}</span>
          {Icon && <Icon className={`w-4 h-4 ${colors[color]}`} />}
        </div>
        <div className={`text-3xl font-extrabold tracking-tighter leading-none mb-1 ${colors[color]}`}>{value}</div>
        {delta && <p className={`text-xs flex items-center gap-1 ${delta.up ? 'text-green-400' : 'text-muted-foreground'}`}>{delta.up ? '↑' : '↓'} {delta.label}</p>}
      </CardContent>
    </Card>
  );
}

function StatusBadge({ status, text }: { status: 'success' | 'warning' | 'error' | 'info' | 'neutral'; text: string }) {
  const styles = {
    success: 'bg-green-500/10 text-green-400 border-green-500/30',
    warning: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
    error: 'bg-red-500/10 text-red-400 border-red-500/30',
    info: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
    neutral: 'bg-muted text-muted-foreground border-border',
  };
  return <span className={`text-[10px] px-2 py-0.5 rounded-full border ${styles[status]}`}>{text}</span>;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 4. WORKER PAGES
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function WorkerDashboard() {
  const toast = useToast();
  const myJobs = MOCK_JOBS.filter(j => j.worker === 'Carlos Méndez');
  const myTasks = MOCK_TASKS.filter(t => t.assignedTo === 'Carlos Méndez');
  const pendingTasks = myTasks.filter(t => t.status !== 'completed').length;

  return (
    <div className="space-y-6 animate-in fade-in-0 duration-300">
      <div>
        <p className="text-xs text-muted-foreground mb-1">{new Date().toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
        <h2 className="text-2xl font-extrabold tracking-tight">Hola, Carlos</h2>
        <p className="text-sm text-muted-foreground mt-1">Tienes {pendingTasks} tareas pendientes · {myJobs.filter(j => j.status === 'in_progress').length} trabajos activos</p>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <StatCard label="Mis Trabajos" value={myJobs.length} icon={Briefcase} color="blue" delta={{ up: true, label: '+1 esta semana' }} />
        <StatCard label="Tareas Pendientes" value={pendingTasks} icon={CheckSquare} color="amber" />
        <StatCard label="Horas Hoy" value="7.5h" icon={Clock} color="green" delta={{ up: true, label: 'Meta: 8h' }} />
        <StatCard label="Ganancias Semana" value="$1,240" icon={DollarSign} color="violet" delta={{ up: true, label: '+12% vs semana pasada' }} />
      </div>

      <div className="grid grid-cols-2 gap-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 pt-5 px-6">
            <CardTitle className="text-sm font-semibold">Mis Trabajos Activos</CardTitle>
            <Button variant="ghost" size="sm" className="text-xs h-7">Ver todos →</Button>
          </CardHeader>
          <CardContent className="px-6 pb-5">
            {myJobs.filter(j => j.status === 'in_progress').map(job => (
              <div key={job.id} className="flex items-center gap-3 py-3 border-b border-border last:border-0">
                <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                  <Briefcase className="w-5 h-5 text-blue-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{job.title}</p>
                  <p className="text-xs text-muted-foreground">{job.location} · {job.category}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold font-mono">{job.progress}%</p>
                  <StatusBadge status="info" text="En progreso" />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 pt-5 px-6">
            <CardTitle className="text-sm font-semibold">Mis Tareas</CardTitle>
            <Button variant="ghost" size="sm" className="text-xs h-7">Ver todas →</Button>
          </CardHeader>
          <CardContent className="px-6 pb-5">
            {myTasks.map(task => (
              <div key={task.id} className="flex items-center gap-3 py-3 border-b border-border last:border-0">
                <div className={`w-2 h-2 rounded-full ${task.status === 'completed' ? 'bg-green-400' : task.status === 'in_progress' ? 'bg-blue-400' : 'bg-amber-400'}`} />
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium ${task.status === 'completed' ? 'line-through text-muted-foreground' : ''}`}>{task.title}</p>
                  <p className="text-xs text-muted-foreground">Vence: {task.dueDate}</p>
                </div>
                <StatusBadge status={task.status === 'completed' ? 'success' : task.status === 'in_progress' ? 'info' : 'warning'} text={task.status === 'completed' ? 'Completada' : task.status === 'in_progress' ? 'En progreso' : 'Pendiente'} />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <Button variant="outline" className="h-auto py-4 flex flex-col items-center gap-2" onClick={() => toast('Navegando a Time Tracker', 'info')}>
          <Clock className="w-6 h-6 text-blue-400" />
          <span className="text-xs">Registrar Horas</span>
        </Button>
        <Button variant="outline" className="h-auto py-4 flex flex-col items-center gap-2" onClick={() => toast('Navegando a Evidencia', 'info')}>
          <Camera className="w-6 h-6 text-green-400" />
          <span className="text-xs">Subir Evidencia</span>
        </Button>
        <Button variant="outline" className="h-auto py-4 flex flex-col items-center gap-2" onClick={() => toast('Navegando a Materiales', 'info')}>
          <Package className="w-6 h-6 text-amber-400" />
          <span className="text-xs">Solicitar Materiales</span>
        </Button>
        <Button variant="outline" className="h-auto py-4 flex flex-col items-center gap-2" onClick={() => toast('Navegando a Incidencias', 'info')}>
          <AlertTriangle className="w-6 h-6 text-red-400" />
          <span className="text-xs">Reportar Incidencia</span>
        </Button>
      </div>
    </div>
  );
}

function WorkerTimeTracker() {
  const toast = useToast();
  const [status, setStatus] = useState<'idle' | 'active' | 'break'>('idle');
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [breakMs, setBreakMs] = useState(0);
  const [breakStart, setBreakStart] = useState<number | null>(null);
  const [, tick] = useState(0);

  useEffect(() => { const id = setInterval(() => tick(t => t + 1), 1000); return () => clearInterval(id); }, []);

  const workedMs = useMemo(() => {
    if (!startedAt) return 0;
    const curBreak = (status === 'break' && breakStart) ? Date.now() - breakStart : 0;
    return Math.max(0, Date.now() - startedAt - breakMs - curBreak);
  }, [startedAt, breakMs, breakStart, status]);

  const fmt = (ms: number) => {
    const s = Math.floor(ms / 1000), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), ss = s % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
  };

  const pct = Math.min(100, (workedMs / (8 * 3600000)) * 100);
  const accentMap = { idle: '#4b6280', active: '#10b981', break: '#f59e0b' };

  return (
    <div className="max-w-2xl mx-auto space-y-5 animate-in fade-in-0 duration-300">
      <Card className="border-t-4" style={{ borderTopColor: accentMap[status] }}>
        <CardContent className="p-8">
          <div className="flex items-start justify-between mb-8">
            <div>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2">Tiempo trabajado hoy</p>
              <p className="font-mono text-6xl font-semibold tracking-tight tabular-nums">{fmt(workedMs)}</p>
            </div>
            <div className="text-right">
              <Badge variant="outline" style={{ color: accentMap[status], borderColor: accentMap[status] + '50' }}>
                {status === 'idle' ? 'Sin jornada activa' : status === 'active' ? 'Jornada en curso' : 'En pausa'}
              </Badge>
              {startedAt && <p className="text-xs text-muted-foreground mt-2">Inicio: {new Date(startedAt).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}</p>}
            </div>
          </div>
          <Progress value={pct} className="h-2 mb-2" />
          <div className="flex justify-between text-xs text-muted-foreground mb-8"><span>0h</span><span>Meta: 8h</span><span>100%</span></div>
          <div className="flex gap-3">
            {status === 'idle' && (
              <Button size="lg" className="flex-1 bg-green-600 hover:bg-green-700" onClick={() => { setStartedAt(Date.now()); setStatus('active'); toast('Jornada iniciada', 'success'); }}>
                <Play className="w-5 h-5 mr-2" />Iniciar Jornada
              </Button>
            )}
            {status === 'active' && (
              <>
                <Button size="lg" variant="outline" className="flex-1" onClick={() => { setBreakStart(Date.now()); setStatus('break'); toast('Pausa registrada', 'info'); }}>
                  <Pause className="w-5 h-5 mr-2" />Pausa
                </Button>
                <Button size="lg" variant="destructive" className="flex-1" onClick={() => { setStatus('idle'); setStartedAt(null); setBreakMs(0); setBreakStart(null); toast(`Jornada finalizada — ${Math.round(workedMs / 60000)} min`, 'success'); }}>
                  <Square className="w-5 h-5 mr-2" />Finalizar
                </Button>
              </>
            )}
            {status === 'break' && (
              <>
                <Button size="lg" className="flex-1 bg-green-600 hover:bg-green-700" onClick={() => { setBreakMs(p => p + (Date.now() - (breakStart ?? 0))); setBreakStart(null); setStatus('active'); toast('Continuando jornada', 'info'); }}>
                  <Play className="w-5 h-5 mr-2" />Continuar
                </Button>
                <Button size="lg" variant="destructive" className="flex-1" onClick={() => { setStatus('idle'); setStartedAt(null); setBreakMs(0); setBreakStart(null); toast(`Jornada finalizada — ${Math.round(workedMs / 60000)} min`, 'success'); }}>
                  <Square className="w-5 h-5 mr-2" />Finalizar
                </Button>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">Historial de Jornadas</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {[
              { date: 'Hoy', hours: '7h 30m', status: 'En progreso' },
              { date: 'Ayer', hours: '8h 00m', status: 'Completada' },
              { date: '18 Mar', hours: '6h 45m', status: 'Completada' },
              { date: '17 Mar', hours: '7h 15m', status: 'Completada' },
            ].map((entry, i) => (
              <div key={i} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                <span className="text-sm">{entry.date}</span>
                <span className="text-sm font-mono font-medium">{entry.hours}</span>
                <StatusBadge status={entry.status === 'En progreso' ? 'info' : 'success'} text={entry.status} />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function WorkerEvidenceUpload() {
  const toast = useToast();
  const [uploading, setUploading] = useState(false);
  const myEvidence = MOCK_EVIDENCE.filter(e => e.uploadedBy === 'Carlos Méndez');

  const handleUpload = () => {
    setUploading(true);
    setTimeout(() => {
      setUploading(false);
      toast('Evidencia subida correctamente', 'success');
    }, 1500);
  };

  return (
    <div className="space-y-6 animate-in fade-in-0 duration-300">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-extrabold tracking-tight">Evidencia</h2>
          <p className="text-sm text-muted-foreground mt-1">Sube fotos, videos y documentos de tus trabajos</p>
        </div>
        <Button onClick={handleUpload} disabled={uploading}>
          {uploading ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
          {uploading ? 'Subiendo...' : 'Subir Evidencia'}
        </Button>
      </div>

      <Card className="border-dashed border-2 border-border bg-muted/30">
        <CardContent className="p-8 text-center">
          <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
            <Camera className="w-8 h-8 text-muted-foreground" />
          </div>
          <p className="text-sm font-medium mb-2">Arrastra archivos aquí o haz clic para seleccionar</p>
          <p className="text-xs text-muted-foreground mb-4">Fotos, videos, PDFs hasta 50MB</p>
          <Button variant="outline" size="sm">Seleccionar Archivos</Button>
        </CardContent>
      </Card>

      <div>
        <h3 className="text-sm font-semibold mb-4">Mi Evidencia Reciente</h3>
        <div className="grid grid-cols-3 gap-4">
          {myEvidence.map(ev => (
            <Card key={ev.id} className="overflow-hidden">
              <div className="aspect-video bg-muted flex items-center justify-center">
                <Camera className="w-8 h-8 text-muted-foreground" />
              </div>
              <CardContent className="p-3">
                <p className="text-xs font-medium truncate">{ev.caption}</p>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-[10px] text-muted-foreground">{new Date(ev.uploadedAt).toLocaleDateString()}</span>
                  <StatusBadge status={ev.approved ? 'success' : 'warning'} text={ev.approved ? 'Aprobada' : 'Pendiente'} />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 5. CLIENT PAGES
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function ClientDashboard() {
  const toast = useToast();
  const myProjects = MOCK_JOBS.filter(j => j.client === 'Rapid Response');
  const activeProjects = myProjects.filter(j => j.status !== 'completed');
  const totalSpent = MOCK_PAYMENTS.filter(p => myProjects.some(j => j.id === p.jobId) && p.status === 'released').reduce((s, p) => s + p.amount, 0);

  return (
    <div className="space-y-6 animate-in fade-in-0 duration-300">
      <div>
        <p className="text-xs text-muted-foreground mb-1">{new Date().toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
        <h2 className="text-2xl font-extrabold tracking-tight">Bienvenido, Rapid Response</h2>
        <p className="text-sm text-muted-foreground mt-1">{activeProjects.length} proyectos activos · {myProjects.length} proyectos totales</p>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <StatCard label="Proyectos Activos" value={activeProjects.length} icon={FolderKanban} color="blue" />
        <StatCard label="Proyectos Completados" value={myProjects.filter(j => j.status === 'completed').length} icon={CheckCircle} color="green" />
        <StatCard label="Total Invertido" value={`$${totalSpent.toLocaleString()}`} icon={DollarSign} color="violet" />
        <StatCard label="Próximo Hito" value="2 días" icon={CalendarDays} color="amber" />
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Button className="h-auto py-4 flex flex-col items-center gap-2 bg-blue-600 hover:bg-blue-700" onClick={() => toast('Creando nuevo trabajo', 'info')}>
          <Plus className="w-6 h-6" />
          <span className="text-xs">Crear Trabajo</span>
        </Button>
        <Button variant="outline" className="h-auto py-4 flex flex-col items-center gap-2" onClick={() => toast('Viendo evidencia', 'info')}>
          <Camera className="w-6 h-6 text-green-400" />
          <span className="text-xs">Ver Evidencia</span>
        </Button>
        <Button variant="outline" className="h-auto py-4 flex flex-col items-center gap-2" onClick={() => toast('Viendo hitos', 'info')}>
          <BarChart3 className="w-6 h-6 text-amber-400" />
          <span className="text-xs">Hitos</span>
        </Button>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2 pt-5 px-6">
          <CardTitle className="text-sm font-semibold">Mis Proyectos</CardTitle>
          <Button variant="ghost" size="sm" className="text-xs h-7">Ver todos →</Button>
        </CardHeader>
        <CardContent className="px-6 pb-5">
          {myProjects.map(job => (
            <div key={job.id} className="flex items-center gap-4 py-4 border-b border-border last:border-0">
              <div className="w-12 h-12 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <Building className="w-6 h-6 text-blue-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{job.title}</p>
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <MapPin className="w-3 h-3" /> {job.location}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold font-mono">{job.progress}%</p>
                <StatusBadge status={job.status === 'completed' ? 'success' : job.status === 'in_progress' ? 'info' : 'neutral'} text={job.status === 'completed' ? 'Completado' : job.status === 'in_progress' ? 'En progreso' : 'Abierto'} />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function ClientCreateJob() {
  const toast = useToast();
  const [step, setStep] = useState(1);

  const handleSubmit = () => {
    toast('Trabajo creado exitosamente', 'success');
    setStep(1);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-in fade-in-0 duration-300">
      <div>
        <h2 className="text-2xl font-extrabold tracking-tight">Crear Nuevo Trabajo</h2>
        <p className="text-sm text-muted-foreground mt-1">Describe el trabajo que necesitas</p>
      </div>

      <div className="flex items-center gap-2 mb-6">
        {[1, 2, 3].map(s => (
          <div key={s} className={`flex-1 h-2 rounded-full ${s <= step ? 'bg-blue-500' : 'bg-muted'}`} />
        ))}
      </div>

      <Card>
        <CardContent className="p-6 space-y-4">
          {step === 1 && (
            <>
              <div>
                <label className="text-sm font-medium mb-2 block">Título del trabajo</label>
                <Input placeholder="Ej: Reparación de drywall en oficina" />
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Descripción</label>
                <textarea className="w-full min-h-[100px] px-3 py-2 rounded-md border border-input bg-background text-sm" placeholder="Describe el trabajo en detalle..." />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">Categoría</label>
                  <Input placeholder="Ej: Drywall" />
                </div>
                <div>
                  <label className="text-sm font-medium mb-2 block">Presupuesto estimado</label>
                  <Input placeholder="$" type="number" />
                </div>
              </div>
            </>
          )}
          {step === 2 && (
            <>
              <div>
                <label className="text-sm font-medium mb-2 block">Dirección</label>
                <Input placeholder="Calle, número, ciudad" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">Ciudad</label>
                  <Input placeholder="Jacksonville" />
                </div>
                <div>
                  <label className="text-sm font-medium mb-2 block">Estado</label>
                  <Input placeholder="FL" maxLength={2} />
                </div>
              </div>
            </>
          )}
          {step === 3 && (
            <div className="text-center py-8">
              <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-8 h-8 text-green-400" />
              </div>
              <p className="text-lg font-semibold mb-2">¡Listo para publicar!</p>
              <p className="text-sm text-muted-foreground">Revisa los detalles antes de publicar</p>
            </div>
          )}

          <div className="flex gap-3 pt-4">
            {step > 1 && <Button variant="outline" onClick={() => setStep(s => s - 1)}>Anterior</Button>}
            {step < 3 ? (
              <Button className="ml-auto" onClick={() => setStep(s => s + 1)}>Siguiente →</Button>
            ) : (
              <Button className="ml-auto bg-green-600 hover:bg-green-700" onClick={handleSubmit}>
                <CheckCircle className="w-4 h-4 mr-2" /> Publicar Trabajo
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 6. ADMIN PAGES
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function AdminDashboard() {
  const toast = useToast();
  const totalJobs = MOCK_JOBS.length;
  const activeJobs = MOCK_JOBS.filter(j => j.status === 'in_progress').length;
  const totalPros = MOCK_PROFESSIONALS.length;
  const openIncidents = MOCK_INCIDENTS.filter(i => i.status === 'open').length;
  const escrowTotal = MOCK_PAYMENTS.filter(p => p.status === 'escrowed').reduce((s, p) => s + p.amount, 0);

  return (
    <div className="space-y-6 animate-in fade-in-0 duration-300">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-muted-foreground mb-1">{new Date().toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
          <h2 className="text-2xl font-extrabold tracking-tight">Panel de Administración</h2>
          <p className="text-sm text-muted-foreground mt-1">Visión global de operaciones · SEMSE OS</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => toast('Reporte exportado', 'success')}>
            <Download className="w-4 h-4 mr-2" /> Exportar
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-5 gap-4">
        <StatCard label="Total Trabajos" value={totalJobs} icon={Briefcase} color="blue" delta={{ up: true, label: '+3 esta semana' }} />
        <StatCard label="En Progreso" value={activeJobs} icon={Activity} color="green" />
        <StatCard label="Profesionales" value={totalPros} icon={HardHat} color="violet" delta={{ up: true, label: '+2 nuevos' }} />
        <StatCard label="Incidencias Abiertas" value={openIncidents} icon={AlertTriangle} color={openIncidents > 0 ? 'red' : 'green'} />
        <StatCard label="En Escrow" value={`$${escrowTotal.toLocaleString()}`} icon={DollarSign} color="cyan" />
      </div>

      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Operaciones', icon: Activity, color: 'blue', desc: 'Gestión de trabajos y asignaciones' },
          { label: 'QA Center', icon: CheckSquare, color: 'green', desc: 'Control de calidad y aprobaciones' },
          { label: 'Finanzas', icon: DollarSign, color: 'violet', desc: 'Pagos, escrow y reportes' },
          { label: 'Usuarios', icon: Users, color: 'amber', desc: 'Gestión de trabajadores y clientes' },
        ].map((item, i) => (
          <Card key={i} className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => toast(`Navegando a ${item.label}`, 'info')}>
            <CardContent className="p-5">
              <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center mb-3">
                <item.icon className="w-5 h-5 text-blue-400" />
              </div>
              <p className="font-semibold text-sm">{item.label}</p>
              <p className="text-xs text-muted-foreground mt-1">{item.desc}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 pt-5 px-6">
            <CardTitle className="text-sm font-semibold">Trabajos Recientes</CardTitle>
            <Button variant="ghost" size="sm" className="text-xs h-7">Ver todos →</Button>
          </CardHeader>
          <CardContent className="px-6 pb-5">
            {MOCK_JOBS.slice(0, 4).map(job => (
              <div key={job.id} className="flex items-center gap-3 py-3 border-b border-border last:border-0">
                <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-[10px] font-bold">{job.id}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{job.title}</p>
                  <p className="text-xs text-muted-foreground">{job.client} · {job.location}</p>
                </div>
                <StatusBadge status={job.status === 'completed' ? 'success' : job.status === 'in_progress' ? 'info' : job.status === 'disputed' ? 'error' : 'neutral'} text={job.status} />
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 pt-5 px-6">
            <CardTitle className="text-sm font-semibold">Incidencias Recientes</CardTitle>
            <Button variant="ghost" size="sm" className="text-xs h-7">Ver todas →</Button>
          </CardHeader>
          <CardContent className="px-6 pb-5">
            {MOCK_INCIDENTS.map(inc => (
              <div key={inc.id} className="flex items-center gap-3 py-3 border-b border-border last:border-0">
                <AlertTriangle className={`w-5 h-5 ${inc.severity === 'critical' ? 'text-red-400' : inc.severity === 'high' ? 'text-amber-400' : 'text-yellow-400'}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{inc.type}</p>
                  <p className="text-xs text-muted-foreground truncate">{inc.description}</p>
                </div>
                <StatusBadge status={inc.status === 'resolved' ? 'success' : 'error'} text={inc.status} />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function AdminOperations() {
  const toast = useToast();
  const [filter, setFilter] = useState('all');
  const filteredJobs = filter === 'all' ? MOCK_JOBS : MOCK_JOBS.filter(j => j.status === filter);

  return (
    <div className="space-y-6 animate-in fade-in-0 duration-300">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-extrabold tracking-tight">Operaciones</h2>
          <p className="text-sm text-muted-foreground mt-1">Gestión de trabajos y asignaciones</p>
        </div>
        <div className="flex items-center gap-2">
          <Input placeholder="Buscar trabajo..." className="w-64" />
          <Button variant="outline" size="icon"><Filter className="w-4 h-4" /></Button>
        </div>
      </div>

      <div className="flex gap-2">
        {[
          { id: 'all', label: 'Todos', count: MOCK_JOBS.length },
          { id: 'open', label: 'Abiertos', count: MOCK_JOBS.filter(j => j.status === 'open').length },
          { id: 'in_progress', label: 'En Progreso', count: MOCK_JOBS.filter(j => j.status === 'in_progress').length },
          { id: 'completed', label: 'Completados', count: MOCK_JOBS.filter(j => j.status === 'completed').length },
        ].map(f => (
          <Button key={f.id} variant={filter === f.id ? 'default' : 'outline'} size="sm" onClick={() => setFilter(f.id)}>
            {f.label} ({f.count})
          </Button>
        ))}
      </div>

      <Card>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground">ID</th>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Trabajo</th>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Cliente</th>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Asignado</th>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Progreso</th>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Estado</th>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filteredJobs.map(job => (
                <tr key={job.id} className="border-b border-border hover:bg-muted/30">
                  <td className="px-4 py-3 font-mono text-xs">{job.id}</td>
                  <td className="px-4 py-3">
                    <p className="font-medium">{job.title}</p>
                    <p className="text-xs text-muted-foreground">{job.location}</p>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{job.client}</td>
                  <td className="px-4 py-3 text-muted-foreground">{job.worker || '—'}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Progress value={job.progress} className="w-20 h-1.5" />
                      <span className="text-xs">{job.progress}%</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={job.status === 'completed' ? 'success' : job.status === 'in_progress' ? 'info' : job.status === 'disputed' ? 'error' : 'neutral'} text={job.status.replace('_', ' ')} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => toast('Editando trabajo', 'info')}><Edit3 className="w-4 h-4" /></Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => toast('Asignando trabajador', 'info')}><User className="w-4 h-4" /></Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}

function AdminUsers() {
  const toast = useToast();
  const [activeTab, setActiveTab] = useState('workers');

  return (
    <div className="space-y-6 animate-in fade-in-0 duration-300">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-extrabold tracking-tight">Usuarios</h2>
          <p className="text-sm text-muted-foreground mt-1">Gestión de trabajadores y clientes</p>
        </div>
        <Button onClick={() => toast('Creando nuevo usuario', 'info')}>
          <Plus className="w-4 h-4 mr-2" /> Nuevo Usuario
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="workers">Trabajadores ({MOCK_PROFESSIONALS.length})</TabsTrigger>
          <TabsTrigger value="clients">Clientes (2)</TabsTrigger>
          <TabsTrigger value="admins">Administradores (1)</TabsTrigger>
        </TabsList>

        <TabsContent value="workers" className="mt-4">
          <Card>
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/50">
                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Profesional</th>
                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Especialidad</th>
                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Rating</th>
                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Trust Score</th>
                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Estado</th>
                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {MOCK_PROFESSIONALS.map(pro => (
                    <tr key={pro.id} className="border-b border-border hover:bg-muted/30">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <Avatar className="w-8 h-8">
                            <AvatarFallback className="text-xs bg-blue-500/20 text-blue-400">{pro.name.split(' ').map(n => n[0]).join('')}</AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium">{pro.name}</p>
                            <p className="text-xs text-muted-foreground">{pro.city}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{pro.specialty}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
                          <span>{pro.rating}</span>
                          <span className="text-xs text-muted-foreground">({pro.jobs})</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Progress value={pro.trustScore} className="w-16 h-1.5" />
                          <span className="text-xs">{pro.trustScore}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={pro.available ? 'success' : 'warning'} text={pro.available ? 'Disponible' : 'Ocupado'} />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8"><EyeIcon className="w-4 h-4" /></Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8"><Edit3 className="w-4 h-4" /></Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="clients" className="mt-4">
          <Card>
            <CardContent className="p-6 text-center text-muted-foreground">
              <Building className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>Lista de clientes disponible en versión completa</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="admins" className="mt-4">
          <Card>
            <CardContent className="p-6 text-center text-muted-foreground">
              <UserCog className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>Lista de administradores disponible en versión completa</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 7. NAVIGATION & LAYOUT
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

interface NavItem { id: PageId; label: string; icon: any; section: string; roles: UserRole[]; }

const NAV_ITEMS: NavItem[] = [
  // WORKER
  { id: 'dashboard', label: 'Inicio', icon: Home, section: 'worker', roles: ['worker'] },
  { id: 'my_jobs', label: 'Mis Trabajos', icon: Briefcase, section: 'worker', roles: ['worker'] },
  { id: 'my_tasks', label: 'Mis Tareas', icon: CheckSquare, section: 'worker', roles: ['worker'] },
  { id: 'time_tracker', label: 'Registrar Horas', icon: Clock, section: 'worker', roles: ['worker'] },
  { id: 'evidence_upload', label: 'Evidencia', icon: Camera, section: 'worker', roles: ['worker'] },
  { id: 'materials', label: 'Materiales', icon: Package, section: 'worker', roles: ['worker'] },
  { id: 'my_incidents', label: 'Incidencias', icon: AlertTriangle, section: 'worker', roles: ['worker'] },
  { id: 'my_payments', label: 'Pagos', icon: DollarSign, section: 'worker', roles: ['worker'] },
  { id: 'profile', label: 'Perfil', icon: User, section: 'worker', roles: ['worker'] },
  
  // CLIENT
  { id: 'client_dashboard', label: 'Inicio', icon: Home, section: 'client', roles: ['client'] },
  { id: 'create_job', label: 'Crear Trabajo', icon: Plus, section: 'client', roles: ['client'] },
  { id: 'my_projects', label: 'Mis Proyectos', icon: FolderKanban, section: 'client', roles: ['client'] },
  { id: 'project_evidence', label: 'Evidencia', icon: Camera, section: 'client', roles: ['client'] },
  { id: 'milestones', label: 'Hitos', icon: BarChart3, section: 'client', roles: ['client'] },
  { id: 'client_payments', label: 'Pagos', icon: CreditCard, section: 'client', roles: ['client'] },
  { id: 'documents', label: 'Documentos', icon: FileText, section: 'client', roles: ['client'] },
  { id: 'reviews', label: 'Calificaciones', icon: Star, section: 'client', roles: ['client'] },
  
  // ADMIN
  { id: 'admin_dashboard', label: 'Dashboard', icon: LayoutDashboard, section: 'admin', roles: ['admin'] },
  { id: 'operations', label: 'Operaciones', icon: Activity, section: 'admin', roles: ['admin'] },
  { id: 'all_jobs', label: 'Trabajos', icon: Briefcase, section: 'admin', roles: ['admin'] },
  { id: 'users', label: 'Usuarios', icon: Users, section: 'admin', roles: ['admin'] },
  { id: 'qa_center', label: 'QA Center', icon: CheckSquare, section: 'admin', roles: ['admin'] },
  { id: 'compliance', label: 'Compliance', icon: ShieldCheck, section: 'admin', roles: ['admin'] },
  { id: 'finance', label: 'Finanzas', icon: DollarSign, section: 'admin', roles: ['admin'] },
  { id: 'disputes', label: 'Disputas', icon: AlertTriangle, section: 'admin', roles: ['admin'] },
  { id: 'admin_reports', label: 'Reportes', icon: BarChart3, section: 'admin', roles: ['admin'] },
  { id: 'config', label: 'Configuración', icon: Settings, section: 'admin', roles: ['admin'] },
  
  // PROMETEO (all roles)
  { id: 'architecture', label: 'Arquitectura', icon: Network, section: 'prometeo', roles: ['worker', 'client', 'admin'] },
  { id: 'prisma', label: 'Schema Prisma', icon: DatabaseZap, section: 'prometeo', roles: ['worker', 'client', 'admin'] },
  { id: 'agents', label: 'Agents', icon: BotMessageSquare, section: 'prometeo', roles: ['worker', 'client', 'admin'] },
  { id: 'api', label: 'API Contracts', icon: Blocks, section: 'prometeo', roles: ['worker', 'client', 'admin'] },
  { id: 'cortex', label: 'Cortex', icon: Activity, section: 'prometeo', roles: ['worker', 'client', 'admin'] },
  { id: 'trust', label: 'TrustEngine', icon: ShieldCheck, section: 'prometeo', roles: ['worker', 'client', 'admin'] },
  { id: 'matrix', label: 'Conocimientos', icon: GraduationCap, section: 'prometeo', roles: ['worker', 'client', 'admin'] },
  { id: 'permissions', label: 'Permisos', icon: Lock, section: 'prometeo', roles: ['worker', 'client', 'admin'] },
];

function Sidebar({ page, setPage, userRole }: { page: PageId; setPage: (p: PageId) => void; userRole: UserRole }) {
  const items = NAV_ITEMS.filter(item => item.roles.includes(userRole));
  const sections = [...new Set(items.map(i => i.section))];
  const sectionNames: Record<string, string> = { worker: 'Mi Trabajo', client: 'Mis Proyectos', admin: 'Administración', prometeo: 'Prometeo' };
  const sectionColors: Record<string, string> = { worker: 'text-blue-400', client: 'text-cyan-400', admin: 'text-violet-400', prometeo: 'text-amber-400' };

  return (
    <aside className="w-[260px] bg-card border-r border-border flex flex-col h-screen fixed left-0 top-0 z-50 shrink-0">
      <div className="px-5 py-4 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center text-white font-black text-sm shadow-lg shadow-blue-500/20">S</div>
          <div>
            <p className="text-sm font-bold text-foreground leading-none">SEMSE OS</p>
            <p className="text-[10px] text-muted-foreground mt-0.5 tracking-wider">Proyecto Prometeo · FL</p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-3">
        {sections.map(sec => (
          <div key={sec} className="mb-5">
            <p className={`text-[10px] font-bold uppercase tracking-widest px-3 mb-1.5 ${sectionColors[sec]}`}>{sectionNames[sec]}</p>
            {items.filter(i => i.section === sec).map(item => {
              const active = page === item.id;
              const Icon = item.icon;
              return (
                <button key={item.id} onClick={() => setPage(item.id)} className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all mb-0.5 ${active ? `bg-muted text-foreground` : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'}`}>
                  <Icon className={`w-4 h-4 ${active ? 'text-foreground' : ''}`} />
                  {item.label}
                  {active && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-current" />}
                </button>
              );
            })}
          </div>
        ))}
      </div>

      <div className="p-3 border-t border-border">
        <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg bg-muted">
          <Avatar className="w-7 h-7">
            <AvatarFallback className="text-[10px] bg-blue-500/20 text-blue-400">{userRole === 'admin' ? 'YR' : userRole === 'client' ? 'RR' : 'CM'}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-foreground truncate">{userRole === 'admin' ? 'Yoni R.' : userRole === 'client' ? 'Rapid Response' : 'Carlos M.'}</p>
            <p className="text-[10px] text-muted-foreground capitalize">{userRole}</p>
          </div>
        </div>
      </div>
    </aside>
  );
}

function Topbar({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <header className="h-14 bg-card border-b border-border flex items-center justify-between px-7 sticky top-0 z-10 shrink-0">
      <div>
        <h1 className="text-base font-bold text-foreground tracking-tight leading-none">{title}</h1>
        {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
      </div>
      {action && <div className="flex items-center gap-2">{action}</div>}
    </header>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 8. ROLE SELECTOR & MAIN APP
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function RoleSelector({ onSelect }: { onSelect: (role: UserRole) => void }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="max-w-4xl w-full">
        <div className="text-center mb-10">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center text-white font-black text-2xl shadow-lg shadow-blue-500/20 mx-auto mb-6">S</div>
          <h1 className="text-3xl font-extrabold tracking-tight mb-2">SEMSE OS</h1>
          <p className="text-muted-foreground">Selecciona tu rol para continuar</p>
        </div>

        <div className="grid grid-cols-3 gap-6">
          {[
            { role: 'worker', title: 'Trabajador', desc: 'Accede a tus trabajos, tareas, horas y evidencia', icon: HardHat, color: 'blue' },
            { role: 'client', title: 'Cliente', desc: 'Gestiona tus proyectos, pagos y aprobaciones', icon: Building, color: 'cyan' },
            { role: 'admin', title: 'Administrador', desc: 'Control total de operaciones, usuarios y finanzas', icon: UserCog, color: 'violet' },
          ].map(({ role, title, desc, icon: Icon, color }) => (
            <Card key={role} className="cursor-pointer hover:shadow-xl transition-all hover:-translate-y-1" onClick={() => onSelect(role as UserRole)}>
              <CardContent className="p-8 text-center">
                <div className={`w-16 h-16 rounded-2xl bg-${color}-500/10 flex items-center justify-center mx-auto mb-4`}>
                  <Icon className={`w-8 h-8 text-${color}-400`} />
                </div>
                <h3 className="text-xl font-bold mb-2">{title}</h3>
                <p className="text-sm text-muted-foreground">{desc}</p>
                <Button className={`mt-6 w-full`}>Continuar →</Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 9. PAGE CONFIG & RENDERER
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const PAGE_TITLES: Record<PageId, { title: string; subtitle?: string }> = {
  // Worker
  dashboard: { title: 'Inicio', subtitle: 'Resumen de tu actividad' },
  my_jobs: { title: 'Mis Trabajos', subtitle: 'Trabajos asignados' },
  my_tasks: { title: 'Mis Tareas', subtitle: 'Tareas pendientes y completadas' },
  time_tracker: { title: 'Registrar Horas', subtitle: 'Control de jornada laboral' },
  evidence_upload: { title: 'Evidencia', subtitle: 'Sube fotos y documentos' },
  materials: { title: 'Materiales', subtitle: 'Solicitud de materiales' },
  my_incidents: { title: 'Incidencias', subtitle: 'Reporta problemas' },
  my_payments: { title: 'Mis Pagos', subtitle: 'Historial de pagos' },
  profile: { title: 'Mi Perfil', subtitle: 'Información personal' },
  // Client
  client_dashboard: { title: 'Inicio', subtitle: 'Resumen de tus proyectos' },
  create_job: { title: 'Crear Trabajo', subtitle: 'Publica un nuevo trabajo' },
  my_projects: { title: 'Mis Proyectos', subtitle: 'Todos tus proyectos' },
  project_evidence: { title: 'Evidencia', subtitle: 'Fotos y documentos' },
  milestones: { title: 'Hitos', subtitle: 'Aprobación de hitos' },
  client_payments: { title: 'Pagos', subtitle: 'Gestión de pagos' },
  documents: { title: 'Documentos', subtitle: 'Contratos y facturas' },
  reviews: { title: 'Calificaciones', subtitle: 'Evalúa el servicio' },
  // Admin
  admin_dashboard: { title: 'Dashboard', subtitle: 'Visión global de operaciones' },
  operations: { title: 'Operaciones', subtitle: 'Gestión de trabajos y asignaciones' },
  all_jobs: { title: 'Todos los Trabajos', subtitle: 'Listado completo' },
  users: { title: 'Usuarios', subtitle: 'Trabajadores y clientes' },
  qa_center: { title: 'QA Center', subtitle: 'Control de calidad' },
  compliance: { title: 'Compliance', subtitle: 'Validación de documentos' },
  finance: { title: 'Finanzas', subtitle: 'Pagos y escrow' },
  disputes: { title: 'Disputas', subtitle: 'Resolución de conflictos' },
  admin_reports: { title: 'Reportes', subtitle: 'Métricas y análisis' },
  config: { title: 'Configuración', subtitle: 'Ajustes del sistema' },
  // Prometeo
  architecture: { title: 'Arquitectura', subtitle: '5 capas: UI → NestJS → PostgreSQL → RAG → Agentes' },
  prisma: { title: 'Schema Prisma', subtitle: 'Modelos de base de datos' },
  agents: { title: 'Agents Module', subtitle: 'Orquestador de IA' },
  api: { title: 'API Contracts', subtitle: 'Endpoints REST' },
  cortex: { title: 'Cortex MLOps', subtitle: 'Monitoreo de modelos' },
  trust: { title: 'TrustEngine', subtitle: 'Scoring de confianza' },
  matrix: { title: 'Matriz de Conocimientos', subtitle: 'Roadmap técnico' },
  permissions: { title: 'Matriz de Permisos', subtitle: 'RBAC por grupo' },
};

function PageRenderer({ page, userRole }: { page: PageId; userRole: UserRole }) {
  // Worker pages
  if (page === 'dashboard' && userRole === 'worker') return <WorkerDashboard />;
  if (page === 'time_tracker') return <WorkerTimeTracker />;
  if (page === 'evidence_upload') return <WorkerEvidenceUpload />;
  if (['my_jobs', 'my_tasks', 'materials', 'my_incidents', 'my_payments', 'profile'].includes(page)) {
    return <div className="p-8 text-center text-muted-foreground"><Package className="w-12 h-12 mx-auto mb-4 opacity-50" /><p>{page.replace('_', ' ')} — Implementación completa</p></div>;
  }
  
  // Client pages
  if (page === 'client_dashboard') return <ClientDashboard />;
  if (page === 'create_job') return <ClientCreateJob />;
  if (['my_projects', 'project_evidence', 'milestones', 'client_payments', 'documents', 'reviews'].includes(page)) {
    return <div className="p-8 text-center text-muted-foreground"><FolderKanban className="w-12 h-12 mx-auto mb-4 opacity-50" /><p>{page.replace('_', ' ')} — Implementación completa</p></div>;
  }
  
  // Admin pages
  if (page === 'admin_dashboard') return <AdminDashboard />;
  if (page === 'operations') return <AdminOperations />;
  if (page === 'users') return <AdminUsers />;
  if (['all_jobs', 'qa_center', 'compliance', 'finance', 'disputes', 'admin_reports', 'config'].includes(page)) {
    return <div className="p-8 text-center text-muted-foreground"><LayoutDashboard className="w-12 h-12 mx-auto mb-4 opacity-50" /><p>{page.replace('_', ' ')} — Implementación completa</p></div>;
  }
  
  // Prometeo pages
  return <div className="p-8 text-center text-muted-foreground"><Network className="w-12 h-12 mx-auto mb-4 opacity-50" /><p>{page} — Documentación técnica</p></div>;
}

function SEMSEOSInner({ onBack }: { onBack?: () => void }) {
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [page, setPage] = useState<PageId>('dashboard');

  if (!userRole) {
    return <RoleSelector onSelect={setUserRole} />;
  }

  // Set default page based on role
  const defaultPage: PageId = userRole === 'worker' ? 'dashboard' : userRole === 'client' ? 'client_dashboard' : 'admin_dashboard';
  const currentPage = page === 'dashboard' && userRole !== 'worker' ? defaultPage : page;
  
  const cfg = PAGE_TITLES[currentPage];

  const topbarAction = (
    <div className="flex items-center gap-2">
      <Button variant="ghost" size="sm" onClick={() => setUserRole(null)} className="text-xs text-muted-foreground hover:text-foreground">
        <LogOut className="w-4 h-4 mr-1" /> Cambiar rol
      </Button>
      {onBack && (
        <Button variant="ghost" size="sm" onClick={onBack} className="text-xs text-muted-foreground hover:text-foreground">
          ← Volver al sitio
        </Button>
      )}
    </div>
  );

  return (
    <div className="flex min-h-screen">
      <Sidebar page={currentPage} setPage={setPage} userRole={userRole} />
      <div className="ml-[260px] flex-1 flex flex-col min-h-screen">
        <Topbar title={cfg.title} subtitle={cfg.subtitle} action={topbarAction} />
        <main className="flex-1 p-7 overflow-x-hidden">
          <PageRenderer page={currentPage} userRole={userRole} />
        </main>
      </div>
    </div>
  );
}

export function SEMSEOS({ onBack }: { onBack?: () => void }) {
  return (
    <ToastProvider>
      <SEMSEOSInner onBack={onBack} />
    </ToastProvider>
  );
}

export default SEMSEOS;
