---
id: "prometeo.unified-graph-contract"
title: "Unified Operational Graph Contract"
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
feature_flags: ["SEMSE_OPERATIONAL_GRAPH_MODE"]
production_evidence: []
related_files:
related_tests: []
related_endpoints: []
related_events: []
related_agents: ["prometeo"]
last_verified: "2026-10-04"
---

# Spec: Unified Operational Graph Contract

## 1. Problem and result
Provide one typed read contract across Graphify, conversations and governed memory without another authoritative graph store.

## 2. Scope

### Included
- UnifiedGraphNode / UnifiedGraphEdge / GraphQuery / GraphQueryResult
- OperationalGraphProvider interface and registry
- Graphify, Memory and Conversation providers
- maxDepth/maxNodes/time budget/cycle guard
- degradedSources/truncated/provenance
- reuse SourceRef

### Out of scope
- Decision Ledger
- persistent generic graph
- graph DB
- business-state writes
- Omniverse UI
- copying Graphify into PostgreSQL

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
```ts
interface OperationalGraphProvider {
  id: string;
  supports(input: GraphQuery): boolean;
  query(input: AuthorizedGraphQuery): Promise<ProviderGraphResult>;
}

type GraphQueryResult = {
  nodes: UnifiedGraphNode[];
  edges: UnifiedGraphEdge[];
  degradedSources: string[];
  truncated: boolean;
  maxDepthApplied: number;
  correlationId: string | null;
};
```

## 6. Events / idempotency / reconstruction
Read-only and reconstructable; no domain events required.

## 7. Data / migration
No Prisma migration. No generic graph node/edge tables in V1.

## 8. Observability / rollout
Flag: `SEMSE_OPERATIONAL_GRAPH_MODE`
Rollout: `off -> shadow -> canary -> live`

Metrics:
- latency
- success/failure
- denied scope
- degraded/truncated where applicable

## 9. Required tests
- contract normalization
- deterministic dedupe
- Graphify unavailable
- cycle protection
- depth/node/time budgets
- sensitivity ceiling
- cross-tenant denial
- null legacy provenance

## 10. Implementation map
- `apps/api/src/modules/intelligence/operational-graph/operational-graph.types.ts`
- `apps/api/src/modules/intelligence/operational-graph/operational-graph.service.ts`
- `apps/api/src/modules/intelligence/operational-graph/providers/graphify.provider.ts`
- `apps/api/src/modules/intelligence/operational-graph/providers/memory.provider.ts`
- `apps/api/src/modules/intelligence/operational-graph/providers/conversation.provider.ts`
- `apps/api/test/operational-graph.contract.test.ts`

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

- `apps/api/src/modules/intelligence/operational-graph/operational-graph.types.ts`
- `apps/api/src/modules/intelligence/operational-graph/operational-graph.service.ts`
- `apps/api/src/modules/intelligence/operational-graph/providers/graphify.provider.ts`
- `apps/api/src/modules/intelligence/operational-graph/providers/memory.provider.ts`
- `apps/api/src/modules/intelligence/operational-graph/providers/conversation.provider.ts`
- `apps/api/test/operational-graph.contract.test.ts`
