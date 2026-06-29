import { Body, Controller, Get, Param, Post, Req } from "@nestjs/common";
import type { FastifyRequest } from "fastify";
import { runtimeIdSchema, runtimeQuerySchema } from "@semse/schemas";
import { ok } from "../../common/api-response.js";
import { RequirePermissions } from "../../common/permissions.decorator.js";
import { resolveRequestId } from "../../common/request-id.js";
import { parseWithSchema } from "../../common/zod-validation.js";
import { RuntimeKnowledgeService } from "./runtime-knowledge.service.js";

@Controller("v1/runtime-knowledge")
@RequirePermissions("knowledge:read")
export class RuntimeKnowledgeController {
  constructor(private readonly runtimeKnowledgeService: RuntimeKnowledgeService) {}

  @Get("tree")
  async tree(@Req() req: FastifyRequest) {
    return ok(resolveRequestId(req.headers ?? {}), await this.runtimeKnowledgeService.getTree());
  }

  @Get("node/:id")
  async node(@Req() req: FastifyRequest, @Param("id") id: string) {
    const nodeId = parseWithSchema(runtimeIdSchema, id);
    return ok(resolveRequestId(req.headers ?? {}), await this.runtimeKnowledgeService.getNode(nodeId));
  }

  @Get("children/:id")
  async children(@Req() req: FastifyRequest, @Param("id") id: string) {
    const nodeId = parseWithSchema(runtimeIdSchema, id);
    return ok(resolveRequestId(req.headers ?? {}), await this.runtimeKnowledgeService.getChildren(nodeId));
  }

  @Get("relations/:id")
  async relations(@Req() req: FastifyRequest, @Param("id") id: string) {
    const nodeId = parseWithSchema(runtimeIdSchema, id);
    return ok(resolveRequestId(req.headers ?? {}), await this.runtimeKnowledgeService.getRelations(nodeId));
  }

  @Post("query")
  async query(@Req() req: FastifyRequest, @Body() body: Record<string, unknown>) {
    const parsed = parseWithSchema(runtimeQuerySchema, body);
    return ok(
      resolveRequestId(req.headers ?? {}),
      await this.runtimeKnowledgeService.query({
        ...parsed,
        includeRelations: parsed.includeRelations ?? true,
        includePath: parsed.includePath ?? true,
        maxDepth: parsed.maxDepth ?? 4
      })
    );
  }

  @Get("status")
  async status(@Req() req: FastifyRequest) {
    return ok(resolveRequestId(req.headers ?? {}), await this.runtimeKnowledgeService.getServiceStatuses());
  }
}
