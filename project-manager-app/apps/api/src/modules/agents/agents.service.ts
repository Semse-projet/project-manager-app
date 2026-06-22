import { ForbiddenException, Inject, Injectable, Logger, NotFoundException, Optional } from "@nestjs/common";
import {
  agentToolRegistry,
  evaluateAgentPolicy,
  getRuntimeAgentManifest,
  runtimeAgentRoles,
  type RuntimeAgentRole
} from "@semse/agents";
import { buildWorkspaceMemoryId, type WorkspaceMemoryRecord } from "@semse/knowledge";
import { type OperatorContext } from "@semse/shared";
import { createOperatorContext } from "@semse/shared";
import {
  appendMessage,
  createThread,
  generateAgentResponse,
  getThread,
  listThreads,
} from "../../common/chat-thread.store.js";
import { type AgentRunRecord, type ChatReply } from "../../common/domain-store.js";
import { buildIdempotencyKey } from "../../common/idempotency.store.js";
import { IdempotencyService } from "../../common/idempotency.service.js";
import { AuditService } from "../../infrastructure/audit/audit.service.js";
import { LLMService, type LLMMessage, type LLMToolDefinition } from "../../infrastructure/llm/llm.service.js";
import { AgentQueueService } from "../../infrastructure/queue/agent-queue.service.js";
import { SseEventBusService } from "../../infrastructure/sse/sse-event-bus.service.js";
import type { OperationalContextService } from "../ai-models/context/operational-context.service.js";
import { OPERATIONAL_CONTEXT_SERVICE } from "../ai-models/context/operational-context.token.js";
import { WorkspaceMemoryRepository } from "../knowledge/workspace-memory.repository.js";
import { AgentApprovalService } from "./agent-approval.service.js";
import { AgentsRepository } from "./agents.repository.js";
import { AgentDelegationRepository } from "./agent-delegation.repository.js";

// ── Assistant preference helpers ──────────────────────────────────────────────

function toneInstruction(tone: string | undefined): string {
  switch (tone) {
    case "formal":    return "Usa un tono formal y profesional. Evita coloquialismos.";
    case "technical": return "Usa un tono técnico con detalles precisos. Incluye métricas, IDs y estados cuando sean relevantes.";
    case "executive": return "Sé extremadamente conciso. Una o dos oraciones máximo por punto. Orientado a decisiones, no a detalles.";
    default:          return "Usa un tono amistoso y accesible. Sé directo pero cálido.";
  }
}

function languageInstruction(lang: string | undefined): string {
  return lang === "en" ? "Respond in English." : "Responde siempre en español.";
}

function verbosityInstruction(verbosity: string | undefined): string {
  switch (verbosity) {
    case "short":    return "Sé muy conciso. Máximo 2-3 líneas por respuesta a menos que el usuario pida más.";
    case "detailed": return "Respuestas completas y detalladas. Explica el razonamiento y da ejemplos cuando ayuden.";
    default:         return "Respuestas de longitud media. Máximo 3 párrafos a menos que se pida más detalle.";
  }
}

