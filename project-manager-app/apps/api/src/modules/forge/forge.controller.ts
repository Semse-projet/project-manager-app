import { Body, Controller, Get, Param, Post, Req } from "@nestjs/common";
import { z } from "zod";
import type { ForgeApprovalMode, ForgeRunState, ForgeTaskPacket } from "@semse/forge";
import { ok } from "../../common/api-response.js";
import { parseWithSchema } from "../../common/zod-validation.js";
import { RequirePermissions } from "../../common/permissions.decorator.js";
import { resolveRequestContext } from "../../common/request-context.js";
import { resolveRequestId } from "../../common/request-id.js";
import { ForgeService } from "./forge.service.js";

const specSchema = z.object({
  id: z.string().min(1),
  path: z.string().min(1),
  digest: z.string().min(1),
  status: z.enum(["DRAFT", "REVIEW", "APPROVED", "IMPLEMENTED", "VERIFIED"]).default("DRAFT")
});

const acceptanceCriterionSchema = z.object({
  id: z.string().min(1),
  statement: z.string().min(1),
  verification: z.string().min(1),
  required: z.boolean().default(true)
});

const taskPacketSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  spec: specSchema,
  requestedRole: z.string().min(1),
  riskLevel: z.enum(["low", "medium", "high", "critical"]),
  objective: z.string().min(1),
  allowedFiles: z.array(z.string()),
  forbiddenFiles: z.array(z.string()).default([]),
  allowedCommands: z.array(z.string()),
  acceptanceCriteria: z.array(acceptanceCriterionSchema).default([]),
  dependencies: z.array(z.string()).default([]),
  targetBranch: z.string().min(1),
  environment: z.enum(["sandbox", "local", "ci", "staging", "production"]),
  metadata: z.record(z.string()).default({})
});

const createRunSchema = z.object({
  title: z.string().min(1).max(200),
  spec: specSchema
});

const transitionSchema = z.object({
  next: z.string().min(1)
});

const addTaskSchema = z.object({
  task: taskPacketSchema
});

const executeTaskSchema = z.object({
  action: z.string().optional()
});

const approvalDecisionSchema = z.object({
  decision: z.enum(["approved", "rejected"])
});

@Controller("v1/forge")
@RequirePermissions("ops:dashboard:read")
export class ForgeController {
  constructor(private readonly forgeService: ForgeService) {}

  @Post("runs")
  @RequirePermissions("agents:run:create")
  async createRun(@Req() req: { headers?: Record<string, unknown> }, @Body() body: unknown) {
    const parsed = parseWithSchema(createRunSchema, body);
    const actor = resolveRequestContext(req);
    const requestId = resolveRequestId(req.headers ?? {});
    const spec = { ...parsed.spec, status: parsed.spec.status ?? "DRAFT" };
    const run = await this.forgeService.create({ actor, title: parsed.title, spec, requestId });
    return ok(requestId, run);
  }

  @Get("runs")
  async listRuns(@Req() req: { headers?: Record<string, unknown> }) {
    const actor = resolveRequestContext(req);
    const requestId = resolveRequestId(req.headers ?? {});
    const runs = await this.forgeService.list(actor.tenantId);
    return ok(requestId, runs);
  }

  @Get("runs/:runId")
  async detailRun(@Req() req: { headers?: Record<string, unknown> }, @Param("runId") runId: string) {
    const actor = resolveRequestContext(req);
    const requestId = resolveRequestId(req.headers ?? {});
    const run = await this.forgeService.findById({ tenantId: actor.tenantId, runId });
    return ok(requestId, run);
  }

  @Post("runs/:runId/transitions")
  @RequirePermissions("ops:dashboard:write")
  async transition(
    @Req() req: { headers?: Record<string, unknown> },
    @Param("runId") runId: string,
    @Body() body: unknown
  ) {
    const parsed = parseWithSchema(transitionSchema, body);
    const actor = resolveRequestContext(req);
    const requestId = resolveRequestId(req.headers ?? {});
    const run = await this.forgeService.transition({ actor, runId, next: parsed.next as ForgeRunState, requestId });
    return ok(requestId, run);
  }

  @Post("runs/:runId/tasks")
  @RequirePermissions("ops:dashboard:write")
  async addTask(
    @Req() req: { headers?: Record<string, unknown> },
    @Param("runId") runId: string,
    @Body() body: unknown
  ) {
    const parsed = parseWithSchema(addTaskSchema, body);
    const actor = resolveRequestContext(req);
    const requestId = resolveRequestId(req.headers ?? {});
    const run = await this.forgeService.addTask({ actor, runId, task: parsed.task as ForgeTaskPacket, requestId });
    return ok(requestId, run);
  }

  @Post("runs/:runId/tasks/:taskId/execute")
  @RequirePermissions("agents:run:create")
  async executeTask(
    @Req() req: { headers?: Record<string, unknown> },
    @Param("runId") runId: string,
    @Param("taskId") taskId: string,
    @Body() body: unknown
  ) {
    const parsed = parseWithSchema(executeTaskSchema, body);
    const actor = resolveRequestContext(req);
    const requestId = resolveRequestId(req.headers ?? {});
    const result = await this.forgeService.executeTask({ actor, runId, taskId, action: parsed.action, requestId });
    return ok(requestId, result);
  }

  @Post("runs/:runId/approvals/:mode/decide")
  @RequirePermissions("ops:dashboard:write")
  async decideApproval(
    @Req() req: { headers?: Record<string, unknown> },
    @Param("runId") runId: string,
    @Param("mode") mode: string,
    @Body() body: unknown
  ) {
    const parsed = parseWithSchema(approvalDecisionSchema, body);
    const actor = resolveRequestContext(req);
    const requestId = resolveRequestId(req.headers ?? {});
    const run = await this.forgeService.decideApproval({
      actor,
      runId,
      mode: mode as ForgeApprovalMode,
      decision: parsed.decision,
      requestId
    });
    return ok(requestId, run);
  }

  @Get("mission-control")
  async missionControl(@Req() req: { headers?: Record<string, unknown> }) {
    const actor = resolveRequestContext(req);
    const requestId = resolveRequestId(req.headers ?? {});
    const summary = await this.forgeService.missionControl({ tenantId: actor.tenantId });
    return ok(requestId, summary);
  }
}
