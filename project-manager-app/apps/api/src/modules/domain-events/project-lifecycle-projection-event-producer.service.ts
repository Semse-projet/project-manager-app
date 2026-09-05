import { randomUUID } from "node:crypto";
import { Injectable, Logger } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import {
  PROJECT_LIFECYCLE_SOURCE_CHANGED_V1_SCHEMA_REF,
  projectLifecycleSourceChangedV1EventSchema,
} from "@semse/schemas";
import { PrismaService } from "../../infrastructure/prisma/prisma.service.js";
import { isProjectLifecycleProjectionEnabled } from "../projects/project-lifecycle-projection.js";
import { OutboxRepository } from "./outbox.repository.js";

type OutboxClient = Pick<Prisma.TransactionClient, "domainOutboxEvent">;
type EventActorType = "user" | "system" | "agent" | "webhook";

export type ProjectLifecycleSourceChangedInput = {
  tenantId: string;
  orgId: string;
  projectId: string;
  sourceEventType: string;
  sourceEntityType: string;
  sourceEntityId: string;
  actorType: EventActorType;
  actorId: string;
  correlationId: string;
  causationId?: string;
};

export type ProjectLifecycleEventWriteResult =
  | "created"
  | "duplicate"
  | "disabled"
  | "failed";

export function isProjectLifecycleEventsEnabled(
  tenantId: string,
  environment: Record<string, string | undefined> = process.env,
): boolean {
  return (
    environment.SEMSE_PROJECT_LIFECYCLE_EVENTS_ENABLED === "true" &&
    isProjectLifecycleProjectionEnabled(tenantId, environment)
  );
}

@Injectable()
export class ProjectLifecycleProjectionEventProducer {
  private readonly logger = new Logger(
    ProjectLifecycleProjectionEventProducer.name,
  );

  constructor(
    private readonly prisma: PrismaService,
    private readonly outboxRepository: OutboxRepository,
  ) {}

  async emit(
    input: ProjectLifecycleSourceChangedInput,
  ): Promise<ProjectLifecycleEventWriteResult> {
    try {
      return await this.record(this.prisma, input);
    } catch (error) {
      this.logger.error(
        `Lifecycle invalidation event failed tenant=${input.tenantId} project=${input.projectId} source=${input.sourceEventType}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return "failed";
    }
  }

  async record(
    tx: OutboxClient,
    input: ProjectLifecycleSourceChangedInput,
  ): Promise<Exclude<ProjectLifecycleEventWriteResult, "failed">> {
    if (!isProjectLifecycleEventsEnabled(input.tenantId)) {
      return "disabled";
    }

    const recordedAt = new Date();
    const idempotencyKey = [
      "project-lifecycle-source",
      input.sourceEventType,
      input.sourceEntityType,
      input.sourceEntityId,
      input.correlationId,
    ].join(":").slice(0, 512);
    const event = projectLifecycleSourceChangedV1EventSchema.parse({
      eventId: randomUUID(),
      eventType: "project.lifecycle-source-changed.v1",
      version: 1,
      envelopeVersion: 2,
      occurredAt: recordedAt.toISOString(),
      recordedAt: recordedAt.toISOString(),
      tenantId: input.tenantId,
      orgId: input.orgId,
      module: "projects",
      entityType: "Project",
      entityId: input.projectId,
      actor: { type: input.actorType, id: input.actorId },
      correlationId: input.correlationId,
      ...(input.causationId ? { causationId: input.causationId } : {}),
      idempotencyKey,
      schemaRef: PROJECT_LIFECYCLE_SOURCE_CHANGED_V1_SCHEMA_REF,
      payload: {
        projectId: input.projectId,
        sourceEventType: input.sourceEventType,
        sourceEntityType: input.sourceEntityType,
        sourceEntityId: input.sourceEntityId,
      },
      metadata: { source: "project-lifecycle-projection" },
    });

    try {
      await this.outboxRepository.create(tx, event);
      return "created";
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        return "duplicate";
      }
      throw error;
    }
  }
}