function buildSystemPrompt(agentId: string, context: Record<string, unknown> | undefined): string {
  const tone      = typeof context?.assistantTone     === "string" ? context.assistantTone     : undefined;
  const language  = typeof context?.assistantLanguage === "string" ? context.assistantLanguage : undefined;
  const verbosity = typeof context?.assistantVerbosity === "string" ? context.assistantVerbosity : undefined;
  const expertMode = context?.expertMode === true;

  // Build context block (strip assistant prefs from the JSON to avoid duplication)
  const contextForBlock = context ? Object.fromEntries(
    Object.entries(context).filter(([k]) => !["assistantTone","assistantLanguage","assistantVerbosity","expertMode"].includes(k))
  ) : undefined;
  const contextBlock = contextForBlock && Object.keys(contextForBlock).length > 0
    ? `\n\nContexto actual del proyecto:\n${JSON.stringify(contextForBlock, null, 2)}`
    : "";

  const agentPersona: Record<string, string> = {
    "project-copilot": "Eres el copiloto de proyectos de SEMSE, una plataforma de gestión de trabajos de construcción y servicios del hogar con escrow, hitos de pago y resolución de disputas.",
    "marta":   "Eres Marta, agente legal y de cumplimiento de SEMSE especializado en contratos, alcance y riesgos normativos.",
    "felix":   "Eres Felix, agente de evidencias y documentos de SEMSE especializado en validación de trabajo de campo, fotos y soportes.",
    "justus":  "Eres Justus, agente financiero y de disputas de SEMSE especializado en escrow, facturas, cobros y resolución de conflictos.",
    "planner": "Eres Planner, agente de planificación de SEMSE especializado en hitos, secuencia de trabajo y próximos pasos.",
    "pulse":   "Eres Pulse, agente de métricas y salud operativa de SEMSE especializado en KPIs, actividad y desempeño del sistema.",
    "escrow":  "Eres el agente de Escrow de SEMSE. Explicas pagos seguros, liberaciones de fondos y garantías operativas.",
    "legal":   "Eres el agente Legal de SEMSE. Ayudas a interpretar cumplimiento, normativas y cláusulas contractuales.",
    "evidence_coach": "Eres Evidence Coach, agente de SEMSE especializado en documentación de evidencia verificable.",
    "vesper":  "Eres Vesper, agente de seguridad de SEMSE especializado en verificación y prevención de fraude.",
    "assistant": "Eres Prometeo, el asistente central de SEMSE, una plataforma de gestión de trabajos de construcción y servicios.",
  };

  const persona = agentPersona[agentId] ?? agentPersona["assistant"]!;

  const expertNote = expertMode
    ? "\n- Modo experto activo: incluye IDs, estados raw, scores, nombres de herramientas y detalles técnicos cuando sean relevantes."
    : "";

  return `${persona}

Tu rol es ayudar al usuario a entender el estado de su proyecto, interpretar información sobre hitos, pagos y evidencias, y proponer próximas acciones concretas.

Reglas:
- ${languageInstruction(language)}
- ${toneInstruction(tone)}
- ${verbosityInstruction(verbosity)}
- Si el contexto tiene datos específicos del proyecto, úsalos para dar respuestas contextuales.
- No inventes datos que no están en el contexto.
- Para acciones sensibles (liberar pagos, abrir disputas) indica que requieren confirmación del usuario.${expertNote}${contextBlock}`;
}

function asOperatorContext(value: unknown): OperatorContext | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }

  const candidate = value as Record<string, unknown>;
  if (
    typeof candidate.operatorId !== "string" ||
    typeof candidate.tenantId !== "string" ||
    typeof candidate.orgId !== "string" ||
    typeof candidate.source !== "string" ||
    typeof candidate.scope !== "string"
  ) {
    return null;
  }

  return candidate as OperatorContext;
}

function isGovernedRuntimeAgent(agentType: string): agentType is RuntimeAgentRole {
  return runtimeAgentRoles.includes(agentType as RuntimeAgentRole);
}

function isSpecializedWorkerAgentType(agentType: string): agentType is "field-ops" | "project-copilot" | "browser-agent" {
  return agentType === "field-ops" || agentType === "project-copilot" || agentType === "browser-agent";
}

@Injectable()
export class AgentsService {
  private readonly logger = new Logger(AgentsService.name);

  constructor(
    private readonly agentsRepository: AgentsRepository,
    private readonly auditService: AuditService,
    private readonly agentQueueService: AgentQueueService,
    private readonly agentApprovalService: AgentApprovalService,
    private readonly workspaceMemoryRepository: WorkspaceMemoryRepository,
    private readonly idempotencyService: IdempotencyService,
    private readonly llmService: LLMService,
    private readonly agentDelegationRepository: AgentDelegationRepository,
    @Optional() private readonly sseBus?: SseEventBusService,
    @Optional() @Inject(OPERATIONAL_CONTEXT_SERVICE)
    private readonly operationalContext?: OperationalContextService,
  ) {}

