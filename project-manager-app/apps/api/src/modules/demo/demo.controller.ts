import { Body, Controller, Post, Req } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { z } from "zod";
import { ok } from "../../common/api-response.js";
import { Public } from "../../common/public.decorator.js";
import { resolveRequestId } from "../../common/request-id.js";
import { DemoService } from "./demo.service.js";

const createDemoSessionSchema = z.object({
  vertical: z.literal("agro"),
});

@Controller("v1/demo")
export class DemoController {
  constructor(private readonly demoService: DemoService) {}

  @Post("session")
  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async createSession(
    @Req() req: { headers?: Record<string, unknown> },
    @Body() body: unknown,
  ) {
    const input = createDemoSessionSchema.parse(body ?? {});
    const requestId = resolveRequestId(req.headers ?? {});
    const session = await this.demoService.createDemoSession({
      vertical: input.vertical,
      requestId,
    });
    return ok(requestId, session);
  }
}
