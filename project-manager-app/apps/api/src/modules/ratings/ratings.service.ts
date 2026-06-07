import { ForbiddenException, Injectable } from "@nestjs/common";
import { AuditService } from "../../infrastructure/audit/audit.service.js";
import { DomainEventBus } from "../domain-events/domain-event-bus.service.js";
import {
  canCreateRating,
  canReadRating,
  canReadRatingSummary,
  isOpsAdmin,
  type RatingActor
} from "./ratings.policy.js";
import {
  type RatingRecord,
  type RatingSummaryRecord,
  RatingsRepository
} from "./ratings.repository.js";

@Injectable()
export class RatingsService {
  constructor(
    private readonly ratingsRepository: RatingsRepository,
    private readonly auditService: AuditService,
    private readonly domainEventBus: DomainEventBus
  ) {}

  async listRatings(actor: RatingActor): Promise<RatingRecord[]> {
    if (isOpsAdmin(actor)) {
      return this.ratingsRepository.findRatingsByTenant(actor);
    }

    return this.ratingsRepository.findRatingsForUser({
      tenantId: actor.tenantId,
      orgId: actor.orgId,
      userId: actor.userId,
      targetUserId: actor.userId
    });
  }

  async getRating(actor: RatingActor, ratingId: string): Promise<RatingRecord> {
    const rating = await this.ratingsRepository.findRatingById({
      tenantId: actor.tenantId,
      orgId: actor.orgId,
      userId: actor.userId,
      ratingId
    });

    if (!canReadRating(actor, { fromUserId: rating.fromUser.id, toUserId: rating.toUser.id })) {
      throw new ForbiddenException("Cannot read this rating");
    }

    return rating;
  }

  async summarizeUser(actor: RatingActor, userId: string): Promise<RatingSummaryRecord> {
    if (!canReadRatingSummary(actor, userId)) {
      throw new ForbiddenException("Cannot read rating summary for this user");
    }

    return this.ratingsRepository.summarizeRatingsForUser({
      tenantId: actor.tenantId,
      orgId: actor.orgId,
      userId: actor.userId,
      targetUserId: userId
    });
  }

  async createRating(input: RatingActor & {
    jobId: string;
    toUserId: string;
    score: number;
    comment?: string;
    requestId: string;
  }): Promise<RatingRecord> {
    if (!canCreateRating(input)) {
      throw new ForbiddenException("Cannot submit ratings");
    }

    const rating = await this.ratingsRepository.createRating({
      tenantId: input.tenantId,
      orgId: input.orgId,
      userId: input.userId,
      jobId: input.jobId,
      toUserId: input.toUserId,
      score: input.score,
      comment: input.comment
    });

    await this.auditService.append({
      id: `aud_${Date.now()}`,
      tenantId: input.tenantId,
      orgId: input.orgId,
      actorUserId: input.userId,
      action: "rating.create",
      entityType: "Rating",
      entityId: rating.id,
      requestId: input.requestId,
      timestamp: new Date().toISOString(),
      afterJson: {
        jobId: rating.jobId,
        toUserId: rating.toUser.id,
        score: rating.score,
        comment: rating.comment
      }
    });

    await this.domainEventBus.emit(
      {
        type: "rating.submitted",
        meta: {
          tenantId: input.tenantId,
          correlationId: `rating:${rating.id}:submitted`,
          actorId: input.userId,
          actorType: "user",
          occurredAt: new Date().toISOString(),
          version: 1
        },
        payload: {
          ratingId: rating.id,
          jobId: rating.jobId,
          fromUserId: rating.fromUser.id,
          toUserId: rating.toUser.id,
          score: rating.score,
          comment: rating.comment
        },
        triggers: ["trust-match", "audit"]
      },
      {
        tenantId: input.tenantId,
        orgId: input.orgId,
        userId: input.userId,
        requestId: input.requestId
      }
    );

    return rating;
  }
}
