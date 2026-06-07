import { Body, Controller, Get, Param, Post, Query, Req } from "@nestjs/common";
import {
  developerRuntimeApprovalIdParamSchema,
  developerRuntimeApprovalResponseInputSchema,
  developerRuntimeCreateMissionInputSchema,
  developerRuntimeCreateSessionInputSchema,
  developerRuntimeExecuteSessionInputSchema,
  developerRuntimeListSessionsQuerySchema,
  developerRuntimeSessionIdParamSchema,
  developerRuntimeWorkerCompleteInputSchema,
  developerRuntimeWorkerFailInputSchema,
  developerRuntimeWorkerProgressInputSchema,
  developerRuntimeWorkerStartInputSchema,
} from "@semse/schemas";
import { ok } from "../../common/api-response.js";
import { resolveRequestContext } from "../../common/request-context.js";
import { resolveRequestId } from "../../common/request-id.js";
import { parseWithSchema } from "../../common/zod-validation.js";
import { DeveloperRuntimeService } from "./developer-runtime.service.js";

@Controller("v1/developer-runtime")
export class DeveloperRuntimeController {
  constructor(private readonly developerRuntimeService: DeveloperRuntimeService) {}

  @Get("catalog")
  async catalog(@Req() req: { headers?: Record<string, unknown> }) {
    return ok(
      resolveRequestId(req.headers ?? {}),
      this.developerRuntimeService.getCatalog(),
    );
  }

  @Get("sessions")
  async listSessions(
    @Req() req: {
      headers?: Record<string, unknown>;
      query?: Record<string, string | string[] | undefined>;
    },
    @Query() rawQuery: Record<string, string | string[] | undefined>,
  ) {
    const actor = resolveRequestContext(req);
    const query = parseWithSchema(
      developerRuntimeListSessionsQuerySchema,
      rawQuery ?? req.query ?? {},
    );

    return ok(
      resolveRequestId(req.headers ?? {}),
      await this.developerRuntimeService.listSessions({
        actor: {
          tenantId: actor.tenantId,
          orgId: actor.orgId,
          userId: actor.userId,
        },
        filters: query,
      }),
    );
  }

  @Post("sessions")
  async createSession(
    @Req() req: { headers?: Record<string, unknown> },
    @Body() body: unknown,
  ) {
    const actor = resolveRequestContext(req);
    const requestId = resolveRequestId(req.headers ?? {});
    const parsed = parseWithSchema(developerRuntimeCreateSessionInputSchema, body);

    return ok(
      requestId,
      await this.developerRuntimeService.createSession(
        {
          ...parsed,
          selectedAgents: parsed.selectedAgents ?? [],
        },
        {
        tenantId: actor.tenantId,
        orgId: actor.orgId,
        userId: actor.userId,
        },
        requestId,
      ),
    );
  }

  @Get("sessions/:sessionId")
  async getSession(
    @Req() req: { headers?: Record<string, unknown> },
    @Param("sessionId") sessionId: string,
  ) {
    const actor = resolveRequestContext(req);
    const params = parseWithSchema(developerRuntimeSessionIdParamSchema, {
      sessionId,
    });

    return ok(
      resolveRequestId(req.headers ?? {}),
      await this.developerRuntimeService.getSession(params.sessionId, {
        tenantId: actor.tenantId,
        orgId: actor.orgId,
        userId: actor.userId,
      }),
    );
  }

  @Post("sessions/:sessionId/missions")
  async createMission(
    @Req() req: { headers?: Record<string, unknown> },
    @Param("sessionId") sessionId: string,
    @Body() body: unknown,
  ) {
    const actor = resolveRequestContext(req);
    const requestId = resolveRequestId(req.headers ?? {});
    const params = parseWithSchema(developerRuntimeSessionIdParamSchema, {
      sessionId,
    });
    const parsed = parseWithSchema(developerRuntimeCreateMissionInputSchema, body);

    return ok(
      requestId,
      await this.developerRuntimeService.createMission(
        params.sessionId,
        parsed,
        {
          tenantId: actor.tenantId,
          orgId: actor.orgId,
          userId: actor.userId,
        },
        requestId,
      ),
    );
  }

  @Post("sessions/:sessionId/approvals/:approvalId/respond")
  async respondApproval(
    @Req() req: { headers?: Record<string, unknown> },
    @Param("sessionId") sessionId: string,
    @Param("approvalId") approvalId: string,
    @Body() body: unknown,
  ) {
    const actor = resolveRequestContext(req);
    const requestId = resolveRequestId(req.headers ?? {});
    const sessionParams = parseWithSchema(developerRuntimeSessionIdParamSchema, { sessionId });
    const approvalParams = parseWithSchema(developerRuntimeApprovalIdParamSchema, { approvalId });
    const parsed = parseWithSchema(developerRuntimeApprovalResponseInputSchema, body);

    return ok(
      requestId,
      await this.developerRuntimeService.respondApproval(
        sessionParams.sessionId,
        approvalParams.approvalId,
        parsed,
        {
          tenantId: actor.tenantId,
          orgId: actor.orgId,
          userId: actor.userId,
        },
        requestId,
      ),
    );
  }

