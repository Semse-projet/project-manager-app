---
id: "vision.sense-vision-field-library"
title: "Sense Vision — Live Camera + Construction Library + Mi Diccionario (MVP)"
domain: "vision"
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
migration_status: "PENDING"
feature_flags:
  - "VISION_OBJECT_PROVIDER"
production_evidence: []
related_files:
  - "packages/db/prisma/schema.prisma"
  - "packages/db/prisma/migrations/20260924120000_sense_vision_construction_library/migration.sql"
  - "packages/schemas/src/vision-library.schema.ts"
  - "packages/schemas/src/construction-library.seed.ts"
  - "apps/api/src/modules/vision/vision-library.controller.ts"
  - "apps/api/src/modules/vision/vision-library.service.ts"
  - "apps/api/src/modules/vision/vision-library.repository.ts"
  - "apps/api/src/modules/vision/vision-library.logic.ts"
  - "apps/api/src/modules/vision/vision-frame.ts"
  - "apps/vision-service/app/routes/objects.py"
  - "apps/vision-service/app/services/object_recognizer.py"
  - "apps/web/app/(app)/worker/sense-vision/page.tsx"
  - "apps/web/app/(app)/worker/dictionary/page.tsx"
related_tests:
  - "apps/api/test/vision-frame.test.ts"
  - "apps/api/test/vision-library-logic.test.ts"
  - "apps/api/test/vision-library-integration.test.ts"
  - "tests/unit/construction-library-seed.test.ts"
  - "tests/unit/sense-vision-client.test.ts"
  - "apps/vision-service/tests/test_object_recognizer.py"
related_endpoints:
  - "POST /v1/vision/recognize"
  - "GET /v1/vision/library/search"
  - "GET /v1/vision/library/:idOrSlug"
  - "GET /v1/vision/dictionary"
  - "POST /v1/vision/dictionary/:libraryItemId"
  - "PATCH /v1/vision/dictionary/:libraryItemId"
  - "DELETE /v1/vision/dictionary/:libraryItemId"
  - "POST /v1/vision/corrections"
related_events:
  - "vision.dictionary_saved"
  - "vision.dictionary_removed"
  - "vision.recognition_corrected"
related_agents: []
last_verified: "2026-09-24"
---

# Spec: Sense Vision — Live Camera + Construction Library + Mi Diccionario (MVP)

> Contrato ejecutable SDD 2.0.

**Aprobación:** requisito de producto entregado por el dueño del producto
como documento de handoff ("SEMSE PROJECT — HANDOFF COMPLETO: Sense Vision +
Construction Library + Mi Diccionario", Google Doc
`1plRtr0BPNYIQ6a2n8_Twwok-LJSpQpvU-PIt8GgXxdY`), pegado explícitamente en la
sesión como instrucción de trabajo. Este spec traduce ese handoff a las
convenciones reales del repo; donde el handoff dice "adaptar a convenciones
reales", las adaptaciones están listadas en §5.1. No se infirió ninguna
activación en producción: el reconocimiento queda detrás de
`VISION_OBJECT_PROVIDER` (sin valor → deshabilitado).

## 0. ZOOM — estado real encontrado antes de escribir este spec

