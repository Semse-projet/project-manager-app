import { Injectable } from "@nestjs/common";
import { type ContractRecord } from "../../common/domain-store.js";
import { AuditService } from "../../infrastructure/audit/audit.service.js";
import { ContractsRepository } from "./contracts.repository.js";

@Injectable()
export class ContractsService {
  constructor(
    private readonly contractsRepository: ContractsRepository,
    private readonly auditService: AuditService
  ) {}

  async create(input: {
    tenantId: string;
    orgId: string;
    userId: string;
    roles: string[];
    jobId: string;
    termsJson: Record<string, unknown>;
    requestId: string;
  }): Promise<ContractRecord> {
    const contract = await this.contractsRepository.create(input);

    await this.auditService.append({
      id: `aud_${Date.now()}`,
      tenantId: input.tenantId,
      orgId: input.orgId,
      actorUserId: input.userId,
      action: "contract.create",
      entityType: "Contract",
      entityId: contract.id,
      requestId: input.requestId,
      timestamp: new Date().toISOString()
    });

    return contract;
  }

  async current(input: {
    tenantId: string;
    orgId: string;
    userId: string;
    roles: string[];
    jobId: string;
  }): Promise<ContractRecord | null> {
    return this.contractsRepository.findCurrentByJob(input);
  }

  async byId(input: {
    tenantId: string;
    orgId: string;
    userId: string;
    roles: string[];
    contractId: string;
  }): Promise<ContractRecord> {
    return this.contractsRepository.findById(input);
  }

  async sign(input: {
    tenantId: string;
    orgId: string;
    userId: string;
    roles: string[];
    contractId: string;
    signAs?: "client" | "professional";
    documentHash: string;
    pdfUrl?: string;
    requestId: string;
  }): Promise<ContractRecord> {
    const before = await this.contractsRepository.findById({
      tenantId: input.tenantId,
      orgId: input.orgId,
      userId: input.userId,
      roles: input.roles,
      contractId: input.contractId
    });

    const contract = await this.contractsRepository.sign(input);

    await this.auditService.append({
      id: `aud_${Date.now()}`,
      tenantId: input.tenantId,
      orgId: input.orgId,
      actorUserId: input.userId,
      action: "contract.sign",
      entityType: "Contract",
      entityId: contract.id,
      requestId: input.requestId,
      timestamp: new Date().toISOString(),
      beforeJson: before
        ? {
            signedClientAt: before.signedClientAt,
            signedProAt: before.signedProAt
          }
        : undefined,
      afterJson: {
        signedClientAt: contract.signedClientAt,
        signedProAt: contract.signedProAt,
        documentHash: contract.documentHash
      }
    });

    return contract;
  }
}
