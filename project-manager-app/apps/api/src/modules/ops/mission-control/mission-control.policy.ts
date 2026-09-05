import { BadRequestException } from "@nestjs/common";
import { createHash } from "node:crypto";
import { z } from "zod";

export const MISSION_CONTROL_ACTIONS = [
  "ACKNOWLEDGE",
  "RESOLVE",
  "DISMISS",
  "PAUSE",
  "RESUME",
  "RETRY",
  "REQUEUE",
  "REPLAY",
  "ESCALATE",
] as const;

export const MISSION_CONTROL_TARGET_TYPES = [
  "OperationalSignal",
  "PermanentLoop",
  "AgentRun",
  "DomainEvent",
  "MissionControlException",
] as const;

export const MISSION_CONTROL_SOURCES = [
  "signal",
  "event",
  "agent_run",
  "approval",
  "loop",
  "incident",
  "service_health",
  "worker_queue",
] as const;

export const MISSION_CONTROL_SEVERITIES = [
  "info",
  "low",
  "medium",
  "high",
  "critical",
] as const;

export const MISSION_CONTROL_STATUSES = [
  "open",
  "acknowledged",
  "failed",
  "dead_letter",
  "pending_approval",
] as const;

export type MissionControlAction = typeof MISSION_CONTROL_ACTIONS[number];
export type MissionControlTargetType = typeof MISSION_CONTROL_TARGET_TYPES[number];
export type MissionControlSource = typeof MISSION_CONTROL_SOURCES[number];
export type MissionControlSeverity = typeof MISSION_CONTROL_SEVERITIES[number];
export type MissionControlStatus = typeof MISSION_CONTROL_STATUSES[number];

export type MissionControlRunbook = {
  id: string;
  version: string;
  title: string;
  allowedActions: MissionControlAction[];
  targetTypes: MissionControlTargetType[];
  documentationPath: string;
  risk: "low" | "medium" | "high" | "critical";
};

export const MISSION_CONTROL_RUNBOOKS: MissionControlRunbook[] = [
  {
    id: "signal-triage-v1",
    version: "1.0",
    title: "Operational signal triage",
    allowedActions: ["ACKNOWLEDGE", "RESOLVE", "DISMISS", "ESCALATE"],
    targetTypes: ["OperationalSignal", "MissionControlException"],
    documentationPath: "docs/runbooks/MISSION_CONTROL_2.md#signal-triage-v1",
    risk: "medium",
  },
  {
    id: "agent-run-recovery-v1",
    version: "1.0",
    title: "Agent run retry and dead-letter recovery",
    allowedActions: ["RETRY", "REQUEUE", "ESCALATE"],
    targetTypes: ["AgentRun", "MissionControlException"],
    documentationPath: "docs/runbooks/MISSION_CONTROL_2.md#agent-run-recovery-v1",
    risk: "high",
  },
  {
    id: "event-delivery-recovery-v1",
    version: "1.0",
    title: "Domain event delivery recovery",
    allowedActions: ["REPLAY", "ESCALATE"],
    targetTypes: ["DomainEvent", "MissionControlException"],
    documentationPath: "docs/runbooks/MISSION_CONTROL_2.md#event-delivery-recovery-v1",
    risk: "high",
  },
  {
    id: "permanent-loop-control-v1",
    version: "1.0",
    title: "Permanent loop pause or resume",
    allowedActions: ["PAUSE", "RESUME", "ESCALATE"],
    targetTypes: ["PermanentLoop", "MissionControlException"],
    documentationPath: "docs/runbooks/MISSION_CONTROL_2.md#permanent-loop-control-v1",
    risk: "critical",
  },
  {
    id: "incident-coordination-v1",
    version: "1.0",
    title: "Human incident coordination and closure",
    allowedActions: ["ESCALATE", "RESOLVE"],
    targetTypes: ["MissionControlException"],
    documentationPath: "docs/runbooks/MISSION_CONTROL_2.md#incident-coordination-v1",
    risk: "high",
  },
  {
    id: "service-health-diagnosis-v1",
    version: "1.0",
    title: "Service health diagnosis",
    allowedActions: ["ESCALATE"],
    targetTypes: ["MissionControlException"],
    documentationPath: "docs/runbooks/MISSION_CONTROL_2.md#service-health-diagnosis-v1",
    risk: "medium",
  },
];

