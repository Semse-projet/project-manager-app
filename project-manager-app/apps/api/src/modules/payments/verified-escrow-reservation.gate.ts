import { ConflictException, Logger } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { assertContractExecutionVerified } from "../contracts/contract-execution-evidence.gate.js";

const logger = new Logger("VerifiedEscrowReservationGate");

/** Shadow is the temporary migration mode. Production CANNOT be considered secure until enforce. */
export type VerifiedEscrowMode = "shadow" | "enforce";
export function resolveVerifiedEscrowMode(env: NodeJS.ProcessEnv = process.env): VerifiedEscrowMode {
  const value = env.SEMSE_VERIFIED_ESCROW_MODE ?? "shadow";
  if (value !== "shadow" && value !== "enforce") {
    throw new Error("SEMSE_VERIFIED_ESCROW_MODE must be shadow or enforce");
  }
  return value;
}

/**
 * Runs INSIDE the existing deposit/release reservation transaction before
 * any provider side effect. Never trusts signedClientAt/signedProAt,
 * caller documentHash/pdfUrl, PENDING_VERIFICATION or provider status alone.
 *
 * No promotion/writer for VerifiedContractExecution is installed. In enforce
 * mode historic payments are blocked until independently verified and
 * explicitly migrated; do not switch production to enforce without canary.
 */
export async function assertVerifiedEscrowReservation(
  tx: Prisma.TransactionClient,
  projectId: string,
  operation: "deposit" | "release",
  env: NodeJS.ProcessEnv = process.env,
): Promise<void> {
  const mode = resolveVerifiedEscrowMode(env);
  try {
    await verifyScopedExecution(tx, projectId);
  } catch (error) {
    if (mode === "shadow") {
      // Do not include identity, document bytes, tokens or evidence references.
      logger.warn(JSON.stringify({
        event: "verified_contract_escrow_shadow_would_block",
        projectId,
        operation,
        reason: "execution_evidence_missing_or_invalid",
      }));
      return;
    }
    // No catches around economic code below: a rejected reservation means no
    // provider transfer/charge is attempted by this command.
    throw error;
  }
}

async function verifyScopedExecution(tx: Prisma.TransactionClient, projectId: string): Promise<void> {
  if (!projectId) throw new ConflictException("escrow requires an authorized project");
  const project = await tx.project.findUnique({
    where: { id: projectId },
    select: {
      tenantId: true,
      job: {
        select: {
          tenantId: true,
          deletedAt: true,
          contract: {
            select: {
              id: true,
              deletedAt: true,
              clientUserId: true,
              professionalUserId: true,
              canonicalPdfSha256: true,
            },
          },
        },
      },
    },
  });
  const contract = project?.job.contract;
  if (!project || project.job.deletedAt || project.job.tenantId !== project.tenantId ||
      !contract || contract.deletedAt || !contract.canonicalPdfSha256) {
    throw new ConflictException("escrow requires a non-legacy, immutable original contract PDF");
  }

  // Row-level SHARE lock: concurrent revocation UPDATE must wait until
  // reservation commits, preventing a proof being revoked mid-reservation.
  // Raw query parameters are Prisma-escaped; table and column names are fixed.
  const locked = await tx.$queryRaw<Array<{ id: string }>>`
    SELECT "id"
    FROM "VerifiedContractExecution"
    WHERE "tenantId" = ${project.tenantId}
      AND "contractId" = ${contract.id}
      AND "documentVersionSha256" = ${contract.canonicalPdfSha256}
      AND "status" = 'VERIFIED_EXECUTED'
    FOR SHARE
  `;
  if (locked.length !== 1) {
    throw new ConflictException("escrow requires a currently verified, non-revoked execution");
  }

  const proof = await tx.verifiedContractExecution.findFirst({
    where: {
      id: locked[0]!.id,
      tenantId: project.tenantId,
      contractId: contract.id,
      documentVersionSha256: contract.canonicalPdfSha256,
      status: "VERIFIED_EXECUTED",
    },
  });
  if (!proof) throw new ConflictException("escrow execution proof unavailable");

  assertContractExecutionVerified({
    tenantId: project.tenantId,
    contractId: contract.id,
    documentVersionSha256: contract.canonicalPdfSha256,
    clientUserId: contract.clientUserId,
    professionalUserId: contract.professionalUserId,
  }, {
    ...proof,
    status: proof.status === "VERIFIED_EXECUTED" ? "VERIFIED_EXECUTED" : "QUARANTINED",
  });
  const hash = /^[a-f0-9]{64}$/;
  if (!hash.test(proof.auditLogSha256) || !proof.auditLogRef ||
      !proof.connectionId || !proof.authorizedPolicyDecisionId ||
      !Number.isFinite(proof.consentVerifiedAt.getTime()) ||
      !Number.isFinite(proof.cryptographicVerifiedAt.getTime()) ||
      proof.consentVerifiedAt > proof.verifiedAt ||
      proof.cryptographicVerifiedAt > proof.verifiedAt) {
    throw new ConflictException("escrow requires a complete consent, cryptographic and audit proof");
  }
}
