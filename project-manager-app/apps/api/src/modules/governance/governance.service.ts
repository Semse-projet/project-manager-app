import { Injectable, NotFoundException, ConflictException, ForbiddenException, Logger } from "@nestjs/common";
import { PrismaService } from "../../infrastructure/prisma/prisma.service.js";
import {
  computeVoteWeight,
  tallyVotes,
  validateVote,
  classifyProposalRisk,
  TallyResult,
  RawVote,
} from "./governance-voting.algorithm.js";
import {
  creditsForEvent,
  computeDecayFactor,
  creditTier,
  GovernanceCreditSummary,
  CreditEvent,
} from "./governance-credits.algorithm.js";
import { computeReputation } from "../ratings/reputation.algorithm.js";

export type CreateProposalDto = {
  tenantId: string;
  authorId: string;
  title: string;
  description: string;
  category?: string;
  closesAt: Date;
};

export type CastVoteDto = {
  tenantId: string;
  proposalId: string;
  voterId: string;
  choice: string;
  units?: number;
  reason?: string;
};

export type ProposalResults = TallyResult & {
  proposalId: string;
  status: string;
  title: string;
  closesAt: string;
  mcaAdvice: string | null;
  mcaRisk: string;
};

@Injectable()
export class GovernanceService {
  private readonly logger = new Logger(GovernanceService.name);

  constructor(private readonly prisma: PrismaService) {}

  async createProposal(dto: CreateProposalDto) {
    // Snapshot author reputation
    const authorScore = await this.resolveReputationScore(dto.authorId, dto.tenantId);
    const mcaRisk = classifyProposalRisk(dto.category ?? "general", authorScore);

    const mcaAdvice = this.buildMcaAdvice(dto, mcaRisk, authorScore);

    const proposal = await this.prisma.governanceProposal.create({
      data: {
        tenantId: dto.tenantId,
        title: dto.title,
        description: dto.description,
        category: dto.category ?? "general",
        authorId: dto.authorId,
        authorReputationScore: authorScore,
        mcaAdvice,
        mcaRisk,
        closesAt: dto.closesAt,
      },
    });

    // Award governance credits for creating proposal
    await this.awardCredits(dto.tenantId, dto.authorId, {
      type: "proposal_created",
      proposalRisk: mcaRisk as "low" | "medium" | "high",
      createdAt: new Date(),
    });

    this.logger.log(
      `[Governance] proposal created id=${proposal.id} author=${dto.authorId} risk=${mcaRisk} score=${authorScore}`,
    );

    return proposal;
  }

  async castVote(dto: CastVoteDto) {
    const units = dto.units ?? 1;

    const validation = validateVote(dto.choice, units);
    if (!validation.valid) throw new ForbiddenException(validation.reason);

    const proposal = await this.prisma.governanceProposal.findUnique({
      where: { id: dto.proposalId },
    });
    if (!proposal) throw new NotFoundException("Proposal not found");
    if (proposal.status !== "open") throw new ConflictException("Proposal is not open for voting");
    if (new Date() > proposal.closesAt) throw new ConflictException("Proposal voting period has ended");

    const voterScore = await this.resolveReputationScore(dto.voterId, dto.tenantId);
    const weight = computeVoteWeight(voterScore, units);

    const existing = await this.prisma.governanceVote.findUnique({
      where: { proposalId_voterId: { proposalId: dto.proposalId, voterId: dto.voterId } },
    });
    if (existing) throw new ConflictException("Voter has already voted on this proposal");

    const vote = await this.prisma.governanceVote.create({
      data: {
        tenantId: dto.tenantId,
        proposalId: dto.proposalId,
        voterId: dto.voterId,
        choice: dto.choice,
        voterReputationScore: voterScore,
        units,
        reason: dto.reason,
      },
    });

    // Award governance credits for voting
    await this.awardCredits(dto.tenantId, dto.voterId, {
      type: "vote_cast",
      choice: dto.choice as "for" | "against" | "abstain",
      outcome: "open", // outcome resolved at close time
      createdAt: new Date(),
    });

    this.logger.log(
      `[Governance] vote cast proposalId=${dto.proposalId} voter=${dto.voterId} choice=${dto.choice} weight=${weight}`,
    );

    return { ...vote, computedWeight: weight };
  }

