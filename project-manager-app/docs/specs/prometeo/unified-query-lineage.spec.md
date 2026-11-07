---
id: "prometeo.unified-query-lineage"
title: "Unified Query and Lineage Layer"
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
migration_status: "NOT_APPLICABLE"
feature_flags: ["SEMSE_UNIFIED_QUERY_MODE"]
production_evidence: []
related_files:
  - "docs/architecture/ADR-044-operational-intelligence-graph.md"
  - "docs/specs/prometeo/operational-intelligence-program.spec.md"
  - "docs/specs/prometeo/unified-graph-contract.spec.md"
  - "docs/specs/prometeo/decision-ledger.spec.md"
  - "docs/specs/prometeo/tool-call-audit-lineage.spec.md"
  - "docs/specs/prometeo/tool-registry-governance.spec.md"
  - "docs/specs/platform/semse-mcp-project-read.spec.md"
  - "docs/specs/platform/semse-mcp-project-read.decisions.md"
  - "apps/api/src/modules/prometeo/prometeo-tool-registry.ts"
  - "apps/api/src/modules/prometeo/tool-governance/tool-governance.policy.ts"
  - "apps/api/src/modules/prometeo/tool-governance/tool-execution-query.service.ts"
  - "packages/auth/src/rbac.ts"
related_tests: []
related_endpoints: []
related_events: []
related_agents: ["prometeo"]
privacyCritical: true
auditLog: "cada consulta y cada denegación deja un registro de acceso sin contenido (D-09); el destino y los nombres de acción se fijan al aprobar el spec (Q-4)"
sse: false
fsmTransicion: "no aplica: solo lectura, sin estados propios"
paymentGovernance: false
last_verified: "2026-11-06"
---

# Spec: Unified Query and Lineage Layer

> **Estado: REVIEW.** No autoriza código. Requisitos para `APPROVED`: ADR-044 aceptado con fecha, acta aprobada, los slices 1 y 2 aprobados y las decisiones de la sección 14 resueltas por el owner.
> Programa: [`prometeo.operational-intelligence-program`](operational-intelligence-program.spec.md). Decisiones aplicadas: D-02, D-04 a D-10, D-12, D-14 a D-16 del [acta](operational-intelligence-program.reconciliation.md).
> **Supuesto de redacción:** este spec asume la recomendación Q-1 del [slice 1](unified-graph-contract.spec.md): en V1 solo existen los proveedores Graphify, decisiones y ejecuciones. Si el owner decide incluir memoria o conversaciones, este spec debe rehacerse en la sección 5.

## 1. Problema y resultado

Hoy Prometeo y los operadores consultan cada fuente por su propia superficie. No hay una consulta única que responda «¿de dónde salió esta decisión y qué produjo?» ni «¿qué depende de este componente?» con procedencia comprobable.

Resultado: una superficie de lectura acotada que usa el contrato del slice 1 para combinar tres proveedores —topología técnica (Graphify), decisiones autorizadas (Decision Ledger) y referencias de ejecución (H05)— y la expone por un endpoint y por una herramienta de solo lectura de Prometeo. **Consultar nunca autoriza nada.**

## 2. Alcance

### Incluido
- Proveedor de **decisiones**, sobre el Decision Ledger (slice 2).
- Proveedor de **ejecuciones**, sobre la auditoría de H05 por `ToolExecutionQueryService` (D-02). Se nombra distinto de `runtime-knowledge`, que ya existe con otro significado (Q-02).
- Endpoint de consulta con los modos `neighbors`, `lineage`, `impact` y `path`.
- Herramienta de Prometeo de solo lectura que llama al **mismo servicio** con el mismo actor.
- Recorrido acotado, semántica de degradación y registro de acceso sin contenido.
- Entrada en `docs/SOURCE_OF_TRUTH.md` para la consulta y el linaje como fachada federada (Q-05).

### Fuera de alcance
- Escrituras, decisiones automáticas y caché persistente de grafo.
- Proveedores de memoria y de conversaciones (supuesto Q-1 del slice 1).
- UI y ruta BFF de la web: este slice solo entrega API y herramienta. La UI, con sus estados y su alternativa textual accesible, sería un slice propio (D-15).
- Renderizado de Omniverse (slice 4).
- **Exposición por MCP** (D-10): la herramienta es solo para Prometeo interno.
- Búsqueda global sin alcance.
- Usar el RAG de Prometeo como proveedor, porque filtra solo por tenant y proyecto y no comprueba propiedad por recurso (Q-33).

