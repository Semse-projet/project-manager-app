---
id: "core.knowledge-contributor-rag-ingestion"
title: "Field Knowledge Contributor Program — Prometeo/RAG Ingestion (PR-9)"
domain: "core"
sdd_version: "2.0"
version: "1.0"
status: "APPROVED"
owner: "semse-core"
risk: "medium"
code_status: "IN_PROGRESS"
ci_status: "NOT_RUN"
merge_status: "UNMERGED"
deploy_status: "NOT_DEPLOYED"
activation_status: "INACTIVE"
migration_status: "NOT_APPLICABLE"
feature_flags: []
production_evidence: []
related_files:
  - "apps/api/src/modules/contributor-program/contributor-program.service.ts"
  - "apps/api/src/modules/contributor-program/contributor-program.repository.ts"
  - "apps/api/src/modules/prometeo/prometeo.service.ts"
related_tests:
  - "apps/api/test/contributor-program-registry.test.ts"
related_endpoints:
  - "POST /v1/contributor-program/admin/observations/:observationId/promote"
  - "POST /v1/contributor-program/admin/observations/:observationId/reject-promotion"
related_events: []
related_agents: []
last_verified: "2026-09-19"
---

# Spec: Field Knowledge Contributor Program — Prometeo/RAG Ingestion (PR-9)

> Contrato ejecutable SDD 2.0.

**Aprobación:** a diferencia de PR-6/PR-7/PR-8, "Prometeo/RAG ingestion of
approved field knowledge" ya tenía un objetivo técnico concreto identificado
en la sesión de PR-8 (`PrometeoService.ingestText`, ya exportado y en
producción para otros dominios). La decisión real pendiente era de ciclo de
vida: una Observation promovida puede volver a REJECTED (PR-6, transición
libre sin guarda de conflicto) — ¿debe eso des-indexar el contenido? Se
presentaron cuatro opciones concretas al dueño del producto; eligió el
**ciclo de vida completo**: indexar al promover, des-indexar al rechazar una
promoción previa.

## 0. ZOOM — estado real encontrado antes de escribir este spec

| Capa | Estado | Evidencia |
|---|---|---|
| `PrometeoService.ingestText` (chunk → embed → `DocumentChunk`) | EXISTING, en producción para otros dominios | exportado por `PrometeoModule`; usado hoy por `admin/prometeo` (ingesta manual de texto/archivos) |
| `PrometeoService.deleteDocument({tenantId, id})` | EXISTING | ya usado por la UI admin de Prometeo para borrar documentos |
| Cualquier llamada desde `contributor-program` a `PrometeoService` | ABSENT | `ContributorProgramModule` nunca importó `PrometeoModule` — confirmado por grep antes de esta sesión |
| Campo en `Observation` que enlace con el `PrometeoDocument` que produjo | ABSENT | necesita migración — sin este campo, no hay forma de saber qué documento des-indexar al rechazar, ni de evitar duplicados al re-promover |
| Texto de `Observation` disponible para indexar | EXISTING y ya correcto | `objective/condition/decision/reason/method/action/result` en la fila ya reflejan el texto corregido si existe (bug de PR-5 corregido: `correctObservation` escribe directamente en esas columnas, no solo en `correctedFieldsJson`) |

## 1. Problema y resultado

**Para quién:** el sistema Prometeo/RAG (y, transitivamente, cualquier
consulta que dependa de él) — el conocimiento de campo aprobado por un
revisor humano debe ser realmente citable, no solo estar marcado como
`PROMOTED` en una tabla que nadie más consulta.

**Problema:** promover una Observation (PR-6) y poder verla en el registro
(PR-8) no la hace *buscable* — la Observation nunca llega a
`PrometeoDocument`/`DocumentChunk`, el almacén real que Prometeo consulta.

**Resultado esperado:** promover una Observation la indexa automáticamente
en Prometeo (chunk + embedding, mismo pipeline que cualquier otro
documento); rechazar una promoción previa retira ese contenido del índice.

## 2. Alcance

### Incluido

- `Observation.ragDocumentId String?` — enlaza con el `PrometeoDocument`
  producido, `null` mientras no está indexada.
- Al promover (`PROMOTED`): compone un texto etiquetado a partir de los
  campos de la Observation (`Objetivo/Condición/Decisión/Razón/Método/
  Acción/Resultado`, omitiendo los vacíos) y llama
  `PrometeoService.ingestText` con `sourceType: "field_observation"`,
  `sourceRef: observation.id`. Guarda el `id` del documento resultante en
  `ragDocumentId`.
- Al rechazar una promoción previa (`PROMOTED → REJECTED` con
  `ragDocumentId` no nulo): llama `PrometeoService.deleteDocument` y limpia
  `ragDocumentId` a `null`.
- Re-promover después de un rechazo (`REJECTED → PROMOTED`) vuelve a
  indexar (nuevo documento, nuevo `ragDocumentId`) — no intenta reutilizar
  un documento borrado.
