import { clientJobs, clientProfile, recentActivities } from "@/data/clientMockData";
import { mobileFetchContract, SEMSE_CONTRACTS } from "@/lib/api/contracts";
import { MOBILE_ENV } from "@/lib/config/env";
import { mapJobRecordToClientJob, mapUserRecordToClientProfile } from "@/lib/api/mappers";
import { trackTelemetryEvent } from "@/lib/observability/telemetry";
import type { ClientActivity, ClientJob, ClientProfileSnapshot } from "@/domains/client/jobs/types";

type ClientJobsPayload = {
  jobs: ClientJob[];
  recentActivities: ClientActivity[];
  profile: ClientProfileSnapshot;
};

function mockClientJobsPayload(): ClientJobsPayload {
  return {
    jobs: clientJobs,
    recentActivities,
    profile: clientProfile,
  };
}

export async function getClientJobsSnapshot(): Promise<ClientJobsPayload> {
  if (MOBILE_ENV.runtimeMode === "mock") {
    const payload = mockClientJobsPayload();
    trackTelemetryEvent({ name: "client.jobs.mock_loaded", surface: "client.jobs", metadata: { total: payload.jobs.length } });
    return payload;
  }

  const payload = await Promise.all([
    mobileFetchContract<Record<string, unknown>[]>(SEMSE_CONTRACTS.jobs.list),
    mobileFetchContract<Record<string, unknown>>(SEMSE_CONTRACTS.users.me).catch(() => null),
  ])
    .then(([jobRecords, userRecord]) => {
      const jobs = jobRecords.map(mapJobRecordToClientJob);
      return {
        jobs,
        recentActivities: jobs.slice(0, 3).map((job, index) => ({
          id: `job-activity-${job.id}`,
          title: index === 0 ? "Trabajo activo" : "Trabajo publicado",
          detail: job.title,
          time: job.date,
          icon: index === 0 ? "check" : "file",
        })),
        profile: userRecord ? mapUserRecordToClientProfile(userRecord) : clientProfile,
      };
    })
    .catch(() => {
      if (MOBILE_ENV.allowMockFallback) {
        return mockClientJobsPayload();
      }
      throw new Error("client.jobs contract fetch failed");
    });

  trackTelemetryEvent({ name: "client.jobs.loaded", surface: "client.jobs", metadata: { total: payload.jobs.length, mode: MOBILE_ENV.runtimeMode } });
  return payload;
}
