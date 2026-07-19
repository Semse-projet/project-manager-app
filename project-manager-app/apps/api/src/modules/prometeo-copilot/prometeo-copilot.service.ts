import { Inject, Injectable, Logger } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import type {
  ActionExecutionResponse,
  CopilotContextRequest,
  CopilotContextResponse,
  CopilotMessageRequest,
  CopilotMessageResponse,
  CopilotMissionSuggestion,
  CopilotSuggestedAction,
  CreateMissionFromCopilotRequest,
  ExecuteCopilotActionRequest,
  MissionCreationResponse,
  WorkspaceMissionType,
} from "@semse/schemas";
import { OrchestrationService, type OrchestrationActor } from "../orchestration/orchestration.service.js";
import { WorkspaceService, type WorkspaceActor } from "../workspace/workspace.service.js";
import {
  COPILOT_SESSION_REPOSITORY,
  type CopilotSession,
  type CopilotSessionRepository,
} from "./prometeo-copilot.repository.js";

export type CopilotActor = WorkspaceActor & OrchestrationActor;

type ModuleProfile = {
  module: string;
  resourceType: string;
  actions: CopilotSuggestedAction[];
  missionType: WorkspaceMissionType;
};

/** Ordered longest-prefix match: first matching segment wins. */
const MODULE_PROFILES: Array<{ match: string; profile: ModuleProfile }> = [
  {
    match: "workspace",
    profile: {
      module: "workspace",
      resourceType: "workspace",
      missionType: "planning",
      actions: [{ action: "workspace.focus", description: "Enfocar misión actual" }],
    },
  },
  {
    match: "jobs",
    profile: {
      module: "jobs",
      resourceType: "job",
      missionType: "project",
      actions: [
        { action: "job.summary", description: "Resumir este trabajo" },
        { action: "budget.suggest", description: "Estimar presupuesto" },
      ],
    },
  },
  {
    match: "projects",
    profile: {
      module: "projects",
      resourceType: "project",
      missionType: "project",
      actions: [
        { action: "project.status", description: "Ver estado del proyecto" },
        { action: "plan.build", description: "Generar plan de hitos" },
      ],
    },
  },
  {
    match: "evidence",
    profile: {
      module: "evidence",
      resourceType: "evidence",
      missionType: "evidence",
      actions: [{ action: "evidence.request", description: "Solicitar evidencia" }],
    },
  },
  {
    match: "marketplace",
    profile: {
      module: "marketplace",
      resourceType: "listing",
      missionType: "conversation",
      actions: [{ action: "listing.compare", description: "Comparar proveedores" }],
    },
  },
];

const DEFAULT_PROFILE: ModuleProfile = {
  module: "dashboard",
  resourceType: "unknown",
  missionType: "conversation",
  actions: [{ action: "copilot.ask", description: "Preguntar a Prometeo" }],
};

function extractPath(currentUrl: string): string {
  try {
    return new URL(currentUrl).pathname;
  } catch {
    // Accept bare paths ("/client/jobs/123") too.
    return currentUrl.startsWith("/") ? currentUrl : `/${currentUrl}`;
  }
}

function detectProfile(currentUrl: string): ModuleProfile {
  const path = extractPath(currentUrl).toLowerCase();
  const segments = path.split("/").filter(Boolean);
  for (const { match, profile } of MODULE_PROFILES) {
    if (segments.includes(match)) {
      return profile;
    }
  }
  return DEFAULT_PROFILE;
}

/** Heuristic: the segment after a known module is usually the resource id. */
function detectResourceId(currentUrl: string, moduleName: string): string | null {
  const segments = extractPath(currentUrl).split("/").filter(Boolean);
  const idx = segments.indexOf(moduleName);
  if (idx >= 0 && idx + 1 < segments.length) {
    return segments[idx + 1];
  }
  return null;
}

@Injectable()
export class PrometeoCopilotService {
  private readonly logger = new Logger(PrometeoCopilotService.name);

  constructor(
    private readonly orchestration: OrchestrationService,
    private readonly workspace: WorkspaceService,
    @Inject(COPILOT_SESSION_REPOSITORY)
    private readonly sessions: CopilotSessionRepository,
  ) {}

  detectContext(actor: CopilotActor, request: CopilotContextRequest): CopilotContextResponse {
    const profile = detectProfile(request.currentUrl);
    const resourceId =
      request.additionalContext?.resourceId ?? detectResourceId(request.currentUrl, profile.module);
    const resourceType = request.additionalContext?.resourceType ?? profile.resourceType;
    const confidence = profile === DEFAULT_PROFILE ? 0.3 : resourceId ? 0.9 : 0.6;

    return {
      module: profile.module,
      resource: { id: resourceId, type: resourceType, data: null },
      permissions: actor.roles,
      suggestedActions: profile.actions,
      confidence,
    };
  }

