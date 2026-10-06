# Analyze — Universal Connector Trust Contract v1

**Spec:** `platform.universal-connector-trust`  
**ADR:** ADR-042  
**Receive:** `universal-connector-trust.receive.md`  
**Plan:** `universal-connector-trust.plan.md`

## Purpose
Record the engineering analysis that turns the Universal Connector trust requirements into enforceable controls, tests, evidence, and release gates. This artifact is descriptive; Policy, Approval, Tool Registry, and the Business Kernel remain the canonical runtime authorities.

## Threat → control analysis

| Threat / failure mode | Required control | Enforcement / evidence |
|---|---|---|
| Cross-tenant access | actor, resource and envelope tenant equality | `TENANT_MISMATCH`, `ENVELOPE_TENANT_MISMATCH`; negative tests |
| Capability escalation | registered capability + exact operation + scope | `CAPABILITY_DENIED`, `SCOPE_DENIED`; conformance tests |
| Agent self-grant | bounded, non-transitive delegation with expiry | `DELEGATION_DENIED`; Prometeo/agent tests |
| Inactive/revoked connection used | ACTIVE-only execution | `CONNECTOR_INACTIVE`; state-matrix tests |
| Low-assurance connector performs sensitive action | minimum trust level per capability | `TRUST_LEVEL_DENIED`; trust-level tests |
| Runaway automation / excessive mutation | risk budget + blast-radius controls | `RISK_BUDGET_EXCEEDED`; volume/cost/action tests and emergency controls |
| Read-only connection mutates data | classify write-effect operations including sync-write | `READ_ONLY`; mutation tests |
| Policy bypass | external Policy decision is mandatory | `POLICY_DENIED`; deny-path tests |
| Approval bypass | explicit approval for required operations | `APPROVAL_REQUIRED`; approval tests |
| Duplicate delivery mutates repeatedly | idempotency key + durable dedupe semantics | x10 replay test and evidence |
| Crash/retry loses position | checkpoint/recovery semantics | recovery/replay test |
| Forged/replayed webhook | signature, timestamp/nonce, replay protection | webhook conformance evidence |
| External content becomes authority | external payload is untrusted data only | prompt-injection/data-is-not-authority tests |
| Secret disclosure | secrets referenced, never placed in envelopes/prompts/logs | secret scan + redaction tests |
| Operational emergency cannot be contained | kill switches and connection suspension | emergency-control tests/evidence |

## Architectural invariants
1. Provider adapters do not own Semse authorization policy.
2. A successful provider authentication never implies business authorization.
3. Prometeo and external agents are actors, not authorities; they cannot grant scopes, alter Policy, approve their own action, or receive provider credentials.
4. Canonical envelopes preserve tenant, connection, correlation, contract version, classification, and lineage metadata.
5. Raw external payload is evidence/source material, not trusted operational authority.
6. Writes fail closed when required identity, tenant, scope, delegation, Policy, Approval, connector status, trust level, or risk constraints are absent.
7. Exactly-once delivery is not assumed; mutation safety is achieved with idempotency/deduplication plus reconciliation/recovery.
8. SUSPENDED, REVOKED and QUARANTINED connections cannot execute.
9. READ_ONLY blocks any operation whose effective behavior can mutate external or canonical state.
10. Production certification requires executable evidence, not documentation alone.

## Current implementation assessment
The shared Universal Connector contract and enforcement layer establish the initial fail-closed boundary for tenant isolation, capability/scope checks, delegation, read-only mode, Policy and Approval. Runtime trust helpers cover executable status, trust ordering and risk-budget comparison. The module must remain exported from `@semse/shared` and tested through the repository's canonical test runner.

Items that remain release blockers until executable evidence exists: durable idempotency/recovery, webhook authenticity/replay protection, blast-radius runtime controls, secret-scan/redaction evidence, prompt-injection/data-authority conformance, complete connector-state matrix, and production canary evidence.

## Receive-Driven traceability rule
Every closure claim must have this complete chain:

`Requirement → Threat → Control → Enforcement → Test → Expected Result → Evidence`

A row is not complete when it has only documentation, implementation without a test, a test that is not executed by CI, or CI evidence from a different HEAD.

## Verification gates
- Spec metadata and paths validate under `pnpm spec:validate:strict` from the repository workspace.
- Related test paths exist and are discovered by the canonical test command.
- Shared package typecheck/build succeeds without adding an accidental test-framework dependency.
- All deny codes and allow paths have executable tests.
- Secret scan, idempotency/recovery, webhook/replay, agent-authority and blast-radius evidence exists.
- CI is green on the exact PR HEAD.
- Merge SHA is deployed to Railway and verified with health, provenance and functional canary/smoke evidence.
- Only after those gates may the spec move to VERIFIED/CERTIFIED semantics.

## Decision
Proceed incrementally on the existing Semse architecture. Do not create a parallel authorization, approval, business-kernel, or agent-tool system. Keep the connector provider-agnostic and make conformance evidence mandatory before enabling production writes.