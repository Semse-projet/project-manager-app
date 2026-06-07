import { Body, Controller, Get, Param, Post, Req } from "@nestjs/common";
import { autonomyRunIdParamSchema, continueAutonomyRunSchema, createAutonomyRunSchema } from "@semse/schemas";
import { ok } from "../../common/api-response.js";
import { RequirePermissions } from "../../common/permissions.decorator.js";
import { resolveRequestContext } from "../../common/request-context.js";
import { resolveRequestId } from "../../common/request-id.js";
import { parseWithSchema } from "../../common/zod-validation.js";
import { AutonomyService } from "./autonomy.service.js";

@Controller("v1/autonomy")
export class AutonomyController {
  constructor(private readonly autonomyService: AutonomyService) {}

  @Get("runs")
  @RequirePermissions("autonomy:runs:read")
  async list(@Req() req: { headers?: Record<string, unknown> }) {
    const actor = resolveRequestContext(req);
    const data = await this.autonomyService.list({ tenantId: actor.tenantId });
    return ok(resolveRequestId(req.headers ?? {}), data);
  }

  @Get("provider")
  @RequirePermissions("autonomy:runs:read")
  provider(@Req() req: { headers?: Record<string, unknown> }) {
    const data = this.autonomyService.providerStatus();
    return ok(resolveRequestId(req.headers ?? {}), data);
  }

  @Get("runs/:runId")
  @RequirePermissions("autonomy:runs:read")
  async detail(@Req() req: { headers?: Record<string, unknown> }, @Param("runId") runId: string) {
    const actor = resolveRequestContext(req);
    const params = parseWithSchema(autonomyRunIdParamSchema, { runId });
    const data = await this.autonomyService.detail({
      tenantId: actor.tenantId,
      runId: params.runId
    });
    return ok(resolveRequestId(req.headers ?? {}), data);
  }

  @Post("runs")
  @RequirePermissions("autonomy:runs:create")
  async run(@Req() req: { headers?: Record<string, unknown> }, @Body() body: unknown) {
    const actor = resolveRequestContext(req);
    const input = parseWithSchema(createAutonomyRunSchema, body);
    const data = await this.autonomyService.run({
      tenantId: actor.tenantId,
      orgId: actor.orgId,
      userId: actor.userId,
      roles: actor.roles,
      task: input.task,
      baseBranch: input.baseBranch,
      targetStage: input.targetStage,
      workspaceId: input.workspaceId,
      repoId: input.repoId,
      taskId: input.taskId
    });
    return ok(resolveRequestId(req.headers ?? {}), data);
  }

  @Post("runs/:runId/continue")
  @RequirePermissions("autonomy:runs:create")
  async continueRun(
    @Req() req: { headers?: Record<string, unknown> },
    @Param("runId") runId: string,
    @Body() body: unknown
  ) {
    const actor = resolveRequestContext(req);
    const params = parseWithSchema(autonomyRunIdParamSchema, { runId });
    const input = parseWithSchema(continueAutonomyRunSchema, body ?? {});
    const data = await this.autonomyService.continueRun({
      tenantId: actor.tenantId,
      orgId: actor.orgId,
      userId: actor.userId,
      roles: actor.roles,
      runId: params.runId,
      targetStage: input.targetStage
    });
    return ok(resolveRequestId(req.headers ?? {}), data);
  }
}
