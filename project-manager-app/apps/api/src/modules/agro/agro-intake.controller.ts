import { Body, Controller, Param, Post, Req } from "@nestjs/common";
import { z } from "zod";
import { ok } from "../../common/api-response.js";
import { resolveRequestId } from "../../common/request-id.js";
import { RequirePermissions } from "../../common/permissions.decorator.js";
import { resolveRequestContext } from "../../common/request-context.js";
import { parseWithSchema } from "../../common/zod-validation.js";
import { AgroIntakeService } from "./agro-intake.service.js";

const proposeSchema = z.object({
  text: z.string().min(1).max(4000),
  evidenceIds: z.array(z.string()).max(10).optional(),
  occurredAt: z.coerce.date().optional(),
});

@Controller("v1/agro")
export class AgroIntakeController {
  constructor(private readonly service: AgroIntakeService) {}

  /** Propuesta de Prometeo Agro. No escribe nada: la confirmación usa los endpoints normales. */
  @Post("farms/:farmId/intake/propose")
  @RequirePermissions("agro:report")
  async propose(@Param("farmId") farmId: string, @Body() body: unknown, @Req() req: any) {
    const ctx = resolveRequestContext(req);
    const proposal = await this.service.propose(farmId, ctx.userId, parseWithSchema(proposeSchema, body));
    return ok(resolveRequestId(req.headers ?? {}), { proposal });
  }
}
