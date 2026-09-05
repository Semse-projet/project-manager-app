import { randomUUID } from "node:crypto";
import { SEMSE_TRACE_HEADER_NAME } from "@semse/shared";
import { getObservabilityContext } from "../infrastructure/observability/request-context.store.js";

/**
 * Distributed trace id for the current request: reuses the inbound `x-trace-id`
 * header when present so API → Worker → Autonomy share the same trace.
 */
export function resolveTraceId(headers: Record<string, unknown>): string {
  const contextTraceId = getObservabilityContext()?.traceId;
  if (typeof contextTraceId === "string" && contextTraceId.trim()) {
    return contextTraceId;
  }

  const headerValue = headers[SEMSE_TRACE_HEADER_NAME];
  if (typeof headerValue === "string" && headerValue.trim()) {
    return headerValue.trim();
  }
  return randomUUID();
}

export function resolveRequestId(headers: Record<string, unknown>): string {
  const contextRequestId = getObservabilityContext()?.requestId;
  if (typeof contextRequestId === "string" && contextRequestId.trim()) {
    return contextRequestId;
  }

  const headerValue = headers["x-request-id"];
  if (typeof headerValue === "string" && headerValue.trim()) {
    return headerValue;
  }
  return randomUUID();
}
