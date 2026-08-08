import { useEffect, useState } from "react";
import { listWorkerEvidence } from "@/domains/worker/evidence/repository";
import type { WorkerEvidence } from "@/domains/worker/evidence/types";

export function useWorkerEvidence(): { evidences: WorkerEvidence[]; loading: boolean } {
  const [evidences, setEvidences] = useState<WorkerEvidence[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load(): Promise<void> {
      const nextEvidence = await listWorkerEvidence();
      if (cancelled) {
        return;
      }
      setEvidences(nextEvidence);
      setLoading(false);
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, []);

  return { evidences, loading };
}
