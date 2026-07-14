import { BadRequestException, Injectable } from "@nestjs/common";
import type {
  PrometeoToolExecutionResult,
  PrometeoToolInvokeInput,
} from "@semse/schemas";
import { randomUUID } from "node:crypto";
import type { RequestContext } from "../../common/request-context.js";
import { AgroAnimalService } from "../agro/agro-animal.service.js";
import { AgroDashboardService } from "../agro/agro-dashboard.service.js";
import { AgroFarmService } from "../agro/agro-farm.service.js";
import { AgroInventoryService } from "../agro/agro-inventory.service.js";
import { AgroTaskService } from "../agro/agro-task.service.js";
import { FieldOpsService } from "../field-ops/field-ops.service.js";
import { VisionService } from "../vision/vision.service.js";
import { findPrometeoToolDescriptor } from "./prometeo-tool-registry.js";

const TRACKER_RANGES = ["week", "month", "all"] as const;
const TRACKER_SUMMARY_RANGES = ["week", "month"] as const;
const TRACKER_STATUSES = ["RUNNING", "PAUSED", "STOPPED"] as const;

type TrackerRange = (typeof TRACKER_RANGES)[number];
type TrackerSummaryRange = (typeof TRACKER_SUMMARY_RANGES)[number];
type TrackerStatus = (typeof TRACKER_STATUSES)[number];

function nowIso() {
  return new Date().toISOString();
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

function optionalInteger(input: Record<string, unknown>, key: string, min: number, max: number): number | undefined {
  const value = input[key];
  if (value === undefined || value === null || value === "") return undefined;
  const numberValue = typeof value === "number" ? value : Number.parseInt(String(value), 10);
  if (!Number.isFinite(numberValue)) {
    throw new BadRequestException(`${key} must be a number`);
  }
  return Math.min(Math.max(Math.trunc(numberValue), min), max);
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

    const startedAt = nowIso();
    const id = `exec_${randomUUID()}`;
    const output = await this.executeReadTool(actor, invocation);
    const completedAt = nowIso();
    const blockedReason = typeof output === "object" && output !== null && "__blockedReason" in output
      ? String((output as { __blockedReason: unknown }).__blockedReason)
      : null;

    if (blockedReason) {
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

      default:
        return {
          __blockedReason: `${key} is registered but not wired for read execution in Prometeo P1.`,
        };
    }
  }
}
