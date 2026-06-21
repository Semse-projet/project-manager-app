import { Injectable, Logger, Optional } from "@nestjs/common";
import { type BidRecord } from "../../common/domain-store.js";
import { AuditService } from "../../infrastructure/audit/audit.service.js";
import { PrismaService } from "../../infrastructure/prisma/prisma.service.js";
import { SseEventBusService } from "../../infrastructure/sse/sse-event-bus.service.js";
import { BidsRepository } from "./bids.repository.js";

@Injectable()
export class BidsService {
  private readonly logger = new Logger(BidsService.name);

  constructor(
    private readonly bidsRepository: BidsRepository,
    private readonly auditService: AuditService,
    @Optional() private readonly prisma?: PrismaService,
    @Optional() private readonly sse?: SseEventBusService,
  ) {}

  async list(input: {
    tenantId: string;
    jobId: string;
    orgId: string;
    userId: string;
  }): Promise<BidRecord[]> {
    return this.bidsRepository.listByJob(input);
  }

  async listMine(input: {
    tenantId: string;
    userId: string;
    orgId: string;
  }): Promise<BidRecord[]> {
    return this.bidsRepository.listByWorker(input);
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
    note?: string;
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

    // SSE: notify the job channel so client's proposals page auto-refreshes
    this.sse?.emit(`bids:${input.tenantId}`, "bid:submitted", {
      bidId:  bid.id,
      jobId:  input.jobId,
      proUserId: input.userId,
      ts:     Date.now(),
    });

    // Notify client org members about the new bid
    if (this.prisma) {
      void this.prisma.job.findUnique({
        where: { id: input.jobId },
        select: { title: true, clientOrgId: true },
      }).then(async (job) => {
        if (!job) return;
        const members = await this.prisma!.membership.findMany({
          where: { orgId: job.clientOrgId, role: { key: "CLIENT" } },
          select: { userId: true },
        });
        await Promise.all(members.map((m) =>
          this.prisma!.notification.create({
            data: {
              tenantId: input.tenantId,
              userId:   m.userId,
              type:     "bid_received",
              title:    "Nueva propuesta recibida",
              body:     `Un profesional envió una propuesta para "${job.title}". Revísala y decide.`,
              payload:  { jobId: input.jobId, bidId: bid.id } as object,
            },
          }).catch((err: Error) => this.logger.warn(`[BidsService] Client notify failed: ${err.message}`))
        ));
      }).catch((err: Error) => this.logger.warn(`[BidsService] Job lookup failed: ${err.message}`));
    }

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

    // SSE: notify the professional in real-time that their bid was accepted
    if (bid.professionalUserId) {
      this.sse?.emit(`notifications:${input.tenantId}:${bid.professionalUserId}`, "bid:accepted", {
        bidId:  bid.id,
        jobId:  (bid as Record<string, unknown>).jobId,
        ts:     Date.now(),
      });
    }

    // Notify the professional that their bid was accepted → job_assigned notification
    // Also notify rejected bidders (other workers who bid on same job)
    if (this.prisma && bid.professionalUserId) {
      const jobId = (bid as Record<string, unknown>).jobId as string | undefined;
      const jobTitle = (bid as Record<string, unknown>).jobTitle as string | undefined;

      await this.prisma.notification.create({
        data: {
          tenantId: input.tenantId,
          userId:   bid.professionalUserId,
          type:     "job_assigned",
          title:    "¡Tu propuesta fue aceptada!",
          body:     jobTitle ? `El trabajo "${jobTitle}" fue asignado a ti. Revisa los detalles y coordina el inicio.` : "Tu propuesta fue aceptada. Revisa los detalles del trabajo.",
          payload:  { jobId, bidId: bid.id } as object,
        },
      }).catch((err) => this.logger.warn(`[BidsService] Notification failed: ${(err as Error).message}`));

      if (jobId) {
        void this.prisma.bid.findMany({
          where: { jobId, status: "REJECTED", id: { not: bid.id } },
          select: { id: true, professionalUserId: true },
        }).then(async (rejected) => {
          await Promise.all(rejected.map((r) =>
            this.prisma!.notification.create({
              data: {
                tenantId: input.tenantId,
                userId:   r.professionalUserId,
                type:     "bid_rejected",
                title:    "Propuesta no seleccionada",
                body:     jobTitle ? `El cliente eligió otro profesional para "${jobTitle}". Sigue explorando oportunidades.` : "Tu propuesta no fue seleccionada esta vez.",
                payload:  { jobId, bidId: r.id } as object,
              },
            }).catch((err: Error) => this.logger.warn(`[BidsService] Reject notify failed: ${err.message}`))
          ));
        }).catch((err: Error) => this.logger.warn(`[BidsService] Rejected bids lookup failed: ${err.message}`));
      }
    }

    return bid;
  }
}
