import { Injectable } from "@nestjs/common";
import { type BidRecord } from "../../common/domain-store.js";
import { AuditService } from "../../infrastructure/audit/audit.service.js";
import { BidsRepository } from "./bids.repository.js";

@Injectable()
export class BidsService {
  constructor(
    private readonly bidsRepository: BidsRepository,
    private readonly auditService: AuditService
  ) {}

  async list(input: {
    tenantId: string;
    jobId: string;
    orgId: string;
    userId: string;
  }): Promise<BidRecord[]> {
    return this.bidsRepository.listByJob(input);
  }

  async create(input: {
    tenantId: string;
    jobId: string;
    proOrgId: string;
    userId: string;
    orgId: string;
    roles: string[];
    amount: number;
    etaDays: number;
    requestId: string;
  }): Promise<BidRecord> {
    const bid = await this.bidsRepository.create(input);

    await this.auditService.append({
      id: `aud_${Date.now()}`,
      tenantId: input.tenantId,
      orgId: input.orgId,
      actorUserId: input.userId,
      action: "bid.create",
      entityType: "Bid",
      entityId: bid.id,
      requestId: input.requestId,
      timestamp: new Date().toISOString()
    });

    return bid;
  }

  async accept(input: {
    tenantId: string;
    bidId: string;
    userId: string;
    orgId: string;
    roles: string[];
    requestId: string;
  }): Promise<BidRecord> {
    const bid = await this.bidsRepository.accept(input);

    await this.auditService.append({
      id: `aud_${Date.now()}`,
      tenantId: input.tenantId,
      orgId: input.orgId,
      actorUserId: input.userId,
      action: "bid.accept",
      entityType: "Bid",
      entityId: bid.id,
      requestId: input.requestId,
      timestamp: new Date().toISOString()
    });

    return bid;
  }
}
