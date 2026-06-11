type RouteMetric = {
  requests: number;
  errors: number;
  totalDurationMs: number;
};

export class MetricsService {
  private readonly routeMetrics = new Map<string, RouteMetric>();
  private readonly counters = {
    httpRequestsTotal: 0,
    httpErrorsTotal: 0
  };

  recordHttpRequest(input: {
    method: string;
    route: string;
    statusCode: number;
    durationMs: number;
  }): void {
    this.counters.httpRequestsTotal += 1;
    if (input.statusCode >= 500) {
      this.counters.httpErrorsTotal += 1;
    }

    const key = `${input.method} ${input.route}`;
    const current = this.routeMetrics.get(key) ?? {
      requests: 0,
      errors: 0,
      totalDurationMs: 0
    };

    current.requests += 1;
    current.totalDurationMs += input.durationMs;
    if (input.statusCode >= 500) {
      current.errors += 1;
    }

    this.routeMetrics.set(key, current);
  }

  renderPrometheus(): string {
    const lines = [
      "# HELP semse_http_requests_total Total HTTP requests handled by the API",
      "# TYPE semse_http_requests_total counter",
      `semse_http_requests_total ${this.counters.httpRequestsTotal}`,
      "# HELP semse_http_errors_total Total HTTP 5xx responses handled by the API",
      "# TYPE semse_http_errors_total counter",
      `semse_http_errors_total ${this.counters.httpErrorsTotal}`,
      "# HELP semse_http_route_requests_total Total HTTP requests per route",
      "# TYPE semse_http_route_requests_total counter",
      "# HELP semse_http_route_errors_total Total HTTP 5xx responses per route",
      "# TYPE semse_http_route_errors_total counter",
      "# HELP semse_http_route_duration_ms_avg Average response time per route in milliseconds",
      "# TYPE semse_http_route_duration_ms_avg gauge"
    ];

    for (const [routeKey, metric] of this.routeMetrics.entries()) {
      const [method, ...routeParts] = routeKey.split(" ");
      const route = routeParts.join(" ");
      const routeLabel = route
        .replace(/\\/g, '\\\\')
        .replace(/"/g, '\\"')
        .replace(/\n/g, '\\n');
      lines.push(
        `semse_http_route_requests_total{method="${method}",route="${routeLabel}"} ${metric.requests}`
      );
      lines.push(
        `semse_http_route_errors_total{method="${method}",route="${routeLabel}"} ${metric.errors}`
      );
      lines.push(
        `semse_http_route_duration_ms_avg{method="${method}",route="${routeLabel}"} ${(
          metric.totalDurationMs / metric.requests
        ).toFixed(2)}`
      );
    }

    return `${lines.join("\n")}\n`;
  }
}
