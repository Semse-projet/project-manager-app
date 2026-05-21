import { Injectable, Logger, Optional } from "@nestjs/common";
import { SseEventBusService } from "../../infrastructure/sse/sse-event-bus.service.js";

// Local types — mirrors semse-agents.types.ts in packages/agents (not yet built)
export type SemseAgentName = "marketplace" | "buildops" | "protools" | "evidence" | "crowd" | "prometeo";
export type SemseAgentEvent =
  | "PROJECT_PUBLISHED" | "PROJECT_CLASSIFIED" | "CONTRACTOR_MATCHED" | "QUOTE_REQUESTED"
  | "ESTIMATE_REQUESTED" | "MATERIALS_CALCULATED" | "RISK_ASSESSED" | "CHECKLIST_GENERATED"
  | "PROJECT_PLANNED" | "MILESTONE_CREATED" | "TASK_ASSIGNED" | "MILESTONE_COMPLETED"
  | "DELAY_DETECTED" | "PROJECT_CLOSED"
  | "EVIDENCE_UPLOADED" | "EVIDENCE_VERIFIED" | "EVIDENCE_INSUFFICIENT"
  | "DISPUTE_PACKET_GENERATED" | "CHANGE_ORDER_APPROVED"
  | "ESCROW_FUNDED" | "PAYMENT_RELEASE_REQUESTED" | "PAYMENT_RELEASED"
  | "PAYMENT_HELD" | "INVOICE_GENERATED" | "REFUND_PROCESSED"
  | "CONTEXT_REQUESTED" | "NARRATIVE_GENERATED" | "RAG_QUERIED" | "TRADE_GUIDE_REQUESTED";

export type SemseAgentMessage = {
  from:          SemseAgentName;
  to:            SemseAgentName | "broadcast";
  event:         SemseAgentEvent;
  payload:       Record<string, unknown>;
  projectId:     string;
  milestoneId?:  string;
  timestamp:     Date;
  correlationId: string;
};

// ── Agent message bus (in-memory, fire-and-forget) ────────────────────────────

export type AgentHandlerFn = (msg: SemseAgentMessage) => Promise<void>;

export type AgentStatus = {
  name:        SemseAgentName;
  active:      boolean;
  processedMessages: number;
  lastEventAt?: string;
  errors:      number;
};

@Injectable()
export class SemseAgentsService {
  private readonly logger = new Logger(SemseAgentsService.name);

  // Handler registry: agentName → list of handlers
  private readonly handlers = new Map<SemseAgentName, AgentHandlerFn[]>();
  private readonly stats    = new Map<SemseAgentName, AgentStatus>();

  constructor(@Optional() private readonly sse?: SseEventBusService) {
    // Initialize stats for all known agents
    const agents: SemseAgentName[] = [
      "marketplace", "buildops", "protools", "evidence", "crowd", "prometeo",
    ];
    for (const name of agents) {
      this.stats.set(name, { name, active: false, processedMessages: 0, errors: 0 });
    }
  }

  // ── Message routing ────────────────────────────────────────────────────────

  /**
   * Dispatch a message from one agent to another (or broadcast).
   * Fire-and-forget: failures are logged but never thrown.
   */
  dispatch(msg: SemseAgentMessage): void {
    const targets: SemseAgentName[] = msg.to === "broadcast"
      ? [...this.handlers.keys()]
      : [msg.to];

    this.logger.debug(
      `[AgentBus] ${msg.from} → ${msg.to} event=${msg.event} corr=${msg.correlationId}`,
    );

    for (const target of targets) {
      const handlers = this.handlers.get(target) ?? [];
      for (const handler of handlers) {
        void this.safeCall(target, handler, msg);
      }
    }
  }

  private async safeCall(agent: SemseAgentName, fn: AgentHandlerFn, msg: SemseAgentMessage): Promise<void> {
    try {
      await fn(msg);
      const s = this.stats.get(agent)!;
      s.processedMessages++;
      s.lastEventAt = new Date().toISOString();
      s.active = true;
      // SSE: notify agents dashboard of message processed
      this.sse?.emit("agents:system", "agent:message", {
        agent, event: msg.event, from: msg.from, to: msg.to,
        projectId: msg.projectId, processedAt: s.lastEventAt,
        totalProcessed: s.processedMessages,
      });
    } catch (err) {
      const s = this.stats.get(agent)!;
      s.errors++;
      this.logger.warn(`[AgentBus] handler error agent=${agent} event=${msg.event}: ${(err as Error).message}`);
      this.sse?.emit("agents:system", "agent:error", {
        agent, event: msg.event, error: (err as Error).message,
      });
    }
  }

  // ── Handler registration ───────────────────────────────────────────────────

  register(agent: SemseAgentName, handler: AgentHandlerFn): void {
    const existing = this.handlers.get(agent) ?? [];
    existing.push(handler);
    this.handlers.set(agent, existing);
    const s = this.stats.get(agent)!;
    s.active = true;
    this.logger.log(`[AgentBus] registered handler for agent=${agent}`);
  }

  // ── Status ─────────────────────────────────────────────────────────────────

  getStatus(): AgentStatus[] {
    return [...this.stats.values()];
  }

  getAgentStatus(name: SemseAgentName): AgentStatus | undefined {
    return this.stats.get(name);
  }

  // ── Message factory ────────────────────────────────────────────────────────

  makeMessage(input: {
    from:        SemseAgentName;
    to:          SemseAgentName | "broadcast";
    event:       SemseAgentEvent;
    payload:     Record<string, unknown>;
    projectId:   string;
    milestoneId?: string;
  }): SemseAgentMessage {
    return {
      ...input,
      timestamp:     new Date(),
      correlationId: `${input.from}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    };
  }
}

