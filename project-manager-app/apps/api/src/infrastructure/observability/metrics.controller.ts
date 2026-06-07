import { Controller, Get, Header, Req } from "@nestjs/common";
import { Public } from "../../common/public.decorator.js";
import { resolveRequestId } from "../../common/request-id.js";
import { MetricsService } from "./metrics.service.js";

@Controller("v1/metrics")
export class MetricsController {
  constructor(private readonly metricsService: MetricsService) {}

  @Get()
  @Public()
  @Header("Content-Type", "text/plain; version=0.0.4; charset=utf-8")
  metrics(@Req() req: { headers?: Record<string, unknown> }) {
    const requestId = resolveRequestId(req.headers ?? {});
    const body = this.metricsService.renderPrometheus();
    return body.replace(/^/, `# request_id ${requestId}\n`);
  }
}
