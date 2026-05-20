export type SemseAgentName =
  | 'marketplace'
  | 'buildops'
  | 'protools'
  | 'evidence'
  | 'crowd'
  | 'prometeo'

export type SemseAgentEvent =
  // Marketplace
  | 'PROJECT_PUBLISHED'
  | 'PROJECT_CLASSIFIED'
  | 'CONTRACTOR_MATCHED'
  | 'QUOTE_REQUESTED'
  // ProTools
  | 'ESTIMATE_REQUESTED'
  | 'MATERIALS_CALCULATED'
  | 'RISK_ASSESSED'
  | 'CHECKLIST_GENERATED'
  // BuildOps
  | 'PROJECT_PLANNED'
  | 'MILESTONE_CREATED'
  | 'TASK_ASSIGNED'
  | 'MILESTONE_COMPLETED'
  | 'DELAY_DETECTED'
  | 'PROJECT_CLOSED'
  // Evidence
  | 'EVIDENCE_UPLOADED'
  | 'EVIDENCE_VERIFIED'
  | 'EVIDENCE_INSUFFICIENT'
  | 'DISPUTE_PACKET_GENERATED'
  | 'CHANGE_ORDER_APPROVED'
  // Crowd
  | 'ESCROW_FUNDED'
  | 'PAYMENT_RELEASE_REQUESTED'
  | 'PAYMENT_RELEASED'
  | 'PAYMENT_HELD'
  | 'INVOICE_GENERATED'
  | 'REFUND_PROCESSED'
  // Prometeo
  | 'EXPLANATION_REQUESTED'
  | 'RISK_INTERPRETED'
  | 'GUIDANCE_PROVIDED'
  | 'AGENT_ROUTED'
  // System
  | 'DISPUTE_OPENED'
  | 'DISPUTE_RESOLVED'
  | 'PROJECT_COMPLETED'

export interface SemseAgentDefinition {
  name: SemseAgentName
  displayName: string
  role: string
  capabilities: string[]
  forbiddenActions: string[]
  requiredInputs: string[]
  outputs: string[]
  integratesWith: SemseAgentName[]
  modules: string[]
}

export interface SemseAgentMessage {
  from: SemseAgentName
  to: SemseAgentName | 'broadcast'
  event: SemseAgentEvent
  payload: Record<string, unknown>
  projectId: string
  milestoneId?: string
  timestamp: Date
  correlationId: string
}

export interface SemseAgentContext {
  projectId: string
  tenantId: string
  userId: string
  role: 'client' | 'professional' | 'ops'
  activeAgents: SemseAgentName[]
  currentPhase: string
  currentMilestone?: string
}

export interface SemseAgentRunResult {
  agentName: SemseAgentName
  event: SemseAgentEvent
  success: boolean
  output: Record<string, unknown>
  nextEvents: SemseAgentEvent[]
  blockers: string[]
  explanation?: string
}

// Event routing table: which agent handles each event
export const AGENT_EVENT_ROUTING: Record<SemseAgentEvent, SemseAgentName[]> = {
  PROJECT_PUBLISHED:          ['marketplace', 'protools', 'buildops', 'crowd', 'evidence'],
  PROJECT_CLASSIFIED:         ['marketplace'],
  CONTRACTOR_MATCHED:         ['marketplace', 'buildops'],
  QUOTE_REQUESTED:            ['protools'],
  ESTIMATE_REQUESTED:         ['protools'],
  MATERIALS_CALCULATED:       ['protools', 'buildops', 'crowd'],
  RISK_ASSESSED:              ['protools', 'evidence'],
  CHECKLIST_GENERATED:        ['evidence'],
  PROJECT_PLANNED:            ['buildops'],
  MILESTONE_CREATED:          ['buildops', 'crowd', 'evidence'],
  TASK_ASSIGNED:              ['buildops'],
  MILESTONE_COMPLETED:        ['buildops', 'evidence', 'crowd'],
  DELAY_DETECTED:             ['buildops', 'prometeo', 'crowd'],
  PROJECT_CLOSED:             ['buildops', 'crowd', 'evidence'],
  EVIDENCE_UPLOADED:          ['evidence'],
  EVIDENCE_VERIFIED:          ['evidence', 'crowd'],
  EVIDENCE_INSUFFICIENT:      ['evidence', 'buildops', 'prometeo'],
  DISPUTE_PACKET_GENERATED:   ['evidence', 'prometeo'],
  CHANGE_ORDER_APPROVED:      ['evidence', 'buildops', 'crowd'],
  ESCROW_FUNDED:              ['crowd', 'prometeo'],
  PAYMENT_RELEASE_REQUESTED:  ['crowd', 'evidence'],
  PAYMENT_RELEASED:           ['crowd', 'buildops', 'prometeo'],
  PAYMENT_HELD:               ['crowd', 'prometeo'],
  INVOICE_GENERATED:          ['crowd'],
  REFUND_PROCESSED:           ['crowd', 'prometeo'],
  EXPLANATION_REQUESTED:      ['prometeo'],
  RISK_INTERPRETED:           ['prometeo'],
  GUIDANCE_PROVIDED:          ['prometeo'],
  AGENT_ROUTED:               ['prometeo'],
  DISPUTE_OPENED:             ['evidence', 'prometeo'],
  DISPUTE_RESOLVED:           ['evidence', 'crowd', 'prometeo'],
  PROJECT_COMPLETED:          ['buildops', 'crowd', 'evidence', 'marketplace'],
}
