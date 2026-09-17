---
name: semse-prisma-workflow
description: The exact order for adding/changing a Prisma model in this monorepo, and the _prisma_migrations reconciliation failure mode (P3018/42P07 "relation already exists") that blocks ALL subsequent migrations if a table was ever created out-of-band. Use before editing packages/db/prisma/schema.prisma or debugging a failed `prisma migrate deploy`.
---

# SEMSE Prisma workflow

## The 4-step order (do not skip or reorder)

Documented in two places (`CLAUDE.md` root and `project-manager-app/CLAUDE.md`) because it's easy to get wrong under time pressure:

1. Edit `packages/db/prisma/schema.prisma`.
2. `pnpm --filter @semse/db prisma migrate dev --name <migration_name>` — generates the actual SQL migration file and applies it locally.
3. `pnpm db:generate` (root script → `pnpm --filter @semse/db prisma:generate`) — regenerates the Prisma client. Needed before most dev/build tasks even when you didn't change the schema (a stale client is a common false-positive typecheck failure).
4. Add corresponding types in `packages/schemas/src/` — the Zod contracts are a separate source of truth from the Prisma schema and are **not** auto-derived; a new model or field needs its own manual Zod schema addition.

Root-level scripts, for reference: `pnpm db:migrate` runs `prisma:deploy` (apply already-versioned migrations, no new migration generation — this is what CI/production use), `pnpm db:generate` runs `prisma:generate`, `pnpm db:seed`, `pnpm db:reset`, `pnpm db:repair-soft-delete` also exist under `packages/db`.

**Never edit `packages/db/prisma/schema.prisma` without a planned migration** — `AGENTS.md`'s NUNCA list calls this out explicitly.

## The `_prisma_migrations` reconciliation trap

Reproduced and fixed on a disposable local database in a prior session (see `docs/AUDIT_REMEDIATION_PLAN.md`, the `0.33`-adjacent note on `_prisma_migrations`/`TenantSettings`). The failure:

- If a table is ever created out-of-band — e.g. via `prisma db execute` directly, or a manual `psql` change — without a corresponding row in the `_prisma_migrations` tracking table, the **next** `prisma migrate deploy` fails with error code `P3018` / underlying Postgres error `42P07` ("relation already exists"), because Prisma tries to re-run the migration that (as far as it knows) was never applied.
- Critically, **this blocks every migration after it too**, not just the one whose table already exists — `migrate deploy` processes migrations in order and stops at the first failure.
- Fix: `prisma migrate resolve --applied <migration_name>` marks that specific migration as already-applied without re-running its SQL, unblocking the rest of the queue.

**If you ever see `P3018`/`42P07` on a `migrate deploy`, this is almost certainly the cause** — check whether the named migration's table already exists (`\d <table>` in `psql`) before assuming schema drift or a corrupted migration file.

## Local native stack (no Docker daemon in this sandbox)

The `semse-local-observability-testing` skill assumes Docker; when no Docker daemon is available, native binaries work fine for Prisma testing:

```bash
pg_ctlcluster 16 main start   # if `pg_lsclusters` shows the cluster "down"
redis-server --daemonize yes --port 6379
redis-cli ping                # confirm PONG
```

`packages/db/.env` needs `DATABASE_URL` pointed at the local instance (e.g. `postgresql://postgres:postgres@127.0.0.1:5432/<db>?schema=public`) — this file is gitignored, create it locally per-session.

## Notas para futuros agentes / hallazgos abiertos

- La reproducción del bug `_prisma_migrations` se hizo sobre una base de datos descartable, nunca sobre `projectmanager_dev` ni ninguna base real — si necesitás repetirla, hacé lo mismo (crear una DB nueva solo para la prueba, nunca contra datos que importen).
- No hay ningún check automatizado (ni en CI ni pre-deploy) que detecte una tabla creada fuera de banda antes de que `migrate deploy` falle en producción — es puramente reactivo hoy. Si el equipo quiere prevenir esto en vez de solo saber diagnosticarlo, un script que compare `information_schema.tables` contra `_prisma_migrations` antes de deployar sería la mejora obvia; no se construyó porque no había un caso real pidiéndolo en esta sesión.
- `pnpm --filter @semse/db prisma:repair-soft-delete` existe como script pero no se investigó su alcance exacto en esta sesión — si aparece un bug de soft-delete, ese es el punto de partida, no reinventar la reparación a mano.
