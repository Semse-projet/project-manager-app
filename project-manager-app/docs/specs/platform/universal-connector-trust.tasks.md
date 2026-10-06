# Tasks — Universal Connector Trust Contract v1

## Governance
- [x] T01 Create SDD 2.0 spec.
- [x] T02 Create ADR-042.
- [x] T03 Create Receive-Driven traceability matrix.
- [x] T04 Create implementation plan.
- [x] T05 Create tasks and checklist.
- [ ] T06 Remove root/workspace duplicate artifacts.
- [ ] T07 Export canonical module from package owner.
- [ ] T08 Run/update SPEC_INDEX.
- [ ] T09 Pass `spec:validate:strict`.

## P0 enforcement
- [ ] T10 Deny non-ACTIVE connector status.
- [ ] T11 Enforce trust-level minimum.
- [ ] T12 Enforce delegation risk budget and expiry.
- [ ] T13 Classify sync writes and block in READ_ONLY.
- [ ] T14 Preserve tenant/envelope fail-closed checks.
- [ ] T15 Preserve capability/scope fail-closed checks.
- [ ] T16 Preserve Policy/Approval fail-closed checks.

## Tests
- [ ] T20 Allow path.
- [ ] T21 TENANT_MISMATCH.
- [ ] T22 ENVELOPE_TENANT_MISMATCH.
- [ ] T23 READ_ONLY including sync-write.
- [ ] T24 CAPABILITY_DENIED.
- [ ] T25 SCOPE_DENIED.
- [ ] T26 DELEGATION_DENIED scope/expiry/risk.
- [ ] T27 POLICY_DENIED.
- [ ] T28 APPROVAL_REQUIRED.
- [ ] T29 SUSPENDED/REVOKED/QUARANTINED.
- [ ] T30 trustLevel.
- [ ] T31 prompt injection cannot alter authority.
- [ ] T32 provider secret scan.
- [ ] T33 idempotency same key x10 = one mutation.
- [ ] T34 checkpoint/recovery no duplicate mutation.
- [ ] T35 webhook replay/authenticity.
- [ ] T36 blast-radius pause/quarantine.

## Evidence and release
- [ ] T40 Generate evidence package.
- [ ] T41 CI/typecheck/build/tests green on final head.
- [ ] T42 Resolve review blockers.
- [ ] T43 Merge PR #797 to main.
- [ ] T44 Verify Railway deploy SHA for affected services.
- [ ] T45 Production health/provenance green.
- [ ] T46 Authenticated functional smoke/canary.
- [ ] T47 Update production evidence and mark VERIFIED/CERTIFIED only if all gates pass.
