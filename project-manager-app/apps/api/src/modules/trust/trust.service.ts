import { Injectable } from "@nestjs/common";
import { TrustRepository, type TrustSnapshot } from "./trust.repository.js";

@Injectable()
export class TrustService {
  constructor(private readonly trustRepository: TrustRepository) {}

  async byJob(input: {
    tenantId: string;
    orgId: string;
    userId: string;
    roles: string[];
    jobId: string;
  }): Promise<TrustSnapshot> {
    return this.trustRepository.byJob(input);
  }

  async byProject(input: {
    tenantId: string;
    orgId: string;
    userId: string;
    roles: string[];
    projectId: string;
  }): Promise<TrustSnapshot> {
    return this.trustRepository.byProject(input);
  }
}
