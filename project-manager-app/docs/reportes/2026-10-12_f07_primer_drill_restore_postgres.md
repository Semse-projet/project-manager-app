# F07 — Primer drill de restore de Postgres de producción

**Fecha:** 2026-10-12 · **Ambiente:** Railway `SEMSEproject / production` · **Estado final:** `PARTIAL` — restore lógico de Postgres verificado; backups programados, Redis y volumen de archivos siguen pendientes.

Autorizado por el owner (opción B del runbook `BACKUP_RESTORE.md`): dump de lectura, restore aislado, sin tocar producción.

## Qué se hizo

1. `pg_dump --format=custom --no-owner` ejecutado **dentro** del contenedor del servicio `Postgres` con `railway ssh` y transmitido por stdout a una carpeta temporal local fuera del repo. No se reabrió el proxy TCP público ni se escribió el dump en el disco de Railway.
2. Restore con `pg_restore --no-owner` en un contenedor Docker desechable `postgres:18` (misma versión mayor que el servidor: `pg_dump` 18.6).
3. Comparación de conteos contra producción (solo lectura, `psql` vía `railway ssh`).
4. Destrucción del contenedor y del dump (contenía PII y datos de pagos). No se conserva copia: este drill **no es un backup**.

## Resultados

| Medida | Valor |
|---|---|
| Tamaño del dump | 17 886 125 bytes (~17,1 MiB), cabecera `PGDMP` válida |
| Dump (streaming desde Railway) | 5 s |
| `pg_restore` | 16 s, exit 0, 0 líneas en stderr |
| Tablas comparadas | `Project` 8, `Milestone` 4, `PaymentEscrow` 2, `PaymentTxn` 0, `Evidence` 8, `User` 19, `Job` 17, `Bid` 11 — **coinciden en las 8** |
| Filas en `_prisma_migrations` | 120 |

**Tiempo observado de restauración lógica:** 16 segundos con el dump de ~17 MiB. **No es un RTO medido de SEMSE.** No incluye obtener un backup externo, levantar infraestructura, verificar acceso de usuarios, reanudar API/Worker, Redis ni recuperar archivos. No extrapolar a otros tamaños.

## Hallazgo: criterio del drill demasiado estricto

El runbook pedía `_prisma_migrations` "sin filas `failed`". La copia restaurada tiene 4 filas con `rolled_back_at` no nulo: `20260813140000_sync_schema_drift` (3) y `20260908050000_add_live_sessions` (1). Ambas migraciones tienen además una fila posterior aplicada con éxito, así que son rollbacks históricos resueltos, no migraciones pendientes. El criterio correcto es "ninguna migración sin una aplicación exitosa" (corregido en el runbook y en `scripts/backup/pg-restore-drill.sh`).

## Qué NO cubre este reporte

- **Backups nativos de Railway:** otro reporte registra que el owner declaró haberlos creado el 2026-10-11. Este drill no los inspecciona ni los restaura; valida solo un dump lógico propio.
- **Backups programados:** no se ha verificado desde este reporte un calendario ni una política de retención. El dump manual de este ejercicio fue destruido y **no constituye un punto recuperable**. RPO efectivo: **sin demostrar**, hasta inspeccionar un snapshot retenido y sus fechas.
- **Redis:** sin drill.
- **Volumen de archivos (`/data`):** sin drill; ver `docs/reportes/` de Field Memory.
- **Almacenamiento externo cifrado del dump** y retención: sin decidir.
- **Verificación con `prisma migrate status`:** no ejecutada contra la copia restaurada. La comparación de ocho conteos no demuestra por sí sola integridad de todos los datos.

## Trampas encontradas

- `railway ssh -- <cmd>` une los argumentos y los pasa a `bash -c`: `sh -c '...'` se rompe silenciosamente (dump de 0 bytes con exit 0). Pasar la orden completa como **un solo argumento** y verificar el tamaño del archivo.
- Un `pg_restore` 16 no lee un dump de `pg_dump` 18. El script versionado usa `postgres:18` por defecto y exige revisar `DRILL_PG_IMAGE` si cambia la versión de origen.
- En Git Bash, `docker cp` de rutas de `mktemp` falla; el script pasa el dump por stdin.

## Inventario Railway — comprobación adicional de solo lectura (2026-10-12)

Se consultó el inventario **production** del proyecto Railway `SEMSEproject`, sin acceder a datos de usuarios ni modificar servicios. Confirmado: volúmenes persistentes `postgres-volume` montado en `Postgres` (`/var/lib/postgresql/data`), `redis-volume` en `Redis` (`/data`) y `project-manager-app-volume` en `semse-API` (`/data`). Los servicios declaraban desplegados sus últimos artefactos con estado `SUCCESS`. No había buckets Railway propios enumerados.

**Limitación de evidencia:** esta consulta enumera volúmenes y buckets, **no inventaría snapshots/backups nativos**, su periodicidad, retención, verificabilidad o posibilidad de restauración. La ausencia de bucket no prueba que falten backups gestionados por Railway. El siguiente gate exige inspeccionar manualmente los respaldos nativos que declaró el owner y ejecutar una recuperación de uno de ellos en destino aislado, documentando checksum, fecha y comportamiento de aplicaciones sin cambiar producción.

### Matriz de cierre F07

| Componente | Evidencia actual | Estado |
|---|---|---|
| Dump lógico PG + restore aislado | Reporte 2026-10-12, conteos 8/8 | PARCIAL: integridad y funcionamiento completos no probados |
| Snapshot nativo Railway Postgres | No inventariado ni restaurado | PENDIENTE |
| Volumen `/data` de API: fotos y originales | Montado, respaldos/restore no acreditados | PENDIENTE |
| Redis | Volumen montado, respaldo/restore no acreditados | PENDIENTE |
| RPO/RTO de SEMSE | Sin ejercicio integral desde backup retenido | NO DEMOSTRADO |

## Siguiente

1. Decidir destino y cifrado del dump programado (bucket externo) y su retención.
2. Automatizar el dump con el mismo método y alertar si el tamaño es 0.
3. Repetir el drill con Redis y con el volumen de archivos.
4. Escribir "RPO/RTO demostrado" solo cuando existan backups programados y un drill sobre ellos.
