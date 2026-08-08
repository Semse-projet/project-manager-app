import { useEffect, useState } from "react";
import { getClientProfileSnapshot } from "@/domains/client/profile/repository";
import type { ClientProfileSnapshot } from "@/domains/client/jobs/types";

type ClientProfileState = {
  profile: ClientProfileSnapshot | null;
  activeProjects: number;
  completedProjects: number;
  loading: boolean;
};

export function useClientProfile(): ClientProfileState {
  const [state, setState] = useState<ClientProfileState>({
    profile: null,
    activeProjects: 0,
    completedProjects: 0,
    loading: true,
  });

  useEffect(() => {
    let cancelled = false;

    async function load(): Promise<void> {
      const snapshot = await getClientProfileSnapshot();
      if (cancelled) {
        return;
      }
      setState({
        profile: snapshot.profile,
        activeProjects: snapshot.activeProjects,
        completedProjects: snapshot.completedProjects,
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
