---
type: plan
feature: "Change order organization isolation"
domain: "change-orders"
spec: "docs/specs/api/change-orders.spec.md"
version: "2.0"
status: "APPROVED"
branch: "fix/remediation-change-order-org-scope-20260919"
date: "2026-09-19"
---

# Remediation plan

## Authority and snapshot

Repair the approved Change Orders API under DOMAIN_INVARIANTS: tenant alone
does not authorize access. User requested continuing ecosystem remediation.
Base: origin/main `5f5b9c09`. Production state not observed in this slice.

## Access contract

- Jobs: client organization or the project's assigned professional organization.
- BuildOps-only references: BuildOpsProject.orgId.
- Milestone-only references: parent project's client or assigned professional.
- Every supplied link must exist in the actor's tenant and be accessible; an
  owned link must not conceal another unauthorized link. Orphans fail closed.
- OPS_ADMIN retains tenant-wide access. Creation still validates referenced
  resources inside that tenant.
- Apply the policy to lists, creation and the shared individual lookup used by
  lifecycle/impact/risk endpoints. Permission decorators remain authoritative.
- Denied direct access returns 404; lists omit inaccessible rows before limit.

## Implementation

ChangeOrderCandidate stores scalar references without Prisma relations. Resolve
authorized IDs with tenant/org-scoped Prisma queries, then combine optional-link
filters with AND. Narrow parent queries to provided references on single-record
operations. No schema change, migration, new dependency or endpoint.

## Tests and delivery

Run behavior tests against the actual compiled service, first red then green:
client/pro/admin, foreign org/tenant, BuildOps and milestone-only records,
mixed links, orphans, creation without writes on denial, list limit and all
individual endpoints. Run API build, relevant regression, lint and SDD validation.
Record full coverage outcome before any PR. CI/merge/deploy/canary remain separate.

## Boundaries and rollback

No change to escrow arithmetic, release policy, transitions, event names or
infrastructure. Revert this slice to roll back; doing so reopens authorization
gaps. Tenant-wide SSE payload delivery is separate follow-up work. Large org ID
sets may eventually require database relations or an EXISTS query; no N+1 per row.
