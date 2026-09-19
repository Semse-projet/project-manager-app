---
id: "core.knowledge-contributor-registry"
title: "Field Knowledge Contributor Program — Knowledge Registry (PR-8)"
domain: "core"
sdd_version: "2.0"
version: "1.0"
status: "APPROVED"
owner: "semse-core"
risk: "low"
code_status: "IN_PROGRESS"
ci_status: "NOT_RUN"
merge_status: "UNMERGED"
deploy_status: "NOT_DEPLOYED"
activation_status: "INACTIVE"
migration_status: "NOT_APPLICABLE"
feature_flags: []
production_evidence: []
related_files:
  - "apps/api/src/modules/contributor-program/contributor-program.repository.ts"
  - "apps/api/src/modules/contributor-program/contributor-program.service.ts"
  - "apps/web/app/(app)/admin/contributors/registry/page.tsx"
related_tests:
  - "apps/api/test/contributor-program.service.test.ts"
related_endpoints:
  - "GET /v1/contributor-program/admin/observations/registry"
related_events: []
related_agents: []
last_verified: "2026-09-18"
---

# Spec: Field Knowledge Contributor Program — Knowledge Registry (PR-8)

> Contrato ejecutable SDD 2.0.

**Aprobación:** igual que PR-6/PR-7, "Knowledge Registry" existía solo como
etiqueta de dos palabras sin spec ni diseño. Se presentaron cuatro
interpretaciones al dueño del producto; eligió construir el registro tal
como lo describe el plan original — una capa de consulta/búsqueda sobre
Observations PROMOTED, mantenida separada de la ingesta a RAG (esa es
PR-9, "Prometeo/RAG ingestion of approved field knowledge" en el plan
original, un ítem distinto de "Knowledge Registry").

## 0. ZOOM — estado real encontrado antes de escribir este spec

| Capa | Estado | Evidencia |
|---|---|---|
| `Observation.promotionStatus` (PR-6) | EXISTING | `PENDING`/`PROMOTED`/`REJECTED`, poblado por `promoteObservation`/`rejectObservationPromotion` |
| Cualquier forma de listar/buscar Observations PROMOTED | ABSENT | grep confirma cero endpoints, cero queries de repositorio, cero UI que filtre por `promotionStatus: PROMOTED` fuera del panel de revisión de una entrega individual |
| Pipeline real de ingesta a RAG (`PrometeoService.ingestText` → chunk → embed → `DocumentChunk`) | EXISTING, no conectado a este dominio | exportado por `PrometeoModule`, usado hoy solo por `ingestFile`/`ingestText` del propio módulo Prometeo; nunca invocado desde `contributor-program`. Confirma que el plan original separaba correctamente "Knowledge Registry" (PR-8, este spec) de "Prometeo/RAG ingestion" (PR-9, fuera de alcance aquí) |
| **Filas reales de Observation PROMOTED en producción** | **AUSENTE** | mismo hallazgo que las sesiones de PR-6 y PR-7: no existe ningún generador de Observation en producción (solo ASR/transcript de PR-5, sin paso LLM que produzca Observations reales). El registro que este PR construye queda funcionalmente vacío hasta que ese paso exista — se documenta explícitamente, no se oculta |

**Clasificación**: la capacidad "consultar/buscar conocimiento de campo ya
aprobado" es hoy **ABSENT** por partida doble — no solo falta la capa de
consulta (lo que cierra este PR), sino que tampoco hay datos reales que
consultar (blocker estructural ya documentado en PR-6/PR-7, sin cambios
aquí).

## 1. Problema y resultado

**Para quién:** revisor/operador con `contributor-program:manage` que
necesita encontrar conocimiento de campo ya promovido — por trade,
categoría, misión o texto libre — sin tener que abrir entrega por entrega.

**Problema:** hoy la única forma de ver una Observation PROMOTED es abrir
la entrega específica que la contiene en el panel de revisión (PR-7). No
existe ninguna vista que agregue el conocimiento aprobado across
entregas/misiones.

**Resultado esperado:** un endpoint y una página admin que lista, filtra
(trade, categoría, misión, texto libre sobre los campos de la Observation)
y pagina las Observations con `promotionStatus: PROMOTED` de todo el
tenant, con contexto de misión (título/trade/categoría) para cada fila.

## 2. Alcance

### Incluido

- `GET /v1/contributor-program/admin/observations/registry` — lista
  paginada de Observations PROMOTED del tenant, con filtros opcionales
  `trade`, `category`, `missionId`, `search` (texto libre, `ILIKE` sobre
  `objective`/`condition`/`decision`/`reason`/`method`/`action`/`result`),
  y paginación `page`/`pageSize`.
- Cada fila incluye el contexto de misión (`missionId`, `missionTitle`,
  `trade`, `category`) además de los campos ya expuestos por
  `toObservationView`.
- Página admin `admin/contributors/registry` con filtros, tabla paginada,
  y **estado vacío honesto** ("aún no hay conocimiento promovido") en vez
  de una tabla vacía sin explicación — dado el hallazgo del §0, este
  estado es el esperado hoy en cualquier tenant real.

