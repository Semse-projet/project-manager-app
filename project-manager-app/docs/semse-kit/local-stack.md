# Stack local para las pruebas del kit (sin GitHub ni Railway)

Receta verificada el 2026-10-21 para ejecutar `tests/e2e-semse/authenticated-es-en.spec.ts` contra un stack completo en una sola máquina: PostgreSQL, Redis, API y web en **modo producción**, con datos sintéticos. Todo es local y desechable. Ningún paso toca Railway, GitHub ni datos reales.

## 1. Base de datos y Redis

Con Docker: `docker compose -f infra/docker/compose.semse-mvp.yml up -d`.

Sin Docker (contenedores sin daemon), con los binarios de PostgreSQL 16 y Redis:

```bash
D=/var/lib/postgresql/semse-e2e && mkdir -p $D && chown postgres:postgres $D
su postgres -s /bin/bash -c "/usr/lib/postgresql/16/bin/initdb -D $D/data -U semse --auth=trust && /usr/lib/postgresql/16/bin/pg_ctl -D $D/data -o '-p 5433 -k $D' -l $D/pg.log start"
psql -h 127.0.0.1 -p 5433 -U semse -d postgres -c "ALTER USER semse PASSWORD 'semse';" -c "CREATE DATABASE semse;"
redis-server --port 6379 --daemonize yes
```

## 2. Variables de entorno (por nombre; valores locales generados en el momento)

Los secretos se generan con `openssl rand -hex 32` en un archivo **fuera del repositorio**. Nunca se copian de `.env` ni de Railway.

| Variable | Valor local | Por qué |
|---|---|---|
| `DATABASE_URL` | `postgresql://semse:semse@127.0.0.1:5433/semse` | base desechable |
| `REDIS_URL` | `redis://127.0.0.1:6379` | |
| `AUTH_SECRET`, `SEMSE_WEB_SESSION_SECRET`, `SEMSE_BOOTSTRAP_TOKEN` | aleatorios | la API exige Bearer, como en producción |
| `SEMSE_API_BASE_URL` | `http://127.0.0.1:4000` | BFF → API |
| `SEMSE_ENABLE_ACCESS_TOKEN_BOOTSTRAP` | `true` | **imprescindible** si la API tiene `AUTH_SECRET` y la web no está en producción; sin esto la BFF llama sin token y todo responde 401 |
| `NEXT_PUBLIC_SEMSE_RUNTIME_ENABLED` | `true` | la web usa la API real |
| `RATE_LIMIT_LIMIT` | `5000` (sólo local) | el límite global por defecto es 20 peticiones/min **por IP**, y en local toda la BFF sale de 127.0.0.1 |

## 3. Migraciones, semilla y servicios

```bash
pnpm db:migrate && pnpm db:seed          # con DATABASE_URL exportada
pnpm build:packages && pnpm build:api
(cd apps/api && node dist/main.js)       # :4000, /v1/health → 200
cd apps/web && NODE_ENV=production npx next build
cp -r .next/static .next/standalone/apps/web/.next/static && cp -r public .next/standalone/apps/web/public
cd .next/standalone/apps/web && NODE_ENV=production PORT=3000 HOSTNAME=127.0.0.1 node server.js
```

`next start` **no** sirve los assets con `output: standalone`: el login no se hidrata y el spec se salta todos los casos. Hay que usar `server.js`, como el Dockerfile. Usar `http://localhost:3000` como base: las redirecciones del middleware salen con `localhost`.

## 4. Cuentas de prueba

En modo producción la web **rechaza las sesiones de las cuentas demo** de la semilla (`isDisabledDemoSession`): es una protección correcta. Hacen falta cuentas sintéticas:

1. Registrar un cliente y un profesional por `POST /api/semse/auth/register` (`role: CLIENT` / `PRO`, correo `e2e-…@example.test`, contraseña aleatoria de 15+ caracteres). La API limita el registro a 3/min.
2. OPS_ADMIN no se puede auto-registrar. En la **base local** se registra un cliente y se cambia su `Membership.roleId` al rol `OPS_ADMIN`. Nunca en una base compartida.
3. Exportar `SEMSE_E2E_{ADMIN,CLIENT,WORKER}_{EMAIL,PASSWORD}` antes de ejecutar el spec.

Con `next dev` (NODE_ENV distinto de producción), el spec usa por defecto las cuentas demo y no hace falta este paso. Pero en dev cada ruta compilada tiene su propia caché de tokens y se supera el límite de 5/min de `POST /v1/auth/token` (ver KIT-F3-04 en `test-matrix.md`).

## 5. Ejecutar

```bash
pnpm quality:i18n                        # catálogos ES/EN, sin stack
PLAYWRIGHT_BASE_URL=http://localhost:3000 pnpm test:e2e:semse:es-en
```

Si la versión de Playwright del repo pide un Chromium que no está instalado y no se puede descargar, se usa una config local **no versionada** que extienda `playwright.semse.config.ts` con `use.launchOptions.executablePath` apuntando al Chromium disponible. Nunca hay que modificar la config del repo para eso.

## 6. Specs de API con identidad por cabeceras (contratación)

`tests/e2e-semse/job-lifecycle-rating.spec.ts` recorre la contratación hablando directamente con la API:

- recorrido feliz: trabajo → reserva → contrato → firmas → escrow `mock` → hito → evidencia → liberación → `completed` → valoraciones y reputación;
- casos negativos de cada paso.

Usa la identidad por cabeceras (`x-tenant-id`, `x-org-id`, `x-user-id`, `x-roles`) y las organizaciones y usuarios demo de la semilla. Necesita una **segunda API, sólo local**, en `:4122`:

```bash
(cd apps/api && env -u AUTH_SECRET SEMSE_ALLOW_HEADER_IDENTITY=true NODE_ENV=test PORT=4122 node dist/main.js)
SEMSE_API_URL=http://127.0.0.1:4122 pnpm exec playwright test -c playwright.semse.config.ts tests/e2e-semse/job-lifecycle-rating.spec.ts
```

La API sólo acepta cabeceras con las tres condiciones: sin `AUTH_SECRET`, con `SEMSE_ALLOW_HEADER_IDENTITY=true` y con `NODE_ENV` en `development` o `test` (`headerIdentityAllowed`). Si la API no responde o no acepta cabeceras, el spec se salta.

**Ojo con los `.env`:** `env -u AUTH_SECRET` sólo quita la variable del proceso. Al arrancar, `apps/api/src/main.ts` (dotenv) y `ConfigModule` vuelven a cargar `apps/api/.env` y `packages/db/.env` sin sobrescribir lo ya definido. Si alguno de los dos define `AUTH_SECRET`, la variable vuelve, la API exige Bearer y el spec se salta entero.

- Para esta API, ninguno de esos archivos puede definir `AUTH_SECRET`.
- Tampoco vale dejarla vacía (`AUTH_SECRET=`): la validación del entorno exige al menos 32 caracteres y la API no arranca.

Comprobado el 2026-11-06:

- sin `.env`, 200;
- con un `.env` que define `AUTH_SECRET`, 401;
- con `AUTH_SECRET=`, la API no arranca.

`dispute-resolution.spec.ts` y `edge-cases-payment-rating.spec.ts` siguen desfasados respecto a la API actual (rutas como `POST /v1/escrow/fund` o `PATCH /v1/disputes/:id` ya no existen) y fallan.
