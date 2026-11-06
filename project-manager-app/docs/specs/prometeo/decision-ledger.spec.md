---
id: "prometeo.decision-ledger"
title: "Decision Ledger"
domain: "prometeo"
sdd_version: "2.0"
version: "1.1"
status: "REVIEW"
owner: "semse-core"
risk: "high"
code_status: "NOT_STARTED"
ci_status: "NOT_RUN"
merge_status: "UNMERGED"
deploy_status: "NOT_DEPLOYED"
activation_status: "INACTIVE"
migration_status: "PENDING"
feature_flags: ["SEMSE_DECISION_LEDGER_MODE"]
production_evidence: []
related_files:
  - "docs/architecture/ADR-044-operational-intelligence-graph.md"
  - "docs/specs/prometeo/operational-intelligence-program.spec.md"
  - "docs/specs/prometeo/tool-call-audit-lineage.spec.md"
  - "docs/foundation/EVENT_CATALOG.md"
  - "docs/foundation/STATE_MACHINES.md"
  - "packages/db/prisma/schema.prisma"
  - "packages/db/prisma/migrations/20260512110000_security_hardening/migration.sql"
  - "packages/auth/src/rbac.ts"
related_tests: []
related_endpoints: []
related_events: []
related_agents: ["prometeo"]
privacyCritical: true
auditLog: "cada registro, corrección y anulación deja una acción de AuditLog; los nombres se fijan al añadirlos a EVENT_CATALOG.md en este slice (ver sección 6)"
sse: false
fsmTransicion: "FSM propia del ledger (sección 6), a registrar en docs/foundation/STATE_MACHINES.md antes del código; no toca FSM de otros dominios"
paymentGovernance: false # V1 excluye decisiones financieras (D-11, L-20)
last_verified: "2026-11-06"
---

# Spec: Decision Ledger

> **Estado: REVIEW.** No autoriza código ni migración. Requisitos para `APPROVED`: ADR-044 aceptado con fecha, acta aprobada y las decisiones abiertas de la sección 14 resueltas por el owner.
> Programa: [`prometeo.operational-intelligence-program`](operational-intelligence-program.spec.md). Decisiones aplicadas: D-02, D-04 a D-07, D-09 a D-11, D-14 a D-16 del [acta](operational-intelligence-program.reconciliation.md).

## 1. Problema y resultado

SEMSE tiene piezas que se parecen a una decisión pero ninguna lo es: `AgentDecision` (hallazgo del bucle de autonomía, sin `tenantId`), `AgentApproval` (artefacto de aprobación, mutable), `AuditLog` (evidencia) y `PolicyDecision` (resultado de autorización). No existe un registro **inmutable** que diga «esta decisión ya fue autorizada por esta autoridad, a partir de estas fuentes, y produjo estos efectos».

Resultado: un registro de solo-agregar de decisiones **ya autorizadas** por una autoridad competente, con su procedencia y sus efectos referenciados. **Registrar no autoriza**: el ledger nunca concede un permiso ni convierte un hallazgo o propuesta en decisión.

## 2. Alcance

### Incluido
- Tres entidades: `DecisionRecord`, `DecisionSourceRef` y `DecisionEffectRef`.
- Historial de solo-agregar con corrección y anulación como filas nuevas (sección 6).
- Idempotencia por `(tenantId, idempotencyKey)` con clave derivada de la fuente.
- Procedencia de autoridad, política y aprobación.
- Servicio interno `recordAuthorizedDecision(input, tx?)` y lectura por API.
- Un único **primer productor** de bajo riesgo (Q-2) para el canary.
- Migración Prisma aditiva, con protección de inmutabilidad en la base de datos.

### Fuera de alcance
- Autorizar decisiones y reemplazar `PolicyDecision`, `AgentApproval`, `AgentDecision` o `AuditLog`.
- Shared Economic Ledger (F5) y **decisiones financieras** (escrow, pagos, disputas): excluidas de V1 (D-11, L-20).
- Promoción automática de un hallazgo o propuesta a decisión.
- Copiar cuerpos de conversaciones o los resúmenes de H05.
- Endpoint público de escritura (`POST`): no existe en V1.
- UI (queda para un slice posterior si el owner la pide).

## 3. Actores, permisos y límites

