# CANONICAL — Tronco oficial de SEMSEproject

> Esta carpeta es la base canónica de evolución técnica de SEMSEproject.
> Todo desarrollo estructural nuevo debe aterrizar aquí:
> `apps/web`, `apps/api`, `apps/worker`, `packages/*`.
>
> Relación con el resto de `labsemse`:
> - `src/` = referencia UX transicional
> - `vision/` = fuente oficial de visión
> - `program/` = fuente oficial de ejecución
> - ramas paralelas = extracción controlada, no desarrollo directo
>
> Antes de contribuir, leer `repository-rules/CANONICITY.md`, `repository-rules/MIGRATION_RULES.md` y `repository-rules/CONTRIBUTING.md` en la raíz de `labsemse`.

---

# Gestor de Proyectos Pro

Aplicación web local para gestión de proyectos, sin dependencias de runtime.

## Evolución a SEMSEproject

Este repositorio ya tiene una base funcional (UI + validaciones + tests + CI).  
Para evolucionarlo a **SEMSEproject (ConTech + Marketplace + FSM + Evidence + Escrow + Trust)** se documentó el blueprint en:

- [docs/architecture/SEMSEPROJECT_BLUEPRINT.md](/home/yoni/labsemse/project-manager-app/docs/architecture/SEMSEPROJECT_BLUEPRINT.md)
- [docs/architecture/SEMSE_IMPLEMENTATION_BACKLOG.md](/home/yoni/labsemse/project-manager-app/docs/architecture/SEMSE_IMPLEMENTATION_BACKLOG.md)
- [docs/architecture/SEMSE_API_SURFACE_V1.md](/home/yoni/labsemse/project-manager-app/docs/architecture/SEMSE_API_SURFACE_V1.md)
- [docs/security/SECURITY_BASELINE.md](/home/yoni/labsemse/project-manager-app/docs/security/SECURITY_BASELINE.md)
- [docs/runbooks/LOCAL_BOOTSTRAP.md](/home/yoni/labsemse/project-manager-app/docs/runbooks/LOCAL_BOOTSTRAP.md)
- [docs/runbooks/AGENTS_SMOKE_TEST.md](/home/yoni/labsemse/project-manager-app/docs/runbooks/AGENTS_SMOKE_TEST.md)
- [docs/runbooks/API_INTEGRATION_TEST.md](/home/yoni/labsemse/project-manager-app/docs/runbooks/API_INTEGRATION_TEST.md)
- [docs/runbooks/LOCAL_LLM_OLLAMA.md](/home/yoni/labsemse/project-manager-app/docs/runbooks/LOCAL_LLM_OLLAMA.md)
- [infra/docker/compose.semse-mvp.yml](/home/yoni/labsemse/project-manager-app/infra/docker/compose.semse-mvp.yml)

Nota operativa LLM local:
- para autonomía útil, el baseline recomendado ya no es `llama3.2:1b`
- usar `qwen2.5:3b` con `npm run dev:api:local-llm` o `npm run start:api:local-llm`

### Avance técnico Fase 0 ya agregado

- Estructura monorepo preparada:
  - `apps/web`, `apps/api`, `apps/worker`
  - `packages/ui`, `packages/shared`, `packages/schemas`, `packages/db`, `packages/auth`, `packages/agents`
- API base en NestJS (scaffold):
  - [`apps/api/src/main.ts`](/home/yoni/labsemse/project-manager-app/apps/api/src/main.ts)
  - [`apps/api/src/app.module.ts`](/home/yoni/labsemse/project-manager-app/apps/api/src/app.module.ts)
  - Controladores `v1`: health, auth, jobs, bids, projects, milestones, evidence, payments/escrow, disputes, ops, agents.
- Worker base ejecutable:
  - [`apps/worker/src/main.mjs`](/home/yoni/labsemse/project-manager-app/apps/worker/src/main.mjs) con ciclo `claim -> heartbeat -> complete/fail`.
- Modelo de datos base Prisma:
  - [`packages/db/prisma/schema.prisma`](/home/yoni/labsemse/project-manager-app/packages/db/prisma/schema.prisma)