### Fuera de alcance

- Ingesta a RAG / embeddings (`PrometeoService.ingestText`) — ese es el
  PR-9 del plan original ("Prometeo/RAG ingestion of approved field
  knowledge"), un ítem distinto de "Knowledge Registry" en la
  descomposición original; no se mezclan en este PR.
- Búsqueda semántica/vectorial — el filtro `search` de este PR es texto
  exacto/`ILIKE` sobre columnas SQL, no similarity search.
- Acceso no-admin (p. ej. que un trabajador cualquiera navegue el
  registro) — decisión de producto real que ampliaría la superficie de
  permisos; este PR reutiliza `contributor-program:manage` como el resto
  de las vistas admin del módulo, sin inventar un nuevo permiso.
- Resolver el blocker estructural de generación de Observations — ya
  documentado en los reportes de PR-6/PR-7; sigue abierto, sin cambios
  aquí.

## 3. Actores, permisos y límites

`contributor-program:manage` (OPS_ADMIN), mismo patrón que
`admin/submissions`, `admin/appeals`, `admin/observations/:id/promote`.
Scoping por `tenantId` idéntico al resto del repositorio — nunca cruza
tenants.

## 4. Escenarios y criterios de aceptación

### P1 — Listar conocimiento promovido con filtros

```gherkin
DADO tres Observations PROMOTED de misiones con trades distintos
CUANDO un OPS_ADMIN llama GET .../registry?trade=electrician
ENTONCES recibe solo las Observations cuya misión tiene trade=electrician,
  cada una con su contexto de misión (título, trade, categoría)
```

### P2 — Estado vacío honesto

```gherkin
DADO un tenant sin ninguna Observation PROMOTED (el estado real hoy)
CUANDO un OPS_ADMIN abre `admin/contributors/registry`
ENTONCES ve un mensaje explícito de "aún no hay conocimiento promovido",
  nunca una tabla vacía sin contexto ni un spinner infinito
```

### P3 — Aislamiento por tenant

```gherkin
DADO Observations PROMOTED en dos tenants distintos
CUANDO un OPS_ADMIN del tenant A llama GET .../registry
ENTONCES solo ve las filas de su propio tenant
```

### P4 — Solo admin

```gherkin
DADO un usuario sin rol OPS_ADMIN
CUANDO llama GET .../registry
ENTONCES recibe 403 CONTRIBUTOR_PROGRAM_ADMIN_REQUIRED
```

## 5. Contratos

### API

```yaml
endpoint: "GET /v1/contributor-program/admin/observations/registry"
auth: required
permissions: [contributor-program:manage]
query_params:
  trade: string?
  category: string?
  missionId: string?
  search: string?
  page: number? (default 1)
  pageSize: number? (default 20, max 100)
output_schema: "{ items: KnowledgeRegistryEntryView[], page: number, pageSize: number, total: number, hasMore: boolean }"
effects:
  audit_log: no (solo lectura)
```

### UI

```yaml
surfaces: ["apps/web/app/(app)/admin/contributors/registry"]
required_behavior:
  - filtros trade/category/missionId/search + paginación
  - estado vacío explícito cuando total=0, nunca tabla vacía sin mensaje
```

## 6. Datos y migración

Ninguna — reutiliza el modelo `Observation` (PR-5/PR-6) y `KnowledgeMission`
(PR-2) tal como existen, sin nuevo modelo ni migración.

## 7. Tests requeridos

- [ ] Filtra correctamente por trade/category/missionId/search
- [ ] Solo devuelve `promotionStatus: PROMOTED` (nunca PENDING/REJECTED)
- [ ] Pagina correctamente (`page`/`pageSize`/`total`/`hasMore`)
- [ ] Aísla por tenant
- [ ] Requiere `contributor-program:manage` (403 sin el permiso)
- [ ] Cada fila incluye el contexto de misión correcto

## 8. Mapa de implementación

### API

- `apps/api/src/modules/contributor-program/contributor-program.repository.ts`
  (`listPromotedObservations`)
- `apps/api/src/modules/contributor-program/contributor-program.service.ts`
  (`getKnowledgeRegistry`, `toRegistryEntryView`)
- `apps/api/src/modules/contributor-program/contributor-program.controller.ts`
  (`GET admin/observations/registry`)

### Web

- `apps/web/app/api/semse/contributors/admin/observations/registry/route.ts`
- `apps/web/app/semse-api.ts` (`listAdminContributorKnowledgeRegistry`,
  `KnowledgeRegistryEntryView`)
- `apps/web/app/(app)/admin/contributors/registry/page.tsx` (nueva)

### DB

- `packages/schemas/src/contributor-program.schema.ts`
  (`knowledgeRegistryEntryViewSchema`, `listKnowledgeRegistryQuerySchema`)

## 9. Gates de cierre

- [ ] Spec enlazado por `pnpm spec:index`
- [ ] Tests verdes contra Postgres real
- [ ] `pnpm spec:validate:strict` verde
- [ ] CI `PASS`
- [ ] PR fusionado
