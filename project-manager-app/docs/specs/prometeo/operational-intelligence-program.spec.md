---
id: "prometeo.operational-intelligence-program"
title: "Operational Intelligence Graph + Decision Lineage Program"
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
migration_status: "PENDING"
feature_flags:
  - "SEMSE_OPERATIONAL_GRAPH_MODE"
  - "SEMSE_DECISION_LEDGER_MODE"
  - "SEMSE_UNIFIED_QUERY_MODE"
  - "SEMSE_OMNIVERSE_ADAPTER_MODE"
production_evidence: []
related_files:
  - "docs/architecture/ADR-044-operational-intelligence-graph.md"
related_tests: []
related_endpoints: []
related_events: []
related_agents: ["prometeo"]
privacyCritical: true
auditLog: "lecturas del grafo y snapshots: registro de acceso y de denegación sin contenido (D-09); decisiones del ledger: acciones de AuditLog y evento en EVENT_CATALOG.md (D-11), ambos pendientes de definir en el spec hijo"
sse: false
fsmTransicion: "solo el Decision Ledger tiene FSM propia (ACTIVE -> SUPERSEDED | VOIDED); se registra en STATE_MACHINES.md con el slice 2. El programa no toca FSM de otros dominios"
paymentGovernance: false # V1 excluye decisiones financieras del ledger (D-11)
last_verified: "2026-10-25"
---

# Spec: Operational Intelligence Graph + Decision Lineage Program

## 1. Problem and result

SEMSE has technical, conversational, memory, policy and runtime sources but no
common lineage contract that reconstructs:

`source -> finding -> proposal -> decision -> action -> outcome`

without duplicating source authority.

Expected result:
- tenant-safe lineage;
- append-only authorized decisions;
- Prometeo provenance queries;
- sanitized Omniverse projection.

## 2. Scope

Included:
- `prometeo.unified-graph-contract`
- `prometeo.decision-ledger`
- `prometeo.unified-query-lineage`
- `prometeo.omniverse-adapter`
- reuse SourceRef/correlation/causation
- bounded traversal

Out of scope:
- graph DB
- generic graph persistence V1
- replacing memory
- replacing AgentDecision
- replacing approvals/policy
- Shared Economic Ledger F5
- Omniverse writes
- inferred historical IDs
- automatic Finding -> Decision

## 3. Authority

- Graphify owns technical topology.
- Conversation system owns conversation source.
- Memory stores governed context.
- Decision Ledger records authorized decisions.
- Domain services own actions/outcomes.
- Omniverse owns no business state.

## 4. Acceptance scenarios

### P1 — Explain an authorized decision
Return every visible source/policy/approval/action/outcome reference with
provenance and no fabricated edge.

### P1 — Technical/operational impact
Combine technical Graphify dependencies with explicit operational references
without changing source authority.

### P1 — Omniverse snapshot
Return only authorized sanitized nodes/edges. Never leak another tenant.

Edge cases:
- provider down => `degraded`
- cycle => bounded termination
- missing source => no fabricated edge
- retry => one DecisionRecord
- correction => append + supersede

## 5. Shared response contract

Every unified graph response includes:
- nodes
- edges
- degradedSources
- truncated
- maxDepthApplied
- correlationId

## 6. State/events

Decision Ledger:
`ACTIVE -> SUPERSEDED | VOIDED`

Reuse event backbone where durable asynchronous recording is required.

## 7. Data

Only Decision Ledger requires mandatory persistence in V1.
No `db push`.
Additive migrations only.

## 8. Rollout

`off -> shadow -> canary -> live`

## 9. Tests

- provider contracts
- cycles/depth/node limits
- tenant/resource isolation
- ledger append-only/idempotency/supersession
- source ref reconstruction
- policy/approval provenance
- degraded semantics
- Prometeo authorization
- Omniverse sanitization
- authenticated canary

## 10. Implementation map

Do not implement the parent in one PR.
Use the four child specs.

## 11. Research

- PostgreSQL recursive CTEs
- W3C Trace Context
- OpenTelemetry context propagation

## 12. Closure gates

- [ ] ADR accepted
- [ ] child specs approved before code
- [ ] tests precede implementation
- [ ] strict/index/coverage green
- [ ] CI/merge/deploy/activation separately evidenced
- [ ] authenticated canary
- [ ] no secrets in evidence

---

## 13. Decisiones del owner aplicadas (2026-10-25)

El owner aceptó en bloque las recomendaciones D-01 a D-16 del [acta de reconciliación](operational-intelligence-program.reconciliation.md). Este spec padre solo fija lo transversal; el detalle y los valores numéricos viven en cada spec hijo.

