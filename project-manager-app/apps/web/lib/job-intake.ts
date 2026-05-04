export type JobLocationType = "remote" | "on_site" | "hybrid";
export type JobBudgetType = "fixed" | "range" | "hourly";

export type JobCategory = {
  id: string;
  name: string;
  subcategories: Array<{
    id: string;
    name: string;
    basePrice: number;
  }>;
};

export type JobUrgencyOption = {
  value: string;
  label: string;
  description: string;
  color: string;
};

type SearchParamsLike = {
  get(name: string): string | null;
};

export type JobIntakePrefill = {
  source: string | null;
  categoryId: string;
  subcategoryId: string;
  title: string;
  description: string;
  locationType: JobLocationType;
  city: string;
  budgetType: JobBudgetType;
  budgetMin: number;
  budgetMax: number;
  urgency: string;
  deadline: string;
  step: number | null;
  preferredProfessionalUserId: string;
  preferredProfessionalName: string;
  preferredProfessionalSlug: string;
};

export const JOB_CATEGORIES: JobCategory[] = [
  {
    id: "plomeria", name: "Plomería", subcategories: [
      { id: "reparacion", name: "Reparación de fugas", basePrice: 80 },
      { id: "instalacion", name: "Instalación sanitaria", basePrice: 150 },
      { id: "destapado", name: "Destapado de cañerías", basePrice: 60 },
    ],
  },
  {
    id: "electricidad", name: "Electricidad", subcategories: [
      { id: "instalacion_elec", name: "Instalación eléctrica", basePrice: 120 },
      { id: "panel", name: "Actualización de panel", basePrice: 300 },
      { id: "iluminacion", name: "Instalación de iluminación", basePrice: 90 },
    ],
  },
  {
    id: "pintura", name: "Pintura", subcategories: [
      { id: "interior", name: "Pintura interior", basePrice: 200 },
      { id: "exterior", name: "Pintura exterior", basePrice: 350 },
      { id: "decorativa", name: "Pintura decorativa", basePrice: 180 },
    ],
  },
  {
    id: "pisos", name: "Pisos", subcategories: [
      { id: "instalacion_piso", name: "Instalación de pisos", basePrice: 250 },
      { id: "pulido", name: "Pulido y restauración", basePrice: 180 },
      { id: "ceramica", name: "Cerámica y azulejos", basePrice: 200 },
    ],
  },
  {
    id: "carpinteria", name: "Carpintería", subcategories: [
      { id: "muebles", name: "Muebles a medida", basePrice: 400 },
      { id: "puertas", name: "Puertas y ventanas", basePrice: 250 },
      { id: "remodelacion", name: "Remodelación general", basePrice: 500 },
    ],
  },
  {
    id: "jardineria", name: "Jardinería", subcategories: [
      { id: "mantenimiento", name: "Mantenimiento regular", basePrice: 80 },
      { id: "diseno", name: "Diseño de jardín", basePrice: 300 },
      { id: "poda", name: "Poda de árboles", basePrice: 120 },
    ],
  },
];

export const JOB_URGENCY_OPTIONS: JobUrgencyOption[] = [
  { value: "low", label: "Baja", description: "Sin prisa, flexible", color: "#10b981" },
  { value: "medium", label: "Media", description: "En las próximas semanas", color: "#f59e0b" },
  { value: "high", label: "Alta", description: "Esta semana", color: "#f97316" },
  { value: "urgent", label: "Urgente", description: "Lo antes posible", color: "#ef4444" },
];

function readText(params: SearchParamsLike | null | undefined, key: string): string {
  return params?.get(key)?.trim() ?? "";
}

function readInt(params: SearchParamsLike | null | undefined, key: string, fallback: number): number {
  const raw = params?.get(key);
  if (!raw) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function parseJobIntakePrefill(params: SearchParamsLike | null | undefined): JobIntakePrefill {
  const locationType = readText(params, "locationType");
  const budgetType = readText(params, "budgetType");
  const min = readInt(params, "budgetMin", 500);
  const max = readInt(params, "budgetMax", Math.max(2000, min));
  const stepValue = readInt(params, "step", 0);

  return {
    source: readText(params, "source") || null,
    categoryId: readText(params, "category"),
    subcategoryId: readText(params, "subcategory"),
    title: readText(params, "title"),
    description: readText(params, "description"),
    locationType: locationType === "remote" || locationType === "hybrid" ? locationType : "on_site",
    city: readText(params, "city"),
    budgetType: budgetType === "fixed" || budgetType === "hourly" ? budgetType : "range",
    budgetMin: min,
    budgetMax: max >= min ? max : min,
    urgency: readText(params, "urgency") || "medium",
    deadline: readText(params, "deadline"),
    step: stepValue >= 1 && stepValue <= 4 ? stepValue : null,
    preferredProfessionalUserId: readText(params, "preferredUserId"),
    preferredProfessionalName: readText(params, "preferredName"),
    preferredProfessionalSlug: readText(params, "preferredSlug"),
  };
}

export function computeInitialJobWizardStep(prefill: JobIntakePrefill): number {
  if (prefill.step) return prefill.step;
  if (!prefill.categoryId || !prefill.subcategoryId) return 1;
  if (prefill.title.length < 5 || prefill.description.length < 20) return 2;
  return 3;
}

export function buildJobIntakeHref(prefill: Partial<JobIntakePrefill>): string {
  const qs = new URLSearchParams();

  const setIf = (key: string, value: string | number | null | undefined) => {
    if (value == null) return;
    const text = typeof value === "number" ? String(value) : value.trim();
    if (text) qs.set(key, text);
  };

  setIf("source", prefill.source ?? "landing");
  setIf("category", prefill.categoryId);
  setIf("subcategory", prefill.subcategoryId);
  setIf("title", prefill.title);
  setIf("description", prefill.description);
  setIf("locationType", prefill.locationType);
  setIf("city", prefill.city);
  setIf("budgetType", prefill.budgetType);
  setIf("budgetMin", prefill.budgetMin);
  setIf("budgetMax", prefill.budgetMax);
  setIf("urgency", prefill.urgency);
  setIf("deadline", prefill.deadline);
  setIf("step", prefill.step ?? 3);
  setIf("preferredUserId", prefill.preferredProfessionalUserId);
  setIf("preferredName", prefill.preferredProfessionalName);
  setIf("preferredSlug", prefill.preferredProfessionalSlug);

  const query = qs.toString();
  return query ? `/client/jobs/new?${query}` : "/client/jobs/new";
}
