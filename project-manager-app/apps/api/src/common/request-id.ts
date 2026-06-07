import { randomUUID } from "node:crypto";
import { getObservabilityContext } from "../infrastructure/observability/request-context.store.js";

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
