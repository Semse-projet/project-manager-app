import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from "@nestjs/common";
import type { DomainOutboxEvent, Prisma } from "@prisma/client";
import prismaClientPackage from "../../../../../node_modules/.prisma/client/index.js";
import {
  bidAcceptedV1EventSchema,
  bidCreatedV1EventSchema,
  bidRejectedV1EventSchema,
  evidenceUploadedV1EventSchema,
  type EvidenceUploadedV1Event,
  jobCreatedV1EventSchema,
  jobStatusChangedV1EventSchema,
  projectLifecycleSourceChangedV1EventSchema,
  type ProjectLifecycleSourceChangedV1Event,
} from "@semse/schemas";
import { randomUUID } from "node:crypto";
import { MetricsService } from "../../infrastructure/observability/metrics.service.js";
import { PrismaService } from "../../infrastructure/prisma/prisma.service.js";
import { JobsRepository } from "../jobs/jobs.repository.js";
import { ProjectsRepository } from "../projects/projects.repository.js";
import {
  calculateEvidenceReadiness,
  isDomainEventConsumersEnabled,
  parseEventConsumerAllowlist,
  redactConsumerError,
  type EvidenceReadiness,
} from "./domain-event-consumer.policy.js";

export {
  calculateEvidenceReadiness,
  isDomainEventConsumersEnabled,
  parseEventConsumerAllowlist,
} from "./domain-event-consumer.policy.js";

const { Prisma: PrismaRuntime } = prismaClientPackage as typeof import("../../../../../node_modules/.prisma/client/index.js");

export const EVIDENCE_READINESS_CONSUMER = "evidence-readiness.v1";
export const EVIDENCE_UPLOADED_EVENT_TYPE = "evidence.uploaded.v1";
export const PROJECT_LIFECYCLE_PROJECTION_CONSUMER =
  "project-lifecycle-projection.v1";
export const PROJECT_LIFECYCLE_SOURCE_CHANGED_EVENT_TYPE =
  "project.lifecycle-source-changed.v1";
export const JOBS_BIDS_PROJECTION_CONSUMER = "jobs-bids-projection.v1";
const JOBS_BIDS_PROJECTION_EVENT_TYPES = [
  "job.created.v1",
  "job.status_changed.v1",
  "bid.created.v1",
  "bid.accepted.v1",
  "bid.rejected.v1",
] as const;
const CONSUMER_MAX_ATTEMPTS = 5;

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
  consumer:
    | typeof EVIDENCE_READINESS_CONSUMER
    | typeof PROJECT_LIFECYCLE_PROJECTION_CONSUMER
    | typeof JOBS_BIDS_PROJECTION_CONSUMER
    | (string & {});
  status: "completed";
  effect: "updated" | "no_op" | "disabled";
  milestoneId?: string | null;
  evidenceReadiness?: EvidenceReadiness | null;
  projectId?: string;
  jobId?: string;
  revision?: string;
  sourceUpdatedAt?: string;
  duplicate?: boolean;
};

type ProcessingIdentity = {
  workerId?: string;
  serviceActorId?: string;
};

/**
 * `process()` dispatches purely on `storedEvent.eventType → descriptor`
 * (built once in the constructor via `buildHandlerRegistry()`). Adding a new
 * event type/consumer is a new entry in that registry, not a new branch in
 * `process()` — see `jobs-bids-event-projection.spec.md` §2 (F1-F) for the
 * domain this unblocked.
 */
type EventHandlerDescriptor = {
  eventType: string;
  consumerName: string;
  handle: (
    storedEvent: DomainOutboxEvent,
    processingIdentity: ProcessingIdentity,
  ) => Promise<ConsumerResult>;
};

class TerminalConsumerError extends Error {}
class AlreadyDeadLetteredError extends Error {}

@Injectable()
export class DomainEventConsumerService {
  private readonly handlersByEventType: ReadonlyMap<string, EventHandlerDescriptor>;

  constructor(
    private readonly prisma: PrismaService,
    private readonly metrics: MetricsService,
    private readonly projectsRepository?: ProjectsRepository,
    private readonly jobsRepository?: JobsRepository,
  ) {
    this.handlersByEventType = this.buildHandlerRegistry();
  }

