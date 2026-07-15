import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import prismaClientPackage from "../../../../../node_modules/.prisma/client/index.js";
import {
  evidenceUploadedV1EventSchema,
  type EvidenceUploadedV1Event,
} from "@semse/schemas";
import { randomUUID } from "node:crypto";
import { MetricsService } from "../../infrastructure/observability/metrics.service.js";
import { PrismaService } from "../../infrastructure/prisma/prisma.service.js";

const { Prisma: PrismaRuntime } = prismaClientPackage as typeof import("../../../../../node_modules/.prisma/client/index.js");

export const EVIDENCE_READINESS_CONSUMER = "evidence-readiness.v1";
export const EVIDENCE_UPLOADED_EVENT_TYPE = "evidence.uploaded.v1";
const CONSUMER_MAX_ATTEMPTS = 5;

type ConsumerEnvironment = Record<string, string | undefined>;
type EvidenceReadiness = "missing" | "partial" | "complete";

type ConsumptionReceipt = {
  id: string;
  eventId: string;
  tenantId: string;
  consumerName: string;
  status: "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED" | "DEAD_LETTER";
  attempts: number;
  maxAttempts: number;
  resultJson: unknown;
};

type ConsumerResult = {
  eventId: string;
  consumer: typeof EVIDENCE_READINESS_CONSUMER;
  status: "completed";
  effect: "updated" | "no_op";
  milestoneId: string | null;
  evidenceReadiness: EvidenceReadiness | null;
  duplicate?: boolean;
};

type ProcessingIdentity = {
  workerId?: string;
  serviceActorId?: string;
};

class TerminalConsumerError extends Error {}
class AlreadyDeadLetteredError extends Error {}

export function isDomainEventConsumersEnabled(
  environment: ConsumerEnvironment = process.env,
): boolean {
  return environment.SEMSE_EVENT_CONSUMERS_ENABLED === "true";
}

export function parseEventConsumerAllowlist(value: string | undefined): Set<string> {
  return new Set(
    (value ?? "")
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean),
  );
}

export function calculateEvidenceReadiness(
  requiredEvidenceTypes: readonly string[],
  presentEvidenceTypes: readonly string[],
): EvidenceReadiness {
  const required = new Set(
    requiredEvidenceTypes.map((entry) => entry.trim().toUpperCase()).filter(Boolean),
  );
  if (required.size === 0) {
    return "complete";
  }

  const present = new Set(
    presentEvidenceTypes.map((entry) => entry.trim().toUpperCase()).filter(Boolean),
  );
  const presentRequiredCount = [...required].filter((entry) => present.has(entry)).length;
  if (presentRequiredCount === 0) {
    return "missing";
  }
  return presentRequiredCount === required.size ? "complete" : "partial";
}

function redactConsumerError(error: unknown): string {
  return (error instanceof Error ? error.message : String(error))
    .replace(/\b(rediss?|https?):\/\/[^@/\s]+@/gi, "$1://***@")
    .replace(/\b(password|token|secret|api[_-]?key)=([^\s&]+)/gi, "$1=***")
    .slice(0, 500);
}

