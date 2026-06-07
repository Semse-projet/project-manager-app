# Evidencia Staging

## Entorno

- nombre: staging
- fecha: 2026-04-05
- responsable: pendiente de firma operativa
- base objetivo: PostgreSQL `semse` en `localhost:5433` segun salida observada

## Comandos ejecutados

```bash
cd "/home/yoni/app semse/project-manager-app/packages/db"
ENV_NAME=staging npm run runtime:oneshot
```

## Resultado inventario inicial

```json
{
  "attachmentsCount": 0,
  "legacyCount": 0,
  "migrationHealthy": true,
  "recommendation": "safe_to_disable_legacy_and_cleanup"
}
```

## Resultado backfill

```json
{
  "scanned": 0,
  "migrated": 0,
  "skipped": 0
}
```

## Resultado inventario final

```json
{
  "attachmentsCount": 0,
  "legacyCount": 0,
  "migrationHealthy": true,
  "recommendation": "safe_to_disable_legacy_and_cleanup"
}
```

## Resultado cleanup dry-run

```json
{
  "mode": "dry-run",
  "count": 0
}
```

## Decision

- apto para apagar legacy: si
- apto para cleanup real: si, aunque no hay registros legacy para borrar
- apto para declararse production-ready: no todavia, porque falta evidencia real de production
- observaciones:
  - no habia datos legacy
  - no habia attachments previos
  - el validador emitio `GO`
  - el reporte se guardo en `/tmp/semse-runtime-validation/runtime-validation-staging.json`
