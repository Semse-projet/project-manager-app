# SEMSEproject / Semse Project

SEMSEproject es un ecosistema digital para gestionar servicios profesionales, construcción y operación asistida con IA. La raíz Git de este workspace es `labsemse/`, pero la raíz canónica de desarrollo vive en `project-manager-app/`.

## Qué problema resuelve

SEMSE busca unificar en una sola plataforma:

- captación y gestión de clientes
- operación de profesionales y contratistas
- administración interna
- marketplace de servicios
- proyectos, contratos, hitos y pagos en escrow
- evidencias, documentos, facturas y recibos
- agentes de IA, RAG y automatización operativa

El objetivo es reducir fricción entre venta, ejecución, control documental, pagos y soporte inteligente, empezando por construcción y gestión de proyectos.

## Módulos principales

- Client Dashboard
- Professional Dashboard
- Admin Panel
- Marketplace de servicios
- Gestión de proyectos
- Contratos digitales
- Milestones / hitos
- Pagos en escrow
- Evidence Center
- Invoice & Receipt Scanner
- AI Center
- Floating AI Assistant
- Prometeo Engine
- Nexus DB / vector database
- RAG Pipeline
- Multi-provider LLM Router

## Estructura del workspace

```text
labsemse/                          <- raíz Git y contenedor del workspace
├── project-manager-app/           <- tronco canónico de producto y desarrollo
│   ├── apps/api                   <- backend NestJS
│   ├── apps/web                   <- frontend Next.js
│   ├── apps/worker                <- worker / colas
│   ├── packages/db                <- Prisma + PostgreSQL
│   ├── packages/agents            <- agentes SEMSE
│   ├── packages/schemas           <- contratos y tipos
│   ├── packages/shared            <- utilidades compartidas
│   ├── packages/ui                <- UI reutilizable
│   └── docs/                      <- documentación canónica
├── semse-mobile-app/              <- app Vite/React complementaria
├── semse/                         <- herramientas y CLI auxiliares
├── archive/                       <- histórico, no editar para trabajo nuevo
├── app semse/_satellites-archive/ <- satélites congelados
└── semse-storage/                 <- almacenamiento operacional local
```

## Dónde trabajar

- Backend nuevo: `project-manager-app/apps/api/`
- Frontend web nuevo: `project-manager-app/apps/web/`
- Worker / procesos: `project-manager-app/apps/worker/`
- Prisma / DB: `project-manager-app/packages/db/`
- Tipos y schemas: `project-manager-app/packages/schemas/`
- Agentes y orquestación IA: `project-manager-app/packages/agents/`
- Documentación canónica: `project-manager-app/docs/`

## Stack detectado

- Frontend principal: Next.js 15.5, React 19, Tailwind CSS 4
- Frontend adicional: Vite + React + TypeScript en `semse-mobile-app/`
- Módulo Angular detectado: `project-manager-app/apps/angular/`
- Backend: Node.js, NestJS 11, Fastify
- Worker / jobs: Node.js + BullMQ
- Base de datos: PostgreSQL + Prisma
- Validación: Zod
- Testing: Node test runner, cobertura API y Playwright E2E
- IA: OpenAI, Anthropic, DeepSeek, Kimi/Moonshot, Ollama
- RAG y agentes: Prometeo Engine, Nexus DB conceptual, router multi-modelo

## Instalación

Los scripts reales viven en `project-manager-app/package.json`.

```bash
cd project-manager-app
pnpm install
```

## Cómo correr el proyecto

Desde `project-manager-app/`:

```bash
pnpm dev:web
pnpm dev:api
pnpm dev:worker
```

Para levantar la infraestructura local del MVP:

```bash
docker compose -f infra/docker/compose.semse-mvp.yml up -d
```

Para API con LLM local:

```bash
pnpm dev:api:local-llm
```

## Build y tests

Desde `project-manager-app/`:

```bash
pnpm build:web
pnpm build:api
pnpm verify:workspace
pnpm test:unit
pnpm test:e2e
```

Si necesitas Playwright por primera vez:

```bash
pnpm exec playwright install chromium
```

## Contribuir sin romper estructura

- Trabaja por defecto dentro de `project-manager-app/`.
- No desarrolles features nuevas en `archive/` ni en `app semse/_satellites-archive/`.
- No subas secretos, `.env`, tokens ni credenciales.
- No uses `git add .` sin revisar primero el `git status`.
- No mezcles cambios documentales, infraestructura y features en un mismo commit si no están relacionados.
- Mantén `README.md`, `SEMSE_CONTEXT.md` y `ROADMAP.md` alineados cuando cambie la arquitectura.
- Si mueves carpetas críticas o cambias canonicidad, documenta el plan antes de ejecutar.

## Reglas operativas

- La raíz Git correcta es `labsemse/`.
- La raíz canónica de producto es `project-manager-app/`.
- Todo código nuevo debe justificar su ubicación.
- `archive/` es solo histórico.
- La documentación es parte del sistema, no un extra.

Consulta también:

- [SEMSE_CONTEXT.md](SEMSE_CONTEXT.md)
- [ROADMAP.md](ROADMAP.md)
- [project-manager-app/README.md](project-manager-app/README.md)
