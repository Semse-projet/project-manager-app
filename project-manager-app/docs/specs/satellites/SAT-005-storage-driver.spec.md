---
id: "satellites.storage-driver"
title: "SAT-005 — semse-storage como StorageDriver alternativo de /uploads"
type: spec
domain: "evidence"
version: "1.0"
status: "DRAFT"
owner: "semse-core"
risk: "medium"
date: "2026-07-05"
author: "Claude — sesión planificación satélites"
spec_index: "docs/SPEC_INDEX.md"
related_files:
  - apps/api/src/modules/uploads
related_tests: []
related_endpoints:
  - v1/uploads
related_events: []
related_agents: []
last_verified: ""
---

# Spec: semse-storage como StorageDriver (satélite `~/semse-storage`)

## Problem Statement

`/uploads` (evidencias, fotos de vision pipeline) depende de un único backend de
almacenamiento. semse-storage ya existe como storage multipart local pero está
desconectado. Se necesita: (a) desarrollo offline sin depender de storage cloud,
(b) respaldo local de evidencias, (c) libertad futura de proveedor.

## Scope

- In scope: interfaz `StorageDriver` en el módulo uploads, driver `semse-storage`, selección por env var, comando de respaldo/espejo.
- Out of scope: migración de datos históricos, replicación bidireccional automática, cifrado adicional (hereda el existente).

## 1. Arquitectura

```
apps/api uploads module
  └── StorageDriver (interfaz)
        ├── CurrentDriver (backend actual, default)
        └── SemseStorageDriver (nuevo)
              └─► semse-storage (multipart, local o volumen Railway)
```

```ts
interface StorageDriver {
  put(key: string, stream: Readable, meta: UploadMeta): Promise<StoredObject>
  get(key: string): Promise<Readable>
  delete(key: string): Promise<void>
  health(): Promise<{ ok: boolean; freeBytes?: number }>
}
```

- Selección: `STORAGE_DRIVER=current | semse-storage | mirror` (mirror = escribe en ambos, lee del primario).
- **Restricciones de seguridad heredadas:** el driver respeta el fix SSRF multi-nivel (PR #112-#115) y `@Public` en `GET /uploads/files` no cambia de semántica.

## 2. Lado satélite

- semse-storage se ejecuta como proceso/volumen accesible por la API (`SEMSE_STORAGE_URL` o path montado). No requiere token satélite si corre como volumen local; si corre como servicio HTTP interno, usa token con scope `uploads:driver` (SAT-001).
- Unificar las dos copias (`~/semse-storage` y `~/labsemse/semse-storage`) en una sola con layout documentado.

## 3. Casos de uso

1. **Dev offline:** `STORAGE_DRIVER=semse-storage` ⇒ todo el vision pipeline E2E corre sin cloud.
2. **Respaldo:** modo `mirror` en prod para evidencias críticas (disputas: riesgo critical según SPEC_INDEX).
3. **Salida de proveedor:** cambiar driver = cambiar env var.

## 4. Tasks

1. Extraer interfaz `StorageDriver` del módulo uploads (refactor sin cambio de comportamiento, con tests de caracterización antes).
2. Implementar `SemseStorageDriver` multipart.
3. Modo `mirror` + comando `pnpm storage:verify` (compara hashes primario vs espejo).
4. Documentar layout y operación del satélite en su propio README.

## 5. Acceptance Criteria (arnés SAT-000)

- [ ] Anillo 1: suite de contrato del driver corre contra ambos backends con los mismos tests (put/get/delete/health, archivo grande multipart, key traversal rechazado).
- [ ] Anillo 2: N/A (satélite pasivo, sin SDK).
- [ ] Anillo 3: vision pipeline E2E completo con `STORAGE_DRIVER=semse-storage` local.
- [ ] Anillo 4: `mirror` en Railway durante 48h sin divergencia de hashes; evidencia en `docs/reportes/`.
- [ ] Rollback verificado: volver a `STORAGE_DRIVER=current` no pierde ningún objeto subido en modo mirror.
