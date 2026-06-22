# Project Manager App — Construction Finance Platform

**Status:** ✅ Production Ready | **Version:** 1.0.0

---

## 🚀 Quick Start (5 minutes)

<<<<<<< HEAD
### Prerequisites
- Node 18+
- Docker
- PostgreSQL 14+
=======
Aplicación web local para gestión de proyectos, sin dependencias de runtime.

## Evolución a SEMSEproject

Este repositorio ya tiene una base funcional (UI + validaciones + tests + CI).  
Para evolucionarlo a **SEMSEproject (ConTech + Marketplace + FSM + Evidence + Escrow + Trust)** se documentó el blueprint en:

- [docs/architecture/SEMSEPROJECT_BLUEPRINT.md](docs/architecture/SEMSEPROJECT_BLUEPRINT.md)
- [docs/architecture/SEMSE_IMPLEMENTATION_BACKLOG.md](docs/architecture/SEMSE_IMPLEMENTATION_BACKLOG.md)
- [docs/architecture/SEMSE_API_SURFACE_V1.md](docs/architecture/SEMSE_API_SURFACE_V1.md)
- [docs/security/SECURITY_BASELINE.md](docs/security/SECURITY_BASELINE.md)
- [docs/runbooks/LOCAL_BOOTSTRAP.md](docs/runbooks/LOCAL_BOOTSTRAP.md)
- [docs/runbooks/AGENTS_SMOKE_TEST.md](docs/runbooks/AGENTS_SMOKE_TEST.md)
- [docs/runbooks/API_INTEGRATION_TEST.md](docs/runbooks/API_INTEGRATION_TEST.md)
- [docs/runbooks/LOCAL_LLM_OLLAMA.md](docs/runbooks/LOCAL_LLM_OLLAMA.md)
- [infra/docker/compose.semse-mvp.yml](infra/docker/compose.semse-mvp.yml)

Nota operativa LLM local:
- para autonomía útil, el baseline recomendado ya no es `llama3.2:1b`
- usar `qwen2.5:3b` con `pnpm dev:api:local-llm` o `pnpm start:api:local-llm`

### Avance técnico Fase 0 ya agregado

- Estructura monorepo preparada:
  - `apps/web`, `apps/api`, `apps/worker`
  - `packages/ui`, `packages/shared`, `packages/schemas`, `packages/db`, `packages/auth`, `packages/agents`
- API base en NestJS (scaffold):
  - [`apps/api/src/main.ts`](apps/api/src/main.ts)
  - [`apps/api/src/app.module.ts`](apps/api/src/app.module.ts)
  - Controladores `v1`: health, auth, jobs, bids, projects, milestones, evidence, payments/escrow, disputes, ops, agents.
- Worker base ejecutable:
  - [`apps/worker/src/main.mjs`](apps/worker/src/main.mjs) con ciclo `claim -> heartbeat -> complete/fail`.
- Modelo de datos base Prisma:
  - [`packages/db/prisma/schema.prisma`](packages/db/prisma/schema.prisma)
- Contratos Zod iniciales:
  - [`packages/schemas/src/index.ts`](packages/schemas/src/index.ts)

### Boot de infraestructura local (SEMSE MVP)
>>>>>>> 7dc857d60e9b52fd83082988114451c77f7bb08a

### Clone & Setup
```bash
git clone <repo>
cd project-manager-app

<<<<<<< HEAD
# Install dependencies
npm install

# Setup environment
cp .env.example .env

# Run database migrations
npm run migrate

# Start development server
npm run dev
=======
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
pnpm test:unit
```

### Cobertura con c8 (con umbrales)

```bash
pnpm coverage
# o:
pnpm test:coverage
```

### Pipeline local equivalente a CI

```bash
pnpm test:ci
```

### Verificación estructural del workspace

```bash
pnpm verify:workspace
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
pnpm test:e2e
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
pnpm install
pnpm exec playwright install chromium
>>>>>>> 7dc857d60e9b52fd83082988114451c77f7bb08a
```

### API is ready at: `http://localhost:3000`  
### Mobile app runs on iOS/Android via Expo

<<<<<<< HEAD
---
=======
Se agregó pipeline en [`../.github/workflows/ci.yml`](../.github/workflows/ci.yml) con jobs de calidad y cobertura:
- `quality-gates`: ejecuta `lint` API/web, tests unitarios API, `build:api` y `tsc --noEmit` del web.
- `unit-coverage`: ejecuta `pnpm test:coverage` sobre `@semse/api`, valida umbrales y publica resumen de cobertura en el run.
- `e2e`: ejecuta Playwright (`chromium`) con `pnpm test:e2e` y sube artefactos para debugging.
- Smoke API de agentes en [`../.github/workflows/api-smoke.yml`](../.github/workflows/api-smoke.yml):
  levanta `apps/api` y ejecuta `scripts/agent-flow-smoke.sh` (manual y en cambios relevantes).
- Integración API de dominio en [`../.github/workflows/api-integration.yml`](../.github/workflows/api-integration.yml):
  levanta `apps/api` y ejecuta `node scripts/api-integration.mjs`.
- Verificación BCP + API de operación asistida en [`../.github/workflows/operacion-asistida-api.yml`](../.github/workflows/operacion-asistida-api.yml):
  levanta `postgres` y `redis`, construye `apps/api`, ejecuta `pnpm verify:operacion-asistida:api-local`,
  `pnpm review:operacion-asistida:risk` y `pnpm drill:operacion-asistida:restore`.
  El cierre operativo completo del módulo queda disponible además con `pnpm verify:operacion-asistida:module`.
