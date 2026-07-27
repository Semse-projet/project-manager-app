# Reporte — Las migraciones vuelven a aplicarse en produccion

**Fecha:** 2026-07-27
**Repositorio:** Semse-projet/project-manager-app
**Alcance:** `scripts/pre-migrate.mjs`, `packages/db/package.json`, job `integration` de CI.
**Origen:** revert de #442 (#444). Prerrequisito para re-landear cualquier cambio de esquema.

## Problema

Al intentar landear #442 —que añade una columna— se descubrio que **el repo no
tenia forma funcional de aplicar migraciones a produccion**. Tres fallos
encadenados:

1. **Nadie ejecutaba `prisma migrate deploy`.** Ni el `CMD` de `Dockerfile.api`
   ni el `startCommand` de `infra/railway/api.railway.json`, que eran
   `node scripts/pre-migrate.mjs && node apps/api/dist/main.js`. Tampoco habia
   `preDeployCommand`.
2. **`pre-migrate.mjs` marcaba como aplicada cualquier migracion no
   registrada**, insertandola en `_prisma_migrations` sin ejecutar su SQL. Esto
   no solo la saltaba en el arranque: la saltaba **para siempre**, porque un
   `migrate deploy` posterior —a mano— ya la veia registrada.
3. **Su unica via de sincronizacion, `prisma db push`, no podia correr.** El CLI
   `prisma` era `devDependency` de `@semse/db` y la etapa de runtime del
   Dockerfile hace `pnpm install --frozen-lockfile --prod`, que las excluye.
   `getPrismaCli()` caia al binario de PATH, inexistente, y el `db push` se
   saltaba por un `catch` **no fatal**.

El efecto conjunto: una migracion nueva quedaba registrada como aplicada, su SQL
no se ejecutaba nunca, y la API arrancaba con un cliente Prisma que conoce
columnas que la base no tiene.

### Estado de produccion en el momento del diagnostico: sano

Verificado con los logs reales de arranque (`railway logs -d`):

```
[pre-migrate] _prisma_migrations complete — no baseline needed
[pre-migrate] dedup complete — 0 rows removed
```

El historial estaba completo respecto al repo, y **0 errores de columna**
(`does not exist`, `P2022`, `P2021`) en 1500 lineas de log. La base y el codigo
desplegado estaban de acuerdo. El problema era exclusivamente hacia adelante.

## Solucion aplicada

### 1. El CLI de Prisma llega al runtime

`prisma` pasa de `devDependencies` a `dependencies` en `@semse/db`, para que
sobreviva al `pnpm install --prod` de la imagen.

### 2. El baseline se acota a su escenario real

Antes baselizaba cualquier migracion no registrada. Ahora distingue tres casos:

| Estado de la base | Accion |
|---|---|
| Sin tablas de usuario | **No baseline.** `migrate deploy` crea el esquema aplicando las migraciones en orden |
| Con tablas pero **sin** historial (P3005 real) | Baseline + `db push`, como estaba pensado |
| Con historial | **No baseline.** Las no registradas son pendientes y las aplica `migrate deploy` |

El primer caso tambien estaba mal: una base vacia no es P3005, y baselizarla
marcaba todo como aplicado sin ejecutar nada.

### 3. `migrate deploy` en el arranque

Se añade al final de `pre-migrate.mjs`, **despues del dedup** —que existe justo
para limpiar filas que impedirian crear un constraint unico—.

Si falla, `process.exit(1)` y el contenedor no arranca. Es deliberado: arrancar
la API con un cliente que conoce columnas inexistentes es peor que no arrancar,
porque el fallo aparece disperso en tiempo de ejecucion en vez de una sola vez,
visible, en el arranque. La red es el `healthcheckTimeout: 300` y el
`restartPolicyMaxRetries: 3` ya configurados.

### 4. CI ejecuta la ruta de produccion

El job `integration` corria `pnpm db:migrate`, que **no es lo que corre el
contenedor**. Ahora corre `node scripts/pre-migrate.mjs`, el mismo script del
`CMD`, contra el Postgres 16 del job. La ruta de arranque de produccion queda
probada en cada PR.

Se añadieron ademas `scripts/pre-migrate.mjs` y `packages/db/**` a los `paths`
que disparan el job: este es el unico sitio que ejercita esa ruta contra una
base real, y un cambio en ella no lo activaba.

## Validacion

| Verificacion | Resultado |
|---|---|
| `node --check scripts/pre-migrate.mjs` | ✅ |
| `pnpm install` + lockfile | ✅ `prisma` aparece bajo `dependencies` de `packages/db` |
| `validate:workspace` | ✅ passed |
| Ruta de arranque contra Postgres real | La ejecuta el job `integration` de este PR |

No se pudo probar en local: no hay Docker en la maquina, asi que la unica
ejecucion contra un Postgres real es la del CI — que es precisamente lo que este
cambio hace que ocurra.

## Consecuencia

Con esto, re-landear #442 vuelve a ser seguro: su migracion se ejecutara de
verdad, incluidos el backfill y la purga defensiva que el mecanismo anterior
habria saltado en silencio.