  @Post("sessions/:sessionId/execute")
  async executeSession(
    @Req() req: { headers?: Record<string, unknown> },
    @Param("sessionId") sessionId: string,
    @Body() body: unknown,
  ) {
    const actor = resolveRequestContext(req);
    const requestId = resolveRequestId(req.headers ?? {});
    const params = parseWithSchema(developerRuntimeSessionIdParamSchema, { sessionId });
    const parsed = parseWithSchema(developerRuntimeExecuteSessionInputSchema, body);

    return ok(
      requestId,
      await this.developerRuntimeService.executeSession(
        params.sessionId,
        parsed,
        {
          tenantId: actor.tenantId,
          orgId: actor.orgId,
          userId: actor.userId,
        },
        requestId,
      ),
    );
  }

  @Post("sessions/:sessionId/worker/progress")
  async workerProgress(
    @Req() req: { headers?: Record<string, unknown> },
    @Param("sessionId") sessionId: string,
    @Body() body: unknown,
  ) {
    const actor = resolveRequestContext(req);
    const params = parseWithSchema(developerRuntimeSessionIdParamSchema, { sessionId });
    const parsed = parseWithSchema(developerRuntimeWorkerProgressInputSchema, body);

    return ok(
      "",
      await this.developerRuntimeService.appendProgressLog(
        params.sessionId,
        parsed.log,
        {
          tenantId: actor.tenantId,
          orgId: actor.orgId,
          userId: actor.userId,
        },
      ),
    );
  }

  @Post("sessions/:sessionId/worker/start")
  async workerStart(
    @Req() req: { headers?: Record<string, unknown> },
    @Param("sessionId") sessionId: string,
    @Body() body: unknown,
  ) {
    const actor = resolveRequestContext(req);
    const requestId = resolveRequestId(req.headers ?? {});
    const params = parseWithSchema(developerRuntimeSessionIdParamSchema, { sessionId });
    const parsed = parseWithSchema(developerRuntimeWorkerStartInputSchema, body);

    return ok(
      requestId,
      await this.developerRuntimeService.startWorkerExecution(
        params.sessionId,
        parsed,
        {
          tenantId: actor.tenantId,
          orgId: actor.orgId,
          userId: actor.userId,
        },
        requestId,
      ),
    );
  }

  @Post("sessions/:sessionId/worker/complete")
  async workerComplete(
    @Req() req: { headers?: Record<string, unknown> },
    @Param("sessionId") sessionId: string,
    @Body() body: unknown,
  ) {
    const actor = resolveRequestContext(req);
    const requestId = resolveRequestId(req.headers ?? {});
    const params = parseWithSchema(developerRuntimeSessionIdParamSchema, { sessionId });
    const parsed = parseWithSchema(developerRuntimeWorkerCompleteInputSchema, body);

    return ok(
      requestId,
      await this.developerRuntimeService.completeWorkerExecution(
        params.sessionId,
        {
          ...parsed,
          session: {
            ...parsed.session,
            selectedAgents: parsed.session.selectedAgents ?? [],
          },
          mission: {
            ...parsed.mission,
            plan: parsed.mission.plan ?? [],
          },
          logs: parsed.logs ?? [],
          validations: parsed.validations ?? [],
          artifacts: parsed.artifacts ?? [],
        },
        {
          tenantId: actor.tenantId,
          orgId: actor.orgId,
          userId: actor.userId,
        },
        requestId,
      ),
    );
  }

  @Post("sessions/:sessionId/worker/fail")
  async workerFail(
    @Req() req: { headers?: Record<string, unknown> },
    @Param("sessionId") sessionId: string,
    @Body() body: unknown,
  ) {
    const actor = resolveRequestContext(req);
    const requestId = resolveRequestId(req.headers ?? {});
    const params = parseWithSchema(developerRuntimeSessionIdParamSchema, { sessionId });
    const parsed = parseWithSchema(developerRuntimeWorkerFailInputSchema, body);

    return ok(
      requestId,
      await this.developerRuntimeService.failWorkerExecution(
        params.sessionId,
        {
          ...parsed,
          session: {
            ...parsed.session,
            selectedAgents: parsed.session.selectedAgents ?? [],
          },
          mission: {
            ...parsed.mission,
            plan: parsed.mission.plan ?? [],
          },
          logs: parsed.logs ?? [],
          validations: parsed.validations ?? [],
          artifacts: parsed.artifacts ?? [],
        },
        {
          tenantId: actor.tenantId,
          orgId: actor.orgId,
          userId: actor.userId,
        },
        requestId,
      ),
    );
  }
}
