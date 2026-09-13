# F07 — Revisión de backups: qué existe realmente, hoy

**Fecha:** 2026-09-13
**Tipo:** revisión de solo lectura (Railway Dashboard, sesión propia del usuario en su navegador; `railway service list --json` por CLI para IDs). No se creó ningún backup nuevo, no se tocó el botón **Restore** de ningún panel, no se cambió el plan de Railway. Responde a F07 de `SEMSEproject_Auditoria_2026-09-11.md` ("Panel de backups bloqueado por plan/acceso; sin evidencia de restore") — esta vez el panel sí cargó, con más detalle del que la auditoría original pudo ver.

## Resumen

La cuenta **no está en el plan Pro de Railway** — sin excepción, para ningún servicio: `"Backups and point-in-time recovery (PITR) are only available for customers on the Pro plan."` Esto bloquea las dos protecciones continuas reales (backups programados y PITR) en los 3 servicios con volumen. Pero, a diferencia de lo que sugería la auditoría original ("sin evidencia"), **sí existen backups manuales — puntuales, no programados, y desiguales entre servicios**:

| Servicio / volumen | Backup manual existente | Antigüedad hoy | Programado (schedule) |
| --- | --- | --- | --- |
| **Postgres** (`postgres-volume`, `/var/lib/postgresql/data`) | "Pre-Security-Patch Backup", 381 MB | **21 días** | No — "No backup schedule" |
| **Redis** (`redis-volume`, `/data`) | "Pre-Security-Patch Backup", 688 MB | **8 días** | No — "No backup schedule" |
| **semse-API** (`project-manager-app-volume`, `/data` — archivos subidos: evidencia, uploads) | **Ninguno** | — | "No Backups — This service's volume does not have any backups." |

## Lectura de los datos

Las fechas de cada backup coinciden, servicio por servicio, con la fecha del propio redeploy de ese servicio (`railway service list --json`: Postgres `latestDeployment.createdAt = 2026-08-22`, hace 21 días; Redis `latestDeployment.createdAt = 2026-09-05`, hace 8 días). Es decir: **estos backups no son parte de una política de protección de datos — son la precaución puntual de quien hizo cada actualización de imagen** ("Pre-Security-Patch", probablemente el bump de versión de cada imagen), tomada justo antes de su propio cambio. Nadie ha vuelto a tomar un backup de Postgres desde entonces, ni de Redis. Y nadie ha tomado nunca uno del volumen de archivos de la API.

Con esto, en este momento:

- **RPO real de Postgres (la fuente de verdad del negocio: proyectos, pagos, evidencia, usuarios) es de ~21 días** si hubiera que restaurar hoy — se perderían tres semanas de datos, incluyendo todo lo cerrado en `PR #609`/`#613`/`#614` de esta semana.
- **RPO de Redis es ~8 días** — menos crítico: Redis aquí es cola de BullMQ/cache (`apps/worker`), no la fuente de verdad; perder 8 días de estado de cola es recuperable (reintentos, reconciliación con Postgres), no una pérdida de negocio irreversible.
- **RPO del volumen de archivos de la API es infinito — no hay ningún punto de recuperación.** Como `StorageService` solo implementa backend local (`C72` de la auditoría del 11-sep: "siempre genera upload local"), **todo archivo subido por cualquier usuario en toda la app** (fotos de evidencia, documentos de proyecto, adjuntos) vive únicamente en este volumen sin backup. Si el volumen se corrompe o se borra, esos archivos no son recuperables por ningún medio visto en esta revisión.
- **Ningún backup existente fue restaurado nunca** (ni antes, ni en esta revisión — no se tocó el botón Restore, que hubiera creado un deploy real). Sigue sin haber evidencia de que estos backups concretos sean efectivamente restaurables — solo que existen.

## Conexión con F06 (ver `docs/reportes/2026-09-13_f06_revision_pre_migrate.md`)

El incidente P3018 documentado en F06 (una migración bloqueó todos los deploys de `semse-API` ~13 horas) es exactamente el escenario para el que existe PITR ("recovering to the moment just before a bad migration", según la guía oficial de Railway). Con PITR no disponible por el gate de plan, la única vía de recuperación ante un incidente de migración real sería restaurar el backup manual de Postgres — hoy de 21 días de antigüedad, con 3 semanas de pérdida de datos. En ese incidente puntual no hizo falta llegar a ese extremo (se resolvió el registro de la migración a mano), pero el mecanismo de respaldo con el que se hubiera contado, si hubiera hecho falta, era ese.

## No implementado en esta pasada (decisión de negocio, no de código)

- Si el presupuesto permite el plan Pro de Railway — eso resuelve backups programados + PITR para los 3 volúmenes de una sola vez, es la opción más directa según la propia documentación de Railway.
- Si no: al menos automatizar un backup manual periódico de Postgres (vía API/cron, ver la sección "Automate offsite dumps with a cron service" de la guía de Railway) y, sobre todo, **algún mecanismo de backup para el volumen de archivos de la API**, que hoy no tiene ninguno.
- Ejecutar un "restore drill" real (crear una base de prueba, restaurar el dump ahí, verificar conteos de filas) antes de asumir que estos backups sirven — no se hizo en esta revisión porque implica acciones adicionales (abrir túnel, `pg_dump`/`pg_restore`) fuera del alcance de "solo lectura del panel" pedido.
