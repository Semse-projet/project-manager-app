# Checklist — Universal Connector Trust Contract v1

## Documentation package
- [x] SDD 2.0 spec exists and is APPROVED.
- [x] ADR-042 records ownership and architectural boundaries.
- [x] Analyze exists.
- [x] Receive-Driven matrix exists.
- [x] Plan exists.
- [x] Tasks exist.
- [x] Checklist exists.
- [x] Duplicate authoritative architecture document outside governed workspace consolidated/removed.
- [ ] SPEC_INDEX regenerated from branch state.
- [ ] Strict spec validation passes.

## Security implementation
- [x] Actor/runtime/resource tenant boundary enforced.
- [x] Runtime connection/provider/trust/adoption binding enforced.
- [x] Cross-tenant envelope enforcement exists.
- [x] Missing capability/scope denied.
- [x] Delegation capability/scope/resource/risk/expiry gates exist.
- [x] Every non-ACTIVE state is non-executable.
- [x] READ_ONLY blocks write-effect operations.
- [x] Policy deny cannot be bypassed by connector code.
- [x] Required Approval cannot be bypassed by connector code.
- [x] Minimum trust level per capability exists.
- [x] External content is outside authority calculation.
- [x] Raw provider secret values are not part of connector execution contracts.
- [x] Writes require idempotency key.
- [x] Blast-radius limits exist.
- [x] Emergency stop / write disable / agent disable exist.

## Conformance test authoring
- [x] Allow path.
- [x] TENANT_MISMATCH.
- [ ] Explicit ENVELOPE_TENANT_MISMATCH case.
- [x] RUNTIME_MISMATCH.
- [x] CAPABILITY_DENIED.
- [x] SCOPE_DENIED.
- [x] READ_ONLY.
- [x] DELEGATION boundary/risk.
- [x] POLICY_DENIED.
- [x] APPROVAL_REQUIRED.
- [x] Full non-ACTIVE lifecycle matrix.
- [x] Trust-level denial.
- [x] External-content/prompt-injection authority attempt.
- [x] Idempotency x10 and changed-fingerprint rejection.
- [x] Webhook bad signature and replay.
- [x] Blast-radius and emergency-control denial.
- [ ] Stale webhook timestamp explicit test.
- [ ] Authentic webhook + Policy deny combined test.
- [ ] Real-adapter checkpoint/recovery test.
- [ ] Secret scan evidence.

## Reliability/containment evidence
- [ ] Interrupted sync resumes without duplicate mutation.
- [ ] Conflict preserves ambiguity; no blind last-write-wins.
- [ ] Webhook timestamp/signature/replay suite green.
- [ ] Blast-radius operational pause/quarantine verified.
- [ ] Emergency controls green in canonical CI.
- [ ] Reconciliation/compensation behavior evidenced on first integrated adapter.

## Release evidence
- [ ] Requirement matrix exported.
- [ ] Conformance results exported.
- [ ] Tenant isolation results exported.
- [ ] Authz results exported.
- [ ] Agent security results exported.
- [ ] Secret scan clean.
- [ ] Recovery results exported.
- [ ] Threat-model version recorded.
- [ ] Exceptions explicit (none implicit).
- [ ] Provenance tied to release SHA.

## Release
- [ ] Final CI green on exact reconciled HEAD.
- [ ] Branch reconciled with current `main`.
- [ ] No blocking review comments.
- [ ] PR #797 merged.
- [ ] Railway deploy successful for merged SHA.
- [ ] Runtime provenance gate green.
- [ ] Production health green.
- [ ] Functional canary/smoke green.
- [ ] Spec production evidence updated.
- [ ] Status promoted to VERIFIED/CERTIFIED only after every applicable gate above.

## Interpretation
A checked box in “Security implementation” or “Conformance test authoring” means the artifact exists in the branch. It does not assert CI, deployment or production verification.
