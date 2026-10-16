# Acta de reconciliación — PR 0 de Operational Intelligence

**Estado:** EN CURSO — BLOQUEADA. Esta acta **no** aprueba nada, no reconcilia PR 0 por sí sola y no autoriza preparar ningún slice.
**Coordinador:** Claude (sesión de Claude Code). **Aprobador:** owner del proyecto, en los roles de documentación y arquitectura, seguridad, usabilidad y autoridad final (ver el [registro de progresión](operational-intelligence-program.progression-log.md)).
**Fecha:** 2026-10-15. **Revisión revisada:** `6eae43c`. **Base de esta rama:** `6efcd5e`, sin cambios en los documentos revisados.

## 1. Qué se revisó

### PR 0
- PR #800, merge `05af598` (2026-10-06): 21 documentos más una actualización de `SPEC_INDEX.md`.
- Documentos:
  - `docs/architecture/ADR-042-operational-intelligence-graph.md`, hoy `ADR-044-operational-intelligence-graph.md`;
  - `docs/specs/prometeo/operational-intelligence-program.{spec,plan,tasks,checklist}.md`;
  - `docs/specs/prometeo/unified-graph-contract.{spec,plan,tasks,checklist}.md`;
  - `docs/specs/prometeo/decision-ledger.{spec,plan,tasks,checklist}.md`;
  - `docs/specs/prometeo/unified-query-lineage.{spec,plan,tasks,checklist}.md`;
  - `docs/specs/prometeo/omniverse-adapter.{spec,plan,tasks,checklist}.md`.
- **Cambios desde #800:** solo #940 (`62ce802`, 2026-10-15). Renumeró el ADR de 042 a 044 y actualizó dos referencias en el padre (spec y tasks). El ADR ya había pasado de 035 a 042 en #800, porque `ADR-035-agent-approval-governance-ownership` existía.

### Paquete
- El ZIP recibido el 2026-10-15 contiene un único archivo: `SEMSE_CLAUDE_HANDOFF.md`, de 619 bytes.
- Ese archivo enumera el contenido del paquete (instrucciones de handoff, prompt único, instantánea de estado, investigación de fuentes primarias, ADR-035, specs del padre y de los cuatro slices) pero no incluye ninguno.
- **La comparación paquete ↔ PR 0 está pendiente** hasta que el owner envíe el paquete completo (bloqueo B-01).

