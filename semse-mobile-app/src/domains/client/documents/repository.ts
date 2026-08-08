import { contractDocs } from "@/data/clientMockData";
import { mobileFetch } from "@/lib/api/http";
import { MOBILE_ENV } from "@/lib/config/env";
import { trackTelemetryEvent } from "@/lib/observability/telemetry";
import type { ClientDocument } from "@/domains/client/documents/types";

type ClientDocumentsPayload = {
  documents: ClientDocument[];
};

function mockClientDocumentsPayload(): ClientDocumentsPayload {
  return {
    documents: contractDocs,
  };
}

export async function listClientDocuments(): Promise<ClientDocument[]> {
  if (MOBILE_ENV.runtimeMode === "mock") {
    const payload = mockClientDocumentsPayload();
    trackTelemetryEvent({ name: "client.documents.mock_loaded", surface: "client.documents", metadata: { total: payload.documents.length } });
    return payload.documents;
  }

  const payload = await mobileFetch<ClientDocumentsPayload>({
    path: "/client/documents",
    useBff: MOBILE_ENV.runtimeMode === "bff",
  }).catch(() => mockClientDocumentsPayload());

  trackTelemetryEvent({ name: "client.documents.loaded", surface: "client.documents", metadata: { total: payload.documents.length, mode: MOBILE_ENV.runtimeMode } });
  return payload.documents;
}
