# SEMSE Anatomy Knowledge Domain — Implementation Report

- Fecha: 2026-04-10
- Objetivo: integrar el dominio vivo `SEMSE Anatomy Knowledge Domain` dentro del monorepo canónico de `SEMSE` y generalizar la arquitectura hacia un ecosistema de dominios maestros con runtime operativo unificado
- Estado: completado sin bloqueantes críticos

## Mapa Inicial Del Repo Relevante

### Fuentes canónicas inspeccionadas

- `/home/yoni/labsemse/repository-rules/CANONICITY.md`
- `/home/yoni/labsemse/project-manager-app/docs/SOURCE_OF_TRUTH.md`
- `/home/yoni/labsemse/agents/README.md`
- `/home/yoni/labsemse/project-manager-app/docs/foundation/DOMAIN_GLOSSARY.md`
- `/home/yoni/labsemse/project-manager-app/docs/architecture/SEMSE_API_SURFACE_V1.md`
- `/home/yoni/labsemse/project-manager-app/package.json`
- `/home/yoni/labsemse/project-manager-app/apps/web/package.json`
- `/home/yoni/labsemse/project-manager-app/apps/api/package.json`

### Rutas canónicas intervenidas

- Contratos: `/home/yoni/labsemse/project-manager-app/packages/schemas/src/`
- Conocimiento reusable: `/home/yoni/labsemse/project-manager-app/packages/knowledge/`
- Segundo dominio piloto: `/home/yoni/labsemse/project-manager-app/packages/knowledge/src/repo/`
- Agentes del dominio: `/home/yoni/labsemse/project-manager-app/packages/agents/src/anatomy.ts`
- Backend: `/home/yoni/labsemse/project-manager-app/apps/api/src/modules/anatomy/`
- UI: `/home/yoni/labsemse/project-manager-app/apps/web/app/anatomy/`
- Proxy web: `/home/yoni/labsemse/project-manager-app/apps/web/app/api/semse/`
- Base documental agentic: `/home/yoni/labsemse/agents/`

### Dependencias reutilizadas

- `@semse/schemas`
- `@semse/agents`
- `@semse/shared`
- `apps/web/app/api/semse/_server.ts`
- `apps/api/src/common/*` para envelopes, request id y validación Zod

## Decisiones Arquitectónicas

1. Se creó `packages/knowledge` porque no existía una capa reusable para seeds, loaders, normalizers y consultas de dominio.
2. Los contratos anatómicos viven en `packages/schemas`, no en tipos locales de apps.
3. El seed anatómico JSON es la fuente de verdad inicial del dominio.
4. Los agentes anatómicos quedaron integrados como agentes server-only del dominio.
   No se mezclaron con el runtime governado de `agentCatalog` para no romper contratos existentes de cola/orquestación.
5. El proxy web recibió un fallback local de bootstrap en desarrollo.
   En `dev`, si faltan env vars de runtime, usa la instancia viva actual del API (`http://127.0.0.1:4132`) y headers demo (`usr_demo`, `tnt_demo`, `org_demo`, `OPS_ADMIN`).
6. Se evitó exponer `anatomy.ts` desde el entrypoint general de `@semse/agents`.
   Eso previno que el frontend arrastrara `node:fs/promises` desde `@semse/knowledge`.
7. Se expuso `@semse/agents/anatomy` como subruta server-only.
   Eso permite imports limpios desde API y tests sin volver a contaminar el bundle web.
8. Se generalizó el patrón con un segundo dominio piloto `semse.repo`.
   Así la arquitectura de `knowledge` ya no depende solo de anatomía para demostrar reutilización.
9. Se extrajo una capa core genérica en `packages/knowledge/src/core`.
   `anatomy`, `repo` y `runtime` ahora comparten mecánica de árbol, relaciones, path a raíz, validación y caché.
10. Se añadió un tercer dominio maestro `semse.runtime`.
    Describe servicios reales, dependencias operativas y probes vivos del ecosistema.
