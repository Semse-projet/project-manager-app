# C51 — trust: Trust Passport acotado al tenant del solicitante

Fecha: 2026-11-07 · Alcance: un módulo (`modules/trust`) · C51 sigue **PARTIAL**.

## Evaluación del módulo
- `GET /v1/jobs/:jobId/trust` y `GET /v1/projects/:projectId/trust` ya cargan el job/proyecto filtrando por tenant
  (otro tenant ⇒ 404) y deciden con `trust.policy.ts` sobre `sameOrg`/`isOpsAdmin` (contrato común). Su alcance es
  más amplio que `ProjectScope`: incluye al profesional con reserva aceptada y al del contrato, que el resolver
  canónico no modela. **No se migra al resolver** (perdería esos participantes o exigiría ampliar el resolver).

## Hallazgo y cambio
`GET /v1/users/:userId/trust-passport` buscaba al usuario solo por `id` y `status`, sin tenant. Un OPS_ADMIN de un
tenant podía emitir un pasaporte firmado para un usuario que solo pertenece a otro tenant y distinguir 200/404
(oráculo de existencia). Ahora `TrustPassportService.issue` exige que el usuario tenga una membresía `ACTIVE` en una
org del tenant del solicitante; si no, 404 sin calcular nada. Tenant vacío nunca concede. La regla de quién puede
pedirlo no cambia (propio usuario u OPS_ADMIN), en línea con la decisión D3 del dueño para credenciales.

## Pruebas
- Nueva `apps/api/test/trust-passport-tenant-scope.test.ts` (6) contra el código compilado real (la prueba previa
  `trust-passport.service.test.ts` usa una copia inline del servicio y no cubre el código de producción).
- Mutación: al quitar el filtro de membresía en `dist`, fallan 3 pruebas; restaurado, 6/6.
- Pruebas de trust: 44/44. Suite `@semse/api test:unit`: 3852 pass, 0 fail, 2 skipped (Postgres local). ESLint limpio.

## Pendiente / límites
- `assertCanIssue` responde 401 (no 403) al pedir el pasaporte de otro usuario; no se cambió el código de estado.
- `resolveProfessionalOrgId` toma la primera membresía profesional del usuario en el tenant: no determinista si
  pertenece a varias orgs profesionales. No se tocó.
- Sin smoke autenticado en producción; no se declara despliegue.
