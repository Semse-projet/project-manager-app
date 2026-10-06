# Tasks — Universal Connector Trust Contract v1

## Governance
- [x] T01 Create SDD 2.0 spec.
- [x] T02 Create ADR-042.
- [x] T03 Create Receive-Driven traceability matrix.
- [x] T04 Create Analyze artifact.
- [x] T05 Create implementation plan, tasks and checklist.
- [x] T06 Consolidate/remove root/workspace duplicate authoritative artifact.
- [x] T07 Export canonical module from package owner.
- [ ] T08 Run/update `SPEC_INDEX.md`.
- [ ] T09 Pass `spec:validate:strict`.

## P0 enforcement
- [x] T10 Deny every non-ACTIVE connector status.
- [x] T11 Enforce capability-level minimum trust.
- [x] T12 Enforce delegation capability/scope/expiry/resource boundary/risk budget.
- [x] T13 Classify write-effect operations and block them in READ_ONLY.
- [x] T14 Enforce actor/runtime/resource/envelope tenant and context equality.
- [x] T15 Enforce capability/scope fail-closed checks.
- [x] T16 Enforce Policy/Approval fail-closed checks.
- [x] T17 Require idempotency key for writes.
- [x] T18 Enforce blast-radius limits and emergency controls.
- [x] T19 Keep external payloads outside the authority path.

## Canonical conformance tests
- [x] T20 Allow path authored.
- [x] T21 TENANT_MISMATCH authored.
- [ ] T22 Explicit ENVELOPE_TENANT_MISMATCH test still required.
- [x] T23 READ_ONLY authored.
- [x] T24 CAPABILITY_DENIED authored.
- [x] T25 SCOPE_DENIED authored.
- [x] T26 DELEGATION_DENIED/resource-boundary/risk authored.
- [x] T27 POLICY_DENIED authored.
- [x] T28 APPROVAL_REQUIRED authored.
- [x] T29 Full non-ACTIVE state matrix authored.
- [x] T30 trustLevel authored.
- [x] T31 prompt injection/external content cannot alter authority.
- [ ] T32 Secret scan evidence from CI.
- [x] T33 Idempotency same key x10 = one mutation.
- [ ] T34 Persistent checkpoint/recovery without duplicate mutation on a real adapter.
- [x] T35 Webhook bad signature/replay authored.
- [x] T36 Blast-radius/emergency-control deny authored.
- [ ] T37 Execute canonical suite successfully in CI.
- [ ] T38 Shared package typecheck/build green.

## Evidence
- [ ] T40 Generate evidence package for final release SHA.
- [ ] T41 Requirement matrix exported with execution evidence.
- [ ] T42 Tenant isolation/authz/agent-security evidence green.
- [ ] T43 Secret-scan/recovery/threat-model/exceptions/provenance recorded.

## Release
- [ ] T50 CI/typecheck/build/tests green on final HEAD.
- [ ] T51 Resolve review blockers.
- [ ] T52 Reconcile branch with current `main` and re-run gates.
- [ ] T53 Merge PR #797 to main.
- [ ] T54 Verify Railway deploy SHA for affected services.
- [ ] T55 Production health + runtime provenance green.
- [ ] T56 Authenticated functional smoke/canary.
- [ ] T57 Update production evidence and mark VERIFIED/CERTIFIED only if every applicable gate passes.

## Rule
A checked implementation/test-authoring task means the artifact exists in the branch. It does **not** mean CI, merge, deployment or production certification has passed.