11. Se añadió un hub unificado `knowledge`.
    Expone catálogo de dominios maestros, overview operativo y estado de servicios en una sola superficie.

## Checklist Por Etapa

- [x] Etapa 1 — descubrimiento
- [x] Etapa 2 — schema
- [x] Etapa 3 — seed y conocimiento
- [x] Etapa 4 — agentes
- [x] Etapa 5 — API
- [x] Etapa 6 — UI
- [x] Etapa 7 — documentación
- [x] Etapa 8 — validación final

## Rutas Tocadas

### Schemas

- `/home/yoni/labsemse/project-manager-app/packages/schemas/src/anatomy-node.schema.ts`
- `/home/yoni/labsemse/project-manager-app/packages/schemas/src/anatomy-relation.schema.ts`
- `/home/yoni/labsemse/project-manager-app/packages/schemas/src/anatomy-tree.schema.ts`
- `/home/yoni/labsemse/project-manager-app/packages/schemas/src/anatomy-query.schema.ts`
- `/home/yoni/labsemse/project-manager-app/packages/schemas/src/repo-node.schema.ts`
- `/home/yoni/labsemse/project-manager-app/packages/schemas/src/repo-relation.schema.ts`
- `/home/yoni/labsemse/project-manager-app/packages/schemas/src/repo-tree.schema.ts`
- `/home/yoni/labsemse/project-manager-app/packages/schemas/src/repo-query.schema.ts`
- `/home/yoni/labsemse/project-manager-app/packages/schemas/src/runtime-node.schema.ts`
- `/home/yoni/labsemse/project-manager-app/packages/schemas/src/runtime-relation.schema.ts`
- `/home/yoni/labsemse/project-manager-app/packages/schemas/src/runtime-tree.schema.ts`
- `/home/yoni/labsemse/project-manager-app/packages/schemas/src/runtime-query.schema.ts`
- `/home/yoni/labsemse/project-manager-app/packages/schemas/src/knowledge-domain.schema.ts`
- `/home/yoni/labsemse/project-manager-app/packages/schemas/src/index.ts`

### Knowledge

- `/home/yoni/labsemse/project-manager-app/packages/knowledge/package.json`
- `/home/yoni/labsemse/project-manager-app/packages/knowledge/tsconfig.json`
- `/home/yoni/labsemse/project-manager-app/packages/knowledge/README.md`
- `/home/yoni/labsemse/project-manager-app/packages/knowledge/src/index.ts`
- `/home/yoni/labsemse/project-manager-app/packages/knowledge/src/core/index.ts`
- `/home/yoni/labsemse/project-manager-app/packages/knowledge/src/core/knowledge-base.ts`
- `/home/yoni/labsemse/project-manager-app/packages/knowledge/src/core/domain-registry.ts`
- `/home/yoni/labsemse/project-manager-app/packages/knowledge/src/anatomy/index.ts`
- `/home/yoni/labsemse/project-manager-app/packages/knowledge/src/anatomy/loaders/anatomy.loader.ts`
- `/home/yoni/labsemse/project-manager-app/packages/knowledge/src/anatomy/normalizers/anatomy.normalizer.ts`
- `/home/yoni/labsemse/project-manager-app/packages/knowledge/src/anatomy/queries/anatomy.queries.ts`
- `/home/yoni/labsemse/project-manager-app/packages/knowledge/src/anatomy/seed/anatomy.seed.json`
- `/home/yoni/labsemse/project-manager-app/packages/knowledge/src/repo/index.ts`
- `/home/yoni/labsemse/project-manager-app/packages/knowledge/src/repo/loaders/repo.loader.ts`
- `/home/yoni/labsemse/project-manager-app/packages/knowledge/src/repo/normalizers/repo.normalizer.ts`
- `/home/yoni/labsemse/project-manager-app/packages/knowledge/src/repo/queries/repo.queries.ts`
- `/home/yoni/labsemse/project-manager-app/packages/knowledge/src/repo/seed/repo.seed.json`
- `/home/yoni/labsemse/project-manager-app/packages/knowledge/src/runtime/index.ts`
- `/home/yoni/labsemse/project-manager-app/packages/knowledge/src/runtime/loaders/runtime.loader.ts`
- `/home/yoni/labsemse/project-manager-app/packages/knowledge/src/runtime/normalizers/runtime.normalizer.ts`
- `/home/yoni/labsemse/project-manager-app/packages/knowledge/src/runtime/queries/runtime.queries.ts`
- `/home/yoni/labsemse/project-manager-app/packages/knowledge/src/runtime/seed/runtime.seed.json`

