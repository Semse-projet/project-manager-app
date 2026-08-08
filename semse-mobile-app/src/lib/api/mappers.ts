import { toWorkerJob } from "@/domains/worker/jobs/adapters";
import type { WorkerJob } from "@/domains/worker/jobs/types";
import type { ClientJob, ClientProfileSnapshot } from "@/domains/client/jobs/types";
import type { ClientEscrowPayment } from "@/domains/client/payments/types";
import type { WorkerProfile } from "@/domains/worker/profile/types";
import type { Payment } from "@/types";

type UnknownRecord = Record<string, unknown>;

function stringValue(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : fallback;
}

function numberValue(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function isoDateToLabel(value: unknown, fallback: string): string {
  const raw = stringValue(value, fallback);
  const parsed = Date.parse(raw);
  if (!Number.isFinite(parsed)) {
    return raw;
  }
  return new Date(parsed).toLocaleDateString("es-MX", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function workerStatusFromVisible(status: string): WorkerJob["status"] {
  switch (status) {
    case "POSTED":
    case "PUBLISHED":
    case "RESERVED":
      return "scheduled";
    case "ACCEPTED":
    case "IN_PROGRESS":
    case "REVIEW":
      return "active";
    case "COMPLETED":
      return "completed";
    case "CANCELLED":
      return "cancelled";
    default:
      return "pending";
  }
}

export function mapJobRecordToWorkerJob(record: UnknownRecord): WorkerJob {
  const rawStatus = stringValue(record.status, "pending");
  const mapped = toWorkerJob({
    id: stringValue(record.id, "job_unknown"),
    title: stringValue(record.title, "Trabajo sin titulo"),
    client: stringValue(record.clientName, "Cliente SEMSE"),
    location: stringValue(record.location, "Ubicacion por confirmar"),
    status: workerStatusFromVisible(rawStatus),
    date: isoDateToLabel(record.createdAt, "Sin fecha"),
    time: stringValue(record.scheduleLabel, "Por definir"),
    description: stringValue(record.scope, "Sin descripcion operativa."),
    progress: numberValue(record.progress, workerStatusFromVisible(rawStatus) === "completed" ? 100 : 0),
    supervisor: {
      name: stringValue(record.supervisorName, "Supervisor SEMSE"),
      phone: stringValue(record.supervisorPhone, "No disponible"),
    },
    tasks: [],
    materials: [],
    evidences: [],
  });
  return {
    ...mapped,
    rawStatus: rawStatus.toUpperCase(),
    budgetMin: typeof record.budgetMin === "number" ? record.budgetMin : undefined,
    budgetMax: typeof record.budgetMax === "number" ? record.budgetMax : undefined,
  };
}

export function mapJobRecordToClientJob(record: UnknownRecord): ClientJob {
  const budgetMin = numberValue(record.budgetMin);
  const budgetMax = numberValue(record.budgetMax);
  const status = stringValue(record.status, "POSTED");
  return {
    id: stringValue(record.id, "job_unknown"),
    title: stringValue(record.title, "Trabajo sin título"),
    description: stringValue(record.scope, "Sin descripción."),
    type: stringValue(record.category, "General"),
    category: stringValue(record.category, "General"),
    location: stringValue(record.location, "Ubicación por definir"),
    budget: budgetMax > 0 ? `$${budgetMin} - $${budgetMax} USD` : `$${budgetMin || 0} USD`,
    status: status === "COMPLETED" ? "completed" : status === "POSTED" || status === "PUBLISHED" ? "published" : "active",
    date: isoDateToLabel(record.createdAt, "Sin fecha"),
    proposals: numberValue(record.proposalsCount),
    image: undefined,
  };
}

export function mapPaymentRecordToWorkerPayment(record: UnknownRecord, labelFallback: string): Payment {
  const status = stringValue(record.status, "PENDING");
  const amount = numberValue(record.amount);
  return {
    id: stringValue(record.id, `pay_${labelFallback}`),
    description: stringValue(record.description, labelFallback),
    amount,
    date: isoDateToLabel(record.createdAt ?? record.updatedAt, "Sin fecha"),
    status: status === "SUCCEEDED" ? "completed" : "pending",
    jobId: typeof record.jobId === "string" ? record.jobId : undefined,
  };
}

export function mapPaymentRecordToClientEscrowPayment(record: UnknownRecord, fallbackConcept: string): ClientEscrowPayment {
  const status = stringValue(record.status, "PENDING");
  return {
    id: stringValue(record.id, `esc_${fallbackConcept}`),
    concept: stringValue(record.description, fallbackConcept),
    amount: numberValue(record.amount),
    status: status === "SUCCEEDED" ? "released" : status === "PENDING" ? "funded" : "pending",
    date: isoDateToLabel(record.createdAt ?? record.updatedAt, "Sin fecha"),
  };
}

export function mapUserRecordToWorkerProfile(record: UnknownRecord): WorkerProfile {
  const email = stringValue(record.email, "sin-correo@semse.local");
  const phone = stringValue(record.phone, "No disponible");
  return {
    name: stringValue(record.name, email.split("@")[0] || "Operador SEMSE"),
    role: stringValue(record.roleName, "Operador de campo"),
    avatar: stringValue(record.avatarUrl, `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(email)}`),
    phone,
    email,
    location: stringValue(record.location, "Ubicación no publicada"),
    specialty: stringValue(record.specialty, "Ejecución operativa"),
    rating: numberValue(record.trustScore, 4.5),
    reviewCount: numberValue(record.reviewCount, 0),
    memberSince: isoDateToLabel(record.createdAt, "2026"),
    jobsCompleted: numberValue(record.jobsCompleted, 0),
  };
}

export function mapUserRecordToClientProfile(record: UnknownRecord): ClientProfileSnapshot {
  const email = stringValue(record.email, "cliente@semse.local");
  return {
    name: stringValue(record.name, email.split("@")[0] || "Cliente SEMSE"),
    email,
    phone: stringValue(record.phone, "No disponible"),
    location: stringValue(record.location, "Ubicación no publicada"),
    address: stringValue(record.address, "Dirección no publicada"),
    memberSince: isoDateToLabel(record.createdAt, "2026"),
    projectsCount: numberValue(record.projectsCount, 0),
    avatar: stringValue(record.avatarUrl, `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(email)}`),
  };
}
