export const LEAD_STATUS_OPTIONS = [
  { value: 'new', label: 'Nuevo' },
  { value: 'contacted', label: 'Contactado' },
  { value: 'estimate_sent', label: 'Estimado enviado' },
  { value: 'estimate_approved', label: 'Estimado aprobado' },
  { value: 'in_progress', label: 'En progreso' },
  { value: 'completed', label: 'Completado' },
  { value: 'lost', label: 'Perdido' },
] as const;

const LEAD_STATUS_LABELS: Record<string, string> = {
  new: 'Nuevo',
  contacted: 'Contactado',
  estimate_sent: 'Estimado enviado',
  estimate_approved: 'Estimado aprobado',
  in_progress: 'En progreso',
  completed: 'Completado',
  lost: 'Perdido',
};

const LEAD_STATUS_BACKGROUNDS: Record<string, string> = {
  new: 'rgba(59, 130, 246, 0.12)',
  contacted: 'rgba(139, 92, 246, 0.14)',
  estimate_sent: 'rgba(245, 158, 11, 0.14)',
  estimate_approved: 'rgba(16, 185, 129, 0.14)',
  in_progress: 'rgba(6, 182, 212, 0.14)',
  completed: 'rgba(16, 185, 129, 0.14)',
  lost: 'rgba(239, 68, 68, 0.12)',
};

const LEAD_STATUS_COLORS: Record<string, string> = {
  new: '#3b82f6',
  contacted: '#8b5cf6',
  estimate_sent: '#f59e0b',
  estimate_approved: '#10b981',
  in_progress: '#06b6d4',
  completed: '#10b981',
  lost: '#ef4444',
};

export function leadStatusLabel(status: string): string {
  return LEAD_STATUS_LABELS[status] ?? status;
}

export function leadStatusBg(status: string): string {
  return LEAD_STATUS_BACKGROUNDS[status] ?? 'rgba(148, 163, 184, 0.12)';
}

export function leadStatusColor(status: string): string {
  return LEAD_STATUS_COLORS[status] ?? '#94a3b8';
}