### Agents

- `/home/yoni/labsemse/project-manager-app/packages/agents/src/anatomy.ts`
- `/home/yoni/labsemse/project-manager-app/packages/agents/src/master-domains.ts`
- `/home/yoni/labsemse/project-manager-app/packages/agents/src/index.ts`
- `/home/yoni/labsemse/project-manager-app/packages/agents/package.json`

### API

- `/home/yoni/labsemse/project-manager-app/apps/api/src/modules/anatomy/anatomy.module.ts`
- `/home/yoni/labsemse/project-manager-app/apps/api/src/modules/anatomy/anatomy.controller.ts`
- `/home/yoni/labsemse/project-manager-app/apps/api/src/modules/anatomy/anatomy.service.ts`
- `/home/yoni/labsemse/project-manager-app/apps/api/src/modules/repo-knowledge/repo-knowledge.module.ts`
- `/home/yoni/labsemse/project-manager-app/apps/api/src/modules/repo-knowledge/repo-knowledge.controller.ts`
- `/home/yoni/labsemse/project-manager-app/apps/api/src/modules/repo-knowledge/repo-knowledge.service.ts`
- `/home/yoni/labsemse/project-manager-app/apps/api/src/modules/runtime-knowledge/runtime-knowledge.module.ts`
- `/home/yoni/labsemse/project-manager-app/apps/api/src/modules/runtime-knowledge/runtime-knowledge.controller.ts`
- `/home/yoni/labsemse/project-manager-app/apps/api/src/modules/runtime-knowledge/runtime-knowledge.service.ts`
- `/home/yoni/labsemse/project-manager-app/apps/api/src/modules/knowledge/knowledge.module.ts`
- `/home/yoni/labsemse/project-manager-app/apps/api/src/modules/knowledge/knowledge.controller.ts`
- `/home/yoni/labsemse/project-manager-app/apps/api/src/modules/knowledge/knowledge.service.ts`
- `/home/yoni/labsemse/project-manager-app/apps/api/src/app.module.ts`
- `/home/yoni/labsemse/project-manager-app/apps/api/src/common/domain-store.ts`
- `/home/yoni/labsemse/project-manager-app/apps/api/src/modules/agents/agents.service.ts`
- `/home/yoni/labsemse/project-manager-app/apps/api/src/modules/domain-events/domain-events.module.ts`

### Web