| Capa | Estado | Evidencia |
|---|---|---|
| "Sense Vision" como nombre en código | NO EXISTE | `grep -ri "sense.vision"` sin resultados en `apps/`, `packages/`, `docs/`. Lo que existe es el módulo `vision` genérico. |
| `apps/api/src/modules/vision` | LIVE, 18 endpoints | `POST /v1/vision/{analyze,detect-material,classify-space,...}` — todos toman `imageUrl` (o `evidenceId`); ninguno acepta bytes de imagen. Permisos `vision:read`/`vision:run` ya asignados a CLIENT, CONTRACTOR, WORKER y ADMIN en `packages/auth/src/rbac.ts`. |
| `apps/vision-service` (Python/FastAPI) | LIVE, OpenCV heurístico | `material_detector.py` clasifica 6 materiales genéricos por HSV/bordes (drywall, wood, brick, tile, concrete, metal). **No hay ningún modelo capaz de reconocer objetos concretos** (EMT coupling, fish tape…). `ollama_enricher.py` solo manda JSON de texto a Ollama. |
| Auth API → vision-service | LIVE | Header `X-Vision-Api-Key` (`VISION_SERVICE_API_KEY`), fail-closed en producción (`main.py`). |
| Carga de imágenes en vision-service | solo URL | `image_loader.load_image_from_url` con allowlist de hosts + bloqueo de IPs privadas (anti-SSRF). |
| Servicio `ollama` en Railway | LIVE, solo texto | Documentado en `knowledge-contributor-asr-openai-whisper.spec.md` §0: `qwen2.5:3b` + `glm4`, **sin modelo de visión**. |
| Body limit de Fastify en `semse-API` | default 1 MiB | `main.ts` crea `FastifyAdapter({ logger: false })` sin `bodyLimit`. Un frame en base64 debe caber ahí. |
| Rate limiting | LIVE | `ThrottlerGuard` global + `@Throttle` por ruta (`auth.controller.ts`). |
| Telemetría de producto | LIVE | `POST /v1/product-intelligence/ingest` con allowlist de nombres/props en `packages/schemas/src/product-events.schema.ts`; nombres `namespace.action` (un solo punto). |
| Modelos de librería/diccionario | NO EXISTEN | Ningún `model` Prisma de catálogo de objetos, glosario o diccionario de usuario. |

Conclusión: la cámara, la librería, el diccionario y las correcciones son
trabajo nuevo; el reconocimiento de objetos concretos **requiere un modelo
multimodal que hoy no está desplegado**. El MVP entrega el código completo
con un proveedor enchufable y deja la activación como paso operativo
explícito (§8).

## 1. Problema y resultado

**Problema:** un profesional en obra ve una herramienta/material/accesorio
cuyo nombre no conoce (sobre todo en inglés) y no tiene cómo averiguarlo sin
interrumpir a alguien.

**Resultado:** abre Sense Vision en el teléfono, apunta la cámara, y ve el
nombre en inglés y español, la confianza, puede escuchar la pronunciación,
lee para qué sirve y una frase real de obra, y guarda la palabra en Mi
Diccionario. Si la cámara no está disponible o el reconocimiento está
apagado, la misma librería se puede buscar manualmente.

## 2. Alcance

### Incluido

1. **Frames temporales**: `POST /v1/vision/recognize` acepta
   `{ imageUrl }` **o** `{ imageData, mimeType }` (base64). El frame nunca se
   persiste.
2. **Reconocimiento de objetos** en `apps/vision-service`:
   `POST /v1/objects/recognize`, proveedor enchufable (`ollama` con modelo de
   visión, u `openai`), vocabulario cerrado provisto por la API.
3. **Construction Library**: modelo `ConstructionLibraryItem` global
   (catálogo de plataforma), con alias EN/ES, categorías, oficios múltiples,
   descripción, uso y frase de obra bilingüe. Seed inicial ≥ 100 objetos
   priorizando electricidad, herramientas generales, plumbing y HVAC.
4. **Búsqueda manual** por inglés, español y alias (insensible a mayúsculas
   y acentos).
5. **Mi Diccionario**: `UserDictionaryItem` (relación a la librería, sin
   duplicar contenido), guardar/quitar/favorito/aprendida/notas/listar.
6. **Correcciones**: `VisionCorrection` ("No es esto / Not this?"), solo
   registro — nunca modifica la librería ni el modelo automáticamente.
7. **UI mobile-first** en `apps/web`: `/worker/sense-vision` (cámara +
   tarjeta de resultado + búsqueda) y `/worker/dictionary`.
8. **Pronunciación** con `SpeechSynthesisUtterance` (`en-US`/`es-ES`).
9. **Métricas**: eventos de producto (UI) y de auditoría (cambios de dominio).
10. **Repaso ligero** en Mi Diccionario: contador semanal + una pregunta de
    opción múltiple ("What is this called in English?").

### Fuera de alcance

AR 3D, tracking espacial, detección simultánea de múltiples objetos, modelo
offline, inventario/estimación/compra automática, grabación permanente,
entrenamiento propio, gamificación extensa, "Agregar a Evidence" (queda
como acción futura), cliente mobile nativo (`apps/mobile`), y el despliegue
de un modelo de visión en el servicio `ollama` de Railway.

