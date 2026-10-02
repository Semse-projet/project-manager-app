---
type: plan
feature: "BuildOps SSE resource authorization"
domain: "buildops"
spec: "docs/specs/api/buildops.spec.md"
version: "2.0"
status: "APPROVED"
date: "2026-09-19"
---
# Plan
Authority: approved BuildOps API, Change Orders API and DOMAIN_INVARIANTS;
user requested continuing remediation. Base: 8d95bf81; origin/main: 5f5b9c09.
Production not inspected. Baseline targeted regression: 38/38 PASS.

## Findings and scope
BuildOps SSE has no explicit RBAC metadata: the global guard currently denies
legitimate requests. The controller's underlying stream broadcasts all events
within a tenant. Adding permission alone would expose other organizations.

Restore access with projects:read AND per-event domain read permission AND
resource-derived ownership. Check each event at delivery time; no cached grants.
Milestone/evidence events resolve Milestone.project ownership. BuildOps plan
events resolve BuildOpsProject.orgId. Change-order events resolve the candidate
from the tenant, then reuse the exact REST link policy. Ignore payload claims of
orgId/tenantId. Unknown, malformed, orphan or inaccessible events fail closed.
OPS_ADMIN retains tenant-wide known events, without crossing tenant channels.

Reuse the Change Orders link query/assertion through a shared module, without
changing REST behavior. Query identifiers are event-specific: plan approval
historically puts a BuildOps ID in jobId; never interpret it as a canonical Job.
No module dependency injection cycle, Prisma migration, producer protocol,
payment policy, frontend, infrastructure or other SSE channel changes.

## Stream behavior
Sequential asynchronous checks preserve order; denied events and lookup errors
drop individually, without killing the stream. Keepalive remains independent.
Unsubscription prevents queued lookups and delivery after disconnect.
No long-lived authorization cache. API auth and resource checks serve different roles.

## Verification and rollback
Tests precede code, using the actual controller, event bus and RBAC guard.
Cover owner/pro/admin/stranger/foreign tenant, candidate mixed links, spoofed
payload IDs, missing identifiers, lookup errors, ordering, changed ownership,
permissions and unsubscribe. Re-run REST tests, SSE regression, build/lint/SDD.
Full coverage result and missing database checks are separate delivery gates.
Rollback by reverting this slice; restores prior denial of legitimate SSE.
