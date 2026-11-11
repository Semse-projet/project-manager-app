---
id: "prometeo.unified-graph-contract"
title: "Unified Operational Graph Contract"
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
feature_flags: ["SEMSE_OPERATIONAL_GRAPH_MODE"]
production_evidence: []
related_files:
  - "docs/architecture/ADR-044-operational-intelligence-graph.md"
  - "docs/specs/prometeo/operational-intelligence-program.spec.md"
  - "apps/api/src/modules/graphify/graphify.service.ts"
  - "packages/schemas/src/conversation-intelligence.schema.ts"
  - "packages/auth/src/rbac.ts"
related_tests: []
related_endpoints: []
related_events: []
related_agents: ["prometeo"]
privacyCritical: true
auditLog: "este slice no expone endpoints; el registro de acceso sin contenido (D-09) se define en el slice 3, que es el primer consumidor"
sse: false
fsmTransicion: "no aplica: solo lectura, sin estados propios"
paymentGovernance: false
last_verified: "2026-11-06"
---

# Spec: Unified Operational Graph Contract

> **Estado: REVIEW.** No autoriza código. Requisitos previos para pasar a `APPROVED`: ADR-044 aceptado con fecha, acta aprobada y las decisiones abiertas de la sección 13 resueltas por el owner.
> Programa: [`prometeo.operational-intelligence-program`](operational-intelligence-program.spec.md). Decisiones aplicadas: D-03 a D-09, D-12, D-14 a D-16 del [acta](operational-intelligence-program.reconciliation.md).

## 1. Problema y resultado

Prometeo consulta hoy cada fuente por separado (Graphify para topología de código, memoria, conversaciones) y no hay un contrato común para devolver nodos y aristas con su procedencia, su alcance y su sensibilidad.

Resultado: un contrato de **lectura** tipado, un registro de proveedores y un servicio que combina las respuestas de los proveedores sin copiar su autoridad ni persistir nada. Este slice es una **librería**: no tiene endpoint ni consumidor propio (D-16). Su primer consumidor es el slice 3.

## 2. Alcance

### Incluido
- Esquemas Zod del contrato en `packages/schemas/src` (D-03, G-03): `UnifiedGraphNode`, `UnifiedGraphEdge`, `GraphQuery`, `AuthorizedGraphQuery`, `ProviderGraphResult`, `GraphQueryResult`, `SourceRef` y el catálogo de errores.
- Interfaz `OperationalGraphProvider`, registro de proveedores y servicio de combinación, en un módulo nuevo y propio (D-03), sin rutas `@Public`.
- Proveedor Graphify, que lee `graph.json` directamente (resultado de la [prueba técnica](operational-intelligence-program.graphify-probe.md)).
- Topes de profundidad, nodos y tiempo; protección contra ciclos; deduplicación determinista.
- Guía para quien implemente un proveedor nuevo.

### Fuera de alcance
- Endpoint HTTP, herramienta de Prometeo y UI (slices 3 y 4).
- Decision Ledger (slice 2) y su proveedor.
- Persistencia genérica de grafo, base de datos de grafos, escrituras de negocio.
- Copiar Graphify o la memoria a PostgreSQL.
- Exponer el contrato por MCP (D-10).
- Proveedores de memoria y de conversaciones: ver decisión abierta Q-1 en la sección 13.

## 3. Actores, permisos y límites

| Actor | Permiso backend | Alcance | Puede | No puede |
|---|---|---|---|---|
| Servicio interno del slice 3 (Prometeo) | permiso de lectura de grafo por capacidad, nombre a fijar en `packages/auth/src/rbac.ts` (D-04) | tenant y organización del actor | pedir un grafo y recibir solo lo visible | ampliar alcance; deducir lo oculto |
| Proveedor Graphify | `internal:architecture:read`, exigido también vía Prometeo (D-08) | nodos de código, ámbito `internal` | devolver topología de código | devolver nodos a quien no tenga ese permiso |

