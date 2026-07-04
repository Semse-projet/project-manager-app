import { BadRequestException, Body, Controller, Get, Param, Post, Req } from "@nestjs/common";
import { reserveJobSchema } from "@semse/schemas";
import { ok } from "../../common/api-response.js";
import { toVisibleReservation } from "../../common/visible-response.js";
import { RequirePermissions } from "../../common/permissions.decorator.js";
import { resolveRequestContext } from "../../common/request-context.js";
import { resolveRequestId } from "../../common/request-id.js";
import { ReservationsService } from "./reservations.service.js";

const createReservationSchema = reserveJobSchema.omit({ jobId: true });

@Controller()
export class ReservationsController {
  constructor(private readonly reservationsService: ReservationsService) {}

  @Get("v1/jobs/:jobId/reservations")
  @RequirePermissions("reservations:read")
  async list(@Req() req: { headers?: Record<string, unknown> }, @Param("jobId") jobId: string) {
    const actor = resolveRequestContext(req);
    const data = await this.reservationsService.list({
      tenantId: actor.tenantId,
      orgId: actor.orgId,
      userId: actor.userId,
      roles: actor.roles,
      jobId
    });
    return ok(resolveRequestId(req.headers ?? {}), data.map((reservation) => toVisibleReservation(reservation)));
  }

  @Post("v1/jobs/:jobId/reservations")
  @RequirePermissions("reservations:create")
  async create(
    @Req() req: { headers?: Record<string, unknown> },
    @Param("jobId") jobId: string,
    @Body() body: Record<string, unknown>
  ) {
    const parsed = createReservationSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }

    const actor = resolveRequestContext(req);
    const requestId = resolveRequestId(req.headers ?? {});
    const data = await this.reservationsService.create({
      tenantId: actor.tenantId,
      orgId: actor.orgId,
      userId: actor.userId,
      roles: actor.roles,
      jobId,
      expiresInMinutes: parsed.data.expiresInMinutes,
      requestId
    });

    return ok(requestId, toVisibleReservation(data));
  }

  @Post("v1/reservations/:reservationId/accept")
  @RequirePermissions("reservations:accept")
  async accept(@Req() req: { headers?: Record<string, unknown> }, @Param("reservationId") reservationId: string) {
    const actor = resolveRequestContext(req);
    const requestId = resolveRequestId(req.headers ?? {});
    const data = await this.reservationsService.accept({
      tenantId: actor.tenantId,
      orgId: actor.orgId,
      userId: actor.userId,
      roles: actor.roles,
      reservationId,
      requestId
    });

    return ok(requestId, toVisibleReservation(data));
  }

  @Post("v1/reservations/:reservationId/release")
  @RequirePermissions("reservations:release")
  async release(@Req() req: { headers?: Record<string, unknown> }, @Param("reservationId") reservationId: string) {
    const actor = resolveRequestContext(req);
    const requestId = resolveRequestId(req.headers ?? {});
    const data = await this.reservationsService.release({
      tenantId: actor.tenantId,
      orgId: actor.orgId,
      userId: actor.userId,
      roles: actor.roles,
      reservationId,
      requestId
    });

    return ok(requestId, toVisibleReservation(data));
  }

  @Post("v1/reservations/:reservationId/expire")
  @RequirePermissions("reservations:expire")
  async expire(@Req() req: { headers?: Record<string, unknown> }, @Param("reservationId") reservationId: string) {
    const actor = resolveRequestContext(req);
    const requestId = resolveRequestId(req.headers ?? {});
    const data = await this.reservationsService.expire({
      tenantId: actor.tenantId,
      orgId: actor.orgId,
      userId: actor.userId,
      roles: actor.roles,
      reservationId,
      requestId
    });

    return ok(requestId, toVisibleReservation(data));
  }

  @Post("v1/reservations/sweep-expired")
  @RequirePermissions("reservations:expire")
  async sweepExpired(
    @Req() req: { headers?: Record<string, unknown> },
    @Body() body: Record<string, unknown>
  ) {
    const actor = resolveRequestContext(req);
    const maxItems = typeof body.maxItems === "number" ? Math.min(body.maxItems, 200) : 50;
    const requestId = resolveRequestId(req.headers ?? {});
    const result = await this.reservationsService.sweepExpired({
      tenantId: actor.tenantId,
      orgId: actor.orgId,
      userId: actor.userId,
      maxItems,
      requestId
    });
    return ok(requestId, result);
  }
}
