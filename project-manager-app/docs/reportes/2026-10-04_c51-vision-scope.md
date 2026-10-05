# C51 etapa 3 — vision exige tenant + participación (2026-10-04)

## Problema
Las rutas de `VisionController` por recurso no aplicaban tenant ni organización:
`GET evidence/:evidenceId`, `GET job/:jobId`, `GET milestone/:milestoneId`, `GET job/:jobId/timeline`,
`POST analyze`, `POST analyze-by-evidence/:evidenceId`, `POST consistency-by-ids`, `POST batch`, `POST batch-by-ids`.
Con `vision:read`/`vision:run` se leían análisis de otros tenants y organizaciones, se descargaban sus fotos
(`consistency-by-ids`, `batch-by-ids` buscaban `evidence` solo por id) y se escribía `VisionAnalysis` sobre evidencia ajena.

## Cambio
- `vision-access.policy.ts` (`VisionAccessPolicy`): resuelve evidencia/job/hito DENTRO del tenant del actor con
  `ResourceScopeResolver` (otro tenant o inexistente ⇒ 404; otra org u org vacía ⇒ 403; cliente, profesional asignado
  u OPS_ADMIN del tenant pasan). En listas, una evidencia ajena bloquea toda la petición.
- El controller la aplica antes de llamar al servicio; `jobId`/`milestoneId` declarados en el cuerpo también se validan.
- `VisionService` no cambia (lo usan prometeo y evidence-gateway, que tienen su propio contexto).
- Sin migración, sin flags, sin CI, sin Railway, sin tocar `rbac.ts`.

## Pruebas
`vision-access-scope.test.ts` (5): 404 cross-tenant (incluido OPS_ADMIN) e inexistente, 403 otra org/org vacía, servicio
no tocado al denegar, participantes pasan, evidencia ajena mezclada bloquea, contexto declarado ajeno bloquea.
Mutación (política sin efecto): fallan 4 de 5. API: 2875 tests, 0 fallos (2 omitidos, con Postgres). Inventario: 156 → 149.

## No cambia
Rutas sin recurso (`blueprint`, `detect-material`, etc.: solo reciben una URL) y `vision-library` (diccionario por usuario).
Queda anotado: las rutas con `imageUrl` libre merecen revisión SSRF aparte. C51 sigue PARTIAL.
