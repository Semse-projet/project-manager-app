---
type: plan
feature: "org-membership-status"
domain: "core"
spec: "docs/specs/core/org-membership-status.spec.md"
version: "2.0"
status: "DRAFT"
branch: "feat/ws01c-org-context-switch-slice1"
date: "2026-09-18"
---

# Plan técnico: Membership lifecycle status

> Prerrequisito: spec `APPROVED`. Este plan arrancó con la spec en `DRAFT`
> porque el slice original (ADR-040) ya tenía GO explícito del owner para
> "first compatibility slice only" antes de que el descubrimiento de
> `universal-identity-multi-role.spec.md` redujera el alcance a esto — ver
> Gates de cierre del spec para lo que falta antes de `APPROVED` real.

## 1. Snapshot de verdad

- `origin/main` SHA: `5d1c4b24` (confirmado igual en el worktree al crear la rama).
- SHA desplegado API/Web: no verificado en esta sesión (fuera de alcance — sin acceso/necesidad de Railway para un cambio no desplegado).
- Estado de servicios: no aplica a este slice (sin deploy).
- Estado de migraciones: local únicamente — `add_membership_status` aplicada contra `postgresql://semse:semse@127.0.0.1:5433/semse` (contenedor Docker local ya corriendo, compartido con otras sesiones en esta máquina).
- Flags/allowlists: ninguno introducido.
- Drift o deuda previa: ninguno detectado — `prisma migrate dev` corrió limpio sobre el historial de migraciones existente (sin P3018/42P07).

## 2. Constitution check

- [x] Spec aprobado antes de código — parcial: GO explícito del owner sobre el slice más amplio (ADR-040), spec reducido documentado retroactivamente el mismo día tras el hallazgo de conflicto; no re-aprobado explícitamente por el owner todavía.
- [x] Tenant/org/ownership y RBAC definidos — sin cambio de ninguno, el campo nuevo es de solo lectura en este slice.
- [ ] Evidence/Payment Governance revisados si aplica — no aplica, sin tocar esos dominios.
- [ ] Audit/events definidos para cambios críticos — no aplica, sin escritura nueva de `status`.
- [x] Tests preceden implementación — parcial: el `where: {status: "ACTIVE"}` se escribió primero como cambio mínimo, el test de regresión se escribió inmediatamente después en la misma sesión, no en un ciclo red-green estricto.
- [x] No se expone secreto ni se agrega backend paralelo.
- [x] Código, CI, merge, deploy y activación se medirán por separado — reflejado en el delivery-state block del spec.

## 3. Arquitectura y autoridad

- Fuente de verdad de escritura: `Membership` en Postgres vía Prisma, sin cambio de propietario.
- Read models/proyecciones: ninguna — lectura directa en ambos call sites.
- Módulos afectados: `apps/api/src/modules/auth/`, `apps/api/src/modules/users/`.
- Contratos Zod: ninguno tocado — `getMyCapabilities` nunca tuvo un schema Zod de salida (confirmado por grep en `packages/schemas/src`), no se introduce uno nuevo para mantener el diff mínimo y consistente con el patrón existente del endpoint.
- API/BFF/UI: sin cambio de contrato en `POST /v1/auth/login`; `GET /v1/users/me/capabilities` gana un campo aditivo (`status`).
- Worker/queues: no tocado.
- Agentes/tools: no tocado.
- ADR requerido: ya existe — `docs/architecture/ADR-040-ws01c-identity-organization-context.md` (con su addendum 2026-09-18 documentando por qué este plan es un subconjunto reducido del slice original).

## 4. Datos y migración

- Cambio Prisma: `Membership.status String @default("ACTIVE")`.
- SQL y checksum: generado por `prisma migrate dev --name add_membership_status` en `packages/db/prisma/migrations/<timestamp>_add_membership_status/migration.sql` — ver el archivo real para el checksum que Prisma registra en `_prisma_migrations`.
- Expand/contract: expand-only, sin fase de contract prevista (no hay columna vieja que retirar).
- Backfill/shadow read: backfill automático por `DEFAULT`, sin shadow read necesario.
- Compatibilidad durante deploy: total — ninguna fila existente cambia de forma observable (todas quedan `ACTIVE`, que es el comportamiento que ya tenían implícitamente).
- Pre-deploy command: `pnpm db:migrate` (`prisma migrate deploy`), nunca `db push`, per `semse-prisma-workflow`.
- Rollback o forward-fix: rollback de código sin tocar la columna (inocua sin uso); rollback de datos = `DROP COLUMN "status"` si hiciera falta, no ejercitado en esta sesión.
- Prueba de migración: aplicada y verificada localmente contra el Postgres local de esta sesión; no verificada contra staging/producción (fuera de alcance sin deploy).

## 5. Seguridad y política

- Ningún permiso nuevo. El único cambio de superficie de ataque es que un
  usuario con membership no-`ACTIVE` deja de poder iniciar sesión usando esa
  org como default — un endurecimiento, no una relajación.
- Riesgo residual documentado en el spec (§7, hallazgo abierto): `status`
  es por fila `(userId, orgId, roleId)`, no agregado por `(userId, orgId)` —
  un usuario con dos roles en la misma org y estados mixtos no está
  cubierto por ningún test de este slice.

## 6. Plan de pruebas

- Unit: `apps/api/test/auth-login-membership-status.service.test.ts` (P1/P2
  del spec).
- Integration: ninguno nuevo — el filtro Prisma en sí no se ejercitó contra
  la base real en un test automatizado, solo se corrió la migración y se
  inspeccionó el SQL generado (ver Gates de cierre del spec, hallazgo
  pendiente).
- Regresión: se corre la suite completa de `apps/api` (`pnpm --filter
  @semse/api test:unit`) para confirmar que ningún test existente que lea
  `Membership` se rompe por el campo nuevo.

## 7. Rollout

- Sin feature flag — cambio de bajo riesgo, reversible sin pérdida de datos,
  sin comportamiento observable hasta que algo escriba `status != "ACTIVE"`
  (lo cual no ocurre en este slice).
- No se abre PR en esta sesión (worktree local, commiteado en rama
  `feat/ws01c-org-context-switch-slice1`, sin push) — el usuario decide si
  pushea.
