# Matriz de pruebas funcionales — roles × idioma × organización

Usada por `semse-functional-test`. Las fichas de cada journey F01–F36 y sus niveles de evidencia siguen viviendo en `semse-business-flow-e2e`; esta matriz sólo fija la **cobertura mínima** que cada flujo con interfaz debe tener antes de declararse listo.

## Actores de prueba

Todos son sintéticos y se crean con `semse-synthetic-test-data` (`TEST_<runId>_…`). Los roles salen de `packages/auth/src/rbac.ts`.

| Actor | Rol | Organización | Uso |
|---|---|---|---|
| `ops_a` | `OPS_ADMIN` | A | administración y Mission Control |
| `client_a` | cliente | A | dueño del proyecto o trabajo |
| `pro_a` | profesional | A | ejecuta, registra horas y sube evidencia |
| `client_b` | cliente | B | **intruso**: debe ver 403/404 sobre todo lo de A |
| `pro_b` | profesional | B | **intruso** en flujos de profesional |

## Cobertura mínima por flujo con UI

| Dimensión | Casos mínimos |
|---|---|
| Rol | camino feliz con cada rol que participa en el flujo |
| Idioma | el camino feliz completo en **ES** y en **EN**: sin claves crudas (`nav.x`), sin mezcla de idiomas y con los mensajes críticos traducidos (errores, permisos, pagos, confirmaciones) |
| Organización | cada lectura y cada escritura del flujo repetida por el intruso de la org B → 403/404, sin datos de A en la respuesta ni en la UI |
| Límites | doble envío, recarga a mitad, sesión expirada, ancho de 390 px |
| Negativos | transición de estado inválida, permiso insuficiente, recurso borrado |

## Estado actual

| Pieza | Estado |
|---|---|
| Specs Playwright existentes | `tests/e2e-semse/*.spec.ts`, por ejemplo `buildops-milestones`, `job-lifecycle-rating`, `dispute-resolution` y `worker-tracker` |
| Tests de claves ES/EN existentes | `tests/unit/operational-panels-i18n.test.ts`, `tests/unit/contributor-i18n-keys.test.ts` |
| Validador de catálogos críticos (`scripts/quality/validate-critical-i18n.ts`, `pnpm quality:i18n`) | **implementado** (fase 3). 12 catálogos y 1373 claves por idioma; 0 errores en el estado actual de `main`. La regla `translated-text-in-state` (aviso) se amplió el 2026-10-21 a ternarios, `??`, objetos, plantillas y `throw new Error(t(…))`: da 40 avisos en 16 archivos sobre `main` y 0 sobre la rama de #1023. Corre en `pnpm test:unit` (`tests/unit/validate-critical-i18n.test.ts`) |
| Spec autenticado ES/EN multirol (`tests/e2e-semse/authenticated-es-en.spec.ts`, `pnpm test:e2e:semse:es-en`) | **implementado** (fase 3). 4/4 en stack local con web en modo producción (2026-10-21, `docs/semse-kit/local-stack.md`). **No** corre en CI: el job `e2e` sólo ejecuta `tests/e2e` |
| Ejecución en preview de Railway | **pendiente** (fase 5 del kit, requiere autorización) |

Cobertura del spec, por ahora: panel de inicio más una ruta por rol (OPS_ADMIN `/admin/mission-control`, cliente `/client/marketplace`, profesional `/worker/dashboard`) en ES → EN → recarga, y aislamiento de trabajos entre dos organizaciones cliente. Faltan el resto de recursos (proyectos, evidencia, pagos) y los casos límite y negativos de la tabla anterior. Un profesional intruso no sirve con trabajos: `POST /v1/jobs` siempre los crea `POSTED`, y por diseño cualquier profesional los ve en el Marketplace (`jobs.repository.ts`, `buildVisibilityWhere`). Para proyectos, `projects:create` sólo lo tiene OPS_ADMIN (`packages/auth/src/rbac.ts`), así que el caso necesita otro diseño, por ejemplo un proyecto creado por OPS_ADMIN y asignado a la org A.

## Hallazgos de la fase 3 (2026-10-21)

| ID | Sev. | Estado | Hallazgo | Evidencia |
|---|---|---|---|---|
| KIT-F3-01 | S2 | reproducido, sin arreglar (desde #1023 se ve como el 403 real en lugar de 503) | El stream en vivo de Mission Control no funciona para nadie. `@Sse("mission-control")` (`apps/api/src/infrastructure/sse/sse.controller.ts`) no declara `@RequirePermissions` y el guard deny-by-default (`apps/api/src/common/rbac.guard.ts`) responde 403 "RBAC metadata required", OPS_ADMIN incluido. La BFF lo muestra como 503 | API: `GET /v1/sse/mission-control` → 403 ×7 con OPS_ADMIN. El spec lo registra como anotación `known-defect`. Elegir el permiso es una decisión RBAC (`semse-rbac-permissions`, `semseproject`) |
| KIT-F3-02 | S3 | **corregido en #1023** (pendiente de CI y merge) | 10 rutas BFF con `fetch` propio (8 streams SSE, el PDF de facturas y `/api/semse/my-bids`) convertían cualquier respuesta no-OK de la API (401, 403, 429) y la falta de sesión en 503 "SEMSE server runtime is not configured", lo que ocultaba errores de autenticación y permisos. Al fusionar #1023 hay que quitar su entrada de `KNOWN_BFF_FAILURES` en el spec: el SSE pasa a responder 403 y el spec lo marcará como `known-defect-fixed?` | `apps/web/app/api/semse/my-bids/route.ts` (`if (!response.ok) return runtimeDisabledResponse()`); 401 de la API visto como 503 en el navegador |
| KIT-F3-03 | S3 | **corregido en #1023** (pendiente de CI y merge) | Texto traducido guardado en el estado de React o lanzado dentro de un `Error`: si falla una carga en ES y el usuario cambia a EN, el error sigue en español. 40 apariciones en 16 archivos (el primer recuento, 12 en 5 páginas, sólo veía la forma `setX(t(…))`) | Visto en vivo: `/client/dashboard` en EN mostraba "No se pudieron cargar los trabajos." (`clientDash.jobsLoadError`). El validador lo reporta como `translated-text-in-state` |
| KIT-F3-04 | — | por comprobar | Con `next dev`, cada ruta compilada tiene su propia caché de tokens de la BFF y se supera el límite de 5/min de `POST /v1/auth/token` (429). Las peticiones siguen sin token y fallan con 401. No se reprodujo con la web en modo producción. Queda por confirmar el valor de `RATE_LIMIT_LIMIT` en Railway, porque el límite global por defecto (20/min por IP) se aplicaría al tráfico BFF → API | API local: 25 respuestas 429 en `/v1/auth/token` en modo dev; 0 en modo producción |
| — | ✔ | positivo | La web en producción rechaza las sesiones de las cuentas demo de la semilla (`isDisabledDemoSession`), aunque el login devuelva `ok` | Login demo → redirección a `/login?expired=1` con `NODE_ENV=production` |
| — | ✔ | positivo | Un cliente de otra organización recibe 403/404 al leer un trabajo ajeno y no lo ve en su lista; el dueño sí lo lee | Caso "aislamiento" del spec, 4/4 |

Esta matriz no declara ningún flujo como verificado. El estado de cada flujo se reporta con el vocabulario de `semse-business-flow-e2e`.
