import { disputes } from "@/data/mockData";
import { mobileFetch } from "@/lib/api/http";
import { MOBILE_ENV } from "@/lib/config/env";
import { trackTelemetryEvent } from "@/lib/observability/telemetry";
import type { Dispute } from "@/types";

type WorkerDisputesPayload = {
  disputes: Dispute[];
};

function mockWorkerDisputesPayload(): WorkerDisputesPayload {
  return {
    disputes,
  };
}

export async function listWorkerDisputes(): Promise<Dispute[]> {
  if (MOBILE_ENV.runtimeMode === "mock") {
    const payload = mockWorkerDisputesPayload();
    trackTelemetryEvent({ name: "worker.disputes.mock_loaded", surface: "worker.disputes", metadata: { total: payload.disputes.length } });
    return payload.disputes;
  }

  const payload = await mobileFetch<WorkerDisputesPayload>({
    path: "/disputes/worker",
    useBff: MOBILE_ENV.runtimeMode === "bff",
  }).catch(() => mockWorkerDisputesPayload());

  trackTelemetryEvent({ name: "worker.disputes.loaded", surface: "worker.disputes", metadata: { total: payload.disputes.length, mode: MOBILE_ENV.runtimeMode } });
  return payload.disputes;
}
