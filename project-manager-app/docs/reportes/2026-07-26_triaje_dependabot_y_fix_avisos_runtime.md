# Reporte — Triaje de las alertas de Dependabot y corrección de los avisos que afectan runtime

**Fecha:** 2026-07-26
**Repositorio:** Semse-projet/project-manager-app
**Origen:** GitHub reportó 12 vulnerabilidades de dependencias en `main` (6 high / 2 moderate / 4 low)
**Autor:** Claude Code
**Alcance del cambio:** 4 entradas en `pnpm.overrides` del `package.json` raíz + `pnpm-lock.yaml`. **Cero cambios de código de aplicación.**

## Criterio del triaje

La severidad nominal del aviso no es el criterio útil aquí: lo que decide la prioridad es **si el paquete está en el runtime de un servicio desplegado**.

Solo se despliegan **4 apps**: `apps/api`, `apps/web`, `apps/worker` (Railway) y `apps/vision-service` (Python, sin npm). Confirmado por el IaC en `infra/railway/` (`api.railway.json`, `web.railway.json`, `worker.railway.json`, `ollama.railway.json`). **`apps/angular`, `apps/assistant-portal`, `apps/autonomy-server` y `apps/mobile` no se despliegan**, y de ahí salía la mayoría de los avisos.

## Corregido (P1 + el autoinfligido)

| Paquete | Antes → después | Ruta | Justificación |
|---|---|---|---|
| `fast-uri` | `4.1.0` → `4.1.1` | `apps/api` › `@nestjs/platform-fastify` › `fastify` › `fast-json-stringify` | **El único claramente serio.** Está en `dependencies` de la API, en el camino de cada request. Host confusion vía backslash literal en el authority. CVE-2026-16221 / GHSA-v2hh-gcrm-f6hx, CVSS 7.5. Fix a nivel patch |
| `fast-uri` | `3.1.3` → `3.1.4` | `apps/angular` › `@angular/build` › `ajv` | Mismo CVE en la rama 3.x. La app no se despliega, pero el fix es patch y dejar la mitad de un CVE abierto no aporta nada |
| `find-my-way` | `9.6.0` → `9.7.0` | `apps/api` › `@nestjs/platform-fastify` | Router de la API, CVSS 7.5. **Mitigante: el aviso es DDoS vía HTTP/2 y HTTP/2 no está habilitado** — `new FastifyAdapter({ logger: false })` en `apps/api/src/main.ts:35`, sin `http2: true`. No explotable tal como está configurado; se sube por higiene porque es un bump menor |
| `js-yaml` | `4.2.0` → `4.3.0` | `apps/api` › `@nestjs/cli` (devDependency) | **El aviso lo causaba nuestro propio `pnpm.overrides`**, que lo pinneaba en `4.2.0` cuando el fix es `≥4.3.0`. Solo build-time, pero la corrección es cambiar un número que ya controlamos |

Se usó la sintaxis de override con rango (`fast-uri@^3.0.0` / `fast-uri@^4.0.0`), el mismo patrón que ya se usa para `undici`, para no forzar la rama 4.x sobre los consumidores que piden `^3` (`ajv`).

**Resultado en `pnpm audit`:** de **11 hallazgos (7 high / 2 moderate / 2 low)** a **7 (3 high / 2 moderate / 2 low)**.

## Deliberadamente NO corregido

| Paquete | Por qué se deja |
|---|---|
| `sharp` `0.34.5` → `≥0.35.0` | CVEs heredados de libvips, en `apps/web` › `next`. **Requiere su propia verificación de build, no entra en un PR de overrides.** Exposición práctica baja: `next.config.ts` no tiene bloque `images`, así que Next rechaza URLs remotas, y ningún componente usa `next/image`. En contra: la ruta `/_next/image` existe igual y `middleware.ts:176` la excluye del middleware, así que no pide sesión. El fix trae binarios nativos nuevos — hay que confirmar compatibilidad con `next@15.5.21` y que el build de Railway no rompa |
| `brace-expansion` `1.1.16` / `2.1.2` | Solo `@nestjs/cli` (dev) y `c8` › `test-exclude` (test). El aviso cubre **todo** `<=5.0.7`, así que "arreglarlo" exige forzar 5.x en todo el árbol, con riesgo real de romper los consumidores de `minimatch` 3.x. Ya existe un `brace-expansion@5.0.8` sano en paralelo en el árbol |
| `@hono/node-server` | `apps/angular` › `@angular/cli` › `@modelcontextprotocol/sdk`. App no desplegada; el bug es path traversal solo en Windows |
| `tar` `7.5.20` | `apps/angular` › `@angular/cli` › `pacote`. App no desplegada, build-time |
| `body-parser` `1.20.5` | `apps/assistant-portal` › `express`. App no desplegada |
| `dompurify` `3.4.11` | `apps/assistant-portal` › `streamdown` › `mermaid`. App no desplegada |

