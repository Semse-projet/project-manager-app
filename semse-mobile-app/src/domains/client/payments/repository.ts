import { escrowPayments } from "@/data/clientMockData";
import { mobileFetchContract, SEMSE_CONTRACTS } from "@/lib/api/contracts";
import { MOBILE_ENV } from "@/lib/config/env";
import { mapPaymentRecordToClientEscrowPayment } from "@/lib/api/mappers";
import { trackTelemetryEvent } from "@/lib/observability/telemetry";
import { getClientJobsSnapshot } from "@/domains/client/jobs/repository";
import type { ClientEscrowPayment } from "@/domains/client/payments/types";

type ClientPaymentsPayload = {
  payments: ClientEscrowPayment[];
};

function mockClientPaymentsPayload(): ClientPaymentsPayload {
  return {
    payments: escrowPayments,
  };
}

export async function listClientEscrowPayments(): Promise<ClientEscrowPayment[]> {
  if (MOBILE_ENV.runtimeMode === "mock") {
    const payload = mockClientPaymentsPayload();
    trackTelemetryEvent({ name: "client.payments.mock_loaded", surface: "client.payments", metadata: { total: payload.payments.length } });
    return payload.payments;
  }

  const payload = await getClientJobsSnapshot()
    .then(async (snapshot) => {
      const activeJob = snapshot.jobs.find((job) => job.status === "active") ?? snapshot.jobs[0];
      if (!activeJob) {
        return { payments: [] };
      }

      const records = await mobileFetchContract<Record<string, unknown>[]>(
        SEMSE_CONTRACTS.jobs.payments(activeJob.id),
      );

      return {
        payments: records.map((record) => mapPaymentRecordToClientEscrowPayment(record, activeJob.title)),
      };
    })
    .catch(() => {
      if (MOBILE_ENV.allowMockFallback) {
        return mockClientPaymentsPayload();
      }
      throw new Error("client.payments contract fetch failed");
    });

  trackTelemetryEvent({ name: "client.payments.loaded", surface: "client.payments", metadata: { total: payload.payments.length, mode: MOBILE_ENV.runtimeMode } });
  return payload.payments;
}
