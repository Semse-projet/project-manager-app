# C57 — Dedup fuera del arranque (2026-10-01)

- `runDedup()` eliminado de `scripts/pre-migrate.mjs`; test garantiza que el único DELETE restante es sobre `_prisma_migrations`.
- Nuevo `scripts/maintenance/dedup.mjs` + `dedup-lib.mjs` (`pnpm db:dedup`), runbook `docs/runbooks/DB_DEDUP_MAINTENANCE.md`.
- Pruebas: `tests/unit/c57-dedup-maintenance.test.mjs` (6/6) + prueba manual en Postgres 16 local: dry-run sin cambios; `--apply` sin evidencia → exit 2; tope de filas → aborta con 0 borrados; apply real conservó la fila con hijos aunque su id fuese mayor y bloqueó el grupo con hijos en ambas filas.
- Hallazgo: el SQL antiguo de Milestone agrupaba por `projectId+sequence`, más estricto que el unique real.
- No hecho: no se tocó producción ni se retiraron servicios huérfanos (requiere decisión del dueño). Estado: PARTIAL hasta merge+deploy.
