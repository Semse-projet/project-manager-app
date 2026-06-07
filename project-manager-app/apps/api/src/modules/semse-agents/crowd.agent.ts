import { Injectable, Logger } from "@nestjs/common";
import type { SemseAgentMessage } from "./semse-agents.service.js";
import { SemseAgentsService } from "./semse-agents.service.js";

export type PaymentDecision = {
  canRelease:   boolean;
  blockers:     string[];
  escrowStatus: "locked" | "pending_review" | "released" | "disputed";
  requiredActions: string[];
};

@Injectable()
export class CrowdAgent {
  private readonly logger = new Logger(CrowdAgent.name);

  constructor(private readonly bus: SemseAgentsService) {
    this.bus.register("crowd", (msg) => this.handleMessage(msg));
    this.logger.log("[Crowd] Agent registered");
  }

  async handleMessage(msg: SemseAgentMessage): Promise<void> {
    if (msg.event === "EVIDENCE_VERIFIED") {
      const approved = Boolean(msg.payload.approved);
      if (approved) {
        this.bus.dispatch(this.bus.makeMessage({
          from: "crowd", to: "prometeo", event: "PAYMENT_RELEASE_REQUESTED",
          payload: { readyForRelease: true, evidenceId: msg.payload.evidenceId },
          projectId: msg.projectId,
        }));
      } else {
        this.bus.dispatch(this.bus.makeMessage({
          from: "crowd", to: "evidence", event: "EVIDENCE_INSUFFICIENT",
          payload: { reason: "Evidence not approved by Crowd agent review" },
          projectId: msg.projectId,
        }));
      }
    }

    if (msg.event === "ESCROW_FUNDED") {
      this.logger.log(`[Crowd] Escrow funded for project ${msg.projectId}`);
    }
  }

  evaluatePaymentReadiness(input: {
    evidenceApproved: boolean;
    changeOrdersPending: number;
    disputeOpen: boolean;
    milestoneStatus: string;
  }): PaymentDecision {
    const blockers: string[] = [];
    if (!input.evidenceApproved)          blockers.push("Evidencia pendiente de aprobación");
    if (input.changeOrdersPending > 0)    blockers.push(`${input.changeOrdersPending} change order(s) pendiente(s)`);
    if (input.disputeOpen)                blockers.push("Disputa activa — no se puede liberar");
    if (input.milestoneStatus !== "submitted" && input.milestoneStatus !== "approved") {
      blockers.push(`Milestone en estado: ${input.milestoneStatus}`);
    }

    const canRelease = blockers.length === 0;
    const escrowStatus = input.disputeOpen ? "disputed"
      : canRelease ? "pending_review"
      : "locked";

    return {
      canRelease,
      blockers,
      escrowStatus,
      requiredActions: blockers.map((b) => `Resolver: ${b}`),
    };
  }
}