| Actor | Permiso backend | Alcance | Puede | No puede |
|---|---|---|---|---|
| Servicio productor (módulo de dominio) | llamada interna a `recordAuthorizedDecision`, sin permiso HTTP | su tenant y organización | registrar una decisión que su propio módulo ya autorizó | registrar por otro módulo; inventar autoridad |
| Usuario con rol operativo | permiso de **lectura** de decisiones, nombre a fijar en `packages/auth/src/rbac.ts` (D-04) | su tenant y organización | consultar decisiones visibles de sus recursos | leer decisiones de recursos sobre los que no participa |
| Autoridad de anulación | permiso **separado** de anulación, nombre a fijar (L-04) | su tenant | registrar una anulación con motivo | borrar o editar historial |
| `OPS_ADMIN` | lectura | su tenant; cruce entre organizaciones solo por regla explícita (Q-4) | lectura administrativa | cruzar tenants |

- **Aislamiento:** 404 si la decisión es de otro tenant; 403 si es de otra organización (D-05). La lectura se autoriza contra el recurso al que apunta `subjectType`/`subjectId`, no solo contra el tenant, para evitar IDOR (L-05).
- **`subjectType` es un catálogo cerrado**, no texto libre (L-05, L-20). V1 incluye solo los tipos que necesita el primer productor; añadir uno exige actualizar este spec. **Sin tipos financieros.**
- **Autoridad:** `authorityType` es un catálogo cerrado (humano, política, autoridad de dominio). Una decisión **crítica** exige `authorityRef` y, según el caso, `policyId`/`policyVersion` o `approvalRef` (L-06). Qué es «crítica» se define por `decisionKind` en el catálogo (Q-3).
- **Aprobación:** `approvalRef` apunta a `AgentApproval` o a `PrometeoProposedAction` (D-02). Se valida que exista y que pertenezca al mismo tenant y organización.
- **Fuentes sin tenant:** una fuente que no pueda validarse contra el tenant (por ejemplo `AgentDecision`, que no tiene `tenantId`) **no puede citarse** como `DecisionSourceRef` (L-07).
- **Datos `privacyCritical`:** `rationale` es texto libre y puede contener datos personales: se redacta con `redactPublicText`/`redactValue` antes de persistir y tiene tope de longitud (valor en Q-5). No se copian cuerpos de conversaciones; solo referencias.

## 4. Escenarios y criterios de aceptación

### P1 — Registrar una decisión autorizada
```gherkin
Dado un módulo productor que ya autorizó una acción con una autoridad válida
Cuando llama a recordAuthorizedDecision con una clave de idempotencia derivada de la fuente
Entonces se crea una única fila DecisionRecord con su autoridad, fuentes y fecha de registro
  Y se deja una acción de AuditLog
  Y la llamada no concede ningún permiso nuevo
```

### P1 — Reintento idempotente
```gherkin
Dado una decisión ya registrada con la clave K en el tenant T
Cuando el productor reintenta con la misma clave K y el mismo contenido
Entonces no se crea una fila nueva y se devuelve la existente
Y si el contenido difiere, responde 409 sin modificar nada
```

### P1 — Solo-agregar
```gherkin
Dado una decisión registrada
Cuando alguien intenta actualizarla o borrarla (por código o por SQL directo)
Entonces la base de datos lo rechaza
```

### P1 — Corrección y anulación
```gherkin
Dado una decisión activa
Cuando se registra una corrección o una anulación que la referencia
Entonces se añade una fila nueva y la original no cambia
  Y el estado de la original se deriva como SUPERSEDED o VOIDED
  Y dos correcciones concurrentes de la misma decisión no pueden coexistir
```

### P1 — Aislamiento
```gherkin
Dado un actor del tenant A
Cuando consulta una decisión del tenant B
Entonces recibe 404 sin información sobre su existencia
```

### P1 — Referencias a H05 sin copiar
```gherkin
Dado una decisión con un efecto de tipo ejecución de herramienta
Cuando se lee
Entonces el efecto contiene targetType y executionId, nunca los resúmenes de la auditoría de H05
  Y el estado de la ejecución se consulta en vivo con ToolExecutionQueryService
```

## 5. Contratos

Contratos Zod (`.strict()`) en `packages/schemas/src`. Modelo de referencia, no código final:

