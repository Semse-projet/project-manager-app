# Checklist — Universal Connector Trust Contract v1

## Governance
- [x] SDD 2.0 exists and is APPROVED.
- [x] ADR-042 records architectural ownership and relationships.
- [x] Receive-Driven matrix exists.
- [x] Plan exists.
- [x] Tasks exist.
- [ ] No duplicate authoritative contract outside governed workspace.
- [ ] SPEC_INDEX generated/updated.
- [ ] Strict spec validation passes.

## Security P0
- [ ] Cross-tenant actor/connection denied.
- [ ] Cross-tenant envelope denied.
- [ ] Missing capability/scope denied.
- [ ] Excess/expired delegation denied.
- [ ] SUSPENDED/REVOKED/QUARANTINED denied.
- [ ] READ_ONLY blocks every write-effect operation.
- [ ] Policy deny cannot be bypassed.
- [ ] Required approval cannot be bypassed.
- [ ] Prometeo cannot self-authorize or receive provider secrets.
- [ ] External content/output cannot change authority.

## Reliability and containment
- [ ] Idempotency verified under 10 repeated requests.
- [ ] Interrupted sync resumes from checkpoint without duplicates.
- [ ] Conflict preserves ambiguity; no blind LWW.
- [ ] Webhook authenticity/replay/dedup verified.
- [ ] Blast-radius anomaly pauses/quarantines writes.
- [ ] Emergency controls verified.

## Evidence
- [ ] Requirement matrix complete.
- [ ] Conformance results complete.
- [ ] Tenant isolation results complete.
- [ ] Authz results complete.
- [ ] Agent security results complete.
- [ ] Secret scan clean.
- [ ] Recovery results complete.
- [ ] Threat model version recorded.
- [ ] Exceptions explicit (none implicit).
- [ ] Provenance tied to release SHA.

## Release
- [ ] Final CI green.
- [ ] No blocking review comments.
- [ ] PR #797 merged.
- [ ] Railway deploy successful for merged SHA.
- [ ] Runtime provenance gate green.
- [ ] Production health green.
- [ ] Functional canary/smoke green.
- [ ] Spec production evidence updated.
- [ ] Status promoted to VERIFIED/CERTIFIED only after all above.
