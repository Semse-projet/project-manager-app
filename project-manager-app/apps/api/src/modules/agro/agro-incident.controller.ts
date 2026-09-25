import { Body, Controller, Get, Param, Patch, Post, Query, Req } from "@nestjs/common";
import { z } from "zod";
import { ok } from "../../common/api-response.js";
import { resolveRequestId } from "../../common/request-id.js";
import { RequirePermissions } from "../../common/permissions.decorator.js";
import { resolveRequestContext } from "../../common/request-context.js";
import { parseWithSchema } from "../../common/zod-validation.js";
import { parsePositiveInt } from "../../common/parse-query.js";
import { AGRO_EVIDENCE_MEDIA_TYPES } from "./agro-evidence.service.js";
import {
  AGRO_INCIDENT_SEVERITIES, AGRO_INCIDENT_SOURCES, AGRO_INCIDENT_STATUSES, AGRO_INCIDENT_TYPES,
} from "./agro-incident.domain.js";
import { AgroIncidentService } from "./agro-incident.service.js";
import { AGRO_TASK_REF_SOURCES } from "./agro-task-ref.resolver.js";

const evidenceItemSchema = z.object({
  mediaType: z.enum(AGRO_EVIDENCE_MEDIA_TYPES),
  title: z.string().max(200).optional(),
  note: z.string().max(5000).optional(),
  fileUrl: z.string().url().optional(),
  capturedAt: z.coerce.date().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
});

const relationsSchema = {
  farmUnitId: z.string().min(1).nullish(),
  animalId: z.string().min(1).nullish(),
  animalGroupId: z.string().min(1).nullish(),
  cropCycleId: z.string().min(1).nullish(),
  inventoryItemId: z.string().min(1).nullish(),
};

const taskRefSchema = z.object({ source: z.enum(AGRO_TASK_REF_SOURCES).optional(), id: z.string().min(1) });

const createIncidentSchema = z.object({
  type: z.enum(AGRO_INCIDENT_TYPES),
  severity: z.enum(AGRO_INCIDENT_SEVERITIES).optional(),
  title: z.string().min(1).max(200),
  description: z.string().max(10000).optional(),
  occurredAt: z.coerce.date().optional(),
  assignedToId: z.string().min(1).optional(),
  relatedTask: taskRefSchema.optional(),
  source: z.enum(AGRO_INCIDENT_SOURCES).optional(),
  clientEventId: z.string().min(1).max(120).optional(),
  evidence: z.array(evidenceItemSchema).max(10).optional(),
  metadata: z.record(z.unknown()).optional(),
  ...relationsSchema,
});

const updateIncidentSchema = z.object({
  type: z.enum(AGRO_INCIDENT_TYPES).optional(),
  severity: z.enum(AGRO_INCIDENT_SEVERITIES).optional(),
  severityReason: z.string().max(2000).optional(),
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(10000).optional(),
  occurredAt: z.coerce.date().nullable().optional(),
  ...relationsSchema,
});

const transitionSchema = z.object({
  to: z.enum(AGRO_INCIDENT_STATUSES),
  resolution: z.string().max(10000).optional(),
  reason: z.string().max(5000).optional(),
  duplicateOfId: z.string().min(1).optional(),
});

const assignSchema = z.object({ assignedToId: z.string().min(1).nullable() });
const linkTaskSchema = z.object({ task: taskRefSchema.nullable() });
const commentSchema = z.object({ body: z.string().min(1).max(10000), kind: z.enum(["COMMENT", "ASSESSMENT"]).optional() });

function csv(value: string | undefined): string[] | undefined {
  if (!value) return undefined;
  const parts = value.split(",").map((v) => v.trim()).filter(Boolean);
  return parts.length ? parts : undefined;
}

@Controller("v1/agro")
export class AgroIncidentController {
  constructor(private readonly service: AgroIncidentService) {}