```text
DecisionRecord
  id, tenantId, orgId?, projectId?, jobId?
  subjectType (catálogo cerrado), subjectId
  entryKind = DECISION | CORRECTION | VOID
  decisionKind (catálogo cerrado, sin financieras)
  decisionValueJson (validado por decisionKind; null en VOID)
  rationale (redactado, con tope)
  authorityType (catálogo cerrado), authorityRef?
  actorUserId?, policyDecision?, policyId?, policyVersion?, approvalRef?
  correlationId?, causationId?
  idempotencyKey            -- derivada de la fuente, no aleatoria
  contentDigest             -- huella del contenido canónico (L-10)
  recordedBy                -- identidad del servicio productor (L-10)
  effectiveAt               -- con límite: no puede ser anterior a su fuente (L-10)
  recordedAt
  supersedesDecisionId?     -- obligatorio en CORRECTION y VOID

DecisionSourceRef  (tenantId, decisionId, sourceType, sourceId, threadId?, messageId?, projectId?, jobId?, occurredAt?)
DecisionEffectRef  (tenantId, decisionId, role = ACTION | VERIFICATION | OUTCOME, targetType, targetId, observedAt?)
```

Reglas del contrato:
- **El estado no se guarda.** `ACTIVE`, `SUPERSEDED` y `VOIDED` se **derivan** de la cadena: una decisión está `SUPERSEDED` si existe una fila `CORRECTION` que la referencia, y `VOIDED` si existe una `VOID`. Esto resuelve la contradicción entre «solo-agregar» y `status` mutable (L-03).
- **Concurrencia (L-04):** unicidad `(tenantId, supersedesDecisionId)`: una decisión solo puede tener un sucesor.
- **Inmutabilidad:** un *trigger* de base de datos rechaza `UPDATE` y `DELETE` sobre las tres tablas. Hay precedente en el repo: la función `prevent_job_scope_snapshot_update` de `20260512110000_security_hardening`.
- **`tenantId` en las referencias** (P-08): es obligatorio en `DecisionSourceRef` y `DecisionEffectRef`.
- **Referencias a H05 (D-02):** `DecisionEffectRef.targetType` identifica la ejecución de herramienta y `targetId` es el `executionId`. Como `executionId` es único solo globalmente (no por tenant), toda lectura lo valida junto con `tenantId`.
- **Sin cascada destructiva:** `onDelete: Restrict` hacia `Tenant`. La baja de un tenant con historial queda como decisión abierta (Q-6).
- **Valores desconocidos** quedan `null`, nunca se infieren (no se reconstruyen decisiones históricas).

Lectura (prefijo propio, sin rutas `@Public`; ruta final a fijar en Q-1):
- `GET <prefijo>/decisions/:id`
- `GET <prefijo>/decisions?subjectType=&subjectId=` con paginación por cursor (tamaño máximo en Q-5)

Respuesta: la decisión con su estado derivado, fuentes, efectos y `correlationId`. Errores: 404 (otro tenant o inexistente), 403 (otra organización), 400 (filtro inválido), 409 (conflicto de idempotencia, solo en la ruta interna).

## 6. FSM, eventos y reconstrucción

**FSM derivada** (a registrar en `docs/foundation/STATE_MACHINES.md` antes del código):

```
DECISION ──(CORRECTION)──▶ SUPERSEDED
DECISION ──(VOID)────────▶ VOIDED
CORRECTION ──(CORRECTION|VOID)──▶ SUPERSEDED | VOIDED
```
Estados terminales: `SUPERSEDED` y `VOIDED`. No hay transición hacia atrás.

**Eventos y auditoría.** Hoy no existe ningún evento `decision.*` en `EVENT_CATALOG.md` (L-08). Este slice debe **añadirlos al catálogo antes de emitirlos**; los nombres siguientes son propuestos, no definitivos (convención `aggregate.action`): registro, corrección y anulación de una decisión. Cada operación deja además una acción de `AuditLog`.

**Atomicidad.** El productor llama a `recordAuthorizedDecision(input, tx)` dentro de **su** transacción cuando comparte base de datos: la decisión y el cambio de negocio se confirman o se revierten juntos. Si el registro falla, **la acción de negocio no se confirma** (fail-closed) salvo que el owner decida lo contrario para un productor concreto (Q-7). Cuando no se pueda compartir transacción, se usa `DomainOutboxEvent` con consumidor idempotente; la reejecución no duplica gracias a la clave de idempotencia.

**Reconstrucción.** Toda la cadena de una decisión se reconstruye desde las tres tablas y las referencias; no depende de datos mutables de otros módulos.

## 7. Datos y migración

Migración Prisma **aditiva** (`migration_status: PENDING`; sin `db push`). Se revisa antes de aplicar y no se aplica sin autorización del owner.

Índices propuestos:
- `(tenantId, subjectType, subjectId, effectiveAt)`
- `(tenantId, correlationId)`
- único `(tenantId, idempotencyKey)`
- único `(tenantId, supersedesDecisionId)`

