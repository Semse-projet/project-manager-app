import type {
  CanonicalDataEnvelope,
  CapabilityManifest,
  ConnectorExecutionContext,
  ConnectorOperation,
  ConnectorRuntimeState,
  PolicyDecision,
  RiskUsage,
} from './contracts.js';
import { exceedsRiskBudget, isExecutableConnectorStatus, satisfiesTrustLevel } from './runtime-trust.js';

export interface ConnectorEnforcementRequest {
  context: ConnectorExecutionContext;
  runtime: ConnectorRuntimeState;
  manifest: CapabilityManifest;
  capability: string;
  operation: ConnectorOperation;
  resourceTenantId: string;
  resourceId?: string;
  projectedUsage?: RiskUsage;
  envelopes?: readonly CanonicalDataEnvelope[];
  policyDecision: PolicyDecision;
  approvalGranted?: boolean;
}

export type ConnectorEnforcementCode =
  | 'RUNTIME_MISMATCH'
  | 'CONNECTOR_INACTIVE'
  | 'EMERGENCY_STOP'
  | 'WRITES_DISABLED'
  | 'AGENT_ACCESS_DISABLED'
  | 'TRUST_LEVEL_DENIED'
  | 'RISK_BUDGET_EXCEEDED'
  | 'BLAST_RADIUS_EXCEEDED'
  | 'TENANT_MISMATCH'
  | 'SCOPE_DENIED'
  | 'CAPABILITY_DENIED'
  | 'READ_ONLY'
  | 'DELEGATION_DENIED'
  | 'POLICY_DENIED'
  | 'APPROVAL_REQUIRED'
  | 'ENVELOPE_TENANT_MISMATCH'
  | 'ENVELOPE_CONTEXT_MISMATCH'
  | 'IDEMPOTENCY_REQUIRED';

export type ConnectorEnforcementResult =
  | { allowed: true }
  | { allowed: false; code: ConnectorEnforcementCode; reason: string };

const writeOperations = new Set<ConnectorOperation>(['create', 'update', 'delete', 'sync', 'migrate', 'execute']);
const agentTypes = new Set(['PROMETEO_AGENT', 'EXTERNAL_AGENT']);

export function enforceConnectorTrust(req: ConnectorEnforcementRequest): ConnectorEnforcementResult {
  const { context, runtime, manifest, capability, operation, resourceTenantId, envelopes = [], policyDecision } = req;

  // Tenant isolation is checked before exposing connection lifecycle details.
  if (context.actor.tenantId !== resourceTenantId || runtime.tenantId !== context.actor.tenantId) {
    return deny('TENANT_MISMATCH', 'Actor, runtime connection and target resource must belong to the same tenant');
  }
  if (runtime.connectionId !== context.connectionId || runtime.provider !== context.provider || manifest.provider !== context.provider) {
    return deny('RUNTIME_MISMATCH', 'Execution context does not match trusted connection state and manifest');
  }
  if (envelopes.some((item) => item.tenantId !== context.actor.tenantId)) {
    return deny('ENVELOPE_TENANT_MISMATCH', 'Cross-tenant envelope rejected');
  }
  if (envelopes.some((item) => item.connectionId !== context.connectionId || item.provider !== context.provider)) {
    return deny('ENVELOPE_CONTEXT_MISMATCH', 'Envelope connection/provider does not match execution context');
  }

  if (!isExecutableConnectorStatus(runtime.status)) {
    return deny('CONNECTOR_INACTIVE', `Connector status ${runtime.status} is not executable`);
  }
  if (runtime.emergency?.emergencyStop) return deny('EMERGENCY_STOP', 'Connector emergency stop is active');
  if (runtime.emergency?.agentAccessDisabled && agentTypes.has(context.actor.actorType)) {
    return deny('AGENT_ACCESS_DISABLED', 'Agent access is disabled for this connector');
  }

  const isWrite = writeOperations.has(operation);
  if (isWrite && runtime.emergency?.writesDisabled) return deny('WRITES_DISABLED', 'Connector writes are disabled');
  if (runtime.adoptionMode === 'READ_ONLY' && isWrite) return deny('READ_ONLY', 'Write denied while connector is read-only');
  if (context.adoptionMode !== runtime.adoptionMode || context.trustLevel !== runtime.trustLevel) {
    return deny('RUNTIME_MISMATCH', 'Caller-supplied trust/adoption state does not match trusted runtime state');
  }

  const definition = manifest.capabilities[capability];
  const capabilityOperation = definition?.[operation as keyof typeof definition];
  if (!definition || typeof capabilityOperation !== 'object' || !('enabled' in capabilityOperation) || !capabilityOperation.enabled) {
    return deny('CAPABILITY_DENIED', 'Capability operation is not enabled');
  }
  if (capabilityOperation.minimumTrustLevel && !satisfiesTrustLevel(runtime.trustLevel, capabilityOperation.minimumTrustLevel)) {
    return deny('TRUST_LEVEL_DENIED', `Trust level ${runtime.trustLevel} does not satisfy ${capabilityOperation.minimumTrustLevel}`);
  }

  const requiredScope = `${capability}.${operation}`;
  if (!context.scopes.includes(requiredScope)) return deny('SCOPE_DENIED', `Missing scope ${requiredScope}`);

  if (isWrite && !context.idempotencyKey?.trim()) return deny('IDEMPOTENCY_REQUIRED', 'Write operations require an idempotency key');
  if (isWrite && envelopes.some((item) => item.sync.idempotencyKey !== context.idempotencyKey)) {
    return deny('ENVELOPE_CONTEXT_MISMATCH', 'Envelope idempotency key does not match execution context');
  }

  if (context.delegation) {
    const delegation = context.delegation;
    if (delegation.delegatedTo !== context.actor.actorId || !delegation.capabilities.includes(capability) || !delegation.scopes.includes(requiredScope)) {
      return deny('DELEGATION_DENIED', 'Delegation does not grant this operation');
    }
    if (delegation.expiresAt && Date.parse(delegation.expiresAt) <= Date.now()) return deny('DELEGATION_DENIED', 'Delegation has expired');
    if (req.resourceId && delegation.resourceBoundary?.length && !delegation.resourceBoundary.includes(req.resourceId)) {
      return deny('DELEGATION_DENIED', 'Target resource is outside the delegated boundary');
    }
    if (exceedsRiskBudget(delegation.riskBudget, req.projectedUsage)) return deny('RISK_BUDGET_EXCEEDED', 'Delegation risk budget exceeded');
  }

  if (runtime.blastRadius?.maxEnvelopesPerRequest !== undefined && envelopes.length > runtime.blastRadius.maxEnvelopesPerRequest) {
    return deny('BLAST_RADIUS_EXCEEDED', 'Envelope count exceeds connector blast-radius limit');
  }
  if (exceedsRiskBudget(runtime.blastRadius, req.projectedUsage)) return deny('BLAST_RADIUS_EXCEEDED', 'Projected usage exceeds connector blast-radius limit');

  if (policyDecision.decision === 'DENY') return deny('POLICY_DENIED', policyDecision.reason);
  if (policyDecision.decision === 'REQUIRE_APPROVAL' && !req.approvalGranted) return deny('APPROVAL_REQUIRED', policyDecision.reason);
  if (capabilityOperation.requiresApproval && !req.approvalGranted) return deny('APPROVAL_REQUIRED', 'Capability requires explicit approval');
  return { allowed: true };
}

function deny(code: ConnectorEnforcementCode, reason: string): ConnectorEnforcementResult {
  return { allowed: false, code, reason };
}
