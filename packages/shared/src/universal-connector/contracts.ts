export const CONNECTOR_CONTRACT_VERSION = '1.0.0-draft.1' as const;

export type ActorType = 'HUMAN' | 'SERVICE' | 'AUTOMATION' | 'PROMETEO_AGENT' | 'EXTERNAL_AGENT';
export type TrustLevel = 'UNVERIFIED' | 'VERIFIED' | 'CERTIFIED' | 'HIGH_ASSURANCE';
export type AdoptionMode = 'READ_ONLY' | 'HYBRID' | 'MANAGED_MIGRATION' | 'FULL_CUTOVER';
export type ConnectorStatus = 'REQUESTED' | 'AUTHORIZED' | 'VERIFIED' | 'ACTIVE' | 'DEGRADED' | 'QUARANTINED' | 'SUSPENDED' | 'REVOKED';
export type ConnectorOperation = 'read' | 'create' | 'update' | 'delete' | 'sync' | 'migrate' | 'execute';

export interface ActorContext {
  tenantId: string;
  actorId: string;
  actorType: ActorType;
  sessionId?: string;
  requestId: string;
  correlationId: string;
  traceId: string;
}

export interface DelegationContext {
  delegatedBy: string;
  delegatedTo: string;
  purpose: string;
  capabilities: string[];
  scopes: string[];
  resourceBoundary?: string[];
  expiresAt?: string;
  riskBudget?: { maxActions?: number; maxRecords?: number; maxCostUsd?: number };
  approvalPolicy?: string;
  revocable: boolean;
}

export interface CapabilityOperation {
  enabled: boolean;
  requiresApproval?: boolean;
  risk?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}

export interface CapabilityDefinition {
  read?: CapabilityOperation;
  create?: CapabilityOperation;
  update?: CapabilityOperation;
  delete?: CapabilityOperation;
  sync?: CapabilityOperation;
  migrate?: CapabilityOperation;
  bulkRead?: boolean;
  events?: 'webhook' | 'polling' | 'snapshot' | 'none';
  maxPageSize?: number;
}

export interface CapabilityManifest {
  contractVersion: typeof CONNECTOR_CONTRACT_VERSION;
  provider: string;
  connectorVersion: string;
  capabilities: Record<string, CapabilityDefinition>;
}

export interface CanonicalDataEnvelope<TCanonical = unknown, TRaw = unknown> {
  envelopeId: string;
  tenantId: string;
  connectionId: string;
  provider: string;
  contractVersion: typeof CONNECTOR_CONTRACT_VERSION;
  schemaVersion: string;
  rawPayload?: TRaw;
  canonicalPayload: TCanonical;
  extensions?: Record<string, unknown>;
  lineage: {
    source: string;
    externalId?: string;
    sourceVersion?: string;
    receivedAt: string;
    transformations: string[];
    ancestors?: string[];
  };
  security: {
    classification: 'PUBLIC' | 'INTERNAL' | 'CONFIDENTIAL' | 'RESTRICTED';
    scopes: string[];
    authority: Record<string, string>;
    policyContext?: Record<string, unknown>;
    integrityHash?: string;
  };
  sync: {
    operation: ConnectorOperation;
    idempotencyKey: string;
    externalVersion?: string;
    checkpoint?: string;
    mode: AdoptionMode;
    conflictState?: 'NONE' | 'CONFLICT' | 'RESOLVED';
  };
  observability: { requestId: string; correlationId: string; traceId: string; auditRef?: string };
}

export interface ConnectorExecutionContext {
  actor: ActorContext;
  connectionId: string;
  provider: string;
  scopes: string[];
  trustLevel: TrustLevel;
  adoptionMode: AdoptionMode;
  delegation?: DelegationContext;
  idempotencyKey?: string;
}

export type PolicyDecision =
  | { decision: 'ALLOW'; policyId: string; reason: string }
  | { decision: 'DENY'; policyId: string; reason: string }
  | { decision: 'REQUIRE_APPROVAL'; policyId: string; reason: string; approvalClass: string };

export interface EffectiveAccess {
  tenantId: string;
  connectionId: string;
  provider: string;
  scopes: string[];
  agentScopes: string[];
  status: ConnectorStatus;
  trustLevel: TrustLevel;
  adoptionMode: AdoptionMode;
}

export interface SecurityEvent {
  eventId: string;
  tenantId: string;
  connectionId?: string;
  actorId?: string;
  severity: 'INFO' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  category: string;
  action: string;
  target?: string;
  decision?: 'ALLOW' | 'DENY' | 'QUARANTINE' | 'REQUIRE_APPROVAL';
  reason: string;
  requestId: string;
  correlationId: string;
  traceId: string;
  occurredAt: string;
}

export interface SyncCheckpoint { connectionId: string; stream: string; cursor: string; updatedAt: string }
export interface ConflictRecord<T = unknown> { id: string; tenantId: string; connectionId: string; field?: string; localValue: T; externalValue: T; status: 'OPEN' | 'RESOLVED'; createdAt: string }

export interface UniversalConnector {
  readonly provider: string;
  readonly version: string;
  getCapabilities(ctx: ConnectorExecutionContext): Promise<CapabilityManifest>;
  healthCheck(ctx: ConnectorExecutionContext): Promise<{ ok: boolean; checkedAt: string; detail?: string }>;
  readChanges(ctx: ConnectorExecutionContext, checkpoint?: SyncCheckpoint): Promise<{ envelopes: CanonicalDataEnvelope[]; checkpoint?: SyncCheckpoint }>;
  writeChanges(ctx: ConnectorExecutionContext, envelopes: CanonicalDataEnvelope[]): Promise<{ accepted: string[]; rejected: Array<{ envelopeId: string; reason: string }> }>;
}
