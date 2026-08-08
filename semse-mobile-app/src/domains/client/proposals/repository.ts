import { proposals } from "@/data/clientMockData";
import { mobileFetch } from "@/lib/api/http";
import { MOBILE_ENV } from "@/lib/config/env";
import { trackTelemetryEvent } from "@/lib/observability/telemetry";
import type { ClientProposal } from "@/domains/client/proposals/types";

type ClientProposalsPayload = {
  proposals: ClientProposal[];
};

function mockClientProposalsPayload(): ClientProposalsPayload {
  return {
    proposals,
  };
}

export async function listClientProposals(): Promise<ClientProposal[]> {
  if (MOBILE_ENV.runtimeMode === "mock") {
    const payload = mockClientProposalsPayload();
    trackTelemetryEvent({ name: "client.proposals.mock_loaded", surface: "client.proposals", metadata: { total: payload.proposals.length } });
    return payload.proposals;
  }

  const payload = await mobileFetch<ClientProposalsPayload>({
    path: "/client/proposals",
    useBff: MOBILE_ENV.runtimeMode === "bff",
  }).catch(() => mockClientProposalsPayload());

  trackTelemetryEvent({ name: "client.proposals.loaded", surface: "client.proposals", metadata: { total: payload.proposals.length, mode: MOBILE_ENV.runtimeMode } });
  return payload.proposals;
}
