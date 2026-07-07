import type { SemseClient } from "../client.js";

/** Milestones de un job para satélites (scope milestones:read). SAT-003. */
export class MilestonesResource {
  constructor(private readonly client: SemseClient) {}

  async listByJob<T = unknown>(jobId: string): Promise<T> {
    return this.client.get<T>(`/v1/jobs/${jobId}/milestones`);
  }
}
