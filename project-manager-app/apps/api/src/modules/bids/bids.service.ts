import { Injectable, Logger, Optional } from "@nestjs/common";
import { type BidRecord } from "../../common/domain-store.js";
import { AuditService } from "../../infrastructure/audit/audit.service.js";
import { PrismaService } from "../../infrastructure/prisma/prisma.service.js";
import { BidsRepository } from "./bids.repository.js";

@Injectable()
export class BidsService {
  private readonly logger = new Logger(BidsService.name);

  constructor(
    private readonly bidsRepository: BidsRepository,
    private readonly auditService: AuditService,
    @Optional() private readonly prisma?: PrismaService,
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

    // Notify the professional that their bid was accepted → job_assigned notification
    if (this.prisma && bid.professionalUserId) {
      const jobTitle = (bid as Record<string, unknown>).jobTitle as string | undefined;
      await this.prisma.notification.create({
        data: {
          tenantId: input.tenantId,
          userId:   bid.professionalUserId,
          type:     "job_assigned",
          title:    "¡Tu propuesta fue aceptada!",
          body:     jobTitle ? `El trabajo "${jobTitle}" fue asignado a ti. Revisa los detalles y coordina el inicio.` : "Tu propuesta fue aceptada. Revisa los detalles del trabajo.",
          payload:  { jobId: (bid as Record<string, unknown>).jobId, bidId: bid.id } as object,
        },
      }).catch((err) => this.logger.warn(`[BidsService] Notification failed: ${(err as Error).message}`));
    }

    return bid;
  }
}