  private broadcastDelegationSync(tenantId: string, projectId: string | null | undefined, source: string): void {
    const channel = projectId ? `delegations:${projectId}` : `delegations:${tenantId}`;
    this.sseBus?.emit(channel, "delegations-update", { tenantId, projectId: projectId ?? undefined, ts: Date.now() });
    this.operationalContext?.invalidateScope({
      tenantId,
      projectId,
      source,
      reason: "delegation result changed",
    });
  }

  catalog() {
    return runtimeAgentRoles.map((agentType) => {
      const manifest = getRuntimeAgentManifest(agentType);
      return {
        key: agentType,
        purpose: manifest.description,
        status: manifest.status,
        version: manifest.version,
        maxRiskLevel: manifest.capabilities.maxRiskLevel,
        allowedTools: manifest.capabilities.allowedTools,
        allowedContextSources: manifest.capabilities.allowedContextSources,
        defaultModel: manifest.metadata.defaultModel,
        tags: manifest.metadata.tags
      };
    });
  }

  catalogDetail(agentType: RuntimeAgentRole) {
    const manifest = getRuntimeAgentManifest(agentType);
    return {
      manifest,
      tools: manifest.capabilities.allowedTools.map((toolName) => agentToolRegistry[toolName])
    };
  }

  tools() {
    return Object.values(agentToolRegistry);
  }

  evaluatePolicy(input: Parameters<typeof evaluateAgentPolicy>[0]) {
    return evaluateAgentPolicy(input);
  }

  listApprovals(input: { tenantId: string }) {
    return this.agentApprovalService.list(input);
  }

  detailApproval(input: { tenantId: string; approvalId: string }) {
    return this.agentApprovalService.get(input);
  }

  async decideApproval(input: {
    tenantId: string;
    orgId: string;
    userId: string;
    approvalId: string;
    decision: "approved" | "rejected";
    comment?: string;
    requestId: string;
  }) {
    return this.agentApprovalService.decide(input);
  }

  async list(input: { tenantId: string; orgId: string; userId: string }) {
    return this.agentsRepository.list(input);
  }

  async detail(input: { tenantId: string; orgId: string; userId: string; runId: string }) {
    return this.agentsRepository.findById(input);
  }

  async runEvents(input: { tenantId: string; runId: string }) {
    return this.agentsRepository.getEvents(input);
  }

  async cancelRun(input: { tenantId: string; orgId: string; userId: string; runId: string; requestId: string }) {
    const cancelled = await this.agentsRepository.cancel(input);
    await this.auditService.append({
      tenantId: input.tenantId, orgId: input.orgId, actorUserId: input.userId,
      action: "agent.run.cancel", entityType: "AgentRun", entityId: cancelled.id,
      requestId: input.requestId, timestamp: new Date().toISOString(),
    });
    return cancelled;
  }