## 3. Actores, permisos y límites

| Actor | Permiso backend | Alcance | Puede | No puede |
|---|---|---|---|---|
| Usuario operativo (por API) | permiso de lectura de grafo, nombre a fijar en `packages/auth/src/rbac.ts` (D-04, Q-4) | su tenant y organización | consultar lo visible de sus recursos | ampliar alcance; deducir lo oculto |
| Prometeo (herramienta) | los mismos permisos, evaluados con el actor del usuario que pregunta | el del usuario | consultar como herramienta de solo lectura | exponerse por MCP; actuar con permisos propios |
| `OPS_ADMIN` | lectura | su tenant; cruce entre organizaciones solo por regla explícita (Q-4) | lectura administrativa | cruzar tenants |
| Graphify (nodos de código) | `internal:architecture:read`, **también vía Prometeo** (D-08) | ámbito `internal` | aportar topología | mostrarse a quien no tenga el permiso |

- **Aislamiento:** 404 si el recurso es de otro tenant, 403 si es de otra organización (D-05). Matriz de pruebas 2 tenants × 2 organizaciones.
- **Los controllers no bastan.** La guarda `ResourceScope` no detecta un `sourceId` dentro del cuerpo de un `POST` (Q-18), así que **la autorización se hace en el servicio** contra cada recurso al que apunta la consulta, antes de pedir contenido a ningún proveedor.
- **Nodos y aristas ocultos** se omiten sin placeholder ni conteo (D-06). Si el nodo de inicio no es visible, la respuesta es 404, igual que si no existiera.
- **Denegación ≠ degradación.** Una denegación nunca aparece en `degradedSources` ni en un campo como `missingSources: ["forbidden"]`, que sería un oráculo de existencia (Q-13).
- **Las lecturas nunca autorizan acciones.**
- **Entradas no confiables (Q-17):** `label` y `attributes` provienen de datos de usuarios y pueden contener instrucciones dirigidas a un LLM. La herramienta los entrega dentro de un sobre marcado como **datos no confiables** y nunca como instrucciones; el consumidor no ejecuta su contenido.
- **`privacyCritical`:** el contenido `confidential` o `restricted` no llega a un LLM externo; el enrutamiento al LLM local o el filtrado previo se hace en la herramienta, con el techo de sensibilidad del actor (D-07).

## 4. Escenarios y criterios de aceptación

### P1 — De una decisión a sus fuentes y efectos
```gherkin
Dado una decisión registrada con fuentes y un efecto de ejecución
  Y un actor con permiso de lectura sobre el recurso del sujeto
Cuando consulta el modo lineage con esa decisión como inicio
Entonces recibe la decisión, sus fuentes y sus efectos, cada uno con sourceRefs
  Y el estado de la ejecución sale de H05 en vivo, no de una copia
  Y no existe ninguna arista que un proveedor no haya devuelto
```

### P1 — Impacto técnico combinado
```gherkin
Dado un componente de código presente en el grafo de Graphify
  Y un actor con internal:architecture:read
Cuando consulta el modo impact
Entonces recibe las dependencias técnicas con derived=true para las aristas inferidas
  Y las aristas derivadas nunca se presentan como autoritativas
```

### P1 — Aislamiento
```gherkin
Dado un actor del tenant A
Cuando consulta con inicio en un recurso del tenant B
Entonces recibe 404 sin llamar a ningún proveedor
Y si el recurso es de otra organización del mismo tenant, recibe 403
```

### P1 — Denegación no filtra existencia
```gherkin
Dado un grafo con un nodo intermedio que el actor no puede ver
Cuando consulta el modo lineage
Entonces el nodo y sus aristas se omiten sin placeholder ni conteo
  Y degradedSources no menciona la denegación
```

### P1 — Degradación y fuentes autoritativas
```gherkin
Dado que Graphify (no autoritativo) está caído
Cuando se consulta
Entonces la respuesta conserva el resto y degradedSources indica graphify con su motivo
Y dado que el Decision Ledger (autoritativo) está caído y la consulta empieza en una decisión
Entonces responde 503 source_unavailable en vez de devolver un linaje parcial que parezca completo
```