Más el *trigger* de inmutabilidad y `onDelete: Restrict`.

**Brecha de unión conocida:** ni `AuditLog` ni la auditoría de H05 tienen `correlationId` (P-18), así que unir una decisión con la ejecución solo por `correlationId` no es posible hoy. La unión se hace por `executionId`. Añadir `correlationId` a H05 sería una migración aditiva de **H05**, no de este slice (Q-8).

## 8. Observabilidad, flag y rollout

- Flag `SEMSE_DECISION_LEDGER_MODE`: ausente o desconocido = `off` (D-14).
- **`shadow` no escribe filas.** Las filas de un ledger de solo-agregar son permanentes, así que en `shadow` se calcula y se compara la decisión pero **solo se registra telemetría y conteos**. Escribir filas empieza en `canary`, con una lista de tenants (L-14). Esta es una recomendación sujeta a Q-9.
- `canary`: un tenant permitido y un único productor (Q-2). `live`: todos los tenants, solo tras evidencia del canary.
- Métricas (nombres, SLO y responsable a aprobar, Q-5): registros, reintentos idempotentes, conflictos 409, rechazos por autoridad inválida, fallos de escritura, latencia.
- Logs sin `rationale` ni `decisionValueJson`; solo identificadores, `correlationId` y códigos.
- Auditoría de lecturas: registro de acceso y de denegación sin contenido (D-09).

## 9. Tests requeridos (derivados de la sección 4)

| Criterio | Prueba |
|---|---|
| Registrar | fila única con autoridad, fuentes y AuditLog; no concede permisos |
| Reintento | misma clave y contenido → misma fila; distinto contenido → 409 |
| Solo-agregar | `UPDATE`/`DELETE` rechazados por el trigger, también con SQL directo |
| Corrección/anulación | estado derivado; segunda corrección concurrente rechazada por la unicidad |
| Aislamiento | 2 tenants × 2 organizaciones; 404/403; autorización contra el recurso del sujeto |
| H05 | el efecto referencia `executionId` y no copia resúmenes; lectura valida el tenant |
| Autoridad | decisión crítica sin autoridad/política/aprobación → rechazada; fuente sin `tenantId` → rechazada |
| Datos | `rationale` redactado y con tope; `subjectType` fuera del catálogo → 400 |
| Migración | compatibilidad hacia atrás y aplicación sobre una copia |
| Outbox | reejecución no duplica |

Las pruebas se escriben primero y deben fallar antes del código.

## 10. Mapa de implementación

Rutas definitivas por confirmar al aprobar (sección 15):
- `packages/db/prisma/schema.prisma` y una migración nueva.
- `packages/schemas/src/` (contratos Zod, archivo nuevo).
- `packages/auth/src/rbac.ts` (permisos de lectura y anulación).
- Módulo nuevo y propio bajo `apps/api/src/modules/` (nombre en Q-1; no `intelligence` ni `operational-intelligence`).
- `docs/foundation/STATE_MACHINES.md` y `docs/foundation/EVENT_CATALOG.md`.
- Pruebas bajo `apps/api/test/`.

## 11. Investigación externa

