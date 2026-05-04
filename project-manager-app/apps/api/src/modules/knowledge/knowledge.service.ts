import { Injectable } from "@nestjs/common";
import { listKnowledgeDomains } from "@semse/knowledge";
import { RuntimeKnowledgeService } from "../runtime-knowledge/runtime-knowledge.service.js";
import { WorkspaceMemoryRepository } from "./workspace-memory.repository.js";

@Injectable()
export class KnowledgeService {
  constructor(
    private readonly runtimeKnowledgeService: RuntimeKnowledgeService,
    private readonly workspaceMemoryRepository: WorkspaceMemoryRepository
  ) {}

  async getDomains() {
    return listKnowledgeDomains();
  }

  async getOverview() {
    const domains = listKnowledgeDomains();
    const runtimeStatuses = await this.runtimeKnowledgeService.getServiceStatuses();
    return {
      domains,
      runtimeStatuses,
      totals: {
        domains: domains.length,
        services: runtimeStatuses.length,
        onlineServices: runtimeStatuses.filter((item) => item.status === "online").length,
        degradedServices: runtimeStatuses.filter((item) => item.status === "degraded").length,
        offlineServices: runtimeStatuses.filter((item) => item.status === "offline").length
      }
    };
  }

  async searchWorkspaceMemory(input: {
    tenantId: string;
    workspaceId: string;
    term: string;
    limit?: number;
    kinds?: string[];
  }) {
    const items = await this.workspaceMemoryRepository.search({
      tenantId: input.tenantId,
      workspaceId: input.workspaceId,
      term: input.term,
      limit: input.limit,
      kinds: input.kinds as
        | ("operator_note" | "repo_fact" | "runtime_fact" | "decision" | "run_summary" | "task_state")[]
        | undefined
    });

    return { items };
  }

  async listWorkspaceMemory(input: {
    tenantId: string;
    orgId: string;
    workspaceId: string;
    repoId?: string;
    runId?: string;
    taskId?: string;
    kinds?: string[];
    tags?: string[];
  }) {
    const items = await this.workspaceMemoryRepository.query({
      tenantId: input.tenantId,
      orgId: input.orgId,
      workspaceId: input.workspaceId,
      repoId: input.repoId,
      runId: input.runId,
      taskId: input.taskId,
      kinds: input.kinds as
        | ("operator_note" | "repo_fact" | "runtime_fact" | "decision" | "run_summary" | "task_state")[]
        | undefined,
      tags: input.tags
    });

    return { items };
  }
}
