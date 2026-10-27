# Resumen de evidencias del profesional: dejaba de decir «al día» sin comprobarlo

**Fecha:** 2026-10-26 · **Rama:** `claude/fix-worker-evidence-summary` (desde `main` @ `c6d4d32`) · **Origen:** recorrido automático de la app (26 pantallas, 132 enlaces internos) sobre una copia local con todos los arreglos web abiertos

## Diagnóstico

El aviso de evidencias del panel del profesional (`/worker/dashboard`) nunca funcionó, por tres motivos:

1. **Petición rechazada.** El BFF `/api/semse/worker/evidence-summary` pedía `GET /v1/jobs?status=ACCEPTED,IN_PROGRESS,RESERVED`. La API acepta un único estado y en minúsculas (`listJobsQuerySchema`), así que respondía **400 siempre**.
2. **Campo equivocado.** Aunque la petición hubiera pasado, contaba registros de `Evidence` con `status` `missing`/`rejected`. Esos registros no tienen ese campo. Los estados pendientes viven en `MilestoneEvidenceItem` (`missing | submitted | approved | rejected`), los requisitos de evidencia de cada hito.
3. **Falso «todo bien».** Ante cualquier error, el componente terminaba con `missing = 0` y mostraba **«Evidencia al día — sin items pendientes»**. El profesional veía que todo estaba en orden aunque le faltaran las fotos que desbloquean sus pagos.

## Cambio

- `apps/web/lib/worker-evidence-summary.ts` (nuevo, función pura):
  - lista los trabajos sin filtro y se queda con los activos (`RESERVED`, `ACCEPTED`, `IN_PROGRESS`), hasta 10;
  - por cada trabajo lee sus hitos y los requisitos de evidencia de cada hito;
  - cuenta como pendientes los requisitos **obligatorios** en `missing`, `rejected`, `needs_reupload` o `archived`, los que el profesional resuelve subiendo un archivo. Es la misma regla que bloquea el pago en `evaluateRequiredEvidence` (`apps/api/src/modules/milestones/evidence-readiness.ts`). `submitted` no cuenta: espera al revisor.
  - devuelve `complete: false` si no pudo leer algún hito o si hay más de 10 trabajos activos.
- La ruta BFF usa `fetchSemseDataForAuthenticatedRequest`, como las demás rutas sensibles. El middleware ya respondía 401 sin sesión, así que no había fuga; es coherencia con la convención del repo.
- `WorkerEvidenceSummary.tsx`: si la petición falla, o si el recuento es cero pero incompleto, no muestra nada en lugar de «al día».

## Verificación

| Prueba | Resultado |
|---|---|
| `tests/unit/worker-evidence-summary.test.ts` | 6/6. Contra la ruta y el componente anteriores falla el test que los revisa. |
| `tsc --noEmit` (web) y eslint de los 3 archivos | 0 errores |
| En vivo (API + web locales, datos sintéticos): trabajo en curso con 4 requisitos obligatorios (2 sin subir, 1 rechazado, 1 aprobado) y 1 opcional sin subir | `{"missingCount":3,"totalCount":4,"complete":true}` y el panel muestra «3 evidencias pendientes» |
| Mismo trabajo con todo aprobado | `missingCount: 0`, «Evidencia al día» |
| Sin sesión | 401 |

Los datos de prueba se crearon en la base local y se borraron al terminar.

## Otros hallazgos del recorrido (sin cambio en este PR)

- `/api/semse/sse/mission-control` → 403 en todas las páginas de admin: lo corrige #1031 (permisos RBAC de los streams SSE).
- `ops/mission-control/exceptions` y `runbooks` → 404: es intencionado, Mission Control 2.0 está desactivado por flag (`MISSION_CONTROL_V2_DISABLED`).
- `/contributors` → 503 en `contributors/public/missions`: pendiente de revisar.
- El aviso de evidencias solo está en español, aunque el panel tiene selector de idioma.
