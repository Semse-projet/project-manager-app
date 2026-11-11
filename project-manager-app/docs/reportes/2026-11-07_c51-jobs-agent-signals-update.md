# C51 — jobs: visibilidad en agent-signals y propietario en update

Fecha: 2026-11-07 · Alcance: un módulo (`modules/jobs`) · C51 sigue **PARTIAL**.

## Evaluación del grupo bids / contracts / reservations / jobs
- **bids**: por job exige tenant + cliente dueño u OPS_ADMIN (auditado en el plan 3.10); crear exige la propia org
  profesional; aceptar exige el cliente dueño u OPS_ADMIN. Sin cambios.
- **reservations**: tenant + cliente dueño, org profesional de la reserva u OPS_ADMIN; expirar solo OPS_ADMIN. Sin cambios.
- **contracts**: lectura y firma acotadas por tenant y participación. Observación aparte (PR propio):
  `request-signatures` solo exige poder leer el contrato.
- **jobs**: dos huecos, corregidos aquí. Ninguno de los cuatro usa `ProjectScope` porque su alcance es previo al
  proyecto (job, oferta, reserva); no se migran al resolver.

## Hallazgos y cambio
1. `GET /v1/jobs/:jobId/agent-signals` (permiso `jobs:read`: CLIENT, PRO, OPS_ADMIN) devolvía las ejecuciones de
   agentes (`outputSummary`, tipo de acción, confianza) de cualquier job del tenant sin comprobar visibilidad. Ahora
   pasa primero por `JobsRepository.findVisibleById` (misma regla que el detalle): otro tenant ⇒ 404; job no
   visible ⇒ 403, sin consultar las ejecuciones.
2. `PATCH /v1/jobs/:jobId` editaba cualquier job del tenant sin comprobar propietario. Hoy ningún rol tiene
   `jobs:update` en `rbac.ts`, así que no era alcanzable, pero quedaba abierto si se concede. Ahora exige la org
   cliente dueña u OPS_ADMIN (mismo criterio que archivar/restaurar).

## Pruebas
- Nueva `apps/api/test/jobs-agent-signals-update-scope.test.ts` (5): permitidos y denegados por tenant/org/org vacía.
- Mutaciones: sin la comprobación de visibilidad fallan 3 pruebas; sin la de propietario, 1; restaurado, 5/5.
- Jobs 64/64. Suite `@semse/api test:unit`: 3851 pass, 0 fail, 2 skipped (Postgres local). ESLint limpio.

## Pendiente / límites
- `jobs:update` no está asignado a ningún rol (afecta también a `POST /v1/jobs/:jobId/transition`). No se tocó `rbac.ts`.
- Sin smoke autenticado en producción; no se declara despliegue.
