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
| Spec autenticado ES/EN multirol (`tests/e2e-semse/authenticated-es-en.spec.ts`) | **pendiente** (fase 3 del kit) |
| Validador de catálogos críticos (`scripts/quality/validate-critical-i18n.ts`) | **pendiente** (fase 3 del kit) |
| Ejecución en preview de Railway | **pendiente** (fase 5 del kit, requiere autorización) |

Esta matriz no declara ningún flujo como verificado. El estado de cada flujo se reporta con el vocabulario de `semse-business-flow-e2e`.
