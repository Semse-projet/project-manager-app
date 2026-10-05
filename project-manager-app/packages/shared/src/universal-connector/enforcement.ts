import type { CanonicalDataEnvelope, CapabilityManifest, ConnectorExecutionContext, ConnectorOperation, PolicyDecision } from './contracts.js';

export interface ConnectorEnforcementRequest {
  context: ConnectorExecutionContext;
  manifest: CapabilityManifest;
  capability: string;
  operation: ConnectorOperation;
  resourceTenantId: string;
  envelopes?: readonly CanonicalDataEnvelope[];
  policyDecision: PolicyDecision;
  approvalGranted?: boolean;
}

export type ConnectorEnforcementResult = { allowed: true } | { allowed: false; code: 'TENANT_MISMATCH' | 'SCOPE_DENIED' | 'CAPABILITY_DENIED' | 'READ_ONLY' | 'DELEGATION_DENIED' | 'POLICY_DENIED' | 'APPROVAL_REQUIRED' | 'ENVELOPE_TENANT_MISMATCH'; reason: string };

const writeOperations = new Set<ConnectorOperation>(['create', 'update', 'delete', 'migrate', 'execute']);

export function enforceConnectorTrust(req: ConnectorEnforcementRequest): ConnectorEnforcementResult {
  const { context, manifest, capability, operation, resourceTenantId, envelopes = [], policyDecision } = req;
  if (context.actor.tenantId !== resourceTenantId) return deny('TENANT_MISMATCH', 'Actor tenant does not own the target resource');
  if (envelopes.some((item) => item.tenantId !== context.actor.tenantId)) return deny('ENVELOPE_TENANT_MISMATCH', 'Cross-tenant envelope rejected');
  if (context.adoptionMode === 'READ_ONLY' && writeOperations.has(operation)) return deny('READ_ONLY', 'Write denied while connector is read-only');

  const definition = manifest.capabilities[capability];
  const capabilityOperation = definition?.[operation as keyof typeof definition];
  if (!definition || typeof capabilityOperation !== 'object' || !('enabled' in capabilityOperation) || !capabilityOperation.enabled) return deny('CAPABILITY_DENIED', 'Capability operation is not enabled');

  const requiredScope = `${capability}.${operation}`;
  if (!context.scopes.includes(requiredScope)) return deny('SCOPE_DENIED', `Missing scope ${requiredScope}`);

  if (context.delegation) {
    if (context.delegation.delegatedTo !== context.actor.actorId || !context.delegation.capabilities.includes(capability) || !context.delegation.scopes.includes(requiredScope)) return deny('DELEGATION_DENIED', 'Delegation does not grant this operation');
    if (context.delegation.expiresAt && Date.parse(context.delegation.expiresAt) <= Date.now()) return deny('DELEGATION_DENIED', 'Delegation has expired');
  }

  if (policyDecision.decision === 'DENY') return deny('POLICY_DENIED', policyDecision.reason);
  if (policyDecision.decision === 'REQUIRE_APPROVAL' && !req.approvalGranted) return deny('APPROVAL_REQUIRED', policyDecision.reason);
  if (capabilityOperation.requiresApproval && !req.approvalGranted) return deny('APPROVAL_REQUIRED', 'Capability requires explicit approval');
  return { allowed: true };
}

function deny(code: Exclude<ConnectorEnforcementResult, { allowed: true }>['code'], reason: string): ConnectorEnforcementResult { return { allowed: false, code, reason }; }
