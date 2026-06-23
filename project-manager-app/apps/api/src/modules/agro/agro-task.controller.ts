import {
  Body, Controller, Get, Param, Patch, Post, Query, Req,
} from "@nestjs/common";
import { z } from "zod";
import { ok } from "../../common/api-response.js";
import { resolveRequestId } from "../../common/request-id.js";
import { RequirePermissions } from "../../common/permissions.decorator.js";
import { resolveRequestContext } from "../../common/request-context.js";
import { AgroTaskService } from "./agro-task.service.js";

const taskTypeEnum     = z.enum(["FEEDING","VACCINATION","TREATMENT","WEIGHING","MOVEMENT","CLEANING","INSPECTION","INVENTORY","SALE","WATER_CHECK","OTHER"]);
const priorityEnum     = z.enum(["LOW","MEDIUM","HIGH","URGENT"]);
const targetTypeEnum   = z.enum(["ANIMAL","ANIMAL_GROUP","FARM_UNIT","INVENTORY","GENERAL"]);

const createTaskSchema = z.object({
  title:        z.string().min(1),
  type:         taskTypeEnum,
  targetType:   targetTypeEnum.optional(),
  targetId:     z.string().optional(),
  assignedToId: z.string().optional(),
  priority:     priorityEnum.optional(),
  dueAt:        z.coerce.date().optional(),
  notes:        z.string().optional(),
});

const updateTaskSchema = z.object({
  title:        z.string().min(1).optional(),
  assignedToId: z.string().optional(),
  priority:     priorityEnum.optional(),
  dueAt:        z.coerce.date().nullable().optional(),
  notes:        z.string().optional(),
});

const reasonSchema = z.object({ reason: z.string().optional() });

@Controller("v1/agro")
export class AgroTaskController {
  constructor(private readonly service: AgroTaskService) {}

  @Get("farms/:farmId/tasks")
  @RequirePermissions("agro:read")
  async listTasks(
    @Param("farmId") farmId: string,
    @Query("status") status: string | undefined,
    @Req() req: any,
  ) {
    const ctx = resolveRequestContext(req);
    const tasks = await this.service.listTasks(farmId, ctx.userId, { status });
    return ok(resolveRequestId(req.headers ?? {}), { tasks });
  }

  @Post("farms/:farmId/tasks")
  @RequirePermissions("agro:write")
  async createTask(@Param("farmId") farmId: string, @Body() body: unknown, @Req() req: any) {
    const ctx = resolveRequestContext(req);
    const input = createTaskSchema.parse(body);
    const task = await this.service.createTask(farmId, ctx.userId, input);
    return ok(resolveRequestId(req.headers ?? {}), { task });
  }

  @Get("tasks/:taskId")
  @RequirePermissions("agro:read")
  async getTask(@Param("taskId") taskId: string, @Req() req: any) {
    const task = await this.service.getTask(taskId);
    return ok(resolveRequestId(req.headers ?? {}), { task });
  }

  @Patch("tasks/:taskId")
  @RequirePermissions("agro:write")
  async updateTask(@Param("taskId") taskId: string, @Body() body: unknown, @Req() req: any) {
    const ctx = resolveRequestContext(req);
    const input = updateTaskSchema.parse(body);
    const task = await this.service.updateTask(taskId, ctx.userId, input);
    return ok(resolveRequestId(req.headers ?? {}), { task });
  }

  @Post("tasks/:taskId/start")
  @RequirePermissions("agro:write")
  async startTask(@Param("taskId") taskId: string, @Req() req: any) {
    const ctx = resolveRequestContext(req);
    const task = await this.service.startTask(taskId, ctx.userId);
    return ok(resolveRequestId(req.headers ?? {}), { task });
  }

  @Post("tasks/:taskId/complete")
  @RequirePermissions("agro:write")
  async completeTask(@Param("taskId") taskId: string, @Req() req: any) {
    const ctx = resolveRequestContext(req);
    const task = await this.service.completeTask(taskId, ctx.userId);
    return ok(resolveRequestId(req.headers ?? {}), { task });
  }

  @Post("tasks/:taskId/block")
  @RequirePermissions("agro:write")
  async blockTask(@Param("taskId") taskId: string, @Body() body: unknown, @Req() req: any) {
    const ctx = resolveRequestContext(req);
    const { reason } = reasonSchema.parse(body);
    const task = await this.service.blockTask(taskId, ctx.userId, reason);
    return ok(resolveRequestId(req.headers ?? {}), { task });
  }

  @Post("tasks/:taskId/cancel")
  @RequirePermissions("agro:write")
  async cancelTask(@Param("taskId") taskId: string, @Body() body: unknown, @Req() req: any) {
    const ctx = resolveRequestContext(req);
    const { reason } = reasonSchema.parse(body);
    const task = await this.service.cancelTask(taskId, ctx.userId, reason);
    return ok(resolveRequestId(req.headers ?? {}), { task });
  }

  @Get("tasks/:taskId/timeline")
  @RequirePermissions("agro:read")
  async getTaskTimeline(@Param("taskId") taskId: string, @Req() req: any) {
    const ctx = resolveRequestContext(req);
    const events = await this.service.getTaskTimeline(taskId, ctx.userId);
    return ok(resolveRequestId(req.headers ?? {}), { events });
  }

  @Get("entities/:targetType/:targetId/tasks")
  @RequirePermissions("agro:read")
  async getEntityTasks(
    @Param("targetType") targetType: string,
    @Param("targetId") targetId: string,
    @Query("farmId") farmId: string,
    @Req() req: any,
  ) {
    const ctx = resolveRequestContext(req);
    const tasks = await this.service.listEntityTasks(farmId, ctx.userId, targetType, targetId);
    return ok(resolveRequestId(req.headers ?? {}), { tasks });
  }
}
