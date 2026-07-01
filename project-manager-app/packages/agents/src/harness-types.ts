/**
 * Canonical governance types for the SEMSE Agent Harness (F4).
 *
 * These mirror the contracts defined in
 * docs/agents/harnesses/SEMSE_ECOSYSTEM_WORK_AGENT_HARNESS_2026-06-28.md
 * and form the single source of truth for WorkItem, AgentManifest, and
 * DecisionPackage throughout the codebase.
 */

export type HarnessRiskLevel = "L0" | "L1" | "L2" | "L3" | "L4";

export type HarnessOutputSchema =
  | "FindingReport"
  | "PatchPlan"
  | "DecisionPackage";

export type HarnessRecommendation =
  | "approve"
  | "revise"
  | "reject"
  | "defer";

/**
 * A unit of work opened by a human and dispatched to one or more agents.
 * L2+ work items require a DecisionPackage before any merge or mutation.
 */
export type WorkItem = {
  id: string;
  objective: string;
  riskLevel: HarnessRiskLevel;
  services: string[];
  humanOwner: string;
  suggestedAgents: string[];
  contextRefs: string[];
  allowedTools: string[];
  forbiddenTools: string[];
  acceptanceCriteria: string[];
  rollbackRequired: boolean;
};

/**
 * Manifest for a technical or professional agent in the SEMSE harness.
 * Distinct from RuntimeAgentManifest (execution machinery) — this describes
 * what the agent is allowed to read/write and its max autonomous risk level.
 */
export type AgentManifest = {
  key: string;
  role: string;
  domain: string[];
  canRead: string[];
  canWrite: string[];
  tools: string[];
  maxRiskWithoutHumanApproval: "L0" | "L1" | "L2";
  outputSchema: HarnessOutputSchema;
};

/**
 * Consolidated output package for any WorkItem at risk level L2 or above.
 * A human must approve, reject, or defer before the recommendation is enacted.
 */
export type DecisionPackage = {
  workItemId: string;
  recommendation: HarnessRecommendation;
  summary: string;
  evidence: string[];
  risks: string[];
  tests: string[];
  rolloutPlan: string[];
  rollbackPlan: string[];
  humanDecisionRequired: boolean;
};

/**
 * Structured output from a single agent within a WorkItem execution.
 * Collected by the coordinator before emitting a DecisionPackage.
 */
export type AgentFindingReport = {
  agentKey: string;
  workItemId: string;
  contextRead: string[];
  findings: string[];
  recommendation: string;
  risks: string[];
  validation: string[];
  handoff: string[];
};
