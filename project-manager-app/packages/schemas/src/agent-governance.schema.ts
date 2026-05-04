import { z } from "zod";

export const governedAgentTypeSchema = z.enum([
  "pricing",
  "job-planner",
  "trust-match",
  "evidence-coach",
  "risk",
  "dispute",
  "orchestrator",
  "ecv"
]);

export const governedAgentToolSchema = z.enum([
  "context.read.job",
  "context.read.market",
  "context.read.evidence",
  "context.read.dispute",
  "context.read.trust",
  "memory.read.agent",
  "decision.recommend",
  "decision.plan",
  "decision.classify_risk",
  "audit.record.agent",
  "event.emit.domain",
  "approval.request.human",
  "runtime.complete_run"
]);

export const governedAgentRiskLevelSchema = z.enum(["low", "medium", "high", "critical"]);
export const governedPolicyDecisionSchema = z.enum(["allow", "deny", "require_approval"]);

export const agentTypeParamSchema = z.object({
  agentType: governedAgentTypeSchema
});

export const agentPolicyEvaluationSchema = z.object({
  agentType: governedAgentTypeSchema,
  actionType: z.string().trim().min(1),
  toolName: governedAgentToolSchema.optional(),
  target: z.string().trim().min(1).optional(),
  targetKind: z.enum(["agent", "job", "milestone", "payment", "dispute", "policy", "runtime", "memory"]).optional(),
  requestedContextSources: z.array(z.enum(["event", "job", "market", "evidence", "dispute", "trust", "agent_memory"])).optional(),
  environment: z.enum(["api", "worker", "web", "test"]).optional()
});

export const agentApprovalIdParamSchema = z.object({
  approvalId: z.string().trim().min(1)
});

export const agentApprovalDecisionSchema = z.object({
  decision: z.enum(["approved", "rejected"]),
  comment: z.string().trim().max(500).optional()
});

export type GovernedAgentType = z.infer<typeof governedAgentTypeSchema>;
export type GovernedAgentTool = z.infer<typeof governedAgentToolSchema>;
export type GovernedPolicyDecision = z.infer<typeof governedPolicyDecisionSchema>;
