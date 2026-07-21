import { BadRequestException, Body, Controller, Get, Param, Patch, Post, Query, Req } from "@nestjs/common";
import { z } from "zod";
import { ok } from "../../common/api-response.js";
import { RequirePermissions } from "../../common/permissions.decorator.js";
import { resolveRequestContext } from "../../common/request-context.js";
import { resolveRequestId } from "../../common/request-id.js";
import { TravelService } from "./travel.service.js";

const createAssignmentSchema = z.object({
  jobId:             z.string().min(1),
  destinationCity:   z.string().min(1).max(200),
  departureDate:     z.string().min(1),
  returnDate:        z.string().optional(),
  estimatedDays:     z.number().int().positive().optional(),
  requiresLodging:   z.boolean().optional(),
  headcount:         z.number().int().positive().optional(),
  mainTransportMode: z.string().max(50).optional(),
  approvedBudget:    z.number().nonnegative().optional(),
  notes:             z.string().max(1000).optional(),
});

const createExpenseSchema = z.object({
  category:    z.enum(["meal", "transport", "other"]),
  subcategory: z.string().max(80).optional(),
  description: z.string().max(500).optional(),
  amount:      z.number().positive(),
  currency:    z.string().length(3).optional(),
  expenseDate: z.string().min(1),
  city:        z.string().max(200).optional(),
  origin:      z.string().max(200).optional(),
  destination: z.string().max(200).optional(),
  vendor:      z.string().max(200).optional(),
  odometer:    z.number().nonnegative().optional(),
  gallons:     z.number().nonnegative().optional(),
  receiptUrl:  z.string().url().optional(),
  notes:       z.string().max(1000).optional(),
});

const createLodgingSchema = z.object({
  type:             z.enum(["hotel","airbnb","house","other"]).optional(),
  name:             z.string().min(1).max(300),
  address:          z.string().max(500).optional(),
  placeId:          z.string().max(200).optional(),
  googleMapsUri:    z.string().url().optional(),
  latitude:         z.number().min(-90).max(90).optional(),
  longitude:        z.number().min(-180).max(180).optional(),
  checkIn:          z.string().min(1),
  checkOut:         z.string().min(1),
  costPerNight:     z.number().nonnegative().optional(),
  estimatedTotal:   z.number().nonnegative().optional(),
  confirmationCode: z.string().max(100).optional(),
  paidBy:           z.string().max(200).optional(),
  receiptUrl:       z.string().url().optional(),
  notes:            z.string().max(1000).optional(),
});

const createAdvanceSchema = z.object({
  amount:      z.number().positive(),
  currency:    z.string().length(3).optional(),
  method:      z.string().max(50).optional(),
  approvedBy:  z.string().optional(),
  purpose:     z.string().max(500).optional(),
});

const statusSchema = z.object({
  status: z.enum(["DRAFT","PLANNED","ACTIVE","PENDING_SETTLEMENT","CLOSED","CANCELLED"]),
});

const closeSettlementSchema = z.object({
  notes: z.string().max(1000).optional(),
});

@Controller("v1/travel")
export class TravelController {
  constructor(private readonly travelService: TravelService) {}

  // ── Assignments ────────────────────────────────────────────────────────────

  @Get()
  @RequirePermissions("jobs:read")
  async listAssignments(
    @Req() req: { headers?: Record<string, unknown> },
    @Query("status") status?: string,
    @Query("jobId") jobId?: string,
    @Query("assignedTo") assignedTo?: string,
    @Query("scope") scope?: string,
  ) {
    const actor = resolveRequestContext(req);
    const data = await this.travelService.listAssignments({
      tenantId: actor.tenantId,
      userId: actor.userId,
      roles: actor.roles,
      status,
      jobId,
      assignedTo,
      scope,
    });
    return ok(resolveRequestId(req.headers ?? {}), data);
  }

  @Post()
  @RequirePermissions("travel:manage")
  async createAssignment(
    @Req() req: { headers?: Record<string, unknown> },
    @Body() body: unknown,
  ) {
    const parsed = createAssignmentSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    const actor = resolveRequestContext(req);
    const data = await this.travelService.createAssignment({
      tenantId: actor.tenantId, assignedTo: actor.userId, ...parsed.data,
    });
    return ok(resolveRequestId(req.headers ?? {}), data);
  }

  @Get(":travelId")
  @RequirePermissions("jobs:read")
  async getAssignment(
    @Req() req: { headers?: Record<string, unknown> },
    @Param("travelId") travelId: string,
  ) {
    const actor = resolveRequestContext(req);
    const data = await this.travelService.getAssignment({
      tenantId: actor.tenantId, travelId, actorUserId: actor.userId, orgId: actor.orgId, roles: actor.roles,
    });
    return ok(resolveRequestId(req.headers ?? {}), data);
  }

  @Patch(":travelId/status")
  @RequirePermissions("travel:manage")
  async updateStatus(
    @Req() req: { headers?: Record<string, unknown> },
    @Param("travelId") travelId: string,
    @Body() body: unknown,
  ) {
    const parsed = statusSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    const actor = resolveRequestContext(req);
    const data = await this.travelService.updateAssignmentStatus({
      tenantId: actor.tenantId, travelId, status: parsed.data.status,
      actorUserId: actor.userId, orgId: actor.orgId, roles: actor.roles,
    });
    return ok(resolveRequestId(req.headers ?? {}), data);
  }

