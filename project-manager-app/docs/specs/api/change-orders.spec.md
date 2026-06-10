---
id: "api-change-orders"
title: "Change Orders API"
domain: "change-orders"
status: "VERIFIED"
owner: "semse-core"
risk: "high"
related_files:
  - "apps/api/src/modules/change-orders"
  - "apps/api/src/modules/payment-governance"
  - "packages/db/prisma/schema.prisma"
related_tests:
  - "apps/api/test/change-order-lifecycle.test.ts"
  - "apps/api/test/change-orders.controller.test.ts"
  - "tests/unit/change-order-risk-agent.test.ts"
related_endpoints:
  - "v1/change-orders"
related_events:
  - "change-order:updated"
related_agents:
  - "ChangeOrderLifecycle"
last_verified: "2026-06-09"
---

# Spec: Change Orders API

## Problem Statement

Change orders capture scope, cost or risk changes that can affect BuildOps, milestones and payment readiness. They must be reviewed before being applied and must not directly release payments.

## Scope

- In scope:
  - Listing change orders by job, BuildOps project, milestone or status.
  - Creating predicted change orders.
  - Submitting, approving, rejecting and requesting changes.
  - Computing cost/risk/payment impact.
  - Applying approved change orders to BuildOps.
  - Running deterministic change-order risk analysis.
- Out of scope:
  - Direct escrow release.
  - Client billing settlement.
  - Replacing payment-governance checks.

## FSM

```txt
predicted -> submitted -> approved -> applied
predicted -> rejected
submitted -> rejected
predicted -> changes_requested
submitted -> changes_requested
rejected -> submitted
```

Terminal states:

- `applied`
- `voided` when later implemented

Blocking statuses for payment governance:

- `predicted`
- `submitted`
- `changes_requested`

Non-blocking statuses:

- `rejected`
- `applied`
- `voided`

## API Contract

### `GET /v1/change-orders`

```yaml
auth: required
permissions: ["change-orders:read"]
query:
  jobId: "optional"
  buildOpsProjectId: "optional"
  milestoneId: "optional"
  status: "optional"
  limit: "optional number, clamped 1-200"
output:
  change_orders: "tenant scoped candidates"
```

### `POST /v1/change-orders`

```yaml
auth: required
permissions: ["change-orders:create"]
input:
  title: "required string"
  trigger: "required string"
  jobId: "optional"
  buildOpsProjectId: "optional"
  milestoneId: "optional"
  algorithmRunId: "optional"
  description: "optional"
  pricingMode: "optional, default time_and_materials"
  estimatedMin: "optional number"
  estimatedMax: "optional number"
  probability: "optional number clamped 0-100"
  evidenceJson: "optional object"
output:
  status: "predicted"
errors:
  400:
    - "title missing"
    - "trigger missing"
    - "not linked to job, project or milestone"
```

### Lifecycle endpoints

```yaml
endpoints:
  - "POST /v1/change-orders/:id/submit"
  - "POST /v1/change-orders/:id/approve"
  - "POST /v1/change-orders/:id/reject"
  - "POST /v1/change-orders/:id/request-changes"
permissions:
  submit: "change-orders:create"
  approve: "change-orders:approve"
  reject: "change-orders:approve"
  request_changes: "change-orders:approve"
effects:
  sse: "change-order:updated"
errors:
  400: "invalid transition or missing required rejection/change note"
  404: "not found or not tenant owned"
```

### `GET /v1/change-orders/:id/impact`

```yaml
auth: required
permissions: ["change-orders:read"]
output:
  costDeltaMin: number
  costDeltaMax: number
  costDeltaAvg: number
  affectedMilestones: string[]
  riskLevel: "low | medium | high | critical"
  paymentImpact: "none | requires_approval | hold_required | already_applied"
  auditReason: string
```

### `POST /v1/change-orders/:id/apply-to-buildops`

```yaml
auth: required
permissions: ["change-orders:approve"]
precondition: "status must be approved, unless already applied"
effects:
  operational_signal: "CHANGE_ORDER_RECOMMENDED"
  sse: "change-order:applied"
  payment_release: "none"
errors:
  400: "not approved"
```

### `POST /v1/change-orders/:id/run-risk-agent`

```yaml
auth: required
permissions: ["change-orders:read"]
output:
  riskLevel: "low | medium | high | critical"
  summary: string
  flags: string[]
  recommendation: string
  confidence: number
```

## Security / RBAC

- All queries are tenant-scoped.
- Approve/reject/request-changes/apply require `change-orders:approve`.
- Change orders must not bypass payment-governance readiness.
- Rejection requires a note.

## Tests Required

- [x] Lifecycle transition tests: `apps/api/test/change-order-lifecycle.test.ts`
- [x] Risk-agent unit tests: `tests/unit/change-order-risk-agent.test.ts`
- [x] Controller permission tests.
- [x] Tenant isolation tests.

## Implementation Map

### API

- `apps/api/src/modules/change-orders/change-orders.controller.ts`
- `apps/api/src/modules/change-orders/change-orders.service.ts`

### Tests

- `apps/api/test/change-order-lifecycle.test.ts`
- `tests/unit/change-order-risk-agent.test.ts`

## Acceptance Criteria

- [x] Spec is linked from `docs/SPEC_INDEX.md`.
- [x] Invalid transitions are rejected.
- [x] Applied change orders are idempotent.
- [x] Payment release remains governed by payment-governance.