- `/home/yoni/labsemse/project-manager-app/apps/web/app/anatomy/page.tsx`
- `/home/yoni/labsemse/project-manager-app/apps/web/app/anatomy/anatomy-client.tsx`
- `/home/yoni/labsemse/project-manager-app/apps/web/app/repo-map/page.tsx`
- `/home/yoni/labsemse/project-manager-app/apps/web/app/repo-map/repo-map-client.tsx`
- `/home/yoni/labsemse/project-manager-app/apps/web/app/runtime-map/page.tsx`
- `/home/yoni/labsemse/project-manager-app/apps/web/app/runtime-map/runtime-map-client.tsx`
- `/home/yoni/labsemse/project-manager-app/apps/web/app/knowledge/page.tsx`
- `/home/yoni/labsemse/project-manager-app/apps/web/app/knowledge/knowledge-client.tsx`
- `/home/yoni/labsemse/project-manager-app/apps/web/app/api/semse/anatomy/tree/route.ts`
- `/home/yoni/labsemse/project-manager-app/apps/web/app/api/semse/anatomy/node/[id]/route.ts`
- `/home/yoni/labsemse/project-manager-app/apps/web/app/api/semse/anatomy/children/[id]/route.ts`
- `/home/yoni/labsemse/project-manager-app/apps/web/app/api/semse/anatomy/relations/[id]/route.ts`
- `/home/yoni/labsemse/project-manager-app/apps/web/app/api/semse/anatomy/query/route.ts`
- `/home/yoni/labsemse/project-manager-app/apps/web/app/api/semse/repo-knowledge/tree/route.ts`
- `/home/yoni/labsemse/project-manager-app/apps/web/app/api/semse/repo-knowledge/node/[id]/route.ts`
- `/home/yoni/labsemse/project-manager-app/apps/web/app/api/semse/repo-knowledge/children/[id]/route.ts`
- `/home/yoni/labsemse/project-manager-app/apps/web/app/api/semse/repo-knowledge/relations/[id]/route.ts`
- `/home/yoni/labsemse/project-manager-app/apps/web/app/api/semse/repo-knowledge/query/route.ts`
- `/home/yoni/labsemse/project-manager-app/apps/web/app/api/semse/runtime-knowledge/tree/route.ts`
- `/home/yoni/labsemse/project-manager-app/apps/web/app/api/semse/runtime-knowledge/node/[id]/route.ts`
- `/home/yoni/labsemse/project-manager-app/apps/web/app/api/semse/runtime-knowledge/children/[id]/route.ts`
- `/home/yoni/labsemse/project-manager-app/apps/web/app/api/semse/runtime-knowledge/relations/[id]/route.ts`
- `/home/yoni/labsemse/project-manager-app/apps/web/app/api/semse/runtime-knowledge/query/route.ts`
- `/home/yoni/labsemse/project-manager-app/apps/web/app/api/semse/runtime-knowledge/status/route.ts`
- `/home/yoni/labsemse/project-manager-app/apps/web/app/api/semse/knowledge/domains/route.ts`
- `/home/yoni/labsemse/project-manager-app/apps/web/app/api/semse/knowledge/overview/route.ts`
- `/home/yoni/labsemse/project-manager-app/apps/web/app/api/semse/_server.ts`

### Docs

- `/home/yoni/labsemse/agents/foundations/anatomy-domain.md`
- `/home/yoni/labsemse/agents/memory/anatomy-knowledge-model.md`
- `/home/yoni/labsemse/agents/logic/anatomy-reasoning-rules.md`
- `/home/yoni/labsemse/agents/agent-runtime/anatomy-agent-runtime-spec.md`
- `/home/yoni/labsemse/project-manager-app/docs/foundation/ANATOMY_DOMAIN_README.md`

### Tests

- `/home/yoni/labsemse/project-manager-app/tests/unit/anatomy-knowledge.test.ts`
- `/home/yoni/labsemse/project-manager-app/tests/unit/repo-knowledge.test.ts`
- `/home/yoni/labsemse/project-manager-app/tests/unit/runtime-knowledge.test.ts`
- `/home/yoni/labsemse/project-manager-app/apps/api/test/anatomy.service.test.ts`
- `/home/yoni/labsemse/project-manager-app/apps/api/test/anatomy.controller.test.ts`
- `/home/yoni/labsemse/project-manager-app/apps/api/test/repo-knowledge.service.test.ts`
- `/home/yoni/labsemse/project-manager-app/apps/api/test/repo-knowledge.controller.test.ts`
- `/home/yoni/labsemse/project-manager-app/apps/api/test/runtime-knowledge.service.test.ts`
- `/home/yoni/labsemse/project-manager-app/apps/api/test/runtime-knowledge.controller.test.ts`
- `/home/yoni/labsemse/project-manager-app/apps/api/test/knowledge.service.test.ts`
- `/home/yoni/labsemse/project-manager-app/apps/api/test/knowledge.controller.test.ts`