@Injectable()
export class DomainEventConsumerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly metrics: MetricsService,
  ) {}

  async process(
    eventId: string,
    processingIdentity: ProcessingIdentity = {},
  ): Promise<ConsumerResult> {
    this.assertEnabledAndAllowlisted();

    const storedEvent = await this.prisma.domainOutboxEvent.findUnique({
      where: { eventId },
    });
    if (!storedEvent) {
      throw new NotFoundException({ message: "Domain event not found", eventId });
    }

    const typeAllowlist = parseEventConsumerAllowlist(
      process.env.SEMSE_EVENT_TYPE_ALLOWLIST,
    );
    if (!typeAllowlist.has(storedEvent.eventType)) {
      throw new ServiceUnavailableException({
        message: "Domain event type is not enabled for consumption",
        eventId,
        eventType: storedEvent.eventType,
      });
    }

    if (storedEvent.eventType !== EVIDENCE_UPLOADED_EVENT_TYPE) {
      return this.rejectTerminal(
        storedEvent.eventId,
        storedEvent.tenantId,
        `Unsupported domain event type: ${storedEvent.eventType}`,
      );
    }

    const parsedEvent = evidenceUploadedV1EventSchema.safeParse({
      eventId: storedEvent.eventId,
      eventType: storedEvent.eventType,
      version: storedEvent.version,
      envelopeVersion: storedEvent.envelopeVersion,
      occurredAt: storedEvent.occurredAt.toISOString(),
      recordedAt: storedEvent.recordedAt.toISOString(),
      tenantId: storedEvent.tenantId,
      orgId: storedEvent.orgId,
      module: storedEvent.module,
      entityType: storedEvent.entityType,
      entityId: storedEvent.entityId,
      actor: { type: storedEvent.actorType, id: storedEvent.actorId },
      correlationId: storedEvent.correlationId,
      ...(storedEvent.causationId
        ? { causationId: storedEvent.causationId }
        : {}),
      idempotencyKey: storedEvent.idempotencyKey,
      schemaRef: storedEvent.schemaRef,
      payload: storedEvent.payloadJson,
      ...(storedEvent.metadataJson
        ? { metadata: storedEvent.metadataJson }
        : {}),
      ...(storedEvent.traceContextJson
        ? { traceContext: storedEvent.traceContextJson }
        : {}),
    });
    if (!parsedEvent.success) {
      return this.rejectTerminal(
        storedEvent.eventId,
        storedEvent.tenantId,
        `Invalid canonical event: ${parsedEvent.error.issues[0]?.message ?? "schema validation failed"}`,
      );
    }

    try {
      const result = await this.consumeEvidenceReadiness(
        parsedEvent.data,
        processingIdentity,
      );
      if (result.duplicate) {
        this.metrics.recordEventConsumerDuplicate(EVIDENCE_READINESS_CONSUMER);
      } else {
        this.metrics.recordEventConsumerAttempt(
          EVIDENCE_READINESS_CONSUMER,
          "completed",
        );
      }
      return result;
    } catch (error) {
      if (error instanceof AlreadyDeadLetteredError) {
        throw new UnprocessableEntityException({
          message: error.message,
          eventId,
          consumer: EVIDENCE_READINESS_CONSUMER,
        });
      }

      const terminal = error instanceof TerminalConsumerError;
      const failure = await this.recordFailure({
        eventId,
        tenantId: parsedEvent.data.tenantId,
        error: redactConsumerError(error),
        terminal,
      });
      this.metrics.recordEventConsumerAttempt(EVIDENCE_READINESS_CONSUMER, "failed");
      if (failure.status === "DEAD_LETTER") {
        this.metrics.recordEventConsumerDeadLetter(EVIDENCE_READINESS_CONSUMER);
        throw new UnprocessableEntityException({
          message: "Domain event consumer moved delivery to dead letter",
          eventId,
          consumer: EVIDENCE_READINESS_CONSUMER,
          attempts: failure.attempts,
        });
      }

      throw new InternalServerErrorException({
        message: "Domain event consumer failed; retry is allowed",
        eventId,
        consumer: EVIDENCE_READINESS_CONSUMER,
        attempts: failure.attempts,
      });
    }
  }

  private assertEnabledAndAllowlisted(): void {
    if (!isDomainEventConsumersEnabled()) {
      throw new ServiceUnavailableException({
        message: "Domain event consumers are disabled by kill switch",
      });
    }
    const consumers = parseEventConsumerAllowlist(
      process.env.SEMSE_EVENT_CONSUMER_ALLOWLIST,
    );
    if (!consumers.has(EVIDENCE_READINESS_CONSUMER)) {
      throw new ServiceUnavailableException({
        message: "Evidence readiness consumer is not allowlisted",
        consumer: EVIDENCE_READINESS_CONSUMER,
      });
    }
  }

  private async rejectTerminal(
    eventId: string,
    tenantId: string,
    error: string,
  ): Promise<never> {
    const failure = await this.recordFailure({
      eventId,
      tenantId,
      error,
      terminal: true,
    });
    this.metrics.recordEventConsumerAttempt(EVIDENCE_READINESS_CONSUMER, "failed");
    this.metrics.recordEventConsumerDeadLetter(EVIDENCE_READINESS_CONSUMER);
    throw new UnprocessableEntityException({
      message: "Domain event rejected by canonical consumer contract",
      eventId,
      consumer: EVIDENCE_READINESS_CONSUMER,
      attempts: failure.attempts,
    });
  }

  private async consumeEvidenceReadiness(
    event: EvidenceUploadedV1Event,
    processingIdentity: ProcessingIdentity,
  ): Promise<ConsumerResult> {
    return this.prisma.$transaction(async (tx) => {
      const now = new Date();
      await tx.$executeRaw(
        PrismaRuntime.sql`
          INSERT INTO "DomainEventConsumption" (
            "id", "eventId", "tenantId", "consumerName", "status",
            "attempts", "maxAttempts", "nextAttemptAt", "createdAt", "updatedAt"
          ) VALUES (
            ${randomUUID()}, ${event.eventId}::uuid, ${event.tenantId},
            ${EVIDENCE_READINESS_CONSUMER}, 'PENDING'::"DomainConsumptionStatus",
            0, ${CONSUMER_MAX_ATTEMPTS}, ${now}, ${now}, ${now}
          )
          ON CONFLICT ("eventId", "consumerName") DO NOTHING
        `,
      );

      const receipts = await tx.$queryRaw<ConsumptionReceipt[]>(
        PrismaRuntime.sql`
          SELECT
            "id", "eventId", "tenantId", "consumerName", "status",
            "attempts", "maxAttempts", "resultJson"
          FROM "DomainEventConsumption"
          WHERE "eventId" = ${event.eventId}::uuid
            AND "consumerName" = ${EVIDENCE_READINESS_CONSUMER}
          FOR UPDATE
        `,
      );
      const receipt = receipts[0];
      if (!receipt) {
        throw new Error("Consumer receipt was not created");
      }
      if (receipt.status === "COMPLETED") {
        return {
          ...(receipt.resultJson as ConsumerResult),
          duplicate: true,
        };
      }
      if (receipt.status === "DEAD_LETTER") {
        throw new AlreadyDeadLetteredError(
          "Domain event consumer delivery is already in dead letter",
        );
      }

      const attempt = receipt.attempts + 1;
      await tx.domainEventConsumption.update({
        where: { id: receipt.id },
        data: {
          status: "PROCESSING",
          attempts: attempt,
          startedAt: now,
          completedAt: null,
          lastError: null,
        },
      });

      let result: ConsumerResult;
      if (!event.payload.milestoneId) {
        const eventEvidence = await tx.evidence.findFirst({
          where: {
            id: event.payload.evidenceId,
            projectId: event.payload.projectId,
            milestoneId: null,
            project: { tenantId: event.tenantId },
          },
          select: { id: true },
        });
        if (!eventEvidence) {
          throw new TerminalConsumerError(
            "Event evidence without milestone does not exist in the event tenant",
          );
        }
        result = {
          eventId: event.eventId,
          consumer: EVIDENCE_READINESS_CONSUMER,
          status: "completed",
          effect: "no_op",
          milestoneId: null,
          evidenceReadiness: null,
        };
        await tx.auditLog.create({
          data: {
            tenantId: event.tenantId,
            entityType: "Evidence",
            entityId: event.payload.evidenceId,
            action: "domain_event.consumer.evidence_readiness.no_op",
            afterJson: {
              eventId: event.eventId,
              correlationId: event.correlationId,
              causationId: event.causationId ?? null,
              consumer: EVIDENCE_READINESS_CONSUMER,
              reason: "evidence_has_no_milestone",
              workerId: processingIdentity.workerId ?? null,
              serviceActorId: processingIdentity.serviceActorId ?? null,
            },
          },
        });
      } else {
        const milestone = await tx.milestone.findFirst({
          where: {
            id: event.payload.milestoneId,
            deletedAt: null,
            project: { tenantId: event.tenantId },
          },
          select: {
            id: true,
            projectId: true,
            evidenceReadiness: true,
            requiredEvidenceTypes: true,
            status: true,
            paymentReadiness: true,
          },
        });
        if (!milestone || milestone.projectId !== event.payload.projectId) {
          throw new TerminalConsumerError(
            "Event milestone does not exist in the event tenant",
          );
        }

        const eventEvidence = await tx.evidence.findFirst({
          where: {
            id: event.payload.evidenceId,
            projectId: event.payload.projectId,
            milestoneId: milestone.id,
            project: { tenantId: event.tenantId },
          },
          select: { id: true },
        });
        if (!eventEvidence) {
          throw new TerminalConsumerError(
            "Event evidence does not belong to the referenced milestone",
          );
        }

        const evidence = await tx.evidence.findMany({
          where: {
            milestoneId: milestone.id,
            project: { tenantId: event.tenantId },
          },
          select: { kind: true },
        });
        const readiness = calculateEvidenceReadiness(
          milestone.requiredEvidenceTypes,
          evidence.map((item) => item.kind),
        );

        await tx.milestone.update({
          where: { id: milestone.id },
          data: { evidenceReadiness: readiness },
        });
        result = {
          eventId: event.eventId,
          consumer: EVIDENCE_READINESS_CONSUMER,
          status: "completed",
          effect: "updated",
          milestoneId: milestone.id,
          evidenceReadiness: readiness,
        };
        await tx.auditLog.create({
          data: {
            tenantId: event.tenantId,
            entityType: "Milestone",
            entityId: milestone.id,
            action: "domain_event.consumer.evidence_readiness.updated",
            beforeJson: {
              evidenceReadiness: milestone.evidenceReadiness,
              milestoneStatus: milestone.status,
              paymentReadiness: milestone.paymentReadiness,
            },
            afterJson: {
              evidenceReadiness: readiness,
              milestoneStatus: milestone.status,
              paymentReadiness: milestone.paymentReadiness,
              eventId: event.eventId,
              correlationId: event.correlationId,
              causationId: event.causationId ?? null,
              consumer: EVIDENCE_READINESS_CONSUMER,
              workerId: processingIdentity.workerId ?? null,
              serviceActorId: processingIdentity.serviceActorId ?? null,
            },
          },
        });
      }

      await tx.domainEventConsumption.update({
        where: { id: receipt.id },
        data: {
          status: "COMPLETED",
          completedAt: new Date(),
          nextAttemptAt: now,
          lastError: null,
          resultJson: result as Prisma.InputJsonValue,
        },
      });
      return result;
    });
  }

  private async recordFailure(input: {
    eventId: string;
    tenantId: string;
    error: string;
    terminal: boolean;
  }): Promise<{ status: "FAILED" | "DEAD_LETTER"; attempts: number }> {
    return this.prisma.$transaction(async (tx) => {
      const now = new Date();
      await tx.$executeRaw(
        PrismaRuntime.sql`
          INSERT INTO "DomainEventConsumption" (
            "id", "eventId", "tenantId", "consumerName", "status",
            "attempts", "maxAttempts", "nextAttemptAt", "createdAt", "updatedAt"
          ) VALUES (
            ${randomUUID()}, ${input.eventId}::uuid, ${input.tenantId},
            ${EVIDENCE_READINESS_CONSUMER}, 'PENDING'::"DomainConsumptionStatus",
            0, ${CONSUMER_MAX_ATTEMPTS}, ${now}, ${now}, ${now}
          )
          ON CONFLICT ("eventId", "consumerName") DO NOTHING
        `,
      );
      const receipts = await tx.$queryRaw<ConsumptionReceipt[]>(
        PrismaRuntime.sql`
          SELECT
            "id", "eventId", "tenantId", "consumerName", "status",
            "attempts", "maxAttempts", "resultJson"
          FROM "DomainEventConsumption"
          WHERE "eventId" = ${input.eventId}::uuid
            AND "consumerName" = ${EVIDENCE_READINESS_CONSUMER}
          FOR UPDATE
        `,
      );
      const receipt = receipts[0];
      if (!receipt) {
        throw new Error("Consumer failure receipt was not created");
      }
      if (receipt.status === "DEAD_LETTER") {
        return { status: "DEAD_LETTER", attempts: receipt.attempts };
      }
      if (receipt.status === "COMPLETED") {
        throw new AlreadyDeadLetteredError(
          "A completed consumer receipt cannot be replaced by a failure",
        );
      }

      const attempts = receipt.attempts + 1;
      const status = input.terminal || attempts >= receipt.maxAttempts
        ? "DEAD_LETTER"
        : "FAILED";
      const backoffMs = Math.min(
        5 * 60_000,
        1_000 * 2 ** Math.max(0, attempts - 1),
      );
      await tx.domainEventConsumption.update({
        where: { id: receipt.id },
        data: {
          status,
          attempts,
          completedAt: null,
          nextAttemptAt: new Date(now.getTime() + backoffMs),
          lastError: input.error,
          resultJson: PrismaRuntime.JsonNull,
        },
      });
      return { status, attempts };
    });
  }
}
