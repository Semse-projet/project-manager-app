import { describe, expect, it } from 'vitest';
import type { CapabilityManifest, ConnectorExecutionContext } from './contracts.js';
import { enforceConnectorTrust, type ConnectorEnforcementRequest } from './enforcement.js';

const manifest: CapabilityManifest = {
  contractVersion: '1.0.0-draft.1',
  provider: 'test-provider',
  connectorVersion: '1.0.0',
  capabilities: {
    jobs: {
      read: { enabled: true },
      update: { enabled: true },
      delete: { enabled: true, requiresApproval: true },
      sync: { enabled: true },
    },
  },
};

function context(overrides: Partial<ConnectorExecutionContext> = {}): ConnectorExecutionContext {
  return {
    actor: {
      tenantId: 'tenant-a',
      actorId: 'actor-a',
      actorType: 'PROMETEO_AGENT',
      requestId: 'req-1',
      correlationId: 'corr-1',
      traceId: 'trace-1',
    },
    connectionId: 'conn-1',
    provider: 'test-provider',
    scopes: ['jobs.read', 'jobs.update', 'jobs.delete', 'jobs.sync'],
    trustLevel: 'VERIFIED',
    adoptionMode: 'HYBRID',
    ...overrides,
  };
}

function request(overrides: Partial<ConnectorEnforcementRequest> = {}): ConnectorEnforcementRequest {
  return {
    context: context(),
    manifest,
    capability: 'jobs',
    operation: 'read',
    resourceTenantId: 'tenant-a',
    policyDecision: { decision: 'ALLOW', policyId: 'policy-1', reason: 'allowed' },
    ...overrides,
  };
}

describe('enforceConnectorTrust P0', () => {
  it('allows an authorized operation', () => {
    expect(enforceConnectorTrust(request())).toEqual({ allowed: true });
  });

  it('denies cross-tenant resource access', () => {
    expect(enforceConnectorTrust(request({ resourceTenantId: 'tenant-b' }))).toMatchObject({ allowed: false, code: 'TENANT_MISMATCH' });
  });

  it('denies cross-tenant envelopes', () => {
    const envelope = {
      envelopeId: 'env-1', tenantId: 'tenant-b', connectionId: 'conn-1', provider: 'test-provider', contractVersion: '1.0.0-draft.1' as const, schemaVersion: '1', canonicalPayload: {},
      lineage: { source: 'test', receivedAt: new Date().toISOString(), transformations: [] },
      security: { classification: 'INTERNAL' as const, scopes: ['jobs.update'], authority: {} },
      sync: { operation: 'update' as const, idempotencyKey: 'idem-1', mode: 'HYBRID' as const },
      observability: { requestId: 'req-1', correlationId: 'corr-1', traceId: 'trace-1' },
    };
    expect(enforceConnectorTrust(request({ operation: 'update', envelopes: [envelope] }))).toMatchObject({ allowed: false, code: 'ENVELOPE_TENANT_MISMATCH' });
  });

  it('denies writes in READ_ONLY mode', () => {
    expect(enforceConnectorTrust(request({ context: context({ adoptionMode: 'READ_ONLY' }), operation: 'update' }))).toMatchObject({ allowed: false, code: 'READ_ONLY' });
  });

  it('denies disabled or absent capability operations', () => {
    expect(enforceConnectorTrust(request({ capability: 'payments' }))).toMatchObject({ allowed: false, code: 'CAPABILITY_DENIED' });
  });

  it('denies missing scopes', () => {
    expect(enforceConnectorTrust(request({ context: context({ scopes: [] }) }))).toMatchObject({ allowed: false, code: 'SCOPE_DENIED' });
  });

  it('denies delegation without the required capability', () => {
    expect(enforceConnectorTrust(request({ context: context({ delegation: { delegatedBy: 'owner', delegatedTo: 'actor-a', purpose: 'test', capabilities: [], scopes: ['jobs.read'], revocable: true } }) }))).toMatchObject({ allowed: false, code: 'DELEGATION_DENIED' });
  });

  it('denies expired delegation', () => {
    expect(enforceConnectorTrust(request({ context: context({ delegation: { delegatedBy: 'owner', delegatedTo: 'actor-a', purpose: 'test', capabilities: ['jobs'], scopes: ['jobs.read'], expiresAt: '2000-01-01T00:00:00.000Z', revocable: true } }) }))).toMatchObject({ allowed: false, code: 'DELEGATION_DENIED' });
  });

  it('denies policy DENY decisions', () => {
    expect(enforceConnectorTrust(request({ policyDecision: { decision: 'DENY', policyId: 'policy-1', reason: 'blocked' } }))).toMatchObject({ allowed: false, code: 'POLICY_DENIED' });
  });

  it('requires approval when policy requires it', () => {
    expect(enforceConnectorTrust(request({ policyDecision: { decision: 'REQUIRE_APPROVAL', policyId: 'policy-1', reason: 'high risk', approvalClass: 'HUMAN' } }))).toMatchObject({ allowed: false, code: 'APPROVAL_REQUIRED' });
  });

  it('requires approval when the capability requires it', () => {
    expect(enforceConnectorTrust(request({ operation: 'delete' }))).toMatchObject({ allowed: false, code: 'APPROVAL_REQUIRED' });
  });

  it('allows an approved capability operation', () => {
    expect(enforceConnectorTrust(request({ operation: 'delete', approvalGranted: true }))).toEqual({ allowed: true });
  });
});