## Validaciones Ejecutadas

### Build y lint

- `npm run build --workspace @semse/schemas` -> OK
- `npm run build --workspace @semse/knowledge` -> OK
- `npm run build --workspace @semse/agents` -> OK
- `npm run build --workspace @semse/api` -> OK
- `npm run build --workspace @semse/web` -> OK
- `npm run lint --workspace @semse/api` -> OK
- `npm run lint --workspace @semse/web` -> OK

### Tests

- `node --experimental-strip-types --test --test-reporter spec tests/unit/anatomy-knowledge.test.ts` -> OK
- `node --experimental-strip-types --test --test-reporter spec tests/unit/anatomy-knowledge.test.ts tests/unit/repo-knowledge.test.ts` -> OK
- `node --experimental-strip-types --test --test-reporter spec apps/api/test/anatomy.service.test.ts apps/api/test/anatomy.controller.test.ts` -> OK
- `node --experimental-strip-types --test --test-reporter spec apps/api/test/repo-knowledge.service.test.ts apps/api/test/repo-knowledge.controller.test.ts` -> OK
- `node --experimental-strip-types --test --test-reporter spec tests/unit/runtime-knowledge.test.ts` -> OK
- `node --experimental-strip-types --test --test-reporter spec apps/api/test/runtime-knowledge.service.test.ts apps/api/test/runtime-knowledge.controller.test.ts apps/api/test/knowledge.service.test.ts apps/api/test/knowledge.controller.test.ts` -> OK
- `npm run test:unit` -> OK

### Runtime API

- `GET http://127.0.0.1:4121/v1/health` -> `200 OK`
- `GET http://127.0.0.1:4121/v1/anatomy/tree` -> `200 OK`
- `GET http://127.0.0.1:4121/v1/anatomy/node/mouth` -> `200 OK`
- `GET http://127.0.0.1:4121/v1/anatomy/relations/mouth` -> `200 OK`
- `POST http://127.0.0.1:4121/v1/anatomy/validate` -> `valid: true`
- `GET http://127.0.0.1:4121/v1/repo-knowledge/tree` -> `200 OK`
- `POST http://127.0.0.1:4121/v1/repo-knowledge/query` -> `200 OK`
- `GET http://127.0.0.1:4132/v1/runtime-knowledge/tree` -> `200 OK`
- `GET http://127.0.0.1:4132/v1/runtime-knowledge/status` -> `200 OK`
- `GET http://127.0.0.1:4132/v1/knowledge/overview` -> `200 OK`

### Queries de aceptación verificadas

- `que compone la boca` -> resuelve `mouth` con hijos `tongue`, `teeth`, `epithelial_tissue`
- `ruta desde cuerpo hasta lengua` -> resuelve `tongue` con path `body > head > face > mouth > tongue`
- `partes de la mano` -> resuelve `hand` con hijo `fingers`
- `que pertenece a la cara` -> resuelve `face` con hijos `mouth` y `nose`
- `diferencia entre region y unidad funcional` -> respuesta conceptual explícita con ejemplos `Head` y `Mouth`

### Segundo dominio piloto verificado

- `semse.repo` carga desde seed propia
- `packages_knowledge` resuelve path `semse_root > project_manager_app > packages_knowledge`
- `project_manager_app` enumera `apps_api`, `apps_web`, `packages_schemas`, `packages_knowledge` y `packages_agents`

### Tercer dominio maestro verificado

- `semse.runtime` carga desde seed propia
- `semse_runtime` enumera `api_service`, `web_service`, `worker_service`, `postgres_service`, `redis_service`, `minio_service` y `mailhog_service`
- `knowledge overview` consolida 3 dominios y 7 servicios
- El runtime vivo reporta 6 servicios `online` y 1 `unknown` (`worker_service`) en la instancia actual

