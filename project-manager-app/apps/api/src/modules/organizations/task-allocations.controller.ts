import { Body, Controller, Get, HttpCode, Param, Post, Req } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { z } from "zod";
import { ok } from "../../common/api-response.js";
import { AuthenticatedAccess } from "../../common/permissions.decorator.js";
import { resolveRequestContext } from "../../common/request-context.js";
import { resolveRequestId } from "../../common/request-id.js";
import { parseWithSchema } from "../../common/zod-validation.js";
import { TaskAllocationsService } from "./task-allocations.service.js";

type Req_ = { headers?: Record<string, unknown> };

const idSchema = z.string().trim().min(1).max(64);
const assignSchema = z.object({
  userIds: z.array(idSchema).min(1).max(25),
  reason: z.string().trim().max(500).optional()
});
const taskSchema = z.object({
  title: z.string().trim().min(2).max(200),
  description: z.string().trim().max(2000).optional(),
  dueDate: z.coerce.date().optional(),
  priority: z.enum(["low", "medium", "high", "urgent"]).optional()
});
const releaseSchema = z.object({ reason: z.string().trim().min(3).max(500) });
const statusSchema = z.object({
  status: z.enum(["ACKNOWLEDGED", "IN_PROGRESS", "BLOCKED", "SUBMITTED"]),
  note: z.string().trim().max(500).optional()
});

const SCOPE_REASON =
  "La autorización es ser el supervisor vigente de esa cuadrilla (o gestor de cuadrillas de la Org); se revalida la membresía en cada llamada";

/** BO-10: tareas internas de una cuadrilla (se crean aquí para poder asignarlas). */
@Controller("v1/crews/:crewId/tasks")
export class CrewTasksController {
  constructor(private readonly allocations: TaskAllocationsService) {}

  @Post()
  @AuthenticatedAccess(SCOPE_REASON)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  async create(@Req() req: Req_, @Param("crewId") crewId: string, @Body() body: unknown) {
    const actor = resolveRequestContext(req);
    const requestId = resolveRequestId(req.headers ?? {});
    const data = await this.allocations.createCrewTask(actor, parseWithSchema(idSchema, crewId), requestId, parseWithSchema(taskSchema, body));
    return ok(requestId, data);
  }

  @Get()
  @AuthenticatedAccess(SCOPE_REASON)
  async list(@Req() req: Req_, @Param("crewId") crewId: string) {
    const actor = resolveRequestContext(req);
    const data = await this.allocations.listCrewTasks(actor, parseWithSchema(idSchema, crewId));
    return ok(resolveRequestId(req.headers ?? {}), data);
  }
}

/** BO-10: el supervisor asigna tareas canónicas a personas de SU cuadrilla. Spec: docs/specs/core/task-allocations.spec.md */
@Controller("v1/crews/:crewId/tasks/:taskId/allocations")
export class CrewTaskAllocationsController {
  constructor(private readonly allocations: TaskAllocationsService) {}

  @Post()
  @AuthenticatedAccess(SCOPE_REASON)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  async assign(@Req() req: Req_, @Param("crewId") crewId: string, @Param("taskId") taskId: string, @Body() body: unknown) {
    const actor = resolveRequestContext(req);
    const requestId = resolveRequestId(req.headers ?? {});
    const input = parseWithSchema(assignSchema, body);
    const data = await this.allocations.assign(
      actor,
      parseWithSchema(idSchema, crewId),
      parseWithSchema(idSchema, taskId),
      requestId,
      input.userIds,
      input.reason
    );
    return ok(requestId, data);
  }

  @Get()
  @AuthenticatedAccess(SCOPE_REASON)
  async list(@Req() req: Req_, @Param("crewId") crewId: string, @Param("taskId") taskId: string) {
    const actor = resolveRequestContext(req);
    const data = await this.allocations.listForTask(actor, parseWithSchema(idSchema, crewId), parseWithSchema(idSchema, taskId));
    return ok(resolveRequestId(req.headers ?? {}), data);
  }

  @Post(":userId/release")
  @HttpCode(200)
  @AuthenticatedAccess(SCOPE_REASON)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  async release(
    @Req() req: Req_,
    @Param("crewId") crewId: string,
    @Param("taskId") taskId: string,
    @Param("userId") userId: string,
    @Body() body: unknown
  ) {
    const actor = resolveRequestContext(req);
    const requestId = resolveRequestId(req.headers ?? {});
    const { reason } = parseWithSchema(releaseSchema, body);
    const data = await this.allocations.release(
      actor,
      parseWithSchema(idSchema, crewId),
      parseWithSchema(idSchema, taskId),
      parseWithSchema(idSchema, userId),
      requestId,
      reason
    );
    return ok(requestId, data);
  }
}

/** BO-10: la persona ve y avanza solo sus propias asignaciones. */
@Controller("v1/task-allocations")
export class MyTaskAllocationsController {
  constructor(private readonly allocations: TaskAllocationsService) {}

  @Get("mine")
  @AuthenticatedAccess("La persona lee únicamente las asignaciones dirigidas a su propio userId")
  async mine(@Req() req: Req_) {
    const actor = resolveRequestContext(req);
    const data = await this.allocations.listMine({ tenantId: actor.tenantId, userId: actor.userId });
    return ok(resolveRequestId(req.headers ?? {}), data);
  }

  @Post(":allocationId/status")
  @HttpCode(200)
  @AuthenticatedAccess("La persona avanza únicamente el estado de su propia asignación")
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  async status(@Req() req: Req_, @Param("allocationId") id: string, @Body() body: unknown) {
    const actor = resolveRequestContext(req);
    const requestId = resolveRequestId(req.headers ?? {});
    const { status, note } = parseWithSchema(statusSchema, body);
    const data = await this.allocations.updateStatus(
      { tenantId: actor.tenantId, userId: actor.userId },
      parseWithSchema(idSchema, id),
      status,
      note,
      requestId
    );
    return ok(requestId, data);
  }
}
