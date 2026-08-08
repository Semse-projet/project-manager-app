import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, ChevronRight, DollarSign, MapPin, Search } from 'lucide-react';
import { useWorkerJobs } from '@/hooks/useWorkerJobs';
import type { WorkerJob } from '@/domains/worker/jobs/types';

type Tab = 'todos' | 'activos' | 'completados' | 'oportunidades';

const TABS: { id: Tab; label: string }[] = [
  { id: 'todos', label: 'Todos' },
  { id: 'activos', label: 'Activos' },
  { id: 'completados', label: 'Completados' },
  { id: 'oportunidades', label: 'Oportunidades' },
];

const ACTIVE_RAW = new Set(['ACCEPTED', 'IN_PROGRESS', 'REVIEW', 'RESERVED']);
const COMPLETED_RAW = new Set(['COMPLETED']);
const OPPORTUNITY_RAW = new Set(['POSTED', 'PUBLISHED']);
const DISPUTE_RAW = new Set(['DISPUTE']);

const STATUS_LABEL: Record<string, string> = {
  IN_PROGRESS:  'En progreso',
  REVIEW:       'En revision',
  ACCEPTED:     'Aceptado',
  RESERVED:     'Reservado',
  DISPUTE:      'En disputa',
  COMPLETED:    'Completado',
  POSTED:       'Publicado',
  PUBLISHED:    'Publicado',
  DRAFT:        'Borrador',
  CANCELLED:    'Cancelado',
};

const STATUS_CLASS: Record<string, string> = {
  IN_PROGRESS: 'bg-[#0D7377]/10 text-[#0D7377]',
  REVIEW:      'bg-amber-50 text-amber-700',
  ACCEPTED:    'bg-emerald-50 text-emerald-700',
  RESERVED:    'bg-emerald-50 text-emerald-700',
  DISPUTE:     'bg-red-50 text-red-700',
  COMPLETED:   'bg-gray-100 text-gray-600',
  POSTED:      'bg-blue-50 text-blue-600',
  PUBLISHED:   'bg-blue-50 text-blue-600',
  DRAFT:       'bg-gray-100 text-gray-500',
  CANCELLED:   'bg-gray-100 text-gray-500',
};

const NEXT_ACTION: Record<string, string> = {
  RESERVED:    'Acepta el trabajo para confirmar tu lugar.',
  ACCEPTED:    'Espera a que el cliente fondee el escrow y luego comienza.',
  IN_PROGRESS: 'Avanza el milestone y sube evidencia cuando termines.',
  REVIEW:      'El cliente esta revisando tu entrega. Espera aprobacion.',
  DISPUTE:     'Hay una disputa activa. Aporta evidencia si la tienes.',
  COMPLETED:   'Trabajo cerrado. Puedes pedir calificacion al cliente.',
};

function matchTab(job: WorkerJob, tab: Tab): boolean {
  const rs = job.rawStatus ?? '';
  if (tab === 'activos') return ACTIVE_RAW.has(rs);
  if (tab === 'completados') return COMPLETED_RAW.has(rs);
  if (tab === 'oportunidades') return OPPORTUNITY_RAW.has(rs);
  return true;
}

