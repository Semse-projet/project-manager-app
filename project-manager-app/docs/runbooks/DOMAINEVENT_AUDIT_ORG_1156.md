# DomainEvent AuditLog organization ownership — #1156

**Status:** DRAFT · no production authorization · depends on PR #1154

## Security boundary

- A generic `domain-events:read` permission is not ownership proof. For `GET /v1/domain-events` and `GET /v1/domain-events/:correlationId`, the event audit row must match the actor's authenticated `tenantId` **and** `orgId`.
- New audited emissions persist verified `orgId` from `AuditService.append` / `appendInTransaction`. Do not derive ownership from event JSON, correlation ID, user ID, payload, role string, or request header.
- The additive migration gives `AuditLog.orgId String?` and `@@index([tenantId,orgId,occurredAt])`, with **no default or backfill**. Old rows with NULL are intentionally hidden from org-facing DomainEvents list/trace until separately classified by authorized human review.
- User-facing outbox list, status counts, pending age, event detail and replay must also be restricted to the authenticated `(tenantId, orgId)`. The internal event dispatcher keeps its existing tenant-wide/reconciliation queries; user-facing `OutboxOpsService` always passes the org boundary explicitly. A session org of `system` is rejected; `system` is a technical sentinel, never a wildcard and never an authorized operator org.
- Lifecycle producers still stamp some project deliveries with `orgId=system`. Those rows are visible to an operator only when `entityType=Project` and the project is tied to the caller (`Job.clientOrgId` or `Project.assignedProOrgId`). System deliveries for other projects, or without a proven project tie, stay hidden. This does not expose another organization's own `orgId` deliveries.
- Mission Control event exceptions use the same user-facing outbox policy when listing failed deliveries and when offering `REPLAY`. A delivery the session cannot operate must not appear as a replayable exception. `OPS_ADMIN` is not a cross-org exception on these endpoints.
- Correlation trace compares the segment after the first `:` in `AuditLog.entityId` by exact equality. It must not use substring/`endsWith`/`LIKE` matching (`_` and `%` are literal). Keep tenant and organization filters.
- DomainOutboxEvent correlation scope and AgentRun scopes are supplied by the prerequisite #1154. This PR must not accidentally broaden those queries.
- Agent-run timeline history is authorized by org-scoped AgentRun IDs. Do not also filter those AuditLog rows by `AuditLog.orgId`; the finalization consumer may still write them without an organization.

## Explicit limitations

- This does **not** fix every legacy tenant-only AuditLog reader (e.g. broad internal Ops audit). Their RBAC, owner scope and history must be audited separately.
- AuditLog rows written directly through `prisma.auditLog.create` without an authenticated org remain NULL. They are hidden by DomainEvents list/trace. Follow-up work is needed for any such producer requiring user-facing visibility.
- No attempt to retroactively assign existing audit rows to an org via `meta`, `correlationId`, `actorUserId` or historical membership: those are insufficient proof.

## Gates

1. CI of exact HEAD: Prisma generate/schema, compilation, unit, PostgreSQL integration and E2E, CodeQL when applicable.
2. Independent review of owner, legacy behavior, multi-membership and the effect of filtering historical rows.
3. Deploy **only to isolated QA**, with migration preflight and rollback plan, after approvals; verify authenticated org A/org B, other tenant, revoked sessions, paging and exact correlations. No production deployment or automatic global backfill.
4. Rollback safely: keep the new nullable column and block affected endpoints rather than reverting to unsafe tenant-only reads. Document differences in historical visibility.
