---
id: "ADR-042"
title: "Operational Intelligence Graph, Decision Ledger and Omniverse Projection"
status: "PROPOSED"
date: "2026-10-04"
owners: ["semse-core", "knowledge", "prometeo"]
---

# ADR-042 — Operational Intelligence Graph, Decision Ledger and Omniverse Projection

## Context

SEMSE already has Graphify, Prometeo RAG, Operational Context, AgentMemory,
WorkspaceMemory, KnowledgeFact/FactLink, AgentDecision, AgentApproval, AuditLog,
the event backbone and Mission Control.

The missing capability is not another graph engine. It is a common operational
lineage contract plus an authorized Decision Ledger capable of reconstructing:

`source -> finding -> proposal -> decision -> action -> verification -> outcome`

## Decision

### 1. PostgreSQL remains system of record
Bounded contexts retain write authority over business state.

### 2. Graphify remains the technical graph provider
Graphify owns derived topology for code/docs and is accessed through an adapter.
V1 does not copy the entire graph into PostgreSQL.

### 3. Memory remains governed context
AgentMemory and WorkspaceMemory keep current ownership and governance.
Memory never becomes canonical truth or standalone authorization.

### 4. Decision Ledger is append-only
It records decisions already authorized by a competent human, policy, or domain authority.

It does not replace:
- AgentDecision
- AgentApproval
- AuditLog
- local domain policy
- Shared Economic Ledger F5

### 5. Unified Operational Graph is federated
Providers:
- Graphify
- Conversation
- Memory
- Decision
- Runtime/domain references

No generic node/edge persistence in V1.

### 6. Omniverse is a read-only projection
It:
- never connects directly to PostgreSQL;
- receives sanitized data only;
- receives no critical write authority;
- is never source of truth.

### 7. Semantic separation is mandatory

`Fact -> Finding -> Proposal -> Decision -> Action -> Outcome`

No fact, finding or proposal may auto-promote to Decision.

## Base graph contract

```ts
type UnifiedGraphNode = {
  key: string;
  nodeType: string;
  sourceId: string;
  tenantId: string | null;
  orgId: string | null;
  projectId: string | null;
  label: string;
  authority:
    | "domain"
    | "decision-ledger"
    | "memory"
    | "conversation"
    | "graphify"
    | "runtime";
  sensitivity: "public" | "internal" | "confidential" | "restricted";
  sourceRefs: SourceRef[];
  attributes: Record<string, string | number | boolean | null>;
};

type UnifiedGraphEdge = {
  key: string;
  relation:
    | "depends_on"
    | "implements"
    | "derived_from"
    | "decided_from"
    | "governed_by"
    | "approved_by"
    | "caused"
    | "verified_by"
    | "resulted_in"
    | "deployed_as"
    | "supersedes"
    | "conflicts_with"
    | "related_to";
  from: string;
  to: string;
  tenantId: string | null;
  confidence: number | null;
  validFrom: string | null;
  validTo: string | null;
  sourceRefs: SourceRef[];
};
```

## Decision Ledger minimum model

```text
DecisionRecord
  id
  tenantId
  orgId?
  projectId?
  jobId?
  subjectType
  subjectId
  decisionKind
  decisionValueJson
  rationale
  authorityType
  authorityRef?
  actorUserId?
  policyDecision?
  policyId?
  policyVersion?
  approvalRef?
  correlationId?
  causationId?
  idempotencyKey
  effectiveAt
  recordedAt
  supersedesDecisionId?
  status = ACTIVE | SUPERSEDED | VOIDED

DecisionSourceRef
  id
  decisionId
  sourceType
  sourceId
  threadId?
  messageId?
  projectId?
  jobId?
  occurredAt?

DecisionEffectRef
  id
  decisionId
  role = ACTION | VERIFICATION | OUTCOME
  targetType
  targetId
  observedAt?
```

## Ledger invariants

- append-only history;
- correction = new row + supersession;
- `(tenantId, idempotencyKey)` unique;
- source refs do not duplicate full source bodies;
- cross-tenant access fails closed;
- critical decisions require authority/policy/approval provenance.

## Rollout order

1. Unified Operational Graph Contract
2. Decision Ledger
3. Unified Query + Lineage
4. Omniverse Adapter

Each slice has its own SDD 2.0 artifacts and independent closure gates.

## Reconciliación PR 0 (2026-10-06)

- Número: el paquete lo proponía como ADR-035, ya ocupado por `ADR-035-agent-approval-governance-ownership`; se renumera a ADR-042.
- Base: `main` avanzó de `370578a` a `e5f19a3` tras preparar el paquete.
- Solapamiento a resolver antes de aprobar los child specs: `prometeo.tool-call-audit-lineage` (H05, APPROVED, `code_status: IN_PROGRESS`) ya introduce auditoría canónica por tool call y estado de ejecución de aprobaciones, con migración aditiva y modelos nuevos en `schema.prisma`. El Decision Ledger y el provider `runtime` del grafo deben reutilizar esa lineage de tool calls y no duplicarla. Pendiente de decisión del owner.
- Los paths planificados se movieron del frontmatter a una sección del body de cada child spec porque `spec:validate:strict` exige que existan.
