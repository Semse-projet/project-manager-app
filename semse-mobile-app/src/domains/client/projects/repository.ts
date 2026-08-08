import { activeProject } from "@/data/clientMockData";
import { mobileFetch } from "@/lib/api/http";
import { MOBILE_ENV } from "@/lib/config/env";
import { trackTelemetryEvent } from "@/lib/observability/telemetry";
import type { ClientProject } from "@/domains/client/projects/types";

type ClientProjectPayload = {
  project: ClientProject | null;
};

function mockClientProjectPayload(): ClientProjectPayload {
  return {
    project: activeProject,
  };
}

export async function getActiveClientProject(): Promise<ClientProject | null> {
  if (MOBILE_ENV.runtimeMode === "mock") {
    const payload = mockClientProjectPayload();
    trackTelemetryEvent({ name: "client.project.mock_loaded", surface: "client.project", metadata: { available: Boolean(payload.project) } });
    return payload.project;
  }

  const payload = await mobileFetch<ClientProjectPayload>({
    path: "/client/projects/active",
    useBff: MOBILE_ENV.runtimeMode === "bff",
  }).catch(() => mockClientProjectPayload());

  trackTelemetryEvent({ name: "client.project.loaded", surface: "client.project", metadata: { available: Boolean(payload.project), mode: MOBILE_ENV.runtimeMode } });
  return payload.project;
}
