# Runbook — Backup y restore (F9 / F07)

> Estado: **primer drill de Postgres ejecutado el 2026-10-12** (ver
> `docs/reportes/2026-10-12_f07_primer_drill_restore_postgres.md`); Redis, volumen
> de archivos y backups programados siguen sin probar
> (revisión previa: `docs/reportes/2026-09-13_f07_revision_backups.md`). Este
> runbook no cambia producción por sí mismo; cada paso marcado **[PROD]**
> requiere aprobación explícita del owner antes de ejecutarse.

## Qué existe hoy (2026-09-13)

| Activo | Backup | Edad | Programado |
|---|---|---|---|
| Postgres (fuente de verdad) | 1 manual, "Pre-Security-Patch" | ~21 d | No |
| Redis (cola/cache) | 1 manual | ~8 d | No |
| Volumen de archivos de la API (`/data`: evidencia y uploads) | Ninguno | — | No |

Plan Railway sin Pro: sin backups programados ni PITR. Re-verificar el panel
antes de confiar en esta tabla; puede estar desactualizada.

## Objetivos (a confirmar por el owner)

| Activo | RPO objetivo | RTO objetivo |
|---|---|---|
| Postgres | 24 h (propuesto) | 4 h (propuesto) |
| Volumen de archivos | 24 h (propuesto) | 8 h (propuesto) |
| Redis | best-effort | 1 h (se reconstruye desde Postgres) |

Son propuestas. Hasta que se demuestren con un drill (abajo), no son un SLO.

## Caminos para cerrar la brecha (decisión del owner)

- **A. Plan Pro de Railway:** backups programados + PITR para los 3 volúmenes.
  Más simple; resuelve Postgres y archivos a la vez. Costo recurrente.
- **B. Sin Pro:** dump lógico periódico de Postgres + copia periódica del volumen
  de archivos a almacenamiento externo (bucket). Más trabajo propio y más
  superficie de secretos.
- En ambos casos, el **drill de restore es obligatorio**: un backup sin restore
  probado no cuenta.

## Backup manual de Postgres **[PROD]**

Prerrequisitos: sesión `railway` vinculada; el proxy TCP público de la BD está
cerrado a propósito (ver memoria de infra), así que se usa `railway run`/red
privada, no se reabre el proxy.

1. Tomar el dump desde dentro del contenedor del servicio `Postgres` (el proxy
   TCP público sigue cerrado; no se reabre) y transmitirlo por stdout:
   `railway ssh --service Postgres --environment production --project <id> -- 'pg_dump --format=custom --no-owner -h localhost' > <destino>`
   El contenedor ya define `PGUSER`, `PGDATABASE` y `PGPASSWORD`: no hay que pasar
   ni imprimir credenciales. **Trampa:** `railway ssh` pasa los argumentos a
   `bash -c`; la orden va como **un solo argumento** (un `sh -c '...'` anidado
   produce un dump de 0 bytes con exit 0). Verificar que el archivo no esté vacío
   y que empiece con `PGDMP`.
2. El dump contiene PII y datos de pagos: guardarlo cifrado, fuera del repo, con
   acceso restringido; no subirlo a chat, issues ni PRs.
3. Registrar fecha, tamaño y checksum SHA-256 del dump.

## Drill de restore (sin tocar producción)

1. Crear una base **desechable** (Postgres local en Docker o un servicio
   temporal aparte), con imagen de **versión mayor igual o superior** a la del
   `pg_dump` (hoy `postgres:18`; `DRILL_PG_IMAGE=postgres:18`). Nunca restaurar sobre la BD de producción para "probar".
2. `pg_restore --no-owner --dbname=<db_desechable> <dump>`
3. Verificar, contra la base restaurada:
   - conteos de filas de tablas clave (`Project`, `Milestone`, `PaymentEscrow`,
     `PaymentTxn`, `Evidence`, `User`) frente a producción (lectura);
   - `_prisma_migrations` sin migraciones que carezcan de una aplicación exitosa
     (un `rolled_back_at` histórico con una fila posterior exitosa es normal);
   - `prisma migrate status` limpio.
4. Medir el tiempo total: es el RTO real.
5. Destruir la base desechable y el dump de prueba cuando termine.
6. Registrar el resultado en `docs/reportes/` (qué dump, cuánto tardó, qué
   falló). Solo entonces se puede escribir "RPO/RTO demostrado".

## Volumen de archivos de la API **[PROD]**

Todo upload vive solo en `/data` (almacenamiento local). Hasta que exista un
backend de objetos o un backup, es el mayor riesgo de pérdida irreversible.
Opciones: backup de volumen de Railway (requiere Pro) o copia periódica a un
bucket. Definir el mecanismo antes de prometer un RPO.

## Antes de acciones destructivas

Cualquier operación que pueda perder datos (migración riesgosa, `db:dedup
--apply`, cambio de imagen de Postgres) exige un backup **verificado con restore
probado** y su referencia citada, como ya pide `DB_DEDUP_MAINTENANCE.md`.

## Pendiente

- Decisión del owner: camino A o B, y RPO/RTO definitivos.
- ~~Primer drill real y su reporte~~ (hecho para Postgres, 2026-10-12). Falta repetirlo con Redis y con el volumen de archivos.
- Backup del volumen de archivos.
