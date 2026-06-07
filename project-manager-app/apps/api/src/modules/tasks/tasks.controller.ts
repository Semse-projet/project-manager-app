import { BadRequestException, Body, Controller, Get, Param, Patch, Post, Query, Req } from "@nestjs/common";
import { z } from "zod";
import { ok } from "../../common/api-response.js";
import { RequirePermissions } from "../../common/permissions.decorator.js";
import { resolveRequestContext } from "../../common/request-context.js";
import { resolveRequestId } from "../../common/request-id.js";
import { TasksService } from "./tasks.service.js";

const createTaskSchema = z.object({
  jobId:       z.string().min(1),
  milestone:   z.string().min(1),
  title:       z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  dueDate:     z.string().optional(),
  priority:    z.enum(["low", "medium", "high"]).optional(),
  assignedTo:  z.string().optional(),
});

const updateStatusSchema = z.object({
  status: z.enum(["pending", "in_progress", "done", "blocked"]),
});

@Controller("v1/tasks")
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Get()
  @RequirePermissions("jobs:read")
  async listByWorker(
    @Req() req: { headers?: Record<string, unknown> },
    @Query("status") status?: string
  ) {
    const actor = resolveRequestContext(req);
    const data = await this.tasksService.listByWorker({
      tenantId: actor.tenantId,
      userId: actor.userId,
      status,
    });
    return ok(resolveRequestId(req.headers ?? {}), data);
  }

  @Get("by-job/:jobId")
  @RequirePermissions("jobs:read")
  async listByJob(
    @Req() req: { headers?: Record<string, unknown> },
    @Param("jobId") jobId: string
  ) {
    const actor = resolveRequestContext(req);
    const data = await this.tasksService.listByJob({ tenantId: actor.tenantId, jobId });
    return ok(resolveRequestId(req.headers ?? {}), data);
  }

  @Post()
  @RequirePermissions("jobs:create")
  async create(
    @Req() req: { headers?: Record<string, unknown> },
    @Body() body: unknown
  ) {
    const parsed = createTaskSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());

    const actor = resolveRequestContext(req);
    const data = await this.tasksService.create({ ...parsed.data, tenantId: actor.tenantId, createdBy: actor.userId });
    return ok(resolveRequestId(req.headers ?? {}), data);
  }

  @Patch(":taskId/status")
  @RequirePermissions("jobs:update")
  async updateStatus(
    @Req() req: { headers?: Record<string, unknown> },
    @Param("taskId") taskId: string,
    @Body() body: unknown
  ) {
    const parsed = updateStatusSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());

    const actor = resolveRequestContext(req);
    const data = await this.tasksService.updateStatus({ tenantId: actor.tenantId, taskId, status: parsed.data.status });
    return ok(resolveRequestId(req.headers ?? {}), data);
  }
}
