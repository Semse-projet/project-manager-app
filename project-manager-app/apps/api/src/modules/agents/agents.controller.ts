import { BadRequestException, Body, Controller, Get, Logger, Param, Post, Query, Req, Patch } from "@nestjs/common";
import { SkipThrottle } from "@nestjs/throttler";
import { agentCatalog } from "@semse/agents";
import {
  agentApprovalDecisionSchema,
  agentApprovalIdParamSchema,
  agentPolicyEvaluationSchema,
  agentTypeParamSchema
} from "@semse/schemas";
import { z } from "zod";
import { ok } from "../../common/api-response.js";
import { parseWithSchema } from "../../common/zod-validation.js";
import { RequirePermissions } from "../../common/permissions.decorator.js";
import { resolveRequestContext } from "../../common/request-context.js";
import { resolveRequestId } from "../../common/request-id.js";
import { AgentsService } from "./agents.service.js";
import { CoordinatorService } from "./coordinator.service.js";
import { PlanTemplatesService } from "./plan-templates.service.js";
import { ProjectCopilotHarness } from "./harnesses/project-copilot.harness.js";
import type { ProjectCopilotHarnessInput } from "./harnesses/project-copilot.types.js";
import { PlanModeService } from "./plan-mode.service.js";

const chatSchema = z.object({
  message:  z.string().min(1),
  agentId:  z.string().optional(),
  threadId: z.string().optional(),
  context:  z.record(z.unknown()).optional(),
});

const createAgentRunSchema = z.object({
  agentType: z.enum(agentCatalog),
  triggerType: z.enum(["manual", "event", "schedule"]).default("manual"),
  correlationId: z.string().min(1),
  maxAttempts: z.number().int().positive().max(10).optional(),
  workspaceId: z.string().min(1).max(120).optional(),
  repoId: z.string().min(1).max(200).optional(),
  taskId: z.string().min(1).max(200).optional(),
  input: z.record(z.unknown()).optional(),
  inputSummary: z.string().min(1).max(500).optional()
});

const claimAgentRunSchema = z.object({
  workerId: z.string().min(1),
  agentType: z.enum(agentCatalog).optional()
});

const heartbeatSchema = z.object({
  workerId: z.string().min(1)
});

const reclaimSchema = z.object({
  staleAfterMs: z.number().int().positive().default(10000),
  maxItems: z.number().int().positive().max(500).optional()
});

const completeRunSchema = z.object({
  output: z.record(z.unknown()).optional()
});

const failRunSchema = z.object({
  error: z.string().min(1, "error message is required"),
  details: z.record(z.unknown()).optional()
});

const copilotInputSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("chat"),    projectId: z.string(), message: z.string().min(1), threadId: z.string().optional() }),
  z.object({ kind: z.literal("search"),  projectId: z.string(), query: z.string().min(1), topK: z.number().int().positive().max(50).optional() }),
  z.object({ kind: z.literal("action"),  projectId: z.string(), actionType: z.string(), payload: z.record(z.unknown()).optional().default({}) }),
  z.object({ kind: z.literal("refresh"), projectId: z.string() }),
]);

const stepMutationSchema = z.object({
  evidenceCount: z.number().int().nonnegative().optional(),
});

const stepBlockSchema = stepMutationSchema.extend({
  reason: z.string().min(1).default("Bloqueado manualmente por el operador."),
});

const stepSkipSchema = z.object({
  reason: z.string().optional(),
});

const listPlansSchema = z.object({
  projectId: z.string().min(1),
});

@Controller("v1/agents")
export class AgentsController {
  private readonly logger = new Logger(AgentsController.name);

  constructor(
    private readonly agentsService: AgentsService,
    private readonly projectCopilotHarness: ProjectCopilotHarness,
    private readonly planModeService: PlanModeService,
    private readonly coordinatorService: CoordinatorService,
    private readonly planTemplatesService: PlanTemplatesService,
  ) {}

  @Get("catalog")
  @RequirePermissions("agents:run:create")
  catalog(@Req() req: { headers?: Record<string, unknown> }) {
    return ok(resolveRequestId(req.headers ?? {}), this.agentsService.catalog());
  }