const actionSchema = z.enum(MISSION_CONTROL_ACTIONS);
const targetTypeSchema = z.enum(MISSION_CONTROL_TARGET_TYPES);

export const missionControlActionSchema = z.object({
  action: actionSchema,
  targetType: targetTypeSchema,
  targetId: z.string().trim().min(1).max(255),
  reason: z.string().trim().min(10).max(500),
  runbookId: z.string().trim().min(1).max(128),
  idempotencyKey: z.string().trim().min(8).max(128),
  dryRun: z.boolean().default(false),
  options: z.object({
    consumerName: z.string().trim().min(1).max(255).optional(),
  }).strict().default({}),
}).strict();

export const missionControlExceptionsQuerySchema = z.object({
  status: z.enum(MISSION_CONTROL_STATUSES).optional(),
  source: z.enum(MISSION_CONTROL_SOURCES).optional(),
  severity: z.enum(MISSION_CONTROL_SEVERITIES).optional(),
  cursor: z.string().trim().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
}).strict();

export type MissionControlActionInput = z.infer<typeof missionControlActionSchema>;
export type MissionControlExceptionsQuery = z.infer<typeof missionControlExceptionsQuerySchema>;

function formatZodIssues(error: z.ZodError): Record<string, unknown> {
  return {
    code: "MISSION_CONTROL_INVALID_REQUEST",
    message: "Mission Control request validation failed",
    issues: error.issues.map((issue) => ({
      path: issue.path.join("."),
      message: issue.message,
    })),
  };
}

export function parseMissionControlAction(value: unknown): MissionControlActionInput {
  const parsed = missionControlActionSchema.safeParse(value);
  if (!parsed.success) {
    throw new BadRequestException(formatZodIssues(parsed.error));
  }
  return parsed.data;
}

export function parseMissionControlExceptionsQuery(value: unknown): MissionControlExceptionsQuery {
  const parsed = missionControlExceptionsQuerySchema.safeParse(value);
  if (!parsed.success) {
    throw new BadRequestException(formatZodIssues(parsed.error));
  }
  return parsed.data;
}

export function isMissionControlV2Enabled(
  tenantId: string,
  environment: Record<string, string | undefined> = process.env,
): boolean {
  if (environment.SEMSE_MISSION_CONTROL_V2_ENABLED === "true") {
    return true;
  }
  const allowlist = new Set(
    (environment.SEMSE_MISSION_CONTROL_V2_CANARY_TENANT_IDS ?? "")
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean),
  );
  return allowlist.has(tenantId);
}

export function assertActionAllowedByRunbook(
  runbookId: string,
  action: MissionControlAction,
  targetType: MissionControlTargetType,
): MissionControlRunbook {
  const runbook = MISSION_CONTROL_RUNBOOKS.find((candidate) => candidate.id === runbookId);
  if (!runbook) {
    throw new BadRequestException({
      code: "MISSION_CONTROL_RUNBOOK_NOT_FOUND",
      message: "The requested runbook is not in the approved catalog",
    });
  }
  if (!runbook.allowedActions.includes(action) || !runbook.targetTypes.includes(targetType)) {
    throw new BadRequestException({
      code: "MISSION_CONTROL_RUNBOOK_POLICY_DENIED",
      message: "The runbook does not allow this action and target type",
    });
  }
  return runbook;
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(canonicalize);
  }
  if (typeof value === "object" && value !== null) {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, nested]) => [key, canonicalize(nested)]),
    );
  }
  return value;
}

export function hashMissionControlIntent(value: Record<string, unknown>): string {
  return createHash("sha256")
    .update(JSON.stringify(canonicalize(value)))
    .digest("hex");
}

export function encodeMissionControlCursor(offset: number): string {
  return Buffer.from(JSON.stringify({ v: 1, offset }), "utf8").toString("base64url");
}

export function decodeMissionControlCursor(cursor: string | undefined): number {
  if (!cursor) {
    return 0;
  }
  try {
    const parsed = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")) as {
      v?: unknown;
      offset?: unknown;
    };
    if (parsed.v !== 1 || !Number.isInteger(parsed.offset) || Number(parsed.offset) < 0) {
      throw new Error("invalid cursor");
    }
    return Number(parsed.offset);
  } catch {
    throw new BadRequestException({
      code: "MISSION_CONTROL_INVALID_CURSOR",
      message: "The exceptions cursor is invalid",
    });
  }
}
