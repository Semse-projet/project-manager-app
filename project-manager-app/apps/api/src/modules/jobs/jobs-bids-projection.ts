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