  @Get("catalog/:agentType")
  @RequirePermissions("agents:run:create")
  catalogDetail(@Req() req: { headers?: Record<string, unknown> }, @Param("agentType") agentType: string) {
    const parsedParams = parseWithSchema(agentTypeParamSchema, { agentType });
    return ok(resolveRequestId(req.headers ?? {}), this.agentsService.catalogDetail(parsedParams.agentType));
  }

  @Get("tools")
  @RequirePermissions("agents:run:create")
  tools(@Req() req: { headers?: Record<string, unknown> }) {
    return ok(resolveRequestId(req.headers ?? {}), this.agentsService.tools());
  }

  @Post("policy/evaluate")
  @RequirePermissions("agents:run:create")
  evaluatePolicy(@Req() req: { headers?: Record<string, unknown> }, @Body() body: unknown) {
    const parsed = parseWithSchema(agentPolicyEvaluationSchema, body);
    return ok(resolveRequestId(req.headers ?? {}), this.agentsService.evaluatePolicy(parsed));
  }

  @Get("approvals")
  @RequirePermissions("ops:dashboard:read")
  listApprovals(@Req() req: { headers?: Record<string, unknown> }) {
    const actor = resolveRequestContext(req);
    return ok(resolveRequestId(req.headers ?? {}), this.agentsService.listApprovals({ tenantId: actor.tenantId }));
  }

  @Get("approvals/:approvalId")
  @RequirePermissions("ops:dashboard:read")
  detailApproval(@Req() req: { headers?: Record<string, unknown> }, @Param("approvalId") approvalId: string) {
    const actor = resolveRequestContext(req);
    const parsedParams = parseWithSchema(agentApprovalIdParamSchema, { approvalId });
    return ok(resolveRequestId(req.headers ?? {}), this.agentsService.detailApproval({
      tenantId: actor.tenantId,
      approvalId: parsedParams.approvalId
    }));
  }

  @Post("approvals/:approvalId/decision")
  @RequirePermissions("ops:dashboard:write")
  async decideApproval(
    @Req() req: { headers?: Record<string, unknown> },
    @Param("approvalId") approvalId: string,
    @Body() body: unknown
  ) {
    const actor = resolveRequestContext(req);
    const requestId = resolveRequestId(req.headers ?? {});
    const parsedParams = parseWithSchema(agentApprovalIdParamSchema, { approvalId });
    const parsedBody = parseWithSchema(agentApprovalDecisionSchema, body);

    const approval = await this.agentsService.decideApproval({
      tenantId: actor.tenantId,
      orgId: actor.orgId,
      userId: actor.userId,
      approvalId: parsedParams.approvalId,
      decision: parsedBody.decision,
      comment: parsedBody.comment,
      requestId,
    });

    // Encadenar ejecución real cuando se aprueba una acción de copiloto pendiente
    let executionResult: { executed: boolean; summary: string; error?: string } | undefined;
    if (parsedBody.decision === "approved" && approval.correlationId.startsWith("copilot:")) {
      executionResult = await this.projectCopilotHarness.executeFromApproval(
        { tenantId: actor.tenantId, orgId: actor.orgId, userId: actor.userId, roles: actor.roles },
        requestId,
        approval
      );
    }

    return ok(requestId, { ...approval, executionResult });
  }

  // ── Chat ──────────────────────────────────────────────────────────────────

  @Post("chat")
  @RequirePermissions("agents:run:create")
  async chat(
    @Req() req: { headers?: Record<string, unknown> },
    @Body() body: Record<string, unknown>,
  ) {
    const parsed = chatSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    const actor = resolveRequestContext(req);
    const reply = await this.agentsService.chat({
      tenantId: actor.tenantId,
      userId:   actor.userId,
      ...parsed.data,
    });
    return ok(resolveRequestId(req.headers ?? {}), reply);
  }

  @Get("threads")
  @RequirePermissions("agents:run:create")
  listThreads(@Req() req: { headers?: Record<string, unknown> }) {
    const actor = resolveRequestContext(req);
    const threads = this.agentsService.getThreadList({ tenantId: actor.tenantId, userId: actor.userId });
    return ok(resolveRequestId(req.headers ?? {}), threads);
  }

  @Get("threads/:threadId")
  @RequirePermissions("agents:run:create")
  getThread(
    @Req() req: { headers?: Record<string, unknown> },
    @Param("threadId") threadId: string,
  ) {
    const actor = resolveRequestContext(req);
    const thread = this.agentsService.getThreadMessages({ tenantId: actor.tenantId, userId: actor.userId, threadId });
    return ok(resolveRequestId(req.headers ?? {}), thread);
  }

