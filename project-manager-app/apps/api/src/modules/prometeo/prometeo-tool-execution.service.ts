import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException, Optional } from "@nestjs/common";
import {
  calculateMaterials,
  MaterialsCalculatorError,
} from "@semse/tools";
import type {
  PrometeoToolDescriptor,
  PrometeoToolExecutionResult,
  PrometeoToolInvokeInput,
} from "@semse/schemas";
import { randomUUID } from "node:crypto";
import { normalizeRoles } from "../../common/rbac.js";
import type { RequestContext } from "../../common/request-context.js";
import { AgroAnimalService } from "../agro/agro-animal.service.js";
import { AgroDashboardService } from "../agro/agro-dashboard.service.js";
import { AgroFarmService } from "../agro/agro-farm.service.js";
import { AgroInventoryService } from "../agro/agro-inventory.service.js";
import { AgroTaskService } from "../agro/agro-task.service.js";
import { FieldOpsService } from "../field-ops/field-ops.service.js";
import { PaymentsService } from "../payments/payments.service.js";
import { VisionService } from "../vision/vision.service.js";
import { findPrometeoToolDescriptor } from "./prometeo-tool-registry.js";
import { evaluatePrometeoToolPolicy } from "./tool-governance/tool-governance.policy.js";
import { ToolGovernanceRepository, type ProposedActionRecord } from "./tool-governance/tool-governance.repository.js";

const TRACKER_RANGES = ["week", "month", "all"] as const;
const TRACKER_SUMMARY_RANGES = ["week", "month"] as const;
const TRACKER_STATUSES = ["RUNNING", "PAUSED", "STOPPED"] as const;

type TrackerRange = (typeof TRACKER_RANGES)[number];
type TrackerSummaryRange = (typeof TRACKER_SUMMARY_RANGES)[number];
type TrackerStatus = (typeof TRACKER_STATUSES)[number];

function nowIso() {
  return new Date().toISOString();
}

function extractBlockedReason(output: unknown): string | null {
  if (typeof output === "object" && output !== null && "__blockedReason" in output) {
    return String((output as { __blockedReason: unknown }).__blockedReason);
  }
  return null;
}

function requiredString(input: Record<string, unknown>, key: string): string {
  const value = input[key];
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new BadRequestException(`${key} is required`);
  }
  return value.trim();
}

function optionalString(input: Record<string, unknown>, key: string): string | undefined {
  const value = input[key];
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function optionalNumber(input: Record<string, unknown>, key: string): number | undefined {
  const value = input[key];
  if (value === undefined || value === null || value === "") return undefined;
  const numberValue = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numberValue)) {
    throw new BadRequestException(`${key} must be a number`);
  }
  return numberValue;
}

function optionalInteger(input: Record<string, unknown>, key: string, min: number, max: number): number | undefined {
  const value = input[key];
  if (value === undefined || value === null || value === "") return undefined;
  const numberValue = typeof value === "number" ? value : Number.parseInt(String(value), 10);
  if (!Number.isFinite(numberValue)) {
    throw new BadRequestException(`${key} must be a number`);
  }
  return Math.min(Math.max(Math.trunc(numberValue), min), max);
}

function optionalBoolean(input: Record<string, unknown>, key: string): boolean | undefined {
  const value = input[key];
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value === "boolean") return value;
  if (value === "true") return true;
  if (value === "false") return false;
  throw new BadRequestException(`${key} must be a boolean`);
}

function optionalEnum<T extends string>(
  input: Record<string, unknown>,
  key: string,
  values: readonly T[],
  fallback: T,
): T {
  const value = optionalString(input, key);
  if (!value) return fallback;
  if (!values.includes(value as T)) {
    throw new BadRequestException(`${key} must be one of: ${values.join(", ")}`);
  }
  return value as T;
}

@Injectable()
export class PrometeoToolExecutionService {
  constructor(
    private readonly fieldOps: FieldOpsService,
    private readonly agroFarms: AgroFarmService,
    private readonly agroAnimals: AgroAnimalService,
    private readonly agroTasks: AgroTaskService,
    private readonly agroInventory: AgroInventoryService,
    private readonly agroDashboard: AgroDashboardService,
    private readonly vision: VisionService,
    @Optional() private readonly toolGovernance?: ToolGovernanceRepository,
    @Optional() private readonly payments?: PaymentsService,
  ) {}

