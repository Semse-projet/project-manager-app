import { BadRequestException, ConflictException, ForbiddenException, Injectable, Optional } from "@nestjs/common";
import { AuditService } from "../../infrastructure/audit/audit.service.js";
import { WorkspaceMemoryRepository } from "../knowledge/workspace-memory.repository.js";
import {
  buildPaymentWorkspaceMemoryRecord,
  buildWorkerPayoutMethodWorkspaceMemoryRecord
} from "../knowledge/workspace-memory.business-records.js";
import { PaymentsRepository } from "./payments.repository.js";
import { PaymentProviderRegistry } from "./providers/payment-provider.registry.js";
import { paymentProviderKeys, type PaymentMethodType, type PaymentProviderKey } from "./payments.types.js";
import { ProjectsService } from "../projects/projects.service.js";
import { ContractsRepository } from "../contracts/contracts.repository.js";
import { ReservationsRepository } from "../reservations/reservations.repository.js";
import { SseEventBusService } from "../../infrastructure/sse/sse-event-bus.service.js";

@Injectable()
export class PaymentsService {
  constructor(
    private readonly paymentsRepository: PaymentsRepository,
    private readonly auditService: AuditService,
    private readonly paymentProviderRegistry: PaymentProviderRegistry,
    private readonly projectsService: ProjectsService,
    private readonly contractsRepository: ContractsRepository,
    private readonly reservationsRepository: ReservationsRepository,
    private readonly workspaceMemory: WorkspaceMemoryRepository,
    @Optional() private readonly sse?: SseEventBusService,
  ) {}

  async paymentReadinessByJob(input: {
    tenantId: string;
    orgId: string;
    userId: string;
    roles: string[];
    jobId: string;
  }) {
    const acceptedReservation = await this.reservationsRepository.findAcceptedByJob({
      tenantId: input.tenantId,
      orgId: input.orgId,
      userId: input.userId,
      roles: input.roles,
      jobId: input.jobId
    });
    const contract = await this.contractsRepository.findCurrentByJob({
      tenantId: input.tenantId,
      orgId: input.orgId,
      userId: input.userId,
      roles: input.roles,
      jobId: input.jobId
    });

    let projectLinked = false;
    try {
      await this.paymentsRepository.ensureProjectByJob(input);
      projectLinked = true;
    } catch {
      projectLinked = false;
    }

    const signedClient = Boolean(contract?.signedClientAt);
    const signedProfessional = Boolean(contract?.signedProAt);
    const checks = {
      acceptedReservation: Boolean(acceptedReservation),
      activeContract: Boolean(contract),
      signedClient,
      signedProfessional,
      projectLinked
    };
    const reasons: string[] = [];

    if (!checks.acceptedReservation) {
      reasons.push("Falta una reserva aceptada para este trabajo.");
    }
    if (!checks.activeContract) {
      reasons.push("Falta un contrato activo para habilitar el escrow.");
    }
    if (checks.activeContract && !checks.signedClient) {
      reasons.push("Falta la firma del cliente en el contrato.");
    }
    if (checks.activeContract && !checks.signedProfessional) {
      reasons.push("Falta la firma del profesional en el contrato.");
    }

    return {
      jobId: input.jobId,
      ready: reasons.length === 0,
      checks,
      reasons,
      reservationId: acceptedReservation?.id ?? null,
      contractId: contract?.id ?? null
    };
  }

  async getWorkerPayoutMethod(input: {
    tenantId: string;
    orgId: string;
    userId: string;
  }) {
    const items = await this.workspaceMemory.query({
      tenantId: input.tenantId,
      orgId: input.orgId,
      workspaceId: `worker:${input.userId}:payments`,
      kinds: ["decision"],
      tags: ["payments", "worker", "payout-method"]
    });
    const latest = items.find((item) => item.id.endsWith("worker-payout-method"));
    if (!latest?.body) {
      return null;
    }

    try {
      const parsed = JSON.parse(latest.body) as Record<string, unknown>;
      return {
        type: String(parsed.type ?? ""),
        label: String(parsed.label ?? ""),
        bankName: typeof parsed.bankName === "string" ? parsed.bankName : undefined,
        last4: typeof parsed.last4 === "string" ? parsed.last4 : undefined,
        email: typeof parsed.email === "string" ? parsed.email : undefined,
        verified: Boolean(parsed.verified),
        updatedAt: latest.updatedAtIso
      };
    } catch {
      return null;
    }
  }