  @Get("farms/:farmId/incidents")
  @RequirePermissions("agro:read")
  async list(@Param("farmId") farmId: string, @Query() query: Record<string, string | undefined>, @Req() req: any) {
    const ctx = resolveRequestContext(req);
    const data = await this.service.list(farmId, ctx.userId, {
      status: csv(query.status),
      severity: csv(query.severity),
      type: csv(query.type),
      assignedToId: query.assignedToId === "me" ? ctx.userId : query.assignedToId,
      reportedById: query.reportedById === "me" ? ctx.userId : query.reportedById,
      farmUnitId: query.farmUnitId,
      animalId: query.animalId,
      animalGroupId: query.animalGroupId,
      q: query.q,
      limit: parsePositiveInt(query.limit, 100),
    });
    return ok(resolveRequestId(req.headers ?? {}), data);
  }

  @Get("farms/:farmId/incidents/summary")
  @RequirePermissions("agro:read")
  async summary(@Param("farmId") farmId: string, @Req() req: any) {
    const ctx = resolveRequestContext(req);
    const summary = await this.service.summary(farmId, ctx.userId);
    return ok(resolveRequestId(req.headers ?? {}), summary);
  }

  @Post("farms/:farmId/incidents")
  @RequirePermissions("agro:report")
  async create(@Param("farmId") farmId: string, @Body() body: unknown, @Req() req: any) {
    const ctx = resolveRequestContext(req);
    const result = await this.service.create(farmId, ctx.userId, parseWithSchema(createIncidentSchema, body));
    return ok(resolveRequestId(req.headers ?? {}), result);
  }

  @Get("incidents/:incidentId")
  @RequirePermissions("agro:read")
  async get(@Param("incidentId") incidentId: string, @Req() req: any) {
    const ctx = resolveRequestContext(req);
    const data = await this.service.get(incidentId, ctx.userId);
    return ok(resolveRequestId(req.headers ?? {}), data);
  }

  @Patch("incidents/:incidentId")
  @RequirePermissions("agro:report")
  async update(@Param("incidentId") incidentId: string, @Body() body: unknown, @Req() req: any) {
    const ctx = resolveRequestContext(req);
    const incident = await this.service.update(incidentId, ctx.userId, parseWithSchema(updateIncidentSchema, body));
    return ok(resolveRequestId(req.headers ?? {}), { incident });
  }

  @Post("incidents/:incidentId/transition")
  @RequirePermissions("agro:report")
  async transition(@Param("incidentId") incidentId: string, @Body() body: unknown, @Req() req: any) {
    const ctx = resolveRequestContext(req);
    const incident = await this.service.transition(incidentId, ctx.userId, parseWithSchema(transitionSchema, body));
    return ok(resolveRequestId(req.headers ?? {}), { incident });
  }

  @Post("incidents/:incidentId/assign")
  @RequirePermissions("agro:report")
  async assign(@Param("incidentId") incidentId: string, @Body() body: unknown, @Req() req: any) {
    const ctx = resolveRequestContext(req);
    const { assignedToId } = parseWithSchema(assignSchema, body);
    const incident = await this.service.assign(incidentId, ctx.userId, assignedToId);
    return ok(resolveRequestId(req.headers ?? {}), { incident });
  }

  @Post("incidents/:incidentId/task")
  @RequirePermissions("agro:report")
  async linkTask(@Param("incidentId") incidentId: string, @Body() body: unknown, @Req() req: any) {
    const ctx = resolveRequestContext(req);
    const { task } = parseWithSchema(linkTaskSchema, body);
    const incident = await this.service.linkTask(incidentId, ctx.userId, task);
    return ok(resolveRequestId(req.headers ?? {}), { incident });
  }

  @Post("incidents/:incidentId/comments")
  @RequirePermissions("agro:report")
  async comment(@Param("incidentId") incidentId: string, @Body() body: unknown, @Req() req: any) {
    const ctx = resolveRequestContext(req);
    const result = await this.service.comment(incidentId, ctx.userId, parseWithSchema(commentSchema, body));
    return ok(resolveRequestId(req.headers ?? {}), result);
  }

  @Post("incidents/:incidentId/evidence")
  @RequirePermissions("agro:report")
  async addEvidence(@Param("incidentId") incidentId: string, @Body() body: unknown, @Req() req: any) {
    const ctx = resolveRequestContext(req);
    const evidence = await this.service.addEvidence(incidentId, ctx.userId, parseWithSchema(evidenceItemSchema, body));
    return ok(resolveRequestId(req.headers ?? {}), { evidence });
  }
}