  async create(input: {
    tenantId: string;
    orgId: string;
    userId: string;
    roles: string[];
    agentType: AgentRunRecord["agentType"];
    triggerType: AgentRunRecord["triggerType"];
    correlationId: string;
    maxAttempts?: number;
    workspaceId?: string;
    repoId?: string;
    taskId?: string;
    idempotencyKey?: string;
    input?: Record<string, unknown>;
    inputSummary?: string;
    requestId: string;
  }) {
    const policy = isGovernedRuntimeAgent(input.agentType)
      ? evaluateAgentPolicy({
          agentType: input.agentType,
          actionType: "runtime.execute",
          target: input.agentType,
          targetKind: "agent",
          requestedContextSources: ["event"],
          environment: "api"
        })
      : isSpecializedWorkerAgentType(input.agentType)
      ? {
          decision: "allow" as const,
          reason: "Action is handled by a specialized worker runtime",
          riskScore: 0.35,
          riskLevel: "medium" as const,
          violatedPolicies: [],
          requiredApprovals: [],
          auditTags: [`agent:${input.agentType}`, "runtime:specialized-worker"]
        }
      : (() => {
          throw new ForbiddenException(`Unsupported agent type '${input.agentType}'`);
        })();

    if (policy.decision === "deny") {
      throw new ForbiddenException(policy.reason);
    }

    const operatorContext = createOperatorContext({
      source: input.triggerType === "manual" ? "user_session" : "ops_runtime",
      operatorId: input.userId,
      tenantId: input.tenantId,
      orgId: input.orgId,
      roles: input.roles,
      scope: input.taskId ? "task" : input.repoId ? "repo" : input.workspaceId ? "workspace" : "global",
      workspaceId: input.workspaceId,
      repoId: input.repoId,
      taskId: input.taskId
    });

    const run = input.idempotencyKey
      ? await this.createIdempotent({
          ...input,
          input: {
            ...(input.input ?? {}),
            operatorContext
          }
        })
      : await this.agentsRepository.create({
          ...input,
          input: {
            ...(input.input ?? {}),
            operatorContext
          }
        });

    await this.auditService.append({
      tenantId: input.tenantId,
      orgId: input.orgId,
      actorUserId: input.userId,
      action: "agent.run.create",
      entityType: "AgentRun",
      entityId: run.id,
      requestId: input.requestId,
      timestamp: new Date().toISOString(),
      afterJson: {
        policyDecision: policy.decision,
        riskLevel: policy.riskLevel,
        riskScore: policy.riskScore
      }
    });

    await this.agentQueueService.enqueueRun({
      runId: run.id,
      tenantId: run.tenantId,
      agentType: run.agentType,
      correlationId: run.correlationId
    });

    return run;
  }

  async claim(input: {
    tenantId: string;
    orgId: string;
    userId: string;
    workerId: string;
    agentType?: AgentRunRecord["agentType"];
    requestId: string;
  }) {
    const run = await this.agentsRepository.claimNext(input);

    if (run) {
      await this.auditService.append({
        tenantId: input.tenantId,
        orgId: input.orgId,
        actorUserId: input.userId,
        action: "agent.run.claim",
        entityType: "AgentRun",
        entityId: run.id,
        requestId: input.requestId,
        timestamp: new Date().toISOString()
      });
    }

    return run;
  }

  async reclaimStale(input: {
    tenantId: string;
    orgId: string;
    userId: string;
    staleAfterMs: number;
    maxItems?: number;
    requestId: string;
  }) {
    const reclaimed = await this.agentsRepository.reclaimStale(input);

    if (reclaimed.length > 0) {
      await this.auditService.append({
        tenantId: input.tenantId,
        orgId: input.orgId,
        actorUserId: input.userId,
        action: "agent.run.reclaim_stale",
        entityType: "AgentRun",
        entityId: reclaimed.map((entry) => entry.id).join(","),
        requestId: input.requestId,
        timestamp: new Date().toISOString()
      });
    }

    return {
      reclaimedCount: reclaimed.length,
      deadLetteredCount: reclaimed.filter((entry) => entry.deadLettered).length,
      runs: reclaimed
    };
  }

  async retry(input: { tenantId: string; orgId: string; userId: string; runId: string; requestId: string }) {
    const run = await this.agentsRepository.retry(input);

    await this.auditService.append({
      tenantId: input.tenantId,
      orgId: input.orgId,
      actorUserId: input.userId,
      action: "agent.run.retry",
      entityType: "AgentRun",
      entityId: run.id,
      requestId: input.requestId,
      timestamp: new Date().toISOString()
    });

    await this.agentQueueService.enqueueRun({
      runId: run.id,
      tenantId: run.tenantId,
      agentType: run.agentType,
      correlationId: run.correlationId
    });

    return run;
  }

