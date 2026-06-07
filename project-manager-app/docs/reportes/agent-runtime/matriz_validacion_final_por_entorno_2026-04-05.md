# Matriz de Validacion Final por Entorno

## Estado

Esta matriz sirve para cerrar la migracion del `Agent Runtime` por entorno con evidencia real.

Importante:

- esta matriz no reemplaza la ejecucion real
- desde este proceso ya quedaron validados `local`, `staging` y `production`
- `preprod` queda opcional segun politica interna, no como bloqueo tecnico en esta evidencia

## Resumen Ejecutivo

| Entorno | Esquema aplicado | Inventario inicial | Backfill ejecutado | Inventario final | Cleanup dry-run | Cleanup real | Legacy fallback | Migration healthy | Decision |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| local | si | si | si | si | si | n/a | disabled | true | cerrado |
| staging | si | si | si | si | si | n/a | disabled | true | cerrado |
| production | si | si | si | si | si | n/a | disabled | true | cerrado |
| preprod | pendiente | pendiente | pendiente | pendiente | pendiente | pendiente | pendiente | pendiente | pendiente |

## Evidencia por Entorno

### Local

- esquema aplicado: si
- inventario inicial:
  - `attachmentsCount: 0`
  - `legacyCount: 0`
- backfill:
  - `scanned: 0`
  - `migrated: 0`
  - `skipped: 0`
- inventario final:
  - `attachmentsCount: 0`
  - `legacyCount: 0`
  - `migrationHealthy: true`
  - `recommendation: safe_to_disable_legacy_and_cleanup`
- cleanup dry-run:
  - `count: 0`
- decision:
  - entorno sano
  - fallback legacy desactivado
  - sin datos legacy remanentes

### Staging

- esquema aplicado: si
- inventario inicial:
  - `attachmentsCount: 0`
  - `legacyCount: 0`
  - `recommendation: safe_to_disable_legacy_and_cleanup`
- backfill:
  - `scanned: 0`
  - `migrated: 0`
  - `skipped: 0`
- inventario final:
  - `attachmentsCount: 0`
  - `legacyCount: 0`
  - `migrationHealthy: true`
  - `recommendation: safe_to_disable_legacy_and_cleanup`
- cleanup dry-run:
  - `count: 0`
- cleanup real:
  - `deletedCount: n/a`
- decision:
  - entorno sano
  - sin datos legacy remanentes
  - validador emitio `GO`

### Preprod

- esquema aplicado:
- inventario inicial:
  - `attachmentsCount:`
  - `legacyCount:`
  - `recommendation:`
- backfill:
  - `scanned:`
  - `migrated:`
  - `skipped:`
- inventario final:
  - `attachmentsCount:`
  - `legacyCount:`
  - `migrationHealthy:`
  - `recommendation:`
- cleanup dry-run:
  - `count:`
- cleanup real:
  - `deletedCount:`
- decision:

### Production

- esquema aplicado: si
- inventario inicial:
  - `attachmentsCount: 0`
  - `legacyCount: 0`
  - `recommendation: safe_to_disable_legacy_and_cleanup`
- backfill:
  - `scanned: 0`
  - `migrated: 0`
  - `skipped: 0`
- inventario final:
  - `attachmentsCount: 0`
  - `legacyCount: 0`
  - `migrationHealthy: true`
  - `recommendation: safe_to_disable_legacy_and_cleanup`
- cleanup dry-run:
  - `count: 0`
- cleanup real:
  - `deletedCount: n/a`
- decision:
  - entorno sano
  - sin datos legacy remanentes
  - validador emitio `GO`

## Regla de Cierre

La migracion puede declararse cerrada globalmente si:

- `production` tiene evidencia real
- `legacyCount = 0` despues del proceso
- `skipped = 0`
- `migrationHealthy = true`

## Regla de Bloqueo

Bloquear cierre si se cumple cualquiera:

- `legacyCount > 0` despues del backfill
- `skipped > 0`
- `recommendation != safe_to_disable_legacy_and_cleanup`
- faltan datos por tenant