  async saveWorkerPayoutMethod(input: {
    tenantId: string;
    orgId: string;
    userId: string;
    requestId: string;
    type: "bank_account" | "debit_card" | "paypal" | "zelle" | "cashapp";
    bankName?: string;
    routingNumber?: string;
    accountNumber?: string;
    last4?: string;
    email?: string;
  }) {
    const labelMap: Record<typeof input.type, string> = {
      bank_account: "Cuenta bancaria",
      debit_card: "Tarjeta de débito",
      paypal: "PayPal",
      zelle: "Zelle",
      cashapp: "Cash App"
    };
    const sanitized = {
      type: input.type,
      label: labelMap[input.type],
      bankName: input.type === "bank_account" ? input.bankName : undefined,
      last4: input.last4
        ?? (input.type === "bank_account" ? input.accountNumber?.slice(-4) : undefined)
        ?? (input.type === "debit_card" ? input.accountNumber?.slice(-4) : undefined),
      email: ["paypal", "zelle", "cashapp"].includes(input.type) ? input.email : undefined,
      verified: false
    };

    const record = buildWorkerPayoutMethodWorkspaceMemoryRecord({
      tenantId: input.tenantId,
      orgId: input.orgId,
      userId: input.userId,
      ...sanitized
    });
    await this.workspaceMemory.append(record);

    await this.auditService.append({
      id: `aud_${Date.now()}`,
      tenantId: input.tenantId,
      orgId: input.orgId,
      actorUserId: input.userId,
      action: "worker.payout_method.update",
      entityType: "User",
      entityId: input.userId,
      requestId: input.requestId,
      timestamp: new Date().toISOString(),
      afterJson: {
        type: sanitized.type,
        label: sanitized.label,
        bankName: sanitized.bankName,
        last4: sanitized.last4,
        email: sanitized.email,
        verified: sanitized.verified
      }
    });

    return {
      ...sanitized,
      saved: true
    };
  }

