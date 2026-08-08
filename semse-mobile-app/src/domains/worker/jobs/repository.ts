import { dashboardStats, jobs } from "@/data/mockData";
import { mobileFetchContract, SEMSE_CONTRACTS } from "@/lib/api/contracts";
import { MOBILE_ENV } from "@/lib/config/env";
import { mapJobRecordToWorkerJob } from "@/lib/api/mappers";
import { trackTelemetryEvent } from "@/lib/observability/telemetry";
import { toWorkerJob } from "@/domains/worker/jobs/adapters";
import type { WorkerJob, WorkerJobStats } from "@/domains/worker/jobs/types";

type WorkerJobsPayload = {
  jobs: WorkerJob[];
  stats: WorkerJobStats;
};

function mockWorkerJobsPayload(): WorkerJobsPayload {
  return {
    jobs: jobs.map(toWorkerJob),
    stats: dashboardStats,
  };
}

function buildWorkerJobStats(workerJobs: WorkerJob[]): WorkerJobStats {
  return {
    assignedJobs: workerJobs.length,
    pendingTasks: workerJobs.reduce((count, job) => count + job.tasks.filter((task) => !task.completed).length, 0),
    activeTrips: 0,
    monthlyEarnings: 0,
  };
}

export async function listWorkerJobs(): Promise<WorkerJob[]> {
  if (MOBILE_ENV.runtimeMode === "mock") {
    const payload = mockWorkerJobsPayload();
    trackTelemetryEvent({ name: "worker.jobs.mock_loaded", surface: "worker.jobs", metadata: { total: payload.jobs.length } });
    return payload.jobs;
  }

  const payload = await mobileFetchContract<Record<string, unknown>[]>(
    SEMSE_CONTRACTS.jobs.list,
  )
    .then((records) => ({ jobs: records.map(mapJobRecordToWorkerJob), stats: buildWorkerJobStats(records.map(mapJobRecordToWorkerJob)) }))
    .catch(() => {
      if (MOBILE_ENV.allowMockFallback) {
        return mockWorkerJobsPayload();
      }
      throw new Error("worker.jobs contract fetch failed");
    });

  trackTelemetryEvent({ name: "worker.jobs.loaded", surface: "worker.jobs", metadata: { total: payload.jobs.length, mode: MOBILE_ENV.runtimeMode } });
  return payload.jobs;
}

export async function getWorkerJobById(jobId: string): Promise<WorkerJob | null> {
  const workerJobs = await listWorkerJobs();
  return workerJobs.find((job) => job.id === jobId) ?? null;
}

export async function getWorkerJobStats(): Promise<WorkerJobStats> {
  if (MOBILE_ENV.runtimeMode === "mock") {
    return mockWorkerJobsPayload().stats;
  }

  const payload = await mobileFetchContract<Record<string, unknown>[]>(
    SEMSE_CONTRACTS.jobs.list,
  )
    .then((records) => ({ jobs: records.map(mapJobRecordToWorkerJob), stats: buildWorkerJobStats(records.map(mapJobRecordToWorkerJob)) }))
    .catch(() => {
      if (MOBILE_ENV.allowMockFallback) {
        return mockWorkerJobsPayload();
      }
      throw new Error("worker.jobs stats contract fetch failed");
    });

  return payload.stats;
}