  async processMessage(
    actor: CopilotActor,
    request: CopilotMessageRequest,
  ): Promise<CopilotMessageResponse> {
    const session = await this.resolveSession(
      actor,
      request.sessionId,
      request.context?.module ?? "dashboard",
    );
    const sessionId = session.sessionId;
    const interpretation = this.orchestration.interpret(request.message);
    const requiresWorkspace = interpretation.confidence >= 0.5;

    const profile = request.context?.module
      ? MODULE_PROFILES.find((p) => p.match === request.context?.module)?.profile ?? DEFAULT_PROFILE
      : DEFAULT_PROFILE;

    const suggestedActions = profile.actions;

    let missionSuggestion: CopilotMissionSuggestion | undefined;
    if (requiresWorkspace) {
      missionSuggestion = {
        title: this.titleFromMessage(request.message),
        type: profile.missionType,
        reason: `Detecté la intención "${interpretation.intent}" — conviene abrir una misión en el Workspace.`,
      };
      session.lastMissionSuggestion = missionSuggestion;
      await this.sessions.save(session);
    }

    this.logger.log(
      `copilot.message session=${sessionId} user=${actor.userId} intent=${interpretation.intent} workspace=${requiresWorkspace}`,
    );

    return {
      sessionId,
      response: this.replyFor(interpretation.intent, request.message),
      suggestedActions,
      requiresWorkspace,
      missionSuggestion,
    };
  }

  async createMission(
    actor: CopilotActor,
    request: CreateMissionFromCopilotRequest,
  ): Promise<MissionCreationResponse> {
    const session = await this.sessions.find(request.copilotSessionId);
    if (session && session.tenantId !== actor.tenantId) {
      // Never leak another tenant's session; treat as a fresh mission.
      this.logger.warn(`copilot.mission.create cross-tenant session ignored user=${actor.userId}`);
    }

    const missionId = randomUUID();
    const loaded = await this.workspace.loadMission(actor, {
      missionId,
      missionType: request.missionType,
      title: request.title,
    });

    this.logger.log(
      `copilot.mission.created mission=${missionId} type=${request.missionType} user=${actor.userId}`,
    );

    return {
      missionId: loaded.missionId,
      title: loaded.title,
      type: loaded.missionType,
      workspaceUrl: `/workspace?mission=${loaded.missionId}`,
    };
  }

  executeAction(actor: CopilotActor, request: ExecuteCopilotActionRequest): ActionExecutionResponse {
    // Read-only; no persistence needed, kept synchronous.
    const actionId = randomUUID();
    // Read-only quick actions complete inline; anything that would mutate a
    // protected resource is deferred to the Workspace for governed execution.
    const inlineActions = new Set([
      "job.summary",
      "project.status",
      "status.summary",
      "listing.compare",
      "copilot.ask",
      "workspace.focus",
    ]);
    const isInline = inlineActions.has(request.action);

    this.logger.log(
      `copilot.action.execute action=${request.action} inline=${isInline} user=${actor.userId}`,
    );

    if (!isInline) {
      return {
        actionId,
        status: "pending",
        result: { deferredTo: "workspace", action: request.action, resource: request.targetResource },
        requiresWorkspace: true,
      };
    }

    return {
      actionId,
      status: "completed",
      result: {
        action: request.action,
        resource: request.targetResource,
        summary: `Acción "${request.action}" ejecutada sobre ${request.targetResource.resourceType} ${request.targetResource.resourceId}.`,
      },
      requiresWorkspace: false,
    };
  }

  private async resolveSession(
    actor: CopilotActor,
    sessionId: string | undefined,
    module: string,
  ): Promise<CopilotSession> {
    if (sessionId) {
      const existing = await this.sessions.find(sessionId);
      if (existing && existing.tenantId === actor.tenantId) {
        existing.module = module;
        await this.sessions.save(existing);
        return existing;
      }
    }
    const id = sessionId ?? randomUUID();
    const session: CopilotSession = {
      sessionId: id,
      tenantId: actor.tenantId,
      userId: actor.userId,
      module,
    };
    await this.sessions.save(session);
    return session;
  }

  private titleFromMessage(message: string): string {
    const trimmed = message.trim().replace(/\s+/g, " ");
    return trimmed.length > 60 ? `${trimmed.slice(0, 57)}...` : trimmed;
  }

  private replyFor(intent: string, message: string): string {
    if (intent === "general_inquiry") {
      return "Puedo ayudarte con presupuestos, evidencia, estado, contratos o planificación. ¿Qué necesitas?";
    }
    return `Entendido. Puedo avanzar con "${this.titleFromMessage(message)}" desde el Workspace.`;
  }
}
