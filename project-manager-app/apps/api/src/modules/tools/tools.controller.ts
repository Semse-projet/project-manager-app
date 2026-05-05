import { Body, Controller, Post, Req } from "@nestjs/common";
import type { FastifyRequest } from "fastify";
import { ok } from "../../common/api-response.js";
import { resolveRequestId } from "../../common/request-id.js";
import { ToolsService, type ToolCalculateInput } from "./tools.service.js";

@Controller("v1/tools")
export class ToolsController {
  constructor(private readonly toolsService: ToolsService) {}

  @Post("calculate")
  calculate(@Req() req: FastifyRequest, @Body() body: ToolCalculateInput) {
    const rid = resolveRequestId(req.headers ?? {});
    const result = this.toolsService.calculate(body);
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
}
