import { advanceData } from "@/data/mockData";
import { mobileFetch } from "@/lib/api/http";
import { MOBILE_ENV } from "@/lib/config/env";
import { trackTelemetryEvent } from "@/lib/observability/telemetry";
import type { WorkerAdvance } from "@/domains/worker/advance/types";

type WorkerAdvancePayload = {
  advance: WorkerAdvance | null;
};

function mockWorkerAdvancePayload(): WorkerAdvancePayload {
  return {
    advance: advanceData,
  };
}

export async function getWorkerAdvance(): Promise<WorkerAdvance | null> {
  if (MOBILE_ENV.runtimeMode === "mock") {
    const payload = mockWorkerAdvancePayload();
    trackTelemetryEvent({ name: "worker.advance.mock_loaded", surface: "worker.advance", metadata: { available: Boolean(payload.advance) } });
    return payload.advance;
  }

  const payload = await mobileFetch<WorkerAdvancePayload>({
    path: "/travel/worker/advance",
    useBff: MOBILE_ENV.runtimeMode === "bff",
  }).catch(() => mockWorkerAdvancePayload());

  trackTelemetryEvent({ name: "worker.advance.loaded", surface: "worker.advance", metadata: { available: Boolean(payload.advance), mode: MOBILE_ENV.runtimeMode } });
  return payload.advance;
}
