# C51 etapa 2c — originator, users, contributor-program, domain-events

Fecha: 2026-10-01 · Rama: `claude/c51-stage2c-user-scoped` · Estado C51: **PARTIAL**.

## Hallazgo
Inventario módulo por módulo: ninguno de los cuatro autoriza por org.
- `users.policy`, `contributor-program.policy`: propiedad por `userId` (+ `OPS_ADMIN`).
- `originator.service.validate`: solo el creador del proyecto (`createdBy`) valida; aislamiento por tenant (404). `orgId` va a auditoría/evento.
- `domain-events.policy`: emisión manual exige `OPS_ADMIN` + mismo tenant.
No había igualdades de `orgId` que migrar a `sameOrg`; no se cambia código de producción.

## Pruebas (`apps/api/test/c51-stage2c-user-scoped.test.ts`, 4)
Misma org u org vacía/ajena no concede acceso a recursos de otro usuario; OPS_ADMIN sigue permitido; emisión manual cross-tenant denegada incluso para OPS_ADMIN; originator: no-dueño denegado con org vacía y con misma org, otro tenant => `ORIGINATOR_NOT_FOUND`.

## Pendiente
`workspace-memory`: no se toca hasta definir su semántica de ownership/scope. C51 etapa 3 (resolver + guarda CI) requiere PR de CI autorizado.
