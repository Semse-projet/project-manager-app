# C51 etapa 3 — milestones migra al resolver común y `seed` queda para la org cliente (2026-10-04)

Decisión del dueño aplicada (4): `seed` queda reservado a la organización cliente, con el permiso `milestones:create`;
los demás participantes conservan las operaciones que ya tenían.

## Cambio
- `ResourceScopeResolver.resolveMilestoneScope(tenantId, milestoneId)`: hito no eliminado del tenant → alcance de su proyecto (null ⇒ 404).
- `MilestonesController.assertMilestoneAccess` usa el resolver común + `assertScopeAccess` en lugar de `getMilestoneOwnership`
  (eliminado del repositorio: era un resolutor duplicado). Las 13 rutas siguen igual (read: cliente, profesional asignado u OPS_ADMIN).
- `POST /v1/milestones/:id/evidence-items/seed` exige acceso `client` (misma regla que `assertMilestoneCreatable`): el profesional asignado ⇒ 403.
  Matiz: OPS_ADMIN del tenant sigue pasando, igual que en la creación de hitos y en el resto de reglas de scope.
- Sin migración, flags, CI, Railway ni `rbac.ts`.

## Pruebas
`milestones-evidence-scope.test.ts` (6): las 13 rutas (404 cross-tenant / 403 otra org / participantes 200) + seed 403 para el profesional
y 200 para cliente/OPS_ADMIN. Mutación (seed con acceso `read`): falla 1 de 6. API: 2871 tests, 0 fallos (2 omitidos, con Postgres).
C51 sigue PARTIAL.