## 3. Actores, permisos y límites

| Actor | Acción | Permiso |
|---|---|---|
| Profesional (WORKER, CONTRACTOR), CLIENT, ADMIN | reconocer frame | `vision:run` (existente) |
| mismos | buscar/abrir librería, leer su diccionario | `vision:read` (existente) |
| mismos | guardar/editar/quitar en **su** diccionario, registrar corrección | `vision:run` (existente) |

- No se agregan permisos nuevos a `rbac.ts`.
- El diccionario y las correcciones siempre se resuelven por el `userId` +
  `tenantId` del contexto autenticado; nunca por un id enviado en el body.
- La librería es global (sin `tenantId`): es conocimiento de plataforma, no
  dato de cliente. Solo se edita por migración/seed en este MVP.
- El navegador nunca ve `VISION_SERVICE_API_KEY`, `OPENAI_API_KEY`, etc.:
  Web → BFF → API → vision-service.

## 4. Escenarios y criterios de aceptación

- **P1 — reconocimiento con confianza alta (≥ 0.80):** respuesta
  `status: "recognized"` con el objeto canónico enriquecido desde la librería.
- **P2 — confianza media (0.50–0.79):** `status: "uncertain"`, objeto
  principal + 2–3 alternativas si existen.
- **P3 — confianza baja (< 0.50) o candidato fuera de la librería:**
  `status: "unknown"`; nunca se inventa un objeto.
- **P4 — proveedor no configurado:** `status: "unavailable"`,
  `reason: "provider_disabled"`; la UI ofrece búsqueda manual. No es un 500.
- **P5 — frame inválido:** 400 si está vacío, base64 inválido, MIME fuera de
  `image/jpeg|png|webp`, bytes que no coinciden con el MIME declarado, o
  tamaño decodificado > `VISION_FRAME_MAX_BYTES` (default 700 000). 400 si
  llegan `imageUrl` e `imageData` a la vez o ninguno.
- **P6 — sin autenticación / sin permiso:** 401/403 por los guards
  existentes.
- **P7 — rate limit:** más de 60 reconocimientos/min desde el mismo origen → 429.
- **P8 — vision-service caído o timeout (`VISION_RECOGNIZE_TIMEOUT_MS`,
  default 12 000):** `status: "error"` con mensaje genérico (sin detalles
  internos); la cámara sigue abierta y reintenta en el siguiente ciclo.
- **P9 — respuesta malformada del proveedor:** se trata como `unknown`,
  nunca como éxito.
- **P10 — búsqueda:** "fish tape", "cinta pasacables", "channel locks",
  "pinza de canal" devuelven el ítem canónico correspondiente.
- **P11 — guardar dos veces la misma palabra:** no duplica (upsert por
  `@@unique([userId, libraryItemId])`), incrementa `timesScanned` si viene
  de un escaneo.
- **P12 — quitar del diccionario:** borra solo la fila del usuario; el ítem
  de librería sigue existiendo.
- **P13 — cámara denegada / no disponible / offline:** la UI muestra el
  estado correspondiente y la búsqueda manual sigue disponible (salvo
  offline, donde se informa).
- **P14 — muestreo:** como máximo una petición en vuelo; ~1 frame cada
  1.5 s; el frame siguiente se descarta si el anterior no terminó.
- **P15 — estabilidad:** la etiqueta mostrada solo cambia cuando el mismo
  objeto aparece en 2 de las últimas 3 lecturas (o una sola lectura
  ≥ 0.90).

## 5. Contratos

### 5.1 Adaptaciones respecto al handoff

| Handoff | Implementación | Motivo |
|---|---|---|
| `GET /v1/professionals/me/dictionary` (+ POST/DELETE) | `GET/POST/PATCH/DELETE /v1/vision/dictionary[/:libraryItemId]` | No existe un controller `v1/professionals`; el diccionario es propiedad del módulo `vision` y reutiliza sus permisos. "me" queda implícito en el contexto autenticado. |
| `GET /v1/vision/library/:id` | `GET /v1/vision/library/:idOrSlug` | El slug es estable y legible; ambos se aceptan. |
| Eventos `vision.scan.started` etc. | Producto: `vision.scan_started`… / Auditoría: `vision.dictionary_saved`… | `productEventNameSchema` exige `namespace.action` con un solo punto; `EVENT_CATALOG.md` exige `aggregate.action`. |
| `canonicalName` en la respuesta | `slug` + `canonicalName` | `slug` es el identificador estable; `canonicalName` es el nombre canónico en inglés. |

