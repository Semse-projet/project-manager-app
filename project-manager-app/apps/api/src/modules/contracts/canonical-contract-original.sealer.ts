import { createHash } from "node:crypto";
import { ConflictException } from "@nestjs/common";
import prismaPackage from "@prisma/client";
import type { PrismaService } from "../../infrastructure/prisma/prisma.service.js";
import type { EvidenceArtifactStore } from "./signature-evidence-capture.js";
import { renderCanonicalContractPdf, type OriginalContractPdfInput } from "./canonical-contract-pdf.js";

const { Prisma } = prismaPackage as typeof import("@prisma/client");
const HEX64 = /^[a-f0-9]{64}$/;

/**
 * Internal-only original sealing; no controller, webhook, or automatic
 * historical backfill. Must be invoked before a provider envelope is sent.
 * Legacy signed timestamps, an existing seal or ANY provider dispatch block.
 *
 * Documents are generated from persisted tenant-scoped terms, never from
 * pdfUrl/documentHash submitted by a caller. The PDF is atomically linked into
 * dedicated private storage, then an independent DB transaction freezes its
 * digest and reference with an audit row. DB failures leave safe orphans.
 */
export class CanonicalContractOriginalSealer {
  constructor(
    private readonly prisma: PrismaService,
    private readonly artifacts: EvidenceArtifactStore,
    private readonly render: (input: OriginalContractPdfInput) => Promise<Uint8Array> =
      renderCanonicalContractPdf,
  ) {}

  async seal(input: { tenantId: string; contractId: string; actorUserId: string }): Promise<{
    contractId: string;
    sha256: string;
    privateRef: string;
  }> {
    if (!input.tenantId || !input.contractId || !input.actorUserId) {
      throw new ConflictException("authenticated contract seal scope required");
    }
    const selection = {
      id: true, jobId: true, updatedAt: true,
      termsJson: true, signedClientAt: true, signedProAt: true,
      canonicalPdfSha256: true, canonicalPdfRef: true,
      clientUserId: true, professionalUserId: true,
      clientUser: { select: { email: true } },
      professionalUser: { select: { email: true } },
      job: { select: { tenantId: true } },
    } as const;
    const where = {
      id: input.contractId, deletedAt: null,
      job: { tenantId: input.tenantId, deletedAt: null },
    } as const;
    const snapshot = await this.prisma.contract.findFirst({ where, select: selection });
    if (!snapshot || snapshot.signedClientAt || snapshot.signedProAt ||
        snapshot.canonicalPdfSha256 || snapshot.canonicalPdfRef ||
        !snapshot.clientUser?.email || !snapshot.professionalUser?.email ||
        snapshot.clientUserId === snapshot.professionalUserId ||
        input.actorUserId !== snapshot.clientUserId) {
      throw new ConflictException("cannot seal missing, legacy-signed or already sealed contract");
    }
    const original = await this.render({
      tenantId: input.tenantId,
      contractId: snapshot.id, jobId: snapshot.jobId,
      clientUserId: snapshot.clientUserId,
      professionalUserId: snapshot.professionalUserId,
      clientEmail: snapshot.clientUser.email,
      professionalEmail: snapshot.professionalUser.email,
      termsJson: snapshot.termsJson,
    });
    if (!(original instanceof Uint8Array) || original.length < 8 ||
        Buffer.from(original.subarray(0, 5)).toString("ascii") !== "%PDF-") {
      throw new ConflictException("server renderer did not produce a canonical PDF");
    }
    const sha256 = createHash("sha256").update(original).digest("hex");
    if (!HEX64.test(sha256)) throw new Error("canonical PDF hashing failed");
    const privateRef = await this.artifacts.putImmutable({
      tenantId: input.tenantId, contractId: input.contractId,
      kind: "ORIGINAL_PDF", sha256, content: original,
      mimeType: "application/pdf",
    });
    if (!privateRef.startsWith("private-signatures/") ||
        !privateRef.endsWith(`/ORIGINAL_PDF/${sha256}`)) {
      throw new ConflictException("original PDF was not stored on dedicated private immutable storage");
    }
    return this.prisma.$transaction(async tx => {
      // Serialize competing seal/contract edits. Any successful provider
      // dispatch from before this lock also blocks the operation.
      const locked = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT "id" FROM "Contract" WHERE "id" = ${input.contractId} FOR UPDATE
      `;
      if (locked.length !== 1) throw new ConflictException("contract row lock unavailable");
      const fresh = await tx.contract.findFirst({ where, select: selection });
      if (!fresh || fresh.signedClientAt || fresh.signedProAt ||
          fresh.canonicalPdfSha256 || fresh.canonicalPdfRef ||
          fresh.updatedAt.getTime() !== snapshot.updatedAt.getTime() ||
          fresh.clientUserId !== snapshot.clientUserId ||
          fresh.professionalUserId !== snapshot.professionalUserId) {
        throw new ConflictException("contract changed while generating original PDF");
      }
      const dispatch = await tx.signatureDispatchOutbox.findFirst({
        where: { tenantId: input.tenantId, contractId: input.contractId },
        select: { id: true },
      });
      if (dispatch) throw new ConflictException("original cannot be sealed after any signature dispatch");
      const updated = await tx.contract.updateMany({
        where: {
          id: input.contractId, updatedAt: snapshot.updatedAt,
          canonicalPdfSha256: null, canonicalPdfRef: null,
          signedClientAt: null, signedProAt: null,
          job: { tenantId: input.tenantId, deletedAt: null },
        },
        data: { canonicalPdfSha256: sha256, canonicalPdfRef: privateRef },
      });
      if (updated.count !== 1) throw new ConflictException("concurrent contract seal or modification");
      await tx.auditLog.create({
        data: {
          tenantId: input.tenantId, actorUserId: input.actorUserId,
          entityType: "Contract", entityId: input.contractId,
          action: "contract.original_pdf_sealed",
          afterJson: {
            sha256, source: "server-rendered", evidenceKind: "ORIGINAL_PDF",
            providerVerified: false, signerConsentVerified: false,
          },
        },
      });
      return { contractId: input.contractId, sha256, privateRef };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }
}