  private buildHandlerRegistry(): ReadonlyMap<string, EventHandlerDescriptor> {
    const descriptors: EventHandlerDescriptor[] = [
      {
        eventType: EVIDENCE_UPLOADED_EVENT_TYPE,
        consumerName: EVIDENCE_READINESS_CONSUMER,
        handle: (storedEvent, processingIdentity) =>
          this.processEvidenceReadinessEvent(storedEvent, processingIdentity),
      },
      {
        eventType: PROJECT_LIFECYCLE_SOURCE_CHANGED_EVENT_TYPE,
        consumerName: PROJECT_LIFECYCLE_PROJECTION_CONSUMER,
        handle: (storedEvent, processingIdentity) =>
          this.processProjectLifecycleEvent(storedEvent, processingIdentity),
      },
      ...JOBS_BIDS_PROJECTION_EVENT_TYPES.map((eventType) => ({
        eventType,
        consumerName: JOBS_BIDS_PROJECTION_CONSUMER,
        handle: (storedEvent: DomainOutboxEvent, processingIdentity: ProcessingIdentity) =>
          this.processJobsBidsProjectionEvent(storedEvent, processingIdentity),
      })),
    ];

    return new Map(descriptors.map((descriptor) => [descriptor.eventType, descriptor]));
  }

  async process(
    eventId: string,
    processingIdentity: ProcessingIdentity = {},
  ): Promise<ConsumerResult> {
    this.assertConsumersEnabled();

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

    const descriptor = this.handlersByEventType.get(storedEvent.eventType);
    if (!descriptor) {
      throw new UnprocessableEntityException({
        message: "No consumer handler is registered for this domain event type",
        eventId,
        eventType: storedEvent.eventType,
      });
    }

    this.assertConsumerAllowlisted(descriptor.consumerName);
    return descriptor.handle(storedEvent, processingIdentity);
  }

  private assertConsumersEnabled(): void {
    if (!isDomainEventConsumersEnabled()) {
      throw new ServiceUnavailableException({
        message: "Domain event consumers are disabled by kill switch",
      });
    }
  }

  private assertConsumerAllowlisted(consumerName: string): void {
    const consumers = parseEventConsumerAllowlist(
      process.env.SEMSE_EVENT_CONSUMER_ALLOWLIST,
    );
    if (!consumers.has(consumerName)) {
      throw new ServiceUnavailableException({
        message: "Domain event consumer is not allowlisted",
        consumer: consumerName,
      });
    }
  }