  async start(input: { tenantId: string; orgId: string; userId: string; runId: string; requestId: string }) {
    const run = await this.agentsRepository.start(input);

    await this.auditService.append({
      tenantId: input.tenantId,
      orgId: input.orgId,
      actorUserId: input.userId,
      action: "agent.run.start",
      entityType: "AgentRun",
      entityId: run.id,
      requestId: input.requestId,
      timestamp: new Date().toISOString()
    });

    return run;
  }

  async heartbeat(input: {
    tenantId: string;
    orgId: string;
    userId: string;
    runId: string;
    workerId: string;
    requestId: string;
  }) {
    const run = await this.agentsRepository.heartbeat(input);

    await this.auditService.append({
      tenantId: input.tenantId,
      orgId: input.orgId,
      actorUserId: input.userId,
      action: "agent.run.heartbeat",
      entityType: "AgentRun",
      entityId: run.id,
      requestId: input.requestId,
      timestamp: new Date().toISOString()
    });

    return run;
  }

  async complete(input: {
    tenantId: string;
    orgId: string;
    userId: string;
    runId: string;
    output?: Record<string, unknown>;
    requestId: string;
  }) {
    const run = await this.agentsRepository.complete(input);

    const approvals = Array.isArray(input.output?.approvals)
      ? await this.agentApprovalService.register({
          tenantId: input.tenantId,
          orgId: input.orgId,
          userId: input.userId,
          requestId: input.requestId,
          approvals: input.output.approvals as Parameters<AgentApprovalService["register"]>[0]["approvals"]
        })
      : [];

    await this.auditService.append({
      tenantId: input.tenantId,
      orgId: input.orgId,
      actorUserId: input.userId,
      action: "agent.run.complete",
      entityType: "AgentRun",
      entityId: run.id,
      requestId: input.requestId,
      timestamp: new Date().toISOString(),
      afterJson: approvals.length > 0 ? { approvalsOpened: approvals.map((approval) => approval.id) } : undefined
    });

    await this.recordRunSummary({
      run,
      fallbackActorId: input.userId,
      summary:
        typeof run.output?.summary === "string"
          ? run.output.summary
          : `Agent run completed for '${run.agentType}'`,
      status: "completed"
    });

    if (run.triggerType === "event" && run.input?.delegationId && typeof run.input.delegationId === "string") {
      const delegation = await this.agentDelegationRepository.updateStatus(
        run.input.delegationId,
        input.tenantId,
        "completed",
        input.output
      );
      this.logger.log(`Closed delegation '${run.input.delegationId}' as completed.`);
      this.broadcastDelegationSync(input.tenantId, delegation.projectId, "agents.delegation.completed");
    }

    return run;
  }

  async fail(input: {
    tenantId: string;
    orgId: string;
    userId: string;
    runId: string;
    error: string;
    requestId: string;
  }) {
    const run = await this.agentsRepository.fail(input);

    await this.auditService.append({
      tenantId: input.tenantId,
      orgId: input.orgId,
      actorUserId: input.userId,
      action: "agent.run.fail",
      entityType: "AgentRun",
      entityId: run.id,
      requestId: input.requestId,
      timestamp: new Date().toISOString()
    });

    await this.recordRunSummary({
      run,
      fallbackActorId: input.userId,
      summary: `Agent run failed for '${run.agentType}': ${run.error ?? input.error}`,
      status: "failed"
    });

    if (run.triggerType === "event" && run.input?.delegationId && typeof run.input.delegationId === "string") {
      const delegation = await this.agentDelegationRepository.updateStatus(
        run.input.delegationId,
        input.tenantId,
        "failed",
        undefined,
        run.error ?? input.error
      );
      this.logger.log(`Closed delegation '${run.input.delegationId}' as failed.`);
      this.broadcastDelegationSync(input.tenantId, delegation.projectId, "agents.delegation.failed");
    }

    return run;
  }

