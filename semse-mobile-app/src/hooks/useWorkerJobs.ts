import { useEffect, useState } from "react";
import { getWorkerJobStats, listWorkerJobs } from "@/domains/worker/jobs/repository";
import type { WorkerJob, WorkerJobStats } from "@/domains/worker/jobs/types";

type WorkerJobsState = {
  jobs: WorkerJob[];
  stats: WorkerJobStats | null;
  loading: boolean;
};

export function useWorkerJobs(): WorkerJobsState {
  const [state, setState] = useState<WorkerJobsState>({
    jobs: [],
    stats: null,
    loading: true,
  });

  useEffect(() => {
    let cancelled = false;

    async function load(): Promise<void> {
      const [jobs, stats] = await Promise.all([listWorkerJobs(), getWorkerJobStats()]);
      if (cancelled) {
        return;
      }
      setState({ jobs, stats, loading: false });
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
