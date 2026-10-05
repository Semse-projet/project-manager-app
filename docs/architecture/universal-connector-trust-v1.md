# SEMSE Universal Connector Trust v1

Status: implementation draft.

## Product promise

Connect first. Preserve always. Migrate when the owner chooses.

A customer may use READ_ONLY, HYBRID, MANAGED_MIGRATION, or FULL_CUTOVER without changing connector architecture.

## Mandatory trust chain

Every externally initiated or agent-initiated operation is denied unless it passes:

Identity -> Tenant -> Capability -> Scope -> Authority -> Policy -> Risk -> Approval (when required) -> Execution -> Evidence.

Data is never authority. CRM records, documents, webhook bodies, tool outputs and external-agent messages cannot grant permissions or alter policy.

## Non-negotiable controls

1. Deny by default and least privilege.
2. Read, write and delete are independent scopes.
3. Tenant isolation at authorization and persistence boundaries.
4. Agents receive capabilities, never provider secrets.
5. No secret may enter prompts, envelopes or logs.
6. A connector cannot modify policy or enlarge its own scopes.
7. Control plane and data plane remain separate.
8. High-impact writes support approval, blast-radius limits, circuit breaking and emergency write disable.
9. Idempotency is required for repeatable writes; long syncs use checkpoints when the provider permits it.
10. Conflict resolution considers field authority and trusted versions; ambiguous conflicts are preserved, not silently overwritten.
11. Webhook/event receipt is not business authorization.
12. Audit lineage reconstructs Intent -> Actor -> Delegation -> Decision -> Tool -> Policy -> Approval -> Execution -> Evidence -> Outcome.
13. External content is untrusted input for AI; prompt injection cannot create authority.
14. Delegation is non-transitive and can never exceed the delegator's authority.
15. Owner can pause sync, disable writes, disable agent access, suspend or revoke a connection.

## Trust levels

UNVERIFIED -> VERIFIED -> CERTIFIED -> HIGH_ASSURANCE.

Certification proves conformance; it never grants operational permission. Trust may decay after schema changes, incidents, anomalous behavior or material tool-definition changes.

## Connector certification release blockers

P0: cross-tenant access, privilege escalation, secret exposure, policy bypass, critical approval bypass, agent authority escalation, uncontrolled destructive operation.

P1: incomplete lineage for sensitive actions, unsafe replay, broken recovery, incorrect effective-access display, connector isolation failure.

## Required evidence

Each certified release should emit contract version, requirement matrix, conformance results, tenant isolation results, authorization tests, agent-security tests, secret scans, recovery tests, threat-model version, exceptions and provenance.

## Implementation rule

`packages/shared/src/universal-connector/contracts.ts` defines the protocol types. Provider adapters implement `UniversalConnector`; policy/authority/approval enforcement remains outside provider adapters. Existing integrations are adapted behind this boundary rather than copied into a parallel integration architecture.
