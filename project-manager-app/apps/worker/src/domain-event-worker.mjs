import { UnrecoverableError } from "bullmq";

const EVENT_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function parseDomainEventJobData(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Domain event job data must contain only eventId");
  }

  const keys = Object.keys(value);
  if (keys.length !== 1 || keys[0] !== "eventId") {
    throw new Error("Domain event job data may contain only eventId");
  }

  if (typeof value.eventId !== "string" || !EVENT_ID_PATTERN.test(value.eventId)) {
    throw new Error("Domain event job eventId must be a UUID");
  }

  return { eventId: value.eventId };
}

export function isTerminalDomainEventHttpStatus(status) {
  return status >= 400 && status < 500 && status !== 408 && status !== 429;
}

function httpStatusFromError(error) {
  if (!(error instanceof Error)) return null;
  const match = error.message.match(/\bHTTP\s+(\d{3})\b/);
  return match ? Number(match[1]) : null;
}

export async function processDomainEventQueueJob({
  jobData,
  workerId,
  postJson,
}) {
  const { eventId } = parseDomainEventJobData(jobData);
  try {
    const response = await postJson(`/v1/domain-events/${eventId}/process`, {
      workerId,
    });
    return response.data;
  } catch (error) {
    const status = httpStatusFromError(error);
    if (status !== null && isTerminalDomainEventHttpStatus(status)) {
      throw new UnrecoverableError(
        `Terminal domain event consumer response HTTP ${status} eventId=${eventId}`,
      );
    }
    throw error;
  }
}
