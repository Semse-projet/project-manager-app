import { useEffect, useState } from "react";
import { getActiveClientProject } from "@/domains/client/projects/repository";
import type { ClientProject } from "@/domains/client/projects/types";

export function useClientProject(): { project: ClientProject | null; loading: boolean } {
  const [project, setProject] = useState<ClientProject | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load(): Promise<void> {
      const nextProject = await getActiveClientProject();
      if (cancelled) {
        return;
      }
      setProject(nextProject);
      setLoading(false);
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, []);

  return { project, loading };
}
