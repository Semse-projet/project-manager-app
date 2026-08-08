import { useEffect, useState } from "react";
import { listWorkerIncidents } from "@/domains/worker/incidents/repository";
import type { Incident } from "@/types";

export function useWorkerIncidents(): { incidents: Incident[]; loading: boolean } {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load(): Promise<void> {
      const nextIncidents = await listWorkerIncidents();
      if (cancelled) {
        return;
      }
      setIncidents(nextIncidents);
      setLoading(false);
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, []);

  return { incidents, loading };
}
