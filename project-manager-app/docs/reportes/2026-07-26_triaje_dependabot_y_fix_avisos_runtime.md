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
| `sharp` | `0.34.5` → `0.35.3` | `apps/web` › `next` | CVEs heredados de libvips (GHSA-f88m-g3jw-g9cj). **La exposición es real, no teórica** — ver abajo. `0.35.3` trae libvips `8.18.3` |

Se usó la sintaxis de override con rango (`fast-uri@^3.0.0` / `fast-uri@^4.0.0`), el mismo patrón que ya se usa para `undici`, para no forzar la rama 4.x sobre los consumidores que piden `^3` (`ajv`).

**Resultado en `pnpm audit`:** de **11 hallazgos (7 high / 2 moderate / 2 low)** a **6 (2 high / 2 moderate / 2 low)**. **Ningún aviso restante toca un servicio desplegado**: los 6 vienen de `apps/angular` y `apps/assistant-portal` (que no se despliegan) o de dependencias solo de build/test.

## Deliberadamente NO corregido

| Paquete | Por qué se deja |
|---|---|
| `brace-expansion` `1.1.16` / `2.1.2` | Solo `@nestjs/cli` (dev) y `c8` › `test-exclude` (test). El aviso cubre **todo** `<=5.0.7`, así que "arreglarlo" exige forzar 5.x en todo el árbol, con riesgo real de romper los consumidores de `minimatch` 3.x. Ya existe un `brace-expansion@5.0.8` sano en paralelo en el árbol |
| `@hono/node-server` | `apps/angular` › `@angular/cli` › `@modelcontextprotocol/sdk`. App no desplegada; el bug es path traversal solo en Windows |
| `tar` `7.5.20` | `apps/angular` › `@angular/cli` › `pacote`. App no desplegada, build-time |
| `body-parser` `1.20.5` | `apps/assistant-portal` › `express`. App no desplegada |
| `dompurify` `3.4.11` | `apps/assistant-portal` › `streamdown` › `mermaid`. App no desplegada |

### Nota sobre `sharp`: la exposición es real y se verificó antes de subir la versión

En una primera lectura este ítem parecía de riesgo bajo, con dos argumentos: `next.config.ts` no tiene bloque `images` (así que Next rechaza URLs remotas) y **ningún componente usa `next/image`**. Ambos son ciertos, pero **la conclusión era falsa**. Probado contra producción:

```
GET /_next/image?url=%2Ficon-1024.png&w=64&q=75   →  200, image/png
```

La ruta `/_next/image` está viva, `middleware.ts:176` la excluye del middleware (no pide sesión) y **procesa por sharp cualquier imagen local del sitio**. Que no haya componentes `<Image>` no apaga el endpoint. El vector queda acotado a ficheros locales —no se puede inyectar una URL remota arbitraria— pero libvips sí recibe entrada por una ruta pública.

Un matiz importante para revisar el PR: **ninguna versión de Next, ni la última (`16.2.12`), ha pasado a `sharp ^0.35`** — todas siguen en `^0.34.x`. Este override va por delante de lo que el propio Next ha validado, y por eso se verificó a mano en vez de confiar en el rango declarado.

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
| Tests unitarios de la API (con el `dist` obsoleto del inicio) | 1966 tests, **1961 pass / 5 fail** |
| **Misma suite sobre las dependencias de `main`** | **1966 / 1961 pass / 5 fail — los mismos 5** ⇒ cero regresiones atribuibles a este cambio |
| Tests unitarios de la API (tras el fix de `test:unit`, desde `dist` borrado) | 1966 tests, **1965 pass / 1 fail** |
| Tests unitarios de la API (tras normalizar el path de `graphify`) | 1966 tests, **1966 pass / 0 fail** ✅ |
| `sharp@0.35.3`: binding nativo | ✅ Carga en la máquina local; libvips `8.18.3` |
| `sharp@0.35.3`: binarios de Linux en el lockfile | ✅ `@img/sharp-linux-x64` y `@img/sharp-linuxmusl-x64` presentes — es lo que necesita el build de Railway |
| `sharp@0.35.3`: las APIs que usa Next | ✅ `sharp()`, `metadata`, `resize`, `rotate`, `trim`, `toBuffer` y `jpeg`/`png`/`webp`/`avif`, ejercitadas contra `apps/web/public/icon-1024.png` |
| `next build` de `apps/web` con `sharp@0.35.3` | ✅ `Compiled successfully`, **403/403 páginas estáticas** |
| Optimizador en runtime, servidor standalone local | ✅ `/_next/image` → 200 `image/png` en `w=64` (2570 B) y `w=256` (9741 B); con `Accept: image/webp` → 200 `image/webp` (3438 B) |