### Runtime Web

- `GET http://127.0.0.1:3000/anatomy` -> `200 OK`
- `GET http://127.0.0.1:3000/api/semse/anatomy/tree` -> proxy funcional con datos del dominio
- El HTML servido contiene `SEMSE Anatomy Knowledge Domain` y `Anatomy Knowledge Map`
- `GET http://127.0.0.1:3001/repo-map` -> `200 OK` en runtime dev
- `GET http://127.0.0.1:3001/api/semse/repo-knowledge/tree` -> proxy funcional con `semse_root` y hijos canónicos
- `GET http://127.0.0.1:3001/knowledge` -> `200 OK`
- `GET http://127.0.0.1:3001/runtime-map` -> `200 OK`
- `GET http://127.0.0.1:3001/api/semse/knowledge/overview` -> validado contra el runtime actualizado durante la rotación de fallback
- `GET http://127.0.0.1:3001/api/semse/runtime-knowledge/status` -> validado contra el runtime actualizado durante la rotación de fallback
- La validacion viva de `/repo-map` se apoya en HTTP `200` y en el proxy de datos.
  No se uso inspeccion HTML como criterio fuerte porque la vista hidrata en cliente.

## Problemas Detectados Y Soluciones

### Problema 1

- Descripción: el tutor anatómico resolvía consultas en lenguaje natural demasiado difusas hacia `body`.
- Impacto: degradaba las queries de aceptación.
- Solución: se priorizaron exact matches por token y se añadió una rama conceptual para consultas sobre tipos de nodo.

### Problema 2

- Descripción: `@semse/agents` exportaba `anatomy.ts` desde su `index`, y el frontend intentaba bundlear `node:fs/promises`.
- Impacto: rompía compilación de Next al tocar rutas server/client que importan `@semse/agents`.
- Solución: se sacó `anatomy.ts` del entrypoint compartido y la API consume la ruta server-only explícita `packages/agents/dist/anatomy.js`.

### Problema 3

- Descripción: el proxy web anatómico devolvía `503` porque `dev:web` no inyecta `SEMSE_API_BASE_URL` ni identidad.
- Impacto: la UI renderizaba, pero no podía consultar el dominio vivo.
- Solución: se añadió fallback local de bootstrap en desarrollo dentro de `apps/web/app/api/semse/_server.ts`.

### Problema 4

- Descripción: mezclar agentes anatómicos con el catálogo governado de runtime rompía `build:api`.
- Impacto: conflicto con contratos existentes de cola, trigger router y endpoints de agentes.
- Solución: los agentes anatómicos quedaron como catálogo propio del dominio, fuera de `agentCatalog` y del schema runtime general.

### Problema 5

- Descripción: la primera integración usaba imports frágiles hacia `packages/*/dist`.
- Impacto: acoplamiento innecesario a artefactos de build y menor claridad arquitectónica.
- Solución: `@semse/knowledge` se consume ya como paquete y se añadió la subruta `@semse/agents/anatomy` para consumers server-only.

### Problema 6

- Descripción: la arquitectura de knowledge estaba validada solo sobre un dominio.
- Impacto: riesgo de sobreajuste al caso anatómico.
- Solución: se añadió el segundo dominio piloto `semse.repo` con contratos, seed, queries y pruebas propias.

### Problema 7

- Descripción: al reiniciar el runtime API tras integrar `repo-knowledge` apareció un ciclo ESM entre `Jobs`, `DomainEvents`, `Agents` y `Projects`.
- Impacto: la API no levantaba y bloqueaba la validación viva del segundo dominio.
- Solución: se reforzó `DomainEventsModule` con `forwardRef(() => AgentsModule)` para cortar la inicialización circular sin alterar el grafo funcional del backend.

### Problema 8