### P1 — Acotación del lado del servidor
```gherkin
Dado un cliente que envía maxDepth o maxNodes por encima del tope del servidor
Cuando consulta
Entonces el servidor aplica su propio tope, devuelve truncated=true y maxDepthApplied real
```

### P1 — Flag apagado
```gherkin
Dado SEMSE_UNIFIED_QUERY_MODE ausente, desconocido u off
Cuando se llama al endpoint o se lista la herramienta
Entonces el endpoint responde 404 y la herramienta no figura en el registro
```

### P1 — Prometeo no eleva alcance
```gherkin
Dado un usuario sin permiso sobre un proyecto
Cuando pide a Prometeo una consulta de grafo sobre ese proyecto
Entonces recibe el mismo 404 o 403 que por el endpoint
```

## 5. Contratos

Los contratos Zod de entrada y salida van en `packages/schemas/src` y reutilizan los del slice 1 (`GraphQueryResult`, `SourceRef`, catálogo de errores). Forma de referencia, no código final:

```text
POST <prefijo>/graph/query          (prefijo propio, sin rutas @Public; ver Q-1 del slice 1)
  mode: neighbors | lineage | impact | path
  start: { nodeType, sourceId }
  target?: { nodeType, sourceId }      -- solo en path
  relations?: GraphRelation[]
  maxDepth?, maxNodes?, timeBudgetMs?  -- el servidor aplica sus topes aunque el cliente pida más
```

- **Parámetros por modo:** `start` es obligatorio en todos; `target` solo en `path` y se rechaza en los demás; `relations` filtra pero no amplía.
- **Salida:** `GraphQueryResult` del slice 1 más `complete: boolean` (`false` si faltan fuentes autoritativas).
- **Errores:** 400 (entrada inválida), 403 (otra organización), 404 (otro tenant, inexistente o flag apagado), 503 (`source_unavailable`, fuente autoritativa caída), 504 (`timeout`), 429 (cuota por actor).
- **Paginación:** el recorrido está acotado por `maxNodes`; no hay paginación de grafo en V1.
- **Proveedor de decisiones:** lee solo el Decision Ledger. **No incluye `AgentDecision`**, que no tiene `tenantId` y rompería el aislamiento (Q-03).
- **Proveedor de ejecuciones (D-02):** consulta H05 con `ToolExecutionQueryService`, valida `executionId` junto con `tenantId` y no guarda resúmenes, que H05 purga según su retención configurable.
- **Unión decisión → acción:** por `executionId` guardado en `DecisionEffectRef`. No se une por `correlationId`, porque H05 no lo tiene (Q-24).
- **Herramienta de Prometeo:** descriptor de solo lectura en `prometeo-tool-registry.ts`, con sus permisos y `outputKind`. El registro actual es estático y compartido con MCP S1 y **no tiene campo de exposición**: antes de registrar la herramienta hay que añadir un campo que la excluya de MCP (cambio de código, tarea propia; Q-06).
- **Qué runtime de Prometeo la consume:** sin determinar (Q-19); se fija en Q-5.

## 6. Eventos, idempotencia y reconstrucción

Solo lectura. Consultar no emite eventos de negocio. El registro de acceso (D-09) no es un evento de dominio. Mismo grafo y misma consulta producen el mismo resultado.

## 7. Datos y migración

Sin migración Prisma. Sin caché persistente de grafo. Los topes del servidor se aplican con independencia de lo que pida el cliente. Si el registro de acceso (D-09) se persiste en una tabla nueva, eso sería una migración y exige decidirlo antes (Q-4).

## 8. Observabilidad, flag y rollout

- Flag `SEMSE_UNIFIED_QUERY_MODE`: ausente o desconocido = `off` (D-14). Semántica en el [spec padre §17](operational-intelligence-program.spec.md).
- `off`: endpoint 404 y herramienta ausente. `shadow`: se ejecuta la consulta y se registran métricas y conteos, pero el resultado **no se entrega** a ningún usuario. `canary`: solo tenants de una lista. `live`: todos.
- **Este slice cubre el canary autenticado del slice 1** (D-16): un tenant y un actor reales, consultando decisiones y ejecuciones.
- Dimensiones de métricas: modo, proveedor y código de resultado; latencia, truncados y degradados. Nombres, SLO, alertas y responsable: por aprobar (Q-6).
- `correlationId`: lo acepta del cliente o lo genera el endpoint, y lo propaga a los proveedores; el consumidor Prometeo reenvía el suyo.
- Logs sin contenido de fuentes, `label` ni `attributes`; solo identificadores, conteos y códigos.

