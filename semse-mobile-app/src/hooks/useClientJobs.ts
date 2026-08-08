import { useEffect, useState } from "react";
import { getClientJobsSnapshot } from "@/domains/client/jobs/repository";
import type { ClientActivity, ClientJob, ClientProfileSnapshot } from "@/domains/client/jobs/types";

type ClientJobsState = {
  jobs: ClientJob[];
  recentActivities: ClientActivity[];
  profile: ClientProfileSnapshot | null;
  loading: boolean;
};

export function useClientJobs(): ClientJobsState {
  const [state, setState] = useState<ClientJobsState>({
    jobs: [],
    recentActivities: [],
    profile: null,
    loading: true,
  });

  useEffect(() => {
    let cancelled = false;

    async function load(): Promise<void> {
      const snapshot = await getClientJobsSnapshot();
      if (cancelled) {
        return;
      }
      setState({
        jobs: snapshot.jobs,
        recentActivities: snapshot.recentActivities,
        profile: snapshot.profile,
        loading: false,
      });
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
