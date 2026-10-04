# C51 — milestones: rutas de evidencia, preparación de pago, visión y gobernanza exigen tenant + participación en el hito (2026-10-04)

## Hallazgo
La guarda informativa marcó 2 rutas (`run-review-agent` y `review`, que ignoraban el `milestoneId` de la URL). Al revisarlas apareció un hueco mayor:
**13 rutas por `milestoneId`** llamaban al repositorio directamente, sin política de dominio:
- `GET /v1/milestones/:id/evidence-items` y `POST .../evidence-items/seed`: el repositorio **no filtraba por tenant** (lectura y escritura entre tenants).
- `getVisionSummary` recibía el tenant pero lo ignoraba (`_tenantId`).
- Las demás (`PATCH/GET .../evidence-items/:itemId`, `history`, `archive`, `replace`, `run-review-agent`, `review`, `payment-readiness`, `readiness`,
  `payment-governance`) filtraban por tenant pero **no comprobaban la organización**: cualquier usuario del tenant con `milestones:read/write/approve`
  podía leer, archivar, reemplazar o aprobar evidencia, lanzar el agente de revisión (coste de LLM + escritura) o consultar la preparación de pago de hitos de otras orgs.
- El `itemId` tampoco se validaba contra el `milestoneId`: un item de otro hito se podía operar bajo la URL de uno propio.

Las rutas de ciclo de vida (`submit`, `approve`, `reject`, `request-changes`) ya pasaban por `milestones.policy.ts`.

## Cambio (quinto consumidor de la migración gradual)
- `milestones.repository.ts`: `getMilestoneOwnership` (ownership dentro del tenant; otro tenant / inexistente ⇒ 404) y `evidenceItemBelongsToMilestone`.
- `milestones.controller.ts`: `assertMilestoneAccess` en las 13 rutas, con la política EXISTENTE `assertMilestoneReadable` (org cliente, org profesional asignada u
  OPS_ADMIN; otra org u org vacía ⇒ 403). Si la ruta trae `itemId`, debe pertenecer al hito (si no ⇒ 404). Los permisos `milestones:*` y las reglas de
  ciclo de vida siguen aplicándose encima; no se cambia quién puede hacer qué entre participantes.
- Sin migración, sin flags, sin CI, sin Railway, sin tocar `rbac.ts`.

## Pruebas (`milestones-evidence-scope.test.ts`, 4; recorren las 13 rutas)
Otro tenant (incluido OPS_ADMIN) / hito inexistente ⇒ 404; otra org u org vacía ⇒ 403; en ambos casos el repositorio y los servicios NO se tocan;
cliente, profesional asignado y OPS_ADMIN superan la guarda; item de otro hito o de otro tenant ⇒ 404. Comprobado con mutación (sin la guarda fallan 3 de 4).
Suite API: 2865 tests, 0 fallos (2 omitidos, con Postgres). Inventario de la guarda: las 2 rutas pasan de "sin evidencia" a "política de dominio".

## No cambiado a propósito
- No se endurece quién puede cada operación entre participantes (p. ej. si solo el cliente debe poder `seed`): es una decisión de dominio. Hoy basta con
  participar + el permiso ya existente. Pendiente de decisión del dueño si se quiere más estricto.
- `v1/jobs/:jobId/milestones` y `v1/projects/:projectId/milestones` ya pasan por el servicio con política.

C51 sigue **PARTIAL**.