  private async processEvidenceReadinessEvent(
    storedEvent: DomainOutboxEvent,
    processingIdentity: ProcessingIdentity,
  ): Promise<ConsumerResult> {
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
          eventId: storedEvent.eventId,
          consumer: EVIDENCE_READINESS_CONSUMER,
        });
      }

      const terminal = error instanceof TerminalConsumerError;
      const failure = await this.recordFailure({
        eventId: storedEvent.eventId,
        tenantId: parsedEvent.data.tenantId,
        error: redactConsumerError(error),
        terminal,
      });
      this.metrics.recordEventConsumerAttempt(EVIDENCE_READINESS_CONSUMER, "failed");
      if (failure.status === "DEAD_LETTER") {
        this.metrics.recordEventConsumerDeadLetter(EVIDENCE_READINESS_CONSUMER);
        throw new UnprocessableEntityException({
          message: "Domain event consumer moved delivery to dead letter",
          eventId: storedEvent.eventId,
          consumer: EVIDENCE_READINESS_CONSUMER,
          attempts: failure.attempts,
        });
      }

      throw new InternalServerErrorException({
        message: "Domain event consumer failed; retry is allowed",
        eventId: storedEvent.eventId,
        consumer: EVIDENCE_READINESS_CONSUMER,
        attempts: failure.attempts,
      });
    }
  }

  private async processProjectLifecycleEvent(
    storedEvent: DomainOutboxEvent,
    processingIdentity: ProcessingIdentity,
  ): Promise<ConsumerResult> {
    if (!this.projectsRepository) {
      throw new ServiceUnavailableException({
        message: "Project lifecycle projection consumer is unavailable",
        consumer: PROJECT_LIFECYCLE_PROJECTION_CONSUMER,
      });
    }

    const parsedEvent = projectLifecycleSourceChangedV1EventSchema.safeParse({
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
        `Invalid canonical lifecycle event: ${
          parsedEvent.error.issues[0]?.message ?? "schema validation failed"
        }`,
        PROJECT_LIFECYCLE_PROJECTION_CONSUMER,
      );
    }

    try {
      const result = await this.consumeProjectLifecycleProjection(
        parsedEvent.data,
        processingIdentity,
      );
      if (result.duplicate) {
        this.metrics.recordEventConsumerDuplicate(
          PROJECT_LIFECYCLE_PROJECTION_CONSUMER,
        );
      } else {
        this.metrics.recordEventConsumerAttempt(
          PROJECT_LIFECYCLE_PROJECTION_CONSUMER,
          "completed",
        );
      }
      return result;
    } catch (error) {
      if (error instanceof AlreadyDeadLetteredError) {
        throw new UnprocessableEntityException({
          message: error.message,
          eventId: storedEvent.eventId,
          consumer: PROJECT_LIFECYCLE_PROJECTION_CONSUMER,
        });
      }

      const terminal = error instanceof TerminalConsumerError;
      const failure = await this.recordFailure({
        eventId: storedEvent.eventId,
        tenantId: parsedEvent.data.tenantId,
        error: redactConsumerError(error),
        terminal,
        consumerName: PROJECT_LIFECYCLE_PROJECTION_CONSUMER,
      });
      this.metrics.recordEventConsumerAttempt(
        PROJECT_LIFECYCLE_PROJECTION_CONSUMER,
        "failed",
      );
      if (failure.status === "DEAD_LETTER") {
        this.metrics.recordEventConsumerDeadLetter(
          PROJECT_LIFECYCLE_PROJECTION_CONSUMER,
        );
        throw new UnprocessableEntityException({
          message: "Domain event consumer moved delivery to dead letter",
          eventId: storedEvent.eventId,
          consumer: PROJECT_LIFECYCLE_PROJECTION_CONSUMER,
          attempts: failure.attempts,
        });
      }

      throw new InternalServerErrorException({
        message: "Domain event consumer failed; retry is allowed",
        eventId: storedEvent.eventId,
        consumer: PROJECT_LIFECYCLE_PROJECTION_CONSUMER,
        attempts: failure.attempts,
      });
    }
  }

  private async consumeProjectLifecycleProjection(
    event: ProjectLifecycleSourceChangedV1Event,
    processingIdentity: ProcessingIdentity,
  ): Promise<ConsumerResult> {
    const existing = await this.prisma.domainEventConsumption.findUnique({
      where: {
        eventId_consumerName: {
          eventId: event.eventId,
          consumerName: PROJECT_LIFECYCLE_PROJECTION_CONSUMER,
        },
      },
      select: { status: true, resultJson: true },
    });
    if (existing?.status === "COMPLETED") {
      return {
        ...(existing.resultJson as ConsumerResult),
        duplicate: true,
      };
    }
    if (existing?.status === "DEAD_LETTER") {
      throw new AlreadyDeadLetteredError(
        "Domain event consumer delivery is already in dead letter",
      );
    }

    let rebuild: Awaited<
      ReturnType<ProjectsRepository["rebuildLifecycleProjection"]>
    >;
    try {
      rebuild = await this.projectsRepository!.rebuildLifecycleProjection({
        tenantId: event.tenantId,
        projectId: event.payload.projectId,
      });
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw new TerminalConsumerError(
          "Lifecycle event project does not exist in the event tenant",
        );
      }
      throw error;
    }

    return this.prisma.$transaction(async (tx) => {
      const now = new Date();
      await tx.$executeRaw(
        PrismaRuntime.sql`
          INSERT INTO "DomainEventConsumption" (
            "id", "eventId", "tenantId", "consumerName", "status",
            "attempts", "maxAttempts", "nextAttemptAt", "createdAt", "updatedAt"
          ) VALUES (
            ${randomUUID()}, ${event.eventId}::uuid, ${event.tenantId},
            ${PROJECT_LIFECYCLE_PROJECTION_CONSUMER}, 'PENDING'::"DomainConsumptionStatus",
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
            AND "consumerName" = ${PROJECT_LIFECYCLE_PROJECTION_CONSUMER}
          FOR UPDATE
        `,
      );
      const receipt = receipts[0];
      if (!receipt) {
        throw new Error("Lifecycle consumer receipt was not created");
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

      await tx.domainEventConsumption.update({
        where: { id: receipt.id },
        data: {
          status: "PROCESSING",
          attempts: receipt.attempts + 1,
          startedAt: now,
          completedAt: null,
          lastError: null,
        },
      });

      const result: ConsumerResult = {
        eventId: event.eventId,
        consumer: PROJECT_LIFECYCLE_PROJECTION_CONSUMER,
        status: "completed",
        effect: rebuild.effect,
        projectId: event.payload.projectId,
        revision: rebuild.revision,
        sourceUpdatedAt: rebuild.sourceUpdatedAt,
      };
      await tx.auditLog.create({
        data: {
          tenantId: event.tenantId,
          entityType: "ProjectLifecycleProjection",
          entityId: event.payload.projectId,
          action: `domain_event.consumer.project_lifecycle.${rebuild.effect}`,
          afterJson: {
            eventId: event.eventId,
            correlationId: event.correlationId,
            causationId: event.causationId ?? null,
            consumer: PROJECT_LIFECYCLE_PROJECTION_CONSUMER,
            sourceEventType: event.payload.sourceEventType,
            sourceEntityType: event.payload.sourceEntityType,
            sourceEntityId: event.payload.sourceEntityId,
            revision: rebuild.revision,
            sourceUpdatedAt: rebuild.sourceUpdatedAt,
            workerId: processingIdentity.workerId ?? null,
            serviceActorId: processingIdentity.serviceActorId ?? null,
          },
        },
      });

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

  private selectJobsBidsProjectionSchema(eventType: string) {
    switch (eventType) {
      case "job.created.v1":
        return jobCreatedV1EventSchema;
      case "job.status_changed.v1":
        return jobStatusChangedV1EventSchema;
      case "bid.created.v1":
        return bidCreatedV1EventSchema;
      case "bid.accepted.v1":
        return bidAcceptedV1EventSchema;
      case "bid.rejected.v1":
        return bidRejectedV1EventSchema;
      default:
        return null;
    }
  }

  private async processJobsBidsProjectionEvent(
    storedEvent: DomainOutboxEvent,
    processingIdentity: ProcessingIdentity,
  ): Promise<ConsumerResult> {
    if (!this.jobsRepository) {
      throw new ServiceUnavailableException({
        message: "Jobs & bids projection consumer is unavailable",
        consumer: JOBS_BIDS_PROJECTION_CONSUMER,
      });
    }

    const schema = this.selectJobsBidsProjectionSchema(storedEvent.eventType);
    if (!schema) {
      return this.rejectTerminal(
        storedEvent.eventId,
        storedEvent.tenantId,
        `Unsupported jobs/bids event type: ${storedEvent.eventType}`,
        JOBS_BIDS_PROJECTION_CONSUMER,
      );
    }

    const parsedEvent = schema.safeParse({
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
        `Invalid canonical jobs/bids event: ${parsedEvent.error.issues[0]?.message ?? "schema validation failed"}`,
        JOBS_BIDS_PROJECTION_CONSUMER,
      );
    }

    const payload = storedEvent.payloadJson as { jobId?: unknown };
    if (typeof payload.jobId !== "string" || payload.jobId.length === 0) {
      return this.rejectTerminal(
        storedEvent.eventId,
        storedEvent.tenantId,
        "jobs/bids event payload is missing jobId",
        JOBS_BIDS_PROJECTION_CONSUMER,
      );
    }

    try {
      const result = await this.consumeJobsBidsProjection(
        {
          eventId: storedEvent.eventId,
          tenantId: storedEvent.tenantId,
          correlationId: storedEvent.correlationId,
          causationId: storedEvent.causationId ?? undefined,
          jobId: payload.jobId,
        },
        processingIdentity,
      );
      if (result.duplicate) {
        this.metrics.recordEventConsumerDuplicate(JOBS_BIDS_PROJECTION_CONSUMER);
      } else {
        this.metrics.recordEventConsumerAttempt(
          JOBS_BIDS_PROJECTION_CONSUMER,
          "completed",
        );
      }
      return result;
    } catch (error) {
      if (error instanceof AlreadyDeadLetteredError) {
        throw new UnprocessableEntityException({
          message: error.message,
          eventId: storedEvent.eventId,
          consumer: JOBS_BIDS_PROJECTION_CONSUMER,
        });
      }

      const terminal = error instanceof TerminalConsumerError;
      const failure = await this.recordFailure({
        eventId: storedEvent.eventId,
        tenantId: storedEvent.tenantId,
        error: redactConsumerError(error),
        terminal,
        consumerName: JOBS_BIDS_PROJECTION_CONSUMER,
      });
      this.metrics.recordEventConsumerAttempt(JOBS_BIDS_PROJECTION_CONSUMER, "failed");
      if (failure.status === "DEAD_LETTER") {
        this.metrics.recordEventConsumerDeadLetter(JOBS_BIDS_PROJECTION_CONSUMER);
        throw new UnprocessableEntityException({
          message: "Domain event consumer moved delivery to dead letter",
          eventId: storedEvent.eventId,
          consumer: JOBS_BIDS_PROJECTION_CONSUMER,
          attempts: failure.attempts,
        });
      }

      throw new InternalServerErrorException({
        message: "Domain event consumer failed; retry is allowed",
        eventId: storedEvent.eventId,
        consumer: JOBS_BIDS_PROJECTION_CONSUMER,
        attempts: failure.attempts,
      });
    }
  }

  private async consumeJobsBidsProjection(
    event: {
      eventId: string;
      tenantId: string;
      correlationId: string;
      causationId?: string;
      jobId: string;
    },
    processingIdentity: ProcessingIdentity,
  ): Promise<ConsumerResult> {
    const existing = await this.prisma.domainEventConsumption.findUnique({
      where: {
        eventId_consumerName: {
          eventId: event.eventId,
          consumerName: JOBS_BIDS_PROJECTION_CONSUMER,
        },
      },
      select: { status: true, resultJson: true },
    });
    if (existing?.status === "COMPLETED") {
      return {
        ...(existing.resultJson as ConsumerResult),
        duplicate: true,
      };
    }
    if (existing?.status === "DEAD_LETTER") {
      throw new AlreadyDeadLetteredError(
        "Domain event consumer delivery is already in dead letter",
      );
    }

    let rebuild: Awaited<
      ReturnType<JobsRepository["rebuildJobsBidsProjection"]>
    >;
    try {
      rebuild = await this.jobsRepository!.rebuildJobsBidsProjection({
        tenantId: event.tenantId,
        jobId: event.jobId,
      });
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw new TerminalConsumerError(
          "Jobs/bids event job does not exist in the event tenant",
        );
      }
      throw error;
    }

    return this.prisma.$transaction(async (tx) => {
      const now = new Date();
      await tx.$executeRaw(
        PrismaRuntime.sql`
          INSERT INTO "DomainEventConsumption" (
            "id", "eventId", "tenantId", "consumerName", "status",
            "attempts", "maxAttempts", "nextAttemptAt", "createdAt", "updatedAt"
          ) VALUES (
            ${randomUUID()}, ${event.eventId}::uuid, ${event.tenantId},
            ${JOBS_BIDS_PROJECTION_CONSUMER}, 'PENDING'::"DomainConsumptionStatus",
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
            AND "consumerName" = ${JOBS_BIDS_PROJECTION_CONSUMER}
          FOR UPDATE
        `,
      );
      const receipt = receipts[0];
      if (!receipt) {
        throw new Error("Jobs/bids consumer receipt was not created");
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

      await tx.domainEventConsumption.update({
        where: { id: receipt.id },
        data: {
          status: "PROCESSING",
          attempts: receipt.attempts + 1,
          startedAt: now,
          completedAt: null,
          lastError: null,
        },
      });

      const result: ConsumerResult = {
        eventId: event.eventId,
        consumer: JOBS_BIDS_PROJECTION_CONSUMER,
        status: "completed",
        effect: rebuild.effect,
        jobId: event.jobId,
        revision: rebuild.revision,
        sourceUpdatedAt: rebuild.sourceUpdatedAt,
      };
      await tx.auditLog.create({
        data: {
          tenantId: event.tenantId,
          entityType: "JobsBidsProjection",
          entityId: event.jobId,
          action: `domain_event.consumer.jobs_bids_projection.${rebuild.effect}`,
          afterJson: {
            eventId: event.eventId,
            correlationId: event.correlationId,
            causationId: event.causationId ?? null,
            consumer: JOBS_BIDS_PROJECTION_CONSUMER,
            revision: rebuild.revision ?? null,
            sourceUpdatedAt: rebuild.sourceUpdatedAt ?? null,
            workerId: processingIdentity.workerId ?? null,
            serviceActorId: processingIdentity.serviceActorId ?? null,
          },
        },
      });

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

  private async rejectTerminal(
    eventId: string,
    tenantId: string,
    error: string,
    consumerName: string = EVIDENCE_READINESS_CONSUMER,
  ): Promise<never> {
    const failure = await this.recordFailure({
      eventId,
      tenantId,
      error,
      terminal: true,
      consumerName,
    });
    this.metrics.recordEventConsumerAttempt(consumerName, "failed");
    this.metrics.recordEventConsumerDeadLetter(consumerName);
    throw new UnprocessableEntityException({
      message: "Domain event rejected by canonical consumer contract",
      eventId,
      consumer: consumerName,
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
    consumerName?: string;
  }): Promise<{ status: "FAILED" | "DEAD_LETTER"; attempts: number }> {
    const consumerName = input.consumerName ?? EVIDENCE_READINESS_CONSUMER;
    return this.prisma.$transaction(async (tx) => {
      const now = new Date();
      await tx.$executeRaw(
        PrismaRuntime.sql`
          INSERT INTO "DomainEventConsumption" (
            "id", "eventId", "tenantId", "consumerName", "status",
            "attempts", "maxAttempts", "nextAttemptAt", "createdAt", "updatedAt"
          ) VALUES (
            ${randomUUID()}, ${input.eventId}::uuid, ${input.tenantId},
            ${consumerName}, 'PENDING'::"DomainConsumptionStatus",
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
            AND "consumerName" = ${consumerName}
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