  async listProposals(tenantId: string, status?: string) {
    return this.prisma.governanceProposal.findMany({
      where: { tenantId, ...(status ? { status } : {}) },
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { votes: true } } },
    });
  }

  async getProposal(proposalId: string) {
    const proposal = await this.prisma.governanceProposal.findUnique({
      where: { id: proposalId },
      include: { votes: true },
    });
    if (!proposal) throw new NotFoundException("Proposal not found");
    return proposal;
  }

  async getResults(proposalId: string): Promise<ProposalResults> {
    const proposal = await this.prisma.governanceProposal.findUnique({
      where: { id: proposalId },
      include: { votes: true },
    });
    if (!proposal) throw new NotFoundException("Proposal not found");

    const rawVotes: RawVote[] = proposal.votes.map((v) => ({
      voterId: v.voterId,
      choice: v.choice as RawVote["choice"],
      voterReputationScore: Number(v.voterReputationScore),
      units: v.units,
    }));

    const tally = tallyVotes(rawVotes);

    return {
      ...tally,
      proposalId: proposal.id,
      status: proposal.status,
      title: proposal.title,
      closesAt: proposal.closesAt.toISOString(),
      mcaAdvice: proposal.mcaAdvice,
      mcaRisk: proposal.mcaRisk,
    };
  }

  async closeProposal(proposalId: string): Promise<{ status: string; outcome: string }> {
    const proposal = await this.prisma.governanceProposal.findUnique({
      where: { id: proposalId },
      include: { votes: true },
    });
    if (!proposal) throw new NotFoundException("Proposal not found");
    if (proposal.status !== "open") throw new ConflictException("Proposal is already closed");

    const rawVotes: RawVote[] = proposal.votes.map((v) => ({
      voterId: v.voterId,
      choice: v.choice as RawVote["choice"],
      voterReputationScore: Number(v.voterReputationScore),
      units: v.units,
    }));

    const tally = tallyVotes(rawVotes);
    const newStatus =
      tally.outcome === "passed" ? "passed" :
      tally.outcome === "rejected" ? "rejected" :
      "closed";

    await this.prisma.governanceProposal.update({
      where: { id: proposalId },
      data: { status: newStatus },
    });

    this.logger.log(`[Governance] proposal closed id=${proposalId} outcome=${tally.outcome}`);
    return { status: newStatus, outcome: tally.outcome };
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  private async resolveReputationScore(userId: string, tenantId: string): Promise<number> {
    const [ratings, reservations, user] = await Promise.all([
      this.prisma.rating.findMany({
        where: { toUserId: userId, job: { tenantId } },
        select: { score: true, createdAt: true },
      }),
      this.prisma.jobReservation.findMany({
        where: { professionalId: userId, job: { tenantId } },
        select: { job: { select: { status: true } } },
      }),
      this.prisma.user.findUnique({
        where: { id: userId },
        select: { verificationStatus: true },
      }),
    ]);

    const completed = reservations.filter((r) => r.job?.status === "COMPLETED").length;

    const result = computeReputation({
      userId,
      verificationStatus: user?.verificationStatus ?? "unverified",
      ratings: ratings.map((r) => ({ score: r.score as number, createdAt: r.createdAt })),
      totalJobsAsProfessional: reservations.length,
      completedJobs: completed,
      disputesAgainst: 0,
    });

    return result.score;
  }

  private buildMcaAdvice(
    dto: CreateProposalDto,
    risk: string,
    authorScore: number,
  ): string {
    const adviceMap: Record<string, string> = {
      high: `Propuesta de alto riesgo (categoría: ${dto.category ?? "general"}, puntuación del autor: ${authorScore.toFixed(1)}). MCA recomienda revisión manual antes de cierre. Considerar período de comentarios extendido.`,
      medium: `Propuesta de riesgo medio. El autor tiene reputación de ${authorScore.toFixed(1)}/100. Se sugiere monitorear participación durante el período de votación.`,
      low: `Propuesta de bajo riesgo. Autor verificado con reputación ${authorScore.toFixed(1)}/100. Proceder con flujo estándar de votación.`,
    };
    return adviceMap[risk] ?? adviceMap.low;
  }

  private async awardCredits(tenantId: string, userId: string, event: CreditEvent): Promise<void> {
    try {
      const raw = creditsForEvent(event);
      await this.prisma.governanceCreditEvent.create({
        data: {
          tenantId,
          userId,
          eventType: event.type,
          credits: raw,
          context: JSON.stringify(event),
        },
      });
    } catch {
      // Non-critical — credit recording failure should not block the primary action
    }
  }

  async getCredits(tenantId: string, userId: string): Promise<GovernanceCreditSummary> {
    const events = await this.prisma.governanceCreditEvent.findMany({
      where: { tenantId, userId },
      orderBy: { createdAt: "asc" },
    });

    const now = new Date();
    let totalCredits = 0;
    for (const e of events) {
      const raw = Number(e.credits);
      const decay = computeDecayFactor(e.createdAt, now);
      totalCredits += raw * decay;
    }
    totalCredits = Math.round(totalCredits * 100) / 100;

    return {
      totalCredits,
      tier: creditTier(totalCredits),
      eventsCount: events.length,
    };
  }
}
