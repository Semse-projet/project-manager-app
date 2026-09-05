# Reporte — Time Tracker roto por migraciones fantasma; reparación automática

**Fecha:** 2026-07-27
**Repositorio:** Semse-projet/project-manager-app
**Alcance:** `scripts/pre-migrate.mjs`. **Sin cambios de código de producto.**
**Origen:** reporte del usuario — "el time tracker no funciona".

## Reproducción

Con credenciales de un worker real, en el navegador contra producción
(`semse-web-production.up.railway.app/worker/tracker`):

- Banner **"Sincronización pendiente — ThrottlerException: Too Many
  Requests"**.
- Banner **"Acción no completada — Internal server error"**.
- Red: `GET /api/semse/labor/timer/active` → **500**, `GET
  /api/semse/labor/entries` → **500**.

## Causa raíz

Logs de producción, error real de otros usuarios al pulsar "Iniciar" en el
timer:

```
PrismaClientKnownRequestError: Invalid `prisma.timeEntry.findFirst()` invocation:
The column `TimeEntry.clientEventId` does not exist in the current database.
    at LaborEngineService.startTimer
```

`TimeEntry.clientEventId` es un campo del modelo Prisma (migración
`20260722010000_time_entry_client_idempotency`, la misma que sirvió de
precedente al arreglo de dedup de Agro de hoy). El cliente Prisma generado la
conoce; la base de producción no la tiene. Como Prisma selecciona todas las
columnas escalares del modelo por defecto, **cualquier** query contra
`TimeEntry` —`startTimer`, `getActiveTimer`, `listEntries`— revienta, no solo
la que menciona `clientEventId` explícitamente. Eso explica los tres 500 (timer
activo, listado de entradas, e inicio de timer) con una sola causa.

Revisando con el mismo método, se encontró una segunda víctima, ajena al
tracker: `TenantSettings` (migración `20260723000000_tenant_settings`) también
está registrada como aplicada sin existir — `/admin/settings` tira 500 en
cada carga.

### Por qué el fix de hoy (#447) no lo corrige solo

Antes de #447, `pre-migrate.mjs` marcaba como aplicada **cualquier** migración
nueva no registrada, sin ejecutar su SQL (ver
`docs/reportes/2026-07-27_migraciones_produccion_se_aplican.md`). Estas dos
migraciones cayeron en esa ventana, antes de mi sesión de hoy. El fix de #447
evita que **vuelva a pasar**, pero no repara lo que ya quedó mal: `migrate
deploy` ve esos nombres en `_prisma_migrations` y los da por aplicados para
siempre — el bug no se autocorrige solo con arreglar el mecanismo hacia
adelante.

## Solución aplicada

Nuevo paso `repairPhantomMigrations()` en `pre-migrate.mjs`, entre el baseline
y el dedup. Es una **lista explícita y revisada a mano** de dos entradas — no
un parser genérico de SQL sobre las ~70 migraciones del repo, para no arriesgar
falsos positivos:

| Migración | Verifica (introspección real) |
|---|---|
| `20260722010000_time_entry_client_idempotency` | `information_schema.columns` para `TimeEntry.clientEventId` |
| `20260723000000_tenant_settings` | `pg_tables` para `TenantSettings` |

Si la migración está registrada como aplicada **pero** el objeto que debía
crear no existe, borra su fila de `_prisma_migrations`. El `migrate deploy` que
corre justo después (ya arreglado en #447) la ve pendiente y aplica su SQL
completo por primera vez.

Es seguro porque:
- Ambas migraciones son **puramente aditivas** (`ADD COLUMN` nullable +
  índice único que ignora NULLs; `CREATE TABLE` nueva). Cero riesgo de pérdida
  de datos.
- El mecanismo de corrupción era "insertar el registro sin ejecutar nada": no
  hay aplicación parcial que temer. Reaplicar el archivo completo es correcto.
- Sirve como red permanente: cualquier migración futura que caiga en el mismo
  patrón se autorrepara en el siguiente arranque en vez de quedar fantasma para
  siempre.

## Validación

| Verificación | Resultado |
|---|---|
| `node --check scripts/pre-migrate.mjs` | ✅ |
| `validate:workspace` | ✅ passed |
| Reproducción en navegador (credenciales reales) | ✅ confirma el error antes del fix |
| Logs de producción | ✅ confirman la causa raíz exacta, no es especulación |

No se pudo probar el camino de reparación contra un Postgres real en CI: el
job `integration` arranca de una base **vacía**, así que nunca ve una
migración fantasma que reparar — solo confirma que el script sigue corriendo
sin romperse. La prueba real es el arranque en producción tras el deploy:
verificar en los logs que las dos migraciones se reabren y se aplican, y que
`/worker/tracker` y `/admin/settings` dejan de tirar 500.

## Alcance explícito: quedan posibles fantasmas sin auditar

Esta sesión encontró estas dos por error real observado, no por auditoría
sistemática. Es razonable que existan otras migraciones fantasma sin
descubrir todavía entre las ~70 del repo — el bug estuvo activo un tiempo
indeterminado antes de #447. Una auditoría genérica (parsear cada
`migration.sql`, introspeccionar cada tabla/columna que declara crear) es
trabajo separado y de mayor riesgo; no se intenta aquí.