### Repo actual
- Código de `apps/api`, `packages/{auth,schemas,db,shared,knowledge}` y `apps/vision-service`.
- Documentos de referencia:
  - `docs/foundation/{EVENT_CATALOG,DOMAIN_INVARIANTS,STATE_MACHINES}.md`, `docs/SOURCE_OF_TRUTH.md`, `docs/architecture/CURRENT_ARCHITECTURE.md`;
  - ADR-035, ADR-042 (Universal Connector), ADR-045 (MCP inbound) y `ADR_ID_RECONCILIATION_2026-10-15.md`;
  - `tool-call-audit-lineage.spec.md` (H05) y los specs de interoperabilidad y MCP S1 (#939, #940);
  - `docs/program/semse-4d-field-memory/`.

### Método
- Cinco revisiones de solo lectura, una por spec, contra `6eae43c`.
- El coordinador comprobó personalmente estos puntos:
  - el frontmatter de H05 está desactualizado;
  - `AgentDecision` no tiene `tenantId` (`schema.prisma:4110-4126`);
  - el RAG de Prometeo añade contexto de Graphify sin pedir `internal:architecture:read` (`prometeo.service.ts:438-444`);
  - el controller `v1/intelligence` mezcla rutas `@Public` de landing que toman el tenant de la cabecera `x-tenant-id` (`intelligence.controller.ts:142-265`). Son públicas a propósito; aquí cuentan como restricción de diseño, no como vulnerabilidad;
  - no hay código del programa en `apps/` ni en `packages/`;
  - el snapshot de verdad de los planes, `370578a`, no existe en el historial disponible del repo (traído desde el 2026-10-05).
- `spec:validate:strict` da 0 errores y `spec:index:check` pasa, en `6eae43c`.

## 2. Conclusión

- **146 hallazgos:** padre y ADR 36, slice 1 29, slice 2 23, slice 3 33, slice 4 25. **99 bloquean** aprobar o implementar.
- **Estado de los specs:** todos en `REVIEW`, con `code_status: NOT_STARTED`, `last_verified` del 2026-10-04 o 2026-10-06, y plan, tasks y checklist en DRAFT o PENDING.
- **Plantillas copiadas:** plan, tasks, checklist, criterios P1 y rollback de los slices 1 a 4 son en gran parte idénticos entre slices (verificado con diff) y no describen lo propio de cada uno.
- **Se cumplen condiciones de parada del flujo:** PR 0 choca con el repo en implementación, seguridad, alcance y aceptación; hay requisitos ambiguos o que no se pueden probar; hay riesgos de seguridad sin dueño ni disposición. Todo queda **escalado al owner**.
- **Qué falta:** ningún slice puede prepararse hasta resolver D-01 a D-16, aplicar los cambios de documentación de la sección 6 y que el owner apruebe esta acta.

## 3. Decisiones que debe tomar el owner

Recomendación del coordinador; decide el owner. Cada decisión cita los hallazgos que resuelve.

| ID | Decisión | Recomendación | Hallazgos |
|---|---|---|---|
| D-01 | Aceptar o rechazar ADR-044 | Completar el ADR (criterio de aceptación, opciones, riesgos, consecuencias, rollback, aprobador) y aceptarlo con fecha antes de aprobar cualquier slice | P-35, G-01, O-13 |
| D-02 | Relación con H05 (`tool-call-audit-lineage`) | El Decision Ledger y el provider runtime **referencian** H05 y no copian nada: `approvalRef` apunta a `AgentApproval` o `PrometeoProposedAction`; cada ejecución es un `DecisionEffectRef` con `targetId = executionId`; el estado se lee en vivo con `ToolExecutionQueryService`. No se guardan los resúmenes de H05, que se purgan a los 90 días. Antes, corregir los metadatos de H05 con evidencia de Railway | P-01, P-02, P-03, L-01, L-02, L-18, L-19, Q-01, Q-32, G-28 |
| D-03 | Módulo y ubicación | Un módulo nuevo y propio, sin rutas `@Public`: no dentro de `modules/intelligence` ni con el nombre `operational-intelligence`, que ya existe con otro significado. Contratos Zod en `packages/schemas/src`, según `SOURCE_OF_TRUTH.md` | P-04, G-03, G-16, L-17, Q-08, O-23 |
| D-04 | Permisos | Permisos nuevos de solo lectura por capacidad (grafo, decisiones, snapshot) en `packages/auth/src/rbac.ts`, una tabla actor × proveedor × permiso, y la regla ante autorización parcial | P-05, G-08, L-05, Q-09, O-02 |
| D-05 | Aislamiento | 404 si es de otro tenant y 403 si es de otra org (patrón C51), matriz de pruebas con 2 tenants y 2 orgs, y una regla explícita para OPS_ADMIN entre orgs | P-06, G-10, Q-10, O-03 |
| D-06 | Visibilidad de nodos y aristas ocultos | Omitir sin dejar rastro: ni placeholder ni conteo. Una denegación nunca aparece como degradación | P-07, G-09, Q-12, Q-13 |
| D-07 | Protección de datos | Un solo vocabulario y orden de sensibilidad, techo por rol, allowlist de atributos por proveedor, redacción con `redactValue`/`redactPublicText`, `privacyCritical: true` con enrutamiento al LLM local o filtrado previo, y retención y borrado del texto libre del ledger | P-09, P-10, P-11, G-11, G-12, L-09, Q-14, O-04 |
| D-08 | Graphify | Exigir `internal:architecture:read` también vía Prometeo, prueba técnica previa de un adaptador estructurado (`graph.json` o salida JSON), versión fija de `graphifyy` y validación de argumentos | P-12, P-25, G-05, G-06, G-22, Q-11 |
| D-09 | Auditoría de lecturas | Un registro de acceso y de denegación sin contenido (actor, tenant, org, alcance, `correlationId`) para consultas y snapshots, alineado con interoperabilidad y ADR-045 | P-13, G-23, Q-16, O-08 |
| D-10 | Frontera con interoperabilidad y MCP | La tool del grafo es solo para Prometeo interno y **no se expone por MCP** hasta que exista un spec hijo. Hay que nombrar al dueño de `decisionId`/`auditRef`. Es urgente porque el slice S1 de MCP avanza (#943) | P-15, Q-06, G-29 |
| D-11 | Semántica del Decision Ledger | Append-only real: estado derivado por fila nueva con `supersedesDecisionId`, protegido con trigger. FSM en `STATE_MACHINES.md`. Permiso para anular. Clave de idempotencia derivada de la fuente, con 409 si llega con otro payload. `tenantId` en las referencias. Catálogo cerrado de `decisionKind` **sin decisiones financieras en V1**. Evento en `EVENT_CATALOG.md` y acciones de AuditLog. Comportamiento si falla dentro de la transacción del productor. Primer productor nombrado, y los specs m1.4 registrados como consumidores | P-08, P-20 a P-24, L-03 a L-08, L-10, L-11, L-15, L-16, L-20 |
| D-12 | Vocabulario del contrato | `SourceRef` como unión discriminada compatible con `conversationSourceRefSchema`; aristas con autoridad o marca de derivada; claves de unión (`correlationId`, que puede requerir una migración aditiva); mapeo a `CanonicalDataEnvelope` y `repo-knowledge` sin crear un tercer vocabulario | P-16, P-17, P-18, P-26, G-02, G-04, G-15, G-21, Q-07, Q-21, Q-24 |
| D-13 | Omniverse | Nombrar el repo, el dueño y la versión del contrato; definir la identidad del consumidor (ADR-045 y ¿conexión del Universal Connector según ADR-042?); obligaciones de retención y revocación; cero escrituras (sin el upsert de `ensureActorContext`); kill switch | P-14, O-01, O-02, O-09, O-15, O-16, O-17 |
| D-14 | Rollout, límites y valores por defecto | Semántica de `off/shadow/canary/live` por flag, matriz de flags entre slices, `off` por defecto (un valor desconocido se trata como `off`), topes numéricos, tiempo total, cuota por actor y respuesta con el flag en `off` | P-29, P-30, G-17, G-20, G-26, L-14, Q-15, Q-27, O-17, O-18 |
| D-15 | Alcance de usabilidad | Por slice, UI dentro o fuera de alcance; estados (loading, empty, forbidden, degraded, error); catálogo de errores; accesibilidad, incluida una alternativa textual a la vista 3D; runbooks; SLO; propagación de `correlationId` | P-31, G-24, G-25, L-23, Q-28, Q-29, O-20, O-21 |
| D-16 | Orden y dependencias | Mantener el orden del paquete (1 → 2 → 3 → 4) o aprobar que el slice 2 vaya en paralelo (no depende del 1 en código); decidir si se divide el slice 3; declarar el slice 1 como librería con el canary diferido al slice 3. El slice 2 solo se puede revertir hacia adelante en datos | P-28, G-13, G-14, G-17, L-22, Q-04, O-12 |

## 4. Hallazgos por documento

**Valores comunes a todas las filas:**
- **Estado:** ABIERTO.
- **Quién decide:** el owner.
- **Quién aplica los cambios de documentación:** el coordinador, tras la decisión.
- **Impacto:** **B** bloquea aprobar o implementar; **N** no bloquea.
- **Solo doc:** "sí" se resuelve con documentación; "no" requiere código, una prueba técnica o evidencia externa.
- La evidencia detallada (archivo:línea) está en las revisiones de solo lectura; aquí se resume.

### 4.1 Padre y ADR-044 (P-01 a P-36)

| ID | Tipo | Hallazgo | Imp. | Solo doc |
|---|---|---|---|---|
| P-01 | decisión abierta | El solape con H05 está "pendiente de decisión del owner" (ADR-044:190) sin persona ni fecha | B | sí |
| P-02 | discrepancia | ADR-044 dice que H05 añade "modelos nuevos"; en realidad añade columnas nulables | N | sí |
| P-03 | contradicción | H05 dice `migration_status: PENDING` y a la vez "aplicada en producción el 2026-10-06" | N | no (Railway) |
| P-04 | conflicto de alcance | Ya existe el módulo `operational-intelligence` (`v1/operational-intelligence`); los hijos apuntan a `modules/intelligence` | B | sí |
| P-05 | gap seguridad | No hay permisos; `rbac.ts` no tiene `intelligence:*`/`decisions:*`/`graph:*`; el prefijo se comparte con rutas `@Public` | B | sí |
| P-06 | gap seguridad | Solo aislamiento por tenant; las aristas no llevan `orgId`; OPS_ADMIN cruza orgs | B | sí |
| P-07 | gap seguridad | No se define la visibilidad ni la no enumeración de nodos y aristas ocultos | B | sí |
| P-08 | discrepancia | `DecisionSourceRef` y `DecisionEffectRef` no tienen `tenantId`, que la constitución exige | B | sí |
| P-09 | gap seguridad | Texto libre del ledger sin redacción ni retención; cascade del Tenant frente a "no destructive cascade" | B | sí |
| P-10 | gap seguridad | Falta `privacyCritical` y el enrutamiento al LLM de datos confidential o restricted (Art. VIII) | B | sí |
| P-11 | gap seguridad | No hay techo de sensibilidad por rol ni allowlist en el contrato base | B | sí |
| P-12 | gap seguridad | Los nodos de Graphify son globales (`tenantId: null`); no se define quién los ve | B | sí |
| P-13 | gap seguridad | Las lecturas no se auditan (interoperabilidad exige `auditRef` en el 100 %) | B | sí |
| P-14 | gap seguridad | El cliente Omniverse no tiene identidad (riesgo de confused deputy, ADR-045) | B | sí |
| P-15 | conflicto de alcance | No hay frontera con interoperabilidad #939 ni ADR-045 (interop plan:78 lo pide) | B | sí |
| P-16 | discrepancia | Ya existen contratos parciales de lineage (Universal Connector, outbox, H05) y los vocabularios no coinciden | B | sí |
| P-17 | discrepancia | No existe un `SourceRef` genérico | B | sí |
| P-18 | omisión | AuditLog y la auditoría de H05 no tienen `correlationId`: faltan claves de unión | B | parcial |
| P-19 | omisión | `AgentDecision` no tiene `tenantId`; `JevDecisionEvent` y `PrometeoProposedAction` no se mencionan | N | sí |
| P-20 | decisión abierta | `authorityType`, `approvalRef` y `policy*` sin tipo (ADR-035); "decisión crítica" sin definir | B | sí |
| P-21 | contradicción | Append-only frente a un `status` mutable; FSM no registrada; nadie tiene permiso para anular | B | sí |
| P-22 | omisión | Eventos `decision.*` no catalogados | B | sí |
| P-23 | omisión | No se define el fallo dentro de la transacción del productor ni el caso de misma clave con otro payload | B | sí |
| P-24 | dependencia oculta | No hay primer productor; los specs m1.4 (critical) ya dependen del ledger; `paymentGovernance` no declarado | B | sí |
| P-25 | decisión abierta | Mapeo código ↔ operación: Graphify devuelve texto; `graphifyy` sin versión fija | B | no (prueba técnica) |
| P-26 | omisión | Las aristas no marcan autoridad ni si son derivadas | B | sí |
| P-27 | contradicción | La cadena semántica incluye o no `verification` según el documento | N | sí |
| P-28 | omisión | Faltan el grafo de dependencias y la matriz de reversibilidad | N | sí |
| P-29 | ambigüedad | Rollout sin semántica, cohorte, SLO ni valor por defecto | B (activar) | sí |
| P-30 | gap seguridad | No hay topes numéricos ni rate limit por actor | N | sí |
| P-31 | gap usabilidad | Faltan tabla de actores, UI, estados, errores, citas, alternativa accesible al 3D y runbook | B (aceptación) | sí |
| P-32 | metadato | `last_verified` y snapshot `370578a` desactualizados; el snapshot no está en el repo | N | sí |
| P-33 | metadato | Plan DRAFT y tasks PENDING frente a spec REVIEW; `migration_status: PENDING` sin migración; faltan secciones de la plantilla | N | sí |
| P-34 | omisión | No hay `analyze` registrado (SDD_GOVERNANCE.md:45-47) | B | sí |
| P-35 | decisión abierta | ADR-044 PROPOSED sin criterio de aceptación, aprobador, opciones, riesgos ni rollback | B | sí |
| P-36 | metadato | Checklist del acta de IDs ADR sin marcar; referencias viejas en interop `receive.md:52` y `plan.md:22` | N | sí |

### 4.2 Slice 1 — Unified Operational Graph Contract (G-01 a G-29)

| ID | Tipo | Hallazgo | Imp. | Solo doc |
|---|---|---|---|---|
| G-01 | omisión | No cita ADR-044 ni el padre; falta el gate "ADR aceptado" | B | sí |
| G-02 | omisión | `GraphQuery`, `AuthorizedGraphQuery` y `ProviderGraphResult` no están definidos en ningún archivo | B | sí |
| G-03 | contradicción | El contrato va en `apps/api`; `SOURCE_OF_TRUTH.md` exige `packages/schemas` (Zod) | B | sí |
| G-04 | discrepancia | `SourceRef` existe en dos formas incompatibles (código frente al spec de conversaciones) | B | sí |
| G-05 | decisión abierta | Graphify devuelve texto libre; la prueba de normalización no se puede hacer | B | no |
| G-06 | gap seguridad | Graphify: la API exige `internal:architecture:read` pero el RAG lo inyecta a cualquiera con `agents:run:create` | B | sí (decisión) |
| G-07 | gap seguridad | La autorización está en los controllers, no en los servicios; un proveedor se la saltaría | B | no |
| G-08 | gap seguridad | No hay matriz actor × proveedor × permiso ni regla de autorización parcial | B | sí |
| G-09 | contradicción | No se distingue denegación de degradación; falta taxonomía de errores | B | sí |
| G-10 | contradicción | Solo cross-tenant; DOMAIN_INVARIANTS:13-14 resuelve la propiedad por org | B | sí |
| G-11 | gap seguridad | Techo de sensibilidad sin regla; orden restricted/confidential inconsistente entre código y ADR | B | sí |
| G-12 | gap seguridad | Datos personales de conversaciones (teléfono, nombre, cuerpo) sin redacción en `label`/`attributes`; falta `privacyCritical` | B | sí |
| G-13 | dependencia | El proveedor de conversaciones depende de la Ola 3 de conversation-intelligence (CI-030 a CI-034) | B | sí |
| G-14 | conflicto de alcance | Proveedor de memoria: stores incluidos sin definir; KnowledgeFact y FactLink ya son un grafo y FactLink no tiene `tenantId` | B | sí |
| G-15 | conflicto de alcance | Ya existe el grafo técnico de `repo-knowledge`/`anatomy`/`runtime` con otro vocabulario | N | sí |
| G-16 | conflicto de alcance | `modules/intelligence` no es un bounded context; nombre homónimo; owners no coinciden | N | sí |
| G-17 | contradicción | El slice no tiene consumidor, pero exige canary autenticado y deploy | B | sí |
| G-18 | discrepancia | Rollback copiado del ledger; tasks idénticas a las del slice 3 | N | sí |
| G-19 | omisión | Los P1 son genéricos, sin Gherkin ni mapeo a pruebas; `related_tests` vacío | B | sí |
| G-20 | omisión | No hay topes numéricos; Graphify tiene un timeout fijo de 15 s sin AbortSignal | B | parcial |
| G-21 | omisión | No se definen identidad, dedupe, precedencia ni poda de aristas | B | sí |
| G-22 | gap seguridad | No hay validación de entrada; argumentos al CLI de Graphify sin validar | B | no |
| G-23 | gap seguridad | No se definen auditoría de lecturas sensibles ni política de logs | N | sí |
| G-24 | gap usabilidad | `degradedSources` sin motivo; falta guía para quien implementa un proveedor | N | sí |
| G-25 | gap usabilidad | Métricas sin nombre, SLO, alertas ni owner; origen de `correlationId` sin definir | N | sí |
| G-26 | gap usabilidad | Valor por defecto del flag sin declarar | N | sí |
| G-27 | metadato | `last_verified` y snapshot desactualizados; `related_files` vacío; falta analyze y secciones de la plantilla | B (aprobar) | sí |
| G-28 | decisión abierta | Las decisiones del slice no tienen responsable | N | sí |
| G-29 | solapamiento | No se mapea con Universal Connector ni con interoperabilidad | N | sí |

### 4.3 Slice 2 — Decision Ledger (L-01 a L-23)

| ID | Tipo | Hallazgo | Imp. | Solo doc |
|---|---|---|---|---|
| L-01 | conflicto de alcance | No menciona H05 ni `executionId`; el solape solo figura en ADR-044:190 | B | sí |
| L-02 | metadato | Frontmatter de H05 desactualizado; faltan su plan, tasks y checklist; unicidad de `executionId` sin `tenantId` | N | sí |
| L-03 | contradicción | Append-only frente a `status` mutable; inmutabilidad sin mecanismo (hay precedente de trigger) | B | sí |
| L-04 | omisión | No hay contrato para superseder o anular, ni autoridad, ni regla de concurrencia; FSM sin registrar | B | sí |
| L-05 | gap seguridad | Lectura sin permiso; `subjectType` abierto (IDOR); 404/403 sin fijar | B | sí |
| L-06 | gap seguridad | Reglas de autoridad y aprobación sin definir; ADR-035 dice que solo `decision` cruza el límite | B | sí |
| L-07 | gap seguridad | Fuentes sin `tenantId` (`AgentDecision`) que no se pueden validar | B | sí |
| L-08 | omisión | `related_events` vacío; no hay eventos `decision.*`; AuditLog omitido | B | sí |
| L-09 | gap seguridad | Datos personales, retención y borrado del texto libre sin definir | B | sí |
| L-10 | gap seguridad | Sin digest, `recordedBy` ni límite de `effectiveAt` (permite fechar hacia atrás) | N | sí |
| L-11 | omisión | Idempotencia: generación de la clave, conflicto de payload y reintentos de H05 | B | sí |
| L-12 | discrepancia | Las secciones 3, 4 y 11 son copia del slice 1; la degradación no aplica a un almacén de escritura | B | sí |
| L-13 | omisión | No hay mapeo criterio → prueba → tarea; tasks con "if applicable" | B | sí |
| L-14 | decisión abierta | Rollout de escritura sin definir: las filas escritas en shadow son permanentes | B | sí |
| L-15 | omisión | No se nombra un primer productor ni un tenant de canary | B (entrega) | sí |
| L-16 | omisión | Rollback de datos, punto de recuperación, `onDelete` y baja de tenant | B | sí |
| L-17 | conflicto de alcance | Módulo dueño y transacciones entre módulos | N | sí |
| L-18 | dependencia | H05 solo escribe `source: prometeo_tools`; el copiloto no tiene fila de auditoría | N | sí |
| L-19 | discrepancia | Las filas de H05 son mutables y se purgan a los 90 días: hay que referenciar `executionId` y los digests | N | sí |
| L-20 | gap seguridad | `decisionKind` sin acotar (escrow, disputas): gobierno de pagos | B | sí |
| L-21 | metadato | `last_verified` desactualizado; no enlaza ADR-044; faltan el gate del ADR y los campos SEMSE | N | sí |
| L-22 | omisión | Prerrequisitos sin declarar (no depende del slice 1 en código) | N | sí |
| L-23 | gap usabilidad | Faltan esquema de respuesta, paginación, errores, BFF/UI, accesibilidad, observabilidad y runbook | N | sí |

### 4.4 Slice 3 — Unified Query and Lineage (Q-01 a Q-33)

| ID | Tipo | Hallazgo | Imp. | Solo doc |
|---|---|---|---|---|
| Q-01 | decisión abierta | El provider runtime debe reutilizar H05 (`ToolExecutionQueryService`); sin decidir | B | sí |
| Q-02 | omisión | Las fuentes del provider runtime no están definidas; choca de nombre con `runtime-knowledge` | B | sí |
| Q-03 | ambigüedad | El decision provider no define su fuente; incluir `AgentDecision` rompe el aislamiento por tenant | B | sí |
| Q-04 | omisión | No declara que depende de los slices 1 y 2; `AuthorizedGraphQuery` sin definir | B | sí |
| Q-05 | conflicto de alcance | No hay punto de consulta canónico frente a 6 superficies existentes y 3 planeadas; falta en SOURCE_OF_TRUTH | B (aprobar) | sí |
| Q-06 | conflicto de alcance | El Tool Registry se comparte con MCP S1 y no tiene campo de exposición | B | sí (código si se añade el campo) |
| Q-07 | discrepancia | `SourceRef`, `auditRef` y `decisionId` sin alinear con S1 | B | sí |
| Q-08 | conflicto de ubicación | `modules/intelligence` tiene rutas `@Public` con tenant por cabecera; el módulo `operational-intelligence` es homónimo | N | sí |
| Q-09 | gap seguridad | No hay permiso RBAC ni descriptor de la tool | B | sí |
| Q-10 | gap seguridad | Falta aislamiento por org y la matriz 2 × 2 | B | sí |
| Q-11 | gap seguridad | Alcance de Graphify y puente código → operación | B | sí |
| Q-12 | decisión abierta | Nodos intermedios no autorizados: omitir, placeholder o fallar | B | sí |
| Q-13 | gap seguridad | 404/403 y denegado frente a degradado (oráculo `missingSources: ["forbidden"]`) | B | sí |
| Q-14 | gap seguridad | Allowlist, redacción, techo de sensibilidad y `privacyCritical` | B | sí |
| Q-15 | gap seguridad | DoS: topes, tiempo total, cuota; Graphify a 15 s; agent-memory con N+1 | B | sí |
| Q-16 | gap seguridad | No se audita el acceso por POST directo | B | sí (código si se persiste) |
| Q-17 | gap seguridad | Prompt injection: labels y atributos deben marcarse como no confiables | B | sí |
| Q-18 | omisión | La guarda ResourceScope no detecta `sourceId` en el body | N | sí |
| Q-19 | ambigüedad | No se dice qué runtime de Prometeo consume la tool | B | sí |
| Q-20 | omisión | Contrato incompleto: Zod, enums, parámetros por modo, errores, paginación | B | sí |
| Q-21 | omisión | La prueba "sin aristas inferidas autoritativas" no se puede verificar | B | sí |
| Q-22 | decisión abierta | No se dice qué providers son autoritativos ni qué pasa si cae el Ledger | B | sí |
| Q-23 | omisión | P1 copiados; faltan Gherkin y pruebas (org, logs, flag, 403/404, timeouts, integración con BD) | B | sí |
| Q-24 | discrepancia | Unión decisión → acción sin clave (H05 no tiene `correlationId`; purga de 90 días) | B | sí, o no si hay migración |
| Q-25 | discrepancia | Rollback copiado; respuesta con el flag en `off`; tool en un registro estático | N | sí |
| Q-26 | omisión | Tasks y checklist con plantilla genérica y tareas que faltan | N | sí |
| Q-27 | ambigüedad | Rollout sin semántica ni matriz de flags | N | sí |
| Q-28 | gap usabilidad | Sin UI/BFF ni estados; cómo se presentan el lineage y las citas | N | sí |
| Q-29 | gap usabilidad | Métricas sin dimensiones, SLO ni propagación de trazas | N | sí |
| Q-30 | omisión | Faltan tabla de actores, frontera tenant/org y campos SEMSE | B (gobernanza) | sí |
| Q-31 | metadato | `last_verified` y snapshot desactualizados | N | sí |
| Q-32 | metadato | Frontmatter de H05 desactualizado | N | sí |
| Q-33 | conflicto de alcance | El RAG de Prometeo filtra solo por tenant y proyecto: prohibirlo como provider sin control de propiedad | N | sí |

### 4.5 Slice 4 — Omniverse Read-Only Projection Adapter (O-01 a O-25)

| ID | Tipo | Hallazgo | Imp. | Solo doc |
|---|---|---|---|---|
| O-01 | conflicto de alcance | El repo externo no tiene nombre, dueño, versión ni contrato; el canary no tiene consumidor | B | sí |
| O-02 | decisión abierta | El principal y el permiso del consumidor no están definidos (OPS_ADMIN tiene unos 90 permisos, con escritura) | B | sí |
| O-03 | gap seguridad | OPS_ADMIN cruza orgs y `projectId` es opcional: una petición podría devolver todo el tenant | B | sí |
| O-04 | gap seguridad | Allowlist sin publicar; falta sensibilidad máxima, PII y ubicaciones, y si salen `tenantId` y `sourceRefs` | B | sí |
| O-05 | contradicción | La salida contradice el contrato del padre (faltan `maxDepthApplied` y `correlationId`); `sourceSha` y `freshness` sin definir | B | sí |
| O-06 | omisión | Contrato de API incompleto: permisos, esquema, errores, flag en off, `nodeType`, límites | B | sí |
| O-07 | metadato | Faltan los campos SEMSE y la tabla de actores | N | sí |
| O-08 | gap seguridad | Las exportaciones no se auditan | B | sí |
| O-09 | decisión abierta | Relación con Universal Connector (ADR-042) sin decidir | B | sí |
| O-10 | conflicto de alcance | Relación con Field Memory 4D, el visor 3D y BIM | N | sí |
| O-11 | conflicto de alcance | Nombre y relación con Mission Control y el Digital Twin | N | sí |
| O-12 | omisión | No cita el padre ni los slices previos; no se puede construir sin el slice 1 | B | sí |
| O-13 | decisión abierta | ADR-044 PROPOSED; decisión del owner pendiente | B | sí |
| O-14 | contradicción | Plan, tasks y checklist copiados del slice 1 (historial del ledger, migración) | N | sí |
| O-15 | gap seguridad | Los datos ya entregados no tienen retención, purga ni revocación | B | sí |
| O-16 | gap seguridad | "Solo lectura" no se puede demostrar: `ensureActorContext` hace upsert | B | sí |
| O-17 | omisión | Shadow y canary sin semántica; no hay kill switch | B (rollout) | sí |
| O-18 | gap operación | Throttler de 20 por minuto; `CORS_ORIGINS` (variable de producción) | N | sí |
| O-19 | omisión | Cursor y delta sin criterio | N | sí |
| O-20 | gap usabilidad | `freshness`, motivos legibles, catálogo de errores, estados e i18n | N | sí |
| O-21 | gap usabilidad | SLO, alertas, runbook y trazas | N | sí |
| O-22 | omisión | P1 genéricos sin mapeo a pruebas; faltan pruebas de rechazo, flag, cross-org, cero escrituras y auditoría | B | sí |
| O-23 | discrepancia | `SEMSE_API_SURFACE_V1.md` no documenta `v1/intelligence`; registro del controller sin definir | N | sí |
| O-24 | metadato | `last_verified`, SHAs y enlaces desactualizados | N | sí |
| O-25 | omisión | La investigación externa no cubre la plataforma consumidora | N | sí |

## 5. Requisitos de seguridad y usabilidad ya definidos y verificables

**Seguridad (padre, ADR-044 y slices):**
- Sin BD de grafos ni persistencia genérica en V1.
- Omniverse no escribe ni se conecta a PostgreSQL y recibe solo datos saneados.
- Un hallazgo no se convierte solo en decisión.
- Una petición de otro tenant falla cerrada antes de devolver contenido.
- No hay elevación de alcance y una lectura nunca autoriza acciones.
- Los valores históricos desconocidos quedan en `null`.
- Sin cuerpos completos de fuentes en logs.
- Sin `db push`; solo migraciones aditivas.
- Unicidad `(tenantId, idempotencyKey)` del ledger y no se borra su historial.
- Recorrido acotado ante ciclos; sin aristas fabricadas.
- Pruebas listadas: aislamiento, append-only, idempotencia, supersesión, saneo de Omniverse, autorización de Prometeo.
- Gates de cierre: spec APPROVED antes del código, pruebas en rojo primero, canary autenticado y evidencia sin secretos.

**Usabilidad:**
- Toda respuesta lleva `degradedSources`, `truncated`, `maxDepthApplied` y `correlationId`.
- Una fuente caída se marca como degradada y se conserva el resto.
- Rollout por etapas.
- Métricas de latencia, éxito y fallo, alcance denegado y degradación.
- Evidencia separada de CI, merge, deploy y activación.
- Actualizar `CURRENT_ARCHITECTURE` y la API surface.

**Verificable solo cuando se definan los valores que faltan:** techo de sensibilidad, allowlist, topes numéricos, permisos y semántica de rollout (ver D-04, D-07 y D-14).

## 6. Cambios de documentación requeridos

Se aplican después de las decisiones, en PRs solo de documentación, sin código.
1. **ADR-044:**
   - completar criterio de aceptación, opciones, riesgos, consecuencias, rollback y aprobador;
   - corregir P-02 y P-27;
   - registrar D-02 y D-10.
2. **H05 (`tool-call-audit-lineage.spec.md`):** reconciliar el frontmatter con la evidencia de merge y de Railway (B-03) y regenerar `SPEC_INDEX.md`.
3. **Padre:**
   - grafo de dependencias y matriz de reversibilidad (D-16);
   - frontera con interoperabilidad y MCP (D-10);
   - tabla de actores, `privacyCritical`, `auditLog`, `sse`, `fsmTransicion` y `paymentGovernance`;
   - semántica de flags (D-14);
   - `analyze` (P-34);
   - refrescar `last_verified` y el snapshot.
4. **Cada slice:**
   - reescribir alcance, criterios P1 (Gherkin propio), contrato completo (Zod, errores, límites) y matriz criterio → prueba → tarea;
   - plan, tasks, checklist y rollback propios (quitar lo copiado);
   - secciones de seguridad (D-04 a D-09) y de usabilidad (D-15);
   - prerrequisitos;
   - `related_files` con los archivos existentes.
5. **`docs/foundation`:** FSM del ledger en `STATE_MACHINES.md` y eventos en `EVENT_CATALOG.md` (D-11).
6. **`SOURCE_OF_TRUTH.md`:** entrada para la consulta y el linaje como fachada federada (Q-05).
7. **Referencias:**
   - acta de IDs ADR: marcar el checklist y corregir referencias viejas en interop `receive.md:52` y `plan.md:22` (P-36);
   - API surface (O-23).

## 7. Cambios de documentación aplicados

Ninguno sobre specs, ADRs ni código. Solo se crearon esta acta y el [registro de progresión](operational-intelligence-program.progression-log.md).

## 8. Elementos diferidos

Ninguno aprobado. Diferir un hallazgo exige que el owner lo apruebe, con dueño, fecha y autoridad.

## 9. Bloqueos y ambigüedades restantes

| ID | Bloqueo | Responsable | Salida |
|---|---|---|---|
| B-01 | Falta el paquete completo: el ZIP solo trae el índice | Owner | Enviar el paquete y comparar paquete ↔ PR 0 |
| B-02 | Decisiones D-01 a D-16 | Owner | Decisión registrada en el registro de progresión |
| B-03 | Estado real de H05 en producción (migración aplicada, flag `PROMETEO_TOOL_AUDIT_LIFECYCLE`) | Owner, con lectura de Railway | Evidencia sin secretos |
| B-04 | **Verificación de repositorio COMPLETADA:** `Samuelcastella/semse-omniverse-control-center` privado, acceso de lectura comprobado. **Integración NO VERIFICADA:** contrato, identidad, permisos y despliegue permanecen sujetos a D-13 y a los gates de seguridad del repo consumidor | Owner + coordinador | Mantener D-13 abierta y pasar controles de seguridad antes de conectar; ver §9.1 |
| B-05 | Prueba técnica previa de Graphify estructurado (P-25, G-05) | Coordinador, tras D-08 | Resultado antes de preparar el slice 1 |

## 9.1. Evidencia posterior: repositorio Omniverse y seguridad de la interfaz (2026-10-16 UTC)

Esta es **una actualización de hechos observables posterior al merge de #948**, no una decisión D-13 ni aprobación del programa. El acta conserva **EN CURSO — BLOQUEADA**.

- **B-04 — localización y lectura verificadas:** repositorio privado [`Samuelcastella/semse-omniverse-control-center`](https://github.com/Samuelcastella/semse-omniverse-control-center), propietario `Samuelcastella`, rama principal `main`. Acceso de lectura comprobado vía GitHub, con inspección directa de `README.md`, `package.json`, `api/router.ts`, `api/boot.ts`, `api/context.ts`, `api/middleware.ts`, `api/semse-router.ts`, `src/hooks/useSemseApi.ts` y `src/providers/trpc.tsx`.
- **Arquitectura observada:** frontend React/Vite, backend Hono/tRPC y persistencia Drizzle/MySQL; `src/providers/trpc.tsx` apunta a `/api/trpc` del propio Omniverse, y `api/router.ts` expone `semse`, `integration`, `connectors`, `intelligence` sobre su API. La semejanza nominal de `semseRouter` **no demuestra** integración con `semse-API` ni transferencia de autoridad canónica. No se han verificado endpoints compartidos, SSO federado, entorno Railway, sincronización auténtica ni lecturas de SEMSE en vivo. D-13 permanece **SIN DECIDIR**.
- **Gate de seguridad previo a integración:** en `api/middleware.ts`, `publicQuery` y `publicMutation` no exigen autenticación; `api/context.ts` considera opcional la sesión; `api/semse-router.ts` asigna procedimientos públicos a mutaciones como `seed`, `fleetNodes.updateStatus`, `chatMessages.create`, `specTasks.create` y `systemEvents.create`, así como consultas de mensajes e historial de ejecución de herramientas. **Hallazgo demostrado por código, no explotación ni verificación de exposición de un deployment.** Se registró en [Omniverse issue #2](https://github.com/Samuelcastella/semse-omniverse-control-center/issues/2) para su remediación E01–E05.
- **Condición de implementación:** tratar Omniverse como consumidor no confiable hasta acreditar middleware fail-closed, RBAC, alcance tenant/org, lectura saneada, identidad de servicio, auditoría, revocación, pruebas negativas y ausencia de datos demo disfrazados de producción. No autorizar Omni → SEMSE, migraciones ni deploy en virtud de esta nota.
- **Sin operaciones productivas:** esta inspección fue solo lectura en GitHub. No se enviaron llamadas a endpoints de Omniverse, no se cambiaron datos ni secretos, no se lanzó un canary, no se probó la base y no se alteró Railway.

**Resultado:** se reduce el bloqueo B-04 al contrato y la evidencia operativa pendientes, pero B-01, B-02, B-03, B-05 y D-01 a D-16 no cambian de estado. La etapa 1 continúa bloqueada y ningún slice puede comenzar sin aprobación.

## 10. Confirmación

**PR 0 NO está reconciliado.** Se reconciliará cuando se cumpla todo esto:
- el paquete esté comparado;
- D-01 a D-16 tengan disposición;
- se hayan aplicado los cambios de la sección 6;
- el owner apruebe esta acta en el registro de progresión, con la revisión del repo aprobada.