- Contratos Zod iniciales:
  - [`packages/schemas/src/index.ts`](/home/yoni/labsemse/project-manager-app/packages/schemas/src/index.ts)

### Boot de infraestructura local (SEMSE MVP)

```bash
docker compose -f infra/docker/compose.semse-mvp.yml up -d
```

### API scaffold: contexto y permisos por headers (temporal)

Mientras se integra auth real, el scaffold de `apps/api` resuelve actor/tenant desde headers:
- `x-user-id`
- `x-tenant-id`
- `x-org-id`
- `x-roles` (CSV, por ejemplo: `OPS_ADMIN`, `CLIENT,PRO` o `WORKER`)
- `x-idempotency-key` (opcional, para deduplicar `POST /v1/agents/runs`)

## Badges

Configurados para `Samuelcastella/project-manager-app`:

[![CI](https://github.com/Samuelcastella/project-manager-app/actions/workflows/ci.yml/badge.svg)](https://github.com/Samuelcastella/project-manager-app/actions/workflows/ci.yml)
[![codecov](https://codecov.io/gh/Samuelcastella/project-manager-app/graph/badge.svg)](https://codecov.io/gh/Samuelcastella/project-manager-app)

## Funcionalidades

- Crear y editar proyectos.
- Campos: nombre, responsable, estado, prioridad, fecha, presupuesto, etiquetas y descripción.
- Vista lista, kanban y calendario mensual.
- Indicadores de urgencia en calendario (vencido / próximo a vencer).
- Métricas en tiempo real: total, en progreso, vencidos y % completado.
- Métricas financieras: presupuesto total y por estado.
- Ranking de presupuesto por responsable.
- Filtros avanzados (texto, estado, prioridad, responsable) y ordenamiento.
- Filtros avanzados (texto, estado, prioridad, responsable, etiqueta, presupuesto min/max) y ordenamiento.
- Recordar filtros automáticamente por vista.
- Presets de filtros guardados en `localStorage` (asociados por vista).
- Duplicar proyecto en un clic desde la tarjeta.
- Export/import de backup completo (`proyectos + presets + filtros por vista`).
- Deshacer última acción (botón + Ctrl/Cmd+Z).
- Confirmación antes de sobrescribir configuración al importar backup completo.
- Atajos de teclado (`/`, `n`, `Esc`, `l`, `k`, `c`, `?`, `h`) + modal de ayuda de atajos.
- Cambio rápido de estado.
- Eliminación individual y limpieza masiva de completados.
- Exportar e importar proyectos en JSON.
- Persistencia con `localStorage`.

## Mejores prácticas aplicadas

- Validación de datos antes de crear/editar.
- Normalización de datos importados y lectura de versiones antiguas de storage.
- Confirmación explícita para acciones destructivas.
- Mensajes accesibles en vivo (`aria-live`) para feedback de estado.
- Manejo seguro de errores de JSON y almacenamiento.
- `debounce` en filtros de texto para mejor rendimiento.
- Lógica estructurada por funciones pequeñas y reutilizables.

## Tests automatizados

### Unitarios (Node test runner)

```bash
npm run test:unit
```

### Cobertura con c8 (con umbrales)

```bash
npm run coverage
# o:
npm run test:coverage
```

### Pipeline local equivalente a CI

```bash
npm run test:ci
```

### Verificación estructural del workspace

```bash
npm run verify:workspace
```

Este comando ejecuta:

- `typecheck` de `apps/api` y `apps/web`
- tests unitarios de `@semse/api`
- `build:api`
- `build:web`

Umbrales mínimos configurados:
- `lines >= 90%`
- `functions >= 85%`
- `statements >= 90%`
- `branches >= 85%`

Cobertura actual:
- `apps/api/src/**`
- ciclo de auth token y password reset
- validación de env y zod input
- métricas y observabilidad base

### E2E (Playwright)

```bash
npm run test:e2e
```

Escenarios actuales:
- Crear proyecto y verificar render en lista.
- Cambiar a vista kanban y mover estado con acción rápida.
- Validar atajos de teclado (`/` y `n`).
- Guardar y aplicar preset de filtros.
- Calcular métricas financieras y ranking por responsable.
- Mostrar proyectos en vista calendario por fecha límite.
- Resaltar celdas de calendario próximas a vencer.
- Recordar filtros distintos entre lista y kanban.
- Importar backup completo con configuración de usuario.
- Deshacer eliminación de proyecto.
- Cobertura unitaria de normalización de backup/presets/filtros.

Si es la primera vez:

```bash
npm install
npx playwright install chromium
```

## CI

Se agregó pipeline en [`.github/workflows/ci.yml`](/home/yoni/labsemse/project-manager-app/.github/workflows/ci.yml) con jobs de calidad y cobertura:
- `quality-gates`: ejecuta `lint` API/web, tests unitarios API, `build:api` y `tsc --noEmit` del web.
- `unit-coverage`: ejecuta `npm run test:coverage` sobre `@semse/api`, valida umbrales y publica resumen de cobertura en el run.
- `e2e`: ejecuta Playwright (`chromium`) con `npm run test:e2e` y sube artefactos para debugging.
- Smoke API de agentes en [`.github/workflows/api-smoke.yml`](/home/yoni/labsemse/project-manager-app/.github/workflows/api-smoke.yml):
  levanta `apps/api` y ejecuta `scripts/agent-flow-smoke.sh` (manual y en cambios relevantes).
- Integración API de dominio en [`.github/workflows/api-integration.yml`](/home/yoni/labsemse/project-manager-app/.github/workflows/api-integration.yml):
  levanta `apps/api` y ejecuta `node scripts/api-integration.mjs`.
- Verificación BCP + API de operación asistida en [`.github/workflows/operacion-asistida-api.yml`](/home/yoni/labsemse/project-manager-app/.github/workflows/operacion-asistida-api.yml):
  levanta `postgres` y `redis`, construye `apps/api`, ejecuta `npm run verify:operacion-asistida:api-local`,
  `npm run review:operacion-asistida:risk` y `npm run drill:operacion-asistida:restore`.
  El cierre operativo completo del módulo queda disponible además con `npm run verify:operacion-asistida:module`.

### Reporte externo de cobertura (Codecov)

- Se agregó configuración en [codecov.yml](/home/yoni/labsemse/project-manager-app/codecov.yml).
- El workflow sube `coverage/lcov.info` a Codecov en cada ejecución.
- Si tu repositorio es privado, define el secret `CODECOV_TOKEN` en GitHub:
  `Settings -> Secrets and variables -> Actions -> New repository secret`.
- Si es público, el token suele no ser necesario (puedes dejarlo vacío).

### Mantenimiento automático de dependencias

- Se agregó [`.github/dependabot.yml`](/home/yoni/labsemse/project-manager-app/.github/dependabot.yml).
- Dependabot revisa semanalmente:
  - Dependencias `npm`.
  - Versiones de `GitHub Actions`.

## Releases

- Se agregó workflow de release en [`.github/workflows/release.yml`](/home/yoni/labsemse/project-manager-app/.github/workflows/release.yml).
- Al hacer push de un tag `v*.*.*`, el pipeline:
  - Ejecuta la suite completa (`npm run test:ci`).
  - Crea un GitHub Release automático con notas generadas.

Comandos para versionar:

```bash
npm run release:patch   # v1.0.0 -> v1.0.1
npm run release:minor   # v1.0.0 -> v1.1.0
npm run release:major   # v1.0.0 -> v2.0.0
git push --follow-tags
```

## Publicar en GitHub

Si aún no publicaste el repo remoto:

```bash
cd /home/yoni/labsemse/project-manager-app
git init
git add .
git commit -m "feat: project manager app with tests and CI"
git branch -M main
git remote add origin git@github.com:Samuelcastella/project-manager-app.git
git push -u origin main
```

## Ejecutar app

Abre `index.html` en tu navegador.

## Gestión del proyecto

- Changelog: [CHANGELOG.md](/home/yoni/labsemse/project-manager-app/CHANGELOG.md)
- Roadmap: [ROADMAP.md](/home/yoni/labsemse/project-manager-app/ROADMAP.md)
- Plantilla de PR: [pull_request_template.md](/home/yoni/labsemse/project-manager-app/.github/pull_request_template.md)
