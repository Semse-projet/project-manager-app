import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  Optional,
  ServiceUnavailableException,
} from "@nestjs/common";
import {
  calculateMaterials,
  MaterialsCalculatorError,
} from "@semse/tools";
import type {
  PrometeoToolDescriptor,
  PrometeoToolExecutionResult,
  PrometeoToolInvokeInput,
  ToolResult,
} from "@semse/schemas";
import { randomUUID } from "node:crypto";
import { normalizeRoles } from "../../common/rbac.js";
import type { RequestContext } from "../../common/request-context.js";
import { AgroAnimalService } from "../agro/agro-animal.service.js";
import { AgroDashboardService } from "../agro/agro-dashboard.service.js";
import { AgroFarmService } from "../agro/agro-farm.service.js";
import { AgroInventoryService } from "../agro/agro-inventory.service.js";
import { AgroTaskService } from "../agro/agro-task.service.js";
import { AgroIncidentService } from "../agro/agro-incident.service.js";
import { AgroIntakeService } from "../agro/agro-intake.service.js";
import { FieldOpsService } from "../field-ops/field-ops.service.js";
import { BusinessOsToolsService } from "./business-os-tools.service.js";
import { PaymentsService } from "../payments/payments.service.js";
import { VisionService } from "../vision/vision.service.js";
import { VisionAccessPolicy } from "../vision/vision-access.policy.js";
import { findPrometeoToolDescriptor } from "./prometeo-tool-registry.js";
import { evaluatePrometeoToolPolicy } from "./tool-governance/tool-governance.policy.js";
import { ToolGovernanceRepository, type ProposedActionRecord } from "./tool-governance/tool-governance.repository.js";
import {
  ToolAuditUnavailableError,
  ToolCallAuditor,
  errorCodeOf,
  policyVersionOf,
  type AuditCtx,
} from "./tool-governance/tool-call-audit.js";

const TRACKER_RANGES = ["week", "month", "all"] as const;
const TRACKER_SUMMARY_RANGES = ["week", "month"] as const;
const TRACKER_STATUSES = ["RUNNING", "PAUSED", "STOPPED"] as const;

type TrackerRange = (typeof TRACKER_RANGES)[number];
type TrackerSummaryRange = (typeof TRACKER_SUMMARY_RANGES)[number];
type TrackerStatus = (typeof TRACKER_STATUSES)[number];

function nowIso() {
  return new Date().toISOString();
}

/**
 * docs/specs/prometeo/tool-result-multimodal.spec.md pilot. `legacyJson`
 * keeps the exact VisionAnalysisResult shape callers already depend on.
 * No `image` part is emitted: verified against VisionAnalysisRecord,
 * rawResult and apps/vision-service — none of them carry an annotated-image
 * field today, so checking for one here would be dead code pretending to
 * cover a case that can never fire. Add it when vision-service actually
 * produces one.
 */
