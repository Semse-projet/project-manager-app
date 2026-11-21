import type { WorkspaceRole } from "./workspace-model";

/** Fields observed in the existing Jobs/Bids BFF. Currency is optional because
 * neither current contract supplies it; never infer it from locale or role. */
export type BudgetJob = {
  id: string;
  title: string;
  status?: string;
  location?: string;
  budgetMin?: number;
  budgetMax?: number;
  currency?: string;
};

export type BudgetBid = {
  id: string;
  jobId: string;
  amount?: number;
  etaDays?: number;
  note?: string | null;
  status: string;
  proEmail?: string;
  createdAt?: string;
  currency?: string;
};

export type BudgetSource = "job-bids" | "my-bids" | "estimate";
export type BudgetComparisonReason = "wrong-source" | "different-job" | "missing-amount" | "missing-range" | "missing-currency" | "different-currency";
export type BudgetComparison =
  | { available: true; position: "below" | "within" | "above"; difference: number; currency: string; reason?: never }
  | { available: false; reason: BudgetComparisonReason; position?: never; difference?: never; currency?: never };

function validAmount(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function currencyCode(currency: unknown): string | null {
  if (typeof currency !== "string") return null;
  const code = currency.trim().toUpperCase();
  return /^[A-Z]{3}$/.test(code) ? code : null;
}

/** Read-only distance from the nearest real bound, not a price recommendation. */
export function compareBidToBudget(job: BudgetJob, bid: BudgetBid, source: BudgetSource): BudgetComparison {
  if (source !== "job-bids") return { available: false, reason: "wrong-source" };
  if (!job.id || job.id !== bid.jobId) return { available: false, reason: "different-job" };
  if (!validAmount(bid.amount)) return { available: false, reason: "missing-amount" };
  if (!validAmount(job.budgetMin) || !validAmount(job.budgetMax) || job.budgetMin > job.budgetMax) {
    return { available: false, reason: "missing-range" };
  }
  const jobCurrency = currencyCode(job.currency);
  const bidCurrency = currencyCode(bid.currency);
  if (!jobCurrency || !bidCurrency) return { available: false, reason: "missing-currency" };
  if (jobCurrency !== bidCurrency) return { available: false, reason: "different-currency" };
  if (bid.amount < job.budgetMin) {
    return { available: true, position: "below", difference: bid.amount - job.budgetMin, currency: jobCurrency };
  }
  if (bid.amount > job.budgetMax) {
    return { available: true, position: "above", difference: bid.amount - job.budgetMax, currency: jobCurrency };
  }
  return { available: true, position: "within", difference: 0, currency: jobCurrency };
}

export function selectJobBids(jobId: string, bids: readonly BudgetBid[], source: BudgetSource): BudgetBid[] {
  if (!jobId || source !== "job-bids") return [];
  return bids.filter((bid) => bid.jobId === jobId);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/** Existing fetchSemse already unwraps envelope.data. Do not flatten other shapes. */
export function readBudgetJobs(value: unknown): BudgetJob[] {
  if (!Array.isArray(value) || !value.every((job) => isRecord(job) && typeof job.id === "string" && job.id.length > 0 && typeof job.title === "string")) {
    throw new Error("El contrato de trabajos recibido no es compatible con esta vista.");
  }
  return value as BudgetJob[];
}

export function readJobBids(value: unknown, jobId: string): BudgetBid[] {
  if (!Array.isArray(value) || !value.every((bid) => isRecord(bid) && typeof bid.id === "string" && bid.id.length > 0 && typeof bid.jobId === "string" && typeof bid.status === "string")) {
    throw new Error("El contrato de propuestas recibido no es compatible con esta vista.");
  }
  if (value.some((bid) => bid.jobId !== jobId)) {
    throw new Error("La respuesta contiene propuestas de otro trabajo; no se mostrarán ni compararán.");
  }
  return value as BudgetBid[];
}

export function formatBudgetAmount(amount: unknown, currency?: string): string {
  if (!validAmount(amount)) return "Importe no informado";
  const number = new Intl.NumberFormat("es-MX", { maximumFractionDigits: 20 }).format(amount);
  const code = currencyCode(currency);
  return code ? `${number} ${code}` : `${number} · moneda no informada`;
}

export function formatBudgetRange(job: BudgetJob): string {
  const min = validAmount(job.budgetMin);
  const max = validAmount(job.budgetMax);
  if (min && max) {
    if (job.budgetMin! > job.budgetMax!) return "Rango no válido · comparación indisponible";
    return `${formatBudgetAmount(job.budgetMin, job.currency)} — ${formatBudgetAmount(job.budgetMax, job.currency)}`;
  }
  if (min) return `Desde ${formatBudgetAmount(job.budgetMin, job.currency)} · límite superior no informado`;
  if (max) return `Hasta ${formatBudgetAmount(job.budgetMax, job.currency)} · límite inferior no informado`;
  return "Rango no informado";
}

export function budgetComparisonLabel(result: BudgetComparison): string {
  if (!result.available) {
    const labels: Record<BudgetComparisonReason, string> = {
      "wrong-source": "Comparación indisponible: la fuente no es propuestas recibidas del trabajo.",
      "different-job": "Comparación indisponible: pertenece a otro trabajo.",
      "missing-amount": "Comparación indisponible: importe no informado o no válido.",
      "missing-range": "Comparación indisponible: falta un rango completo y válido del trabajo.",
      "missing-currency": "Comparación indisponible: el contrato no informa la moneda de ambos importes.",
      "different-currency": "Monedas incompatibles: no se calcula diferencia ni conversión.",
    };
    return labels[result.reason];
  }
  if (result.position === "within") return "Dentro del rango · diferencia frente al rango: 0";
  return `${formatBudgetAmount(Math.abs(result.difference), result.currency)} ${result.position === "below" ? "por debajo del mínimo" : "por encima del máximo"}`;
}

export function budgetBidStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    submitted: "Recibida · pendiente",
    accepted: "Aceptada",
    rejected: "Rechazada",
    withdrawn: "Retirada",
  };
  return labels[status.toLowerCase()] ?? `Estado no reconocido (${status})`;
}

export function getBudgetLinks(role: WorkspaceRole | null): { href: string; label: string; description: string }[] {
  if (!role) return [];
  if (role === "client") return [
    { href: "/client/protools", label: "Estimador preliminar", description: "Abrir el estimador existente en otro módulo." },
    { href: "/client/bids", label: "Propuestas recibidas", description: "Consultar propuestas por trabajo, sin adjudicar aquí." },
    { href: "/client/jobs", label: "Mis trabajos", description: "Continuar el flujo existente del trabajo." },
  ];
  if (role === "worker") return [
    { href: "/tools", label: "Estimadores por oficio", description: "Abrir herramientas existentes en otro módulo." },
    { href: "/worker/bids", label: "Mis propuestas enviadas", description: "Solo propuestas propias; no concede acceso a las recibidas." },
    { href: "/buildops", label: "Estimados BuildOps", description: "Abrir el módulo existente; sus permisos siguen vigentes." },
  ];
  if (role === "admin") return [
    { href: "/tools", label: "Estimadores por oficio", description: "Abrir herramientas existentes en otro módulo." },
    { href: "/buildops", label: "Estimados BuildOps", description: "Abrir el módulo existente; sus permisos siguen vigentes." },
    { href: "/admin/jobs", label: "Trabajos de operaciones", description: "Consultar el contexto autorizado en otro módulo." },
  ];
  return [];
}
