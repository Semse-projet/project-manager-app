import {
  Controller, Get, Post, Param, Body, Query, Req,
  HttpCode, HttpStatus, BadRequestException,
} from "@nestjs/common";
import type { FastifyRequest } from "fastify";
import { GovernanceService } from "./governance.service.js";
import { RequirePermissions } from "../../common/permissions.decorator.js";
import { ok } from "../../common/api-response.js";
import { resolveRequestId } from "../../common/request-id.js";
import { resolveRequestContext } from "../../common/request-context.js";

@Controller("v1/governance")
export class GovernanceController {
  constructor(private readonly governance: GovernanceService) {}

  /** POST /v1/governance/proposals — submit a proposal */
  @Post("proposals")
  @RequirePermissions("ops:dashboard:read")
  async createProposal(
    @Req() req: FastifyRequest,
    @Body() body: Record<string, unknown>,
  ) {
    const ctx = resolveRequestContext(req);

    const title = typeof body.title === "string" ? body.title.trim() : "";
    const description = typeof body.description === "string" ? body.description.trim() : "";
    const closesAtRaw = typeof body.closesAt === "string" ? body.closesAt : "";
    const category = typeof body.category === "string" ? body.category : "general";

    if (!title) throw new BadRequestException("title is required");
    if (!description) throw new BadRequestException("description is required");
    if (!closesAtRaw) throw new BadRequestException("closesAt is required");

    const closesAt = new Date(closesAtRaw);
    if (isNaN(closesAt.getTime())) throw new BadRequestException("closesAt must be a valid ISO date");

    // authorId must always be the real caller — never trust a client-supplied
    // value here, or any actor could author a DAO proposal under someone
    // else's identity. See docs/AUDIT_REMEDIATION_PLAN.md 3.13.
    const tenantId = typeof body.tenantId === "string" && body.tenantId.trim()
      ? body.tenantId.trim()
      : ctx.tenantId;
    const authorId = ctx.userId;

    const data = await this.governance.createProposal({ tenantId, authorId, title, description, category, closesAt });
    return ok(resolveRequestId(req.headers ?? {}), data);
  }

  /** GET /v1/governance/proposals?tenantId=...&status=... — list proposals */
  @Get("proposals")
  @RequirePermissions("ops:dashboard:read")
  async listProposals(
    @Req() req: FastifyRequest,
    @Query("tenantId") tenantId: string,
    @Query("status") status?: string,
  ) {
    const data = await this.governance.listProposals(tenantId, status);
    return ok(resolveRequestId(req.headers ?? {}), data);
  }

  /** GET /v1/governance/proposals/:id — single proposal with votes */
  @Get("proposals/:id")
  @RequirePermissions("ops:dashboard:read")
  async getProposal(@Req() req: FastifyRequest, @Param("id") id: string) {
    const data = await this.governance.getProposal(id);
    return ok(resolveRequestId(req.headers ?? {}), data);
  }

  /** GET /v1/governance/proposals/:id/results — tally results */
  @Get("proposals/:id/results")
  @RequirePermissions("ops:dashboard:read")
  async getResults(@Req() req: FastifyRequest, @Param("id") id: string) {
    const data = await this.governance.getResults(id);
    return ok(resolveRequestId(req.headers ?? {}), data);
  }

  /** POST /v1/governance/proposals/:id/vote — cast a vote */
  @Post("proposals/:id/vote")
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions("ops:dashboard:read")
  async castVote(
    @Req() req: FastifyRequest,
    @Param("id") proposalId: string,
    @Body() body: Record<string, unknown>,
  ) {
    const ctx = resolveRequestContext(req);

    const choice = typeof body.choice === "string" ? body.choice.trim() : "";
    if (!choice) throw new BadRequestException("choice is required");

    const units = typeof body.units === "number" ? body.units : 1;
    const reason = typeof body.reason === "string" ? body.reason : undefined;
    const tenantId = typeof body.tenantId === "string" && body.tenantId.trim()
      ? body.tenantId.trim()
      : ctx.tenantId;
    // voterId must always be the real caller — a client-supplied voterId let
    // any actor with ops:dashboard:read cast a vote as an arbitrary user,
    // directly impersonating them in a reputation-weighted tally. See
    // docs/AUDIT_REMEDIATION_PLAN.md 3.13.
    const voterId = ctx.userId;

    const data = await this.governance.castVote({ proposalId, tenantId, voterId, choice, units, reason });
    return ok(resolveRequestId(req.headers ?? {}), data);
  }

  /** POST /v1/governance/proposals/:id/close — close voting and finalize outcome */
  @Post("proposals/:id/close")
  @HttpCode(HttpStatus.OK)
  @RequirePermissions("ops:dashboard:read")
  async closeProposal(@Req() req: FastifyRequest, @Param("id") id: string) {
    const data = await this.governance.closeProposal(id);
    return ok(resolveRequestId(req.headers ?? {}), data);
  }

  /** GET /v1/governance/credits/:userId?tenantId=... — governance credit summary */
  @Get("credits/:userId")
  @RequirePermissions("ops:dashboard:read")
  async getCredits(
    @Req() req: FastifyRequest,
    @Param("userId") userId: string,
    @Query("tenantId") tenantId: string,
  ) {
    const data = await this.governance.getCredits(tenantId, userId);
    return ok(resolveRequestId(req.headers ?? {}), data);
  }
}
