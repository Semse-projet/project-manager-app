import { useEffect, useState } from "react";
import { getWorkerJobById } from "@/domains/worker/jobs/repository";
import type { WorkerJob } from "@/domains/worker/jobs/types";

export function useWorkerJobDetail(jobId?: string): { job: WorkerJob | null; loading: boolean } {
  const [job, setJob] = useState<WorkerJob | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load(): Promise<void> {
      if (!jobId) {
        setJob(null);
        setLoading(false);
        return;
      }

      const nextJob = await getWorkerJobById(jobId);
      if (cancelled) {
        return;
      }
      setJob(nextJob);
      setLoading(false);
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [jobId]);

  return { job, loading };
}