  async invokeReadTool(
    actor: RequestContext,
    requestId: string,
    invocation: PrometeoToolInvokeInput,
  ): Promise<PrometeoToolExecutionResult> {
    const descriptor = findPrometeoToolDescriptor(invocation.namespace, invocation.name);
    if (!descriptor) {
      throw new BadRequestException(`Unknown Prometeo tool: ${invocation.namespace}.${invocation.name}`);
    }
    if (descriptor.mode !== "read") {
      throw new BadRequestException(`Prometeo P1 can only invoke read tools. ${descriptor.namespace}.${descriptor.name} is ${descriptor.mode}.`);
    }

    const policy = evaluatePrometeoToolPolicy({ actorRoles: actor.roles, descriptor });
    if (policy.decision === "deny") {
      await this.toolGovernance?.recordInvocation({
        tenantId: actor.tenantId,
        actorId: actor.userId,
        namespace: descriptor.namespace,
        name: descriptor.name,
        mode: descriptor.mode,
        status: "blocked",
        blockedReason: `missing permissions: ${policy.missingPermissions.join(", ")}`,
        requestId,
      });
      throw new ForbiddenException({
        message: `Missing permission for ${descriptor.namespace}.${descriptor.name}`,
        namespace: descriptor.namespace,
        tool: descriptor.name,
        missingPermissions: policy.missingPermissions,
      });
    }

    const startedAt = nowIso();
    const id = `exec_${randomUUID()}`;
    const output = await this.executeReadTool(actor, invocation);
    const completedAt = nowIso();
    const blockedReason = typeof output === "object" && output !== null && "__blockedReason" in output
      ? String((output as { __blockedReason: unknown }).__blockedReason)
      : null;

    if (blockedReason) {
      await this.toolGovernance?.recordInvocation({
        tenantId: actor.tenantId,
        actorId: actor.userId,
        namespace: descriptor.namespace,
        name: descriptor.name,
        mode: descriptor.mode,
        status: "blocked",
        blockedReason,
        requestId,
      });
      return {
        id,
        namespace: descriptor.namespace,
        tool: descriptor.name,
        status: "blocked",
        errorMessage: blockedReason,
        auditRef: `prometeo-tool:${requestId}:${id}`,
        startedAt,
        completedAt,
      };
    }

    await this.toolGovernance?.recordInvocation({
      tenantId: actor.tenantId,
      actorId: actor.userId,
      namespace: descriptor.namespace,
      name: descriptor.name,
      mode: descriptor.mode,
      status: "succeeded",
      requestId,
    });

    return {
      id,
      namespace: descriptor.namespace,
      tool: descriptor.name,
      status: "succeeded",
      output: {
        outputKind: descriptor.outputKind,
        data: output,
      },
      auditRef: `prometeo-tool:${requestId}:${id}`,
      startedAt,
      completedAt,
    };
  }