La comparación contra `main` se hizo revirtiendo `package.json` + `pnpm-lock.yaml` con `git stash`, reinstalando con `--frozen-lockfile` y corriendo la suite completa otra vez, para comparar en igualdad de condiciones. Los 5 fallos idénticos en ambos lados confirmaban que el cambio de dependencias no introducía regresiones; después se identificó que 4 de esos 5 eran artefactos de un `dist` sin recompilar (ver hallazgo colateral 2), que afectaban por igual a las dos corridas.

**El fallo restante de `graphify` también se corrigió** (ver hallazgo colateral 3): era un bug del test exclusivo de Windows. Con eso, la suite unitaria de la API queda en **1966/1966**.

## Hallazgos colaterales (no corregidos aquí, valen su propio ticket)

1. **El warning de peer de `@fastify/static` es cosmético — INVESTIGADO Y CERRADO. No quitar el paquete.**
   `pnpm install` avisa: `@nestjs/platform-fastify 11.1.28 → unmet peer @fastify/static@"^8.0.0 || ^9.0.0": found 10.1.2` (lo introdujo el merge de **#429**).

   El warning es engañoso en dos direcciones y conviene dejar el análisis escrito, porque invita a "limpiar" una dependencia que en realidad es obligatoria:

   - **Parece no usarse, pero se usa.** No hay ni una referencia a `@fastify/static` ni a `useStaticAssets` en todo el código del repo, ni en ningún commit del historial. Pero `SwaggerModule.setup("v1/docs", …)` (`apps/api/src/main.ts:141`) lo activa indirectamente: `@nestjs/swagger` detecta el adapter fastify y llama a `app.useStaticAssets()` (`swagger-module.js:104-105`), que a su vez hace `loadPackage('@fastify/static', …)` → `require('@fastify/static')` (`@nestjs/platform-fastify/adapters/fastify-adapter.js:308`). Es un **requisito duro de runtime**: sin el paquete, la API no arranca. **Quitarlo de `dependencies` rompería producción.**
   - **Parece incompatible, pero funciona.** El rango de peer que se queda corto es solo el de `@nestjs/platform-fastify@11.1.28` (`^8.0.0 || ^9.0.0`); `@nestjs/swagger@11.4.6` ya declara `^8.0.0 || ^9.0.0 || ^10.0.0`. `useStaticAssets` se limita a registrar el plugin, y la v10 es compatible para ese uso. **Verificado en producción con la 10.1.2 desplegada: `GET /v1/docs` → 200 y `GET /v1/docs-json` → 200.**

   **Acción recomendada: ninguna.** Esperar a que `@nestjs/platform-fastify` amplíe su rango de peer. Si el warning molesta en CI, la salida limpia es `pnpm.peerDependencyRules.allowedVersions`, nunca borrar el paquete.
2. **`apps/api` `test:unit` no construía antes de correr, y los tests importan del `dist` compilado — CORREGIDO en este PR.**
   Los 4 tests de `changePassword` fallaban con `TypeError: service.changePassword is not a function`. La causa no era el test ni el código de #430: **122 de los 208 archivos de test de la API importan de `../dist/`**, pero `test:unit` solo hacía `node --test …`, sin compilar. Con un `dist` anterior al merge de #430, `AuthService` compilado no tenía todavía el método.

   Es un footgun con nombre y apellido: **`CLAUDE.md:22` documenta `pnpm --filter @semse/api test:unit` como *la* forma de correr los tests de la API**, y ese comando daba falsos negativos contra cualquier `dist` desactualizado. En CI no se notaba por pura suerte de orden: `verify:workspace` corre `railway:preflight` (que construye) antes, y el `test:coverage` de la raíz hace `pnpm build:api` primero.

   **Fix:** `test:unit` de `apps/api` ahora es `pnpm build && node --experimental-strip-types --test …`, el mismo patrón que ya usa el `test:unit` de la raíz (`pnpm build:packages && …`). Verificado borrando `apps/api/dist` por completo: el script reconstruye y la suite pasa **1965/1966**.

   `test:coverage` tiene la misma dependencia latente del `dist`, pero hoy solo se invoca desde el script de la raíz, que ya construye antes. Se deja como está para no duplicar builds.
3. **Test de `graphify` con un path no portable — CORREGIDO en este PR.**
   `graphify.service.test.ts:93` hacía `assert.ok(service.graphPath.endsWith("graphify-out/graph.json"))`, pero el servicio construye la ruta con `resolve(process.cwd(), …)` (`graphify.service.ts:19-21`), que en Windows devuelve separadores `\`. El test solo podía pasar en Linux/macOS.

   **Fix:** comparar contra `join("graphify-out", "graph.json")`, que produce el separador de la plataforma. La aserción conserva su intención (verificar el fallback a la ruta por defecto) y ahora es válida en las tres plataformas.

4. **`scripts/workspace-runner.mjs:42`** usa `spawnSync("pnpm", …)` sin `shell: true`, así que `pnpm typecheck`, `build:packages` y `railway:preflight` **fallan con `ENOENT` en Windows**. En CI (Linux) funciona.
5. **Scripts con sintaxis Unix** que fallan bajo cmd.exe en Windows: `@semse/knowledge` build (`mkdir -p` / `cp`) y `@semse/api` `test:unit` (`$(find …)`).
6. **`apps/assistant-portal/package.json` declara `pnpm.overrides`**, que pnpm ignora con un warning — solo tienen efecto en la raíz del workspace. Es código muerto que da una falsa sensación de estar pinneando algo.

## Cuadre con el conteo de GitHub — RESUELTO

GitHub reportaba **12 alertas (6 high / 2 medium / 4 low)** y `pnpm audit` **11 hallazgos en 10 avisos**. Leídas las alertas por API (`gh api repos/…/dependabot/alerts?state=open`), el cuadre es exacto:

**Las 12 alertas son 10 avisos únicos + 2 duplicados**, y los duplicados salen de un **segundo lockfile**: `project-manager-app/apps/assistant-portal/pnpm-lock.yaml`. Las alertas **#54 (`body-parser`)** y **#55 (`dompurify`)** son literalmente las mismas que **#65** y **#67** del lockfile raíz, contadas otra vez porque Dependabot escanea cada manifiesto por separado.

Las 6 alertas high, y qué hace este PR con cada una:

| Alerta | Paquete | Estado tras este PR |
|---|---|---|
| #70 | `fast-uri` (rama 4.x) | ✅ Cerrada → `4.1.1` |
| #69 | `fast-uri` (rama 3.x) | ✅ Cerrada → `3.1.4` |
| #81 | `find-my-way` | ✅ Cerrada → `9.7.0` |
| #64 | `js-yaml` | ✅ Cerrada → `4.3.0` |
| #68 | `sharp` | ✅ Cerrada → `0.35.3` |
| #85 | `brace-expansion` | ⬜ Se deja a propósito (ver arriba) |

**De 12 alertas quedan 7**: #85 (`brace-expansion`, high), #82 (`tar`) y #66 (`@hono/node-server`) en medium, y las 4 low (`dompurify` y `body-parser`, duplicadas en los dos lockfiles). **Ninguna toca un servicio desplegado.**

### Hallazgo derivado: lockfile anidado en `apps/assistant-portal`

`apps/assistant-portal` **está dentro del workspace** (`pnpm-workspace.yaml` incluye `apps/*`), pero tiene su propio `pnpm-lock.yaml` (312 KB, del 2026-07-18 — 8 días más viejo que el de la raíz). En un workspace pnpm, los paquetes miembro no deben tener lockfile propio: manda el de la raíz.

Consecuencias reales:
- pnpm **ignora** ese lockfile al instalar desde la raíz, así que está muerto y se pudre.
- Dependabot **sí** lo escanea como manifiesto independiente → duplica alertas de forma permanente (las 4 low de arriba son en realidad 2).
- Explica el `pnpm.overrides` huérfano del `package.json` de esa app (hallazgo colateral 6): esa app parece haberse creado como proyecto suelto y luego absorbido en el workspace sin limpiar.

**Sugerencia:** borrar `apps/assistant-portal/pnpm-lock.yaml` y el bloque `pnpm.overrides` de su `package.json`. Eliminaría 2 alertas duplicadas y una fuente estable de ruido. No se hace en este PR por mantener el alcance; la app no se despliega, así que no corre prisa.
