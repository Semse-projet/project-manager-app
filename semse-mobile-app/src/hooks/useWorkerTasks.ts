import { useEffect, useState } from "react";
import { listWorkerJobs } from "@/domains/worker/jobs/repository";
import type { WorkerTask } from "@/domains/worker/jobs/types";

export function useWorkerTasks(): {
  tasks: WorkerTask[];
  loading: boolean;
  toggleTask: (taskId: string) => void;
} {
  const [tasks, setTasks] = useState<WorkerTask[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load(): Promise<void> {
      const jobs = await listWorkerJobs();
      if (cancelled) {
        return;
      }
      setTasks(jobs[0]?.tasks ?? []);
      setLoading(false);
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, []);

  const toggleTask = (taskId: string) => {
    setTasks((previousTasks) =>
      previousTasks.map((task) => (
        task.id === taskId
          ? { ...task, completed: !task.completed, status: !task.completed ? "completed" : "pending" }
          : task
      ))
    );
  };

  return { tasks, loading, toggleTask };
}