  async invokeWriteTool(
    actor: RequestContext,
    requestId: string,
    invocation: PrometeoToolInvokeInput,
  ): Promise<PrometeoToolExecutionResult> {
    const descriptor = findPrometeoToolDescriptor(invocation.namespace, invocation.name);
    if (!descriptor) {
      throw new BadRequestException(`Unknown Prometeo tool: ${invocation.namespace}.${invocation.name}`);
    }
    if (descriptor.mode === "read") {
      throw new BadRequestException(`${descriptor.namespace}.${descriptor.name} is a read tool. Use invokeReadTool.`);
    }

    const policy = evaluatePrometeoToolPolicy({ actorRoles: actor.roles, descriptor });
    if (policy.decision === "deny") {
      await this.toolGovernance?.recordInvocation({
        tenantId: actor.tenantId,
        actorId: actor.userId,
        namespace: descriptor.namespace,
        name: descriptor.name,
        mode: descriptor.mode,
        status: "blocked",
        blockedReason: `missing permissions: ${policy.missingPermissions.join(", ")}`,
        requestId,
      });
      throw new ForbiddenException({
        message: `Missing permission for ${descriptor.namespace}.${descriptor.name}`,
        namespace: descriptor.namespace,
        tool: descriptor.name,
        missingPermissions: policy.missingPermissions,
      });
    }

    const startedAt = nowIso();
    const id = `exec_${randomUUID()}`;

    if (policy.decision === "allow") {
      const output = await this.executeWriteEffect(
        { tenantId: actor.tenantId, orgId: actor.orgId, userId: actor.userId, roles: actor.roles },
        invocation,
        requestId,
      );
      const result = this.finishWriteExecution({ id, requestId, startedAt, descriptor, output });
      await this.toolGovernance?.recordInvocation({
        tenantId: actor.tenantId,
        actorId: actor.userId,
        namespace: descriptor.namespace,
        name: descriptor.name,
        mode: descriptor.mode,
        status: result.status,
        blockedReason: result.status === "blocked" ? result.errorMessage : undefined,
        requestId,
      });
      return result;
    }

    // require_approval: the effect does not run yet — it is deferred until a
    // human (or the proposing actor, for approvalPolicy "confirm") approves it.
    if (!this.toolGovernance) {
      throw new BadRequestException("Prometeo write-tool approvals are not available in this deployment.");
    }

    const action = await this.toolGovernance.createProposedAction({
      tenantId: actor.tenantId,
      orgId: actor.orgId,
      actorId: actor.userId,
      namespace: descriptor.namespace,
      name: descriptor.name,
      approvalPolicy: descriptor.approvalPolicy,
      inputJson: invocation.input ?? {},
      requiredApprovals: descriptor.approvalPolicy === "confirm" ? [actor.userId] : ["OPS_ADMIN"],
    });

    await this.toolGovernance.recordInvocation({
      tenantId: actor.tenantId,
      actorId: actor.userId,
      namespace: descriptor.namespace,
      name: descriptor.name,
      mode: descriptor.mode,
      status: "queued",
      requestId,
    });

    return {
      id,
      actionId: action.id,
      namespace: descriptor.namespace,
      tool: descriptor.name,
      status: "queued",
      auditRef: `prometeo-tool:${requestId}:${id}`,
      startedAt,
      completedAt: nowIso(),
    };
  }

  async approveProposedAction(
    actor: RequestContext,
    requestId: string,
    actionId: string,
  ): Promise<PrometeoToolExecutionResult> {
    if (!this.toolGovernance) {
      throw new BadRequestException("Prometeo write-tool approvals are not available in this deployment.");
    }

    const action = await this.toolGovernance.findProposedAction({ tenantId: actor.tenantId, id: actionId });
    if (!action) {
      throw new NotFoundException(`Proposed action not found: ${actionId}`);
    }
    this.assertCanDecide(actor, action);

    const won = await this.toolGovernance.transitionProposedAction({
      tenantId: actor.tenantId,
      id: actionId,
      fromStatuses: ["PROPOSED", "AWAITING_APPROVAL"],
      toStatus: "APPROVED",
      patch: { approvedBy: actor.userId, approvedAt: new Date() },
    });
    if (!won) {
      throw new ConflictException(`Proposed action ${actionId} is no longer awaiting approval.`);
    }

    const startedAt = nowIso();
    const id = `exec_${randomUUID()}`;
    const descriptor = findPrometeoToolDescriptor(action.namespace, action.name);

    // For self-service policies ("confirm") the effect runs as the proposer —
    // it's their own timer/task. For human_required/dual_approval, the effect
    // runs as the approving actor: their authority is what makes it happen,
    // and the audit trail should show who actually pulled the trigger
    // (matters for payments — see PaymentsService.release()'s own auditService.append).
    const runsAsApprover = action.approvalPolicy === "human_required" || action.approvalPolicy === "dual_approval";
    const effectActor = runsAsApprover
      ? { tenantId: actor.tenantId, orgId: actor.orgId, userId: actor.userId, roles: actor.roles }
      : { tenantId: action.tenantId, orgId: action.orgId, userId: action.actorId };

    let output: unknown;
    let executionError: unknown;
    try {
      output = await this.executeWriteEffect(
        effectActor,
        { namespace: action.namespace, name: action.name, input: action.inputJson },
        requestId,
      );
    } catch (error) {
      executionError = error;
    }
    const completedAt = nowIso();

    // The effect threw (e.g. PaymentsService.release() rejecting because the
    // milestone's invariants no longer hold) rather than returning the
    // __blockedReason sentinel. Finalize to a terminal state — never leave the
    // action stuck APPROVED-but-unfinished — and let the real exception (with
    // its real HTTP status) surface instead of masking it as a generic 200 blocked result.
    if (executionError) {
      const message = executionError instanceof Error ? executionError.message : String(executionError);
      await this.toolGovernance.finalizeProposedAction({
        id: actionId,
        status: "BLOCKED",
        resultJson: { error: message },
      });
      await this.toolGovernance.recordInvocation({
        tenantId: action.tenantId,
        actorId: actor.userId,
        namespace: action.namespace,
        name: action.name,
        mode: descriptor?.mode ?? "write",
        status: "blocked",
        blockedReason: message,
        requestId,
      });
      throw executionError;
    }

    const blockedReason = extractBlockedReason(output);

    if (blockedReason) {
      await this.toolGovernance.finalizeProposedAction({
        id: actionId,
        status: "BLOCKED",
        resultJson: { error: blockedReason },
      });
      await this.toolGovernance.recordInvocation({
        tenantId: action.tenantId,
        actorId: actor.userId,
        namespace: action.namespace,
        name: action.name,
        mode: descriptor?.mode ?? "write",
        status: "blocked",
        blockedReason,
        requestId,
      });
      return {
        id,
        actionId,
        namespace: action.namespace,
        tool: action.name,
        status: "blocked",
        errorMessage: blockedReason,
        auditRef: `prometeo-tool:${requestId}:${id}`,
        startedAt,
        completedAt,
      };
    }

    await this.toolGovernance.finalizeProposedAction({
      id: actionId,
      status: "EXECUTED",
      resultJson: output,
      executedAt: new Date(),
    });
    await this.toolGovernance.recordInvocation({
      tenantId: action.tenantId,
      actorId: actor.userId,
      namespace: action.namespace,
      name: action.name,
      mode: descriptor?.mode ?? "write",
      status: "succeeded",
      requestId,
    });

    return {
      id,
      actionId,
      namespace: action.namespace,
      tool: action.name,
      status: "succeeded",
      output: { outputKind: descriptor?.outputKind, data: output },
      auditRef: `prometeo-tool:${requestId}:${id}`,
      startedAt,
      completedAt,
    };
  }

