// Onboarding público de workers — cliente BFF (/api/semse/public/*)

export type WorkerOpening = {
  id: string;
  title: string;
  category: string | null;
  scope: string;
  status: string;
  budgetMin: number | null;
  budgetMax: number | null;
  location: string | null;
  urgency: string | null;
};

export type WorkerApplicationInput = {
  fullName: string;
  email: string;
  phone?: string;
  city?: string;
  trade: string;
  yearsExperience?: number;
  message?: string;
  proposedRate?: number;
  jobId?: string;
};

export type WorkerApplicationReceipt = {
  applicationId: string;
  status: string;
  trade: string;
  jobId: string | null;
  createdAt: string;
};

async function fetchPublic<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, init);
  const json = await response.json().catch(() => ({})) as { data?: T; error?: { message?: unknown } };
  if (!response.ok) {
    const message = typeof json.error?.message === "string"
      ? json.error.message
      : "No se pudo completar la solicitud.";
    throw new Error(message);
  }
  return json.data as T;
}

export async function fetchWorkerOpenings(limit = 12): Promise<WorkerOpening[]> {
  return fetchPublic<WorkerOpening[]>(`/api/semse/public/worker-openings?limit=${limit}`);
}

export async function fetchWorkerOpening(id: string): Promise<WorkerOpening> {
  return fetchPublic<WorkerOpening>(`/api/semse/public/worker-openings/${encodeURIComponent(id)}`);
}

export async function submitWorkerApplication(input: WorkerApplicationInput): Promise<WorkerApplicationReceipt> {
  return fetchPublic<WorkerApplicationReceipt>("/api/semse/public/worker-apply", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
}

export const TRADE_OPTIONS: { value: string; label: string }[] = [
  { value: "general", label: "Ayudante general / múltiples oficios" },
  { value: "electrical", label: "Electricidad" },
  { value: "plumbing", label: "Plomería" },
  { value: "painting", label: "Pintura" },
  { value: "drywall", label: "Drywall / Tablaroca" },
  { value: "carpentry", label: "Carpintería" },
  { value: "flooring", label: "Pisos" },
  { value: "roofing", label: "Techos" },
  { value: "hvac", label: "Aire acondicionado / HVAC" },
  { value: "masonry", label: "Albañilería" },
  { value: "tile", label: "Azulejo / Loseta" },
  { value: "landscaping", label: "Jardinería / Exteriores" },
  { value: "cleaning", label: "Limpieza profesional" },
  { value: "welding", label: "Herrería / Soldadura" },
];

export const URGENCY_LABELS: Record<string, string> = {
  urgent: "Urgente",
  urgente: "Urgente",
  high: "Alta",
  alta: "Alta",
  medium: "Media",
  standard: "Estándar",
  "estándar": "Estándar",
  low: "Flexible",
};

export function formatBudgetRange(min: number | null, max: number | null): string {
  const format = (value: number) => `$${value.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
  if (min != null && max != null) return `${format(min)} – ${format(max)}`;
  if (min != null) return `Desde ${format(min)}`;
  if (max != null) return `Hasta ${format(max)}`;
  return "A convenir";
}
