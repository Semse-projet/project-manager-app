---
id: "core.knowledge-contributor-human-review-workspace"
title: "Field Knowledge Contributor Program — Human Review Workspace (PR-7)"
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
  - "apps/api/src/modules/contributor-program/contributor-program.service.ts"
  - "apps/web/app/(app)/admin/contributors/submissions/page.tsx"
related_tests:
  - "apps/api/test/contributor-program.service.test.ts"
related_endpoints:
  - "GET /v1/uploads/files/*"
related_events: []
related_agents: []
last_verified: "2026-09-18"
---

# Spec: Field Knowledge Contributor Program — Human Review Workspace (PR-7)

> Contrato ejecutable SDD 2.0.

**Aprobación:** igual que PR-6, "Human Review Workspace" existía solo como
etiqueta sin spec. Se presentaron cuatro interpretaciones al dueño del
producto; eligió la más concreta y acotada: **agregar un visor de media
inline** a la página de revisión ya existente (`admin/contributors/
submissions`, construida en PR-2/PR-5/PR-6), en vez de un rediseño mayor.

## 0. ZOOM — estado real encontrado antes de escribir este spec

| Capa | Estado | Evidencia |
|---|---|---|
| Página de revisión de entregas | EXISTING | `admin/contributors/submissions` — lista, aprobar/rechazar/pedir cambios, panel de extracciones (PR-5), promoción (PR-6) |
| Lista de assets en el panel de revisión | EXISTING (texto plano) | `· {kind} — {clipRole} ({processingStatus})` — sin ningún elemento `<video>`/`<audio>`/`<img>` |
| **Capacidad de un revisor de ver el contenido real de la evidencia** | **ABSENT** | Confirmado por grep — cero referencias a `storageKey`/`<video`/`<audio` en la página. Un revisor aprueba o rechaza sin haber podido ver ni escuchar el clip |
| Endpoint que sirve el archivo por key | EXISTING | `GET /v1/uploads/files/*` (`uploads.controller.ts`), `@Public()` deliberado — "keys are tenant-scoped UUIDs, hard to enumerate" (comentario ya existente en el código, no una decisión de este spec) |
| `KnowledgeAssetView` (schema/API) | EXISTING pero incompleto | Expone `id/kind/clipRole/mimeType/sizeBytes/processingStatus/createdAt` — nunca expuso una URL reproducible, aunque el modelo `KnowledgeAsset.storageKey` sí existe en la fila |

**Clasificación**: la capacidad "un humano revisa la evidencia" es hoy
**PARTIAL** — el flujo de decisión (aprobar/rechazar/pedir cambios) existe y
funciona, pero sin que el revisor haya podido ver el contenido que está
decidiendo. Este spec cierra exactamente ese hueco, nada más.

## 1. Problema y resultado

**Para quién:** revisor humano (`contributor-program:manage`).

**Problema:** el panel de revisión permite aprobar o rechazar una entrega sin
que el revisor haya visto el video/foto/audio real — solo ve metadatos
(tipo, rol de clip, estado de procesamiento).

**Resultado esperado:** cada asset VIDEO/IMAGE/AUDIO con archivo almacenado
muestra un reproductor/visor inline (`<video>`/`<audio controls>`/`<img>`) en
el mismo panel donde el revisor toma la decisión.

## 2. Alcance

### Incluido

- `previewUrl` en `KnowledgeAssetView`: URL pública y reproducible (reutiliza
  `StorageService.publicUrl`, el mismo mecanismo que ya usa
  `uploads.controller.ts`), `null` cuando el asset no tiene `storageKey`
  (kind `TEXT`) o el kind no es reproducible.
- Reproductor inline en `admin/contributors/submissions` para VIDEO
  (`<video controls>`), AUDIO (`<audio controls>`), IMAGE (`<img>`).
- Estado honesto cuando no hay `previewUrl`: texto explícito, nunca un
  reproductor roto ni un `<img>` con `src` vacío.

### Fuera de alcance

- Cambiar la política de acceso del endpoint `GET /v1/uploads/files/*` — ya
  es `@Public()` por diseño previo a este spec; este spec no la audita ni la
  cambia, solo la reutiliza tal como está.
- Reproductor sincronizado con el transcript (scrubbing por segmento) — una
  mejora real pero de alcance mucho mayor, no necesaria para que un revisor
  pueda simplemente ver el clip.
- Cola de revisión con filtros/SLA/asignación de revisor — otra
  interpretación de "workspace" que el dueño del producto no eligió esta
  vez.
- Contenido TEXT (nota de texto) — ya se muestra como texto plano en
  `submission.notes`, no necesita visor.

## 3. Actores, permisos y límites

Sin cambios de permisos — `previewUrl` viaja dentro de las mismas vistas ya
gateadas por `contributor-program:manage` (admin) y `contributor-program:
participate` (el propio contribuidor viendo su entrega, mismo alcance que ya
tenía `KnowledgeAssetView`). El endpoint que sirve el archivo ya era público
antes de este spec; no se amplía ni se reduce ese acceso.

## 4. Escenarios y criterios de aceptación

### P1 — El revisor ve el video antes de decidir

```gherkin
DADO un asset VIDEO con storageKey válido en una entrega SUBMITTED
CUANDO un OPS_ADMIN abre el panel de revisión
ENTONCES ve un reproductor <video controls> con ese clip, reproducible
  directamente desde el panel
```

### P2 — Asset sin archivo reproducible

```gherkin
DADO un asset TEXT (o un asset legacy sin storageKey)
CUANDO un OPS_ADMIN abre el panel de revisión
ENTONCES no ve un reproductor roto — ve el estado honesto correspondiente
  (el texto de la nota, o "sin vista previa")
```

## 5. Contratos

### API — cambio de forma en `KnowledgeAssetView` (sin nuevo endpoint)

```yaml
auth: required (mismo que ya protegía KnowledgeAssetView)
permissions: [contributor-program:manage, contributor-program:participate]
output_schema: "KnowledgeAssetView += { previewUrl: string | null }"
effects:
  audit_log: no (solo lectura, mismo patrón que el resto de las vistas)
```

### UI

```yaml
surfaces: ["apps/web/app/(app)/admin/contributors/submissions"]
required_behavior:
  - VIDEO -> <video controls>, AUDIO -> <audio controls>, IMAGE -> <img>
  - previewUrl null -> texto honesto, nunca un elemento de media roto
```

## 6. Datos y migración

Ninguna — no hay cambio de schema, `previewUrl` se calcula en el servicio a
partir de un campo (`storageKey`) que ya existe en la fila.

## 7. Tests requeridos

- [ ] `previewUrl` poblado para VIDEO/IMAGE/AUDIO con `storageKey`
- [ ] `previewUrl` `null` para TEXT o sin `storageKey`
- [ ] La URL generada coincide con `StorageService.publicUrl(storageKey)`

## 8. Mapa de implementación

### API

- `apps/api/src/modules/contributor-program/contributor-program.module.ts`
  (importar `StorageModule`)
- `apps/api/src/modules/contributor-program/contributor-program.service.ts`
  (`toAssetView` pasa a método de clase, agrega `previewUrl`)

### Web

- `apps/web/app/(app)/admin/contributors/submissions/page.tsx`
- `apps/web/app/semse-api.ts` (`KnowledgeAssetView` += `previewUrl`)

### DB

- `packages/schemas/src/contributor-program.schema.ts`

## 9. Gates de cierre

- [ ] Spec enlazado por `pnpm spec:index`
- [ ] Tests verdes contra Postgres real
- [ ] `pnpm spec:validate:strict` verde
- [ ] CI `PASS`
- [ ] PR fusionado