### 5.2 Reconocimiento

```ts
type VisionRecognizeInput =
  | { imageUrl: string }
  | { imageData: string; mimeType: "image/jpeg" | "image/png" | "image/webp" };

type VisionRecognizeResult = {
  status: "recognized" | "uncertain" | "unknown" | "unavailable" | "error";
  reason?: string;              // provider_disabled | low_confidence | not_in_library | provider_error | malformed_result
  object: LibraryItemView & { confidence: number } | null;
  alternatives: Array<LibraryItemView & { confidence: number }>;
  source: string;               // "ollama:qwen2.5vl:3b" | "openai:gpt-4o-mini" | "none"
  latencyMs: number;
  thresholds: { recognized: number; uncertain: number };
};
```

API → vision-service (`POST /v1/objects/recognize`, header
`X-Vision-Api-Key`):

```json
{ "imageUrl": "...", "imageData": "...", "mimeType": "image/jpeg",
  "vocabulary": [{ "slug": "emt-coupling", "name": "EMT coupling" }] }
```

Respuesta: `{ "provider": "ollama", "model": "...", "candidates":
[{ "slug": "emt-coupling" | null, "label": "EMT coupling", "confidence": 0.91 }] }`,
o `503 { "detail": "provider_disabled" }` si no hay proveedor.

### 5.3 Librería y diccionario

`LibraryItemView`: `id, slug, canonicalName, nameEn, nameEs, aliasesEn[],
aliasesEs[], category, subcategory, trades[], descriptionEn, descriptionEs,
usageEn, usageEs, exampleSentenceEn, exampleSentenceEs`.

- `GET /v1/vision/library/search?q=&category=&trade=&limit=` → `{ items, total }`
  (`limit` ≤ 50, default 20; `q` vacío lista por nombre).
- `GET /v1/vision/library/:idOrSlug` → `LibraryItemView` o 404.
- `GET /v1/vision/dictionary?q=&favorite=&learned=&limit=` → entradas con
  `item` embebido, ordenadas por `lastSeenAt desc`, más
  `stats: { total, learned, favorites, addedThisWeek }`.
- `POST /v1/vision/dictionary/:libraryItemId` body `{ source?: "scan"|"search"|"manual" }`
  → upsert.
- `PATCH /v1/vision/dictionary/:libraryItemId` body
  `{ favorite?, learned?, notes? (≤ 500), viewed? }`.
- `DELETE /v1/vision/dictionary/:libraryItemId` → `{ removed: boolean }`.
- `POST /v1/vision/corrections` body `{ predictedLibraryItemId?,
  selectedLibraryItemId?, predictedConfidence?, source }` (al menos uno de
  los dos ids; `selectedLibraryItemId` nulo = "no está en la lista").

Todos los bodies se validan con Zod en `packages/schemas/src/vision-library.schema.ts`.

## 6. FSM, eventos y reconstrucción

Sin FSM nueva. Eventos:

- **Auditoría (dominio, `AuditService`)**: `vision.dictionary_saved`,
  `vision.dictionary_removed`, `vision.recognition_corrected` — agregados a
  `docs/foundation/EVENT_CATALOG.md`. Payload: ids de librería, source,
  confianza; nunca imágenes.
- **Producto (UI, `product-intelligence/ingest`)**: `vision.scan_started`,
  `vision.scan_completed`, `vision.scan_failed`,
  `vision.recognition_unknown`, `vision.recognition_low_confidence`,
  `vision.pronunciation_played` — props allowlisted: `latencyMs`,
  `confidence`, `source`, `status`, `lang`. Sin contenido de imagen.

## 7. Datos y migración

Modelos nuevos (`packages/db/prisma/schema.prisma`):

- `ConstructionLibraryItem` (`slug @unique`, arrays de alias/trades/search
  terms, `searchText` desnormalizado en minúsculas y sin acentos para
  búsqueda `contains`, `active`).