Este slice no depende de documentación externa de grafos. Referencias de contexto: W3C Trace Context (https://www.w3.org/TR/trace-context/) y OpenTelemetry context propagation (https://opentelemetry.io/docs/concepts/context-propagation/) para `correlationId`/`causationId`; las consultas recursivas de PostgreSQL aplican al slice 3, no aquí.

## 12. Prerrequisitos y dependencias (L-22)

- No depende del slice 1 en código (D-16). Puede ir en paralelo solo si el owner lo aprueba por escrito; el orden vigente es 1 → 2 → 3 → 4.
- Requiere: permisos nuevos en `rbac.ts`, FSM en `STATE_MACHINES.md`, eventos en `EVENT_CATALOG.md`, migración revisada.
- **Consumidores declarados:** los specs de `docs/specs/tools/fase-1/` (m1.4) mencionan el ledger como destino de la promoción de un contrato verificado. Quedan registrados como consumidores futuros; el ledger no se modifica por ellos.

## 13. Gates de cierre

- [ ] ADR-044 aceptado con fecha y acta aprobada
- [ ] Spec `APPROVED` (decisiones de la sección 14 resueltas)
- [ ] FSM y eventos añadidos a los documentos de `docs/foundation` antes del código
- [ ] Migración revisada y autorizada por el owner
- [ ] Pruebas escritas y en rojo antes del código
- [ ] `spec:validate:strict`, índice y cobertura en verde
- [ ] CI PASS, merge SHA, despliegue terminal y activación registrados por separado
- [ ] Canary autenticado con un productor y un tenant
- [ ] Evidencia sin secretos

## 14. Decisiones abiertas (requieren al owner)

| ID | Decisión | Recomendación del coordinador |
|---|---|---|
| Q-1 | Nombre del módulo y prefijo de rutas | Nombre propio que no choque con `modules/intelligence` ni `operational-intelligence`; prefijo sin rutas `@Public` |
| Q-2 | **Primer productor** y tenant de canary | Un productor de bajo riesgo, no financiero. Candidato: la aprobación humana de una `PrometeoProposedAction`, que ya tiene tenant, organización y actor. **No lo elijo yo**; los specs m1.4 son consumidores futuros, no el primero |
| Q-3 | Catálogos cerrados de `subjectType`, `decisionKind`, `authorityType` y qué `decisionKind` es «crítica» | Mínimo viable para el primer productor; sin tipos financieros en V1 |
| Q-4 | Nombres de permisos de lectura y anulación; regla de `OPS_ADMIN` entre organizaciones | Un permiso por capacidad; sin cruce entre organizaciones salvo regla explícita |
| Q-5 | Topes numéricos: longitud de `rationale`, tamaño de página, SLO, nombres de métricas y responsable | Los propone el implementador con datos y los aprueba el owner; no se inventan aquí |
| Q-6 | Baja de un tenant con historial; retención y borrado del texto libre | `Restrict` en la base y un procedimiento de baja explícito; retención definida por Legal/Compliance |
| Q-7 | Si el registro falla dentro de la transacción del productor, ¿la acción de negocio se aborta? | Sí (fail-closed), salvo excepción por productor |
| Q-8 | ¿Se añade `correlationId` a la auditoría de H05? | Es migración aditiva de H05; decidirlo en el spec de H05, no aquí |
| Q-9 | `shadow` sin escritura de filas | Aceptar: evita filas permanentes sin efecto de negocio |

### 14.1 Resoluciones del owner (2026-11-06)

El owner respondió «aplica todo» al plan de respuestas del coordinador. Se registran tal como se recomendaron. Esto **no aprueba el spec**: pasa a `APPROVED` cuando el ADR-044 esté aceptado con fecha, el acta aprobada y los slices previos aprobados (sección de gates).

| ID | Resolución |
|---|---|
| Q-1 | Mismo módulo `operational-lineage` del slice 1; prefijo de rutas propio, sin rutas `@Public` |
| Q-2 | **Primer productor:** la aprobación humana de una `PrometeoProposedAction`. Los specs m1.4 quedan como consumidores futuros. Tenant del canary: por designar |
| Q-3 | Catálogos mínimos para ese productor, sin tipos financieros en V1; «crítica» = la decisión que cambia el estado de otros módulos. Los valores de los catálogos se fijan al aprobar el spec |
| Q-4 | `lineage:decisions:read` y un permiso de anulación aparte, `lineage:decisions:void`. `OPS_ADMIN` sin cruce entre organizaciones |
| Q-5 | Topes, tamaño de página, SLO y métricas: se miden y se proponen; el owner aprueba. **Pendiente de dato** |
| Q-6 | `onDelete: Restrict` hacia `Tenant` y un procedimiento explícito de baja; la retención del texto libre la define Legal/Compliance. **Pendiente de esa definición** |
| Q-7 | Si el registro falla dentro de la transacción del productor, la acción de negocio **se aborta** (fail-closed) |
| Q-8 | `correlationId` en H05 se decide en el spec de H05, no aquí; mientras tanto la unión es por `executionId` |
| Q-9 | `shadow` no escribe filas |

## 15. Archivos y endpoints planificados (aún inexistentes)

Se mantienen fuera del frontmatter porque `spec:validate:strict` exige que `related_files` y `related_endpoints` existan. Pasan al frontmatter cuando el slice los cree.

- migración nueva bajo `packages/db/prisma/migrations/`
- `packages/schemas/src/` (archivo de contratos del ledger, nombre tentativo)
- módulo nuevo bajo `apps/api/src/modules/` (nombre en Q-1)
- `apps/api/test/` (pruebas unitarias y de integración, nombres tentativos)
- endpoints: `GET <prefijo>/decisions/:id` y `GET <prefijo>/decisions` (prefijo en Q-1)