  paymentProviderReadiness() {
    const configuredDefaultProvider = this.resolveConfiguredDefaultProvider();
    const availableProviders = this.paymentProviderRegistry.availableKeys();
    const stripeSecretConfigured = Boolean(process.env.STRIPE_SECRET_KEY?.trim());
    const stripeWebhookSecretConfigured = Boolean(process.env.STRIPE_WEBHOOK_SECRET?.trim());
    const paypalConfigured = Boolean(process.env.PAYPAL_CLIENT_ID?.trim() && process.env.PAYPAL_CLIENT_SECRET?.trim());
    const adyenConfigured = Boolean(process.env.ADYEN_API_KEY?.trim() && process.env.ADYEN_MERCHANT_ACCOUNT?.trim());
    const adyenPayoutConfigured = adyenConfigured && Boolean(process.env.ADYEN_SOURCE_BALANCE_ACCOUNT_ID?.trim());
    const productionRuntime = process.env.NODE_ENV === "production" || process.env.RAILWAY_ENVIRONMENT_NAME === "production";
    const warnings: string[] = [];

    if (configuredDefaultProvider === "stripe" && !availableProviders.includes("stripe")) {
      warnings.push("PAYMENT_PROVIDER is stripe but STRIPE_SECRET_KEY is not configured");
    }
    if (configuredDefaultProvider !== "stripe" && !availableProviders.includes(configuredDefaultProvider)) {
      warnings.push(`PAYMENT_PROVIDER is ${configuredDefaultProvider} but that provider is not implemented`);
    }
    if (productionRuntime && configuredDefaultProvider === "stripe" && !stripeWebhookSecretConfigured) {
      warnings.push("STRIPE_WEBHOOK_SECRET is required for Stripe webhooks in production");
    }
    if (productionRuntime && configuredDefaultProvider === "mock") {
      warnings.push("Production runtime is using mock payments as the default provider");
    }
    if (configuredDefaultProvider === "paypal" && !paypalConfigured) {
      warnings.push("PAYMENT_PROVIDER is paypal but PAYPAL_CLIENT_ID/PAYPAL_CLIENT_SECRET are not configured");
    }
    if (configuredDefaultProvider === "adyen" && !adyenConfigured) {
      warnings.push("PAYMENT_PROVIDER is adyen but ADYEN_API_KEY/ADYEN_MERCHANT_ACCOUNT are not configured");
    }

    return {
      configuredDefaultProvider,
      availableProviders,
      rails: [
        {
          key: "stripe",
          label: "Stripe Connect",
          clientFunding: true,
          professionalPayout: true,
          automatic: true,
          configured: stripeSecretConfigured,
          ready: availableProviders.includes("stripe") && (!productionRuntime || stripeWebhookSecretConfigured),
          requiredEnv: ["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET"]
        },
        {
          key: "paypal",
          label: "PayPal Payouts",
          clientFunding: true,
          professionalPayout: true,
          automatic: true,
          configured: paypalConfigured,
          ready: availableProviders.includes("paypal"),
          requiredEnv: ["PAYPAL_CLIENT_ID", "PAYPAL_CLIENT_SECRET"]
        },
        {
          key: "adyen",
          label: "Adyen Checkout / Transfers",
          clientFunding: true,
          professionalPayout: true,
          automatic: true,
          configured: adyenConfigured,
          ready: availableProviders.includes("adyen") && adyenPayoutConfigured,
          requiredEnv: ["ADYEN_API_KEY", "ADYEN_MERCHANT_ACCOUNT", "ADYEN_SOURCE_BALANCE_ACCOUNT_ID"]
        },
        {
          key: "bank-transfer",
          label: "Bank / ACH manual rail",
          clientFunding: true,
          professionalPayout: true,
          automatic: false,
          configured: true,
          ready: availableProviders.includes("bank-transfer"),
          requiredEnv: []
        },
        {
          key: "zelle",
          label: "Zelle business payout instruction",
          clientFunding: false,
          professionalPayout: true,
          automatic: false,
          configured: true,
          ready: true,
          requiredEnv: []
        },
        {
          key: "cashapp",
          label: "Cash App payout instruction",
          clientFunding: false,
          professionalPayout: true,
          automatic: false,
          configured: true,
          ready: true,
          requiredEnv: []
        }
      ],
      stripe: {
        secretConfigured: stripeSecretConfigured,
        webhookSecretConfigured: stripeWebhookSecretConfigured,
        ready: availableProviders.includes("stripe") && (!productionRuntime || stripeWebhookSecretConfigured)
      },
      paypal: {
        configured: paypalConfigured,
        ready: availableProviders.includes("paypal")
      },
      adyen: {
        configured: adyenConfigured,
        payoutConfigured: adyenPayoutConfigured,
        ready: availableProviders.includes("adyen") && adyenPayoutConfigured
      },
      mode: configuredDefaultProvider === "mock" ? "mock" : "live",
      ready: warnings.length === 0,
      warnings
    };
  }

  async deposit(input: {
    tenantId: string;
    orgId: string;
    userId: string;
    projectId: string;
    roles?: string[];
    contractId?: string;
    amount: number;
    currency?: string;
    provider?: PaymentProviderKey;
    methodType?: PaymentMethodType;
    requestId: string;
  }) {
    if (input.amount <= 0) {
      throw new BadRequestException("deposit amount must be greater than zero");
    }

    const project = await this.paymentsRepository.ensureProject(input);
    const currency = (input.currency ?? "USD").toUpperCase();
    const provider = this.resolveProvider(input.provider);
    const methodType = input.methodType ?? "bank_transfer";
    const paymentProvider = this.paymentProviderRegistry.resolve(provider);

    const fundingIntent = await paymentProvider.createFundingIntent({
      tenantId: input.tenantId,
      projectId: input.projectId,
      provider,
      methodType,
      money: {
        amount: input.amount,
        currency
      },
      externalRef: `deposit_${project.id}_${Date.now()}`
    });

    const { escrow, transaction } = await this.paymentsRepository.depositFunds({
      projectId: input.projectId,
      jobId: project.jobId,
      contractId: input.contractId,
      currency,
      amount: input.amount,
      providerRef: fundingIntent.providerRef
    });

    await this.auditService.append({
      id: `aud_${Date.now()}`,
      tenantId: input.tenantId,
      orgId: input.orgId,
      actorUserId: input.userId,
      action: "escrow.fund",
      entityType: "Escrow",
      entityId: escrow.id,
      requestId: input.requestId,
      timestamp: new Date().toISOString(),
      afterJson: {
        projectId: input.projectId,
        amount: input.amount,
        currency,
        provider,
        methodType,
        providerRef: fundingIntent.providerRef,
        legacyPaymentTxnType: "DEPOSIT",
        visibleEscrowAction: "FUND"
      }
    });

    void this.workspaceMemory.append(buildPaymentWorkspaceMemoryRecord({
      tenantId: input.tenantId,
      orgId: input.orgId,
      userId: input.userId,
      projectId: input.projectId,
      escrowId: escrow.id,
      amount: input.amount,
      currency,
      action: "funded",
    }));

    return {
      escrow,
      transaction,
      fundingIntent
    };
  }