- Descripción: `anatomy` y `repo` repetían la misma lógica de árbol, búsqueda, relaciones, validación y caché.
- Impacto: alto acoplamiento y riesgo de divergencia al escalar a más dominios maestros.
- Solución: se extrajo `packages/knowledge/src/core` y se refactorizaron los dominios existentes a una base genérica reusable.

### Problema 9

- Descripción: faltaba una capa maestra que conectara dominios de conocimiento con el runtime operativo real.
- Impacto: el ecosistema tenía slices aislados pero no una vista unificada de evolución y operación.
- Solución: se añadieron el dominio `semse.runtime`, el agente `master-domains`, el módulo API `knowledge` y la UI `/knowledge`.

### Problema 10

- Descripción: el proxy web de desarrollo seguía apuntando a una instancia vieja del API y el overview operativo heredaba targets obsoletos.
- Impacto: las nuevas superficies `/knowledge` y `/runtime-map` quedaban desalineadas respecto al runtime vivo.
- Solución: se actualizó el fallback local del proxy a `4132`, se corrigió el probe dinámico del `api_service` y se ajustó el target ligero del `web_service`.

### Problema 11

- Descripción: el dev server largo de Next en `3001` arrastra estado incremental de `.next` y puede resolver algunas rutas nuevas de proxy con chunks obsoletos.
- Impacto: la validación directa del proxy `knowledge/runtime` en esa instancia puede ser intermitente aunque `build:web` pase.
- Solución: se validó el flujo por API real en `4132`, se dejó el `healthz` ligero del web y se documentó que la instancia dev existente debe reiniciarse fuera de este sandbox para tomar el grafo completo de chunks sin residuos.

## Limitaciones No Bloqueantes

- El runtime anatómico sigue siendo server-only por diseño.
  La subruta `@semse/agents/anatomy` no debe ser importada desde componentes cliente ni desde el entrypoint público general de `@semse/agents`.
- La instancia dev antigua del frontend en `3001` necesita reinicio limpio para absorber de forma consistente todos los nuevos route chunks de `knowledge` y `runtime`.
  La integridad del código quedó verificada por `build:web`; la limitación es del proceso dev largo ya existente, no del artefacto compilado.

## Estado Final

- Schemas anatómicos: listos y validados
- Schemas `semse.repo`: listos y validados
- Schemas `semse.runtime` y `knowledge`: listos y validados
- Seed anatómico: listo y cargando
- Seed `semse.repo`: listo y cargando
- Seed `semse.runtime`: listo y cargando
- Queries base: listas
- Agentes anatómicos: listos como server-only domain agents
- Agente `master-domains`: listo como router server-only entre dominios maestros
- Cobertura directa API anatomy: lista
- API anatómica: operativa
- API `semse.repo`: operativa
- API `semse.runtime`: operativa
- API `knowledge`: operativa
- UI `/anatomy`: operativa
- UI `/repo-map`: operativa
- UI `/runtime-map`: operativa
- UI `/knowledge`: operativa
- Proxy web anatómico: operativo en local dev
- Proxy web `repo-knowledge`: operativo en local dev
- Proxy web `runtime-knowledge`: validado en código y build; la instancia dev larga actual requiere reinicio limpio para estabilidad total
- Proxy web `knowledge`: validado en código y build; la instancia dev larga actual requiere reinicio limpio para estabilidad total
- Runtime vivo actual: API en `4132`, web en `3001`, Postgres `5433`, Redis `6379`, MinIO `9001`, MailHog `8025`
- Documentación: actualizada
- Reporte operativo: completo

## Definición De Done Alcanzada

- [x] Los schemas existen y validan
- [x] El seed anatómico existe y carga
- [x] Los agentes anatómicos compilan
- [x] La API responde
- [x] La UI básica funciona
- [x] Las pruebas mínimas pasan
- [x] La documentación fue actualizada
- [x] El reporte operativo quedó completo
- [x] No quedan TODOs críticos abiertos dentro del alcance
