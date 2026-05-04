import { Injectable } from "@nestjs/common";
import { agentCatalog } from "@semse/agents";
import { type AgentRunRecord } from "../../common/domain-store.js";
import { PrismaService } from "../../infrastructure/prisma/prisma.service.js";
import { MatchingService } from "../matching/matching.service.js";
import { AgentsService } from "../agents/agents.service.js";

type RouteContext = {
  tenantId: string;
  orgId: string;
  userId: string;
  requestId: string;
};

type RuntimeDomainEvent = {
  type: string;
  meta: { correlationId: string };
  payload: Record<string, unknown>;
  triggers: string[];
};

const runtimeAgentTypes = new Set<AgentRunRecord["agentType"]>(agentCatalog);

@Injectable()
export class AgentTriggerRouter {
  constructor(
    private readonly agentsService: AgentsService,
    private readonly matchingService: MatchingService,
    private readonly prisma: PrismaService
  ) {}

  async route(event: RuntimeDomainEvent, context: RouteContext) {
    const runtimeTriggers = event.triggers.filter((trigger): trigger is AgentRunRecord["agentType"] =>
      runtimeAgentTypes.has(trigger as AgentRunRecord["agentType"])
    );

    const runs = [];
    for (const agentType of runtimeTriggers) {
      const enrichedPayload = await this.enrichPayload(agentType, event, context.tenantId);

      const run = await this.agentsService.create({
        tenantId: context.tenantId,
        orgId: context.orgId,
        userId: context.userId,
        roles: [],
        agentType,
        triggerType: "event",
        correlationId: event.meta.correlationId,
        idempotencyKey: `domain:${event.type}:${event.meta.correlationId}:${agentType}`,
        input: {
          eventType: event.type,
          eventMeta: event.meta,
          eventPayload: { ...event.payload, ...enrichedPayload }
        },
        inputSummary: `${event.type} -> ${agentType}`,
        requestId: context.requestId
      });

      runs.push(run);
    }

    return runs;
  }

  private async enrichPayload(
    agentType: AgentRunRecord["agentType"],
    event: RuntimeDomainEvent,
    tenantId: string
  ): Promise<Record<string, unknown>> {
    try {
      if (agentType === "trust-match" && (event.type === "job.created" || event.type === "job.preferred_professional_selected")) {
        return await this.enrichTrustMatch(event.payload, tenantId);
      }
      if (agentType === "dispute" && event.type === "dispute.opened") {
        return await this.enrichDispute(event.payload, tenantId);
      }
      if (agentType === "evidence-coach" && event.type === "milestone.submitted") {
        return await this.enrichEvidenceCoach(event.payload, tenantId);
      }
    } catch {
      // enrichment is best-effort; handler has fallbacks
    }
    return {};
  }

  private async enrichTrustMatch(
    payload: Record<string, unknown>,
    tenantId: string
  ): Promise<Record<string, unknown>> {
    const jobId = typeof payload.jobId === "string" ? payload.jobId : null;
    if (!jobId) return {};

    const result = await this.matchingService.matchJob(tenantId, {
      jobId,
      limit: 10,
      minScore: 0.05
    });

    const focusCandidate = result.preferredTarget
      ? result.candidates.find((candidate) => candidate.userId === result.preferredTarget?.userId) ?? null
      : null;

    return {
      realCandidates: result.candidates,
      preferredTarget: result.preferredTarget ?? null,
      preferredCandidateStatus: result.preferredCandidateStatus ?? null,
      focusCandidate,
    };
  }

  private async enrichDispute(
    payload: Record<string, unknown>,
    tenantId: string
  ): Promise<Record<string, unknown>> {
    const disputeId = typeof payload.disputeId === "string" ? payload.disputeId : null;
    if (!disputeId) return {};

    const dispute = await this.prisma.dispute.findFirst({
      where: { id: disputeId, tenantId, deletedAt: null },
      include: {
        project: {
          include: {
            job: { select: { id: true } }
          }
        },
        milestone: { select: { id: true, status: true } }
      }
    });

    if (!dispute) return {};

    const jobId = dispute.project?.job?.id;

    const [evidenceCount, contractExists] = await Promise.all([
      jobId
        ? this.prisma.evidence.count({
            where: { project: { jobId, tenantId: { equals: tenantId } } }
          })
        : Promise.resolve(0),
      jobId
        ? this.prisma.contract.count({ where: { jobId, deletedAt: null } }).then((c: number) => c > 0)
        : Promise.resolve(false)
    ]);

    return {
      evidenceCount,
      milestoneStatus: dispute.milestone?.status ?? null,
      contractExists,
      // Only override reasonCode if DB has a structured value — otherwise keep event payload's value
      ...(dispute.reasonCode ? { reasonCode: dispute.reasonCode } : {})
    };
  }

  private async enrichEvidenceCoach(
    payload: Record<string, unknown>,
    tenantId: string
  ): Promise<Record<string, unknown>> {
    const milestoneId = typeof payload.milestoneId === "string" ? payload.milestoneId : null;
    if (!milestoneId) return {};

    const milestone = await this.prisma.milestone.findFirst({
      where: { id: milestoneId, deletedAt: null, project: { tenantId } },
      include: {
        evidence: {
          select: { kind: true, capturedAt: true, createdAt: true, metadataJson: true }
        }
      }
    });

    if (!milestone) return {};

    type EvidenceRow = { kind: string; capturedAt: Date | null; createdAt: Date; metadataJson: unknown };
    const evidence = milestone.evidence as EvidenceRow[];
    const photoCount = evidence.filter((e) => e.kind === "PHOTO").length;
    const videoCount = evidence.filter((e) => e.kind === "VIDEO").length;

    // before/after pair heuristic: >= 2 photos with different capturedAt dates
    const photoTimestamps = evidence
      .filter((e) => e.kind === "PHOTO" && e.capturedAt)
      .map((e) => e.capturedAt!.getTime());
    const hasBeforeAfterPair =
      photoTimestamps.length >= 2 &&
      Math.max(...photoTimestamps) - Math.min(...photoTimestamps) > 60_000;

    const checklistSchema = milestone.checklistSchema as { items?: Array<{ id: string }> } | null;
    const checklistItemCount = checklistSchema?.items?.length ?? 0;

    return {
      evidenceItems: { photoCount, videoCount, totalCount: evidence.length },
      hasBeforeAfterPair,
      checklistItemCount,
      requiredEvidenceTypes: milestone.requiredEvidenceTypes
    };
  }
}
