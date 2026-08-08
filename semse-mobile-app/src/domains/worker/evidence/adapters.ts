import type { Job } from "@/types";
import type { WorkerEvidence } from "@/domains/worker/evidence/types";

export function toWorkerEvidence(job: Job): WorkerEvidence[] {
  return job.evidences.map((evidence) => ({
    id: evidence.id,
    jobId: job.id,
    jobTitle: job.title,
    type: evidence.type,
    url: evidence.url,
    description: evidence.description,
    date: evidence.date,
    location: evidence.location,
  }));
}