  async rejectProposedAction(
    actor: RequestContext,
    requestId: string,
    actionId: string,
    reason?: string,
  ): Promise<PrometeoToolExecutionResult> {
    if (!this.toolGovernance) {
      throw new BadRequestException("Prometeo write-tool approvals are not available in this deployment.");
    }

    const action = await this.toolGovernance.findProposedAction({ tenantId: actor.tenantId, id: actionId });
    if (!action) {
      throw new NotFoundException(`Proposed action not found: ${actionId}`);
    }
    this.assertCanDecide(actor, action);

    const won = await this.toolGovernance.transitionProposedAction({
      tenantId: actor.tenantId,
      id: actionId,
      fromStatuses: ["PROPOSED", "AWAITING_APPROVAL"],
      toStatus: "REJECTED",
      patch: { rejectedBy: actor.userId, rejectedAt: new Date(), rejectionReason: reason ?? null },
    });
    if (!won) {
      throw new ConflictException(`Proposed action ${actionId} is no longer awaiting approval.`);
    }

    const descriptor = findPrometeoToolDescriptor(action.namespace, action.name);
    await this.toolGovernance.recordInvocation({
      tenantId: action.tenantId,
      actorId: actor.userId,
      namespace: action.namespace,
      name: action.name,
      mode: descriptor?.mode ?? "write",
      status: "rejected",
      blockedReason: reason,
      requestId,
    });

    const now = nowIso();
    const id = `exec_${randomUUID()}`;
    return {
      id,
      actionId,
      namespace: action.namespace,
      tool: action.name,
      status: "skipped",
      errorMessage: reason ?? "Rejected by approver",
      auditRef: `prometeo-tool:${requestId}:${id}`,
      startedAt: now,
      completedAt: now,
    };
  }

  /** OPS_ADMIN can always decide; the proposing actor can self-approve/reject only when approvalPolicy is "confirm". */
  private assertCanDecide(actor: RequestContext, action: ProposedActionRecord): void {
    const isOpsAdmin = normalizeRoles(actor.roles).includes("OPS_ADMIN");
    const isSelfConfirm = action.approvalPolicy === "confirm" && action.actorId === actor.userId;
    if (!isOpsAdmin && !isSelfConfirm) {
      throw new ForbiddenException(`Missing permission to decide on proposed action ${action.id}`);
    }
  }

