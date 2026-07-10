import { BadRequestException, Injectable, Logger } from "@nestjs/common";
import { WorkerApplicationRepository, type WorkerApplicationRecord } from "./worker-application.repository.js";
import { SseEventBusService } from "../../infrastructure/sse/sse-event-bus.service.js";

const OPEN_STATUSES = ["submitted", "reviewing"];
const REVIEW_STATUSES = ["reviewing", "approved", "rejected"];
const MAX_APPLICATIONS_PER_SESSION_PER_DAY = 3;

export type SubmitApplicationInput = {
  tenantId: string;
  fullName: string;
  email: string;
  phone?: string;
  city?: string;
  trade: string;
  yearsExperience?: number;
  message?: string;
  proposedRate?: number;
  jobId?: string;
  sessionToken?: string;
  sourceChannel?: string;
};

@Injectable()
export class WorkerApplicationService {
  private readonly logger = new Logger(WorkerApplicationService.name);

  constructor(
    private readonly repository: WorkerApplicationRepository,
    private readonly sseBus?: SseEventBusService,
  ) {}

  async submitApplication(input: SubmitApplicationInput): Promise<WorkerApplicationRecord> {
    const email = input.email.trim().toLowerCase();

    const openForEmail = await this.repository.countOpenByEmail(input.tenantId, email);
    if (openForEmail > 0) {
      throw new BadRequestException(
        "Ya existe una aplicación en revisión con este correo. Te contactaremos pronto.",
      );
    }

    if (input.sessionToken) {
      const since = new Date(Date.now() - 24 * 3600 * 1000);
      const recent = await this.repository.countRecentBySession(input.tenantId, input.sessionToken, since);
      if (recent >= MAX_APPLICATIONS_PER_SESSION_PER_DAY) {
        throw new BadRequestException("Has alcanzado el límite de aplicaciones por hoy. Intenta mañana.");
      }
    }

    const record = await this.repository.createApplication({
      ...input,
      email,
      fullName: input.fullName.trim(),
      trade: input.trade.trim(),
    });

    this.logger.log(`Worker application received: ${record.id} (${record.trade}, tenant ${record.tenantId})`);
    this.sseBus?.emit("worker-application", "submitted", {
      applicationId: record.id,
      tenantId: record.tenantId,
      trade: record.trade,
      jobId: record.jobId,
      timestamp: new Date().toISOString(),
    });

    return record;
  }

  async listApplications(params: { tenantId: string; status?: string; limit?: number; offset?: number }) {
    if (params.status && ![...OPEN_STATUSES, ...REVIEW_STATUSES].includes(params.status)) {
      throw new BadRequestException(`Invalid status filter '${params.status}'`);
    }
    return this.repository.listApplications(params);
  }

  async getStats(tenantId: string) {
    const byStatus = await this.repository.countByStatus(tenantId);
    const total = Object.values(byStatus).reduce((sum, count) => sum + count, 0);
    return {
      tenantId,
      total,
      submitted: byStatus["submitted"] ?? 0,
      reviewing: byStatus["reviewing"] ?? 0,
      approved: byStatus["approved"] ?? 0,
      rejected: byStatus["rejected"] ?? 0,
    };
  }

  async reviewApplication(params: {
    id: string;
    tenantId: string;
    reviewedBy: string;
    status: string;
    reviewNotes?: string;
    createdUserId?: string;
  }): Promise<WorkerApplicationRecord> {
    if (!REVIEW_STATUSES.includes(params.status)) {
      throw new BadRequestException(`Invalid review status '${params.status}'. Use: ${REVIEW_STATUSES.join(", ")}`);
    }

    const existing = await this.repository.getApplication(params.id, params.tenantId);
    if (existing.status === "approved" || existing.status === "rejected") {
      throw new BadRequestException(`Application already resolved as '${existing.status}'.`);
    }

    const record = await this.repository.updateApplication(params.id, params.tenantId, {
      status: params.status,
      reviewNotes: params.reviewNotes,
      reviewedBy: params.reviewedBy,
      reviewedAt: new Date(),
      createdUserId: params.createdUserId,
    });

    this.sseBus?.emit("worker-application", params.status, {
      applicationId: record.id,
      tenantId: record.tenantId,
      reviewedBy: params.reviewedBy,
      timestamp: new Date().toISOString(),
    });

    return record;
  }
}