  // ── Expenses ───────────────────────────────────────────────────────────────

  @Get(":travelId/expenses")
  @RequirePermissions("jobs:read")
  async listExpenses(
    @Req() req: { headers?: Record<string, unknown> },
    @Param("travelId") travelId: string,
    @Query("category") category?: string,
  ) {
    const actor = resolveRequestContext(req);
    const data = await this.travelService.listExpenses({
      tenantId: actor.tenantId, travelId, category, actorUserId: actor.userId, orgId: actor.orgId, roles: actor.roles,
    });
    return ok(resolveRequestId(req.headers ?? {}), data);
  }

  @Post(":travelId/expenses")
  @RequirePermissions("travel:manage")
  async createExpense(
    @Req() req: { headers?: Record<string, unknown> },
    @Param("travelId") travelId: string,
    @Body() body: unknown,
  ) {
    const parsed = createExpenseSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    const actor = resolveRequestContext(req);
    const data = await this.travelService.createExpense({
      tenantId: actor.tenantId, travelId, submittedBy: actor.userId, ...parsed.data,
      actorUserId: actor.userId, orgId: actor.orgId, roles: actor.roles,
    });
    return ok(resolveRequestId(req.headers ?? {}), data);
  }

  // ── Lodging ────────────────────────────────────────────────────────────────

  @Get(":travelId/lodging")
  @RequirePermissions("jobs:read")
  async listLodging(
    @Req() req: { headers?: Record<string, unknown> },
    @Param("travelId") travelId: string,
  ) {
    const actor = resolveRequestContext(req);
    const data = await this.travelService.listLodging({
      tenantId: actor.tenantId, travelId, actorUserId: actor.userId, orgId: actor.orgId, roles: actor.roles,
    });
    return ok(resolveRequestId(req.headers ?? {}), data);
  }

  @Post(":travelId/lodging")
  @RequirePermissions("travel:manage")
  async createLodging(
    @Req() req: { headers?: Record<string, unknown> },
    @Param("travelId") travelId: string,
    @Body() body: unknown,
  ) {
    const parsed = createLodgingSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    const actor = resolveRequestContext(req);
    const data = await this.travelService.createLodging({
      tenantId: actor.tenantId, travelId, ...parsed.data,
      actorUserId: actor.userId, orgId: actor.orgId, roles: actor.roles,
    });
    return ok(resolveRequestId(req.headers ?? {}), data);
  }

  // ── Advances ───────────────────────────────────────────────────────────────

  @Get(":travelId/advances")
  @RequirePermissions("jobs:read")
  async listAdvances(
    @Req() req: { headers?: Record<string, unknown> },
    @Param("travelId") travelId: string,
  ) {
    const actor = resolveRequestContext(req);
    const data = await this.travelService.listAdvances({
      tenantId: actor.tenantId, travelId, actorUserId: actor.userId, orgId: actor.orgId, roles: actor.roles,
    });
    return ok(resolveRequestId(req.headers ?? {}), data);
  }

  @Post(":travelId/advances")
  @RequirePermissions("travel:manage")
  async createAdvance(
    @Req() req: { headers?: Record<string, unknown> },
    @Param("travelId") travelId: string,
    @Body() body: unknown,
  ) {
    const parsed = createAdvanceSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    const actor = resolveRequestContext(req);
    const data = await this.travelService.createAdvance({
      tenantId: actor.tenantId, travelId, issuedTo: actor.userId, ...parsed.data,
      actorUserId: actor.userId, orgId: actor.orgId, roles: actor.roles,
    });
    return ok(resolveRequestId(req.headers ?? {}), data);
  }

  // ── Settlement ─────────────────────────────────────────────────────────────

  @Get(":travelId/settlement")
  @RequirePermissions("jobs:read")
  async getSettlement(
    @Req() req: { headers?: Record<string, unknown> },
    @Param("travelId") travelId: string,
  ) {
    const actor = resolveRequestContext(req);
    const data = await this.travelService.computeSettlement({
      tenantId: actor.tenantId, travelId, actorUserId: actor.userId, orgId: actor.orgId, roles: actor.roles,
    });
    return ok(resolveRequestId(req.headers ?? {}), data);
  }

  @Post(":travelId/settlement/close")
  @RequirePermissions("travel:manage")
  async closeSettlement(
    @Req() req: { headers?: Record<string, unknown> },
    @Param("travelId") travelId: string,
    @Body() body: unknown,
  ) {
    const parsed = closeSettlementSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    const actor = resolveRequestContext(req);
    const data = await this.travelService.closeSettlement({
      tenantId: actor.tenantId, travelId, closedBy: actor.userId, notes: parsed.data.notes,
      actorUserId: actor.userId, orgId: actor.orgId, roles: actor.roles,
    });
    return ok(resolveRequestId(req.headers ?? {}), data);
  }
}
