# Dependencias con vulnerabilidades: críticas a 0

**Fecha:** 2026-10-26 · **Rama:** `claude/deps-security-audit` (desde `main` @ `06dfd7b`) · **Origen:** GitHub avisó de 52 alertas de Dependabot en `main` (2 críticas, 23 altas)

## Diagnóstico

`pnpm audit` sobre `main`, que consulta la misma base de avisos que Dependabot, devolvía **4 críticas, 35 altas, 39 moderadas y 14 bajas**. Las que afectan a lo que corre en producción (web y API):

| Paquete | Dónde | Severidad | Problema |
|---|---|---|---|
| `next` 15.5.27 | web | **crítica** | ejecución remota de código sin autenticar en el optimizador de imágenes; DoS con Server Actions |
| `sharp` 0.35.4 | web (vía next) | alta | vulnerabilidad en librsvg |
| `fastify` 5.12.1 | API | alta | evasión de autenticación con URLs malformadas; evasión de validación de cuerpo y cabeceras |
| `fast-uri` 4.1.3 | API (vía fastify) | alta | inyección o confusión de host |
| `follow-redirects` 1.16.0 | API (vía axios) | alta | fuga de credenciales en redirecciones |

El resto de críticas y altas viene de apps secundarias (`apps/angular`, `apps/assistant-portal`), de la CLI de Expo del móvil o de herramientas de test.

## Cambio

Se suben solo versiones de parche dentro de la misma versión mayor, publicadas hace al menos ~10 días:

- `apps/web`: `next` 15.5.27 → **15.5.28** (publicada el 2026-10-14).
- `pnpm.overrides` del `package.json` raíz, el mecanismo que el repo ya usaba para estas fijaciones:
  - `fastify` 5.12.1 → 5.12.2;
  - `fast-uri` 4.1.3 → 4.1.4 y 3.1.6 → 3.1.7;
  - `sharp` 0.35.4 → 0.35.5;
  - `dompurify` 3.4.13 → 3.4.17;
  - `piscina` 5.2.0 → 5.3.2;
  - `brace-expansion` 5.0.9 → 5.0.11;
  - `undici` 6.28.0 → 6.29.1 y 7.29.0 → 7.30.1;
  - nuevos: `follow-redirects` 1.16.1 y `shell-quote` 1.11.0.
- Lockfile regenerado con `pnpm install`. Solo cambian esos paquetes; tres de eslint cambian únicamente el sufijo de dependencias, con la misma versión.

## Resultado

| | Antes | Después |
|---|---|---|
| Críticas | 4 | **0** |
| Altas | 35 | 15 |
| Moderadas | 39 | 30 |
| Bajas | 14 | 8 |

## Verificación

| Prueba | Resultado |
|---|---|
| `pnpm install --frozen-lockfile` (como en CI) | OK |
| `pnpm build:packages`, build de la API y `next build` de la web | OK |
| Tests unitarios de la API | 3579 pass, 8 fail: los `SAT-007`, que necesitan DNS real y no cambian |
| Tests unitarios de la raíz | 1552 pass, 1 fail (`isUrlSafe`, también por DNS) |
| `pnpm lint` y `pnpm typecheck` (todo el workspace) | 0 errores |
| En vivo: API con fastify 5.12.2 y web con next 15.5.28 | `/v1/health` OK; login de cliente, profesional y admin y 9 pantallas sin errores; `/_next/image` responde 200 `image/png` |

## Pendiente (no incluido, con motivo)

- **`zod` <4.6.6** (API, `packages/schemas`, `packages/shared`): el arreglo exige pasar de zod 3 a zod 4, una migración con cambios de API en todos los esquemas. Mientras tanto mitiga el límite de cuerpo de Fastify (1 MB por defecto). Necesita un plan propio.
- **`multer`** 2.3.0 → 2.5.0: la versión corregida se publicó hace 4 días. La API arranca con `FastifyAdapter`, así que el multer que trae `@nestjs/platform-express` no se usa en producción.
- **`body-parser`** 1.20.9: publicada hace 4 días; solo afecta a `apps/assistant-portal`.
- **`apps/angular`** (`@angular/router`, la CLI y su SDK de MCP, `vite`, `source-map-js`, `http-cache-semantics`) y **`node-forge`** de la CLI de Expo: apps secundarias o herramientas de desarrollo. Se pueden actualizar en un PR aparte, o retirar `apps/angular` si ya no se usa.
