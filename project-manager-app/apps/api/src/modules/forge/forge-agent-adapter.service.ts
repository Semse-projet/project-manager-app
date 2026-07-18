import { Injectable } from "@nestjs/common";
import { executeGovernedAgentRun, type RuntimeAgentInput } from "@semse/agents";
import type { ForgeRun, ForgeTaskPacket } from "@semse/forge";
import type { AgentRunRecord } from "../../common/domain-store.js";
import { AgentsRepository } from "../agents/agents.repository.js";
import { AgentsService } from "../agents/agents.service.js";

@Injectable()
export class ForgeAgentAdapterService {
  constructor(
    private readonly agentsRepository: AgentsRepository,
    private readonly agentsService: AgentsService
  ) {}

  async execute(input: {
    actor: { tenantId: string; orgId: string; userId: string; roles?: string[] };
    forgeRun: ForgeRun;
    task: ForgeTaskPacket;
    action?: string;
  }): Promise<{ agentRun: AgentRunRecord; result: ReturnType<typeof executeGovernedAgentRun> }> {
    const { actor, forgeRun, task, action } = input;

    const agentRun = await this.agentsRepository.create({
      tenantId: actor.tenantId,
      orgId: actor.orgId,
      userId: actor.userId,
      agentType: "forge",
      triggerType: "manual",
      correlationId: forgeRun.id,
      input: {
        forgeRunId: forgeRun.id,
        taskId: task.id,
        task,
        action,
        operatorContext: {
          source: "forge",
          operatorId: actor.userId,
          tenantId: actor.tenantId,
          orgId: actor.orgId,
          roles: actor.roles ?? [],
          scope: "task",
          runId: forgeRun.id,
          taskId: task.id
        }
      } as unknown as Record<string, unknown>,
      inputSummary: `Forge task ${task.id} (${task.requestedRole}) for run ${forgeRun.id}`
    });

    await this.agentsRepository.start({
      tenantId: actor.tenantId,
      orgId: actor.orgId,
      userId: actor.userId,
      runId: agentRun.id
    });

    const result = executeGovernedAgentRun({
      agentType: "forge",
      runId: agentRun.id,
      correlationId: forgeRun.id,
      payload: agentRun.input as RuntimeAgentInput,
      environment: "api"
    });

    await this.agentsRepository.complete({
      tenantId: actor.tenantId,
      orgId: actor.orgId,
      userId: actor.userId,
      runId: agentRun.id,
      output: result as unknown as Record<string, unknown>
    });

    return { agentRun, result };
  }

  async enqueue(input: {
    actor: { tenantId: string; orgId: string; userId: string; roles?: string[] };
    forgeRun: ForgeRun;
    task: ForgeTaskPacket;
    action?: string;
    requestId: string;
  }): Promise<AgentRunRecord> {
    const { actor, forgeRun, task, action, requestId } = input;

    return this.agentsService.create({
      tenantId: actor.tenantId,
      orgId: actor.orgId,
      userId: actor.userId,
      roles: actor.roles ?? [],
      agentType: "forge",
      triggerType: "manual",
      correlationId: forgeRun.id,
      requestId,
      input: {
        forgeRunId: forgeRun.id,
        taskId: task.id,
        task,
        action,
        operatorContext: {
          source: "forge",
          operatorId: actor.userId,
          tenantId: actor.tenantId,
          orgId: actor.orgId,
          roles: actor.roles ?? [],
          scope: "task",
          runId: forgeRun.id,
          taskId: task.id
        }
      } as unknown as Record<string, unknown>,
      inputSummary: `Forge task ${task.id} (${task.requestedRole}) for run ${forgeRun.id}`
    });
  }
}