function formatMoney(value: number) {
  return new Intl.NumberFormat('es-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);
}

export default function Trabajos() {
  const navigate = useNavigate();
  const { jobs, loading } = useWorkerJobs();
  const [tab, setTab] = useState<Tab>('todos');
  const [searchQuery, setSearchQuery] = useState('');

  const filtered = jobs.filter((job) => {
    if (!matchTab(job, tab)) return false;
    if (searchQuery && !job.title.toLowerCase().includes(searchQuery.toLowerCase()) && !job.description.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  const disputeCount = jobs.filter((job) => DISPUTE_RAW.has(job.rawStatus ?? '')).length;

  return (
    <div className="min-h-screen bg-[#F5F7FA]">
      {disputeCount > 0 && (
        <div className="px-4 pt-3">
          <button
            onClick={() => navigate('/disputas')}
            className="flex w-full items-center gap-3 rounded-xl border border-red-200 bg-red-50 p-3"
          >
            <AlertTriangle className="h-4 w-4 shrink-0 text-red-500" />
            <p className="flex-1 text-left text-xs font-semibold text-red-700">
              {disputeCount} trabajo{disputeCount > 1 ? 's' : ''} con disputa activa — Aporta evidencia
            </p>
            <ChevronRight className="h-4 w-4 shrink-0 text-red-400" />
          </button>
        </div>
      )}

      {/* Search */}
      <div className="px-4 pt-3 pb-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#8B9DAB]" />
          <input
            type="text"
            placeholder="Buscar trabajos..."
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            className="h-11 w-full rounded-xl border border-gray-100 bg-white pl-10 pr-4 text-sm text-[#1A2B3C] placeholder:text-[#8B9DAB] focus:border-[#0D7377] focus:outline-none focus:ring-2 focus:ring-[#0D7377]/10"
          />
        </div>
      </div>

      {/* Tabs */}
      <div className="overflow-x-auto px-4 py-2">
        <div className="flex gap-2 pb-1">
          {TABS.map((filter) => (
            <button
              key={filter.id}
              onClick={() => setTab(filter.id)}
              className={`shrink-0 rounded-full px-4 py-2 text-xs font-semibold transition-colors ${
                tab === filter.id ? 'bg-[#0D7377] text-white' : 'border border-gray-200 bg-white text-[#5A6B7D]'
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      <div className="space-y-2.5 px-4 py-2 pb-8">
        {loading ? (
          [1, 2, 3].map((n) => <div key={n} className="h-24 animate-pulse rounded-xl bg-white shadow-sm" />)
        ) : filtered.length === 0 ? (
          <div className="rounded-xl bg-white p-8 text-center shadow-sm">
            <p className="text-sm font-medium text-[#1A2B3C]">
              {jobs.length === 0 ? 'Aun no tienes trabajos asignados.' : 'Sin resultados para este filtro.'}
            </p>
          </div>
        ) : (
          filtered.map((job) => {
            const rs = job.rawStatus ?? '';
            const badgeClass = STATUS_CLASS[rs] ?? 'bg-gray-100 text-gray-600';
            const badgeLabel = STATUS_LABEL[rs] ?? rs.toLowerCase();
            const nextAction = NEXT_ACTION[rs] ?? null;
            const isDispute = DISPUTE_RAW.has(rs);

            return (
              <button
                key={job.id}
                onClick={() => navigate(`/trabajo/${job.id}`)}
                className={`w-full rounded-xl bg-white p-4 text-left shadow-sm active:scale-[0.98] transition-transform ${isDispute ? 'border border-red-200' : ''}`}
              >
                <div className="mb-2 flex items-center justify-between">
                  <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${badgeClass}`}>
                    {badgeLabel}
                  </span>
                  <span className="text-[10px] text-[#8B9DAB]">{job.date}</span>
                </div>

                <h3 className="text-sm font-semibold text-[#1A2B3C]">{job.title}</h3>
                <p className="mt-0.5 text-xs text-[#5A6B7D]">{job.client}</p>

                {nextAction && (
                  <p className={`mt-1.5 text-[11px] font-semibold ${isDispute ? 'text-red-600' : 'text-amber-600'}`}>
                    ▶ {nextAction}
                  </p>
                )}

                {rs === 'IN_PROGRESS' && job.progress > 0 && (
                  <div className="mt-3">
                    <div className="mb-1 flex items-center justify-between">
                      <span className="text-[10px] text-[#8B9DAB]">Progreso</span>
                      <span className="text-[10px] font-medium text-[#0D7377]">{job.progress}%</span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
                      <div
                        className="h-full rounded-full bg-[#0D7377] transition-all duration-500"
                        style={{ width: `${job.progress}%` }}
                      />
                    </div>
                  </div>
                )}

                <div className="mt-3 flex items-center justify-between border-t border-gray-50 pt-2.5">
                  <div className="flex items-center gap-2">
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[#0D7377]/10">
                      <span className="text-[10px] font-bold text-[#0D7377]">{job.supervisor.name.charAt(0)}</span>
                    </div>
                    <span className="text-xs text-[#5A6B7D]">{job.supervisor.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {job.budgetMin !== undefined && (
                      <div className="flex items-center gap-0.5 text-xs font-semibold text-[#1A2B3C]">
                        <DollarSign className="h-3 w-3 text-[#0D7377]" />
                        {job.budgetMax ? `${formatMoney(job.budgetMin)}–${formatMoney(job.budgetMax)}` : formatMoney(job.budgetMin)}
                      </div>
                    )}
                    <div className="flex items-center gap-0.5">
                      <MapPin className="h-3 w-3 text-[#8B9DAB]" />
                      <ChevronRight className="h-4 w-4 text-[#8B9DAB]" />
                    </div>
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