  private finishWriteExecution(input: {
    id: string;
    requestId: string;
    startedAt: string;
    descriptor: PrometeoToolDescriptor;
    output: unknown;
  }): PrometeoToolExecutionResult {
    const { id, requestId, startedAt, descriptor, output } = input;
    const completedAt = nowIso();
    const blockedReason = extractBlockedReason(output);
    const auditRef = `prometeo-tool:${requestId}:${id}`;

    if (blockedReason) {
      return {
        id,
        namespace: descriptor.namespace,
        tool: descriptor.name,
        status: "blocked",
        errorMessage: blockedReason,
        auditRef,
        startedAt,
        completedAt,
      };
    }

    return {
      id,
      namespace: descriptor.namespace,
      tool: descriptor.name,
      status: "succeeded",
      output: { outputKind: descriptor.outputKind, data: output },
      auditRef,
      startedAt,
      completedAt,
    };
  }

  /** Executes the real side-effect for a write tool. Mirrors executeReadTool's shape but for state-changing calls. */
  private async executeWriteEffect(
    actor: { tenantId: string; orgId: string; userId: string; roles?: string[] },
    invocation: { namespace: string; name: string; input?: unknown },
    requestId: string,
  ): Promise<unknown> {
    const input = (invocation.input ?? {}) as Record<string, unknown>;
    const key = `${invocation.namespace}.${invocation.name}`;

    switch (key) {
      case "time_tracker.start":
        return this.fieldOps.startTrackerSession({
          tenantId: actor.tenantId,
          orgId: actor.orgId,
          createdBy: actor.userId,
          requestId,
          jobId: requiredString(input, "jobId"),
          notes: optionalString(input, "notes"),
        });

      case "time_tracker.pause":
        return this.fieldOps.pauseTrackerSession({
          tenantId: actor.tenantId,
          orgId: actor.orgId,
          createdBy: actor.userId,
          requestId,
          sessionId: requiredString(input, "sessionId"),
          notes: optionalString(input, "notes"),
        });

      case "time_tracker.resume":
        return this.fieldOps.resumeTrackerSession({
          tenantId: actor.tenantId,
          orgId: actor.orgId,
          createdBy: actor.userId,
          requestId,
          sessionId: requiredString(input, "sessionId"),
          notes: optionalString(input, "notes"),
        });

      case "time_tracker.stop":
        return this.fieldOps.stopTrackerSession({
          tenantId: actor.tenantId,
          orgId: actor.orgId,
          createdBy: actor.userId,
          requestId,
          sessionId: requiredString(input, "sessionId"),
          notes: optionalString(input, "notes"),
        });

      case "time_tracker.create_manual_entry":
        return this.fieldOps.createManualTrackerSession({
          tenantId: actor.tenantId,
          orgId: actor.orgId,
          createdBy: actor.userId,
          requestId,
          jobId: requiredString(input, "jobId"),
          date: requiredString(input, "date"),
          startTime: requiredString(input, "startTime"),
          endTime: requiredString(input, "endTime"),
          notes: optionalString(input, "notes"),
        });

      case "agro.create_task":
        return this.agroTasks.createTask(requiredString(input, "farmId"), actor.userId, {
          title: requiredString(input, "title"),
          type: requiredString(input, "type"),
          priority: optionalString(input, "priority"),
        });

      case "payments.propose_release":
        if (!this.payments) {
          return { __blockedReason: "PaymentsService is not available." };
        }
        // Calls the exact same PaymentsService.release() the REST escrow-release
        // endpoint uses (apps/api/src/modules/payments/payments.controller.ts) —
        // same financial invariants (contract signed, milestone approved, no open
        // dispute, sufficient escrow), never bypassed or re-implemented here.
        return this.payments.release({
          tenantId: actor.tenantId,
          orgId: actor.orgId,
          userId: actor.userId,
          roles: actor.roles ?? [],
          milestoneId: requiredString(input, "milestoneId"),
          amount: optionalNumber(input, "amount"),
          requestId,
        });

      default:
        return {
          __blockedReason: `${key} is registered but not wired for write execution in Prometeo P1.`,
        };
    }
  }

