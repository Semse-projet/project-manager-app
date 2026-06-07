import { Body, Controller, Get, Param, Post, Req } from "@nestjs/common";
import type { FastifyRequest } from "fastify";
import {
  anatomyIdSchema,
  anatomyQuerySchema,
  anatomyValidationSchema
} from "@semse/schemas";
import { ok } from "../../common/api-response.js";
import { resolveRequestId } from "../../common/request-id.js";
import { parseWithSchema } from "../../common/zod-validation.js";
import { AnatomyService } from "./anatomy.service.js";

@Controller("v1/anatomy")
export class AnatomyController {
  constructor(private readonly anatomyService: AnatomyService) {}

  @Get("tree")
  async tree(@Req() req: FastifyRequest) {
    return ok(resolveRequestId(req.headers ?? {}), await this.anatomyService.getTree());
  }

  @Get("node/:id")
  async node(@Req() req: FastifyRequest, @Param("id") id: string) {
    const nodeId = parseWithSchema(anatomyIdSchema, id);
    return ok(resolveRequestId(req.headers ?? {}), await this.anatomyService.getNode(nodeId));
  }

  @Get("children/:id")
  async children(@Req() req: FastifyRequest, @Param("id") id: string) {
    const nodeId = parseWithSchema(anatomyIdSchema, id);
    return ok(resolveRequestId(req.headers ?? {}), await this.anatomyService.getChildren(nodeId));
  }

  @Get("relations/:id")
  async relations(@Req() req: FastifyRequest, @Param("id") id: string) {
    const nodeId = parseWithSchema(anatomyIdSchema, id);
    return ok(resolveRequestId(req.headers ?? {}), await this.anatomyService.getRelations(nodeId));
  }

  @Post("query")
  async query(@Req() req: FastifyRequest, @Body() body: Record<string, unknown>) {
    const parsed = parseWithSchema(anatomyQuerySchema, body);
    return ok(
      resolveRequestId(req.headers ?? {}),
      await this.anatomyService.query({
        ...parsed,
        includeRelations: parsed.includeRelations ?? true,
        includePath: parsed.includePath ?? true,
        maxDepth: parsed.maxDepth ?? 4
      })
    );
  }

  @Post("validate")
  async validate(@Req() req: FastifyRequest, @Body() body: Record<string, unknown>) {
    const parsed = parseWithSchema(anatomyValidationSchema, body);
    return ok(resolveRequestId(req.headers ?? {}), await this.anatomyService.validate(parsed));
  }
}
