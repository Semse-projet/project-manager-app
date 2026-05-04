import { Injectable, Logger } from "@nestjs/common";
import { AgentDelegationService } from "./agent-delegation.service.js";

// ── Types ─────────────────────────────────────────────────────────────────────

type RawDelegationRow = {
  id: string;
  tenantId: string;
  orgId: string;
  coordinatorId: string;
  targetAgentId: string;
  taskTitle: string;
  status: string;
  projectId?: string | null;
  sourceRunId?: string | null;
  targetRunId?: string | null;
  resultJson?: unknown;
  error?: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type DelegationStatus = "pending" | "executing" | "completed" | "failed" | "rejected";

export type DelegationRecord = {
  id: string;
  tenantId: string;
  orgId: string;
  coordinatorId: string;
  targetAgentId: string;
  taskTitle: string;
  status: DelegationStatus;
  projectId?: string | null;
  sourceRunId?: string | null;
  targetRunId?: string | null;
  resultJson?: unknown;
  error?: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type SpawnTaskInput = {
  targetAgentId: string;
  taskTitle: string;
  taskContextJson: Record<string, unknown>;
};

export type CoordinatorSpawnResult = {
  delegationId: string;
  targetAgentId: string;
  runId: string;
  status: DelegationStatus;
};

export type CoordinatorSnapshot = {
  projectId: string;
  totalDelegations: number;
  completed: number;
  executing: number;
  pending: number;
  failed: number;
  delegations: DelegationRecord[];
  contextBlock: string;
};

// ── Service ───────────────────────────────────────────────────────────────────

@Injectable()
export class CoordinatorService {
  private readonly logger = new Logger(CoordinatorService.name);

  constructor(private readonly delegationService: AgentDelegationService) {}

  /**
   * Spawn one or more delegated sub-tasks in parallel.
   * Returns immediately — sub-tasks run asynchronously via BullMQ.
   */
  async spawnTasks(input: {
    tenantId: string;
    orgId: string;
    userId: string;
    roles?: string[];
    coordinatorId: string;
    projectId?: string;
    sourceRunId?: string;
    requestId: string;
    tasks: SpawnTaskInput[];
  }): Promise<CoordinatorSpawnResult[]> {
    const results = await Promise.all(
      input.tasks.map(async (task) => {
        const { delegation, run } = await this.delegationService.delegateTask({
          tenantId: input.tenantId,
          orgId: input.orgId,
          userId: input.userId,
          roles: input.roles ?? [],
          projectId: input.projectId,
          sourceRunId: input.sourceRunId,
          coordinatorId: input.coordinatorId,
          targetAgentId: task.targetAgentId,
          taskTitle: task.taskTitle,
          taskContextJson: task.taskContextJson,
          requestId: input.requestId,
        });

        this.logger.log(
          `[coordinator] spawned task '${task.taskTitle}' → ${task.targetAgentId} (delegation=${delegation.id} run=${run.id})`,
        );

        return {
          delegationId: delegation.id,
          targetAgentId: task.targetAgentId,
          runId: run.id,
          status: "pending" as DelegationStatus,
        };
      }),
    );

    return results;
  }

  /**
   * Collect the current state of delegations for a project.
   * Builds a context block with specialist results for the coordinator.
   */
  async collectProjectSnapshot(input: {
    tenantId: string;
    coordinatorId: string;
    projectId: string;
    limit?: number;
  }): Promise<CoordinatorSnapshot> {
    const rows = await this.delegationService.listByCoordinator({
      tenantId: input.tenantId,
      coordinatorId: input.coordinatorId,
      projectId: input.projectId,
      limit: input.limit ?? 20,
    });

    const delegations = (rows as RawDelegationRow[]).map((r) => this.toRecord(r));

    const completed  = delegations.filter((d) => d.status === "completed").length;
    const executing  = delegations.filter((d) => d.status === "executing").length;
    const pending    = delegations.filter((d) => d.status === "pending").length;
    const failed     = delegations.filter((d) => d.status === "failed").length;

    const contextBlock = this.delegationService.buildDelegationContext(
      delegations.map((d) => ({
        id: d.id,
        targetAgentId: d.targetAgentId,
        taskTitle: d.taskTitle,
        status: d.status,
        resultJson: d.resultJson,
        error: d.error,
      })),
    );

    return {
      projectId: input.projectId,
      totalDelegations: delegations.length,
      completed,
      executing,
      pending,
      failed,
      delegations,
      contextBlock,
    };
  }

  /**
   * Get a single delegation record.
   */
  async getTask(input: { tenantId: string; delegationId: string }): Promise<DelegationRecord | null> {
    const row = await this.delegationService.getTask(input);
    return row ? this.toRecord(row as RawDelegationRow) : null;
  }

  /**
   * List all delegations for a project regardless of coordinator.
   */
  async listByProject(input: {
    tenantId: string;
    projectId: string;
    statuses?: DelegationStatus[];
    limit?: number;
  }): Promise<DelegationRecord[]> {
    const rows = await this.delegationService.listByProject({
      tenantId: input.tenantId,
      projectId: input.projectId,
      statuses: input.statuses,
      limit: input.limit ?? 20,
    });
    return (rows as RawDelegationRow[]).map((r) => this.toRecord(r));
  }

  /**
   * Build a context block string from a snapshot — ready to inject into a system prompt.
   */
  buildContextBlock(snapshot: CoordinatorSnapshot): string {
    if (snapshot.totalDelegations === 0) return "";
    const progress = snapshot.totalDelegations > 0
      ? `${snapshot.completed}/${snapshot.totalDelegations} completadas`
      : "";
    const header = `## Coordinación de agentes (${progress})`;
    return snapshot.contextBlock ? `${header}\n${snapshot.contextBlock}` : "";
  }

  /**
   * Supervisor mode: spawn field-ops + trust-match in parallel for a project,
   * wait for results via polling, and return assembled context.
   * Used by the coordinator harness to do supervised analysis before responding.
   */
  async runSupervisedAnalysis(input: {
    tenantId: string;
    orgId: string;
    userId: string;
    roles?: string[];
    coordinatorId: string;
    projectId: string;
    jobId?: string;
    requestId: string;
    waitMs?: number;
  }): Promise<{
    fieldOpsResult: Record<string, unknown> | null;
    trustMatchResult: Record<string, unknown> | null;
    pricingResult: Record<string, unknown> | null;
    contextBlock: string;
    delegationIds: string[];
  }> {
    const tasks: SpawnTaskInput[] = [
      {
        targetAgentId: "field-ops",
        taskTitle: "Análisis de campo — documentación y hitos",
        taskContextJson: {
          projectId: input.projectId,
          jobId: input.jobId ?? "",
          objective: "Revisar estado de hitos y documentación de evidencia",
        },
      },
      {
        targetAgentId: "trust-match",
        taskTitle: "Trust match — evaluación del profesional",
        taskContextJson: {
          projectId: input.projectId,
          jobId: input.jobId ?? "",
          objective: "Evaluar trust score y candidatos del job",
        },
      },
    ];

    if (input.jobId) {
      tasks.push({
        targetAgentId: "pricing",
        taskTitle: "Estimación de precio de mercado",
        taskContextJson: {
          projectId: input.projectId,
          jobId: input.jobId,
          objective: "Validar si el presupuesto actual está alineado con el mercado",
        },
      });
    }

    const spawned = await this.spawnTasks({
      tenantId: input.tenantId,
      orgId: input.orgId,
      userId: input.userId,
      roles: input.roles,
      coordinatorId: input.coordinatorId,
      projectId: input.projectId,
      requestId: input.requestId,
      tasks,
    });

    const delegationIds = spawned.map((s) => s.delegationId);

    // Poll for up to waitMs (default 8s) — best effort, not blocking
    const waitMs = input.waitMs ?? 8_000;
    const pollInterval = 1_000;
    const maxPolls = Math.floor(waitMs / pollInterval);

    let fieldOpsResult: Record<string, unknown> | null = null;
    let trustMatchResult: Record<string, unknown> | null = null;
    let pricingResult: Record<string, unknown> | null = null;

    for (let poll = 0; poll < maxPolls; poll++) {
      await new Promise((r) => setTimeout(r, pollInterval));

      const snapshot = await this.collectProjectSnapshot({
        tenantId: input.tenantId,
        coordinatorId: input.coordinatorId,
        projectId: input.projectId,
      });

      for (const d of snapshot.delegations) {
        if (!delegationIds.includes(d.id)) continue;
        if (d.status === "completed" && d.resultJson) {
          if (d.targetAgentId === "field-ops" && !fieldOpsResult) {
            fieldOpsResult = d.resultJson as Record<string, unknown>;
          }
          if (d.targetAgentId === "trust-match" && !trustMatchResult) {
            trustMatchResult = d.resultJson as Record<string, unknown>;
          }
          if (d.targetAgentId === "pricing" && !pricingResult) {
            pricingResult = d.resultJson as Record<string, unknown>;
          }
        }
      }

      const allDone = [fieldOpsResult, trustMatchResult, ...(input.jobId ? [pricingResult] : [])].every((r) => r !== null);
      if (allDone) break;
    }

    // Build human-readable context block for injection into LLM prompt
    const lines: string[] = ["## Análisis supervisado (agentes especializados)"];

    if (fieldOpsResult) {
      const fo = fieldOpsResult;
      lines.push(`**Field Ops:** ${String(fo.assessment ?? "Sin evaluación")} — ${fo.evidenceCount ?? 0} evidencias, ${fo.submittedMilestones ?? 0} hitos enviados.`);
      if (Array.isArray(fo.missingDocumentation) && fo.missingDocumentation.length > 0) {
        lines.push(`  ⚠ Documentación faltante: ${(fo.missingDocumentation as Array<{title?: string; issue?: string}>).map((m) => m.title ?? m.issue ?? "?").join(", ")}`);
      }
    } else {
      lines.push("**Field Ops:** análisis en proceso o no disponible.");
    }

    if (trustMatchResult) {
      const tm = trustMatchResult;
      lines.push(`**Trust Match:** ${tm.candidatesEvaluated ?? 0} candidatos evaluados. ${tm.topCandidate ? `Mejor match: score ${(tm.topCandidate as Record<string, unknown>).score ?? "?"}` : "Sin candidato top."}`);
    } else {
      lines.push("**Trust Match:** evaluación en proceso o no disponible.");
    }

    if (pricingResult) {
      const pr = pricingResult;
      const est = pr.estimate as Record<string, unknown> | undefined;
      lines.push(`**Pricing:** rango estimado $${est?.recommendedMin ?? "?"}-$${est?.recommendedMax ?? "?"} USD (${est?.baselineSource ?? "heurístico"}).`);
    }

    this.logger.log(
      `[supervisor] project=${input.projectId} delegations=${delegationIds.length} fieldOps=${!!fieldOpsResult} trustMatch=${!!trustMatchResult} pricing=${!!pricingResult}`,
    );

    return {
      fieldOpsResult,
      trustMatchResult,
      pricingResult,
      contextBlock: lines.join("\n"),
      delegationIds,
    };
  }

  private toRecord(row: RawDelegationRow): DelegationRecord {
    return {
      id: row.id,
      tenantId: row.tenantId,
      orgId: row.orgId,
      coordinatorId: row.coordinatorId,
      targetAgentId: row.targetAgentId,
      taskTitle: row.taskTitle,
      status: row.status as DelegationStatus,
      projectId: row.projectId,
      sourceRunId: row.sourceRunId,
      targetRunId: row.targetRunId,
      resultJson: row.resultJson,
      error: row.error,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}
