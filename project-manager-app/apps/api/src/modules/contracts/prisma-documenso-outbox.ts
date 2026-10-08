import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../infrastructure/prisma/prisma.service.js";
import type { DocumensoOutbox, SignatureRequestKey } from "./documenso-signature.provider.js";

type LinkedRequest = SignatureRequestKey & { externalRequestId: string };

/**
 * Database-backed checkpoints for the Documenso signing adapter.
 *
 * The unique reservation constraint is the concurrency gate, not a preflight
 * read. This implementation deliberately refuses replays rather than retrying
 * a potentially successful external POST.
 *
 * No provider writes happen in this class; authorization is a separate
 * server-owned Policy/Approval obligation before invoking an adapter.
 */
@Injectable()
export class PrismaDocumensoOutbox implements DocumensoOutbox {
  private readonly providerId = "documenso";

  constructor(private readonly prisma: PrismaService) {}

  async reserve(key: SignatureRequestKey): Promise<void> {
    this.assertKey(key);
    // Contract ownership is checked against the canonical job/tenant relation,
    // not against caller-provided tenantId alone.
    const contract = await this.prisma.contract.findFirst({
      where: {
        id: key.contractId,
        deletedAt: null,
        job: { tenantId: key.tenantId, deletedAt: null },
      },
      select: { id: true },
    });
    if (!contract) throw new NotFoundException("Signature contract not found in tenant");
    try {
      await this.prisma.signatureDispatchOutbox.create({
        data: {
          tenantId: key.tenantId,
          connectionId: key.connectionId,
          contractId: key.contractId,
          providerId: this.providerId,
          idempotencyKey: key.idempotencyKey,
          requestFingerprint: key.requestFingerprint,
          status: "RESERVED",
        },
      });
    } catch (error: unknown) {
      if (error && typeof error === "object" && "code" in error && error.code === "P2002") {
        // Includes same-key/same-payload replays: callers must reconcile and
        // never silently dispatch a second signing invitation.
        throw new ConflictException("Signature request already reserved: reconcile before retry");
      }
      throw error;
    }
  }

  async created(key: LinkedRequest): Promise<void> {
    this.assertKey(key);
    this.assertExternalId(key.externalRequestId);
    const update = await this.prisma.signatureDispatchOutbox.updateMany({
      where: {
        ...this.scope(key),
        requestFingerprint: key.requestFingerprint,
        status: "RESERVED",
        externalRequestId: null,
      },
      data: { status: "CREATED", externalRequestId: key.externalRequestId },
    });
    if (update.count !== 1) {
      throw new ConflictException("Signature draft checkpoint conflict: reconcile before distribution");
    }
  }

  async sent(key: LinkedRequest): Promise<void> {
    this.assertKey(key);
    this.assertExternalId(key.externalRequestId);
    const update = await this.prisma.signatureDispatchOutbox.updateMany({
      where: {
        ...this.scope(key),
        requestFingerprint: key.requestFingerprint,
        externalRequestId: key.externalRequestId,
        status: "CREATED",
      },
      data: { status: "SENT" },
    });
    if (update.count !== 1) {
      throw new ConflictException("Signature distribution checkpoint conflict: reconcile");
    }
  }

  async assertOwned(key: {
    tenantId: string; connectionId: string; contractId: string; externalRequestId: string;
  }): Promise<void> {
    this.assertExternalId(key.externalRequestId);
    if (!key.tenantId || !key.connectionId || !key.contractId) {
      throw new NotFoundException("Signature request not found");
    }
    const row = await this.prisma.signatureDispatchOutbox.findFirst({
      where: {
        tenantId: key.tenantId,
        connectionId: key.connectionId,
        contractId: key.contractId,
        providerId: this.providerId,
        externalRequestId: key.externalRequestId,
        status: { in: ["CREATED", "SENT"] },
      },
      select: { id: true },
    });
    if (!row) throw new NotFoundException("Signature request not owned by context");
  }

  private scope(key: SignatureRequestKey) {
    return {
      tenantId: key.tenantId,
      connectionId: key.connectionId,
      contractId: key.contractId,
      providerId: this.providerId,
      idempotencyKey: key.idempotencyKey,
    };
  }

  private assertKey(key: SignatureRequestKey): void {
    if (!key.tenantId || !key.connectionId || !key.contractId ||
        !key.idempotencyKey || !/^[a-f0-9]{64}$/.test(key.requestFingerprint)) {
      throw new Error("Signature outbox missing valid tenant, connection or request fingerprint");
    }
  }

  private assertExternalId(externalId: string): void {
    if (!/^envelope_[a-zA-Z0-9_-]{3,128}$/.test(externalId)) {
      throw new Error("Invalid Documenso envelope identifier");
    }
  }
}
