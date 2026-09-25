# 2026-09-25 — Agro T-053: subida binaria de evidencia

Spec: `docs/specs/agro/agro-evidence-upload.spec.md`. Continúa T-050 … T-058b.

## Qué había

`AgroEvidenceItem.fileUrl` siempre fue un string libre, sin comprobar que apuntara a un archivo real. Las 4 pantallas de Agro que registran evidencia (Centro de evidencia, reportar incidencia, detalle de incidencia, verificación de capacidad de trabajador) mostraban `<input type="url">` esperando que alguien pegara un enlace a mano. Mismo patrón que el hallazgo `2.45` del resto del repo (skill `semse-upload-flow`).

## Qué cambió

- **`agro-evidence-upload.ts`** (nuevo, un helper reusado por las 4 pantallas): sube el archivo con el contrato de 3 pasos ya existente en el repo (`presignEvidence` → `PUT` al proxy BFF) y devuelve la URL real servible.
- **No hizo falta ningún permiso ni endpoint nuevo.** El pipeline compartido (`v1/evidence/presign`, `v1/uploads/files/:key`) exige `evidence:write`, permiso que CLIENT, PRO, WORKER y OPS_ADMIN ya tenían. El paso de "registrar" en Agro (crear evidencia, reportar incidencia, evidencia de capacidad) ya existía y sigue aceptando `fileUrl` igual que antes.
- **Las 4 pantallas**: el campo de evidencia ahora depende del tipo — `NOTE`/`MEASUREMENT` siguen siendo texto; `EXTERNAL_URL` sigue siendo una URL escrita a mano (es honesto: el usuario declara que pega un enlace); el resto (`PHOTO`/`VIDEO`/`AUDIO`/`DOCUMENT`/`FORM`/`OTHER`) ahora es un `<input type="file">` real.

## Hallazgo real, corregido en el camino

Al conectar el flujo real encontré que `AgroEvidenceItem.fileUrl` se valida como URL absoluta (Zod `.url()`), y el controller no captura ese error: una URL relativa (lo que el proxy BFF devuelve tal cual) tira un **500**, no un 400 — mismo hallazgo **R8** ya documentado en el AS-IS, aquí confirmado en código real, no solo en la auditoría. `agro-evidence-upload.ts` arma la URL absoluta con `window.location.origin` antes de registrar, así que T-053 no dispara ese bug. R8 en sí (los controllers Agro no capturan `ZodError`) sigue sin resolver — está fuera de alcance de esta tarea y ya estaba documentado.

## Verificación

- **Manual, contra Postgres + API + web locales**, usuario `ui_worker` (WORKER, miembro de una finca real): subir una foto en el Centro de evidencia → `presign` 201 → `PUT` 200 → `POST evidence` 201 con URL absoluta → `GET` esa misma URL devuelve 200 y los bytes exactos del archivo. Lo mismo en "Reportar incidencia": foto adjunta a una fila de evidencia → `POST incidents` 201.
- **Automatizada**: `agro-evidence-upload-integration.test.ts` (nuevo, Postgres real, HTTP) — un archivo real escrito con `StorageService` (el mismo que sirve presign/PUT), su URL absoluta aceptada y persistida como miembro WORKER, y la regresión R8 documentada con un assert.
- Suites: API unitarias 2477 pass / 0 fail (sin cambios, no se tocó código de API salvo el test nuevo); integración 112 pass / 0 fail (+1). `tsc` del web y eslint sin errores en los 5 archivos tocados.

## Qué no se tocó

- **R8** en sí: los controllers Agro siguen sin capturar `ZodError` (500 en vez de 400) para *cualquier* body inválido, no solo `fileUrl`. Se evitó, no se arregló.
- **`DEMO_AGRO`**: no tiene `evidence:write` (aislamiento del sandbox), así que en la demo la subida de archivos reales falla con un mensaje claro; `NOTE`, `MEASUREMENT` y `EXTERNAL_URL` siguen funcionando. No se amplió el permiso del sandbox — mismo criterio que T-058b con `tasks:read:self`.
- Archivos grandes (`external_transfer`/multipart): ninguna de las 4 pantallas los necesitaba; el flujo de un solo `PUT` alcanza para fotos/audio de campo.

## Backlog restante

| Tarea | Estado |
|---|---|
| T-052 | Eventos `agro.*` en EVENT_CATALOG + outbox — requiere aprobación de catálogo |
| T-054 | ASR/visión para el intake (privacyCritical → Ollama/vision-service) |
| T-055 | Pantallas Agro en apps/mobile |
