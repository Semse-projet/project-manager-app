---
id: "prometeo.unified-query-lineage"
title: "Unified Query and Lineage Layer"
domain: "prometeo"
sdd_version: "2.0"
version: "1.0"
status: "REVIEW"
owner: "semse-core"
risk: "high"
code_status: "NOT_STARTED"
ci_status: "NOT_RUN"
merge_status: "UNMERGED"
deploy_status: "NOT_DEPLOYED"
activation_status: "INACTIVE"
migration_status: "NOT_APPLICABLE"
feature_flags: ["SEMSE_UNIFIED_QUERY_MODE"]
production_evidence: []
related_files:
  - "apps/api/src/modules/prometeo/prometeo-tool-registry.ts"
  - "apps/api/src/modules/prometeo/tool-governance/tool-governance.policy.ts"
related_tests: []
related_endpoints: []
related_events: []
related_agents: ["prometeo"]
last_verified: "2026-10-04"
---

# Spec: Unified Query and Lineage Layer

## 1. Problem and result
Give Prometeo/operators one bounded read surface across technical, conversational, memory, decision and runtime references.

## 2. Scope

### Included
- Decision provider
- Runtime/domain-reference provider
- POST graph query API
- Prometeo read-only graph tool
- neighbors/lineage/impact/path
- bounded traversal
- explicit degraded semantics

### Out of scope
- writes
- auto-decisions
- persistent graph cache
- Omniverse rendering
- global unscoped search

## 3. Security and authority
- tenant scope mandatory for operational data;
- provider/service owner applies policy before returning content;
- no scope elevation;
- no complete source bodies in logs;
- read/query never authorizes actions;
- unknown historical values stay null.

## 4. Acceptance

### P1 — primary behavior
Given an authorized actor and valid source references, when the capability is
called, then it returns only evidence-backed, authorized data using the declared
contract and never fabricates lineage.

### P1 — isolation
A cross-tenant request fails closed before source content is returned.

### P1 — degradation
If a non-authoritative provider is unavailable, the response is explicit about
degradation and preserves valid results from healthy providers.

## 5. Contracts
`POST /v1/intelligence/graph/query`

Example:
```json
{
  "mode": "lineage",
  "start": {"nodeType": "decision", "sourceId": "dec_123"},
  "maxDepth": 4,
  "maxNodes": 200
}
```

Prometeo must call the same service using the same actor context.

## 6. Events / idempotency / reconstruction
Read-only. Querying the graph does not emit business events.

## 7. Data / migration
No migration. Enforce hard server-side bounds regardless of client input.

## 8. Observability / rollout
Flag: `SEMSE_UNIFIED_QUERY_MODE`
Rollout: `off -> shadow -> canary -> live`

Metrics:
- latency
- success/failure
- denied scope
- degraded/truncated where applicable

## 9. Required tests
- decision -> sources
- decision -> action -> outcome
- technical impact
- no inferred authoritative edges
- provider failure
- traversal budgets
- heterogeneous provider permissions
- tenant isolation
- Prometeo cannot elevate scope

## 10. Implementation map
- `apps/api/src/modules/intelligence/operational-graph/providers/decision.provider.ts`
- `apps/api/src/modules/intelligence/operational-graph/providers/runtime.provider.ts`
- `apps/api/src/modules/intelligence/operational-graph/operational-graph.controller.ts`
- `apps/api/src/modules/prometeo/prometeo-tool-registry.ts`
- `apps/api/src/modules/prometeo/tool-governance/tool-governance.policy.ts`
- `apps/api/test/operational-graph.query.test.ts`
- `apps/api/test/prometeo-operational-graph.tool.test.ts`

## 11. External research
- PostgreSQL recursive queries: https://www.postgresql.org/docs/current/queries-with.html
- W3C Trace Context: https://www.w3.org/TR/trace-context/
- OpenTelemetry propagation: https://opentelemetry.io/docs/concepts/context-propagation/

## 12. Closure gates
- [ ] APPROVED before code
- [ ] failing tests first
- [ ] strict/index/coverage green
- [ ] CI PASS
- [ ] merge SHA recorded
- [ ] terminal deploy if runtime changed
- [ ] authenticated canary
- [ ] evidence without secrets

## Archivos y endpoints planificados (aún inexistentes)

Se mantienen fuera del frontmatter porque `spec:validate:strict` exige que `related_files` y `related_endpoints` existan en el repo. Se mueven al frontmatter cuando el slice los cree.

- `apps/api/src/modules/intelligence/operational-graph/providers/decision.provider.ts`
- `apps/api/src/modules/intelligence/operational-graph/providers/runtime.provider.ts`
- `apps/api/src/modules/intelligence/operational-graph/operational-graph.controller.ts`
- `apps/api/test/operational-graph.query.test.ts`
- `apps/api/test/prometeo-operational-graph.tool.test.ts`
- endpoint: `POST /v1/intelligence/graph/query`
