import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { isOpsAdmin, type ScopeActor } from "../../../common/resource-scope.js";
import { PrometeoAccessPolicy } from "../prometeo-access.policy.js";
import { ToolGovernanceRepository } from "./tool-governance.repository.js";

/**
 * H05 (entrega B, decisión D4) — consulta autorizada de ejecuciones de tools.
 *  - Otro tenant o inexistente ⇒ 404 (la consulta siempre va acotada al tenant del actor).
 *  - OPS_ADMIN del tenant y quien inició la ejecución ven el detalle (resúmenes redactados de entrada y salida).
 *  - Un participante del proyecto de la ejecución ve el RESUMEN: herramienta, estado, policy, aprobación y tiempos, sin
 *    el contenido de entrada/salida. Cualquier otro actor ⇒ 403.
 */
export type ToolExecutionView = {
  executionId: string;
  tool: string;
  mode: string;
  status: string;
  source: string | null;
  projectId: string | null;
  runId: string | null;
  approvalId: string | null;
  proposedActionId: string | null;
  policyVersion: string | null;
  startedAt: string | null;
  completedAt: string | null;
  durationMs: number | null;
  errorCode: string | null;
  blockedReason: string | null;
  detail: "full" | "summary";
  inputSummary?: string | null;
  outputSummary?: string | null;
};

type AuditRow = {
  executionId: string | null;
  actorId: string;
  namespace: string;
  name: string;
  mode: string;
  status: string;
  source: string | null;
  projectId: string | null;
  runId: string | null;
  approvalId: string | null;
  proposedActionId: string | null;
  policyVersion: string | null;
  startedAt: Date | null;
  completedAt: Date | null;
  durationMs: number | null;
  errorCode: string | null;
  blockedReason: string | null;
  inputSummary: string | null;
  outputSummary: string | null;
};

@Injectable()
export class ToolExecutionQueryService {
  constructor(
    private readonly repository: ToolGovernanceRepository,
    private readonly access: PrometeoAccessPolicy,
  ) {}

  private async detailLevel(actor: ScopeActor, row: AuditRow): Promise<"full" | "summary" | "none"> {
    if (isOpsAdmin(actor)) return "full";
    if (actor.userId && row.actorId === actor.userId) return "full";
    if (row.projectId) {
      try {
        await this.access.assertProjectFilter(actor, row.projectId);
        return "summary";
      } catch {
        return "none";
      }
    }
    return "none";
  }

  private toView(row: AuditRow, detail: "full" | "summary"): ToolExecutionView {
    const view: ToolExecutionView = {
      executionId: row.executionId ?? "",
      tool: `${row.namespace}.${row.name}`,
      mode: row.mode,
      status: row.status,
      source: row.source,
      projectId: row.projectId,
      runId: row.runId,
      approvalId: row.approvalId,
      proposedActionId: row.proposedActionId,
      policyVersion: row.policyVersion,
      startedAt: row.startedAt?.toISOString() ?? null,
      completedAt: row.completedAt?.toISOString() ?? null,
      durationMs: row.durationMs,
      errorCode: row.errorCode,
      blockedReason: row.blockedReason,
      detail,
    };
    if (detail === "full") {
      view.inputSummary = row.inputSummary;
      view.outputSummary = row.outputSummary;
    }
    return view;
  }

  async getExecution(actor: ScopeActor, executionId: string): Promise<ToolExecutionView> {
    const row = (await this.repository.findExecution(actor.tenantId, executionId)) as AuditRow | null;
    if (!row) throw new NotFoundException("Execution not found");
    const level = await this.detailLevel(actor, row);
    if (level === "none") throw new ForbiddenException("Actor cannot access this execution");
    return this.toView(row, level);
  }

  /** Listado por proyecto: el actor debe participar en el proyecto (404/403 como el resto de rutas por proyecto). */
  async listByProject(actor: ScopeActor, projectId: string, limit?: number): Promise<ToolExecutionView[]> {
    await this.access.assertProjectFilter(actor, projectId);
    const rows = (await this.repository.listExecutionsByProject({ tenantId: actor.tenantId, projectId, limit })) as AuditRow[];
    const views: ToolExecutionView[] = [];
    for (const row of rows) {
      const level = await this.detailLevel(actor, row);
      if (level !== "none") views.push(this.toView(row, level));
    }
    return views;
  }
}