- `UserDictionaryItem` (`@@unique([userId, libraryItemId])`, FK a `User`
  `onDelete: Cascade` y a `ConstructionLibraryItem` `onDelete: Cascade`,
  `tenantId`).
- `VisionCorrection` (FK a `User`, FKs opcionales a la librería con
  `onDelete: SetNull`, `tenantId`).

Migración versionada `20260924120000_sense_vision_construction_library`:
DDL + seed de la librería con `INSERT ... ON CONFLICT ("slug") DO NOTHING`
(idempotente, mismo precedente que
`20260914120000_capability_reality_registry`). El seed se genera desde la
fuente canónica `packages/schemas/src/construction-library.seed.ts` con
`packages/db/scripts/generate-construction-library-sql.mjs`; un test verifica
que la migración contiene exactamente los slugs de la fuente.
Rollback: `DROP TABLE` de las 3 tablas (sin datos de otras tablas afectados).

## 8. Observabilidad, despliegue y activación

- **Activación del reconocimiento** (no hecha por este PR):
  - `VISION_OBJECT_PROVIDER=ollama` + `VISION_OBJECT_MODEL` (default
    `qwen2.5vl:3b`) requiere que el servicio `ollama` tenga ese modelo
    (`ollama pull qwen2.5vl:3b`) y memoria suficiente. Opción preferida por
    privacidad (frames no salen de la infraestructura).
  - `VISION_OBJECT_PROVIDER=openai` + `OPENAI_API_KEY` (en `semse-vision`,
    no en el navegador) + `VISION_OBJECT_MODEL` (default `gpt-4o-mini`).
    Envía frames a un tercero: requiere revisión legal/DPIA antes de
    activarse (frames de obra pueden incluir rostros/interiores).
- Sin proveedor, todo lo demás (librería, búsqueda, diccionario) funciona.
- Logs: la API registra `status`, `source`, `latencyMs`, `confidence` por
  reconocimiento; nunca el frame.
- La migración se aplica con el flujo de deploy existente
  (`prisma migrate deploy`).

## 9. Tests requeridos

- [x] `vision-frame.test.ts` — validación de input (vacío, ambos, ninguno,
      base64 inválido, MIME no permitido, magic bytes que no coinciden,
      tamaño excedido, URL no-http).
- [x] `vision-library-logic.test.ts` — normalización, ranking de búsqueda
      (EN/ES/alias), matching de candidatos, política de confianza,
      resultado malformado, alternativas.
- [x] `construction-library-seed.test.ts` — ≥ 100 ítems, slugs únicos,
      campos bilingües completos, categorías válidas, alias clave presentes
      y migración sincronizada con la fuente.
- [x] `sense-vision-client.test.ts` — muestreo single-flight, estabilizador,
      compatibilidad de voz.
- [x] `test_object_recognizer.py` — proveedor deshabilitado, parseo de
      salida del modelo (JSON válido, JSON con ruido, basura), decodificación
      de base64 con límites.
- [x] `vision-library-integration.test.ts` — persistencia real (Postgres) de
      librería/diccionario/correcciones y `recognize` con cliente simulado.
- [ ] Integración real con proveedor de visión — requiere modelo desplegado;
      pendiente para la activación (§8).

## 10. Mapa de implementación

- **DB**: `schema.prisma`, migración, generador SQL.
- **Schemas**: `vision-library.schema.ts`, `construction-library.seed.ts`.
- **API** (`apps/api/src/modules/vision/`): `vision-frame.ts`,
  `vision-library.logic.ts`, `vision-library.repository.ts`,
  `vision-library.service.ts`, `vision-library.controller.ts`, cliente
  `recognizeObjects` en `vision-service.client.ts`, registro en
  `vision.module.ts`.
- **vision-service**: `services/object_recognizer.py`, `routes/objects.py`,
  `image_loader.load_image_from_base64`, registro en `main.py`.
- **Web**: BFF `app/api/semse/vision/{recognize,library,dictionary,corrections}`,
  `lib/sense-vision/*`, páginas `/worker/sense-vision`, `/worker/dictionary`,
  navegación y eventos de producto.