  async depositByJob(input: {
    tenantId: string;
    orgId: string;
    userId: string;
    roles: string[];
    jobId: string;
    amount: number;
    currency?: string;
    provider?: PaymentProviderKey;
    methodType?: PaymentMethodType;
    requestId: string;
  }) {
    const contract = await this.contractsRepository.findCurrentByJob({
      tenantId: input.tenantId,
      orgId: input.orgId,
      userId: input.userId,
      roles: input.roles,
      jobId: input.jobId
    });
    if (!contract) {
      throw new ConflictException("escrow funding requires an active contract");
    }
    if (!contract.signedClientAt || !contract.signedProAt) {
      throw new ConflictException("escrow funding requires a fully signed contract");
    }

    const project = await this.paymentsRepository.ensureProjectByJob(input);
    const result = await this.deposit({
      tenantId: input.tenantId,
      orgId: input.orgId,
      userId: input.userId,
      roles: input.roles,
      projectId: project.id,
      contractId: contract.id,
      amount: input.amount,
      currency: input.currency,
      provider: input.provider,
      methodType: input.methodType,
      requestId: input.requestId
    });

    await this.auditService.append({
      id: `aud_${Date.now()}`,
      tenantId: input.tenantId,
      orgId: input.orgId,
      actorUserId: input.userId,
      action: "escrow.fund.by_job",
      entityType: "Contract",
      entityId: contract.id,
      requestId: input.requestId,
      timestamp: new Date().toISOString(),
      afterJson: {
        jobId: input.jobId,
        projectId: project.id,
        escrowId: result.escrow.id,
        contractId: contract.id,
        amount: input.amount,
        currency: result.escrow.currency
      }
    });

    return {
      ...result,
      contract
    };
  }

  async paymentsByJob(input: {
    tenantId: string;
    orgId: string;
    userId: string;
    roles: string[];
    jobId: string;
  }) {
    const project = await this.paymentsRepository.ensureProjectByJob(input);

    return this.projectsService.payments({
      tenantId: input.tenantId,
      orgId: input.orgId,
      userId: input.userId,
      roles: input.roles,
      projectId: project.id
    });
  }

  async escrowByJob(input: {
    tenantId: string;
    orgId: string;
    userId: string;
    roles: string[];
    jobId: string;
  }) {
    // No project yet means no professional assigned — return null escrow
    const project = await this.paymentsRepository.findProjectByJobOptional({
      jobId: input.jobId,
      tenantId: input.tenantId
    });
    if (!project) return null;

    const contract = await this.contractsRepository.findCurrentByJob({
      tenantId: input.tenantId,
      orgId: input.orgId,
      userId: input.userId,
      roles: input.roles,
      jobId: input.jobId
    });
    const escrowSummary = await this.projectsService.escrow({
      tenantId: input.tenantId,
      orgId: input.orgId,
      userId: input.userId,
      roles: input.roles,
      projectId: project.id
    });

    return {
      ...escrowSummary,
      projectId: project.id,
      contract
    };
  }