- **Tenant y organización:** 404 si el recurso es de otro tenant, 403 si es de otra organización (D-05). Los nodos de Graphify no tienen tenant (hallazgo 3 de la prueba): se tratan como de ámbito `internal` global y solo los ven actores con el permiso de arquitectura.
- **La autorización vive en el proveedor y en el servicio, no solo en los controllers** (G-07): el servicio recibe un `AuthorizedGraphQuery` ya evaluado y cada proveedor vuelve a comprobar el alcance de su propia fuente.
- **Autorización parcial:** si el actor ve algunos proveedores y otros no, la respuesta incluye solo lo visible. Los nodos y aristas ocultos se omiten sin placeholder ni conteo (D-06).
- **Una lectura nunca autoriza acciones.**
- **Datos `privacyCritical`:** el contenido `confidential` o `restricted` no llega a un LLM externo; esa decisión de enrutamiento la toma el consumidor (slice 3), pero el contrato marca la sensibilidad de cada nodo.
- **Auditoría:** este slice no audita lecturas (no tiene punto de entrada); entrega el `correlationId` y el actor al consumidor para que lo haga (D-09).

## 4. Escenarios y criterios de aceptación

Cada criterio se traza a una prueba en la sección 9.

### P1 — Combinar proveedores sin fabricar aristas
```gherkin
Dado un actor con permiso de lectura de grafo en su tenant y organización
  Y un proveedor Graphify con un grafo válido
Cuando el servicio recibe una consulta con maxDepth y maxNodes válidos
Entonces devuelve nodos y aristas solo de proveedores que el actor puede ver
  Y cada arista conserva source, target, relation, origen y sourceRefs
  Y no existe ninguna arista que el proveedor no haya devuelto
```

### P1 — Aislamiento
```gherkin
Dado un actor del tenant A
Cuando la consulta apunta a un recurso del tenant B
Entonces falla cerrada con 404 antes de pedir contenido a ningún proveedor
Y si el recurso es de otra organización del mismo tenant, falla con 403
```

### P1 — Degradación distinta de denegación
```gherkin
Dado un proveedor no autoritativo caído y otro sano
Cuando se consulta
Entonces la respuesta conserva lo del proveedor sano
  Y degradedSources lista el proveedor caído con su motivo
  Y una denegación por permisos nunca aparece en degradedSources
```

### P1 — Acotación
```gherkin
Dado un grafo con ciclos o con más nodos que maxNodes
Cuando se consulta
Entonces el recorrido termina, truncated es true y maxDepthApplied refleja la profundidad real
```

### P2 — Esquema desconocido
Si `graph.json` no cumple el esquema Zod, el proveedor Graphify queda degradado con motivo `schema_mismatch`; no lanza excepción ni devuelve datos parciales sin marcar.

## 5. Contratos

Se definen en `packages/schemas/src` con Zod (`.strict()`), según `SOURCE_OF_TRUTH.md`. Forma de referencia, no código final:

```ts
type SourceRef =
  | ConversationSourceRef            // ya existe: conversationSourceRefSchema (kind: "communication")
  | { kind: "code"; file: string; line: number | null }       // Graphify
  | { kind: "record"; model: string; id: string };            // referencia a una fila de dominio

type UnifiedGraphNode = {
  key: string; nodeType: string; sourceId: string;
  tenantId: string | null; orgId: string | null; projectId: string | null;
  label: string;                                   // ya redactado
  authority: "domain" | "decision-ledger" | "memory" | "conversation" | "graphify" | "runtime";
  sensitivity: "public" | "internal" | "restricted" | "confidential";
  sourceRefs: SourceRef[];
  attributes: Record<string, string | number | boolean | null>;   // solo claves de la allowlist del proveedor
};

type UnifiedGraphEdge = {
  key: string; relation: GraphRelation; from: string; to: string;
  tenantId: string | null; orgId: string | null;
  authority: UnifiedGraphNode["authority"];        // quién respalda la arista
  derived: boolean;                                // true si el proveedor la infirió (Graphify INFERRED)
  confidence: number | null; validFrom: string | null; validTo: string | null;
  sourceRefs: SourceRef[];
};

type GraphQuery = { seeds: string[]; relations?: GraphRelation[]; maxDepth: number; maxNodes: number; timeBudgetMs: number };
type AuthorizedGraphQuery = GraphQuery & { actor: ActorContext; tenantId: string; orgId: string | null; sensitivityCeiling: UnifiedGraphNode["sensitivity"]; correlationId: string };
type ProviderGraphResult = { nodes: UnifiedGraphNode[]; edges: UnifiedGraphEdge[]; truncated: boolean; error?: ProviderError };
type GraphQueryResult = {
  nodes: UnifiedGraphNode[]; edges: UnifiedGraphEdge[];
  degradedSources: { provider: string; reason: ProviderErrorCode }[];
  truncated: boolean; maxDepthApplied: number; correlationId: string;
};
```