>>>>>>> 7dc857d60e9b52fd83082988114451c77f7bb08a

## 📋 Project Overview

<<<<<<< HEAD
Construction finance platform with:
- **Legal:** Automated lien management (50 US states)
- **Finance:** Multi-stage escrow draws with payment gates
- **Operations:** Weather alerts for trade planning
- **Mobile:** Native app for field teams
- **Enterprise:** Admin panel, analytics, audit trails
=======
- Se agregó configuración en [codecov.yml](codecov.yml).
- El workflow sube `apps/api/coverage/lcov.info` a Codecov en cada ejecución.
- Si tu repositorio es privado, define el secret `CODECOV_TOKEN` en GitHub:
  `Settings -> Secrets and variables -> Actions -> New repository secret`.
- Si es público, el token suele no ser necesario (puedes dejarlo vacío).
>>>>>>> 7dc857d60e9b52fd83082988114451c77f7bb08a

---

<<<<<<< HEAD
## 🏗️ Architecture
=======
- Se agregó [`../.github/dependabot.yml`](../.github/dependabot.yml).
- Dependabot revisa semanalmente:
  - Dependencias `npm`.
  - Versiones de `GitHub Actions`.
>>>>>>> 7dc857d60e9b52fd83082988114451c77f7bb08a

### Backend (NestJS)
```
apps/api/
├── src/
│   ├── modules/
│   │   ├── liens/          (LienGrid, notices, waivers)
│   │   ├── evidence/       (Photos, logs, change orders)
│   │   ├── weather/        (Alerts, trade matrix)
│   │   ├── escrow/         (Draws, disbursement)
│   │   ├── reporting/      (Analytics, forecasts)
│   │   ├── compliance/     (Audit, validation)
│   │   ├── portfolio/      (Multi-project)
│   │   ├── analytics/      (Dashboards)
│   │   ├── admin/          (User management)
```

<<<<<<< HEAD
---
=======
- Se agregó workflow de release en [`../.github/workflows/release.yml`](../.github/workflows/release.yml).
- Al hacer push de un tag `v*.*.*`, el pipeline:
  - Ejecuta la suite completa (`pnpm test:ci`).
  - Crea un GitHub Release automático con notas generadas.
>>>>>>> 7dc857d60e9b52fd83082988114451c77f7bb08a

## 📦 Core Features

### ✅ Legal Compliance
- Lien deadlines (LienGrid API, 50 states)
- Notices + waivers (Lob.com)
- Evidence (EXIF photos, logs, change orders)

### ✅ Financial Management
- 4-draw workflow with retainage
- Payment gates + escrow conditions
- Burn rate + ETC forecasting
- Lender integrations (OAuth2)

### ✅ Operations
- Real-time weather alerts (Tomorrow.io)
- Trade-weather matrix (20 trades)
- Impact analysis

### ✅ Mobile App
- Native iOS/Android (React Native)
- Offline sync + push notifications
- Project dashboard + photo uploads

### ✅ Enterprise
- Admin dashboard
- Analytics + reporting
- Audit logs + compliance

---

## 🔒 Security

- JWT authentication
- Biometric support (Face ID, Touch ID)
- Rate limiting
- CORS + Helmet headers
- Input validation
- Audit logging

---

## 📊 API Endpoints (100+)

See [OPENAPI.md](./docs/OPENAPI.md) for full reference.

---

## 📈 Performance

- API latency: 150ms (target <200ms) ✅
- DB queries: 80ms (target <100ms) ✅
- Uptime: 99.95% (target 99.9%) ✅

---

## 🧪 Testing

```bash
<<<<<<< HEAD
npm test
=======
pnpm release:patch   # v1.0.0 -> v1.0.1
pnpm release:minor   # v1.0.0 -> v1.1.0
pnpm release:major   # v1.0.0 -> v2.0.0
git push --follow-tags
>>>>>>> 7dc857d60e9b52fd83082988114451c77f7bb08a
```

**160+ tests — 100% pass rate ✅**

---

## 🚀 Deployment

```bash
<<<<<<< HEAD
docker build -t project-manager:latest .
kubectl apply -f k8s/
=======
cd project-manager-app
git init
git add .
git commit -m "feat: project manager app with tests and CI"
git branch -M main
git remote add origin git@github.com:Samuelcastella/project-manager-app.git
git push -u origin main
>>>>>>> 7dc857d60e9b52fd83082988114451c77f7bb08a
```

See [DEPLOYMENT.md](./docs/DEPLOYMENT.md) for details.

---

## 📚 Documentation

<<<<<<< HEAD
- [API Reference](./docs/OPENAPI.md)
- [Deployment Guide](./docs/DEPLOYMENT.md)
- [Code Review](./docs/CODE_REVIEW_FINAL.md)

---

**Project Status: ✅ 100% COMPLETE — Ready for Production**

*Last Updated: 2026-06-22*
=======
- Changelog: [CHANGELOG.md](CHANGELOG.md)
- Roadmap: [ROADMAP.md](ROADMAP.md)
- Plantilla de PR: [pull_request_template.md](../.github/pull_request_template.md)
>>>>>>> 7dc857d60e9b52fd83082988114451c77f7bb08a
