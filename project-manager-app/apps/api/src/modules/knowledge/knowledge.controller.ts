import { Body, Controller, Get, Param, Patch, Post, Query, Req } from "@nestjs/common";
import type { FastifyRequest } from "fastify";
import { workspaceMemoryQuerySchema } from "@semse/schemas";
import { ok } from "../../common/api-response.js";
import { RequirePermissions } from "../../common/permissions.decorator.js";
import { resolveRequestContext } from "../../common/request-context.js";
import { resolveRequestId } from "../../common/request-id.js";
import { parseWithSchema } from "../../common/zod-validation.js";
import { parsePositiveInt } from "../../common/parse-query.js";
import { AgentSkillRepository, type CreateAgentSkillInput } from "./agent-skill.repository.js";
import { KnowledgeCuratorService } from "./knowledge-curator.service.js";
import { KnowledgeService } from "./knowledge.service.js";

@Controller("v1/knowledge")
@RequirePermissions("knowledge:read")
export class KnowledgeController {
  constructor(
    private readonly knowledgeService: KnowledgeService,
    private readonly skillRepo: AgentSkillRepository,
    private readonly curator: KnowledgeCuratorService,
  ) {}

  // Estas dos exponen el mapa de dominios de conocimiento del repo y el estado
  // de los servicios internos — es información de arquitectura, no de negocio,
  // así que quedan restringidas a roles internos aunque el resto del controller
  // (workspace-memory, skills, curation) siga abierto por `knowledge:read`.
  @Get("domains")
  @RequirePermissions("internal:architecture:read")
  async domains(@Req() req: FastifyRequest) {
    return ok(resolveRequestId(req.headers ?? {}), await this.knowledgeService.getDomains());
  }

  @Get("overview")
  @RequirePermissions("internal:architecture:read")
  async overview(@Req() req: FastifyRequest) {
    return ok(resolveRequestId(req.headers ?? {}), await this.knowledgeService.getOverview());
  }

  @Get("workspace-memory/search")
  async searchWorkspaceMemory(
    @Req() req: { headers?: Record<string, unknown> },
    @Query("workspaceId") workspaceId: string,
    @Query("term") term: string,
    @Query("limit") limit?: string,
    @Query("kinds") kinds?: string | string[]
  ) {
    const actor = resolveRequestContext(req);
    const kindsArr = kinds ? (Array.isArray(kinds) ? kinds : [kinds]) : undefined;
    const data = await this.knowledgeService.searchWorkspaceMemory({
      tenantId: actor.tenantId,
      workspaceId,
      term: term ?? "",
      limit: limit ? parsePositiveInt(limit, 20) : undefined,
      kinds: kindsArr
    });
    return ok(resolveRequestId(req.headers ?? {}), data);
  }

  @Get("workspace-memory")
  async workspaceMemory(@Req() req: { headers?: Record<string, unknown> }, @Query() query: Record<string, unknown>) {
    const actor = resolveRequestContext(req);
    const parsed = parseWithSchema(workspaceMemoryQuerySchema, query);
    const kinds = parsed.kinds ? (Array.isArray(parsed.kinds) ? parsed.kinds : [parsed.kinds]) : undefined;
    const tags = parsed.tags ? (Array.isArray(parsed.tags) ? parsed.tags : [parsed.tags]) : undefined;
    const data = await this.knowledgeService.listWorkspaceMemory({
      tenantId: actor.tenantId,
      orgId: actor.orgId,
      workspaceId: parsed.workspaceId,
      repoId: parsed.repoId,
      runId: parsed.runId,
      taskId: parsed.taskId,
      kinds,
      tags
    });
    return ok(resolveRequestId(req.headers ?? {}), data);
  }

  // ── Agent Skills ─────────────────────────────────────────────────────────────

  @Post("skills")
  @RequirePermissions("knowledge:write")
  async createSkill(@Req() req: { headers?: Record<string, unknown> }, @Body() body: Omit<CreateAgentSkillInput, "tenantId" | "orgId">) {
    const actor = resolveRequestContext(req);
    const skill = await this.skillRepo.create({ ...body, tenantId: actor.tenantId, orgId: actor.orgId });
    return ok(resolveRequestId(req.headers ?? {}), skill);
  }

  @Get("skills")
  async listSkills(
    @Req() req: { headers?: Record<string, unknown> },
    @Query("agentId") agentId: string,
    @Query("status") status?: string,
  ) {
    const actor = resolveRequestContext(req);
    const skills = await this.skillRepo.findByAgent(actor.tenantId, agentId, status as "active" | "stale" | "archived" | "pinned" | undefined);
    return ok(resolveRequestId(req.headers ?? {}), skills);
  }

  @Patch("skills/:id/procedure")
  @RequirePermissions("knowledge:write")
  async updateSkillProcedure(
    @Req() req: { headers?: Record<string, unknown> },
    @Param("id") id: string,
    @Body() body: { procedure: string },
  ) {
    const skill = await this.skillRepo.updateProcedure(id, body.procedure);
    return ok(resolveRequestId(req.headers ?? {}), skill);
  }

  @Post("skills/:agentId/:name/use")
  @RequirePermissions("knowledge:write")
  async recordSkillUse(
    @Req() req: { headers?: Record<string, unknown> },
    @Param("agentId") agentId: string,
    @Param("name") name: string,
    @Body() body: { succeeded: boolean },
  ) {
    const actor = resolveRequestContext(req);
    const skill = await this.skillRepo.recordUse({ tenantId: actor.tenantId, agentId, name, succeeded: body.succeeded });
    return ok(resolveRequestId(req.headers ?? {}), skill);
  }

  // ── Curator ───────────────────────────────────────────────────────────────────

  @Post("curate")
  @RequirePermissions("knowledge:write")
  async runCuration(@Req() req: { headers?: Record<string, unknown> }) {
    const actor = resolveRequestContext(req);
    const summary = await this.curator.runCuration(actor.tenantId);
    return ok(resolveRequestId(req.headers ?? {}), summary);
  }

  @Get("curate/stats")
  async curationStats(@Req() req: { headers?: Record<string, unknown> }) {
    const actor = resolveRequestContext(req);
    const stats = await this.curator.getCurationStats(actor.tenantId);
    return ok(resolveRequestId(req.headers ?? {}), stats);
  }
}
