import { Injectable, Logger, Optional } from "@nestjs/common";
import { type ContractRecord } from "../../common/domain-store.js";
import { AuditService } from "../../infrastructure/audit/audit.service.js";
import { ContractsRepository } from "./contracts.repository.js";
import { ContractTemplateService, type ContractParties } from "./contract-template.service.js";
import { HelloSignService } from "./hellosign.service.js";

@Injectable()
export class ContractsService {
  private readonly logger = new Logger(ContractsService.name);

  constructor(
    private readonly contractsRepository: ContractsRepository,
    private readonly auditService: AuditService,
    @Optional() private readonly template?: ContractTemplateService,
    @Optional() private readonly helloSign?: HelloSignService,
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

  /** 1.4.B: Create contract pre-filled from a trade estimate. */
  async createFromEstimate(input: {
    tenantId: string;
    orgId: string;
    userId: string;
    roles: string[];
    jobId: string;
    trade: string;
    parties: ContractParties;
    milestones: Array<{ title: string; amount: number; description: string }>;
    requestId: string;
  }): Promise<ContractRecord> {
    const terms = this.template
      ? this.template.generate(input.trade, input.parties, input.milestones)
      : {
          trade: input.trade, parties: input.parties,
          milestones: input.milestones,
          totalAmount: input.parties.totalAmount,
          generatedAt: new Date().toISOString(),
        };

    return this.create({
      tenantId: input.tenantId,
      orgId: input.orgId,
      userId: input.userId,
      roles: input.roles,
      jobId: input.jobId,
      termsJson: terms as Record<string, unknown>,
      requestId: input.requestId,
    });
  }

  /** 1.4.A: Request HelloSign signatures for a contract. Updates contract with requestId and signing URLs. */
  async requestSignatures(input: {
    tenantId: string;
    orgId: string;
    userId: string;
    roles: string[];
    contractId: string;
    signers: Array<{ name: string; email: string; role: "client" | "professional" }>;
    requestId: string;
  }): Promise<{
    contract: ContractRecord;
    helloSignRequestId: string;
    signingUrlClient: string | null;
    signingUrlPro: string | null;
  }> {
    const contract = await this.contractsRepository.findById({
      tenantId: input.tenantId,
      orgId: input.orgId,
      userId: input.userId,
      roles: input.roles,
      contractId: input.contractId,
    });

    // Build plain text document from termsJson
    const terms = contract.termsJson as Record<string, unknown>;
    const documentText = this.template
      ? this.template.toPlainText(terms as Parameters<typeof this.template.toPlainText>[0])
      : JSON.stringify(terms, null, 2);

    const jobTitle = String(
      (terms.parties as Record<string, unknown> | undefined)?.projectTitle
        ?? (terms.parties as Record<string, unknown> | undefined)?.jobId
        ?? contract.jobId
    );

    const sigResult = this.helloSign
      ? await this.helloSign.createSignatureRequest({
          title:        `Contrato SEMSE — ${jobTitle}`,
          subject:      `Firma requerida: Contrato de servicios`,
          message:      "Por favor firma este contrato para activar el escrow y comenzar el trabajo.",
          contractId:   input.contractId,
          documentText,
          signers:      input.signers,
        })
      : {
          requestId:        `mock_sr_${input.contractId}_${Date.now()}`,
          signingUrlClient: null,
          signingUrlPro:    null,
          embeddedEnabled:  false,
        };

    // Store signing info in contract (using DB upsert via repository)
    const updated = await this.contractsRepository.updateSigningInfo({
      contractId:       input.contractId,
      helloSignRequestId: sigResult.requestId,
      signingUrlClient: sigResult.signingUrlClient,
      signingUrlPro:    sigResult.signingUrlPro,
    });

    this.logger.log(`[Contracts] Signature request ${sigResult.requestId} for contract ${input.contractId}`);

    await this.auditService.append({
      id: `aud_${Date.now()}`,
      tenantId: input.tenantId,
      orgId: input.orgId,
      actorUserId: input.userId,
      action: "contract.signature_requested",
      entityType: "Contract",
      entityId: input.contractId,
      requestId: input.requestId,
      timestamp: new Date().toISOString(),
    });

    return {
      contract: updated,
      helloSignRequestId: sigResult.requestId,
      signingUrlClient: sigResult.signingUrlClient,
      signingUrlPro:    sigResult.signingUrlPro,
    };
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

    // 1.4.C: If both parties have now signed → contract is fully executed → escrow should activate
    const bothSigned = Boolean(contract.signedClientAt) && Boolean(contract.signedProAt);
    if (bothSigned) {
      this.logger.log(`[Contracts] Both parties signed contract ${contract.id} — escrow activation eligible`);
      // Escrow activation is handled by PaymentsService when creating a PaymentEscrow for this contract.
      // Emit audit event that downstream services can react to.
      void this.auditService.append({
        id: `aud_${Date.now()}_exec`,
        tenantId: input.tenantId,
        orgId: input.orgId,
        actorUserId: input.userId,
        action: "contract.fully_executed",
        entityType: "Contract",
        entityId: contract.id,
        requestId: input.requestId,
        timestamp: new Date().toISOString(),
        afterJson: { fullyExecutedAt: new Date().toISOString() },
      }).catch(() => undefined);
    }

    return contract;
  }
}