Decisiones de contrato:
- **Orden de sensibilidad** único: `public < internal < restricted < confidential` (el que ya usan `WorkspaceMemorySensitivity` y `AgentMemorySensitivity`). Las categorías de `AiPrivacyLevel` pertenecen a otro dominio y no se mezclan (G-11).
- **`SourceRef`** es una unión discriminada. La variante `communication` **es** `conversationSourceRefSchema` sin cambios, para no crear un tercer vocabulario (D-12). La arista Graphify `source_file`/`source_location` se mapea a `kind: "code"`.
- **Relaciones de Graphify** (`calls`, `imports`, `imports_from`, `references`, `method`, `contains`) se mapean a `GraphRelation`; las que no tengan equivalente se descartan y se cuentan como métrica, nunca se inventan como `related_to`. `confidence: INFERRED` → `derived: true`.
- **Identidad y deduplicación:** `key = authority:sourceId` para nodos y `from|relation|to|authority` para aristas. Ante duplicados gana la arista con `derived: false`; el empate se resuelve por orden alfabético de `key`, para que el resultado sea determinista.
- **`ProviderErrorCode`** (catálogo cerrado): `unavailable`, `timeout`, `schema_mismatch`, `invalid_input`. **`denied` no existe como código de degradación** (G-09).
- **`null` histórico:** un valor desconocido queda `null`, no se infiere.
- **Redacción:** `label` y los atributos permitidos pasan por `redactValue`/`redactPublicText` antes de salir del proveedor (D-07). Los datos personales de conversaciones (teléfono, nombre, cuerpo) no se incluyen en `label` ni en `attributes`.

## 6. Eventos, idempotencia y reconstrucción

Solo lectura y reconstruible: el mismo grafo y la misma consulta producen el mismo resultado, sin eventos de dominio y sin escritura.

## 7. Datos y migración

Sin migración Prisma. Sin tablas genéricas de nodos o aristas en V1. Sin `db push`.

## 8. Observabilidad, flag y rollout

- Flag: `SEMSE_OPERATIONAL_GRAPH_MODE`. Un valor ausente o desconocido se trata como `off` (D-14). Semántica de `off/shadow/canary/live` en el [spec padre §17](operational-intelligence-program.spec.md).
- Como librería sin consumidor, el flag lo evalúa el consumidor (slice 3). El **canary autenticado de este slice se difiere al slice 3** (D-16).
- Métricas por proveedor: latencia, éxito/fallo por `ProviderErrorCode`, nodos/aristas descartados por relación sin mapear, truncados. Nombres, SLO, alertas y responsable: **por definir en el spec aprobado** (ver Q-3).
- **Nombres candidatos de métricas** (versión 2 del paquete, adoptados como candidatos por el owner el 2026-11-07, B01-1): latencia por proveedor; fallos por proveedor; número de nodos y aristas; consultas truncadas; alcance denegado. Son nombres, no valores; los valores y los SLO siguen pendientes de medición.
- Logs: sin cuerpos de fuentes ni atributos; solo `correlationId`, proveedor, conteos y códigos.
- `correlationId`: lo genera el consumidor (slice 3) si el cliente no lo envía y se propaga tal cual; este slice nunca lo inventa.

## 9. Tests requeridos (derivados de la sección 4)

| Criterio | Prueba |
|---|---|
| P1 combinar | normalización de Graphify → contrato; deduplicación determinista; no se fabrican aristas |
| P1 aislamiento | matriz de 2 tenants × 2 organizaciones; denegación antes de llamar a ningún proveedor |
| P1 degradación | proveedor caído; denegación ≠ degradación |
| P1 acotación | ciclos; `maxDepth`, `maxNodes` y `timeBudgetMs` |
| P2 esquema | `graph.json` inválido → `schema_mismatch` |
| Seguridad | techo de sensibilidad; allowlist de atributos; redacción de `label`; permiso `internal:architecture:read` vía Prometeo |
| Compatibilidad | `SourceRef` de comunicación idéntico a `conversationSourceRefSchema` |

Las pruebas se escriben primero y deben fallar antes del código.

## 10. Mapa de implementación

Rutas definitivas **por confirmar** al aprobar el spec (ver la sección 14):
- Contratos Zod en `packages/schemas/src/` (archivo nuevo).
- Módulo nuevo y propio bajo `apps/api/src/modules/` (nombre a decidir en Q-2; no `intelligence` ni `operational-intelligence`).
- Proveedor Graphify que lee `GRAPHIFY_GRAPH_PATH` y valida con Zod.
- Pruebas bajo `apps/api/test/`.