- `ragDocumentId` expuesto en `ObservationView` (solo lectura, visibilidad
  admin) para que un revisor pueda confirmar que una Observation promovida
  realmente está indexada.

### Fuera de alcance

- Búsqueda semántica/consulta del contenido indexado desde este módulo —
  eso ya lo cubre el propio `PrometeoService`/UI de Prometeo, no se
  duplica aquí.
- Reintentos/reconciliación si `ingestText`/`deleteDocument` fallan a
  mitad de camino — igual que el resto de este módulo (ver `correctObservation`,
  `setObservationPromotion` en PR-6), la llamada no está envuelta en una
  transacción distribuida; un fallo de Prometeo dejará `ragDocumentId`
  como estaba antes de la llamada fallida (ver §4 casos borde).
- Cambiar el pipeline de chunking/embedding en sí — se reutiliza tal cual.

## 3. Actores, permisos y límites

Sin cambios de permisos — la indexación/des-indexación ocurre dentro de
`promoteObservation`/`rejectObservationPromotion`, ya gateados por
`contributor-program:manage`. Nunca se expone un endpoint nuevo.

## 4. Escenarios y criterios de aceptación

### P1 — Promover indexa

```gherkin
DADO una Observation PENDING con texto real
CUANDO un OPS_ADMIN la promueve
ENTONCES se crea un PrometeoDocument con ese texto (chunked + embedded) y
  observation.ragDocumentId queda apuntando a ese documento
```

### P2 — Rechazar una promoción des-indexa

```gherkin
DADO una Observation PROMOTED con ragDocumentId no nulo
CUANDO un OPS_ADMIN la rechaza
ENTONCES el PrometeoDocument correspondiente se borra y
  observation.ragDocumentId vuelve a null
```

### P3 — Re-promover after reject crea un documento nuevo

```gherkin
DADO una Observation que fue PROMOTED, luego REJECTED (ragDocumentId=null)
CUANDO un OPS_ADMIN la vuelve a promover
ENTONCES se crea un nuevo PrometeoDocument y ragDocumentId apunta a ese
  documento nuevo, no al ya borrado
```

### Caso borde — fallo del lado de Prometeo

```gherkin
DADO que PrometeoService.ingestText lanza una excepción
CUANDO un OPS_ADMIN intenta promover una Observation
ENTONCES la promoción completa falla (no queda en un estado a medias:
  ni promotionStatus ni ragDocumentId cambian) y el error se propaga al
  llamador
```

## 5. Contratos

### API — sin endpoint nuevo, cambio de efecto en los existentes

```yaml
endpoints:
  - "POST admin/observations/:id/promote"
  - "POST admin/observations/:id/reject-promotion"
auth: required (sin cambios — contributor-program:manage)
effects:
  audit_log: sí (ya existente — contributor_program.observation.promoted /
    ...promotion_rejected; no se agrega un evento nuevo)
  side_effect: "ingestText (promote) / deleteDocument (reject con
    ragDocumentId previo) contra PrometeoService, mismo tenant"
output_schema: "ObservationView += { ragDocumentId: string | null }"
```

## 6. Datos y migración

`packages/db/prisma/schema.prisma` — `Observation.ragDocumentId String?`
(nullable, sin default). Migración generada con `prisma migrate dev
--create-only` y aplicada contra Postgres local, siguiendo el mismo
procedimiento que PR-6.

## 7. Tests requeridos

- [ ] Promover crea un `PrometeoDocument` real y guarda su id en
      `ragDocumentId`
- [ ] Rechazar una promoción con `ragDocumentId` previo borra el documento
      y limpia el campo
- [ ] Rechazar una Observation que nunca fue indexada (`ragDocumentId`
      null) no intenta borrar nada
- [ ] Re-promover tras un rechazo crea un documento nuevo, distinto del
      borrado
- [ ] Todo el flujo respeta el aislamiento por tenant ya existente

## 8. Mapa de implementación

### API

- `packages/db/prisma/schema.prisma` (`Observation.ragDocumentId`)
- `apps/api/src/modules/contributor-program/contributor-program.module.ts`
  (importar `PrometeoModule`)
- `apps/api/src/modules/contributor-program/contributor-program.repository.ts`
  (`setObservationPromotion` acepta `ragDocumentId`)
- `apps/api/src/modules/contributor-program/contributor-program.service.ts`
  (`setObservationPromotion` privado llama `ingestText`/`deleteDocument`)

### Web

- `apps/web/app/semse-api.ts` (`ObservationView += ragDocumentId`)
- `apps/web/app/(app)/admin/contributors/submissions/page.tsx` (indicador
  de indexado en el badge de promoción, solo lectura)

### DB

- `packages/schemas/src/contributor-program.schema.ts`
  (`observationViewSchema += ragDocumentId`)

## 9. Gates de cierre

- [ ] Spec enlazado por `pnpm spec:index`
- [ ] Tests verdes contra Postgres real
- [ ] `pnpm spec:validate:strict` verde
- [ ] CI `PASS`
- [ ] PR fusionado
