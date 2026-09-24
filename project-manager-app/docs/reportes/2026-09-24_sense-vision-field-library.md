# Reporte — Sense Vision: Live Camera + Construction Library + Mi Diccionario (MVP)

- **Fecha:** 2026-09-24
- **Rama:** `claude/google-docs-link-f39dr2` (desde `origin/main@c6a367d`)
- **Spec:** `docs/specs/vision/sense-vision-field-library.spec.md` (+ plan, tasks, checklist)
- **Origen:** handoff del dueño del producto (Google Doc "SEMSE PROJECT — HANDOFF COMPLETO").

## Hallazgos AS-IS que cambiaron el plan

1. "Sense Vision" no existía como código; el vision-service es OpenCV heurístico (6 materiales genéricos) y **no puede** reconocer objetos concretos → se añadió un reconocedor multimodal enchufable, apagado por defecto.
2. El servicio `ollama` de Railway solo tiene modelos de texto → activar requiere desplegar un modelo de visión (o usar OpenAI con DPIA).
3. `next.config.ts` enviaba `Permissions-Policy: camera=()` a todo el sitio → `getUserMedia` era imposible. Se habilitó `camera=(self)` **solo** en `/worker/sense-vision`, con una recarga única si se llega por navegación cliente (la política es por documento).
4. Una regla global en `globals.css` colapsa grids inline de 3 columnas en móvil → las stats del diccionario usan flex.

## Entregado

| Capa | Cambio |
|---|---|
| Prisma | `ConstructionLibraryItem`, `UserDictionaryItem` (`@@unique([userId, libraryItemId])`), `VisionCorrection`; relaciones con `User` |
| Migración | `20260924120000_sense_vision_construction_library` — DDL + seed de **112** ítems, `ON CONFLICT ("slug") DO NOTHING` |
| Schemas | `vision-library.schema.ts`, `construction-library.seed.ts`, eventos de producto `vision.*` |
| API | `POST /v1/vision/recognize`, `GET /v1/vision/library/search`, `GET /v1/vision/library/:idOrSlug`, `GET/POST/PATCH/DELETE /v1/vision/dictionary[/:libraryItemId]`, `POST /v1/vision/corrections` |
| vision-service | `POST /v1/objects/recognize` (proveedor `ollama`/`openai`), carga de frames base64 |
| Web | BFF `/api/semse/vision/*`, `/worker/sense-vision`, `/worker/dictionary`, navegación + i18n |

## Verificación

- `prisma validate`; cadena completa de migraciones aplicada en Postgres 16 local; `migrate diff --exit-code` = 0; seed re-ejecutado = idempotente.
- Tests nuevos: API 23 unit + 7 integración (DB real); raíz 15; Python 21. Suites completas: raíz 1154 (0 fallos), API unit 2340 (0 fallos).
- `tsc` API y Web sin errores; `pnpm lint` sin errores; `pnpm build:web` OK; `pnpm spec:validate:strict` 0 errores.
- Smoke E2E local: API + vision-service + proveedor simulado + Chromium móvil con cámara falsa: reconocimiento → tarjeta EN/ES 91% → guardar → búsqueda "pinza de canal" → diccionario → favorito; llegada por navegación cliente; cámara denegada; proveedor apagado → `unavailable`; rate limit → 429; `detect-material` legado intacto.
- Preexistente, no tocado: 5 fallos en `apps/vision-service/tests/test_analyzers.py` (también en `main`, no corre en CI); 403 en `/v1/notifications` para WORKER.

## Pendiente / deployment

1. Merge aplica la migración (crea tablas + 112 ítems). Sin proveedor, librería/búsqueda/diccionario funcionan y la cámara muestra "Reconocimiento automático no activado".
2. Activar reconocimiento en `semse-vision`: `VISION_OBJECT_PROVIDER=ollama` (+ `ollama pull qwen2.5vl:3b` en el servicio ollama, validar RAM) **o** `openai` (+ `OPENAI_API_KEY` en semse-vision, requiere DPIA).
3. Opcionales: `VISION_OBJECT_MODEL`, `VISION_OBJECT_TIMEOUT_MS`, `VISION_RECOGNIZE_TIMEOUT_MS`, `VISION_FRAME_MAX_BYTES`, `VISION_CONFIDENCE_RECOGNIZED/UNCERTAIN`.
4. Medir precisión real con `VisionCorrection` antes de ampliar la librería.