function buildVisionAnalyzeImageToolResult(result: unknown): ToolResult {
  return {
    parts: [{ type: "json", data: result }],
    legacyJson: result,
  };
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
    @Optional() private readonly agroIntake?: AgroIntakeService,
    @Optional() private readonly agroIncidents?: AgroIncidentService,
    // Pertenencia de los recursos de visión (0.44). Sin `@Optional()` en Nest: si falta, la app no arranca; y si falta en
    // una construcción manual, las herramientas de visión por id fallan CERRADAS (ver `requireVisionAccess`).
    private readonly visionAccess?: VisionAccessPolicy,
    // BO-13: solo lectura sobre Business OS. Opcional: si falta, esas herramientas quedan bloqueadas, no rompen el arranque.
    @Optional() private readonly businessOs?: BusinessOsToolsService,
  ) {
    this.auditor = new ToolCallAuditor(toolGovernance);
  }

  /** H05: ciclo de vida de auditoría por ejecución (modo `PROMETEO_TOOL_AUDIT_LIFECYCLE`; `off` = comportamiento anterior). */
  private readonly auditor: ToolCallAuditor;

  private auditCtx(
    actor: { tenantId: string; userId: string },
    requestId: string,
    tool: { namespace: string; name: string; mode: string },
    executionId: string,
    extra: Partial<AuditCtx> = {},
  ): AuditCtx {
    return {
      executionId,
      tenantId: actor.tenantId,
      actorId: actor.userId,
      namespace: tool.namespace,
      name: tool.name,
      mode: tool.mode,
      requestId,
      source: "prometeo_tools",
      policyVersion: policyVersionOf(findPrometeoToolDescriptor(tool.namespace, tool.name) ?? tool),
      ...extra,
    };
  }

  /** En `enforce`, una escritura sin registro de inicio no se ejecuta: se informa como 503, no como un error interno. */
  private async beginOrRefuse(ctx: AuditCtx, critical: boolean): Promise<boolean> {
    try {
      return await this.auditor.begin(ctx, { critical });
    } catch (error) {
      if (error instanceof ToolAuditUnavailableError) throw new ServiceUnavailableException(error.message);
      throw error;
    }
  }

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

    const id = `exec_${randomUUID()}`;
    const audit = this.auditCtx(actor, requestId, descriptor, id, { input: invocation.input });
    const policy = evaluatePrometeoToolPolicy({ actorRoles: actor.roles, descriptor });
    if (policy.decision === "deny") {
      await this.auditor.finish(audit, false, {
        status: "blocked",
        blockedReason: `missing permissions: ${policy.missingPermissions.join(", ")}`,
        errorCode: "POLICY_DENIED",
      });
      throw new ForbiddenException({
        message: `Missing permission for ${descriptor.namespace}.${descriptor.name}`,
        namespace: descriptor.namespace,
        tool: descriptor.name,
        missingPermissions: policy.missingPermissions,
      });
    }

    const startedAt = nowIso();
    const started = await this.beginOrRefuse(audit, false);
    const startedMs = Date.now();
    let output: unknown;
    try {
      output = await this.executeReadTool(actor, invocation);
    } catch (error) {
      // H05: una excepción del handler ya no desaparece: queda como ejecución fallida.
      await this.auditor.finish(
        audit,
        started,
        { status: "failed", errorCode: errorCodeOf(error), output: { error: error instanceof Error ? error.message : String(error) } },
        startedMs,
      );
      throw error;
    }
    const completedAt = nowIso();
    const blockedReason = typeof output === "object" && output !== null && "__blockedReason" in output
      ? String((output as { __blockedReason: unknown }).__blockedReason)
      : null;

    if (blockedReason) {
      await this.auditor.finish(audit, started, { status: "blocked", blockedReason, errorCode: "BLOCKED" }, startedMs);
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

    await this.auditor.finish(audit, started, { status: "succeeded", output }, startedMs);

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

    const id = `exec_${randomUUID()}`;
    const audit = this.auditCtx(actor, requestId, descriptor, id, { input: invocation.input });
    const policy = evaluatePrometeoToolPolicy({ actorRoles: actor.roles, descriptor });
    if (policy.decision === "deny") {
      await this.auditor.finish(audit, false, {
        status: "blocked",
        blockedReason: `missing permissions: ${policy.missingPermissions.join(", ")}`,
        errorCode: "POLICY_DENIED",
      });
      throw new ForbiddenException({
        message: `Missing permission for ${descriptor.namespace}.${descriptor.name}`,
        namespace: descriptor.namespace,
        tool: descriptor.name,
        missingPermissions: policy.missingPermissions,
      });
    }

    // 0.48: the proposer must be able to reach the resource BEFORE anything is
    // queued or executed — an approved effect may run as someone else.
    try {
      await this.assertProposerScope(actor, invocation);
    } catch (error) {
      await this.auditor.finish(audit, false, {
        status: "blocked",
        blockedReason: error instanceof Error ? error.message : String(error),
        errorCode: errorCodeOf(error),
      });
      throw error;
    }

    const startedAt = nowIso();

    if (policy.decision === "allow") {
      // Escritura/crítica: en `enforce`, sin registro de inicio no hay efecto (decisión D1).
      const started = await this.beginOrRefuse(audit, true);
      const startedMs = Date.now();
      let output: unknown;
      try {
        output = await this.executeWriteEffect(
          { tenantId: actor.tenantId, orgId: actor.orgId, userId: actor.userId, roles: actor.roles },
          invocation,
          requestId,
        );
      } catch (error) {
        await this.auditor.finish(
          audit,
          started,
          { status: "failed", errorCode: errorCodeOf(error), output: { error: error instanceof Error ? error.message : String(error) } },
          startedMs,
        );
        throw error;
      }
      const result = this.finishWriteExecution({ id, requestId, startedAt, descriptor, output });
      await this.auditor.finish(
        audit,
        started,
        {
          status: result.status,
          blockedReason: result.status === "blocked" ? result.errorMessage : undefined,
          output: result.status === "succeeded" ? output : undefined,
        },
        startedMs,
      );
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

    await this.auditor.finish({ ...audit, proposedActionId: action.id }, false, { status: "queued" });

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

    // H05: el registro de inicio va ANTES de la transición a APPROVED: si en `enforce` no se puede persistir, no se
    // cambia nada (no queda una acción aprobada sin ejecutar ni traza).
    const id = `exec_${randomUUID()}`;
    const descriptor = findPrometeoToolDescriptor(action.namespace, action.name);
    const audit = this.auditCtx(actor, requestId, { namespace: action.namespace, name: action.name, mode: descriptor?.mode ?? "write" }, id, {
      proposedActionId: actionId,
      input: action.inputJson,
    });
    const started = await this.beginOrRefuse(audit, true);

    const won = await this.toolGovernance.transitionProposedAction({
      tenantId: actor.tenantId,
      id: actionId,
      fromStatuses: ["PROPOSED", "AWAITING_APPROVAL"],
      toStatus: "APPROVED",
      patch: { approvedBy: actor.userId, approvedAt: new Date() },
    });
    if (!won) {
      await this.auditor.finish(audit, started, { status: "skipped", errorCode: "LOST_RACE" });
      throw new ConflictException(`Proposed action ${actionId} is no longer awaiting approval.`);
    }

    const startedAt = nowIso();
    const startedMs = Date.now();

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
      await this.auditor.finish(
        audit,
        started,
        {
          status: "failed",
          blockedReason: message,
          errorCode: errorCodeOf(executionError),
          output: { error: message },
          // Con el ciclo de vida apagado se conserva la fila anterior: una excepción del efecto se registraba como "blocked".
          legacy: { status: "blocked", blockedReason: message },
        },
        startedMs,
      );
      throw executionError;
    }

    const blockedReason = extractBlockedReason(output);

    if (blockedReason) {
      await this.toolGovernance.finalizeProposedAction({
        id: actionId,
        status: "BLOCKED",
        resultJson: { error: blockedReason },
      });
      await this.auditor.finish(audit, started, { status: "blocked", blockedReason, errorCode: "BLOCKED" }, startedMs);
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
    await this.auditor.finish(audit, started, { status: "succeeded", output }, startedMs);

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
    // El mismo id de ejecución que ve el cliente en `auditRef` queda en la fila (antes eran dos ids distintos).
    const id = `exec_${randomUUID()}`;
    await this.auditor.finish(
      this.auditCtx(actor, requestId, { namespace: action.namespace, name: action.name, mode: descriptor?.mode ?? "write" }, id, {
        proposedActionId: actionId,
      }),
      false,
      { status: "rejected", blockedReason: reason },
    );

    const now = nowIso();
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

      case "agro.create_incident":
        if (!this.agroIncidents) {
          return { __blockedReason: "AgroIncidentService is not available." };
        }
        // Mismo servicio que el endpoint REST: misma política de finca, validación
        // de relaciones y auditoría. source=PROMETEO → severidad nunca confirmada.
        return this.agroIncidents.create(requiredString(input, "farmId"), actor.userId, {
          type: requiredString(input, "type"),
          title: requiredString(input, "title"),
          description: optionalString(input, "description"),
          severity: optionalString(input, "severity"),
          farmUnitId: optionalString(input, "farmUnitId"),
          animalGroupId: optionalString(input, "animalGroupId"),
          animalId: optionalString(input, "animalId"),
          source: "PROMETEO",
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
          source: "agent",
        });

      default:
        return {
          __blockedReason: `${key} is registered but not wired for write execution in Prometeo P1.`,
        };
    }
  }

  /**
   * 0.48 — resource scope of the PROPOSER. `payments.propose_release` is
   * human_required: on approval it runs as the approving OPS_ADMIN, so the
   * release's own participation checks never evaluate who proposed it.
   * time_tracker.* needs nothing here: the tracker repository already scopes
   * sessions by createdBy and jobs by assignment. Fails closed when the
   * payments service is not wired.
   */
  private async assertProposerScope(actor: RequestContext, invocation: PrometeoToolInvokeInput): Promise<void> {
    if (`${invocation.namespace}.${invocation.name}` !== "payments.propose_release") return;
    const input = (invocation.input ?? {}) as Record<string, unknown>;
    const milestoneId = requiredString(input, "milestoneId");
    if (!this.payments) {
      throw new ForbiddenException("Payment scope check is not available in this deployment");
    }
    await this.payments.assertCanProposeRelease({
      tenantId: actor.tenantId,
      orgId: actor.orgId,
      userId: actor.userId,
      roles: actor.roles ?? [],
      milestoneId,
    });
  }

  private requireVisionAccess(): VisionAccessPolicy {
    if (!this.visionAccess) throw new ForbiddenException("Vision access policy is not available");
    return this.visionAccess;
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

      case "agro.propose_intake":
        if (!this.agroIntake) {
          throw new BadRequestException("AgroIntakeService is not available");
        }
        return this.agroIntake.propose(requiredString(input, "farmId"), actor.userId, {
          text: requiredString(input, "text"),
          evidenceIds: Array.isArray(input.evidenceIds) ? input.evidenceIds.filter((v): v is string => typeof v === "string") : undefined,
        });

      case "agro.list_incidents":
        if (!this.agroIncidents) {
          throw new BadRequestException("AgroIncidentService is not available");
        }
        return this.agroIncidents.list(requiredString(input, "farmId"), actor.userId, {
          status: optionalString(input, "status")?.split(","),
          severity: optionalString(input, "severity")?.split(","),
          q: optionalString(input, "q"),
        });

      // 0.44: estas herramientas por id repiten la barrera de pertenencia que ya aplica `VisionController` (C51 etapa 3).
      // Antes solo comprobaban el permiso `vision:*` y leían/escribían `VisionAnalysis` (que no guarda tenant) de cualquier
      // tenant u organización. El recurso se resuelve DENTRO del tenant del actor: otro tenant o inexistente ⇒ 404,
      // otra organización ⇒ 403.
      case "vision.get_analysis": {
        const evidenceId = requiredString(input, "evidenceId");
        await this.requireVisionAccess().assertEvidence(actor, [evidenceId]);
        return this.vision.getAnalysis(evidenceId);
      }

      case "vision.get_job_analyses": {
        const jobId = requiredString(input, "jobId");
        await this.requireVisionAccess().assertJob(actor, jobId);
        return this.vision.getByJob(jobId);
      }

      case "vision.get_milestone_analyses": {
        const milestoneId = requiredString(input, "milestoneId");
        await this.requireVisionAccess().assertMilestone(actor, milestoneId);
        return this.vision.getByMilestone(milestoneId);
      }

      case "vision.analyze_image": {
        // `runAnalysis` hace upsert por evidencia: sin esta barrera, además de leer, se podía SOBRESCRIBIR el análisis ajeno.
        const evidenceId = requiredString(input, "evidenceId"); // primero la validación de entrada (400), luego la pertenencia
        const access = this.requireVisionAccess();
        await access.assertEvidence(actor, [evidenceId]);
        await access.assertContext(actor, {
          jobId: optionalString(input, "jobId"),
          milestoneId: optionalString(input, "milestoneId"),
        });
        const result = await this.vision.runAnalysis({
          evidenceId: requiredString(input, "evidenceId"),
          imageUrl: requiredString(input, "imageUrl"),
          jobId: optionalString(input, "jobId"),
          milestoneId: optionalString(input, "milestoneId"),
        });
        return buildVisionAnalyzeImageToolResult(result);
      }

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

      case "business_os.my_assignments":
      case "business_os.my_skills":
      case "business_os.crew_tasks":
      case "business_os.crew_blocked":
      case "business_os.draft_report_summary": {
        if (!this.businessOs) return { __blockedReason: "Las herramientas de Business OS no están disponibles" };
        const ctx = { tenantId: actor.tenantId, orgId: actor.orgId, userId: actor.userId, roles: actor.roles };
        if (key === "business_os.my_assignments") return this.businessOs.myAssignments(ctx);
        if (key === "business_os.my_skills") return this.businessOs.mySkills(ctx);
        if (key === "business_os.crew_tasks") return this.businessOs.crewTasks(ctx, input);
        if (key === "business_os.crew_blocked") return this.businessOs.crewBlocked(ctx, input);
        return this.businessOs.draftReportSummary(ctx, input);
      }

      default:
        return {
          __blockedReason: `${key} is registered but not wired for read execution in Prometeo P1.`,
        };
    }
  }
}
