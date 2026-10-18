# T-008f/g — ensayos aislados de escrituras y cobertura de Field Memory

**Estado:** diseño operativo; **NO EJECUTADO en Railway staging**. Issue #954. Este documento no aprueba activar el gate en producción ni marcar CAP-1/recuperación como verificados.

## Evidencia comprobada hasta el momento

- Railway tiene un único entorno `production` para SEMSEproject (verificado 2026-10-17); `semse-API` usa un solo proceso/replica con volumen `/data`.
- Despliegue productivo `76e5d1f9320b4b69f1e62fb04111c8dfd9d60b6f` SUCCESS; `SEMSE_STORAGE_WRITE_GATE_MODE` ausente → `off`.
- PR #979: pruebas de **dos procesos Node reales** con conexiones PG independientes y filesystem sintético compartido, dentro del entorno efímero GitHub Actions. API Integration run `39082389448` SUCCESS: `ok 128` drenaje multi-proceso, `ok 129` SIGKILL/fencing; suite 132 pass / 0 fail / 7 skipped.
- PR #980: auditoría estática reproducible de escritores conocidos; no certifica procesos efectivos ni operadores SSH externos.

## Restricción Railway

Railway documenta que **las réplicas de un servicio no son compatibles con los volúmenes** de filesystem local (ver [guía de API multi-región](https://docs.railway.com/guides/multi-region-api-failover#step-1-build-a-stateless-api)). No se debe declarar staging multi-replica sobre el volumen real si Railway no soporta compartirlo. El código actual usa `StorageService` con backend local; dos servicios aislados no compartirían automáticamente los mismos bytes.

## Topología del ensayo siguiente — separada de producción

1. Crear **un proyecto nuevo aislado** (o un staging genuinamente aislado) con PostgreSQL y un volumen nuevos **vacíos**, sin clonar originales, bases, backups, claves o referencias a servicios de producción. Como consume recursos facturables, confirmar presupuesto antes de provisionar.
2. Montar un volumen sintético `/data` en un solo servicio Node de pruebas, con `SEMSE_STORAGE_ROOT=/data/semse-storage-synthetic` y `SEMSE_MULTIPART_STORAGE_ROOT=/data/semse-storage-synthetic/_multipart`, y DB nueva propia.
3. Ejecutar **dos procesos hijos** en ese servicio (cada uno con PrismaClient y writerInstanceId distintos), no dos réplicas Railway con volumen. Esta prueba tiene semántica de concurrencia real, pero no verifica compartir volumen entre servidores/hosts distintos.
4. El modo de staging actual rechaza por código `NODE_ENV=production`, `RAILWAY_ENVIRONMENT=production` o `RAILWAY_ENVIRONMENT_NAME=production`. No alterar esos hard-blocks para pasar el ensayo. Si la topología requiere `NODE_ENV=staging`, comprobar que no habilita autenticación insegura ni otras funciones de desarrollo. No exponer endpoint público ni permitir permisos económicos/escrow en ese proyecto.
5. Antes de iniciar, inspeccionar `projectId`, `environmentId`, volumen, DNS, DB endpoint, SHA y nombres de variables sin imprimir valores secretos. Verificar que ningún origen apunta a `95ad1b14-d1d9-467d-82d8-5354619ba873`, a Postgres prod ni a volumen prod `05bd3f6d-4791-4a45-a879-0a6ae1f3ea84`.
6. Cargar solo archivos aleatorios sintéticos marcados y acotados. Prohibir `Railway Restore` sobre prod, `railway ssh` hacia `semse-API` prod para ensayos destructivos, y cualquier exportación de fotos reales durante esta etapa.

## Casos de aceptación obligatorios

| ID | Escenario | Condición para PASS |
|---|---|---|
| R1 | Dos procesos con PG independiente | Ambas admisiones serializadas contra el mismo gate row |
| R2 | Writer activo y DRAINING | Ninguna admisión nueva; FROZEN denegado mientras ACTIVE |
| R3 | Finalizar stream anterior | Bytes sintéticos y metadatos consistentes, ticket COMPLETED |
| R4 | FROZEN efectivo | PUT, DELETE, plan y multipart/registro rechazados; archivos permanecen iguales |
| R5 | SIGKILL de escritor | ACTIVE persiste; no FROZEN hasta terminación comprobada y fencing auditado |
| R6 | PostgreSQL desconectado | Fail closed; no bytes publicados ni tickets liberados incorrectamente |
| R7 | Reinicio y cambio de época | No auto-thaw; recuperación preserva bloqueo de antiguos escritores |
| R8 | Evidence/Postgres | Misma ventana lógica, proyección DB consistente y clasificación de huérfanos |
| R9 | Autorización/tenant | OPS_ADMIN y permiso dedicado; tenant ajeno no lee ni modifica datos |
| R10 | Thaw explícito | Ventana cerrada después de FROZEN; audit, época nueva y nuevo writer permitido |
| R11 | Topología | Evidencia de los PID/instancias/versiones y mounts completos; ninguna ruta fuera del gate |
| R12 | Rollback | Retroceso no instala binario legacy mientras gate DRAINING/FROZEN |

**FAIL CLOSED:** un solo writer desconocido, token ambiguo, origen no montado, sesión multipart fuera del scope, inconsistencia DB/bytes o una condición no observable impiden declarar FROZEN real.

## Auditoría estática complementaria

Ejecutar en checkout actualizado:

```bash
node scripts/field-memory-writer-census.mjs --check
node scripts/field-memory-writer-census.mjs --json
node --test tests/unit/field-memory-writer-census.test.mjs
```

El reporte registra solamente archivos fuente y llamadas conocidas, **no** imágenes ni contenidos originales. La lista `directFilesystemCandidatePaths` exige revisión humana: escritura a otro directorio del repo no demuestra escritura al volumen de fotos, pero tampoco se descarta sin revisar configuración efectiva.

## Gates restantes para producción

- Inventario runtime firmado de API/worker/operadores, tareas programadas y rutas FS; probar que no hay writers no instrumentados.
- Resguardo de multipart en volumen coherente: el default histórico `/tmp/semse-multipart-sessions` no es parte de `/data/semse-storage`; migrar sesiones sin pérdida o bloquear backup hasta reconciliar.
- Verificar referencia Evidence con consulta transaccional a DB y SHA-256 calculado del lado servidor antes/después. Inventarios de archivos iguales no bastan.
- Construir un **modo productivo explícito**, revisado y con rollout/rollback seguro. El código actual rechaza activación productiva: no cambiar una variable para forzarla.
- Ventana aprobada, backup fuera del servidor cifrado, dos manifests SHA, ensayo de restauración aislada y thaw auditado. No confundir offsite PASS con Railway native restore PASS.

**Estados:** T-008f = pendiente staging Railway; T-008g = inventario estático en revisión e inventario runtime pendiente; T-008i = NO EXECUTED; CAP-1 = INACTIVE.