## 9. Tests requeridos (derivados de la sección 4)

| Criterio | Prueba |
|---|---|
| Decisión → fuentes y efectos | proveedor de decisiones + proveedor de ejecuciones con base de datos; sin aristas inventadas |
| Impacto técnico | Graphify con `derived`; aristas inferidas nunca autoritativas |
| Aislamiento | matriz 2 × 2; 404/403 antes de llamar a proveedores; autorización en el servicio aunque la guarda no vea el cuerpo |
| Ocultos | omisión sin rastro; sin oráculo en `degradedSources` |
| Degradación | no autoritativo caído → parcial marcado; autoritativo caído → 503 |
| Topes | el servidor impone sus topes con entradas mayores; ciclos; tiempo total |
| Flag | `off` → 404 y herramienta no listada; valor desconocido tratado como `off` |
| Prometeo | mismo resultado que el endpoint; no eleva alcance; la tool no figura en MCP |
| Entradas no confiables | un `label` con instrucciones llega marcado como dato |
| Auditoría | acceso y denegación registrados sin contenido; logs sin `label`/`attributes` |
| Integración | contra base de datos real para el Ledger y H05 |

Las pruebas se escriben primero y deben fallar antes del código.

## 10. Mapa de implementación

Rutas definitivas por confirmar al aprobar (sección 15):
- Proveedores de decisiones y de ejecuciones, y el controlador, en el módulo nuevo del slice 1.
- Contratos Zod en `packages/schemas/src/`.
- `apps/api/src/modules/prometeo/prometeo-tool-registry.ts` (descriptor y campo de exposición) y `apps/api/src/modules/prometeo/tool-governance/tool-governance.policy.ts` (política de la herramienta).
- `packages/auth/src/rbac.ts` (permisos).
- `docs/SOURCE_OF_TRUTH.md` y `docs/architecture/SEMSE_API_SURFACE_V1.md`.
- Pruebas bajo `apps/api/test/`.

## 11. Investigación externa

- PostgreSQL recursive queries: https://www.postgresql.org/docs/current/queries-with.html (aplica solo si el recorrido de decisiones se resuelve en SQL; con topes y protección de ciclos).
- W3C Trace Context: https://www.w3.org/TR/trace-context/
- OpenTelemetry context propagation: https://opentelemetry.io/docs/concepts/context-propagation/ (sin secretos ni cuerpos en el contexto propagado).

## 12. Prerrequisitos y dependencias (Q-04)

- Depende del **slice 1** (contrato y registro de proveedores) y del **slice 2** (Decision Ledger): ambos deben estar fusionados y aprobados.
- Depende de H05 solo por lectura (D-02).
- La frontera con MCP S1 (D-10) y la definición de `sourceRef`/`auditRef`/`decisionId` frente a esa especificación quedan por alinear (hallazgo Q-07 del acta; decisión Q-7 de la sección 14).

## 13. Gates de cierre

- [ ] ADR-044 aceptado con fecha y acta aprobada
- [ ] Slices 1 y 2 aprobados y fusionados
- [ ] Spec `APPROVED` (decisiones de la sección 14 resueltas)
- [ ] Inventario de superficies de consulta y entrada en `SOURCE_OF_TRUTH.md`
- [ ] Campo de exposición del registro de herramientas, para excluirla de MCP
- [ ] Pruebas escritas y en rojo antes del código
- [ ] `spec:validate:strict`, índice y cobertura en verde
- [ ] CI PASS, merge SHA, despliegue terminal y activación registrados por separado
- [ ] Canary autenticado con un tenant (cubre también el slice 1)
- [ ] Evidencia sin secretos

## 14. Decisiones abiertas (requieren al owner)

