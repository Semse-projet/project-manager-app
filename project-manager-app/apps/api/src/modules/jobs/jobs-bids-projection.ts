import { createHash } from "node:crypto";

type Environment = Record<string, string | undefined>;

export type JobsBidsProjectionInput = {
  job: {
    id: string;
    tenantId: string;
    clientOrgId: string;
    title: string;
    status: string;
    updatedAt: Date;
  };
  bids: Array<{
    id: string;
    proOrgId: string;
    professionalUserId: string;
    amount: number;
    etaDays: number;
    status: string;
    updatedAt: Date;
  }>;
  now?: Date;
};

export type JobsBidsProjectionSnapshot = {
  schemaVersion: 1;
  revision: string;
  generatedAt: string;
  sourceUpdatedAt: string;
  job: {
    id: string;
    tenantId: string;
    clientOrgId: string;
    title: string;
    status: string;
    updatedAt: string;
  };
  bids: {
    total: number;
    submitted: number;
    accepted: number;
    rejected: number;
  };
  acceptedBid: {
    id: string;
    proOrgId: string;
    professionalUserId: string;
    amount: number;
    etaDays: number;
  } | null;
};

export function isJobsBidsProjectionEnabled(
  tenantId: string,
  environment: Environment = process.env,
): boolean {
  if (environment.SEMSE_JOBS_PROJECTION_ENABLED !== "true") {
    return false;
  }
  const allowlist = parseAllowlist(environment.SEMSE_JOBS_PROJECTION_CANARY_TENANT_IDS);
  return allowlist.has("*") || allowlist.has(tenantId);
}

export function isJobsBidsProjectionPersistenceEnabled(
  environment: Environment = process.env,
): boolean {
  return environment.SEMSE_JOBS_PROJECTION_PERSIST_ENABLED === "true";
}

export function isJobsBidsProjectionReadthroughEnabled(
  environment: Environment = process.env,
): boolean {
  return environment.SEMSE_JOBS_PROJECTION_READTHROUGH_ENABLED === "true";
}

export type JobReadthroughSample = {
  id: string;
  title: string;
  status: string;
};

export type JobReadthroughMismatch =
  | { id: string; kind: "missing_in_projection" }
  | { id: string; kind: "missing_in_direct" }
  | {
      id: string;
      kind: "field";
      field: "title" | "status";
      projection: string;
      direct: string;
    };

/**
 * Sample comparison for the jobs/bids read-through canary.
 * The runtime trusts a caught-up projection by row count; it does not
 * compare field values on the request path. This helper is the check the
 * owner runs (and CI locks) before `SEMSE_JOBS_PROJECTION_READTHROUGH_ENABLED`.
 * Ids must be unique within each sample.
 */
export function diffJobReadthroughSamples(
  projection: readonly JobReadthroughSample[],
  direct: readonly JobReadthroughSample[],
): JobReadthroughMismatch[] {
  const projectionById = new Map(projection.map((row) => [row.id, row]));
  const directById = new Map(direct.map((row) => [row.id, row]));
  const ids = [...new Set([...projectionById.keys(), ...directById.keys()])].sort();
  const mismatches: JobReadthroughMismatch[] = [];
  for (const id of ids) {
    const projected = projectionById.get(id);
    const live = directById.get(id);
    if (!projected) {
      mismatches.push({ id, kind: "missing_in_projection" });
      continue;
    }
    if (!live) {
      mismatches.push({ id, kind: "missing_in_direct" });
      continue;
    }
    if (projected.title !== live.title) {
      mismatches.push({
        id,
        kind: "field",
        field: "title",
        projection: projected.title,
        direct: live.title,
      });
    }
    if (projected.status !== live.status) {
      mismatches.push({
        id,
        kind: "field",
        field: "status",
        projection: projected.status,
        direct: live.status,
      });
    }
  }
  return mismatches;
}

export function buildJobsBidsProjection(
  input: JobsBidsProjectionInput,
): JobsBidsProjectionSnapshot {
  const now = input.now ?? new Date();
  const bids = [...input.bids].sort(byId);
  const submitted = bids.filter((bid) => bid.status === "SUBMITTED").length;
  const accepted = bids.filter((bid) => bid.status === "ACCEPTED");
  const rejected = bids.filter((bid) => bid.status === "REJECTED").length;
  const acceptedBid = accepted[0] ?? null;

  const sourceUpdatedAt = latestDate([
    input.job.updatedAt,
    ...bids.map((bid) => bid.updatedAt),
  ]);
  const revision = `jobs-bids.v1:${createHash("sha256")
    .update(stableStringify({ schemaVersion: 1, job: input.job, bids }))
    .digest("hex")}`;

  return {
    schemaVersion: 1,
    revision,
    generatedAt: now.toISOString(),
    sourceUpdatedAt: sourceUpdatedAt.toISOString(),
    job: {
      id: input.job.id,
      tenantId: input.job.tenantId,
      clientOrgId: input.job.clientOrgId,
      title: input.job.title,
      status: input.job.status,
      updatedAt: input.job.updatedAt.toISOString(),
    },
    bids: {
      total: bids.length,
      submitted,
      accepted: accepted.length,
      rejected,
    },
    acceptedBid: acceptedBid
      ? {
          id: acceptedBid.id,
          proOrgId: acceptedBid.proOrgId,
          professionalUserId: acceptedBid.professionalUserId,
          amount: acceptedBid.amount,
          etaDays: acceptedBid.etaDays,
        }
      : null,
  };
}

function parseAllowlist(raw: string | undefined): Set<string> {
  return new Set(
    (raw ?? "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean),
  );
}

function latestDate(values: Array<Date | null | undefined>): Date {
  const valid = values.filter((value): value is Date => value instanceof Date);
  return valid.sort((left, right) => right.getTime() - left.getTime())[0] ?? new Date(0);
}

function stableStringify(value: unknown): string {
  return JSON.stringify(normalizeForHash(value));
}

function normalizeForHash(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(normalizeForHash);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, normalizeForHash(item)]),
    );
  }
  return value;
}

function byId<T extends { id: string }>(left: T, right: T): number {
  return left.id.localeCompare(right.id);
}
