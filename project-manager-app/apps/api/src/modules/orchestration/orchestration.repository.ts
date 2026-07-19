import { Injectable, Logger } from "@nestjs/common";
import type {
  OrchestrationAgentResult,
  OrchestrationInterpretation,
  OrchestrationStatus,
  OrchestrationStep,
} from "@semse/schemas";
import { PrismaService } from "../../infrastructure/prisma/prisma.service.js";

export type OrchestrationRecord = {
  orchestrationId: string;
  tenantId: string;
  userId: string;
  status: OrchestrationStatus;
  currentStep: string;
  interpretation: OrchestrationInterpretation;
  agentsConsulted: OrchestrationAgentResult[];
  plan: { steps: OrchestrationStep[] };
  requiresApproval: boolean;
  errors: Array<{ message: string; agent?: string }>;
  createdAt: string;
};

export interface OrchestrationRepository {
  find(orchestrationId: string): Promise<OrchestrationRecord | null>;
  save(record: OrchestrationRecord): Promise<void>;
}

export const ORCHESTRATION_REPOSITORY = Symbol("ORCHESTRATION_REPOSITORY");

/** In-memory repository — used by unit tests and as a degradation fallback. */
export class InMemoryOrchestrationRepository implements OrchestrationRepository {
  private readonly records = new Map<string, OrchestrationRecord>();

  async find(orchestrationId: string): Promise<OrchestrationRecord | null> {
    return this.records.get(orchestrationId) ?? null;
  }

  async save(record: OrchestrationRecord): Promise<void> {
    this.records.set(record.orchestrationId, record);
  }
}

@Injectable()
export class PrismaOrchestrationRepository implements OrchestrationRepository {
  private readonly logger = new Logger(PrismaOrchestrationRepository.name);
  private readonly fallback = new InMemoryOrchestrationRepository();
  private degraded = false;

  constructor(private readonly prisma: PrismaService) {}

  async find(orchestrationId: string): Promise<OrchestrationRecord | null> {
    try {
      const row = await this.prisma.prometeoOrchestration.findUnique({
        where: { id: orchestrationId },
      });
      if (!row) {
        return null;
      }
      return {
        orchestrationId: row.id,
        tenantId: row.tenantId,
        userId: row.userId,
        status: row.status as OrchestrationStatus,
        currentStep: row.currentStep,
        interpretation: row.interpretation as unknown as OrchestrationInterpretation,
        agentsConsulted: row.agentsConsulted as unknown as OrchestrationAgentResult[],
        plan: row.plan as unknown as { steps: OrchestrationStep[] },
        requiresApproval: row.requiresApproval,
        errors: row.errors as unknown as Array<{ message: string; agent?: string }>,
        createdAt: row.createdAt.toISOString(),
      };
    } catch (error) {
      this.degrade(error);
      return this.fallback.find(orchestrationId);
    }
  }

  async save(record: OrchestrationRecord): Promise<void> {
    type Json = import("@prisma/client").Prisma.InputJsonValue;
    try {
      await this.prisma.prometeoOrchestration.create({
        data: {
          id: record.orchestrationId,
          tenantId: record.tenantId,
          userId: record.userId,
          status: record.status,
          currentStep: record.currentStep,
          interpretation: record.interpretation as unknown as Json,
          agentsConsulted: record.agentsConsulted as unknown as Json,
          plan: record.plan as unknown as Json,
          requiresApproval: record.requiresApproval,
          errors: record.errors as unknown as Json,
          createdAt: new Date(record.createdAt),
        },
      });
    } catch (error) {
      this.degrade(error);
      await this.fallback.save(record);
    }
  }

  private degrade(error: unknown): void {
    if (!this.degraded) {
      this.degraded = true;
      this.logger.warn(
        `Prometeo orchestration persistence degraded to in-memory: ${(error as Error)?.message ?? String(error)}`,
      );
    }
  }
}
