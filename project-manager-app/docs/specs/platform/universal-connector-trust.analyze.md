# Analyze — Universal Connector Trust Contract v1

**Spec:** `platform.universal-connector-trust`  
**ADR:** ADR-042  
**Receive:** `universal-connector-trust.receive.md`  
**Plan:** `universal-connector-trust.plan.md`  
**Tasks:** `universal-connector-trust.tasks.md`

## Purpose
Convert Universal Connector trust requirements into enforceable controls, executable conformance, evidence, and release gates. Policy, Approval, Tool Registry and Business Kernel remain the canonical runtime authorities.

## Threat → control analysis

| Threat / failure mode | Required control | Enforcement / evidence |
|---|---|---|
| Cross-tenant access | actor/runtime/resource/envelope tenant equality | `TENANT_MISMATCH`, `ENVELOPE_TENANT_MISMATCH` |
| Caller forges connection/trust/adoption | trusted control-plane runtime binding | `RUNTIME_MISMATCH` |
| Capability escalation | registered capability + exact operation + exact scope | `CAPABILITY_DENIED`, `SCOPE_DENIED` |
| Agent exceeds delegation | non-transitive delegation + expiry/resource/budget | `DELEGATION_DENIED`, `RISK_BUDGET_EXCEEDED` |
| Inactive connection executes | ACTIVE-only execution | `CONNECTOR_INACTIVE`; full state matrix |
| Low-assurance connector performs sensitive action | minimum trust per capability | `TRUST_LEVEL_DENIED` |
| Read-only connector mutates | write-effect classification | `READ_ONLY` |
| Policy bypass | canonical Policy decision mandatory | `POLICY_DENIED` |
| Approval bypass | explicit canonical Approval | `APPROVAL_REQUIRED` |
| Duplicate delivery mutates twice | idempotency key + fingerprint + atomic claim | x10 replay + fingerprint mismatch |
| Crash/retry duplicates work | durable idempotency + checkpoint/reconciliation | real-adapter recovery evidence |
| Forged/replayed webhook | timestamp + signature verifier + nonce claim | webhook trust tests |
| Authentic webhook becomes authority | ingress authenticity separated from business authz | webhook + Policy test |
| External content becomes authority | payload excluded from authority path | prompt-injection/data-not-authority test |
| Secret disclosure | opaque secret references + scan/redaction | secret scan evidence |
| Runaway automation | risk budget + blast radius | `BLAST_RADIUS_EXCEEDED` |
| Compromised connector cannot be stopped | emergency stop/write disable/agent disable/suspension | emergency-control tests |

## Architectural invariants
1. Provider adapters do not own Semse authorization policy.
2. Provider authentication never implies business authorization.
3. Prometeo/external agents are actors, not authorities.
4. Trusted connection status/trust/adoption comes from the control plane, never provider content.
5. External content is untrusted source material, never authority.
6. Writes fail closed if tenant, runtime binding, capability, scope, delegation, trust/risk, Policy, Approval or idempotency requirements fail.
7. Exactly-once delivery is not assumed.
8. Only ACTIVE is executable.
9. READ_ONLY blocks every write-effect operation.
10. Provider secrets are referenced, not transported through Prometeo/envelopes/logs.
11. Control plane and data plane remain separate.
12. Conflicts without sufficient authority remain explicit; blind LWW is not a safe default.
13. Production certification requires executable evidence on the exact release SHA.

## Current implementation assessment

### Implemented in branch
- Canonical contracts in `packages/shared/src/universal-connector/contracts.ts`.
- Trusted runtime binding and fail-closed enforcement.
- Capability/scope/trust/Policy/Approval enforcement.
- Delegation capability/scope/resource-boundary/expiry/risk controls.
- ACTIVE-only lifecycle enforcement.
- READ_ONLY write blocking.
- Idempotency contract/helper with tenant+connection+key+fingerprint semantics.
- Webhook timestamp/signature/replay trust contract.
- Blast-radius and emergency controls.
- Opaque secret-reference contract.
- Canonical `node:test` conformance suite under `tests/unit`.
- Public exports from `@semse/shared`.

### Authored but not yet accepted as evidence
The current conformance suite contains coverage for runtime mismatch, non-ACTIVE states, read-only, capability/scope, delegation boundary/risk, Policy/Approval, trust, idempotency x10, external-content authority attempt, webhook signature/replay, blast radius and emergency controls. These remain below TESTED until canonical CI passes on the exact candidate SHA.

### Remaining release evidence gaps
- Explicit envelope-tenant negative test.
- Stale webhook timestamp test.
- Authentic webhook + Policy DENY combined test.
- CI secret-scan result.
- Persistent real-adapter checkpoint/recovery/reconciliation evidence.
- Operational pause/quarantine behavior for blast-radius incident.
- First read-only adapter canary.
- Final evidence JSON package.
- Final CI after reconciliation with `main`.
- Merge + Railway deployment + runtime provenance + production smoke/canary.

## Secret model
`SecretReference` is intentionally opaque. Raw credentials are not part of the Universal Connector execution contract. CI/static scanning must still prove implementation and fixtures do not leak provider secrets.

## Idempotency/recovery model
`executeIdempotently` uses tenant+connection isolation, request fingerprint comparison, atomic claim semantics, replay of completed results and explicit in-progress/failed states. Production adapters must provide durable storage. This is mutation safety, not an exactly-once guarantee. Checkpoints, reconciliation and compensation remain required for long-running synchronization.

## Webhook trust model
Webhook verification is split into timestamp freshness, provider-specific signature verification, nonce replay claim, and downstream Policy/Approval. Passing webhook authenticity checks does not authorize a business mutation.

## Blast-radius model
Blast radius is independent from delegation risk budget. Limits may constrain actions, records, cost and envelopes per request. Emergency controls can disable writes, disable agents or stop the connector. Production pause/quarantine automation requires separate evidence.

## Receive-Driven traceability
`Requirement → Threat → Control → Enforcement → Test → Expected Result → Evidence`

Documentation or authored-but-unexecuted tests never satisfy Evidence.

## Verification gates
1. No duplicate authoritative connector document outside governed workspace.
2. `pnpm spec:index`.
3. `pnpm spec:validate:strict`.
4. Shared package typecheck/build.
5. Canonical unit tests.
6. Secret scan.
7. CI green on exact reconciled HEAD.
8. Review blockers resolved.
9. Merge SHA captured.
10. Railway deploy of merge SHA.
11. Runtime provenance + health.
12. Authenticated smoke/read-only canary.
13. Evidence package attached and delivery metadata updated.
14. Only then VERIFIED/CERTIFIED.

## Decision
Proceed incrementally on existing SEMSE architecture. Do not create parallel authorization, approval, Business Kernel or agent-tool systems. Provider-specific integrations adapt behind the Universal Connector boundary and gain write authority capability-by-capability only after conformance evidence.