import { useEffect, useState } from "react";
import { listWorkerDisputes } from "@/domains/worker/disputes/repository";
import type { Dispute } from "@/types";

export function useWorkerDisputes(): { disputes: Dispute[]; loading: boolean } {
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load(): Promise<void> {
      const nextDisputes = await listWorkerDisputes();
      if (cancelled) {
        return;
      }
      setDisputes(nextDisputes);
      setLoading(false);
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, []);

  return { disputes, loading };
}
