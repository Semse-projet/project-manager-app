---
id: "prometeo.omniverse-adapter"
title: "Omniverse Read-Only Projection Adapter"
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
feature_flags: ["SEMSE_OMNIVERSE_ADAPTER_MODE"]
production_evidence: []
related_files:
  - "docs/architecture/SEMSE_API_SURFACE_V1.md"
related_tests: []
related_endpoints: []
related_events: []
related_agents: ["prometeo"]
last_verified: "2026-10-04"
---

# Spec: Omniverse Read-Only Projection Adapter

## 1. Problem and result
Expose a safe projection to the separate Omniverse Control Center without DB access, raw sensitive payloads or write authority.

## 2. Scope

### Included
- sanitized snapshot contract
- optional cursor/delta only after snapshot correctness
- strict attribute allowlist
- OPS_ADMIN/resource policy
- freshness/degraded/truncated metadata
- API for separate Omniverse repo

### Out of scope
- 3D renderer implementation in core repo
- direct DB access from Omniverse
- secrets/raw message bodies
- critical writes
- replacing Mission Control
- autonomous deploy actions

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
`POST /v1/intelligence/omniverse/snapshot`

Input:
```json
{
  "scope": {"projectId": "optional"},
  "root": {"nodeType": "project", "sourceId": "optional"},
  "maxDepth": 3,
  "maxNodes": 500
}
```

Output includes generatedAt, sourceSha, nodes, edges, degradedSources,
truncated and freshness.

## 6. Events / idempotency / reconstruction
Read-only; snapshot reads emit no domain event.

## 7. Data / migration
No core migration. No Omniverse mirror DB in V1.

## 8. Observability / rollout
Flag: `SEMSE_OMNIVERSE_ADAPTER_MODE`
Rollout: `off -> shadow -> canary -> live`

Metrics:
- latency
- success/failure
- denied scope
- degraded/truncated where applicable

## 9. Required tests
- sensitive-field allowlist
- tenant isolation
- OPS_ADMIN/resource authorization
- deterministic snapshot
- degraded metadata
- hard size/depth caps
- no direct DB contract
- no known secret variable names in response

## 10. Implementation map
- `apps/api/src/modules/intelligence/omniverse/omniverse-projection.service.ts`
- `apps/api/src/modules/intelligence/omniverse/omniverse-projection.controller.ts`
- `apps/api/src/modules/intelligence/omniverse/omniverse.dto.ts`
- `apps/api/test/omniverse-projection.test.ts`
- `docs/architecture/SEMSE_API_SURFACE_V1.md`

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

- `apps/api/src/modules/intelligence/omniverse/omniverse-projection.service.ts`
- `apps/api/src/modules/intelligence/omniverse/omniverse-projection.controller.ts`
- `apps/api/src/modules/intelligence/omniverse/omniverse.dto.ts`
- `apps/api/test/omniverse-projection.test.ts`
- endpoint: `POST /v1/intelligence/omniverse/snapshot`
