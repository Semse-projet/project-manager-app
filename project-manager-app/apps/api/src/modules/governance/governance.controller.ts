import {
  Controller, Get, Post, Param, Body, Query,
  HttpCode, HttpStatus,
} from "@nestjs/common";
import { GovernanceService } from "./governance.service.js";
import { RequirePermissions } from "../../common/permissions.decorator.js";
import { ok } from "../../common/api-response.js";
import { resolveRequestId } from "../../common/request-id.js";

@Controller("v1/governance")
export class GovernanceController {
  constructor(private readonly governance: GovernanceService) {}

  /** POST /v1/governance/proposals — submit a proposal */
  @Post("proposals")
  @RequirePermissions("ops:dashboard:read")
  async createProposal(
    @Body() body: {
      tenantId: string;
      authorId: string;
      title: string;
      description: string;
      category?: string;
      closesAt: string; // ISO string
    },
  ) {
    const data = await this.governance.createProposal({ ...body, closesAt: new Date(body.closesAt) });
    return ok(resolveRequestId({}), data);
  }

  /** GET /v1/governance/proposals?tenantId=...&status=... — list proposals */
  @Get("proposals")
  @RequirePermissions("ops:dashboard:read")
  async listProposals(
    @Query("tenantId") tenantId: string,
    @Query("status") status?: string,
  ) {
    const data = await this.governance.listProposals(tenantId, status);
    return ok(resolveRequestId({}), data);
  }

  /** GET /v1/governance/proposals/:id — single proposal with votes */
  @Get("proposals/:id")
  @RequirePermissions("ops:dashboard:read")
  async getProposal(@Param("id") id: string) {
    const data = await this.governance.getProposal(id);
    return ok(resolveRequestId({}), data);
  }

  /** GET /v1/governance/proposals/:id/results — tally results */
  @Get("proposals/:id/results")
  @RequirePermissions("ops:dashboard:read")
  async getResults(@Param("id") id: string) {
    const data = await this.governance.getResults(id);
    return ok(resolveRequestId({}), data);
  }

  /** POST /v1/governance/proposals/:id/vote — cast a vote */
  @Post("proposals/:id/vote")
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions("ops:dashboard:read")
  async castVote(
    @Param("id") proposalId: string,
    @Body() body: {
      tenantId: string;
      voterId: string;
      choice: string;
      units?: number;
      reason?: string;
    },
  ) {
    const data = await this.governance.castVote({ ...body, proposalId });
    return ok(resolveRequestId({}), data);
  }

  /** POST /v1/governance/proposals/:id/close — close voting and finalize outcome */
  @Post("proposals/:id/close")
  @HttpCode(HttpStatus.OK)
  @RequirePermissions("ops:dashboard:read")
  async closeProposal(@Param("id") id: string) {
    const data = await this.governance.closeProposal(id);
    return ok(resolveRequestId({}), data);
  }

  /** GET /v1/governance/credits/:userId?tenantId=... — governance credit summary */
  @Get("credits/:userId")
  @RequirePermissions("ops:dashboard:read")
  async getCredits(
    @Param("userId") userId: string,
    @Query("tenantId") tenantId: string,
  ) {
    const data = await this.governance.getCredits(tenantId, userId);
    return ok(resolveRequestId({}), data);
  }
}