  async release(input: {
    tenantId: string;
    orgId: string;
    userId: string;
    roles: string[];
    milestoneId: string;
    amount?: number;
    provider?: PaymentProviderKey;
    methodType?: PaymentMethodType;
    requestId: string;
  }) {
    const milestone = await this.paymentsRepository.ensureMilestone(input);
    const project = await this.paymentsRepository.ensureProject({
      tenantId: input.tenantId,
      orgId: input.orgId,
      userId: input.userId,
      roles: input.roles,
      projectId: milestone.projectId
    });
    const contract = await this.contractsRepository.findCurrentByJob({
      tenantId: input.tenantId,
      orgId: input.orgId,
      userId: input.userId,
      roles: input.roles,
      jobId: project.jobId
    });
    if (!contract) {
      throw new ConflictException("escrow release requires an active contract");
    }
    if (!contract.signedClientAt || !contract.signedProAt) {
      throw new ConflictException("escrow release requires a fully signed contract");
    }

    if (milestone.status !== "APPROVED") {
      throw new ConflictException(`milestone '${milestone.id}' must be approved before release`);
    }

    const amount = input.amount ?? Number(milestone.amount);
    if (amount <= 0) {
      throw new BadRequestException("release amount must be greater than zero");
    }

    const hasOpenDispute = await this.paymentsRepository.hasOpenDisputeForProject(milestone.projectId);
    if (hasOpenDispute) {
      throw new ConflictException("escrow release is blocked while an open dispute exists")
    }

    const escrow = await this.paymentsRepository.findEscrowByProject(milestone.projectId);

    if (!escrow) {
      throw new BadRequestException(`Escrow for project '${milestone.projectId}' not found`);
    }

    const [releasedSoFar, refundedSoFar] = await Promise.all([
      this.paymentsRepository.getReleasedAmount(escrow.id),
      this.paymentsRepository.getRefundedAmount(escrow.id)
    ]);
    const available = Number(escrow.totalAmount) - releasedSoFar - refundedSoFar;
    if (amount > available) {
      throw new ConflictException("insufficient escrow funds for release");
    }

    const provider = this.resolveProvider(input.provider);
    const methodType = input.methodType ?? "payout_bank";
    const paymentProvider = this.paymentProviderRegistry.resolve(provider);
    const recipient = await this.paymentsRepository.findAcceptedProfessionalByProject(milestone.projectId);
    const payoutMethod = recipient
      ? await this.getWorkerPayoutMethod({
          tenantId: input.tenantId,
          orgId: recipient.orgId ?? input.orgId,
          userId: recipient.userId
        })
      : null;

    const payoutIntent = await paymentProvider.createPayoutIntent({
      tenantId: input.tenantId,
      projectId: milestone.projectId,
      milestoneId: milestone.id,
      recipientUserId: recipient?.userId,
      provider,
      methodType,
      money: {
        amount,
        currency: escrow.currency
      },
      externalRef: `release_${milestone.id}_${Date.now()}`,
      metadata: {
        recipientEmail: recipient?.email,
        payoutMethodType: payoutMethod?.type,
        paypalEmail: payoutMethod?.type === "paypal" ? payoutMethod.email : undefined,
        zelleHandle: payoutMethod?.type === "zelle" ? payoutMethod.email : undefined,
        cashAppTag: payoutMethod?.type === "cashapp" ? payoutMethod.email : undefined,
        bankName: payoutMethod?.type === "bank_account" ? payoutMethod.bankName : undefined,
        last4: payoutMethod?.last4
      }
    });

    const transaction = await this.paymentsRepository.releaseFunds({
      escrowId: escrow.id,
      milestoneId: milestone.id,
      amount,
      providerRef: payoutIntent.providerRef
    });

    await this.auditService.append({
      id: `aud_${Date.now()}`,
      tenantId: input.tenantId,
      orgId: input.orgId,
      actorUserId: input.userId,
      action: "escrow.release",
      entityType: "PaymentTxn",
      entityId: transaction.id,
      requestId: input.requestId,
      timestamp: new Date().toISOString(),
      afterJson: {
        milestoneId: milestone.id,
        projectId: milestone.projectId,
        contractId: contract.id,
        amount
      }
    });

    void this.workspaceMemory.append(buildPaymentWorkspaceMemoryRecord({
      tenantId: input.tenantId,
      orgId: input.orgId,
      userId: input.userId,
      projectId: milestone.projectId,
      milestoneId: milestone.id,
      escrowId: escrow.id,
      transactionId: transaction.id,
      amount,
      currency: escrow.currency,
      action: "released",
    }));

    this.sse?.emit(`project:${milestone.projectId}`, "payment.released", {
      milestoneId: milestone.id,
      projectId: milestone.projectId,
      amount,
      currency: escrow.currency,
      transactionId: transaction.id,
    });

    return {
      transaction,
      payoutIntent
    };
  }

