import type { JobRecord } from '../../../core/api/jobs.api';

export const JOB_STATUS_OPTIONS = [
  { value: 'posted', label: 'Publicado' },
  { value: 'reserved', label: 'Reservado' },
  { value: 'accepted', label: 'Aceptado' },
  { value: 'in_progress', label: 'En progreso' },
  { value: 'review', label: 'Revision' },
  { value: 'completed', label: 'Completado' },
] as const;

const JOB_STATUS_LABELS: Record<string, string> = {
  posted: 'Publicado',
  reserved: 'Reservado',
  accepted: 'Aceptado',
  in_progress: 'En progreso',
  review: 'Revision',
  completed: 'Completado',
  cancelled: 'Cancelado',
  dispute: 'Disputa',
};

const JOB_STATUS_BACKGROUNDS: Record<string, string> = {
  posted: 'rgba(59, 130, 246, 0.12)',
  reserved: 'rgba(245, 158, 11, 0.14)',
  accepted: 'rgba(139, 92, 246, 0.14)',
  in_progress: 'rgba(6, 182, 212, 0.14)',
  review: 'rgba(245, 158, 11, 0.14)',
  completed: 'rgba(16, 185, 129, 0.14)',
  cancelled: 'rgba(148, 163, 184, 0.12)',
  dispute: 'rgba(239, 68, 68, 0.12)',
};

const JOB_STATUS_COLORS: Record<string, string> = {
  posted: '#3b82f6',
  reserved: '#f59e0b',
  accepted: '#8b5cf6',
  in_progress: '#06b6d4',
  review: '#f59e0b',
  completed: '#10b981',
  cancelled: '#94a3b8',
  dispute: '#ef4444',
};

export function jobBudgetLabel(job: Pick<JobRecord, 'budgetMin' | 'budgetMax'>): string {
  if (job.budgetMin != null && job.budgetMax != null) {
    return `$${job.budgetMin.toLocaleString()} - $${job.budgetMax.toLocaleString()}`;
  }
  if (job.budgetMin != null) {
    return `Desde $${job.budgetMin.toLocaleString()}`;
  }
  return 'Sin presupuesto';
}

export function jobStatusLabel(status: string): string {
  return JOB_STATUS_LABELS[status] ?? status;
}

export function jobStatusBg(status: string): string {
  return JOB_STATUS_BACKGROUNDS[status] ?? 'rgba(148, 163, 184, 0.12)';
}

export function jobStatusColor(status: string): string {
  return JOB_STATUS_COLORS[status] ?? '#94a3b8';
}
