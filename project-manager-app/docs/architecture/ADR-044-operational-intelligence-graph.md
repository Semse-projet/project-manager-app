---
id: "ADR-044"
title: "Operational Intelligence Graph, Decision Ledger and Omniverse Projection"
status: "PROPOSED"
date: "2026-10-04"
owners: ["semse-core", "knowledge", "prometeo"]
---

# ADR-044 — Operational Intelligence Graph, Decision Ledger and Omniverse Projection

> **Gobernanza de identidad ADR (2026-10-15):** este documento fue publicado originalmente como `ADR-042-operational-intelligence-graph.md` (PROPOSED, 2026-10-04). El identificador `ADR-042` ya lo ocupa la decisión **ACCEPTED** `ADR-042-universal-connector-trust-boundary.md` (2026-10-06). Se renumera la propuesta del grafo a **ADR-044**, preservando todo su contenido, estatus PROPOSED e historial en Git. Esto **no** constituye aprobación de la propuesta ni cambia decisiones técnicas. Consultar `docs/architecture/ADR_ID_RECONCILIATION_2026-10-15.md`.

## Context

SEMSE already has Graphify, Prometeo RAG, Operational Context, AgentMemory,
WorkspaceMemory, KnowledgeFact/FactLink, AgentDecision, AgentApproval, AuditLog,
the event backbone and Mission Control.

The missing capability is not another graph engine. It is a common operational
lineage contract plus an authorized Decision Ledger capable of reconstructing:

`source -> finding -> proposal -> decision -> action -> outcome`, con la verificación como arista `verified_by` y como rol `VERIFICATION` de `DecisionEffectRef`, no como etapa semántica propia

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

- Número: el paquete lo proponía como ADR-035, ya ocupado por `ADR-035-agent-approval-governance-ownership`; se renumeró provisionalmente a ADR-042; por la colisión posterior con Universal Connector se corrige la identificación documental a ADR-044 el 2026-10-15.
- Base: `main` avanzó de `370578a` a `e5f19a3` tras preparar el paquete.
- Solapamiento con `prometeo.tool-call-audit-lineage` (H05): resuelto por D-02 (ver «Decisiones del owner»). H05 no añade modelos nuevos: añade columnas nulables a `PrometeoToolInvocationAudit` mediante una migración aditiva.
- Los paths planificados se movieron del frontmatter a una sección del body de cada child spec porque `spec:validate:strict` exige que existan.

## Decisiones del owner (2026-10-25)

El owner aceptó en bloque las recomendaciones del acta de reconciliación (D-01 a D-16; ver el registro de progresión). Las que condicionan este ADR:

- **D-02 (H05):** el Decision Ledger y el provider `runtime` **referencian** H05 y no copian nada. `approvalRef` apunta a `AgentApproval` o `PrometeoProposedAction`; cada ejecución es un `DecisionEffectRef` con `targetId = executionId`; el estado se lee en vivo con `ToolExecutionQueryService`. No se guardan los resúmenes de H05, que se purgan a los 90 días.
- **D-10 (MCP):** la tool del grafo es solo para Prometeo interno y no se expone por MCP hasta que exista un spec hijo.
- **D-16 (orden):** se mantiene 1 → 2 → 3 → 4.

## Criterio de aceptación

Este ADR pasa de `PROPOSED` a `ACCEPTED` cuando se cumplan todos:

1. El owner lo acepta con fecha en el registro de progresión.
2. Las decisiones D-01 a D-16 están aplicadas en los documentos (sección 6 del acta).
3. La prueba técnica de Graphify (B-05) tiene resultado registrado.

Aceptarlo no aprueba ningún slice: cada spec hijo se aprueba por separado, en el orden de «Rollout order».

## Opciones consideradas

| Opción | Resultado |
|---|---|
| A. Base de datos de grafos nueva | Descartada: segunda fuente de verdad y costo operativo; PostgreSQL con CTE recursivas acotadas alcanza en V1. |
| B. Copiar Graphify y la memoria a tablas propias | Descartada: duplica autoridad y los datos divergen. |
| C. Ampliar `AgentDecision`, `AgentApproval` o `AuditLog` | Descartada: significan otra cosa (hallazgo del bucle de autonomía, artefacto de aprobación, evidencia). |
| D. Lectura federada + ledger append-only (esta decisión) | Elegida. |

## Riesgos

| Riesgo | Mitigación |
|---|---|
| Fuga entre tenants u organizaciones | Autorizar en cada proveedor, fallar cerrado, matriz de pruebas con 2 tenants y 2 organizaciones (D-05). |
| Datos sensibles en atributos del grafo | Allowlist por proveedor y redacción (D-07). |
| Un tercer vocabulario de lineage | Compatibilidad con `conversationSourceRefSchema` y el contrato del Universal Connector (D-12). |
| Escritura desde Omniverse | Solo lectura, sin `upsert`, con kill switch (D-13). |
| Ledger inmutable con error de datos | Corrección por fila nueva con supersesión; nunca se borra historia. |

## Consecuencias

- Aparece un módulo nuevo y una tabla de solo-agregar (slice 2); los demás slices no migran.
- Los productores de decisiones deben aportar autoridad, política y aprobación para las decisiones críticas.
- Toda lectura del grafo exige permisos nuevos de solo lectura (D-04) y queda auditada sin contenido (D-09).

## Rollback

- Flags `SEMSE_OPERATIONAL_GRAPH_MODE`, `SEMSE_DECISION_LEDGER_MODE`, `SEMSE_UNIFIED_QUERY_MODE` y `SEMSE_OMNIVERSE_ADAPTER_MODE` en `off` apagan cada slice.
- Los slices 1, 3 y 4 no tienen migración y se revierten con el código.
- El slice 2 solo se revierte hacia adelante en datos: el historial del ledger no se borra.

## Aprobador

Owner del proyecto (@Samuelcastella), en los roles de documentación y arquitectura, seguridad, usabilidad y aprobación final.
