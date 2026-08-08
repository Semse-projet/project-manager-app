import { checklists, fieldUnits } from "@/data/mockData";
import { mobileFetch } from "@/lib/api/http";
import { MOBILE_ENV } from "@/lib/config/env";
import { trackTelemetryEvent } from "@/lib/observability/telemetry";
import type { WorkerChecklist, WorkerFieldUnit } from "@/domains/worker/field-ops/types";

type WorkerFieldOpsPayload = {
  units: WorkerFieldUnit[];
  checklists: WorkerChecklist[];
};

function mockWorkerFieldOpsPayload(): WorkerFieldOpsPayload {
  return {
    units: fieldUnits,
    checklists,
  };
}

export async function getWorkerFieldOpsSnapshot(): Promise<WorkerFieldOpsPayload> {
  if (MOBILE_ENV.runtimeMode === "mock") {
    const payload = mockWorkerFieldOpsPayload();
    trackTelemetryEvent({ name: "worker.field_ops.mock_loaded", surface: "worker.field_ops", metadata: { units: payload.units.length, checklists: payload.checklists.length } });
    return payload;
  }

  const payload = await mobileFetch<WorkerFieldOpsPayload>({
    path: "/field-ops/worker/snapshot",
    useBff: MOBILE_ENV.runtimeMode === "bff",
  }).catch(() => mockWorkerFieldOpsPayload());

  trackTelemetryEvent({ name: "worker.field_ops.loaded", surface: "worker.field_ops", metadata: { units: payload.units.length, checklists: payload.checklists.length, mode: MOBILE_ENV.runtimeMode } });
  return payload;
}
