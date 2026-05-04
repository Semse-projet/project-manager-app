import { Body, Controller, Post, Req } from "@nestjs/common";
import { matchJobInputSchema } from "@semse/schemas";
import { ok } from "../../common/api-response.js";
import { RequirePermissions } from "../../common/permissions.decorator.js";
import { resolveRequestContext } from "../../common/request-context.js";
import { resolveRequestId } from "../../common/request-id.js";
import { parseWithSchema } from "../../common/zod-validation.js";
import { MatchingService } from "./matching.service.js";

@Controller("v1/matching")
export class MatchingController {
  constructor(private readonly matchingService: MatchingService) {}

  /**
   * POST /v1/matching/jobs
   * Returns ranked candidates for a job using the Jaccard + trust composite algorithm.
   */
  @Post("jobs")
  @RequirePermissions("matching:read")
  async matchJob(
    @Req() req: { headers?: Record<string, unknown> },
    @Body() body: unknown
  ) {
    const parsed = parseWithSchema(matchJobInputSchema, body);
    const actor = resolveRequestContext(req);
    const requestId = resolveRequestId(req.headers ?? {});
    const data = await this.matchingService.matchJob(actor.tenantId, {
      jobId: parsed.jobId,
      limit: parsed.limit ?? 10,
      minScore: parsed.minScore ?? 0
    });
    return ok(requestId, data);
  }
}