## 11. Investigación externa

- PostgreSQL recursive queries: https://www.postgresql.org/docs/current/queries-with.html (aplica a slices posteriores, no a este).
- W3C Trace Context: https://www.w3.org/TR/trace-context/
- OpenTelemetry context propagation: https://opentelemetry.io/docs/concepts/context-propagation/
- Prueba técnica de Graphify: [resultado](operational-intelligence-program.graphify-probe.md), documento que llega con #1105 (pendiente de merge; el enlace no resuelve en `main` hasta entonces).

## 12. Gates de cierre

- [ ] ADR-044 aceptado con fecha y acta aprobada
- [ ] Spec `APPROVED` antes del código (decisiones de la sección 13 resueltas)
- [ ] Pruebas escritas y en rojo antes del código
- [ ] `spec:validate:strict`, índice y cobertura en verde
- [ ] CI PASS, merge SHA registrado
- [ ] Sin despliegue terminal ni canary propios: el canary lo cubre el slice 3 (D-16)
- [ ] Evidencia sin secretos

## 13. Decisiones abiertas (requieren al owner)

| ID | Decisión | Recomendación del coordinador |
|---|---|---|
| Q-1 | ¿Entran los proveedores de **memoria** y de **conversaciones** en este slice? | No. Dejar este slice con el contrato, el registro y el proveedor Graphify. Conversaciones depende de la Ola 3 de `conversation-intelligence` (G-13), y memoria no tiene definidos sus stores ni el `tenantId` de `FactLink` (G-14). Cada uno sería un spec hijo propio. Esto cambia el alcance del paquete original |
| Q-2 | Nombre y ubicación del módulo nuevo | Un nombre que no choque con `modules/intelligence` ni con `operational-intelligence` (G-16) |
| Q-3 | Valores numéricos: `maxDepth`, `maxNodes`, `timeBudgetMs`, cuota por actor, SLO y umbrales de alerta; nombres de métricas y responsable | Los propone el implementador con datos medidos y los aprueba el owner. No se inventan aquí. Pendiente además medir el tamaño real del grafo de producción (ver la prueba de Graphify) |
| Q-4 | Nombres de los permisos nuevos de solo lectura (D-04) y la regla exacta para `OPS_ADMIN` entre organizaciones | Un permiso por capacidad, definido en `rbac.ts`; sin cruce entre organizaciones salvo regla explícita |
| Q-5 | ¿Se fija la versión de `graphifyy` en `Dockerfile.api`? | Sí, en un PR de infraestructura aparte y con tu autorización (`AGENTS.md`: no tocar CI/despliegue sin permiso) |

### 14.1 Resoluciones del owner (2026-11-06)

El owner respondió «aplica todo» al plan de respuestas del coordinador. Se registran tal como se recomendaron. Esto **no aprueba el spec**: pasa a `APPROVED` cuando el ADR-044 esté aceptado con fecha, el acta aprobada y los slices previos aprobados (sección de gates).

| ID | Resolución |
|---|---|
| Q-1 | **Solo Graphify** en este slice. Los proveedores de memoria y de conversaciones serán specs hijos propios, aún no creados |
| Q-2 | Módulo `operational-lineage`. Comprobado el 2026-11-06: en `main` no existe un módulo, un permiso ni un prefijo de ruta con ese nombre |
| Q-3 | Sin valores numéricos hoy. El implementador mide el grafo de producción y propone; el owner aprueba. **Pendiente de dato** |
| Q-4 | Permisos `lineage:graph:read` y `lineage:snapshot:read`, con el formato `namespace:recurso:acción` de `packages/auth/src/rbac.ts`. El prefijo `lineage:` no existe todavía |
| Q-5 | Se fija la versión de `graphifyy` en `Dockerfile.api` mediante un PR de infraestructura aparte. **Aún no creado:** falta confirmar la versión que corre en producción; fijar una distinta de la actual cambiaría el comportamiento del grafo en producción |

## 14. Archivos y endpoints planificados (aún inexistentes)

Se mantienen fuera del frontmatter porque `spec:validate:strict` exige que `related_files` existan. Se mueven al frontmatter cuando el slice los cree.

- `packages/schemas/src/operational-graph.schema.ts` (nombre tentativo)
- módulo nuevo bajo `apps/api/src/modules/` (nombre en Q-2)
- `apps/api/test/operational-graph.contract.test.ts` (nombre tentativo)

Sin endpoints en este slice.
