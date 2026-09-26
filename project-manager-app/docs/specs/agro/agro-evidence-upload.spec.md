---
id: "agro.evidence-upload"
title: "Agro — subida binaria de evidencia (flujo presignado) (T-053)"
domain: "agro"
sdd_version: "2.0"
version: "1.0"
status: "IMPLEMENTED"
owner: "semse-core"
risk: "low"
code_status: "COMPLETE"
ci_status: "NOT_RUN"
merge_status: "UNMERGED"
deploy_status: "NOT_DEPLOYED"
activation_status: "INACTIVE"
migration_status: "NOT_APPLICABLE"
feature_flags: []
production_evidence: []
related_files:
  - apps/web/app/agro/[farmId]/agro-evidence-upload.ts
  - apps/web/app/agro/[farmId]/evidence/page.tsx
  - apps/web/app/agro/[farmId]/incidents/report/page.tsx
  - apps/web/app/agro/[farmId]/incidents/[incidentId]/page.tsx
  - apps/web/app/agro/[farmId]/workforce/[workerId]/page.tsx
  - apps/web/app/semse-api.ts
related_tests:
  - apps/api/test/agro-evidence-upload-integration.test.ts
related_endpoints:
  - v1/evidence/presign
  - v1/uploads/files/:key
  - farms/:farmId/evidence
  - farms/:farmId/incidents
  - incidents/:incidentId/evidence
  - worker-capabilities/:id/evidence
related_events: []
related_agents: []
last_verified: "2026-09-25"
---

# Spec: subida binaria de evidencia Agro

## 1. Resultado

Las 4 pantallas de Agro que registran evidencia (Centro de evidencia, reportar incidencia, detalle de incidencia, verificación de capacidad de un trabajador) suben un archivo real desde el dispositivo, en vez de pedir que alguien escriba una URL a mano.

## 2. Diagnóstico (antes de tocar código)

`AgroEvidenceItem.fileUrl` siempre fue un string libre — ninguna capa comprobaba que apuntara a un archivo real. Las 4 pantallas mostraban `<input type="url">` esperando que el usuario pegara un enlace. Mismo patrón que el hallazgo `2.45` (skill `semse-upload-flow`): honesto sobre no subir nada, pero sin forma real de adjuntar un archivo del dispositivo.

El contrato de 3 pasos ya existía y ya era usable por Agro sin ningún permiso nuevo:

- `POST /v1/evidence/presign` y `PUT /v1/uploads/files/:key` (proxy BFF) exigen `evidence:write`, permiso que **ya tienen** CLIENT, PRO, WORKER y OPS_ADMIN — los mismos roles que operan Agro. No hizo falta tocar RBAC (a diferencia de T-058b).
- El paso 3 ("registrar") ya existía por pantalla: `POST .../evidence`, `POST .../incidents` (con array `evidence`), `POST .../worker-capabilities/:id/evidence` — cada uno sigue aceptando `fileUrl` exactamente como antes.

Por eso **no hizo falta un endpoint ni un campo nuevo**: solo cambiar qué URL pone la web en `fileUrl`.

## 3. Qué cambió

- **`agro-evidence-upload.ts`** (nuevo, un solo helper reusado por las 4 pantallas): sube el archivo (`presignEvidence` de `semse-api.ts` + `PUT` al proxy BFF, mismo contrato que `uploadEvidenceFile`) y devuelve la URL servible (`GET /api/semse/uploads/files/:key`).
- **Hallazgo real, corregido en el mismo cambio:** `AgroEvidenceItem.fileUrl` se valida como URL absoluta (Zod `.url()`) en los controllers Agro, y ninguno captura ese `ZodError` — una ruta relativa (`/api/semse/uploads/files/...`) lo tira con **500**, no 400 (mismo hallazgo R8 del AS-IS). `uploadAgroEvidenceFile` arma la URL absoluta con `window.location.origin` para no disparar ese bug; R8 en sí (los controllers Agro no capturan `ZodError`) sigue documentado y sin resolver, fuera de alcance de este cambio.
- **Las 4 pantallas:** el campo de evidencia se divide según `mediaType`:
  - `NOTE`/`MEASUREMENT`: sigue siendo texto (una nota, no un archivo).
  - `EXTERNAL_URL`: sigue siendo una URL escrita a mano — es honesto, el usuario declara que está pegando un enlace externo, no subiendo un archivo.
  - `PHOTO`/`VIDEO`/`AUDIO`/`DOCUMENT`/`FORM`/`OTHER`: `<input type="file">` real (con `accept` por tipo en PHOTO/VIDEO/AUDIO), que sube el archivo al elegirlo y deja "Archivo listo ✓" o el error de subida. El submit de cada formulario quedó sin cambios: sigue mandando `fileUrl`, ahora con la URL real.

## 4. Fuera de alcance

- **Corregir R8** en los controllers Agro (`ZodError` sin capturar → 500 en vez de 400) — se evitó disparándolo, no se arregló la causa raíz.
- **`DEMO_AGRO`**: no tiene `evidence:write` (aislamiento del sandbox, ver `rbac.ts`), así que en la demo la subida de PHOTO/VIDEO/AUDIO/DOCUMENT/FORM falla con un mensaje claro; `NOTE`, `MEASUREMENT` y `EXTERNAL_URL` siguen funcionando igual que antes. No se amplió el permiso de la demo para evitarlo — mismo criterio que T-058b con `tasks:read:self`.
- Archivos mayores a 25MB (`external_transfer`/multipart): el flujo de un solo `PUT` alcanza para fotos/audio de campo; multipart ya existe en el repo (ver skill `semse-upload-flow`) pero no se conectó aquí — ninguna de las 4 pantallas lo necesitaba.

## 5. Campos SEMSE

```yaml
privacyCritical: false
auditLog: "sin cambios: AgroAuditRepository sigue auditando evidence.created/updated con el fileUrl real"
sse: false
fsmTransicion: "no aplica"
paymentGovernance: false
```

## 6. Verificación

`agro-evidence-upload-integration.test.ts` (Postgres real, HTTP): un archivo real escrito con `StorageService` (el mismo que sirve `presign`/`PUT`), su URL absoluta aceptada y persistida por `POST .../evidence` como miembro WORKER; y la regresión R8 documentada (URL relativa → 500). El round-trip completo por HTTP (presign real → PUT real → GET real, sin Playwright versionado para Agro en este repo) fue verificación manual contra Postgres + API + web locales, usuario `ui_worker` (rol WORKER, miembro de `farm_ui`):

- **Centro de evidencia:** subir una foto real (`PHOTO`) desde el formulario → `POST /v1/evidence/presign` 201 → `PUT /v1/uploads/files/:key` 200 → `POST farms/:farmId/evidence` 201 con `fileUrl` absoluta → `GET` esa misma URL devuelve 200 y los bytes exactos del archivo subido.
- **Reportar incidencia:** adjuntar una foto a una fila de evidencia del reporte → mismo presign/PUT → `POST farms/:farmId/incidents` 201 (evidencia incluida).
- `tsc` del web y eslint sin errores en los 5 archivos tocados.
- Suite del API sin cambios (no se tocó): 2477 pass / 0 fail (unitarias) + 111 pass / 0 fail (integración) — se corrió para confirmar que este cambio, 100% del lado web, no rompe nada del backend.
