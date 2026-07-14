import type { SemseClient } from "../client.js";

export type ListJobsQuery = {
  status?: string;
};

/**
 * Jobs para satélites que actúan en nombre de un usuario (scope jobs:read /
 * jobs:write). Primer consumidor: SAT-003 mobile app. Requiere sesión de
 * usuario como token principal + appToken (ver SemseClientOptions.appToken).
 */
export class JobsResource {
  constructor(private readonly client: SemseClient) {}

  async list<T = unknown>(query: ListJobsQuery = {}): Promise<T> {
    const params = new URLSearchParams();
    if (query.status) params.set("status", query.status);
    const qs = params.toString();
    return this.client.get<T>(`/v1/jobs${qs ? `?${qs}` : ""}`);
  }

  async get<T = unknown>(jobId: string): Promise<T> {
    return this.client.get<T>(`/v1/jobs/${jobId}`);
  }
}
