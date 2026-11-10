# C51 — disputes sobre ResourceScopeResolver (+ cierre de IDOR en submit-evidence)

Fecha: 2026-11-07 · Alcance: un módulo (`modules/disputes`) · C51 sigue **PARTIAL**.

## Hallazgo
`POST /v1/disputes/:disputeId/submit-evidence` (permiso `disputes:create`) solo filtraba por tenant: cualquier usuario
del mismo tenant con ese permiso podía adjuntar ids de evidencia a una disputa de un proyecto en el que no participa.

## Cambio
- `DisputesRepository` resuelve el alcance con `ResourceScopeResolver` (`resolveProjectScope` al crear,
  `resolveDisputeScope` al adjuntar evidencia y al resolver) en lugar de su `toOwnership` sobre la consulta del proyecto.
- `submitEvidence` exige participación con la política existente `assertDisputeReadable`: org cliente, profesional
  asignada u OPS_ADMIN del tenant. Otra org u org vacía ⇒ 403 sin escritura; otro tenant ⇒ 404.
- `buildOwnershipWhere` (listar, archivar, restaurar): una org vacía ya no puede coincidir (filtro imposible), igual que `sameOrg`.
- `DisputesModule` importa `ResourceScopeModule`. Sin cambios de reglas de negocio: `assign`/`review` siguen solo
  OPS_ADMIN, `resolve` mantiene el cierre del cliente solo a favor del PRO.

## Pruebas
- Nueva `apps/api/test/disputes-resource-scope.test.ts` (6): permitidos cliente/pro/OPS_ADMIN; denegados otra org,
  org vacía (403) y otro tenant (404, también OPS_ADMIN) en submit-evidence, create y resolve; listado con org vacía.
- Mutación: al quitar la comprobación de `submitEvidence` en `dist`, falla la prueba de 403; restaurado, 6/6.
- Pruebas de disputas existentes: 52/52. Suite `@semse/api test:unit`: 3852 pass, 0 fail, 2 skipped (Postgres local).
- ESLint sin errores en los archivos tocados.

## Pendiente / límites
- Los `evidenceIds` adjuntados no se validan contra el proyecto de la disputa (solo se guardan ids; no se encontró
  ruta que los exponga). Queda como pendiente, no se inventó la regla.
- `assign` no valida que el asignado pertenezca al tenant/proyecto (fuera de alcance).
- Sin smoke autenticado en producción; no se declara despliegue.