| ID | Decisión | Recomendación del coordinador |
|---|---|---|
| Q-1 | ¿Se divide este slice? (D-16) | Sí: **3a** proveedores y endpoint; **3b** herramienta de Prometeo. La herramienta tiene un riesgo propio (exposición por MCP, entradas no confiables) y puede ir después |
| Q-2 | ¿Qué proveedores son autoritativos y qué pasa si cae uno? | Ledger y ejecuciones autoritativos; Graphify no. Si cae uno autoritativo y la consulta empieza en él, 503; si no, resultado parcial con `complete: false` |
| Q-3 | Nodo de inicio no visible | 404 idéntico al de un nodo inexistente |
| Q-4 | Permisos de lectura y regla de `OPS_ADMIN`; destino y nombres del **registro de acceso** (¿AuditLog existente o tabla nueva? una tabla es migración) | Reutilizar `AuditLog` con acciones nuevas añadidas al catálogo; sin tabla nueva |
| Q-5 | Qué runtime de Prometeo consume la herramienta | Decidir tras inventariar los runtimes; no se asume aquí |
| Q-6 | Topes numéricos (`maxDepth`, `maxNodes`, `timeBudgetMs`, cuota por actor), nombres de métricas, SLO y responsable | Los propone el implementador con datos medidos y los aprueba el owner; no se inventan aquí |
| Q-7 | Alineación de `sourceRef`, `auditRef` y `decisionId` con MCP S1, que aún no acepta sus decisiones D1–D7 | Mantener la herramienta fuera de MCP hasta que S1 las cierre |
| Q-8 | Respuesta con el flag en `off` | 404 en el endpoint y herramienta no listada, para no revelar la capacidad |

### 14.1 Resoluciones del owner (2026-11-06)

El owner respondió «aplica todo» al plan de respuestas del coordinador. Se registran tal como se recomendaron. Esto **no aprueba el spec**: pasa a `APPROVED` cuando el ADR-044 esté aceptado con fecha, el acta aprobada y los slices previos aprobados (sección de gates).

| ID | Resolución |
|---|---|
| Q-1 | **Se divide:** 3a proveedores y endpoint; 3b herramienta de Prometeo |
| Q-2 | Autoritativos: Ledger y ejecuciones. Si cae uno y la consulta empieza en él, 503; si no, resultado parcial con `complete: false` |
| Q-3 | Nodo de inicio no visible = 404 idéntico al de un nodo inexistente |
| Q-4 | Permisos `lineage:graph:read` y `lineage:decisions:read`. El registro de acceso reutiliza `AuditLog` con acciones nuevas catalogadas, sin tabla nueva. `OPS_ADMIN` sin cruce entre organizaciones |
| Q-5 | **Runtime que consume la herramienta (inventario, 2026-11-06):** las herramientas de lectura de Prometeo se ejecutan por `PrometeoToolExecutionService.invokeReadTool`, que busca el descriptor en el registro, evalúa `evaluatePrometeoToolPolicy` con los permisos del descriptor y despacha con un `switch` por `namespace.name` en `executeReadTool`. Entradas conocidas: `POST /v1/prometeo/tools/invoke` (exige `agents:run:create`) y el chat del gateway de modelos en `ai-models.controller.ts`, que ejecuta una herramienta de lectura cuando la petición trae `requestedAction`. El arnés del copiloto de proyecto no usa esta ruta. Consecuencias para 3b: añadir un descriptor y un `case` nuevo, comprobar el permiso propio de la herramienta además de `agents:run:create`, y tratar `requestedAction` como entrada controlada por el usuario |
| Q-6 | Topes, cuota por actor, SLO y métricas: se miden y se proponen; el owner aprueba. **Pendiente de dato** |
| Q-7 | La herramienta queda fuera de MCP hasta que MCP S1 cierre sus decisiones |
| Q-8 | Con el flag en `off`: endpoint 404 y herramienta no listada |

## 15. Archivos y endpoints planificados (aún inexistentes)

Se mantienen fuera del frontmatter porque `spec:validate:strict` exige que `related_files` y `related_endpoints` existan. Pasan al frontmatter cuando el slice los cree.

- proveedores de decisiones y de ejecuciones y controlador, en el módulo nuevo del slice 1 (nombre en Q-1 del slice 1)
- contratos Zod de entrada y salida en `packages/schemas/src/` (archivo tentativo)
- `apps/api/test/` (pruebas de consulta, de la herramienta y de integración, nombres tentativos)
- endpoint: `POST <prefijo>/graph/query` (prefijo propio, sin rutas `@Public`)
