import { Inject, Injectable, Logger, Optional } from "@nestjs/common";
import type { OperationalContextService } from "../ai-models/context/operational-context.service.js";
import { OPERATIONAL_CONTEXT_SERVICE } from "../ai-models/context/operational-context.token.js";
import { AgentDelegationRepository } from "./agent-delegation.repository.js";
import { AgentsService } from "./agents.service.js";
import { SseEventBusService } from "../../infrastructure/sse/sse-event-bus.service.js";

@Injectable()
export class AgentDelegationService {
  private readonly logger = new Logger(AgentDelegationService.name);

  constructor(
    private readonly delegationRepo: AgentDelegationRepository,
    private readonly agentsService: AgentsService,
    @Optional() private readonly sseBus?: SseEventBusService,
    @Optional() @Inject(OPERATIONAL_CONTEXT_SERVICE)
    private readonly operationalContext?: OperationalContextService,
  ) {}

  private emitDelegationsUpdate(tenantId: string, projectId?: string, source = "agents.delegation.updated"): void {
    const channel = projectId ? `delegations:${projectId}` : `delegations:${tenantId}`;
    this.sseBus?.emit(channel, "delegations-update", { tenantId, projectId, ts: Date.now() });
    this.operationalContext?.invalidateScope({
      tenantId,
      projectId,
      source,
      reason: "delegation state changed",
    });
  }

  /**
   * D5: abre el run padre de una acción del copiloto. Es observabilidad, no ejecución: el run nace terminal (ver
   * `AgentsRepository.recordObservedRun`). Si no se puede registrar devuelve `undefined` y la acción sigue su curso:
   * la trazabilidad no es una compuerta.
   */
  async openParentRun(input: {
    tenantId: string;
    orgId: string;
    userId: string;
    requestId: string;
    projectId: string;
    actionType: string;
  }): Promise<string | undefined> {
    try {
      const run = await this.agentsService.recordObservedRun({
        tenantId: input.tenantId,
        orgId: input.orgId,
        userId: input.userId,
        agentType: "project-copilot" as any,
        correlationId: `copilot:${input.requestId}:${input.actionType}`,
        input: {
          kind: "copilot_action_request",
          observedOnly: true,
          requestId: input.requestId,
          projectId: input.projectId,
          actionType: input.actionType,
          actorUserId: input.userId,
        },
        inputSummary: `Acción del copiloto '${input.actionType}' en el proyecto ${input.projectId}`,
      });
      return run.id;
    } catch (error) {
      this.logger.warn(`No se pudo abrir el run padre del copiloto (${input.actionType}): ${String(error)}`);
      return undefined;
    }
  }

  async delegateTask(input: {
    tenantId: string;
    orgId: string;
    userId: string;
    roles?: string[];
    projectId?: string;
    sourceRunId?: string;
    /** Origen de la delegación (solicitud/aprobación del copiloto): sobrevive a reintentos y reinicios. */
    lineage?: Record<string, unknown>;
    coordinatorId: string;
    targetAgentId: string;
    taskTitle: string;
    taskContextJson: Record<string, unknown>;
    requestId: string;
  }) {
    // 1. Registrar delegación
    const delegation = await this.delegationRepo.create({
      tenantId: input.tenantId,
      orgId: input.orgId,
      projectId: input.projectId,
      sourceRunId: input.sourceRunId,
      coordinatorId: input.coordinatorId,
      targetAgentId: input.targetAgentId,
      taskTitle: input.taskTitle,
      taskContextJson: input.taskContextJson,
    });

    // 2. Encolar nuevo AgentRun para el target agent
    const run = await this.agentsService.create({
      tenantId: input.tenantId,
      orgId: input.orgId,
      userId: input.userId,
      roles: input.roles ?? [],
      agentType: input.targetAgentId as any,
      triggerType: "event",
      correlationId: `delegation_${delegation.id}`,
      input: {
        delegationId: delegation.id,
        // H08: el run delegado declara su proyecto y su origen; los listados por proyecto ya no dependen de adivinar.
        projectId: input.projectId,
        sourceRunId: input.sourceRunId,
        lineage: input.lineage,
        taskTitle: input.taskTitle,
        context: input.taskContextJson,
      },
      inputSummary: `Delegated task from ${input.coordinatorId}: ${input.taskTitle}`,
      requestId: input.requestId,
    });

    // 3. Vincular targetRunId a la delegación
    await this.delegationRepo.attachTargetRun(delegation.id, input.tenantId, run.id);

    this.logger.log(`Delegated task '${delegation.id}' to agent '${input.targetAgentId}' (run: ${run.id})`);
    this.emitDelegationsUpdate(input.tenantId, input.projectId, "agents.delegation.created");

    return { delegation, run };
  }

  async getTask(input: { tenantId: string; delegationId: string }) {
    return this.delegationRepo.findById(input.delegationId, input.tenantId);
  }

  async listByCoordinator(input: {
    tenantId: string;
    coordinatorId: string;
    projectId?: string;
    statuses?: string[];
    limit?: number;
  }) {
    return this.delegationRepo.listByCoordinator(input);
  }

  async listByProject(input: {
    tenantId: string;
    projectId: string;
    statuses?: string[];
    limit?: number;
  }) {
    return this.delegationRepo.listByProject(input);
  }

  /**
   * Build a compact context block from completed delegations.
   * Used to inject specialist results back into the coordinator's next chat turn.
   */
  buildDelegationContext(
    delegations: Array<{
      id: string;
      targetAgentId: string;
      taskTitle: string;
      status: string;
      resultJson: unknown;
      error?: string | null;
    }>
  ): string {
    const done = delegations.filter((d) => d.status === "completed" || d.status === "failed");
    if (done.length === 0) return "";

    const lines: string[] = ["## Resultados de agentes especializados"];
    for (const d of done) {
      const statusGlyph = d.status === "completed" ? "✓" : "✗";
      lines.push(`${statusGlyph} [${d.targetAgentId}] ${d.taskTitle}`);
      if (d.status === "completed" && d.resultJson && typeof d.resultJson === "object") {
        const result = d.resultJson as Record<string, unknown>;
        const summary = typeof result.summary === "string"
          ? result.summary
          : JSON.stringify(result).slice(0, 300);
        lines.push(`  Resultado: ${summary}`);
      } else if (d.status === "failed" && d.error) {
        lines.push(`  Error: ${d.error.slice(0, 200)}`);
      }
    }

    const pending = delegations.filter((d) => d.status === "pending" || d.status === "executing");
    if (pending.length > 0) {
      lines.push(`\n${pending.length} tarea(s) en ejecución: ${pending.map((d) => d.taskTitle).join(", ")}`);
    }

    return lines.join("\n");
  }
}
