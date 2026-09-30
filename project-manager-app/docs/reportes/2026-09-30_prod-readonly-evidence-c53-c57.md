# Evidencia de producción (solo lectura) — C53/C54/C55/C56/C57/C40/C64/C72/C02

**Fecha:** 2026-09-30 · **Método:** Railway MCP, solo lectura (inventario de entorno, estado, lista de despliegues, logs de despliegue filtrados, código de funciones). **No se leyeron variables ni secretos, no se ejecutó ninguna migración, cambio ni redeploy.** Autorizado por el owner ("Railway MCP solo lectura").

Proyecto `SEMSEproject` (`95ad1b14-d1d9-467d-82d8-5354619ba873`), entorno `production` (`d682210a-956a-4508-9c5b-4ca5959278f9`). Existen otros proyectos Railway en el workspace que **no** se inspeccionaron.

## Inventario
| Servicio | Origen | Región | Volumen | Último despliegue (id · estado · commit) |
|---|---|---|---|---|
| semse-API | repo `Semse-projet/project-manager-app` | us-east4 | `/data` 5 GB | live `aebd7ed4…` SUCCESS · `87fa20b` (#701) · construyendo `ba912a4e…` · `0d7b8d4` (#708) |
| semse-web | mismo repo | us-east4 | — | live `3a4a7fa7…` SUCCESS · construyendo `a6845b96…` |
| semse-worker | mismo repo | us-east4 | — | live `6326f3a2…` SUCCESS · construyendo `9509af84…` |
| semse-vision | mismo repo | us-east4 | — | live `6224be02…` SUCCESS · construyendo `2b5fd646…` |
| Postgres | `postgres-ssl:18` | us-east4 | 5 GB | `446b0fba…` (2026-08-22), 1 réplica, 1 warning sin detalle recuperable |
| Redis | `redis:8.2.9` | **sfo** | 5 GB | `6d9d940a…` (2026-09-05) |
| ollama | `ollama/ollama:latest` | us-east4 | **ninguno** | `7bfa09f1…` (2026-07-07) |
| db-dedup-script | función bun | sfo | — | `4cfa8b2a…` (2026-09-16), **código vacío** |
| t051-t058a-onetime-count | función bun | us-east4 | — | `9528484c…` (2026-09-30 11:40) |
Buckets: **ninguno**. Parche de entorno *staged* **vacío** desde 2026-09-29.

## Hallazgos por capacidad
- **C02 / C01 / C62 (procedencia):** cada despliegue expone `meta.commitHash` y `reason`; el origen de los 4 servicios de app es el repo. Railway **omite commits intermedios** (varios despliegues `REMOVED`): el live `aebd7ed4` es `87fa20b`, que ya incluye #698 (C80) y #700 (C39/C46) → **C80/C39/C46 están en producción a nivel de commit** (sin smoke). Los merges #702–#708 llegarán con el despliegue en construcción `ba912a4e` (`0d7b8d4`). Esto permite construir el manifiesto de C02/C79 leyendo despliegues, sin tocar CI/CD.
- **C56 (migraciones):** logs de arranque del despliegue `aebd7ed4`: `_prisma_migrations complete — no baseline needed`, **`104 migrations found in prisma/migrations`, `No pending migrations to apply`**. → `_prisma_migrations` está al día con los archivos de la build. **No cubre deriva entre `schema.prisma` y las tablas reales** (`migrate deploy` no la detecta): sigue pendiente una comparación `migrate diff` contra la BD (requiere acceso a la BD; no disponible aquí).
- **C57 (deduplicación):** el arranque de la API (`node scripts/pre-migrate.mjs && node apps/api/dist/main.js`, `Dockerfile.api` e `infra/railway/api.railway.json`) ejecuta **en cada inicio/reinicio** `DELETE`s incondicionales que conservan el `id` menor sobre `BuildOpsProject`, `BuildOpsTask`, **`Milestone`**, **`Project`** y `JobTask`. Sin dry-run, sin registro de ids, sin verificación de copia previa; el "menor id" no garantiza conservar la fila con evidencia/pagos asociados. **Hoy borra 0 filas** (log `dedup complete — 0 rows removed`) → riesgo **latente**, no daño ocurrido. Es exactamente el acoplamiento mantenimiento-de-datos/entrega que C57 pide separar. Además `db-dedup-script` es un servicio vivo con código vacío y `t051-t058a-onetime-count` es un script de conteo de un solo uso (solo `SELECT count`) que requiere `DATABASE_URL` de producción → recursos huérfanos (C64).
- **C55 (backups):** el MCP **no expone** estado de backups/snapshots de volúmenes ni pruebas de restauración → **DESCONOCIDO** (no se afirma que existan ni que no). Hechos verificados: datos críticos en 3 volúmenes de 5 GB con 1 réplica de Postgres; los archivos subidos viven en el volumen local `/data` de la API (sin bucket); no hay evidencia de copia fuera de Railway. Requiere que el operador confirme en el panel: programación de backups de Postgres y del volumen `/data`, retención y la última restauración probada.
- **C53:** Postgres online, 1 réplica, imagen `postgres-ssl:18`, último despliegue 2026-08-22; 1 warning sin detalle recuperable (sin líneas en logs con `WARNING` desde 2026-09-29).
- **C54:** Redis en **`sfo`** mientras API/worker/Postgres están en **us-east4** → dependencia regional cruzada (latencia y fallo de colas si cae el enlace); confirma el criterio de C54. Volumen presente (persistencia de colas no verificada).
- **C40:** ollama usa `ollama/ollama:latest` (etiqueta flotante, no reproducible) y **no tiene volumen**: los modelos descargados se pierden en cada redeploy del servicio.
- **C72:** confirmado que no hay buckets; el almacenamiento es solo el volumen local de la API.

## Recomendaciones (ninguna ejecutada; cada una requiere decisión/autorización)
1. **C57:** volver `runDedup()` seguro sin cambiar el comportamiento por defecto: modo `PRE_MIGRATE_DEDUP=dry-run|run|off` (por defecto `run`), conteo previo, registro de ids candidatos y tope máximo de filas (abortar si se excede). Es lógica de arranque/deploy → requiere tu autorización expresa.
2. **C57/C64:** retirar `db-dedup-script` (vacío) y `t051-t058a-onetime-count` (un solo uso, con credencial de BD) — acción destructiva en Railway, solo con tu confirmación.
3. **C55:** confirmar en el panel backups + retención + última restauración; si no existen, definir el plan antes de cualquier limpieza.
4. **C40:** fijar etiqueta de imagen de ollama y montar volumen para modelos.
5. **C54:** evaluar mover Redis a us-east4.
6. **C56:** ejecutar `prisma migrate diff` contra una copia de la BD para medir deriva.
