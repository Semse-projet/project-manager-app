import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowRight,
  Briefcase,
  Camera,
  CheckSquare,
  Clock,
  CreditCard,
  DollarSign,
  MapPin,
  Package,
  Scale,
  Search,
  Star,
  Wallet,
  Wrench,
} from 'lucide-react';
import { useWorkerJobs } from '@/hooks/useWorkerJobs';
import { useWorkerProfile } from '@/hooks/useWorkerProfile';

function formatMoney(value: number) {
  return new Intl.NumberFormat('es-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);
}

const ACTIVE_RAW = new Set(['ACCEPTED', 'IN_PROGRESS', 'REVIEW', 'RESERVED']);
const REVIEW_RAW = new Set(['REVIEW']);
const DISPUTE_RAW = new Set(['DISPUTE']);
const OPPORTUNITY_RAW = new Set(['POSTED', 'PUBLISHED']);
const COMPLETED_RAW = new Set(['COMPLETED']);

export default function Dashboard() {
  const navigate = useNavigate();
  const { jobs, loading } = useWorkerJobs();
  const { profile } = useWorkerProfile();

  const metrics = useMemo(() => {
    const active = jobs.filter((job) => ACTIVE_RAW.has(job.rawStatus ?? ''));
    const review = jobs.filter((job) => REVIEW_RAW.has(job.rawStatus ?? ''));
    const disputes = jobs.filter((job) => DISPUTE_RAW.has(job.rawStatus ?? ''));
    const opportunities = jobs.filter((job) => OPPORTUNITY_RAW.has(job.rawStatus ?? ''));
    const completed = jobs.filter((job) => COMPLETED_RAW.has(job.rawStatus ?? ''));
    const activeBudget = active.reduce((total, job) => total + (job.budgetMin ?? 0), 0);
    const completionRate = jobs.length > 0 ? Math.round((completed.length / jobs.length) * 100) : 0;
    const reviewRate = active.length > 0 ? Math.round((review.length / active.length) * 100) : 0;

    return { active, review, disputes, opportunities, completed, activeBudget, completionRate, reviewRate };
  }, [jobs]);

  const greeting = profile?.name.split(' ')[0] ?? 'Hola';

  const statCards = [
    { label: 'Activos', value: metrics.active.length, color: 'text-[#0D7377]', bg: 'bg-teal-50', icon: Briefcase, path: '/trabajos' },
    { label: 'Completados', value: metrics.completed.length, color: 'text-emerald-500', bg: 'bg-emerald-50', icon: CheckSquare, path: '/trabajos' },
    { label: 'En revision', value: metrics.review.length, color: 'text-amber-500', bg: 'bg-amber-50', icon: Star, path: '/trabajos' },
    { label: 'Disputas', value: metrics.disputes.length, color: 'text-red-500', bg: 'bg-red-50', icon: AlertTriangle, path: '/disputas' },
  ];

  const quickActions = [
    { label: 'Evidencias', icon: Camera, path: '/evidencias', color: '#0D7377' },
    { label: 'Tareas', icon: CheckSquare, path: '/tareas', color: '#f59e0b' },
    { label: 'Tracker', icon: Clock, path: '/tracker', color: '#06b6d4' },
    { label: 'Pagos', icon: CreditCard, path: '/pagos', color: '#10b981' },
    { label: 'Materiales', icon: Package, path: '/materiales', color: '#f59e0b' },
    { label: 'Incidentes', icon: AlertTriangle, path: '/incidentes', color: '#ef4444' },
    { label: 'Field Ops', icon: Wrench, path: '/field-ops', color: '#a78bfa' },
    { label: 'Viajes', icon: Wallet, path: '/viajes', color: '#7c3aed' },
  ];

  return (
    <div className="min-h-screen bg-[#F5F7FA]">
      {/* Greeting */}
      <div className="px-4 pt-4 pb-2">
        <div className="rounded-2xl bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-[#8B9DAB]">Bienvenido, {greeting}</p>
              <p className="mt-0.5 text-sm font-semibold text-[#1A2B3C]">Resumen operativo del dia</p>
            </div>
            {metrics.disputes.length > 0 && (
              <button
                onClick={() => navigate('/disputas')}
                className="flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-bold text-red-600"
              >
                <Scale className="h-3.5 w-3.5" />
                {metrics.disputes.length} disputa{metrics.disputes.length > 1 ? 's' : ''}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* KPI grid */}
      <div className="px-4 py-2">
        <div className="grid grid-cols-4 gap-2">
          {statCards.map((stat) => {
            const Icon = stat.icon;
            return (
              <button
                key={stat.label}
                onClick={() => navigate(stat.path)}
                className="flex flex-col items-center gap-1.5 rounded-xl bg-white p-3 shadow-sm active:scale-95 transition-transform"
              >
                <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${stat.bg}`}>
                  <Icon className={`h-4 w-4 ${stat.color}`} />
                </div>
                <span className="text-lg font-bold leading-tight text-[#1A2B3C]">
                  {loading ? '—' : stat.value}
                </span>
                <span className="text-[10px] font-medium text-[#8B9DAB]">{stat.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Pipeline summary */}
      <div className="px-4 py-2">
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-xl bg-blue-50 border border-blue-100 p-4">
            <p className="text-[10px] uppercase tracking-wide text-blue-500">Oportunidades</p>
            <p className="mt-2 text-2xl font-bold text-blue-700">{loading ? '—' : metrics.opportunities.length}</p>
            <p className="mt-1 text-[11px] text-blue-500">trabajos publicados</p>
          </div>
          <div className="rounded-xl bg-orange-50 border border-orange-100 p-4">
            <p className="text-[10px] uppercase tracking-wide text-orange-500">Presupuesto activo</p>
            <p className="mt-2 text-xl font-bold text-orange-700">
              {loading ? '—' : metrics.activeBudget > 0 ? formatMoney(metrics.activeBudget) : '$0'}
            </p>
            <p className="mt-1 text-[11px] text-orange-500">cartera en ejecucion</p>
          </div>
          <div className="rounded-xl bg-emerald-50 border border-emerald-100 p-4">
            <p className="text-[10px] uppercase tracking-wide text-emerald-500">Tasa de cierre</p>
            <p className="mt-2 text-2xl font-bold text-emerald-700">{loading ? '—' : `${metrics.completionRate}%`}</p>
            <p className="mt-1 text-[11px] text-emerald-500">trabajos completados</p>
          </div>
          <div className="rounded-xl bg-amber-50 border border-amber-100 p-4">
            <p className="text-[10px] uppercase tracking-wide text-amber-500">Carga en revision</p>
            <p className="mt-2 text-2xl font-bold text-amber-700">{loading ? '—' : `${metrics.reviewRate}%`}</p>
            <p className="mt-1 text-[11px] text-amber-500">de activos en review</p>
          </div>
        </div>
      </div>

      {/* Active jobs section */}
      <div className="px-4 py-2">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-[#1A2B3C]">Trabajos en curso</h2>
          <button onClick={() => navigate('/trabajos')} className="flex items-center gap-1 text-xs font-semibold text-[#0D7377]">
            Ver todos <ArrowRight className="h-3 w-3" />
          </button>
        </div>

        {loading ? (
          <div className="space-y-2">
            {[1, 2].map((n) => <div key={n} className="h-20 rounded-xl bg-white animate-pulse shadow-sm" />)}
          </div>
        ) : metrics.active.length === 0 ? (
          <div className="rounded-xl bg-white p-6 text-center shadow-sm">
            <Briefcase className="mx-auto mb-2 h-8 w-8 text-gray-200" />
            <p className="text-sm font-medium text-[#1A2B3C]">No hay trabajos activos</p>
            <p className="mt-1 text-xs text-[#8B9DAB]">Cuando aceptes o reserves trabajos apareceran aqui.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {metrics.active.slice(0, 3).map((job) => (
              <button
                key={job.id}
                onClick={() => navigate(`/trabajo/${job.id}`)}
                className="w-full rounded-xl bg-white p-4 text-left shadow-sm active:scale-[0.98] transition-transform"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex items-center gap-2">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                        job.rawStatus === 'REVIEW' ? 'bg-amber-50 text-amber-700'
                        : job.rawStatus === 'IN_PROGRESS' ? 'bg-[#0D7377]/10 text-[#0D7377]'
                        : 'bg-blue-50 text-blue-600'
                      }`}>
                        {job.rawStatus === 'REVIEW' ? 'En revision'
                          : job.rawStatus === 'IN_PROGRESS' ? 'En progreso'
                          : job.rawStatus === 'ACCEPTED' ? 'Aceptado'
                          : 'Reservado'}
                      </span>
                      <span className="text-[10px] text-[#8B9DAB]">{job.date}</span>
                    </div>
                    <h3 className="truncate text-sm font-semibold text-[#1A2B3C]">{job.title}</h3>
                    <p className="mt-0.5 text-xs text-[#5A6B7D]">{job.client}</p>
                  </div>
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-50">
                    <MapPin className="h-4 w-4 text-[#8B9DAB]" />
                  </div>
                </div>
                {job.budgetMin !== undefined && (
                  <div className="mt-2 flex items-center gap-1 text-xs text-[#5A6B7D]">
                    <DollarSign className="h-3 w-3" />
                    <span>
                      {job.budgetMax ? `${formatMoney(job.budgetMin)} – ${formatMoney(job.budgetMax)}` : formatMoney(job.budgetMin)}
                    </span>
                  </div>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Opportunities section */}
      {!loading && metrics.opportunities.length > 0 && (
        <div className="px-4 py-2">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-[#1A2B3C]">Oportunidades abiertas</h2>
            <button onClick={() => navigate('/trabajos')} className="flex items-center gap-1 text-xs font-semibold text-[#0D7377]">
              Explorar <Search className="h-3 w-3" />
            </button>
          </div>
          <div className="space-y-2">
            {metrics.opportunities.slice(0, 2).map((job) => (
              <button
                key={job.id}
                onClick={() => navigate(`/trabajo/${job.id}`)}
                className="w-full rounded-xl bg-white p-4 text-left shadow-sm active:scale-[0.98] transition-transform"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <span className="mb-1 inline-block rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-600">Publicado</span>
                    <h3 className="truncate text-sm font-semibold text-[#1A2B3C]">{job.title}</h3>
                    {job.budgetMin !== undefined && (
                      <p className="mt-0.5 text-xs text-[#5A6B7D]">
                        {job.budgetMax ? `${formatMoney(job.budgetMin)} – ${formatMoney(job.budgetMax)}` : formatMoney(job.budgetMin)}
                      </p>
                    )}
                  </div>
                  <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-[#8B9DAB]" />
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Quick actions */}
      <div className="px-4 py-3 pb-8">
        <h2 className="mb-3 text-sm font-semibold text-[#1A2B3C]">Accesos rapidos</h2>
        <div className="grid grid-cols-2 gap-2">
          {quickActions.map((action) => {
            const Icon = action.icon;
            return (
              <button
                key={action.label}
                onClick={() => navigate(action.path)}
                className="flex items-center gap-3 rounded-xl bg-white p-4 shadow-sm active:scale-[0.97] transition-transform"
              >
                <div
                  className="flex h-10 w-10 items-center justify-center rounded-lg"
                  style={{ background: `${action.color}18` }}
                >
                  <Icon className="h-5 w-5" style={{ color: action.color }} />
                </div>
                <span className="text-sm font-medium text-[#1A2B3C]">{action.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
