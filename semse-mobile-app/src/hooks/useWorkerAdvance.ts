import { useEffect, useState } from "react";
import { getWorkerAdvance } from "@/domains/worker/advance/repository";
import type { WorkerAdvance } from "@/domains/worker/advance/types";

export function useWorkerAdvance(): { advance: WorkerAdvance | null; loading: boolean } {
  const [advance, setAdvance] = useState<WorkerAdvance | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load(): Promise<void> {
      const nextAdvance = await getWorkerAdvance();
      if (cancelled) {
        return;
      }
      setAdvance(nextAdvance);
      setLoading(false);
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, []);

  return { advance, loading };
}
