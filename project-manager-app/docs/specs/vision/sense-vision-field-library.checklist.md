---
type: checklist
feature: "sense-vision-field-library"
spec: "docs/specs/vision/sense-vision-field-library.spec.md"
version: "2.0"
date: "2026-09-24"
---

# Checklist: Sense Vision

## Requisitos

- [x] Escenarios P1–P15 verificables y cubiertos por tests o smoke.
- [x] Fuera de alcance explícito (AR, multi-objeto, offline, Evidence automático).
- [x] Contratos no rompen consumidores existentes: rutas nuevas; `detect-material` e `imageUrl` siguen funcionando (smoke).

## Seguridad

- [x] Permisos validados en backend (`vision:read`/`vision:run`, sin permisos nuevos).
- [x] Diccionario/correcciones siempre por `userId`+`tenantId` del contexto; test de otro tenant → 404/lista vacía.
- [x] Validación de frame: MIME allowlist, magic bytes, base64, tamaño, vacío, fuente ambigua.
- [x] Rate limit 60/min en recognize (verificado: 429).
- [x] Secretos solo server-side (`VISION_SERVICE_API_KEY`, `OPENAI_API_KEY` en semse-vision); el navegador solo habla con el BFF.
- [x] Cámara habilitada solo en una ruta, same-origin.
- [ ] DPIA / revisión legal antes de activar `VISION_OBJECT_PROVIDER=openai`.

## Datos y eventos

- [x] Migración versionada, idempotente, validada en Postgres real, sin drift.
- [x] Eventos de auditoría registrados en `EVENT_CATALOG.md`; telemetría en `PRODUCT_EVENT_ALLOWLIST`.
- [x] Frames nunca persistidos ni logueados; imagen re-codificada sin EXIF antes del modelo.

## Entrega

- [x] Typecheck API/Web, lint, tests unitarios e integración.
- [ ] CI verde en el PR.
- [ ] Merge / deploy / activación — separados y pendientes (spec §8).
