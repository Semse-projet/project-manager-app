import { Body, Controller, Post, Req } from "@nestjs/common";
import type { FastifyRequest } from "fastify";
import { ok } from "../../common/api-response.js";
import { resolveRequestContext } from "../../common/request-context.js";
import { resolveRequestId } from "../../common/request-id.js";
import { ToolsService, type ToolCalculateInput } from "./tools.service.js";
import { AlgorithmRunService } from "./algorithm-run.service.js";

@Controller("v1/tools")
export class ToolsController {
  constructor(
    private readonly toolsService: ToolsService,
    private readonly algorithmRunService: AlgorithmRunService,
  ) {}

  @Post("calculate")
  calculate(@Req() req: FastifyRequest, @Body() body: ToolCalculateInput) {
    const rid    = resolveRequestId(req.headers ?? {});
    const result = this.toolsService.calculate(body);

    // Record algorithm run asynchronously — never blocks response
    void (async () => {
      try {
        const actor = resolveRequestContext(req as Parameters<typeof resolveRequestContext>[0]);
        await this.algorithmRunService.record(body.tool, body.input ?? {}, result, {
          tenantId: actor.tenantId,
          userId:   actor.userId,
        });
      } catch { /* swallowed */ }
    })();

    return ok(rid, result);
  }

  @Post("quote")
  quote(@Req() req: FastifyRequest, @Body() body: { result: Record<string, unknown> }) {
    const rid = resolveRequestId(req.headers ?? {});
    const result = this.toolsService.quote(body.result as never);
    return ok(rid, result);
  }

  @Post("milestones")
  milestones(@Req() req: FastifyRequest, @Body() body: { result: Record<string, unknown> }) {
    const rid = resolveRequestId(req.headers ?? {});
    const result = this.toolsService.milestones(body.result as never);
    return ok(rid, result);
  }

  @Post("evidence")
  evidence(@Req() req: FastifyRequest, @Body() body: { result: Record<string, unknown> }) {
    const rid = resolveRequestId(req.headers ?? {});
    const result = this.toolsService.evidence(body.result as never);
    return ok(rid, result);
  }

  @Post("export")
  export(@Req() req: FastifyRequest, @Body() body: { result: Record<string, unknown> }) {
    const rid = resolveRequestId(req.headers ?? {});
    const result = this.toolsService.export(body.result as never);
    return ok(rid, result);
  }

  @Post("escrow")
  escrow(@Req() req: FastifyRequest, @Body() body: { result: Record<string, unknown> }) {
    const rid = resolveRequestId(req.headers ?? {});
    const result = this.toolsService.escrow(body.result as never);
    return ok(rid, result);
  }

  @Post("change-order")
  changeOrder(@Req() req: FastifyRequest, @Body() body: { result: Record<string, unknown>; deltaPercent: number }) {
    const rid = resolveRequestId(req.headers ?? {});
    const result = this.toolsService.changeOrder(body.result as never, body.deltaPercent ?? 0);
    return ok(rid, result);
  }

  @Post("dispute-risk")
  disputeRisk(@Req() req: FastifyRequest, @Body() body: { result: Record<string, unknown> }) {
    const rid = resolveRequestId(req.headers ?? {});
    const result = this.toolsService.disputeRisk(body.result as never);
    return ok(rid, result);
  }
}
