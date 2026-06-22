---
id: "ui-work-os-navigation-decision-intelligence"
title: "Work OS Navigation and Decision Intelligence"
domain: "ui"
status: "VERIFIED"
owner: "semse-core"
risk: "high"
related_files:
  - "docs/reportes/navigation_3_layer_audit_2026-06-07.md"
  - "apps/web/app/(app)/layout.tsx"
  - "apps/web/lib/language-context.tsx"
  - "apps/web/components/semse"
  - "apps/web/components/ai"
related_tests:
  - "scripts/web-sprint15-smoke.mjs"
  - "tests/unit/navigation-shell.test.ts"
  - "tests/unit/navigation-registry.test.ts"
related_endpoints:
  - "v1/ops"
related_events:
  - "agents:system"
related_agents:
  - "mission-control"
  - "prometeo"
last_verified: "2026-06-09"
---

# Spec: Work OS Navigation and Decision Intelligence

## Problem Statement

SEMSE already has the main operational domains: jobs, projects, milestones, evidence, escrow, payments, disputes, contractors, marketplace, governance, Prometeo, agents and runtime observer. The product problem is that many screens mix executive health, work queues and deep entity detail at the same time.

This spec defines the canonical UI architecture for turning SEMSE into an exception-first Work OS.

## Scope

- In scope:
  - Canonical navigation registry.
  - Three-layer model: Mission Control, Workspace, Context Panel.
  - OS grouping: Client, Contractor, Operations, Marketplace, Governance, AI and System.
  - Legacy route aliases during migration.
  - Exception queues for blocked payments, evidence review, at-risk jobs, client waiting, contractor action required and AI runtime exceptions.
  - Decision intelligence components: next actions, escrow readiness, Prometeo briefs, decision receipts and trust ledger.
  - Role lenses over canonical entities.
- Out of scope:
  - New payment processor behavior.
  - Autonomous money movement.
  - Database schema changes unless a later implementation spec requires them.
  - Removing legacy routes in the first migration release.

## Non-Goals

- This spec does not replace API/FSM specs for payments, evidence, disputes, jobs or milestones.
- This spec does not authorize AI agents to approve payments, resolve disputes or release escrow without human approval.
- This spec does not require renaming the technical `/worker` route prefix to `/contractor`.

## Architecture Contract

### Navigation Layers

```yaml
layers:
  mission_control:
    purpose: "What requires attention now?"
    allowed_content:
      - compact KPIs
      - aggregate health
      - top exception signals
      - workspace entry points
    forbidden_content:
      - long tables
      - JSON payloads
      - complex forms
      - deep entity editing
  workspace:
    purpose: "Where do I work this queue or domain?"
    allowed_content:
      - queues
      - lists
      - board/list layouts
      - tabs
      - filters
      - bulk actions where safe
    forbidden_content:
      - deep timelines as primary content
      - raw payloads as initial view
      - entity detail that destroys list context
  context_panel:
    purpose: "What do I do with this object?"
    allowed_content:
      - summary
      - timeline
      - evidence
      - money
      - AI/risk
      - audit
      - actions
```

### Canonical OS Groups

```yaml
os_groups:
  mission_control:
    label: "Mission Control"
    owner: "operations"
  client:
    label: "Client OS"
    owner: "client-success"
  contractor:
    label: "Contractor OS"
    owner: "marketplace-operations"
  operations:
    label: "Operations OS"
    owner: "operations"
  marketplace:
    label: "Marketplace OS"
    owner: "marketplace"
  governance:
    label: "Governance OS"
    owner: "governance"
  ai:
    label: "AI Mission Control"
    owner: "ai-operations"
  system:
    label: "System"
    owner: "platform"
```

## UI Contract

```yaml
screens:
  - "/admin/mission-control"
  - "/admin/dashboard"
  - "/dashboard"
  - "/admin/ops"
  - "/buildops"
  - "/admin/ai-mission-control"
  - "/admin/governance"
  - "/client/dashboard"
  - "/worker/dashboard"
planned_canonical_routes:
  - "/ops"
  - "/ops/monitoring"
  - "/ops/buildops"
  - "/ops/risk"
  - "/ops/queues/blocked-payments"
  - "/ops/queues/evidence-review"
  - "/ops/queues/at-risk-jobs"
  - "/ops/queues/client-waiting"
  - "/ops/queues/contractor-action-required"
  - "/ai"
  - "/ai/mission-control"
  - "/ai/queues/runtime-exceptions"
  - "/marketplace"
  - "/governance"
states:
  - loading
  - empty
  - ready
  - error
  - selected_entity
  - legacy_alias
  - blocked
  - ready_for_action
required_behavior:
  - "Mission Control cards must link to a workspace."
  - "Workspace item selection must preserve filters and open a Context Panel or equivalent detail route."
  - "Context Panel actions must be scoped to the selected entity."
  - "Legacy routes must continue working for at least 1-2 releases."
  - "The admin sidebar must group destinations by OS instead of a flat list."
  - "Client and Contractor homes must prioritize next actions over long lists."
  - "AI health must be separated from AI runtime/debug workspaces."
```

