# Runbook — Deduplicación de datos (C57)

El arranque de la API **no borra filas de negocio** (`scripts/pre-migrate.mjs` solo
baselinea/repara el historial de migraciones y aplica `migrate deploy`). Si una
migración falla por duplicados, el contenedor no arranca: es deliberado.

La limpieza es una operación explícita y auditable.

## Uso

```bash
# 1. Dry-run (por defecto): no modifica nada, imprime el informe JSON
pnpm db:dedup -- --report=dedup-report.json

# 2. Revisar el informe: grupos "ok" (canónica + filas a borrar) y "blocked" (fusión manual)

# 3. Antes de --apply: backup verificado Y restore probado (evidencia citada)
DEDUP_APPLY_CONFIRM=I_HAVE_A_VERIFIED_BACKUP \
  pnpm db:dedup -- --apply --backup-evidence=<ref del backup/restore> [--max-rows=50] [--only=<Tabla>]
```

## Garantías

- Una sola transacción: todo o nada. Más filas que `--max-rows` → aborta sin cambios.
- Canónica = la única fila con dependientes (FK verificadas por `pg_constraint`); si
  ninguna tiene, la más antigua por `createdAt`. **Nunca por id.**
- Bloqueado (no se borra): hijos en más de una fila, empate de fecha, sin `createdAt`,
  o FK compuesta no verificable → fusión manual.
- Las claves de grupo coinciden con los `@@unique` reales del schema (p. ej. Milestone
  usa `projectId+promotedFromBuildOpsProjectId+sequence`; el SQL antiguo usaba
  `projectId+sequence` y podía borrar filas que el schema permite).

## Rollback

Restaurar desde el backup referenciado en `--backup-evidence`. El informe JSON lista
cada fila borrada y su canónica.
