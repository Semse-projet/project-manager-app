/**
 * Espejo AgroFarmTask → JobTask(domain="agro") durante la convergencia de
 * tareas (T-051, docs/specs/agro/agro-task-jobtask-convergence.spec.md).
 *
 * `AgroFarmTask` sigue siendo el modelo que leen web, sync y Prometeo; cada
 * escritura se refleja en `JobTask` dentro de la misma transacción, solo si la
 * finca tiene tenant (JobTask.tenantId es obligatorio). El id del espejo es
 * determinista (`agrotask_<id>`), igual que el backfill de la migración
 * 20260925150000, así que reintentar es idempotente.
 */

export const AGRO_JOBTASK_SOURCE_TOOL = "agro_farm_task";

const STATUS_TO_JOBTASK: Record<string, string> = {
  PENDING: "pending",
  IN_PROGRESS: "in_progress",
  COMPLETED: "done",
  BLOCKED: "blocked",
  CANCELLED: "canceled",
};

export function agroJobTaskId(agroTaskId: string): string {
  return `agrotask_${agroTaskId}`;
}

export type AgroFarmTaskRow = {
  id: string;
  farmId: string;
  title: string;
  type: string;
  status: string;
  priority: string;
  targetType: string | null;
  targetId: string | null;
  assignedToId: string | null;
  dueAt: Date | null;
  startedAt: Date | null;
  completedAt: Date | null;
  blockedAt: Date | null;
  cancelledAt: Date | null;
  blockReason: string | null;
  cancelReason: string | null;
  notes: string | null;
  jobTaskId?: string | null;
};

/** Campos de JobTask que reflejan la tarea Agro (los que cambian en cada escritura). */
export function mapAgroTaskToJobTask(task: AgroFarmTaskRow) {
  return {
    title: task.title,
    dueDate: task.dueAt,
    priority: task.priority.toLowerCase(),
    status: STATUS_TO_JOBTASK[task.status] ?? "pending",
    assignedTo: task.assignedToId,
    farmId: task.farmId,
    targetType: task.targetType,
    targetId: task.targetId,
    taskType: task.type,
    startedAt: task.startedAt,
    completedAt: task.completedAt,
    blockedAt: task.blockedAt,
    canceledAt: task.cancelledAt,
    blockReason: task.blockReason,
    cancelReason: task.cancelReason,
    notes: task.notes,
  };
}

type MirrorClient = {
  agroFarm: { findUnique(args: any): Promise<{ tenantId: string | null; ownerId: string | null } | null> };
  agroFarmTask: {
    findUnique(args: any): Promise<AgroFarmTaskRow | null>;
    update(args: any): Promise<unknown>;
  };
  jobTask: { upsert(args: any): Promise<{ id: string }> };
};

/**
 * Refleja la tarea en JobTask. Devuelve el id del espejo, o null si la finca
 * no tiene tenant (la tarea sigue solo en AgroFarmTask, como antes de T-051).
 * Debe llamarse con el cliente de la transacción que escribió la tarea.
 */
export async function mirrorAgroTaskToJobTask(
  client: MirrorClient,
  taskId: string,
  actorId?: string,
): Promise<string | null> {
  const task = await client.agroFarmTask.findUnique({ where: { id: taskId } });
  if (!task) return null;
  const farm = await client.agroFarm.findUnique({ where: { id: task.farmId }, select: { tenantId: true, ownerId: true } });
  if (!farm?.tenantId) return null;

  const id = task.jobTaskId ?? agroJobTaskId(task.id);
  const mirrored = mapAgroTaskToJobTask(task);
  await client.jobTask.upsert({
    where: { id },
    create: {
      id,
      tenantId: farm.tenantId,
      createdBy: actorId ?? farm.ownerId ?? "system",
      sourceTool: AGRO_JOBTASK_SOURCE_TOOL,
      domain: "agro",
      vertical: "agro",
      entityType: "AgroFarm",
      entityId: task.farmId,
      ...mirrored,
    },
    update: mirrored,
  });
  if (task.jobTaskId !== id) {
    await client.agroFarmTask.update({ where: { id: task.id }, data: { jobTaskId: id } });
  }
  return id;
}