  private async executeReadTool(actor: RequestContext, invocation: PrometeoToolInvokeInput): Promise<unknown> {
    const input = invocation.input ?? {};
    const key = `${invocation.namespace}.${invocation.name}`;

    switch (key) {
      case "time_tracker.get_status":
        return this.fieldOps.getTrackerBootstrap({
          tenantId: actor.tenantId,
          orgId: actor.orgId,
          createdBy: actor.userId,
        });

      case "time_tracker.list_jobs":
        return this.fieldOps.listTrackerJobs({
          tenantId: actor.tenantId,
          orgId: actor.orgId,
          createdBy: actor.userId,
        });

      case "time_tracker.get_summary":
        return this.fieldOps.getTrackerSummary({
          tenantId: actor.tenantId,
          createdBy: actor.userId,
          range: optionalEnum(input, "range", TRACKER_SUMMARY_RANGES, "week") as TrackerSummaryRange,
        });

      case "time_tracker.list_sessions":
        return this.fieldOps.listTrackerSessions({
          tenantId: actor.tenantId,
          createdBy: actor.userId,
          range: optionalEnum(input, "range", TRACKER_RANGES, "all") as TrackerRange,
          status: optionalString(input, "status")
            ? optionalEnum(input, "status", TRACKER_STATUSES, "RUNNING") as TrackerStatus
            : undefined,
          jobId: optionalString(input, "jobId"),
          limit: optionalInteger(input, "limit", 1, 200),
        });

      case "agro.list_farms":
        return this.agroFarms.listFarms(actor.userId);

      case "agro.get_farm":
        return this.agroFarms.getFarm(requiredString(input, "farmId"), actor.userId);

      case "agro.get_dashboard":
        return this.agroDashboard.getDashboard(requiredString(input, "farmId"), actor.userId);

      case "agro.list_animals":
        return this.agroAnimals.listAnimals(requiredString(input, "farmId"), actor.userId);

      case "agro.get_animal": {
        const animal = await this.agroAnimals.getAnimal(requiredString(input, "animalId"));
        const farmId = (animal as { farmId?: unknown }).farmId;
        if (typeof farmId !== "string") {
          throw new BadRequestException("animal.farmId is missing");
        }
        await this.agroFarms.getFarm(farmId, actor.userId);
        return animal;
      }

      case "agro.list_groups":
        return this.agroAnimals.listGroups(requiredString(input, "farmId"), actor.userId);

      case "agro.list_tasks":
        return this.agroTasks.listTasks(requiredString(input, "farmId"), actor.userId, {
          status: optionalString(input, "status"),
          targetType: optionalString(input, "targetType"),
          targetId: optionalString(input, "targetId"),
        });

      case "agro.list_inventory":
        return this.agroInventory.listItems(requiredString(input, "farmId"), actor.userId);

      case "agro.list_costs":
        return this.agroInventory.listCosts(requiredString(input, "farmId"), actor.userId, {
          targetType: optionalString(input, "targetType"),
          targetId: optionalString(input, "targetId"),
        });

      case "agro.get_cost_summary":
        return this.agroInventory.getCostSummary(
          requiredString(input, "farmId"),
          actor.userId,
          optionalInteger(input, "days", 1, 365) ?? 30,
        );

      case "vision.get_analysis":
        return this.vision.getAnalysis(requiredString(input, "evidenceId"));

      case "vision.get_job_analyses":
        return this.vision.getByJob(requiredString(input, "jobId"));

      case "vision.get_milestone_analyses":
        return this.vision.getByMilestone(requiredString(input, "milestoneId"));

      case "vision.analyze_image":
        return this.vision.runAnalysis({
          evidenceId: requiredString(input, "evidenceId"),
          imageUrl: requiredString(input, "imageUrl"),
          jobId: optionalString(input, "jobId"),
          milestoneId: optionalString(input, "milestoneId"),
        });

      case "vision.compare_before_after":
        return this.vision.matchReference(
          requiredString(input, "deliveredImageUrl"),
          requiredString(input, "referenceImageUrl"),
        );

      case "vision.detect_material":
        return this.vision.detectMaterial(
          requiredString(input, "imageUrl"),
          optionalString(input, "expectedMaterial"),
          optionalBoolean(input, "enrich"),
        );

      case "vision.classify_space":
        return this.vision.classifySpace(
          requiredString(input, "imageUrl"),
          optionalBoolean(input, "enrich"),
        );

      case "vision.check_safety":
        return this.vision.checkSafetyEnriched(
          requiredString(input, "imageUrl"),
          optionalString(input, "trade"),
        );

      case "materials.calculate":
        try {
          return calculateMaterials(input);
        } catch (error) {
          const message = error instanceof MaterialsCalculatorError ? error.message : String(error);
          return { __blockedReason: message };
        }

      default:
        return {
          __blockedReason: `${key} is registered but not wired for read execution in Prometeo P1.`,
        };
    }
  }
}