  // ── Runs ──────────────────────────────────────────────────────────────────

  @Get("runs")
  @SkipThrottle()
  @RequirePermissions("agents:run:create")
  async listRuns(@Req() req: { headers?: Record<string, unknown> }) {
    const actor = resolveRequestContext(req);
    const runs = await this.agentsService.list({
      tenantId: actor.tenantId,
      orgId: actor.orgId,
      userId: actor.userId
    });
    return ok(resolveRequestId(req.headers ?? {}), runs);
  }

  @Get("runs/:runId")
  @RequirePermissions("agents:run:create")
  async detail(@Req() req: { headers?: Record<string, unknown> }, @Param("runId") runId: string) {
    const actor = resolveRequestContext(req);
    const run = await this.agentsService.detail({
      tenantId: actor.tenantId,
      orgId: actor.orgId,
      userId: actor.userId,
      runId
    });
    return ok(resolveRequestId(req.headers ?? {}), run);
  }

  @Get("runs/:runId/worker")
  @SkipThrottle()
  @RequirePermissions("agents:run:worker")
  async workerDetail(@Req() req: { headers?: Record<string, unknown> }, @Param("runId") runId: string) {
    const actor = resolveRequestContext(req);
    const run = await this.agentsService.detail({
      tenantId: actor.tenantId,
      orgId: actor.orgId,
      userId: actor.userId,
      runId
    });
    return ok(resolveRequestId(req.headers ?? {}), run);
  }

  @Post("runs")
  @RequirePermissions("agents:run:create")
  async createRun(@Req() req: { headers?: Record<string, unknown> }, @Body() body: Record<string, unknown>) {
    const parsed = createAgentRunSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }

    const actor = resolveRequestContext(req);
    const requestId = resolveRequestId(req.headers ?? {});
    const idempotencyHeader = req.headers?.["x-idempotency-key"];
    const idempotencyKey = typeof idempotencyHeader === "string" ? idempotencyHeader : undefined;

    const run = await this.agentsService.create({
      tenantId: actor.tenantId,
      orgId: actor.orgId,
      userId: actor.userId,
      roles: actor.roles,
      agentType: parsed.data.agentType,
      triggerType: parsed.data.triggerType,
      correlationId: parsed.data.correlationId,
      maxAttempts: parsed.data.maxAttempts,
      workspaceId: parsed.data.workspaceId,
      repoId: parsed.data.repoId,
      taskId: parsed.data.taskId,
      input: parsed.data.input,
      inputSummary: parsed.data.inputSummary,
      idempotencyKey,
      requestId
    });

