import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import type {
  AgentConsultationRequest,
  AgentConsultationResponse,
  OrchestrationAgentResult,
  OrchestrationEntity,
  OrchestrationInterpretation,
  OrchestrationStatus,
  OrchestrationStatusResponse,
  OrchestrationStep,
  OrchestrationSuggestedAction,
  PrometeoAgentId,
  PrometeoOrchestrationRequest,
  PrometeoOrchestrationResponse,
} from "@semse/schemas";
import { nextOrchestrationStatus } from "./orchestration.fsm.js";

export type OrchestrationActor = {
  userId: string;
  tenantId: string;
  orgId: string;
  roles: string[];
};

type AgentProfile = {
  id: PrometeoAgentId;
  title: string;
  intents: string[];
  /** Keyword stems (Spanish/English) that route a message to this agent. */
  keywords: string[];
  respond: (query: string) => { text: string; requiresAction: boolean; actions: OrchestrationSuggestedAction[] };
};

const AGENTS: Record<PrometeoAgentId, AgentProfile> = {
  marta: {
    id: "marta",
    title: "Marta — Presupuestos y Pricing",
    intents: ["budget_estimate"],
    keywords: ["presupuesto", "costo", "precio", "cotiza", "budget", "cost", "price", "estimate"],
    respond: () => ({
      text: "Marta puede estimar un rango de presupuesto a partir del alcance del proyecto.",
      requiresAction: true,
      actions: [{ action: "budget.suggest", description: "Generar estimación de presupuesto" }],
    }),
  },
  felix: {
    id: "felix",
    title: "Félix — Operación de Campo y Evidencia",
    intents: ["field_ops"],
    keywords: ["evidencia", "campo", "foto", "inspeccion", "evidence", "field", "photo", "inspection"],
    respond: () => ({
      text: "Félix puede coordinar la captura de evidencia y validar hitos en campo.",
      requiresAction: true,
      actions: [{ action: "evidence.request", description: "Solicitar evidencia de campo" }],
    }),
  },
  pulse: {
    id: "pulse",
    title: "Pulse — Estado y Analítica",
    intents: ["status_report"],
    keywords: ["estado", "avance", "progreso", "metrica", "status", "progress", "metric", "report"],
    respond: () => ({
      text: "Pulse puede resumir el estado y las métricas actuales del proyecto.",
      requiresAction: false,
      actions: [{ action: "status.summary", description: "Ver resumen de estado" }],
    }),
  },
  just: {
    id: "just",
    title: "Just — Contratos y Disputas",
    intents: ["legal_review"],
    keywords: ["contrato", "disputa", "legal", "pago", "escrow", "contract", "dispute", "payment"],
    respond: () => ({
      text: "Just puede revisar el estado contractual y de pagos protegidos.",
      requiresAction: true,
      actions: [{ action: "contract.review", description: "Revisar contrato / disputa" }],
    }),
  },
  planner: {
    id: "planner",
    title: "Planner — Planificación",
    intents: ["planning"],
    keywords: ["plan", "cronograma", "agenda", "programa", "schedule", "timeline", "milestone", "hito"],
    respond: () => ({
      text: "Planner puede proponer un cronograma de hitos y tareas.",
      requiresAction: true,
      actions: [{ action: "plan.build", description: "Generar plan de hitos" }],
    }),
  },
};

const ALL_AGENT_IDS = Object.keys(AGENTS) as PrometeoAgentId[];

type OrchestrationRecord = {
  orchestrationId: string;
  tenantId: string;
  userId: string;
  status: OrchestrationStatus;
  currentStep: string;
  interpretation: OrchestrationInterpretation;
  agentsConsulted: OrchestrationAgentResult[];
  plan: { steps: OrchestrationStep[] };
  requiresApproval: boolean;
  errors: Array<{ message: string; agent?: string }>;
  createdAt: string;
};

/** Minimum confidence below which the request is treated as ambiguous. */
const AMBIGUITY_THRESHOLD = 0.4;

@Injectable()
export class OrchestrationService {
  private readonly logger = new Logger(OrchestrationService.name);
  private readonly records = new Map<string, OrchestrationRecord>();

  interpret(message: string, preferredAgents?: PrometeoAgentId[]): OrchestrationInterpretation {
    const normalized = message.toLowerCase();
    const entities = this.extractEntities(message);

    const matches: Array<{ agent: PrometeoAgentId; hits: number }> = ALL_AGENT_IDS.map((id) => {
      const hits = AGENTS[id].keywords.filter((kw) => normalized.includes(kw)).length;
      return { agent: id, hits };
    }).filter((m) => m.hits > 0);

    if (preferredAgents?.length) {
      // A caller-selected agent is a strong signal even without keyword hits.
      for (const agent of preferredAgents) {
        if (!matches.some((m) => m.agent === agent)) {
          matches.push({ agent, hits: 1 });
        }
      }
    }

    if (matches.length === 0) {
      return { intent: "general_inquiry", confidence: 0.2, entities };
    }

    matches.sort((a, b) => b.hits - a.hits);
    const top = matches[0];
    const totalHits = matches.reduce((sum, m) => sum + m.hits, 0);
    const confidence = Math.min(1, 0.5 + totalHits * 0.15);
    return { intent: AGENTS[top.agent].intents[0], confidence, entities };
  }

