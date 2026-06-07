# apps/api

Backend principal en NestJS + Fastify adapter.

Responsabilidades:
- API REST versionada (`/v1`).
- Validación de entradas con Zod/Pipes.
- RBAC/ABAC y auditoría.
- Integraciones con pagos, storage y colas.

Módulos iniciales sugeridos:
- auth
- jobs
- bids
- projects
- milestones
- evidence
- disputes
- ops
- agents

## Test scopes

- `pnpm --filter @semse/api test:unit` runs API tests that do not require external services.
- `pnpm --filter @semse/api test:coverage` uses the same unit-only scope with c8 coverage thresholds.
- `pnpm --filter @semse/api test:integration` runs `test/*-integration.test.ts`, which may require Postgres at `127.0.0.1:5433`.

For the local SEMSE stack, start Postgres with:

```bash
docker compose -f ../../infra/docker/compose.semse-mvp.yml up -d postgres
```
