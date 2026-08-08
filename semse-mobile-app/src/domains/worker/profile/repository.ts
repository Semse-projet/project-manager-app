import { userProfile } from "@/data/mockData";
import { mobileFetchContract, SEMSE_CONTRACTS } from "@/lib/api/contracts";
import { MOBILE_ENV } from "@/lib/config/env";
import { mapUserRecordToWorkerProfile } from "@/lib/api/mappers";
import { trackTelemetryEvent } from "@/lib/observability/telemetry";
import type { WorkerProfile } from "@/domains/worker/profile/types";

type WorkerProfilePayload = {
  profile: WorkerProfile;
};

function mockWorkerProfilePayload(): WorkerProfilePayload {
  return {
    profile: userProfile,
  };
}

export async function getWorkerProfile(): Promise<WorkerProfile> {
  if (MOBILE_ENV.runtimeMode === "mock") {
    const payload = mockWorkerProfilePayload();
    trackTelemetryEvent({ name: "worker.profile.mock_loaded", surface: "worker.profile" });
    return payload.profile;
  }

  const payload = await mobileFetchContract<Record<string, unknown>>(
    SEMSE_CONTRACTS.users.me,
  )
    .then((record) => ({ profile: mapUserRecordToWorkerProfile(record) }))
    .catch(() => {
      if (MOBILE_ENV.allowMockFallback) {
        return mockWorkerProfilePayload();
      }
      throw new Error("worker.profile contract fetch failed");
    });

  trackTelemetryEvent({ name: "worker.profile.loaded", surface: "worker.profile", metadata: { mode: MOBILE_ENV.runtimeMode } });
  return payload.profile;
}
