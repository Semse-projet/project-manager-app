import { Injectable, Logger, Optional } from "@nestjs/common";
import type { PrometeoProposedAction } from "@semse/schemas";
import { hasPermission } from "../../../common/rbac.js";
import type { RequestContext } from "../../../common/request-context.js";
import { AuditService } from "../../../infrastructure/audit/audit.service.js";
import { CHAT_ACTIONS_VOCABULARY_VERSION, classifyChatAction } from "./intent.js";
import { resolveChatRoute, resolveJobCreationRoute } from "./route-catalog.js";

/** `off` (por defecto): sin acciones. `shadow`: calcula y audita lo que HABRÍA propuesto, sin cambiar la respuesta. `live`: las añade. */
export type ChatActionsMode = "off" | "shadow" | "live";

export function resolveChatActionsMode(env: Record<string, string | undefined> = process.env): ChatActionsMode {
  const raw = env.SEMSE_CHAT_ACTIONS_MODE?.trim().toLowerCase();
  return raw === "shadow" || raw === "live" ? raw : "off";
}

type Proposal = { action: PrometeoProposedAction; audit: Record<string, unknown> } | { suppressed: string; audit: Record<string, unknown> } | null;

/**
 * Prometeo actúa desde el chat (spec `prometeo.chat-actions`). Decide, con el clasificador cerrado, si el mensaje merece
 * proponer una acción y la devuelve en la forma existente de `proposedActions`. NO ejecuta nada y NO tiene efectos
 * secundarios más allá de la auditoría: crear el trabajo ocurre solo cuando el usuario pulsa el botón y confirma el
 * borrador por el flujo ya existente (`publish-job` → `confirm-draft`); navegar ocurre solo con el clic.
 *
 * La auditoría NUNCA incluye el texto del mensaje.
 */
@Injectable()
export class ChatActionsService {
  private readonly logger = new Logger(ChatActionsService.name);

  constructor(@Optional() private readonly auditService?: AuditService) {}

  async propose(input: {
    actor: RequestContext;
    message: string;
    requestId: string;
    mode?: ChatActionsMode;
  }): Promise<PrometeoProposedAction[]> {
    const mode = input.mode ?? resolveChatActionsMode();
    if (mode === "off") return [];

    const proposal = this.evaluate(input.actor, input.message);
    if (!proposal) return [];

    const event = "suppressed" in proposal ? "suppressed" : mode === "shadow" ? "shadow" : "proposed";
    await this.audit(input.actor, input.requestId, `prometeo.chat_action.${event}`, {
      mode,
      vocabularyVersion: CHAT_ACTIONS_VOCABULARY_VERSION,
      ...proposal.audit,
      ...("suppressed" in proposal ? { reason: proposal.suppressed } : {}),
    });

    if ("suppressed" in proposal || mode === "shadow") return [];
    return [proposal.action];
  }

  private evaluate(actor: RequestContext, message: string): Proposal {
    const intent = classifyChatAction(message);

    if (intent.kind === "create_job") {
      const audit = { kind: "create_job_draft", confidence: intent.confidence };
      if (!hasPermission(actor.roles, "jobs:create")) return { suppressed: "missing_permission_jobs_create", audit };
      const route = resolveJobCreationRoute(actor.roles);
      return {
        audit,
        action: {
          id: "chat-create_job_draft",
          namespace: "chat",
          tool: "create_job_draft",
          label: "Crear el trabajo",
          description: "Empieza un borrador del trabajo. No se publica nada hasta que lo confirmes.",
          riskLevel: "low",
          approvalPolicy: "confirm",
          requiresApproval: true,
          status: "proposed",
          input: route ? { route } : {},
          reason: "chat_action",
        },
      };
    }

    if (intent.kind === "navigate" && intent.routeId) {
      const audit = { kind: "navigate", routeId: intent.routeId, confidence: intent.confidence };
      const route = resolveChatRoute(intent.routeId, actor.roles);
      if (!route) return { suppressed: "route_not_available_for_role", audit };
      return {
        audit: { ...audit, path: route.path },
        action: {
          id: `chat-navigate-${route.id}`,
          namespace: "chat",
          tool: "navigate",
          label: `Ir a ${route.label}`,
          riskLevel: "low",
          approvalPolicy: "none",
          requiresApproval: false,
          status: "proposed",
          input: { route: route.path },
          reason: "chat_action",
        },
      };
    }

    return null;
  }

  private async audit(actor: RequestContext, requestId: string, action: string, detail: Record<string, unknown>): Promise<void> {
    if (!this.auditService) return;
    try {
      await this.auditService.append({
        id: `aud_chat_action_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`,
        tenantId: actor.tenantId,
        orgId: actor.orgId,
        actorUserId: actor.userId,
        action,
        entityType: "ChatAction",
        entityId: requestId,
        requestId,
        timestamp: new Date().toISOString(),
        afterJson: detail,
      });
    } catch (error) {
      // La auditoría de una propuesta no es una compuerta: un fallo no debe romper el chat.
      this.logger.warn(`Audit failed for ${action}: ${String(error)}`);
    }
  }
}
