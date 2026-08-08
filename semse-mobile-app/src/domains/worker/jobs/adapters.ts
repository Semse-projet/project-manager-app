import type { Job } from "@/types";
import type { WorkerJob } from "@/domains/worker/jobs/types";

export function toWorkerJob(job: Job): WorkerJob {
  return {
    id: job.id,
    title: job.title,
    client: job.client,
    location: job.location,
    status: job.status,
    date: job.date,
    time: job.time,
    description: job.description,
    progress: job.progress,
    supervisor: job.supervisor,
    tasks: job.tasks.map((task) => ({
      id: task.id,
      title: task.title,
      status: task.status,
      priority: task.priority,
      completed: task.completed,
    })),
    materials: job.materials.map((material) => ({
      id: material.id,
      name: material.name,
      category: material.category,
      quantity: material.quantity,
      unit: material.unit,
      status: material.status,
    })),
    evidences: job.evidences.map((evidence) => ({
      id: evidence.id,
      type: evidence.type,
      url: evidence.url,
      description: evidence.description,
      date: evidence.date,
      location: evidence.location,
    })),
  };
}
