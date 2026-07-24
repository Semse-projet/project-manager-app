import { Body, Controller, Get, Param, Post, Query, Req } from "@nestjs/common";
import type { FastifyRequest } from "fastify";
import {
  repoIdSchema,
  repoQuerySchema
} from "@semse/schemas";
import { ok } from "../../common/api-response.js";
import { RequirePermissions } from "../../common/permissions.decorator.js";
import { resolveRequestId } from "../../common/request-id.js";
import { parseWithSchema } from "../../common/zod-validation.js";
import { parsePositiveInt } from "../../common/parse-query.js";
import { GraphifyService } from "../graphify/graphify.service.js";
import { RepoKnowledgeService } from "./repo-knowledge.service.js";

@Controller("v1/repo-knowledge")
@RequirePermissions("internal:architecture:read")
export class RepoKnowledgeController {
  constructor(
    private readonly repoKnowledgeService: RepoKnowledgeService,
    private readonly graphify: GraphifyService,
  ) {}

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

  // ── Graphify knowledge graph endpoints ──────────────────────────────────────

  @Get("graphify/status")
  async graphifyStatus(@Req() req: FastifyRequest) {
    return ok(resolveRequestId(req.headers ?? {}), {
      available: this.graphify.isAvailable,
      graphPath: this.graphify.graphPath,
    });
  }

  @Get("graphify/query")
  async graphifyQuery(
    @Req() req: FastifyRequest,
    @Query("q") q: string,
    @Query("budget") budget?: string,
  ) {
    const result = await this.graphify.query(q, budget ? parsePositiveInt(budget, 10) : undefined);
    return ok(resolveRequestId(req.headers ?? {}), result);
  }

  @Get("graphify/path")
  async graphifyPath(
    @Req() req: FastifyRequest,
    @Query("from") from: string,
    @Query("to") to: string,
  ) {
    return ok(resolveRequestId(req.headers ?? {}), await this.graphify.path(from, to));
  }

  @Get("graphify/explain")
  async graphifyExplain(@Req() req: FastifyRequest, @Query("node") node: string) {
    return ok(resolveRequestId(req.headers ?? {}), await this.graphify.explain(node));
  }

  @Get("graphify/affected")
  async graphifyAffected(
    @Req() req: FastifyRequest,
    @Query("node") node: string,
    @Query("relation") relation?: string,
  ) {
    return ok(resolveRequestId(req.headers ?? {}), await this.graphify.affected(node, relation));
  }
}