    return ok(requestId, run);
  }

  @Post("runs/claim")
  @SkipThrottle()
  @RequirePermissions("agents:run:worker")
  async claim(@Req() req: { headers?: Record<string, unknown> }, @Body() body: Record<string, unknown>) {
    const parsed = claimAgentRunSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }

    const actor = resolveRequestContext(req);
    const requestId = resolveRequestId(req.headers ?? {});
    const run = await this.agentsService.claim({
      tenantId: actor.tenantId,
      orgId: actor.orgId,
      userId: actor.userId,
      workerId: parsed.data.workerId,
      agentType: parsed.data.agentType,
      requestId
    });

    return ok(requestId, run);
  }

  @Post("runs/reclaim-stale")
  @SkipThrottle()
  @RequirePermissions("agents:run:worker")
  async reclaimStale(@Req() req: { headers?: Record<string, unknown> }, @Body() body: Record<string, unknown>) {
    const parsed = reclaimSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }

    const actor = resolveRequestContext(req);
    const requestId = resolveRequestId(req.headers ?? {});
    const reclaimed = await this.agentsService.reclaimStale({
      tenantId: actor.tenantId,
      orgId: actor.orgId,
      userId: actor.userId,
      staleAfterMs: parsed.data.staleAfterMs,
      maxItems: parsed.data.maxItems,
      requestId
    });

    return ok(requestId, reclaimed);
  }

  @Post("runs/:runId/retry")
  @RequirePermissions("agents:run:retry")
  async retry(@Req() req: { headers?: Record<string, unknown> }, @Param("runId") runId: string) {
    const actor = resolveRequestContext(req);
    const requestId = resolveRequestId(req.headers ?? {});
    const run = await this.agentsService.retry({
      tenantId: actor.tenantId,
      orgId: actor.orgId,
      userId: actor.userId,
      runId,
      requestId
    });

    return ok(requestId, run);
  }

  @Post("runs/:runId/start")
  @SkipThrottle()
  @RequirePermissions("agents:run:manage")
  async start(@Req() req: { headers?: Record<string, unknown> }, @Param("runId") runId: string) {
    const actor = resolveRequestContext(req);
    const requestId = resolveRequestId(req.headers ?? {});
    this.logger.warn(
      `[agent.run.start] ${JSON.stringify({
        runId,
        requestId,
        actorTenantId: actor.tenantId,
        actorOrgId: actor.orgId,
        actorUserId: actor.userId,
        rawTenantIdHeader: req.headers?.["x-tenant-id"],
        rawOrgIdHeader: req.headers?.["x-org-id"],
        rawUserIdHeader: req.headers?.["x-user-id"],
        rawRolesHeader: req.headers?.["x-roles"]
      })}`
    );
    const run = await this.agentsService.start({
      tenantId: actor.tenantId,
      orgId: actor.orgId,
      userId: actor.userId,
      runId,
      requestId
    });
    return ok(requestId, run);
  }

  @Post("runs/:runId/heartbeat")
  @SkipThrottle()
  @RequirePermissions("agents:run:worker")
  async heartbeat(
    @Req() req: { headers?: Record<string, unknown> },
    @Param("runId") runId: string,
    @Body() body: Record<string, unknown>
  ) {
    const parsed = heartbeatSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }
    const actor = resolveRequestContext(req);
    const requestId = resolveRequestId(req.headers ?? {});
    const run = await this.agentsService.heartbeat({
      tenantId: actor.tenantId,
      orgId: actor.orgId,
      userId: actor.userId,
      runId,
      workerId: parsed.data.workerId,
      requestId
    });
    return ok(requestId, run);
  }

  @Post("runs/:runId/complete")
  @SkipThrottle()
  @RequirePermissions("agents:run:manage")
  async complete(
    @Req() req: { headers?: Record<string, unknown> },
    @Param("runId") runId: string,
    @Body() body: unknown
  ) {
    const parsed = parseWithSchema(completeRunSchema, body);
    const actor = resolveRequestContext(req);
    const requestId = resolveRequestId(req.headers ?? {});
    const run = await this.agentsService.complete({
      tenantId: actor.tenantId,
      runId,
      orgId: actor.orgId,
      userId: actor.userId,
      output: parsed.output,
      requestId
    });
    return ok(requestId, run);
  }

  @Post("runs/:runId/fail")
  @SkipThrottle()
  @RequirePermissions("agents:run:manage")
  async fail(
    @Req() req: { headers?: Record<string, unknown> },
    @Param("runId") runId: string,
    @Body() body: unknown
  ) {
    const parsed = parseWithSchema(failRunSchema, body);
    const actor = resolveRequestContext(req);
    const requestId = resolveRequestId(req.headers ?? {});
    const run = await this.agentsService.fail({
      tenantId: actor.tenantId,
      runId,
      orgId: actor.orgId,
      userId: actor.userId,
      error: parsed.error,
      requestId
    });
    return ok(requestId, run);
  }

  // ── Work Plans ────────────────────────────────────────────────────────────

  @Get("plans")
  @RequirePermissions("agents:run:create")
  async listPlans(@Req() req: { headers?: Record<string, unknown> }) {
    const actor = resolveRequestContext(req);
    const { projectId } = parseWithSchema(listPlansSchema, {
      projectId: req.headers?.["x-project-id"] ?? ""
    });
    const data = await this.planModeService.listByProject(actor.tenantId, projectId);
    return ok(resolveRequestId(req.headers ?? {}), data);
  }

  @Get("plans/:planId")
  @RequirePermissions("agents:run:create")
  async getPlan(@Req() req: { headers?: Record<string, unknown> }, @Param("planId") planId: string) {
    const actor = resolveRequestContext(req);
    const data = await this.planModeService.getPlanById(actor.tenantId, planId);
    return ok(resolveRequestId(req.headers ?? {}), data);
  }

  @Patch("plans/:planId/approve")
  @RequirePermissions("agents:run:create")
  async approvePlan(@Req() req: { headers?: Record<string, unknown> }, @Param("planId") planId: string) {
    const actor = resolveRequestContext(req);
    const requestId = resolveRequestId(req.headers ?? {});
    const data = await this.planModeService.approvePlan({ tenantId: actor.tenantId, orgId: actor.orgId, planId, userId: actor.userId });
    return ok(requestId, data);
  }

  @Patch("plans/:planId/reject")
  @RequirePermissions("agents:run:create")
  async rejectPlan(@Req() req: { headers?: Record<string, unknown> }, @Param("planId") planId: string) {
    const actor = resolveRequestContext(req);
    const requestId = resolveRequestId(req.headers ?? {});
    const data = await this.planModeService.rejectPlan({ tenantId: actor.tenantId, planId, userId: actor.userId });
    return ok(requestId, data);
  }

  @Patch("plans/:planId/cancel")
  @RequirePermissions("agents:run:create")
  async cancelPlan(@Req() req: { headers?: Record<string, unknown> }, @Param("planId") planId: string) {
    const actor = resolveRequestContext(req);
    const requestId = resolveRequestId(req.headers ?? {});
    const data = await this.planModeService.cancelPlan({ tenantId: actor.tenantId, planId, userId: actor.userId });
    return ok(requestId, data);
  }

  @Patch("plans/:planId/steps/:stepId/start")
  @RequirePermissions("agents:run:create")
  async startPlanStep(
    @Req() req: { headers?: Record<string, unknown> },
    @Param("planId") planId: string,
    @Param("stepId") stepId: string,
    @Body() body: unknown,
  ) {
    const actor = resolveRequestContext(req);
    const requestId = resolveRequestId(req.headers ?? {});
    const parsed = stepMutationSchema.parse(body ?? {});
    const data = await this.planModeService.startStep({
      tenantId: actor.tenantId,
      planId,
      stepId,
      evidenceCount: parsed.evidenceCount,
    });
    return ok(requestId, data);
  }

  @Patch("plans/:planId/steps/:stepId/complete")
  @RequirePermissions("agents:run:create")
  async completePlanStep(
    @Req() req: { headers?: Record<string, unknown> },
    @Param("planId") planId: string,
    @Param("stepId") stepId: string,
    @Body() body: unknown,
  ) {
    const actor = resolveRequestContext(req);
    const requestId = resolveRequestId(req.headers ?? {});
    const parsed = stepMutationSchema.parse(body ?? {});
    const data = await this.planModeService.completeExecutableStep({
      tenantId: actor.tenantId,
      planId,
      stepId,
      evidenceCount: parsed.evidenceCount,
    });
    return ok(requestId, data);
  }

  @Patch("plans/:planId/steps/:stepId/block")
  @RequirePermissions("agents:run:create")
  async blockPlanStep(
    @Req() req: { headers?: Record<string, unknown> },
    @Param("planId") planId: string,
    @Param("stepId") stepId: string,
    @Body() body: unknown,
  ) {
    const actor = resolveRequestContext(req);
    const requestId = resolveRequestId(req.headers ?? {});
    const parsed = stepBlockSchema.parse(body ?? {});
    const data = await this.planModeService.blockStep({
      tenantId: actor.tenantId,
      planId,
      stepId,
      reason: parsed.reason,
    });
    return ok(requestId, data);
  }

  @Patch("plans/:planId/steps/:stepId/retry")
  @RequirePermissions("agents:run:create")
  async retryPlanStep(
    @Req() req: { headers?: Record<string, unknown> },
    @Param("planId") planId: string,
    @Param("stepId") stepId: string,
    @Body() body: unknown,
  ) {
    const actor = resolveRequestContext(req);
    const requestId = resolveRequestId(req.headers ?? {});
    const parsed = stepMutationSchema.parse(body ?? {});
    const data = await this.planModeService.retryStep({
      tenantId: actor.tenantId,
      planId,
      stepId,
      evidenceCount: parsed.evidenceCount,
    });
    return ok(requestId, data);
  }

  @Patch("plans/:planId/steps/:stepId/skip")
  @RequirePermissions("agents:run:create")
  async skipPlanStep(
    @Req() req: { headers?: Record<string, unknown> },
    @Param("planId") planId: string,
    @Param("stepId") stepId: string,
    @Body() body: unknown,
  ) {
    const actor = resolveRequestContext(req);
    const requestId = resolveRequestId(req.headers ?? {});
    const parsed = stepSkipSchema.parse(body ?? {});
    const data = await this.planModeService.skipStep({
      tenantId: actor.tenantId,
      planId,
      stepId,
      reason: parsed.reason,
    });
    return ok(requestId, data);
  }

  // ── Coordinator / Delegations ────────────────────────────────────────────

  @Get("delegations")
  @RequirePermissions("agents:run:create")
  async listDelegations(@Req() req: { headers?: Record<string, unknown> }) {
    const actor = resolveRequestContext(req);
    const headers = req.headers ?? {};
    const projectId = typeof headers["x-project-id"] === "string" ? headers["x-project-id"] : undefined;
    const data = projectId
      ? await this.coordinatorService.listByProject({ tenantId: actor.tenantId, projectId })
      : await this.coordinatorService.collectProjectSnapshot({
          tenantId: actor.tenantId,
          coordinatorId: "project-copilot",
          projectId: projectId ?? "",
        }).catch(() => ({ delegations: [], totalDelegations: 0, completed: 0, executing: 0, pending: 0, failed: 0, contextBlock: "" }));
    return ok(resolveRequestId(headers), data);
  }

  @Get("delegations/:delegationId")
  @RequirePermissions("agents:run:create")
  async getDelegation(
    @Req() req: { headers?: Record<string, unknown> },
    @Param("delegationId") delegationId: string,
  ) {
    const actor = resolveRequestContext(req);
    const data = await this.coordinatorService.getTask({ tenantId: actor.tenantId, delegationId });
    return ok(resolveRequestId(req.headers ?? {}), data);
  }

  @Get("coordinator/snapshot")
  @RequirePermissions("agents:run:create")
  async coordinatorSnapshot(@Req() req: { headers?: Record<string, unknown> }) {
    const actor = resolveRequestContext(req);
    const headers = req.headers ?? {};
    const projectId = typeof headers["x-project-id"] === "string" ? headers["x-project-id"] : "";
    const data = await this.coordinatorService.collectProjectSnapshot({
      tenantId: actor.tenantId,
      coordinatorId: "project-copilot",
      projectId,
    });
    return ok(resolveRequestId(headers), data);
  }

  // ── Project Copilot ───────────────────────────────────────────────────────

  @Post("copilot")
  @RequirePermissions("agents:run:create")
  async copilot(
    @Req() req: { headers?: Record<string, unknown> },
    @Body() body: unknown
  ) {
    const parsed = parseWithSchema(copilotInputSchema, body);
    const actor = resolveRequestContext(req);
    const requestId = resolveRequestId(req.headers ?? {});
    const result = await this.projectCopilotHarness.run(
      { tenantId: actor.tenantId, orgId: actor.orgId, userId: actor.userId, roles: actor.roles },
      requestId,
      parsed as ProjectCopilotHarnessInput
    );
    return ok(requestId, result);
  }

  // ── Plan Templates ─────────────────────────────────────────────────────────

  @Get("plan-templates")
  @RequirePermissions("agents:run:create")
  listPlanTemplates(
    @Req() req: { headers?: Record<string, unknown> },
    @Query("category") category?: string,
  ) {
    const requestId = resolveRequestId(req.headers ?? {});
    return ok(requestId, this.planTemplatesService.listTemplates(category));
  }

  @Get("plan-templates/categories")
  @RequirePermissions("agents:run:create")
  getPlanTemplateCategories(@Req() req: { headers?: Record<string, unknown> }) {
    const requestId = resolveRequestId(req.headers ?? {});
    return ok(requestId, this.planTemplatesService.getCategories());
  }

  @Get("plan-templates/:templateId")
  @RequirePermissions("agents:run:create")
  getPlanTemplate(
    @Req() req: { headers?: Record<string, unknown> },
    @Param("templateId") templateId: string,
  ) {
    const requestId = resolveRequestId(req.headers ?? {});
    const template = this.planTemplatesService.getTemplate(templateId);
    if (!template) {
      return ok(requestId, null);
    }
    return ok(requestId, template);
  }
}
