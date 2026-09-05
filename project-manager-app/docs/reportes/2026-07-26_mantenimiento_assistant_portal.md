# Reporte — Mantenimiento de `apps/assistant-portal`: de proyecto importado a miembro del workspace

**Fecha:** 2026-07-26
**Repositorio:** Semse-projet/project-manager-app
**Origen:** derivado del triaje de Dependabot (`2026-07-26_triaje_dependabot_y_fix_avisos_runtime.md`), que detectó un lockfile anidado en esta app
**Autor:** Claude Code

## Contexto

`apps/assistant-portal` entró al monorepo en **#265** (`Import web-assistant-portal as apps/assistant-portal`) **sin adaptarse al workspace**: conservó el andamiaje de proyecto suelto. Nunca se notó porque la app **no está en ningún pipeline de la raíz** — `scripts/workspace-runner.mjs` no la menciona ni en `build:apps` ni en `typecheck:all`, así que nada la construye ni la typechequea en CI.

El resultado, al mirarla de cerca: **su typecheck llevaba tiempo roto y nadie lo sabía.**

## Lo que estaba mal

| # | Problema | Efecto real |
|---|---|---|
| 1 | `pnpm-lock.yaml` propio (312 KB, del 2026-07-18) | pnpm lo **ignora** al instalar desde la raíz (`pnpm-lock.yaml:236` ya tiene `apps/assistant-portal:` como *importer*). Muerto y pudriéndose. Además Dependabot lo escanea como manifiesto aparte y **duplicaba 2 alertas** de forma permanente (#54 y #55 eran copias de #65 y #67) |
| 2 | Bloque `pnpm.overrides` en su `package.json` | pnpm lo **ignora** y avisa en cada `install`. Es el que hace daño de verdad: **#317 (`fix(security): pin safe esbuild in assistant portal`) editó exactamente este bloque y ese lockfile** — o sea, un arreglo de seguridad que no cambió nada de lo que se instala. El `esbuild@0.28.1` que realmente se usa viene del override de la **raíz**, que existe desde el 2026-06-22 (`997af6bc`), casi un mes antes |
| 3 | `packageManager: pnpm@10.4.1` propio | Choca con el `pnpm@10.33.0` de la raíz |
| 4 | `devDependencies` basura: `"pnpm": "^10.34.5"` y `"add": "^2.0.9"` | El gestor de paquetes como dependencia de una app, y `add` es el clásico accidente de teclear `pnpm add add` |
| 5 | **Typecheck roto** (3 errores `TS2345`/`TS2769`) | Ver diagnóstico abajo |
| 6 | 2 avisos de Dependabot sin atender (`body-parser`, `dompurify`) | Se habían despriorizado por ser una app no desplegada |

### Diagnóstico del typecheck roto

Había **dos copias de `@types/express`** con tipos `Request` incompatibles:

- raíz: **5.0.6** (la declara `apps/api`, que usa Fastify)
- `apps/assistant-portal/node_modules`: **4.17.21** (pin propio de la app)

`server/_core/context.ts:18` recibe `opts.req` tipado por `@trpc/server` —que resuelve `@types/express` desde la **raíz**, o sea la v5— y se lo pasa a `sdk.authenticateRequest`, que usa los tipos **v4** locales. De ahí `Property 'param' is missing`: `req.param()` existe en express 4 y se eliminó en express 5.

El runtime de esta app es `express@^4.22.2`, así que **lo correcto es que todo su grafo vea tipos de la 4**.

Al unificar versiones apareció un segundo error, `TS2688: Cannot find type definition file for 'node'`: su `tsconfig.json` tenía `typeRoots: ["./node_modules/@types"]` —config de proyecto suelto— y, deduplicadas las versiones, pnpm dejó ese directorio **vacío** al izar todo a la raíz.

## Lo que se hizo

1. **Borrado** `apps/assistant-portal/pnpm-lock.yaml`.
2. **Borrados** de su `package.json`: el bloque `pnpm.overrides`, el campo `packageManager` y las devDependencies `pnpm` y `add`.
3. **`@types/express` unificado en `4.17.21`** vía `pnpm.overrides` de la raíz. `apps/api` declara `^5.0.6` pero su único uso es `src/middleware/security.ts`, que **no lo importa nadie** (ver hallazgos abajo); su typecheck sigue en verde con la v4.
4. **`typeRoots` corregido** a `["./node_modules/@types", "../../node_modules/@types"]`, que es lo que corresponde a un miembro de workspace.
5. **Cerrados sus 2 avisos** con overrides de la raíz: `body-parser@^1.20.0 → 1.20.6` (con selector de rango, para no arrastrar la rama 2.x que usa express 5) y `dompurify → 3.4.12`.
6. **Añadido `check:assistant-portal`** a la raíz (`check` + `test`), siguiendo la convención de `check:worker`.

## Validación

| Verificación | Antes | Después |
|---|---|---|
| `tsc --noEmit` de assistant-portal | ❌ 3 errores | ✅ **exit 0, sin errores** |
| `vitest run` de assistant-portal | — | ✅ **4 archivos, 69/69 tests** |
| `build` de assistant-portal (vite + esbuild) | — | ✅ `built in 53.82s`, bundle de servidor 99.2 kB |
| `tsc --noEmit` de `apps/api` (riesgo del downgrade de `@types/express`) | ✅ | ✅ **sin errores** |
| `tsc --noEmit` de `apps/web` | ✅ | ✅ **sin errores** |
| Suite unitaria de `apps/api` | 1965/1966 | **1965/1966** (sin cambio) |
| Avisos low en `pnpm audit` | 2 (`body-parser`, `dompurify`) | **0** |
| Warning de `pnpm.overrides` en cada install | presente | **desaparecido** |

> El fallo restante en la suite de la API es `graphify`, un bug del test exclusivo de Windows. **Su corrección vive en la rama `chore/deps-audit-runtime-advisories`**, no en esta; aquí aparece porque esta rama sale de `main`.

## Decisión tomada: NO se wirea en `railway:preflight`

Ahora que la app está verde, la tentación es meterla en `typecheck:all` y `build:apps`. **No se hizo, y es deliberado:** ambos son parte de `railway:preflight`, que **es la puerta de despliegue de `semse-API`, `semse-web` y `semse-worker`**. Meter ahí una app que no se despliega significa que un fallo suyo bloquearía deploys de producción de servicios que no dependen de ella.

Por eso se añadió `check:assistant-portal` como script suelto: permite verificarla en CI con un job propio, sin acoplarla a la puerta de despliegue. **La decisión de si ese job debe bloquear o solo avisar es de producto, no técnica** — queda abierta.

## Hallazgos colaterales (no tocados aquí)

1. **`apps/api` arrastra un stack de Express muerto.** `src/middleware/security.ts` **no lo importa nadie** y es boilerplate de plantilla sin adaptar — sus orígenes CORS son literalmente `https://app.example.com` y `https://admin.example.com`. Trae consigo `@nestjs/platform-express` (cero imports), `@types/express`, y las referencias a `helmet`, `express-rate-limit` y `cors`. La seguridad real está en `main.ts` con `@fastify/helmet` y `@fastify/cors`. **No se tocó a propósito**: en este mismo ciclo, un análisis idéntico de "sin referencias ⇒ sin usar" sobre `@fastify/static` resultó equivocado (lo cargaba una librería en runtime), así que quitar dependencias de la API merece su propia verificación y su propio PR.
2. **`apps/assistant-portal` sigue fuera de todos los pipelines de la raíz.** Ver la decisión de arriba.
3. **El bundle del cliente pesa 3.1 MB** (`index-*.js`, 975 kB gzip) y Vite avisa. No es regresión de este PR; queda anotado.