  // ── Chat ──────────────────────────────────────────────────────────────────

  async chatWithTools(input: {
    tenantId: string;
    userId: string;
    message: string;
    agentId?: string;
    threadId?: string;
    context?: Record<string, unknown>;
    tools: LLMToolDefinition[];
  }): Promise<ChatReply & { toolCalls: Array<{ toolName: string; toolUseId: string; input: Record<string, unknown> }> }> {
    const agentId = input.agentId ?? "assistant";
    const now = new Date().toISOString();

    let thread = input.threadId ? getThread(input.threadId) : undefined;
    if (!thread) {
      thread = createThread({ tenantId: input.tenantId, userId: input.userId, agentId });
    }

    appendMessage(thread.id, { role: "user", content: input.message, timestamp: now });

    let response: string;
    let mode: ChatReply["mode"] = "runtime";
    let provider: string | undefined;
    let model: string | undefined;
    let toolCalls: Array<{ toolName: string; toolUseId: string; input: Record<string, unknown> }> = [];

    if (this.llmService.isAvailable) {
      try {
        const history: LLMMessage[] = thread.messages
          .slice(0, -1)
          .slice(-20)
          .map((msg) => ({ role: msg.role as "user" | "assistant", content: msg.content }));

        const result = await this.llmService.chatWithTools({
          systemPrompt: buildSystemPrompt(agentId, input.context),
          history,
          userMessage: input.message,
          tools: input.tools,
          maxTokens: 1024,
        });

        response = result.text || generateAgentResponse({ agentId, message: input.message, history: thread.messages, context: input.context });
        toolCalls = result.toolCalls;
        mode = (result.mode as ChatReply["mode"]) ?? "llm";
        provider = result.provider;
        model = result.model;
      } catch (err) {
        this.logger.warn(`[chatWithTools] LLM failed, falling back: ${err instanceof Error ? err.message : String(err)}`);
        response = generateAgentResponse({ agentId, message: input.message, history: thread.messages, context: input.context });
        mode = "fallback";
      }
    } else {
      response = generateAgentResponse({ agentId, message: input.message, history: thread.messages, context: input.context });
    }

    appendMessage(thread.id, { role: "assistant", content: response, timestamp: new Date().toISOString() });

    return { threadId: thread.id, agentId, response, mode, provider, model, timestamp: new Date().toISOString(), toolCalls };
  }

  async chat(input: {
    tenantId: string;
    userId: string;
    message: string;
    agentId?: string;
    threadId?: string;
    context?: Record<string, unknown>;
  }): Promise<ChatReply> {
    const agentId = input.agentId ?? "assistant";
    const now = new Date().toISOString();

    // Resolve or create thread
    let thread = input.threadId ? getThread(input.threadId) : undefined;
    if (!thread) {
      thread = createThread({ tenantId: input.tenantId, userId: input.userId, agentId });
    }

    // Append user message
    appendMessage(thread.id, { role: "user", content: input.message, timestamp: now });

    let response: string;
    let mode: ChatReply["mode"] = "runtime";

    if (this.llmService.isAvailable) {
      try {
        const history: LLMMessage[] = thread.messages
          .slice(0, -1) // exclude the message we just appended
          .slice(-20)   // cap history to last 20 messages
          .map((msg) => ({ role: msg.role as "user" | "assistant", content: msg.content }));

        const systemPrompt = buildSystemPrompt(agentId, input.context);
        const result = await this.llmService.chat({
          systemPrompt,
          history,
          userMessage: input.message,
          maxTokens: 1024,
        });

        response = result.text || generateAgentResponse({ agentId, message: input.message, history: thread.messages, context: input.context });
        mode = "llm";

        if (result.cacheReadTokens) {
          this.logger.debug(`[chat] cache_read=${result.cacheReadTokens} cache_created=${result.cacheCreationTokens ?? 0}`);
        }
      } catch (err) {
        this.logger.warn(`[chat] LLM call failed, falling back to template: ${err instanceof Error ? err.message : String(err)}`);
        response = generateAgentResponse({ agentId, message: input.message, history: thread.messages, context: input.context });
      }
    } else {
      response = generateAgentResponse({ agentId, message: input.message, history: thread.messages, context: input.context });
    }

    // Append assistant message
    appendMessage(thread.id, { role: "assistant", content: response, timestamp: new Date().toISOString() });

    return { threadId: thread.id, agentId, response, mode, timestamp: new Date().toISOString() };
  }