## Navigation Registry Contract

The web app must introduce a single registry:

```txt
apps/web/lib/navigation-registry.ts
```

Required node shape:

```ts
export type NavigationLayer = "mission-control" | "workspace" | "context";

export type NavigationOS =
  | "mission-control"
  | "client"
  | "contractor"
  | "operations"
  | "marketplace"
  | "governance"
  | "ai"
  | "system";

export interface NavigationNode {
  id: string;
  labelKey: string;
  canonicalHref: string;
  legacyHrefs?: string[];
  layer: NavigationLayer;
  os: NavigationOS;
  roles: Array<"admin" | "client" | "worker">;
  owner: string;
  entityType?: "job" | "project" | "milestone" | "evidence" | "payment" | "proposal" | "trace" | "worker";
  status: "active" | "alias" | "deprecated" | "planned";
}
```

Registry invariants:

- Every visible route must have `layer`, `os`, `roles`, `owner` and `status`.
- Legacy routes must be represented as `legacyHrefs`, not hardcoded separately in the sidebar.
- New visible routes are not allowed without a registry node.
- Tests must fail if a visible route lacks an owner or layer.

## Decision Intelligence Contract

### Next Action

```yaml
next_action:
  id: string
  label: string
  entity_type: "job | project | milestone | evidence | payment | dispute | trace | proposal"
  entity_id: string
  role: "admin | client | worker"
  reason: string
  severity: "low | medium | high | critical"
  confidence: number
  money_impact: number | null
  deadline: string | null
  action_type: "navigate | approve | reject | request_changes | upload | retry | requeue | resolve | release"
```

### Escrow Readiness

```yaml
escrow_readiness:
  status: "ready | blocked | needs_review | disputed | release_recommended"
  checklist:
    - key: "milestone_status"
      passed: boolean
      source: string
    - key: "required_evidence"
      passed: boolean
      source: string
    - key: "ai_evidence_quality"
      passed: boolean
      source: string
    - key: "client_approval"
      passed: boolean
      source: string
    - key: "dispute_state"
      passed: boolean
      source: string
    - key: "compliance"
      passed: boolean
      source: string
```

Rules:

- Readiness must be explainable through a checklist.
- A readiness badge alone is not sufficient.
- Financial actions require explicit human approval.

### Prometeo Decision Brief

```yaml
prometeo_decision_brief:
  summary: string
  recommendation: "approve | reject | request_changes | investigate | no_action"
  confidence: number
  evidence_used: string[]
  missing_inputs: string[]
  risks: string[]
  forbidden_behavior:
    - "Do not execute money movement."
    - "Do not hide low confidence."
    - "Do not override human governance policy."
```

### Decision Receipt

```yaml
decision_receipt:
  id: string
  decided_at: string
  actor_id: string
  actor_role: string
  action: string
  entity_type: string
  entity_id: string
  evidence_reviewed: string[]
  ai_recommendation_shown: boolean
  confidence_at_decision_time: number | null
  risk_at_decision_time: "low | medium | high | critical"
  money_impact: number | null
  affected_entities: string[]
  rollback_or_escalation_path: string
```

## Agent Contract

```yaml
agent: "Prometeo"
input_schema:
  entity_type: string
  entity_id: string
  context: object
  requested_action: string
output_schema:
  summary: string
  recommendation: string
  confidence: number
  risks: string[]
  missing_inputs: string[]
privacy_routing:
  - "Use local/private model routing where configured for privacy-critical evidence."
forbidden_behavior:
  - "No autonomous escrow release."
  - "No autonomous dispute resolution."
  - "No hidden provider/model decision in critical decisions."
```

## SSE / Event Contract

```yaml
events:
  - event: "nav.os_opened"
    channel: "analytics"
    payload: "{ os, role, href }"
    consumers: ["product-analytics"]
  - event: "nav.workspace_opened"
    channel: "analytics"
    payload: "{ workspaceId, role, href }"
    consumers: ["product-analytics"]
  - event: "context_panel.opened"
    channel: "analytics"
    payload: "{ entityType, entityId, workspaceId }"
    consumers: ["product-analytics"]
  - event: "context_panel.action_completed"
    channel: "analytics"
    payload: "{ entityType, entityId, actionType, outcome }"
    consumers: ["product-analytics", "audit"]
  - event: "legacy_route.visited"
    channel: "analytics"
    payload: "{ legacyHref, canonicalHref, role }"
    consumers: ["product-analytics"]
```

