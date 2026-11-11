# Membresía de la identidad de servicio del worker desde el despliegue de la API

**Fecha:** 2026-11-11 · **Rama:** `fix/worker-service-membership-on-deploy` · **Runbook:** `docs/runbooks/WORKER_SERVICE_IDENTITY_MEMBERSHIP.md`

## Contexto

Desde #1129 (2026-11-09) el worker de producción recibe 403 en `/v1/agents/runs/reclaim-stale`: `agents:run:claim` pasó al rol `AGENT_RUNNER` y la identidad `usr_worker_system` no tiene esa membresía. Ningún AgentRun se reclama. `SEMSE_ROLES` del worker ya incluye `AGENT_RUNNER`; falta la fila `Membership`.

El script existente (`scripts/ops/ensure-worker-service-membership.mjs`) necesita una terminal con el `DATABASE_URL` de producción. El dueño no tiene una disponible, la imagen del worker no incluye `scripts/`, y cambiar a mano el comando de pre-deploy de la API en Railway fue rechazado por la política de permisos del agente. Este PR ofrece la misma operación por un camino revisable.

## Cambio

- `ensureWorkerServiceMembershipFromEnv(prisma, env, log)` en el script existente: reutiliza `readState`, `planServiceMembership` y `applyPlan` (mismos límites: solo `usr_worker_system`, solo roles permitidos, la org debe existir en el tenant, no reactiva membresías suspendidas, no crea User/Org/Tenant).
- `scripts/pre-migrate.mjs` la llama tras `migrate deploy`. **Apagada por defecto**: solo actúa con `SEMSE_WORKER_SERVICE_MEMBERSHIP_MODE=dry-run|apply` y una lista explícita en `SEMSE_WORKER_SERVICE_ROLES`. Nunca lanza ni bloquea el arranque; registra una línea JSON sin secretos.
- El modo manual del script (CLI) no cambia.

## Verificación

- `tests/unit/worker-service-membership.test.mjs`: 12/12 (6 nuevos: apagado sin modo, roles sin default, dry-run sin escritura, apply idempotente, abortos y BD caída sin lanzar).
- **Postgres real (laboratorio local, 128 migraciones):** usuario ausente ⇒ `aborted`; con usuario: `dry-run` ⇒ `applied` ⇒ `nothing_to_do`; las 4 membresías quedan `ACTIVE`.
- `node --check scripts/pre-migrate.mjs`.

## Activación (dueño)

Fusionar; en **semse-API** definir `SEMSE_WORKER_SERVICE_ROLES=OPS_ADMIN,WORKER,EVENT_CONSUMER,AGENT_RUNNER` y `SEMSE_WORKER_SERVICE_MEMBERSHIP_MODE=dry-run`; revisar el log; pasar a `apply`; verificar el 201 y quitar el modo. Detalle en el runbook.
