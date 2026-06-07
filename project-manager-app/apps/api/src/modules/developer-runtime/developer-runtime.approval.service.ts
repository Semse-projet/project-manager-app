import { Injectable } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import type {
  DeveloperRuntimeApprovalDecision,
  DeveloperRuntimeApprovalRequest,
  DeveloperRuntimeAutonomyLevel,
  DeveloperRuntimeExecutionStep,
} from "@semse/schemas";
import { requiresApprovalForDeveloperRuntimeTool } from "@semse/shared";

@Injectable()
export class DeveloperRuntimeApprovalService {
  getDefaultAutonomyLevel(): DeveloperRuntimeAutonomyLevel {
    return "safe-execution";
  }

  evaluateStep(
    step: DeveloperRuntimeExecutionStep,
    autonomyLevel: DeveloperRuntimeAutonomyLevel = this.getDefaultAutonomyLevel(),
  ) {
    return {
      autonomyLevel,
      approvalRequired: requiresApprovalForDeveloperRuntimeTool({
        tool: step.tool,
        riskLevel: step.riskLevel,
        autonomyLevel,
      }),
    };
  }

  buildApprovalRequests(input: {
    sessionId: string;
    plan: DeveloperRuntimeExecutionStep[];
  }): DeveloperRuntimeApprovalRequest[] {
    return input.plan
      .filter((step) => step.approvalRequired)
      .map((step) => ({
        id: randomUUID(),
        sessionId: input.sessionId,
        stepId: step.id,
        title: `Approve ${step.title}`,
        reason: `Step ${step.tool} requires approval because it is sensitive or exceeds safe autonomy.`,
        riskLevel: step.riskLevel,
        actionPreview: `${step.agent} -> ${step.tool} :: ${step.description}`,
        createdAt: new Date().toISOString(),
      }));
  }

  buildDecision(input: {
    requestId: string;
    approved: boolean;
    decidedBy: string;
    comment?: string;
  }): DeveloperRuntimeApprovalDecision {
    return {
      requestId: input.requestId,
      approved: input.approved,
      decidedAt: new Date().toISOString(),
      decidedBy: input.decidedBy,
      comment: input.comment,
    };
  }
}
