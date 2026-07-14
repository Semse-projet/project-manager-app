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
  private readonly outboxMetrics = {
    pendingTotal: 0,
    oldestPendingAgeSeconds: 0,
    publishLagSeconds: 0,
    deadLetterTotal: 0,
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

  recordOutboxSnapshot(input: {
    pendingTotal: number;
    oldestPendingAgeSeconds: number;
    deadLetterTotal: number;
  }): void {
    this.outboxMetrics.pendingTotal = input.pendingTotal;
    this.outboxMetrics.oldestPendingAgeSeconds = input.oldestPendingAgeSeconds;
    this.outboxMetrics.deadLetterTotal = input.deadLetterTotal;
  }

  recordOutboxPublishLag(seconds: number): void {
    this.outboxMetrics.publishLagSeconds = Math.max(0, seconds);
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
      "# TYPE semse_http_route_duration_ms_avg gauge",
      "# HELP semse_outbox_pending_total Durable outbox events awaiting confirmed BullMQ ingress",
      "# TYPE semse_outbox_pending_total gauge",
      `semse_outbox_pending_total ${this.outboxMetrics.pendingTotal}`,
      "# HELP semse_outbox_oldest_pending_age_seconds Age of the oldest unresolved outbox event",
      "# TYPE semse_outbox_oldest_pending_age_seconds gauge",
      `semse_outbox_oldest_pending_age_seconds ${this.outboxMetrics.oldestPendingAgeSeconds}`,
      "# HELP semse_outbox_publish_lag_seconds Last observed outbox-to-BullMQ publish lag",
      "# TYPE semse_outbox_publish_lag_seconds gauge",
      `semse_outbox_publish_lag_seconds ${this.outboxMetrics.publishLagSeconds}`,
      "# HELP semse_event_dlq_total Durable outbox events currently in dead letter",
      "# TYPE semse_event_dlq_total gauge",
      `semse_event_dlq_total ${this.outboxMetrics.deadLetterTotal}`,
    ];

    for (const [routeKey, metric] of this.routeMetrics.entries()) {
      const [method, ...routeParts] = routeKey.split(" ");
      const route = routeParts.join(" ");
      const routeLabel = route
        .replace(/\\/g, "\\\\")
        .replace(/"/g, '\\"')
        .replace(/\n/g, "\\n");
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
