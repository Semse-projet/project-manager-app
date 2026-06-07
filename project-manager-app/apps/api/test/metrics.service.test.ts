import test from "node:test";
import assert from "node:assert/strict";
import { MetricsService } from "../src/infrastructure/observability/metrics.service.ts";

test("MetricsService renders Prometheus metrics for recorded routes", () => {
  const service = new MetricsService();
  service.recordHttpRequest({
    method: "GET",
    route: "/v1/health",
    statusCode: 200,
    durationMs: 12
  });
  service.recordHttpRequest({
    method: "GET",
    route: "/v1/health",
    statusCode: 500,
    durationMs: 20
  });

  const rendered = service.renderPrometheus();

  assert.match(rendered, /semse_http_requests_total 2/);
  assert.match(rendered, /semse_http_errors_total 1/);
  assert.match(rendered, /route="\/v1\/health"/);
  assert.match(rendered, /semse_http_route_duration_ms_avg\{method="GET",route="\/v1\/health"\} 16.00/);
});
