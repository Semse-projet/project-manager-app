# C51 — intelligence: archive y risk por proyecto exigen tenant + ProjectScope (2026-10-03)

## Hallazgo
`POST/GET /v1/intelligence/projects/:projectId/archive` y `GET /v1/intelligence/projects/:projectId/risk` solo exigían
`projects:read` y pasaban el `projectId` al servicio. Los servicios cargan el proyecto solo por id
(`project.findUnique({ where: { id } })`), sin tenant ni organización:
- lectura de riesgo y de archivo de proyectos de otra organización (y de otro tenant, vía los hijos cargados por `projectId`);
- `buildArchive` escribía un `ProjectArchive` con el tenant del actor sobre un proyecto ajeno.

## Cambio (segundo→tercer consumidor del `ResourceScopeResolver`, migración gradual)
- `intelligence.controller.ts`: antes de llamar al servicio resuelve el `ProjectScope` dentro del tenant del actor
  (otro tenant / inexistente ⇒ 404) y exige org cliente, org profesional asignada u OPS_ADMIN (otra org del mismo tenant u org vacía ⇒ 403).
- `intelligence.module.ts`: importa `ResourceScopeModule`.
- Sin migración, sin flags, sin CI, sin Railway, sin tocar `rbac.ts`. No toca archivos de #754.
- Los servicios no cambian: otros llamadores internos (`projects.controller`, `operational-context.service`) quedan igual.

## Pruebas (`intelligence-project-scope.test.ts`, 3)
Otro tenant (incluido OPS_ADMIN) / proyecto inexistente ⇒ 404; otra org u org vacía ⇒ 403; en ambos casos el servicio no se llama;
cliente, profesional asignado y OPS_ADMIN del tenant ⇒ 200 en las tres rutas. Comprobado con mutación (sin el chequeo fallan 2 de 3).
Suite API: 2753 tests, 0 fallos (38 omitidos). Inventario de la guarda: no-evidence 163 → 159.

## No cambiado a propósito (necesita decisión del dueño)
`GET /v1/intelligence/credentials/user/:userId` devuelve la credencial profesional de cualquier usuario del tenant a quien tenga
`users:read`. `credentials/top` ya lista las credenciales del tenant y `credentials/public/:slug` es público, por lo que no es un
hueco evidente, pero la regla de quién puede ver la credencial de otro usuario no está definida.
Propuesta: mismo tenant y (propio usuario u OPS_ADMIN, o credencial publicada). Pendiente de decisión.

C51 sigue **PARTIAL**.