**Valores que NO se inventan aquí** y que cada spec hijo debe proponer y el owner aprobar antes de pasar a `APPROVED`: techo de sensibilidad por rol, allowlist de atributos por proveedor, topes numéricos (`maxDepth`, `maxNodes`, tiempo total, cuota por actor), SLO y umbrales de alerta.

## 14. Actores y permisos (D-03, D-04, D-05, D-06)

| Actor | Permiso backend | Alcance | Puede | No puede |
|---|---|---|---|---|
| Usuario autenticado con rol operativo | permisos nuevos de solo lectura por capacidad (grafo, decisiones, snapshot) en `packages/auth/src/rbac.ts`; nombres a fijar en cada hijo | su tenant y su organización | consultar lineage visible para su rol | ampliar alcance ni deducir la existencia de lo oculto |
| Prometeo (herramienta interna) | los mismos permisos, evaluados con el actor del usuario | el del usuario que pregunta | consultar el grafo como herramienta de solo lectura | exponerse por MCP; autorizar acciones |
| `OPS_ADMIN` | permisos de lectura | su tenant; el cruce entre organizaciones requiere regla explícita (hijo) | lectura administrativa dentro del tenant | cruzar tenants |
| Omniverse (consumidor) | identidad de consumidor propia (D-13, ADR-045) | solo snapshots saneados | leer proyecciones | escribir, conectarse a PostgreSQL |

- **Aislamiento:** 404 si el recurso es de otro tenant y 403 si es de otra organización (patrón C51). Matriz de pruebas con 2 tenants y 2 organizaciones.
- **Ocultos:** los nodos y aristas no visibles se omiten sin placeholder ni conteo. Una denegación nunca se presenta como degradación.
- **Autorización parcial:** el resultado devuelve solo lo visible; la regla exacta por proveedor se define en el spec hijo del slice 1.
- **Módulo:** nuevo y propio, sin rutas `@Public`. No va en `modules/intelligence` ni se llama `operational-intelligence` (nombre ya ocupado, con otro significado). Los contratos Zod van en `packages/schemas/src`.

## 15. Datos sensibles, auditoría y frontera con MCP (D-07, D-09, D-10)

- `privacyCritical: true`: el contenido `confidential` o `restricted` no llega a un LLM externo; se enruta al LLM local o se filtra antes.
- Un solo vocabulario y orden de sensibilidad; techo por rol; allowlist de atributos por proveedor; redacción con `redactValue`/`redactPublicText`.
- El texto libre del ledger necesita política de retención y borrado (slice 2).
- **Auditoría de lecturas:** cada consulta o snapshot deja un registro de acceso o de denegación sin contenido (actor, tenant, organización, alcance, `correlationId`), alineado con interoperabilidad y ADR-045.
- **Frontera con MCP:** la herramienta del grafo es solo para Prometeo interno y **no se expone por MCP** hasta que exista un spec hijo. Ese spec debe nombrar al dueño de `decisionId` y `auditRef`. Esto es urgente porque el slice S1 de MCP (`platform.semse-mcp-project-read`) avanza.

## 16. Dependencias, orden y reversibilidad (D-16)

| Slice | Depende de | Migración | Cómo se revierte |
|---|---|---|---|
| 1. Unified Graph Contract | ninguno | no | flag `off` + revertir código |
| 2. Decision Ledger | ninguno en código; en orden, el slice 1 | aditiva (puede requerir `correlationId`) | flag `off`; **solo hacia adelante en datos**: no se borra historial |
| 3. Unified Query + Lineage | slices 1 y 2; H05 por referencia (D-02) | no inicialmente | flag `off` + revertir código |
| 4. Omniverse Adapter | slice 3; ADR-045 y contrato del consumidor (D-13) | no (núcleo) | flag `off` / kill switch + revertir código |

Orden fijado: 1 → 2 → 3 → 4. El slice 2 podría ir en paralelo (no depende del 1 en código) solo si el owner lo aprueba por escrito. Queda por decidir si se divide el slice 3 y si el slice 1 se declara librería con el canary diferido al slice 3.

## 17. Semántica de flags (D-14)

Un flag desconocido o ausente se trata como `off`.

| Modo | Efecto | Escribe | Visible al usuario |
|---|---|---|---|
| `off` | la capacidad no existe; responde como deshabilitada | no | no |
| `shadow` | ejecuta y registra métricas sin afectar al usuario | solo telemetría (y, en el slice 2, filas sin efecto de negocio) | no |
| `canary` | disponible para tenants listados | según el slice | sí, para la cohorte |
| `live` | disponible para todos | según el slice | sí |

La cohorte del `canary`, la matriz de dependencias entre flags de distintos slices y la respuesta exacta con el flag en `off` se fijan en cada hijo.

## 18. Análisis de consistencia (`analyze`)

Ver [`operational-intelligence-program.analyze.md`](operational-intelligence-program.analyze.md).
