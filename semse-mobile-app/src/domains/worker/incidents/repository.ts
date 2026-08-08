import { incidents } from "@/data/mockData";
import { mobileFetch } from "@/lib/api/http";
import { MOBILE_ENV } from "@/lib/config/env";
import { trackTelemetryEvent } from "@/lib/observability/telemetry";
import type { Incident } from "@/types";

type WorkerIncidentsPayload = {
  incidents: Incident[];
};

function mockWorkerIncidentsPayload(): WorkerIncidentsPayload {
  return {
    incidents,
  };
}

export async function listWorkerIncidents(): Promise<Incident[]> {
  if (MOBILE_ENV.runtimeMode === "mock") {
    const payload = mockWorkerIncidentsPayload();
    trackTelemetryEvent({ name: "worker.incidents.mock_loaded", surface: "worker.incidents", metadata: { total: payload.incidents.length } });
    return payload.incidents;
  }

  const payload = await mobileFetch<WorkerIncidentsPayload>({
    path: "/incidents/worker",
    useBff: MOBILE_ENV.runtimeMode === "bff",
  }).catch(() => mockWorkerIncidentsPayload());

  trackTelemetryEvent({ name: "worker.incidents.loaded", surface: "worker.incidents", metadata: { total: payload.incidents.length, mode: MOBILE_ENV.runtimeMode } });
  return payload.incidents;
}
