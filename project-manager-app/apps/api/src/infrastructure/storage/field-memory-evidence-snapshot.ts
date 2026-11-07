/**
 * T-008i — staging-only, read-only Evidence projection from one PostgreSQL
 * REPEATABLE READ snapshot while the authoritative storage gate is FROZEN.
 *
 * This is NOT an export/restore implementation and is deliberately not wired
 * into any API route or production job. Caller must handle projection records
 * as CONFIDENTIAL: project IDs, tenant IDs and storage keys are private.
 *
 * A transaction-consistent DB projection is NOT itself a consistent cross-DB/FS
 * backup: uninstrumented writers, filesystem changes, checksum provenance and
 * eventual thaw remain independent operator obligations.
 */
import { createHash } from "node:crypto";
import path from "node:path";
import { ServiceUnavailableException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service.js";
import { isProductionStorage } from "./production-storage-guard.js";
import { StorageWriteGateBlockedError } from "./storage-write-gate-state.js";
import { resolveStorageWriteGateScope } from "./storage-write-gate-scope.js";

const MAX_RECORDS = 200000;
const SHA = /^[a-f0-9]{64}$/;
const scopedKey = /^tenants\/([^/]+)\/(?:public-intake\/)?evidence\//;
function tenantOfCanonicalEvidenceKey(key: unknown): string | null {
  if (typeof key !== "string" || key.length > 512 || key.length === 0 ||
      key.startsWith("/") || key.includes("\\") || key.includes("\0") ||
      path.posix.normalize(key) !== key ||
      key.split("/").some(segment => !segment || segment === "." || segment === "..")) {
    return null;
  }
  const match=scopedKey.exec(key);
  if (!match || !match[1] || !key.slice(match[0].length)) return null;
  return match[1];
}

type GateRow = {
  phase: string;
  epoch: bigint;
  coverageDigest: string | null;
};
type OperationCount = {count: bigint};
type FreezeAudit = {id: string};
type EvidenceRow = {
  id: string;
  tenantId: string;
  projectId: string;
  bucketKey: string;
  checksum: string | null;
  projectTenantId: string | null;
};
type CheckpointEnv = NodeJS.ProcessEnv;
export type FrozenEvidenceProjection = {
  status: "DB_PROJECTION_ONLY" | "BLOCKED_INCOMPLETE_EVIDENCE";
  phase: "FROZEN";
  epoch: string;
  scopeDigest: string;
  coverageDigest: string;
  projectionDigest: string;
  databaseTransactionConsistent: true;
  filesystemSnapshotConsistent: false;
  checksumAuthorityVerified: false;
  restoreVerified: false;
  captureSessionActivationPermitted: false;
  recordCount: number;
  violations: {
    missingChecksum: number;
    unsafeOrLegacyKey: number;
    tenantMismatch: number;
    duplicateKey: number;
    missingOrCrossTenantProject: number;
  };
  /** CONFIDENTIAL; never log or expose in an HTTP response. */
  privateProjection: {
    schema: "semse-evidence-backup-projection-v1";
    records: Array<{
      id: string;
      tenantId: string;
      projectId: string;
      bucketKey: string;
      checksum: string | null;
    }>;
  };
};

export async function readFrozenEvidenceProjection(
  prisma: PrismaService,
  input: {scope: string;expectedEpoch: bigint;env?: CheckpointEnv},
): Promise<FrozenEvidenceProjection> {
  const env = input.env ?? process.env;
  // Production project IDs remain forbidden even if an operator accidentally
  // overrides NODE_ENV or the named Railway environment marker.
  if (isProductionStorage(env) ||
      env.RAILWAY_PROJECT_ID === "95ad1b14-d1d9-467d-82d8-5354619ba873" ||
      env.RAILWAY_ENVIRONMENT_ID === "d682210a-956a-4508-9c5b-4ca5959278f9" ||
      env.SEMSE_STORAGE_WRITE_GATE_MODE !== "staging") {
    throw new ServiceUnavailableException("Evidence snapshot requires isolated non-production staging");
  }
  // Environment labels are not an independent authority: this privileged
  // prototype permits only the exact disposable CI database.
  let disposableCiDatabase=false;
  if(env.CI==="true") {
    try {
      const url=new URL(env.DATABASE_URL??"");
      disposableCiDatabase=url.protocol==="postgresql:" &&
        url.hostname==="127.0.0.1" && url.port==="5433" &&
        url.pathname==="/semse" && url.username==="semse";
    } catch { disposableCiDatabase=false; }
  }
  // T-008i phase 1 is CI-only. A Railway environment named "staging" can
  // still point to the PRODUCTION PostgreSQL endpoint if credentials were
  // mistakenly copied. Do not admit any Railway host before an operator-bound
  // and independently verified staging DB identity is implemented.
  if (!disposableCiDatabase || env.RAILWAY_PROJECT_ID ||
      env.RAILWAY_ENVIRONMENT_ID || env.RAILWAY_ENVIRONMENT ||
      env.RAILWAY_ENVIRONMENT_NAME) {
    throw new ServiceUnavailableException("Evidence snapshot requires disposable isolated CI database");
  }
  if (!env.SEMSE_STORAGE_ROOT ||
      input.scope !== resolveStorageWriteGateScope(env) ||
      !/^storage:\/[^\0\\]+$/.test(input.scope) ||
      input.expectedEpoch <= 0n || input.expectedEpoch > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new StorageWriteGateBlockedError("invalid_checkpoint_scope_or_epoch");
  }
  return prisma.$transaction(async (tx) => {
    // FOR SHARE prevents THAW's FOR UPDATE on the same row until this read
    // transaction commits; REPEATABLE READ keeps all Evidence rows coherent.
    const gates=await tx.$queryRaw<GateRow[]>`
      SELECT "phase", "epoch", "coverageDigest"
      FROM "StorageWriteGate"
      WHERE "scope" = ${input.scope}
      FOR SHARE
    `;
    const gate=gates[0];
    if (gates.length !== 1 || gate?.phase !== "FROZEN" ||
        gate.epoch !== input.expectedEpoch ||
        !gate.coverageDigest || !SHA.test(gate.coverageDigest)) {
      throw new StorageWriteGateBlockedError("checkpoint_requires_audited_frozen_gate");
    }
    const active=await tx.$queryRaw<OperationCount[]>`
      SELECT COUNT(*)::bigint AS "count"
      FROM "StorageWriteOperation"
      WHERE "scope" = ${input.scope} AND "state" = 'ACTIVE'
    `;
    if (active.length !== 1 || active[0]?.count !== 0n) {
      throw new StorageWriteGateBlockedError("checkpoint_active_writers");
    }
    const audits=await tx.$queryRaw<FreezeAudit[]>`
      SELECT "id"
      FROM "StorageWriteGateAudit"
      WHERE "scope" = ${input.scope}
        AND "action" = 'MARK_FROZEN'
        AND "phaseAfter" = 'FROZEN'
        AND "epochAfter" = ${input.expectedEpoch}
      LIMIT 1
    `;
    if (audits.length !== 1) {
      throw new StorageWriteGateBlockedError("checkpoint_missing_freeze_audit");
    }
    const rows=await tx.$queryRaw<EvidenceRow[]>`
      SELECT e."id", e."tenantId", e."projectId", e."bucketKey",
             e."checksum", p."tenantId" AS "projectTenantId"
      FROM "Evidence" e
      LEFT JOIN "Project" p ON p."id" = e."projectId"
      ORDER BY e."id"
      LIMIT ${MAX_RECORDS+1}
    `;
    if (rows.length > MAX_RECORDS) {
      throw new StorageWriteGateBlockedError("checkpoint_evidence_limit");
    }
    const violations={
      missingChecksum:0,unsafeOrLegacyKey:0,tenantMismatch:0,
      duplicateKey:0,missingOrCrossTenantProject:0,
    };
    const seenKeys=new Set<string>();
    for(const row of rows) {
      if(!row.checksum || !SHA.test(row.checksum)) violations.missingChecksum++;
      const key=row.bucketKey;
      const tenant=tenantOfCanonicalEvidenceKey(key);
      if(!tenant) violations.unsafeOrLegacyKey++;
      else if(tenant!==row.tenantId) violations.tenantMismatch++;
      if(typeof key!=="string" || seenKeys.has(key)) violations.duplicateKey++;
      else seenKeys.add(key);
      if(!row.projectTenantId || row.projectTenantId!==row.tenantId) {
        violations.missingOrCrossTenantProject++;
      }
    }
    const blocked=rows.length===0 || Object.values(violations).some(n=>n>0);
    const projection={
      schema:"semse-evidence-backup-projection-v1" as const,
      records:rows.map(r=>({
        id:r.id,tenantId:r.tenantId,projectId:r.projectId,
        bucketKey:r.bucketKey,checksum:r.checksum,
      })),
    };
    return {
      status:(blocked?"BLOCKED_INCOMPLETE_EVIDENCE":"DB_PROJECTION_ONLY") as FrozenEvidenceProjection["status"],
      phase:"FROZEN" as const,
      epoch:gate.epoch.toString(),
      scopeDigest:createHash("sha256").update(input.scope).digest("hex"),
      coverageDigest:gate.coverageDigest,
      projectionDigest:createHash("sha256").update(JSON.stringify(projection)).digest("hex"),
      databaseTransactionConsistent:true as const,
      filesystemSnapshotConsistent:false as const,
      checksumAuthorityVerified:false as const,
      restoreVerified:false as const,
      captureSessionActivationPermitted:false as const,
      recordCount:rows.length,
      violations,
      privateProjection:projection,
    };
  },{
    isolationLevel:Prisma.TransactionIsolationLevel.RepeatableRead,
    maxWait:3000,
    timeout:20000,
  });
}
