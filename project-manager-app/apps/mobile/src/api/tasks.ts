import { apiFetch } from "./client";

/**
 * `GET /v1/tasks` es entre dominios (JobTask, plataforma canónica) — Agro
 * espeja sus AgroFarmTask con id `agrotask_<originalId>` (ver
 * `agro-jobtask-mirror.ts`, T-051). Detectamos el origen Agro por ese
 * prefijo, sin campo adicional en la API, y recuperamos el id nativo para
 * llamar a los endpoints propios de Agro (`start`/`complete`), ya que el
 * genérico `PATCH /v1/tasks/:taskId/status` exige `jobs:update`, permiso que
 * el WORKER de Agro no tiene (solo `tasks:read:self`).
 */
const AGRO_TASK_ID_PREFIX = "agrotask_";

export type CrossDomainTask = {
  id: string;
  tenantId: string;
  jobId: string | null;
  milestone: string | null;
  title: string;
  description: string | null;
  dueDate: string | null;
  priority: string;
  status: string;
  assignedTo: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
};

export function isAgroTask(task: CrossDomainTask): boolean {
  return task.id.startsWith(AGRO_TASK_ID_PREFIX);
}

export function toAgroFarmTaskId(task: CrossDomainTask): string {
  return task.id.slice(AGRO_TASK_ID_PREFIX.length);
}

export async function fetchMyTasks(status?: string): Promise<CrossDomainTask[]> {
  const query = status ? `?status=${encodeURIComponent(status)}` : "";
  return apiFetch<CrossDomainTask[]>(`/v1/tasks${query}`);
}

export type AgroFarmTask = {
  id: string;
  farmId: string;
  status: "PENDING" | "IN_PROGRESS" | "COMPLETED" | "BLOCKED" | "CANCELLED";
  title: string;
  [key: string]: unknown;
};

export async function startAgroTask(agroFarmTaskId: string): Promise<{ task: AgroFarmTask }> {
  return apiFetch<{ task: AgroFarmTask }>(`/v1/agro/tasks/${encodeURIComponent(agroFarmTaskId)}/start`, { method: "POST" });
}

export async function completeAgroTask(agroFarmTaskId: string): Promise<{ task: AgroFarmTask }> {
  return apiFetch<{ task: AgroFarmTask }>(`/v1/agro/tasks/${encodeURIComponent(agroFarmTaskId)}/complete`, { method: "POST" });
}

/**
 * PENDING no puede pasar directo a COMPLETED (FSM en `agro-task.service.ts`)
 * — la pantalla llama `start` primero cuando hace falta, nunca lo asume el
 * caller.
 */
export async function completeAgroTaskFromAnyStatus(agroFarmTaskId: string, currentStatus: string): Promise<{ task: AgroFarmTask }> {
  if (currentStatus === "PENDING") await startAgroTask(agroFarmTaskId);
  return completeAgroTask(agroFarmTaskId);
}
