import { clientJobs, clientProfile } from "@/data/clientMockData";
import { mobileFetch } from "@/lib/api/http";
import { MOBILE_ENV } from "@/lib/config/env";
import { trackTelemetryEvent } from "@/lib/observability/telemetry";
import type { ClientProfileSnapshot } from "@/domains/client/jobs/types";

type ClientProfilePayload = {
  profile: ClientProfileSnapshot;
  activeProjects: number;
  completedProjects: number;
};

function mockClientProfilePayload(): ClientProfilePayload {
  return {
    profile: clientProfile,
    activeProjects: clientJobs.filter((job) => job.status === "active").length,
    completedProjects: clientJobs.filter((job) => job.status === "completed").length,
  };
}

export async function getClientProfileSnapshot(): Promise<ClientProfilePayload> {
  if (MOBILE_ENV.runtimeMode === "mock") {
    const payload = mockClientProfilePayload();
    trackTelemetryEvent({ name: "client.profile.mock_loaded", surface: "client.profile", metadata: { activeProjects: payload.activeProjects, completedProjects: payload.completedProjects } });
    return payload;
  }

  const payload = await mobileFetch<ClientProfilePayload>({
    path: "/client/profile",
    useBff: MOBILE_ENV.runtimeMode === "bff",
  }).catch(() => mockClientProfilePayload());

  trackTelemetryEvent({ name: "client.profile.loaded", surface: "client.profile", metadata: { activeProjects: payload.activeProjects, completedProjects: payload.completedProjects, mode: MOBILE_ENV.runtimeMode } });
  return payload;
}
