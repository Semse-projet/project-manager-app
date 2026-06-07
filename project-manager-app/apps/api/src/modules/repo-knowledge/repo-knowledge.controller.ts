import { Body, Controller, Get, Param, Post, Req } from "@nestjs/common";
import type { FastifyRequest } from "fastify";
import {
  repoIdSchema,
  repoQuerySchema
} from "@semse/schemas";
import { ok } from "../../common/api-response.js";
import { resolveRequestId } from "../../common/request-id.js";
import { parseWithSchema } from "../../common/zod-validation.js";
import { RepoKnowledgeService } from "./repo-knowledge.service.js";

@Controller("v1/repo-knowledge")
export class RepoKnowledgeController {
  constructor(private readonly repoKnowledgeService: RepoKnowledgeService) {}

  @Get("tree")
  async tree(@Req() req: FastifyRequest) {
    return ok(resolveRequestId(req.headers ?? {}), await this.repoKnowledgeService.getTree());
  }

  @Get("node/:id")
  async node(@Req() req: FastifyRequest, @Param("id") id: string) {
    const nodeId = parseWithSchema(repoIdSchema, id);
    return ok(resolveRequestId(req.headers ?? {}), await this.repoKnowledgeService.getNode(nodeId));
  }

  @Get("children/:id")
  async children(@Req() req: FastifyRequest, @Param("id") id: string) {
    const nodeId = parseWithSchema(repoIdSchema, id);
    return ok(resolveRequestId(req.headers ?? {}), await this.repoKnowledgeService.getChildren(nodeId));
  }

  @Get("relations/:id")
  async relations(@Req() req: FastifyRequest, @Param("id") id: string) {
    const nodeId = parseWithSchema(repoIdSchema, id);
    return ok(resolveRequestId(req.headers ?? {}), await this.repoKnowledgeService.getRelations(nodeId));
  }

  @Post("query")
  async query(@Req() req: FastifyRequest, @Body() body: Record<string, unknown>) {
    const parsed = parseWithSchema(repoQuerySchema, body);
    return ok(
      resolveRequestId(req.headers ?? {}),
      await this.repoKnowledgeService.query({
        ...parsed,
        includeRelations: parsed.includeRelations ?? true,
        includePath: parsed.includePath ?? true,
        maxDepth: parsed.maxDepth ?? 4
      })
    );
  }
}
