export const forgeRiskLevels = ["low", "medium", "high", "critical"] as const;
export type ForgeRiskLevel = (typeof forgeRiskLevels)[number];

export const forgeRunStates = [
  "idea",
  "intake",
  "spec_draft",
  "spec_review",
  "approved",
  "planned",
  "building",
  "verifying",
  "ready_for_review",
  "merged",
  "deployed",
  "observing",
  "closed",
  "blocked",
  "rolled_back"
] as const;
export type ForgeRunState = (typeof forgeRunStates)[number];

export const forgeAgentRoles = [
  "forge-supervisor",
  "spec-architect",
  "domain-architect",
  "creator-mentor",
  "ux-composer",
  "data-engineer",
  "backend-builder",
  "frontend-builder",
  "integration-engineer",
  "qa-verifier",
  "security-reviewer",
  "devops-release",
  "documentation-curator",
  "governance-auditor"
] as const;
export type ForgeAgentRole = (typeof forgeAgentRoles)[number];

export const forgeToolNames = [
  "repo.read",
  "repo.search",
  "spec.read",
  "spec.write",
  "task.plan",
  "code.write",
  "test.write",
  "command.run",
  "schema.propose",
  "migration.propose",
  "pr.prepare",
  "deployment.propose",
  "marketplace.publish.propose",
  "audit.record",
  "approval.request"
] as const;
export type ForgeToolName = (typeof forgeToolNames)[number];

export type ForgeApprovalMode =
  | "none"
  | "creator_review"
  | "ops_admin"
  | "security"
  | "dual_control";

export type ForgeAgentManifest = {
  id: string;
  role: ForgeAgentRole;
  name: string;
  version: string;
  status: "active" | "preview" | "disabled";
  description: string;
  owner: string;
  allowedTools: ForgeToolName[];
  allowedActions: string[];
  fileScopes: string[];
  networkScopes: string[];
  maxRiskLevel: ForgeRiskLevel;
  approvalMode: ForgeApprovalMode;
  modelClass: "reasoning" | "coding" | "vision" | "lightweight";
  tags: string[];
};

export type ForgeSpecReference = {
  id: string;
  path: string;
  digest: string;
  status: "DRAFT" | "REVIEW" | "APPROVED" | "IMPLEMENTED" | "VERIFIED";
};

export type ForgeAcceptanceCriterion = {
  id: string;
  statement: string;
  verification: string;
  required: boolean;
};

export type ForgeTaskPacket = {
  id: string;
  title: string;
  spec: ForgeSpecReference;
  requestedRole: ForgeAgentRole;
  riskLevel: ForgeRiskLevel;
  objective: string;
  allowedFiles: string[];
  forbiddenFiles: string[];
  allowedCommands: string[];
  acceptanceCriteria: ForgeAcceptanceCriterion[];
  dependencies: string[];
  targetBranch: string;
  environment: "sandbox" | "local" | "ci" | "staging" | "production";
  metadata: Record<string, string>;
};

export type ForgePolicyDecision = "allow" | "deny" | "require_approval";

export type ForgePolicyResult = {
  decision: ForgePolicyDecision;
  reason: string;
  riskLevel: ForgeRiskLevel;
  requiredApprovals: ForgeApprovalMode[];
  violatedPolicies: string[];
  auditTags: string[];
};

export type ForgeEvent = {
  id: string;
  type:
    | "FORGE_RUN_CREATED"
    | "FORGE_SPEC_DRAFTED"
    | "FORGE_SPEC_APPROVED"
    | "FORGE_TASK_ASSIGNED"
    | "FORGE_TASK_QUEUED"
    | "FORGE_CHANGE_PROPOSED"
    | "FORGE_SANDBOX_PLANNED"
    | "FORGE_PATCH_PROPOSED"
    | "FORGE_PATCH_SIMULATED"
    | "FORGE_TOOLS_PLANNED"
    | "FORGE_VERIFICATION_COMPLETED"
    | "FORGE_HUMAN_REVIEW_REQUESTED"
    | "FORGE_PR_READY"
    | "FORGE_DEPLOYMENT_PROPOSED"
    | "FORGE_RUN_BLOCKED"
    | "FORGE_RUN_ROLLED_BACK"
    | "CREATOR_BLUEPRINT_CREATED"
    | "CREATOR_APP_PUBLICATION_PROPOSED";
  runId: string;
  timestamp: string;
  actor: string;
  detail: Record<string, unknown>;
};

export type ForgeRun = {
  id: string;
  title: string;
  state: ForgeRunState;
  spec: ForgeSpecReference;
  tasks: ForgeTaskPacket[];
  assignedAgents: Partial<Record<ForgeAgentRole, string[]>>;
  approvals: Array<{
    mode: ForgeApprovalMode;
    status: "pending" | "approved" | "rejected";
    actor?: string;
    at?: string;
  }>;
  events: ForgeEvent[];
  agentRunIds: string[];
  createdAt: string;
  updatedAt: string;
};

export type ForgeVerificationItem = {
  id: string;
  command: string;
  required: boolean;
  status: "pending" | "passed" | "failed" | "skipped";
  evidence?: string;
};

export type ForgeVerificationMatrix = {
  runId: string;
  items: ForgeVerificationItem[];
  passed: boolean;
  completedAt?: string;
};

export type ForgePRPackage = {
  mode: "dry-run" | "live";
  decision: "allow" | "deny" | "require_approval";
  reason: string;
  title: string;
  body: string;
  baseBranch: string;
  headBranch: string;
  commits: Array<{
    message: string;
    files: string[];
    body?: string;
  }>;
  changedFiles: string[];
  reviewers: string[];
  labels: string[];
  draft: boolean;
  checklist: string[];
  requiredApprovals: ForgeApprovalMode[];
  violations: string[];
  auditTags: string[];
};

export type ForgeDeploymentPlan = {
  mode: "dry-run" | "live";
  decision: "allow" | "deny" | "require_approval";
  reason: string;
  environment: string;
  targetBranch: string;
  steps: string[];
  requiredApprovals: ForgeApprovalMode[];
  violations: string[];
  auditTags: string[];
};

export type CreatorAppType =
  | "course"
  | "simulator"
  | "calculator"
  | "field_tool"
  | "assessment"
  | "agent"
  | "workflow"
  | "hybrid";

export type CreatorAppBlueprint = {
  id: string;
  creatorId: string;
  creatorRole: "professor" | "expert" | "institution" | "developer";
  title: string;
  summary: string;
  domain: string;
  audience: string[];
  appType: CreatorAppType;
  learningObjectives: string[];
  knowledgeSources: Array<{
    type: "interview" | "document" | "video" | "dataset" | "manual" | "link";
    reference: string;
    rightsConfirmed: boolean;
  }>;
  modules: Array<{
    id: string;
    title: string;
    purpose: string;
    capabilities: string[];
  }>;
  assessments: Array<{
    id: string;
    type: "quiz" | "practical" | "evidence" | "simulation" | "oral";
    passRule: string;
  }>;
  monetization: {
    model: "free" | "one_time" | "subscription" | "institutional" | "revenue_share";
    priceCents?: number;
    currency?: string;
  };
  visibility: "private" | "organization" | "marketplace";
  dataClassification: "public" | "internal" | "confidential" | "regulated";
  languages: string[];
};