  getThreadMessages(input: { tenantId: string; userId: string; threadId: string }) {
    const thread = getThread(input.threadId);
    if (!thread || thread.tenantId !== input.tenantId) {
      throw new NotFoundException(`Thread '${input.threadId}' not found`);
    }
    return thread;
  }

  getThreadList(input: { tenantId: string; userId: string }) {
    return listThreads(input);
  }

  private async createIdempotent(input: {
    tenantId: string;
    orgId: string;
    userId: string;
    agentType: AgentRunRecord["agentType"];
    triggerType: AgentRunRecord["triggerType"];
    correlationId: string;
    maxAttempts?: number;
    workspaceId?: string;
    repoId?: string;
    taskId?: string;
    idempotencyKey?: string;
    input?: Record<string, unknown>;
    inputSummary?: string;
  }) {
    const key = buildIdempotencyKey([
      "agent.run.create",
      input.tenantId,
      input.agentType,
      input.correlationId,
      input.idempotencyKey ?? ""
    ]);

    const existingRunId = await this.idempotencyService.get<string>(input.tenantId, key);
    if (existingRunId) {
      const existing = await this.agentsRepository.findById({
        tenantId: input.tenantId,
        orgId: input.orgId,
        userId: input.userId,
        runId: existingRunId
      }).catch(() => null);
      if (existing) return existing;
    }

    const created = await this.agentsRepository.create(input);
    await this.idempotencyService.set(input.tenantId, key, created.id);
    return created;
  }

  private async recordRunSummary(input: {
    run: AgentRunRecord;
    fallbackActorId: string;
    summary: string;
    status: "completed" | "failed";
  }): Promise<void> {
    const operatorContext = asOperatorContext(input.run.input?.operatorContext);
    if (!operatorContext?.workspaceId) {
      return;
    }

    const timestamp = new Date().toISOString();
    const record: WorkspaceMemoryRecord = {
      id: buildWorkspaceMemoryId({
        workspaceId: operatorContext.workspaceId,
        kind: "run_summary",
        slug: input.run.id.replace(/[^a-zA-Z0-9_-]/g, "-")
      }),
      tenantId: operatorContext.tenantId,
      orgId: operatorContext.orgId,
      createdBy: operatorContext.operatorId || input.fallbackActorId,
      workspaceId: operatorContext.workspaceId,
      repoId: operatorContext.repoId,
      runId: input.run.id,
      taskId: operatorContext.taskId,
      kind: "run_summary",
      scope: operatorContext.taskId ? "task" : operatorContext.repoId ? "repo" : "workspace",
      title: `Agent run ${input.status}: ${input.run.agentType}`,
      summary: input.summary,
      body: [
        `Agent: ${input.run.agentType}`,
        `Trigger: ${input.run.triggerType}`,
        input.run.output && typeof input.run.output.actionType === "string" ? `Action: ${input.run.output.actionType}` : null,
        input.run.output && typeof input.run.output.recommendation === "string" ? `Recommendation: ${input.run.output.recommendation}` : null,
        input.run.error ? `Error: ${input.run.error}` : null
      ]
        .filter(Boolean)
        .join("\n"),
      tags: ["agent-runtime", "run-summary", input.run.agentType, input.status],
      sourceRef: input.run.correlationId,
      updatedAtIso: timestamp
    };

    await this.workspaceMemoryRepository.append(record);
  }
}