  private extractEntities(message: string): OrchestrationEntity[] {
    const entities: OrchestrationEntity[] = [];
    const money = message.match(/\$?\s?\d[\d.,]*/);
    if (money) {
      entities.push({ type: "amount", value: money[0].trim() });
    }
    const uuid = message.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
    if (uuid) {
      entities.push({ type: "resourceId", value: uuid[0] });
    }
    return entities;
  }

  private selectAgents(
    interpretation: OrchestrationInterpretation,
    message: string,
    preferredAgents?: PrometeoAgentId[],
  ): PrometeoAgentId[] {
    if (preferredAgents?.length) {
      return [...new Set(preferredAgents)];
    }
    const normalized = message.toLowerCase();
    const matched = ALL_AGENT_IDS.filter((id) =>
      AGENTS[id].keywords.some((kw) => normalized.includes(kw)),
    );
    if (matched.length > 0) {
      return matched;
    }
    // Ambiguous: fall back to Pulse for a status-oriented clarification.
    return ["pulse"];
  }

  orchestrate(actor: OrchestrationActor, request: PrometeoOrchestrationRequest): PrometeoOrchestrationResponse {
    const orchestrationId = randomUUID();
    let status: OrchestrationStatus = "idle";

    status = nextOrchestrationStatus(status, "interpreting");
    const interpretation = this.interpret(request.message, request.preferredAgents);
    const ambiguous = interpretation.confidence < AMBIGUITY_THRESHOLD;

    status = ambiguous
      ? nextOrchestrationStatus(status, "ambiguity_resolving")
      : status;

    status = nextOrchestrationStatus(status, "agent_consultation");
    const agentIds = this.selectAgents(interpretation, request.message, request.preferredAgents);
    const agentsConsulted: OrchestrationAgentResult[] = agentIds.map((agentId) => {
      const reply = AGENTS[agentId].respond(request.message);
      return { agentId, status: "completed", result: { text: reply.text, actions: reply.actions } };
    });

    status = nextOrchestrationStatus(status, "execution");
    const steps: OrchestrationStep[] = agentIds.flatMap((agentId) =>
      AGENTS[agentId].respond(request.message).actions.map((a) => ({
        action: a.action,
        agent: agentId,
        parameters: { description: a.description, projectId: request.context?.projectId ?? null },
      })),
    );

    // A plan that mutates protected resources always requires explicit approval;
    // ambiguous intent also short-circuits to human approval.
    const mutatingActions = new Set(["budget.suggest", "evidence.request", "contract.review", "plan.build"]);
    const requiresApproval = ambiguous || steps.some((s) => mutatingActions.has(s.action));

    status = nextOrchestrationStatus(status, "completed");

    const record: OrchestrationRecord = {
      orchestrationId,
      tenantId: actor.tenantId,
      userId: actor.userId,
      status,
      currentStep: "completed",
      interpretation,
      agentsConsulted,
      plan: { steps },
      requiresApproval,
      errors: [],
      createdAt: new Date().toISOString(),
    };
    this.records.set(orchestrationId, record);

    this.logger.log(
      `prometeo.orchestration.completed id=${orchestrationId} user=${actor.userId} intent=${interpretation.intent} agents=${agentIds.join(",")}`,
    );

    return {
      orchestrationId,
      interpretation,
      agentsConsulted,
      plan: { steps },
      status,
      requiresApproval,
    };
  }

  consultAgent(
    actor: OrchestrationActor,
    agentId: PrometeoAgentId,
    request: AgentConsultationRequest,
  ): AgentConsultationResponse {
    const agent = AGENTS[agentId];
    const reply = agent.respond(request.query);
    const consultationId = randomUUID();
    this.logger.log(
      `prometeo.agent.explicit_access consultation=${consultationId} agent=${agentId} user=${actor.userId}`,
    );
    return {
      consultationId,
      agentId,
      agentResponse: reply.text,
      requiresAction: reply.requiresAction,
      suggestedActions: reply.actions,
    };
  }

  getOrchestration(actor: OrchestrationActor, orchestrationId: string): OrchestrationStatusResponse {
    const record = this.records.get(orchestrationId);
    if (!record || record.tenantId !== actor.tenantId) {
      throw new NotFoundException(`Orchestration ${orchestrationId} not found`);
    }
    const agentsStatus: Record<string, string> = {};
    for (const a of record.agentsConsulted) {
      agentsStatus[a.agentId] = a.status;
    }
    return {
      orchestrationId: record.orchestrationId,
      status: record.status,
      currentStep: record.currentStep,
      agentsStatus,
      result: { plan: record.plan, interpretation: record.interpretation },
      errors: record.errors,
    };
  }

  /** Exposed for tests / callers that need the list of specialist agents. */
  static agentIds(): PrometeoAgentId[] {
    return [...ALL_AGENT_IDS];
  }
}
