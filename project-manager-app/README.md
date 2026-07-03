# Project Manager App / SEMSEproject

Plataforma ConTech para gestion de proyectos, marketplace operativo, evidencia, escrow, trust y automatizacion con agentes.

## Estado

- Monorepo pnpm con `apps/web`, `apps/api`, `apps/worker` y paquetes compartidos.
- Web en Next.js.
- API en NestJS con Prisma.
- Railway usa builds Docker por servicio.
- La API productiva expone liveness en `/v1/health` y readiness en `/v1/ready`.

## Quick Start

```bash
pnpm install
pnpm db:generate
pnpm dev:api
pnpm dev:web
```

URLs locales comunes:

- Web: `http://localhost:3000`
- API: `http://localhost:4000/v1/health`
  - Readiness: `http://localhost:4000/v1/ready`

## Contexto SEMSEproject

La evolucion del repo esta documentada en:

- [docs/architecture/SEMSEPROJECT_BLUEPRINT.md](docs/architecture/SEMSEPROJECT_BLUEPRINT.md)
- [docs/architecture/SEMSE_IMPLEMENTATION_BACKLOG.md](docs/architecture/SEMSE_IMPLEMENTATION_BACKLOG.md)
- [docs/architecture/SEMSE_API_SURFACE_V1.md](docs/architecture/SEMSE_API_SURFACE_V1.md)
- [docs/security/SECURITY_BASELINE.md](docs/security/SECURITY_BASELINE.md)
- [docs/runbooks/LOCAL_BOOTSTRAP.md](docs/runbooks/LOCAL_BOOTSTRAP.md)
- [docs/runbooks/AGENTS_SMOKE_TEST.md](docs/runbooks/AGENTS_SMOKE_TEST.md)
- [docs/runbooks/API_INTEGRATION_TEST.md](docs/runbooks/API_INTEGRATION_TEST.md)
- [docs/runbooks/LOCAL_LLM_OLLAMA.md](docs/runbooks/LOCAL_LLM_OLLAMA.md)
- [infra/docker/compose.semse-mvp.yml](infra/docker/compose.semse-mvp.yml)

## Arquitectura

```text
apps/
  api/       NestJS API
  web/       Next.js web app
  worker/    background worker

packages/
  agents/
  auth/
  autonomy/
  db/
  knowledge/
  schemas/
  shared/
  tools/
  ui/
```

Modulos principales:

- Marketplace y proyectos.
- Contratos, bids, milestones y escrow.
- Evidencia operacional.
- Trust, ratings y verificacion.
- Agentes, autonomia, knowledge y runtime.
- Admin, mission control y modulos SEMSE OS.

## API temporal

Mientras se integra auth real completa, algunos flujos de API aceptan contexto por headers:

- `x-user-id`
- `x-tenant-id`
- `x-org-id`
- `x-roles`
- `x-idempotency-key`

Las rutas HTTP no publicas deben declarar `@RequirePermissions(...)` o `@AuthenticatedAccess("reason")`; la ausencia de metadata RBAC falla cerrado.

## Comandos utiles

```bash
pnpm verify:workspace
pnpm run build:api
pnpm run build:web
pnpm --filter @semse/api build
pnpm --filter @semse/web build
pnpm test:unit
pnpm test:e2e
```

## Railway

Archivos relevantes:

- [Dockerfile.api](Dockerfile.api)
- [Dockerfile.web](Dockerfile.web)
- [railway.json](railway.json)
- [../.github/workflows/railway-deploy.yml](../.github/workflows/railway-deploy.yml)

El workflow de Railway dispara fresh builds para los servicios SEMSE y luego valida:

- API: `https://project-manager-app-production-977f.up.railway.app/v1/health`
- Web: `https://semse-web-production.up.railway.app/`

## LLM local

Para autonomia local se recomienda `qwen2.5:3b` con:

```bash
pnpm dev:api:local-llm
```

## CI y calidad

Workflows principales:

- [../.github/workflows/ci.yml](../.github/workflows/ci.yml)
- [../.github/workflows/api-smoke.yml](../.github/workflows/api-smoke.yml)
- [../.github/workflows/api-integration.yml](../.github/workflows/api-integration.yml)
- [../.github/workflows/operacion-asistida-api.yml](../.github/workflows/operacion-asistida-api.yml)
- [../.github/workflows/release.yml](../.github/workflows/release.yml)

Cobertura y dependencias:

- [codecov.yml](codecov.yml)
- [../.github/dependabot.yml](../.github/dependabot.yml)

## Documentacion

- [CHANGELOG.md](CHANGELOG.md)
- [ROADMAP.md](ROADMAP.md)
- [docs/SPEC_INDEX.md](docs/SPEC_INDEX.md)
- [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)
- [docs/OPENAPI.md](docs/OPENAPI.md)
