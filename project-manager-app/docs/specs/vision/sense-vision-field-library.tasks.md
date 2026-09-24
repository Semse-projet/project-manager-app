---
type: tasks
feature: "sense-vision-field-library"
domain: "vision"
plan: "docs/specs/vision/sense-vision-field-library.plan.md"
version: "2.0"
status: "IN_PROGRESS"
branch: "claude/google-docs-link-f39dr2"
date: "2026-09-24"
---

# Tareas: Sense Vision

> `[ ]` pendiente · `[x]` completo · `[~]` bloqueado.

## Fase 0 — Verdad del repo

- [x] [T-001] git status/branch/log, `pnpm install --frozen-lockfile`, `pnpm db:generate`.
- [x] [T-002] Mapa AS-IS de Vision (API, vision-service, BFF, RBAC, Evidence) — spec §0.

## Fase 1 — Contratos y datos

- [x] [T-010] `vision-library.schema.ts` (Zod) + seed canónico de 112 ítems.
- [x] [T-011] Modelos `ConstructionLibraryItem`, `UserDictionaryItem`, `VisionCorrection` + relaciones con `User`.
- [x] [T-012] Migración `20260924120000_sense_vision_construction_library` (DDL + seed idempotente), aplicada en Postgres real, sin drift.

## Fase 2 — Backend

- [x] [T-020] Frames temporales `imageData`/`mimeType` manteniendo `imageUrl` (`vision-frame.ts`).
- [x] [T-021] vision-service `POST /v1/objects/recognize` (ollama/openai, opt-in).
- [x] [T-022] API: recognize, library search/detail, dictionary CRUD, corrections; throttle; auditoría.
- [x] [T-023] Library matching + política de confianza (`vision-library.logic.ts`).

## Fase 3 — Web

- [x] [T-030] BFF `/api/semse/vision/{recognize,library,dictionary,corrections}`.
- [x] [T-031] `/worker/sense-vision`: cámara, muestreo single-flight, estabilizador, tarjeta EN/ES, pronunciación, guardar, "Not this?", búsqueda manual, estados.
- [x] [T-032] `/worker/dictionary`: lista, filtros, favorito/aprendida, quitar, contador semanal, repaso.
- [x] [T-033] Navegación, i18n, registro de navegación, eventos de producto.
- [x] [T-034] `Permissions-Policy` con cámara habilitada solo en `/worker/sense-vision`.

## Fase 4 — QA

- [x] [T-040] Tests: API (frame, lógica, integración con DB), root (seed, cliente), Python (reconocedor).
- [x] [T-041] Smoke E2E local: API + vision-service + proveedor simulado + Chromium con cámara falsa (móvil 390×844).
- [~] [T-042] Reconocimiento con un modelo de visión real — bloqueado hasta desplegar/activar un proveedor (spec §8).
- [ ] [T-043] Activación en Railway (decisión humana; ver spec §8).
