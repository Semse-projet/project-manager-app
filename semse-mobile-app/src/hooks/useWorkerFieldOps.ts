import { useEffect, useState } from "react";
import { getWorkerFieldOpsSnapshot } from "@/domains/worker/field-ops/repository";
import type { WorkerChecklist, WorkerFieldUnit } from "@/domains/worker/field-ops/types";

type WorkerFieldOpsState = {
  units: WorkerFieldUnit[];
  checklists: WorkerChecklist[];
  loading: boolean;
};

export function useWorkerFieldOps(): WorkerFieldOpsState {
  const [state, setState] = useState<WorkerFieldOpsState>({
    units: [],
    checklists: [],
    loading: true,
  });

  useEffect(() => {
    let cancelled = false;

    async function load(): Promise<void> {
      const snapshot = await getWorkerFieldOpsSnapshot();
      if (cancelled) {
        return;
      }
      setState({
        units: snapshot.units,
        checklists: snapshot.checklists,
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