  async refund(input: {
    tenantId: string;
    orgId: string;
    userId: string;
    roles: string[];
    projectId?: string;
    escrowId?: string;
    amount: number;
    reason: string;
    provider?: PaymentProviderKey;
    methodType?: PaymentMethodType;
    requestId: string;
  }) {
    if (!input.roles.includes("OPS_ADMIN")) {
      throw new ForbiddenException("escrow refund requires OPS_ADMIN");
    }
    if (!input.projectId && !input.escrowId) {
      throw new BadRequestException("projectId or escrowId is required");
    }
    if (input.amount <= 0) {
      throw new BadRequestException("refund amount must be greater than zero");
    }

    const context = await this.paymentsRepository.getRefundContext(input);
    if (input.amount > context.refundable) {
      throw new ConflictException("insufficient escrow funds for refund");
    }

    const provider = this.resolveProvider(input.provider);
    const methodType = input.methodType ?? "bank_transfer";
    const paymentProvider = this.paymentProviderRegistry.resolve(provider);

    const refundIntent = await paymentProvider.createRefundIntent({
      tenantId: input.tenantId,
      projectId: context.projectId,
      provider,
      methodType,
      money: {
        amount: input.amount,
        currency: context.currency
      },
      externalRef: `refund_${context.escrowId}_${Date.now()}`,
      originalProviderRef: context.originalProviderRef,
      metadata: {
        escrowId: context.escrowId,
        reason: input.reason
      }
    });

    const transaction = await this.paymentsRepository.refundFunds({
      escrowId: context.escrowId,
      amount: input.amount,
      providerRef: refundIntent.providerRef
    });

    const escrowSummary = await this.projectsService.escrow({
      tenantId: input.tenantId,
      orgId: input.orgId,
      userId: input.userId,
      roles: input.roles,
      projectId: context.projectId
    });

    await this.auditService.append({
      id: `aud_${Date.now()}`,
      tenantId: input.tenantId,
      orgId: input.orgId,
      actorUserId: input.userId,
      action: "escrow.refund",
      entityType: "PaymentTxn",
      entityId: transaction.id,
      requestId: input.requestId,
      timestamp: new Date().toISOString(),
      afterJson: {
        projectId: context.projectId,
        escrowId: context.escrowId,
        amount: input.amount,
        currency: context.currency,
        reason: input.reason,
        provider,
        providerRef: refundIntent.providerRef
      }
    });

    void this.workspaceMemory.append(buildPaymentWorkspaceMemoryRecord({
      tenantId: input.tenantId,
      orgId: input.orgId,
      userId: input.userId,
      projectId: context.projectId,
      escrowId: context.escrowId,
      transactionId: transaction.id,
      amount: input.amount,
      currency: context.currency,
      action: "refunded",
    }));

    this.sse?.emit(`project:${context.projectId}`, "payment.refunded", {
      projectId: context.projectId,
      escrowId: context.escrowId,
      amount: input.amount,
      currency: context.currency,
      transactionId: transaction.id,
    });

    return {
      ...escrowSummary,
      transaction,
      refundIntent
    };
  }

  webhook(input: { event?: string; providerRef?: string; requestId: string }) {
    return {
      accepted: true,
      event: input.event ?? "unknown",
      providerRef: input.providerRef ?? "n/a",
      requestId: input.requestId
    };
  }

  private resolveProvider(provider?: PaymentProviderKey): PaymentProviderKey {
    return provider ?? this.resolveConfiguredDefaultProvider();
  }

  private resolveConfiguredDefaultProvider(): PaymentProviderKey {
    const configured = (process.env.PAYMENT_PROVIDER ?? process.env.SEMSE_PAYMENT_PROVIDER ?? "mock").trim();
    if ((paymentProviderKeys as readonly string[]).includes(configured)) {
      return configured as PaymentProviderKey;
    }
    throw new BadRequestException(`unsupported payment provider '${configured}'`);
  }
}
