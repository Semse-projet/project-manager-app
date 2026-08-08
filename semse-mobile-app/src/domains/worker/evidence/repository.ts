import { jobs } from "@/data/mockData";
import { mobileFetch } from "@/lib/api/http";
import { MOBILE_ENV } from "@/lib/config/env";
import { trackTelemetryEvent } from "@/lib/observability/telemetry";
import { toWorkerEvidence } from "@/domains/worker/evidence/adapters";
import type { WorkerEvidence } from "@/domains/worker/evidence/types";

type WorkerEvidencePayload = {
  evidences: WorkerEvidence[];
};

function mockWorkerEvidencePayload(): WorkerEvidencePayload {
  return {
    evidences: jobs.flatMap(toWorkerEvidence),
  };
}

export async function listWorkerEvidence(): Promise<WorkerEvidence[]> {
  if (MOBILE_ENV.runtimeMode === "mock") {
    const payload = mockWorkerEvidencePayload();
    trackTelemetryEvent({ name: "worker.evidence.mock_loaded", surface: "worker.evidence", metadata: { total: payload.evidences.length } });
    return payload.evidences;
  }

  const payload = await mobileFetch<WorkerEvidencePayload>({
    path: "/travel/worker/evidence",
    useBff: MOBILE_ENV.runtimeMode === "bff",
  }).catch(() => mockWorkerEvidencePayload());

  trackTelemetryEvent({ name: "worker.evidence.loaded", surface: "worker.evidence", metadata: { total: payload.evidences.length, mode: MOBILE_ENV.runtimeMode } });
  return payload.evidences;
}
