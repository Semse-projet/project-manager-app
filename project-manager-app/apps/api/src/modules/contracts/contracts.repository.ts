import { ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { type ContractRecord } from "../../common/domain-store.js";
import { ActorContextService } from "../../infrastructure/persistence/actor-context.service.js";
import { PrismaService } from "../../infrastructure/prisma/prisma.service.js";
import { ReservationsRepository } from "../reservations/reservations.repository.js";

type ActorInput = {
  tenantId: string;
  orgId: string;
  userId: string;
  roles: string[];
};

type StoredContract = {
  id: string;
  jobId: string;
  professionalOrgId: string | null;
  clientUserId: string;
  professionalUserId: string;
  termsJson: Record<string, unknown>;
  signedClientAt: Date | null;
  signedProAt: Date | null;
  pdfUrl: string | null;
  documentHash: string | null;
  job: {
    tenantId: string;
    clientOrgId: string;
  };
};

const contractSelect = {
  id: true,
  jobId: true,
  professionalOrgId: true,
  clientUserId: true,
  professionalUserId: true,
  termsJson: true,
  signedClientAt: true,
  signedProAt: true,
  pdfUrl: true,
  documentHash: true,
  job: {
    select: {
      tenantId: true,
      clientOrgId: true
    }
  }
} as const;

@Injectable()
export class ContractsRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly actorContextService: ActorContextService,
    private readonly reservationsRepository: ReservationsRepository
  ) {}

  async create(input: ActorInput & { jobId: string; termsJson: Record<string, unknown> }): Promise<ContractRecord> {
    await this.actorContextService.ensureActorContext(input);

    const job = await this.prisma.job.findFirst({
      where: {
        id: input.jobId,
        tenantId: input.tenantId,
        deletedAt: null
      },
      select: {
        id: true,
        tenantId: true,
        clientOrgId: true
      }
    });

    if (!job) {
      throw new NotFoundException(`Job '${input.jobId}' not found`);
    }
    if (job.clientOrgId !== input.orgId && !input.roles.includes("OPS_ADMIN")) {
      throw new ForbiddenException("actor cannot create contract for this job");
    }

    const existing = await this.findCurrentByJob(input);
    if (existing) {
      return existing;
    }

    const acceptedReservation = await this.reservationsRepository.findAcceptedByJob(input);
    if (!acceptedReservation || !acceptedReservation.professionalOrgId) {
      throw new ConflictException("contract requires an accepted reservation");
    }

    const contract = (await this.prisma.contract.create({
      data: {
        jobId: input.jobId,
        clientOrgId: job.clientOrgId,
        professionalOrgId: acceptedReservation.professionalOrgId,
        clientUserId: input.userId,
        professionalUserId: acceptedReservation.professionalId,
        termsJson: input.termsJson as Prisma.InputJsonValue
      },
      select: contractSelect
    })) as unknown as StoredContract;

    return this.toRecord(contract, acceptedReservation.professionalOrgId);
  }

  async findCurrentByJob(input: ActorInput & { jobId: string }): Promise<ContractRecord | null> {
    await this.actorContextService.ensureActorContext(input);

    const row = (await this.prisma.contract.findFirst({
      where: {
        jobId: input.jobId,
        job: {
          tenantId: input.tenantId,
          deletedAt: null
        },
        deletedAt: null
      },
      select: contractSelect
    })) as StoredContract | null;

    if (!row) {
      return null;
    }
    const professionalOrgId = row.professionalOrgId ?? await this.resolveProfessionalOrgId(input.tenantId, row.professionalUserId);
    if (!this.canReadContract(input, row, professionalOrgId)) {
      throw new ForbiddenException("actor cannot read this contract");
    }

    return this.toRecord(row, professionalOrgId);
  }

  async sign(
    input: ActorInput & { contractId: string; signAs?: "client" | "professional"; documentHash: string; pdfUrl?: string }
  ): Promise<ContractRecord> {
    await this.actorContextService.ensureActorContext(input);

    const row = await this.findStoredById(input);

    if (!row) {
      throw new NotFoundException(`Contract '${input.contractId}' not found`);
    }

    const professionalOrgId = row.professionalOrgId ?? await this.resolveProfessionalOrgId(input.tenantId, row.professionalUserId);
    const canSignAsClient = row.job.clientOrgId === input.orgId && row.clientUserId === input.userId;
    const canSignAsProfessional = professionalOrgId === input.orgId && row.professionalUserId === input.userId;
    const isOps = input.roles.includes("OPS_ADMIN");

    if (!canSignAsClient && !canSignAsProfessional && !isOps) {
      throw new ForbiddenException("actor cannot sign this contract");
    }

    if (isOps && !input.signAs) {
      throw new ConflictException("ops signature requires explicit signAs target");
    }
    if (!isOps && input.signAs === "client" && !canSignAsClient) {
      throw new ForbiddenException("actor cannot sign as client");
    }
    if (!isOps && input.signAs === "professional" && !canSignAsProfessional) {
      throw new ForbiddenException("actor cannot sign as professional");
    }

    const targetRole = input.signAs ?? (canSignAsClient ? "client" : canSignAsProfessional ? "professional" : undefined);
    if (!targetRole) {
      throw new ForbiddenException("actor cannot sign this contract");
    }

    if (row.documentHash && row.documentHash !== input.documentHash) {
      throw new ConflictException("documentHash cannot change after the first signature");
    }
    if (row.pdfUrl && input.pdfUrl && row.pdfUrl !== input.pdfUrl) {
      throw new ConflictException("pdfUrl cannot change after the first signature");
    }
    if (targetRole === "client" && row.signedClientAt) {
      return this.toRecord(row, professionalOrgId);
    }
    if (targetRole === "professional" && row.signedProAt) {
      return this.toRecord(row, professionalOrgId);
    }

    const updated = (await this.prisma.contract.update({
      where: { id: row.id },
      data: {
        signedClientAt: targetRole === "client" ? row.signedClientAt ?? new Date() : row.signedClientAt,
        signedProAt: targetRole === "professional" ? row.signedProAt ?? new Date() : row.signedProAt,
        documentHash: row.documentHash ?? input.documentHash,
        pdfUrl: row.pdfUrl ?? input.pdfUrl
      },
      select: contractSelect
    })) as StoredContract;

    return this.toRecord(updated, professionalOrgId);
  }

  async findById(input: ActorInput & { contractId: string }): Promise<ContractRecord> {
    await this.actorContextService.ensureActorContext(input);

    const row = await this.findStoredById(input);
    if (!row) {
      throw new NotFoundException(`Contract '${input.contractId}' not found`);
    }
    const professionalOrgId = row.professionalOrgId ?? await this.resolveProfessionalOrgId(input.tenantId, row.professionalUserId);
    if (!this.canReadContract(input, row, professionalOrgId)) {
      throw new ForbiddenException("actor cannot read this contract");
    }

    return this.toRecord(row, professionalOrgId);
  }

  private canReadContract(
    actor: ActorInput,
    row: StoredContract,
    professionalOrgId: string | null
  ): boolean {
    return (
      actor.roles.includes("OPS_ADMIN") ||
      actor.orgId === row.job.clientOrgId ||
      actor.orgId === professionalOrgId
    );
  }

  private async findStoredById(input: { tenantId: string; contractId: string }) {
    return (await this.prisma.contract.findFirst({
      where: {
        id: input.contractId,
        job: {
          tenantId: input.tenantId,
          deletedAt: null
        },
        deletedAt: null
      },
      select: contractSelect
    })) as StoredContract | null;
  }

  private toRecord(row: StoredContract, professionalOrgId?: string | null): ContractRecord {
    return {
      id: row.id,
      tenantId: row.job.tenantId,
      jobId: row.jobId,
      clientOrgId: row.job.clientOrgId,
      professionalOrgId: professionalOrgId ?? row.professionalOrgId ?? undefined,
      clientUserId: row.clientUserId,
      professionalUserId: row.professionalUserId,
      termsJson: row.termsJson,
      signedClientAt: row.signedClientAt?.toISOString(),
      signedProAt: row.signedProAt?.toISOString(),
      pdfUrl: row.pdfUrl ?? undefined,
      documentHash: row.documentHash ?? undefined
    };
  }

  private async resolveProfessionalOrgId(tenantId: string, professionalUserId: string): Promise<string | null> {
    const membership = await this.prisma.membership.findFirst({
      where: {
        userId: professionalUserId,
        org: {
          tenantId,
          type: "pro"
        }
      },
      select: {
        orgId: true
      }
    });

    return membership?.orgId ?? null;
  }

  /** 1.4.A: Store HelloSign request ID and signing URLs on a contract. */
  async updateSigningInfo(input: {
    contractId:        string;
    helloSignRequestId: string;
    signingUrlClient:  string | null;
    signingUrlPro:     string | null;
  }): Promise<ContractRecord> {
    const raw = await this.prisma.contract.update({
      where: { id: input.contractId },
      data: {
        helloSignRequestId: input.helloSignRequestId,
        signingUrlClient:   input.signingUrlClient,
        signingUrlPro:      input.signingUrlPro,
      },
      select: contractSelect,
    });
    return this.toRecord(raw as StoredContract);
  }
}