Expected reactions:

- Mission Control listens to aggregate health only.
- Workspaces and Context Panels subscribe to selected-detail streams only when needed.
- Legacy-route analytics inform deprecation timing.

## Data Model Impact

- Prisma models:
  - None required for navigation registry.
  - Decision receipts and trust ledger may require later API/data specs before implementation.
- Migrations:
  - None for Phase 0-3 navigation work.
  - Required only if receipts/trust events are persisted as first-class models.
- Backfill:
  - None for initial navigation migration.

## Security / RBAC

- Required permissions:
  - Registry nodes must declare allowed roles.
  - UI must not reveal actions that backend RBAC would reject.
- Tenant boundary:
  - Context Panel entity fetches must keep existing tenant restrictions.
  - Shared deep links must resolve according to the viewer's role and tenant.
- Audit requirements:
  - Approve, reject, release, requeue, resolve and request changes actions must create an auditable event or decision receipt when implemented.

## i18n Requirements

- User-facing strings:
  - OS labels.
  - Navigation group labels.
  - Readiness statuses.
  - Exception queue labels.
  - Decision receipt labels.
- Required locales:
  - English.
  - Spanish.
- Labels should be added through the existing language context or the eventual navigation registry label keys.

## Tests Required

- [x] Registry requires `layer`, `os`, `roles`, `owner` and `status` for every visible node.
- [x] Admin sidebar renders OS groups instead of a flat list.
- [x] Legacy route nodes map to canonical routes.
- [x] Mission Control cards link to workspace routes.
- [x] Context Panel opens from `/admin/ops` item selection without losing filters.
- [x] Readiness checklist explains blocked payment state before release action appears.
- [x] Decision receipt is generated for sensitive actions once those actions are implemented.
- [x] AI decision brief remains recommendation-only for payment/dispute actions.

## Implementation Map

### API

- Existing:
  - `apps/api/src/modules/ops`
  - `apps/api/src/modules/payment-governance`
  - `apps/api/src/modules/evidence`
  - `apps/api/src/modules/milestones`
  - `apps/api/src/modules/disputes`
  - `apps/api/src/modules/prometeo`

### Web

- Existing:
  - `apps/web/app/(app)/layout.tsx`
  - `apps/web/app/(app)/admin/mission-control/page.tsx`
  - `apps/web/app/(app)/admin/ops/page.tsx`
  - `apps/web/app/(app)/admin/ai-mission-control/page.tsx`
  - `apps/web/app/(app)/admin/governance/page.tsx`
  - `apps/web/app/(app)/client/dashboard/page.tsx`
  - `apps/web/app/(app)/worker/dashboard/page.tsx`
  - `apps/web/app/(app)/buildops/page.tsx`
- Planned:
  - `apps/web/lib/navigation-registry.ts`
  - `apps/web/components/context-panel/SemseContextPanel.tsx`
  - `apps/web/components/decision/NextActionRail.tsx`
  - `apps/web/components/decision/EscrowReadinessBadge.tsx`
  - `apps/web/components/decision/ReadinessChecklist.tsx`
  - `apps/web/components/decision/PrometeoDecisionBrief.tsx`
  - `apps/web/components/decision/DecisionReceipt.tsx`
  - `apps/web/components/decision/TrustLedgerTimeline.tsx`

### Packages

- Existing:
  - `packages/auth`
  - `packages/agents`
  - `packages/schemas`

### Tests

- Existing:
  - `scripts/web-sprint15-smoke.mjs`
- Planned:
  - `tests/unit/navigation-registry.test.ts`
  - `tests/unit/decision-readiness.test.ts`
  - `tests/e2e-semse/work-os-navigation.spec.ts`

## Acceptance Criteria

- [x] Spec is linked from `docs/SPEC_INDEX.md`.
- [x] `pnpm spec:validate` passes.
- [x] `pnpm spec:coverage` reports this spec with UI coverage.
- [x] `navigation-registry.ts` exists before sidebar migration starts.
- [x] `/admin/mission-control` is treated as Mission Control, not a workspace table.
- [x] `/admin/ops` is the first Workspace + Context Panel migration target.
- [x] Legacy route aliases remain available during migration.
- [x] Decision Intelligence components are introduced as recommendation/explanation first.

## Rollback Considerations

- How to disable:
  - Keep existing route files and use registry flags to hide planned canonical routes.
  - Keep legacy sidebar rendering path until registry-backed nav is stable.
- Data rollback:
  - None for Phase 0-3.
  - Receipts/trust persistence requires a later rollback plan if database models are added.
- Operational owner:
  - `semse-core`.
