import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req } from "@nestjs/common";
import type { FastifyRequest } from "fastify";
import { ok } from "../../common/api-response.js";
import { resolveRequestContext } from "../../common/request-context.js";
import { resolveRequestId } from "../../common/request-id.js";
import { RequirePermissions } from "../../common/permissions.decorator.js";
import { ContractorService, type CreateLeadInput, type LeadStatus, type UpdateLeadInput } from "./contractor.service.js";
import { ContractorEstimateService } from "./contractor-estimate.service.js";
import { parsePositiveInt } from "../../common/parse-query.js";

function ctx(req: FastifyRequest) {
  return resolveRequestContext(req as Parameters<typeof resolveRequestContext>[0]);
}

@Controller("v1/contractor")
export class ContractorController {
  constructor(
    private readonly contractor: ContractorService,
    private readonly estimateService: ContractorEstimateService,
  ) {}

  @Post("leads")
  @RequirePermissions("jobs:create")
  async createLead(@Req() req: FastifyRequest, @Body() body: Record<string, unknown>) {
    const rid = resolveRequestId(req.headers ?? {});
    const c = ctx(req);
    const input: CreateLeadInput = {
      tenantId: c.tenantId,
      orgId: c.orgId,
      createdBy: c.userId,
      name: String(body.name ?? ""),
      phone: body.phone as string | undefined,
      email: body.email as string | undefined,
      address: body.address as string | undefined,
      city: body.city as string | undefined,
      state: body.state as string | undefined,
      jobType: body.jobType as string | undefined,
      description: body.description as string | undefined,
      budgetRange: body.budgetRange as string | undefined,
      urgency: body.urgency as CreateLeadInput["urgency"],
      notes: body.notes as string | undefined,
      nextAction: body.nextAction as string | undefined,
      nextActionAt: body.nextActionAt as string | undefined,
      source: body.source as CreateLeadInput["source"],
    };
    return ok(rid, await this.contractor.createLead(input));
  }

  @Get("leads")
  @RequirePermissions("jobs:read")
  async listLeads(
    @Req() req: FastifyRequest,
    @Query("status") status?: string,
    @Query("search") search?: string,
    @Query("limit") limit?: string,
  ) {
    const rid = resolveRequestId(req.headers ?? {});
    const c = ctx(req);
    const data = await this.contractor.listLeads(c.tenantId, {
      orgId: c.orgId,
      status: status as LeadStatus | undefined,
      search,
      limit: parsePositiveInt(limit, 100),
    });
    return ok(rid, data);
  }

  @Get("leads/stats")
  @RequirePermissions("jobs:read")
  async getStats(@Req() req: FastifyRequest) {
    const rid = resolveRequestId(req.headers ?? {});
    const c = ctx(req);
    return ok(rid, await this.contractor.getStats(c.tenantId, c.orgId));
  }

  @Get("leads/:id")
  @RequirePermissions("jobs:read")
  async getLead(@Req() req: FastifyRequest, @Param("id") id: string) {
    const rid = resolveRequestId(req.headers ?? {});
    const c = ctx(req);
    return ok(rid, await this.contractor.getLead(id, c.tenantId));
  }

  @Patch("leads/:id")
  @RequirePermissions("jobs:create")
  async updateLead(@Req() req: FastifyRequest, @Param("id") id: string, @Body() body: Record<string, unknown>) {
    const rid = resolveRequestId(req.headers ?? {});
    const c = ctx(req);
    return ok(rid, await this.contractor.updateLead(id, c.tenantId, body as UpdateLeadInput));
  }

  @Delete("leads/:id")
  @RequirePermissions("jobs:create")
  async deleteLead(@Req() req: FastifyRequest, @Param("id") id: string) {
    const rid = resolveRequestId(req.headers ?? {});
    const c = ctx(req);
    await this.contractor.deleteLead(id, c.tenantId);
    return ok(rid, { deleted: true });
  }

  @Post("leads/:id/suggest-estimate")
  @RequirePermissions("jobs:create")
  async suggestEstimate(@Req() req: FastifyRequest, @Param("id") id: string) {
    const rid = resolveRequestId(req.headers ?? {});
    const c = ctx(req);
    const items = await this.estimateService.suggestLineItems({
      tenantId: c.tenantId,
      leadId: id,
      userId: c.userId,
    });
    return ok(rid, items);
  }

  @Post("leads/:id/create-estimate")
  @RequirePermissions("jobs:create")
  async createEstimate(@Req() req: FastifyRequest, @Param("id") id: string, @Body() body: Record<string, unknown>) {
    const rid = resolveRequestId(req.headers ?? {});
    const c = ctx(req);
    const invoice = await this.estimateService.createEstimateFromLead({
      tenantId: c.tenantId,
      orgId: c.orgId,
      userId: c.userId,
      leadId: id,
      lineItems: (body.lineItems as Parameters<typeof this.estimateService.createEstimateFromLead>[0]["lineItems"]) ?? [],
      dueDate: body.dueDate as string | undefined,
      notes: body.notes as string | undefined,
      terms: body.terms as string | undefined,
    });
    return ok(rid, invoice);
  }
}