## Validación

Los scripts `pnpm typecheck` y `pnpm --filter @semse/api test:unit` **no corren en Windows** por problemas preexistentes del entorno, ajenos a este cambio (ver "Hallazgos colaterales"). Se ejecutaron los pasos equivalentes a mano.

| Verificación | Resultado |
|---|---|
| `pnpm install` con los overrides nuevos | ✅ Resuelve `fast-uri@3.1.4` + `4.1.1`, `find-my-way@9.7.0`, `js-yaml@4.3.0` |
| Build de los 10 paquetes del workspace | ✅ 10/10 |
| `prisma generate` | ✅ |
| `tsc --noEmit -p apps/api/tsconfig.json` | ✅ Sin errores |
| `tsc --noEmit -p apps/web/tsconfig.json` | ✅ Sin errores |
| `check:worker` (`node --check src/main.mjs`) | ✅ |
| Tests unitarios raíz | ✅ 952 tests, **947 pass / 0 fail**, 5 skipped |
| Tests unitarios de la API | 1966 tests, **1961 pass / 5 fail** |
| **Misma suite sobre las dependencias de `main`** | **1966 / 1961 pass / 5 fail — los mismos 5** ⇒ cero regresiones atribuibles a este cambio |

La comparación contra `main` se hizo revirtiendo `package.json` + `pnpm-lock.yaml` con `git stash`, reinstalando con `--frozen-lockfile` y corriendo la suite completa otra vez, para comparar en igualdad de condiciones.

## Hallazgos colaterales (no corregidos aquí, valen su propio ticket)

1. **Peer dependency roto en producción por el propio Dependabot.** `pnpm install` avisa:
   `@nestjs/platform-fastify 11.1.28 → unmet peer @fastify/static@"^8.0.0 || ^9.0.0": found 10.1.2`.
   Lo introdujo el merge de **#429** (`chore(deps): bump @fastify/static from 9.3.0 to 10.1.2`). Es la API, en `dependencies`. Conviene revisar si `@nestjs/platform-fastify` tolera `@fastify/static` 10 o si hay que revertir ese bump.
2. **Los 4 tests de `changePassword` fallan solo en la suite completa y pasan en aislamiento** — bug de aislamiento/estado compartido entre tests, introducido por **#430** (`feat(account): add shared account center and password change`). No es un bug de producto, pero deja la suite en rojo permanente.
3. **`scripts/workspace-runner.mjs:42`** usa `spawnSync("pnpm", …)` sin `shell: true`, así que `pnpm typecheck`, `build:packages` y `railway:preflight` **fallan con `ENOENT` en Windows**. En CI (Linux) funciona.
4. **Scripts con sintaxis Unix** que fallan bajo cmd.exe en Windows: `@semse/knowledge` build (`mkdir -p` / `cp`) y `@semse/api` `test:unit` (`$(find …)`).
5. **`apps/assistant-portal/package.json` declara `pnpm.overrides`**, que pnpm ignora con un warning — solo tienen efecto en la raíz del workspace. Es código muerto que da una falsa sensación de estar pinneando algo.

## Discrepancia con el conteo de GitHub

GitHub reporta **12 (6 high / 2 moderate / 4 low)**; `pnpm audit` daba **11 hallazgos en 10 avisos (7 high / 2 moderate / 2 low)**. Los "high" cuadran casi (`fast-uri` cuenta doble por sus dos ramas, `brace-expansion` por sus dos rutas), pero GitHub ve **2 low más**. Dependabot cuenta por alerta y por manifiesto, e incluye ramas que `pnpm audit` resuelve distinto. **El cuadre exacto queda pendiente**: requiere leer las alertas por API, y `gh` no está autenticado en esta máquina.
