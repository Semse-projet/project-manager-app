import type { CopilotProposedPlan } from "../plan-mode.types.js";
import type {
  CorpusStatusView,
  ProjectAgentContextView,
  ProjectWorkspaceView,
} from "./project-copilot.types.js";

export function buildProjectCopilotPromptContext(input: {
  projectId: string;
  workspace: ProjectWorkspaceView;
  context: ProjectAgentContextView;
  corpusStatus: CorpusStatusView;
  memoryContext?: string;
  prometeoContext?: string;
  operationalContext?: string;
  prometeoIntent?: string;
  routedAgent?: string;
  activePlan?: CopilotProposedPlan | null;
  activePlanContext?: string;
  coordinatorContext?: string;
  assistantTone?: string;
  assistantLanguage?: string;
  assistantVerbosity?: string;
  expertMode?: boolean;
}): Record<string, unknown> {
  const { projectId, workspace, context, corpusStatus } = input;

  return {
    projectId,
    projectTitle: workspace.title,
    projectStatus: workspace.status,
    escrowStatus: workspace.escrowStatus,
    escrowFunded: workspace.escrowFunded,
    escrowReleased: workspace.escrowReleased,
    preferredProfessionalUserId: workspace.preferredProfessional?.userId,
    preferredProfessionalName: workspace.preferredProfessional?.displayName,
    preferredProfessionalPublicSlug: workspace.preferredProfessional?.publicSlug ?? undefined,
    milestonesApproved: workspace.milestonesApproved,
    milestonesTotal: workspace.milestonesTotal,
    milestonesPending: Math.max(0, workspace.milestonesTotal - workspace.milestonesApproved),
    escrowGap: Math.max(0, workspace.escrowFunded - workspace.escrowReleased),
    openDisputeCount: context.openDisputeCount,
    corpusStatus: corpusStatus.status,
    corpusDocuments: corpusStatus.documentCount,
    corpusEvidence: corpusStatus.evidenceCount,
    pageContext: `project:${projectId}`,
    relevantMemorySummary: input.memoryContext || undefined,
    prometeoRagContext: input.prometeoContext || undefined,
    operationalContext: input.operationalContext || undefined,
    prometeoIntent: input.prometeoIntent || undefined,
    routedAgent: input.routedAgent || undefined,
    activePlanStatus: input.activePlan?.status,
    activePlanTitle: input.activePlan?.title,
    activePlanGoal: input.activePlan?.goal,
    activePlanProgressPercent: input.activePlan?.progress?.percent,
    activePlanReadySteps: input.activePlan?.progress?.readySteps,
    activePlanBlockedSteps: input.activePlan?.progress?.blockedSteps,
    activePlanContext: input.activePlanContext || undefined,
    coordinatorContext: input.coordinatorContext || undefined,
    assistantTone: input.assistantTone || undefined,
    assistantLanguage: input.assistantLanguage || undefined,
    assistantVerbosity: input.assistantVerbosity || undefined,
    expertMode: input.expertMode || undefined,
  };
}
