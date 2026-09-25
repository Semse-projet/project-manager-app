import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../infrastructure/prisma/prisma.service.js";

/**
 * Referencia a una tarea Agro sin acoplarse a un modelo concreto.
 *
 * Convergencia decidida: las tareas Agro migran a `JobTask` con
 * `domain = "agro"` (columnas ya presentes en el schema, "Fase 3"). Mientras
 * tanto `AgroFarmTask` sigue siendo el modelo vivo (web, sync, Prometeo). Los
 * módulos nuevos (IncidentOps, intake de Prometeo) guardan `{source, id}` y
 * resuelven aquí ambas fuentes, así que la migración no les afecta.
 */
export const AGRO_TASK_REF_SOURCES = ["AGRO_FARM_TASK", "JOB_TASK"] as const;
export type AgroTaskRefSource = typeof AGRO_TASK_REF_SOURCES[number];

export type AgroTaskRef = { source: AgroTaskRefSource; id: string };

/** Estado normalizado común a ambos modelos (AgroFarmTask usa MAYÚSCULAS, JobTask minúsculas). */
export type AgroTaskRefStatus = "PENDING" | "IN_PROGRESS" | "DONE" | "BLOCKED" | "CANCELLED";

export type ResolvedAgroTask = {
  source: AgroTaskRefSource;
  id: string;
  farmId: string;
  title: string;
  type: string | null;
  status: AgroTaskRefStatus;
  rawStatus: string;
  targetType: string | null;
  targetId: string | null;
  assignedToId: string | null;
  dueAt: Date | null;
};

const STATUS_MAP: Record<string, AgroTaskRefStatus> = {
  PENDING: "PENDING", pending: "PENDING",
  IN_PROGRESS: "IN_PROGRESS", in_progress: "IN_PROGRESS",
  COMPLETED: "DONE", done: "DONE",
  BLOCKED: "BLOCKED", blocked: "BLOCKED",
  CANCELLED: "CANCELLED", canceled: "CANCELLED", cancelled: "CANCELLED",
};

export function normalizeAgroTaskStatus(raw: string): AgroTaskRefStatus {
  return STATUS_MAP[raw] ?? "PENDING";
}

export function isOpenAgroTaskStatus(status: AgroTaskRefStatus): boolean {
  return status === "PENDING" || status === "IN_PROGRESS" || status === "BLOCKED";
}

export function parseAgroTaskRef(input: { source?: string; id?: string } | null | undefined): AgroTaskRef | null {
  if (!input?.id) return null;
  const source = (input.source ?? "AGRO_FARM_TASK") as AgroTaskRefSource;
  if (!AGRO_TASK_REF_SOURCES.includes(source)) {
    throw new BadRequestException(`Invalid task source: ${input.source}`);
  }
  return { source, id: input.id };
}

type FarmTaskRow = {
  id: string; farmId: string; title: string; type: string; status: string;
  targetType: string | null; targetId: string | null; assignedToId: string | null; dueAt: Date | null;
};
type JobTaskRow = {
  id: string; farmId: string | null; title: string; taskType: string | null; status: string;
  targetType: string | null; targetId: string | null; assignedTo: string | null; dueDate: Date | null;
};

function fromFarmTask(row: FarmTaskRow): ResolvedAgroTask {
  return {
    source: "AGRO_FARM_TASK", id: row.id, farmId: row.farmId, title: row.title, type: row.type,
    status: normalizeAgroTaskStatus(row.status), rawStatus: row.status,
    targetType: row.targetType, targetId: row.targetId, assignedToId: row.assignedToId, dueAt: row.dueAt,
  };
}

function fromJobTask(row: JobTaskRow, farmId: string): ResolvedAgroTask {
  return {
    source: "JOB_TASK", id: row.id, farmId, title: row.title, type: row.taskType,
    status: normalizeAgroTaskStatus(row.status), rawStatus: row.status,
    targetType: row.targetType, targetId: row.targetId, assignedToId: row.assignedTo, dueAt: row.dueDate,
  };
}

@Injectable()
export class AgroTaskRefResolver {
  constructor(private readonly prisma: PrismaService) {}

  /** Resuelve una referencia y exige que pertenezca a la finca. 404 si no. */
  async resolve(farmId: string, ref: AgroTaskRef): Promise<ResolvedAgroTask> {
    if (ref.source === "AGRO_FARM_TASK") {
      const row = await this.prisma.agroFarmTask.findUnique({ where: { id: ref.id } });
      if (!row || row.farmId !== farmId) throw new NotFoundException(`Task not found in farm: ${ref.id}`);
      return fromFarmTask(row);
    }
    const row = await this.prisma.jobTask.findFirst({
      where: { id: ref.id, domain: "agro", farmId, deletedAt: null },
    });
    if (!row) throw new NotFoundException(`Task not found in farm: ${ref.id}`);
    return fromJobTask(row, farmId);
  }

  /** Tareas abiertas de la finca en ambas fuentes (para "buscar → relacionar"). */
  async listOpen(farmId: string, limit = 100): Promise<ResolvedAgroTask[]> {
    const [farmTasks, jobTasks] = await Promise.all([
      this.prisma.agroFarmTask.findMany({
        where: { farmId, status: { in: ["PENDING", "IN_PROGRESS", "BLOCKED"] } },
        orderBy: [{ dueAt: "asc" }, { createdAt: "desc" }],
        take: limit,
      }),
      this.prisma.jobTask.findMany({
        where: { farmId, domain: "agro", deletedAt: null, status: { in: ["pending", "in_progress", "blocked"] } },
        orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
        take: limit,
      }),
    ]);
    return [...farmTasks.map(fromFarmTask), ...jobTasks.map((t) => fromJobTask(t, farmId))];
  }
}
