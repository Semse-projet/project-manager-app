# SEMSEproject

SEMSEproject es un sistema operativo modular, transaccional y cognitivo para
coordinar personas, organizaciones, proyectos, trabajo de campo, evidencia,
pagos protegidos por hitos, confianza, conocimiento e inteligencia artificial.

## Canonicidad

- Repositorio Git: `Semse-projet/project-manager-app`.
- Raiz del checkout: este directorio.
- Raiz canónica de desarrollo: [`project-manager-app/`](project-manager-app/).
- Codigo de producto: `project-manager-app/apps/` y
  `project-manager-app/packages/`.
- Documentacion canónica: `project-manager-app/docs/`.

Los archivos y prototipos fuera de `project-manager-app/` no autorizan nuevas
implementaciones ni redefinen la arquitectura. Se conservan solo cuando siguen
siendo utiles como entrada, integracion o referencia historica.

## Fuentes de verdad

En caso de contradiccion:

1. codigo actual de `main`;
2. specs aprobados, schemas Zod, Prisma, migrations y tests;
3. produccion verificada;
4. documentacion operativa vigente;
5. vision y conversaciones;
6. investigacion externa.

Puntos de entrada:

- [Arquitectura vigente](project-manager-app/docs/architecture/CURRENT_ARCHITECTURE.md)
- [Matriz de implementacion](project-manager-app/docs/architecture/IMPLEMENTATION_STATUS_MATRIX.md)
- [Contexto operativo](project-manager-app/docs/SEMSE_CONTEXT.md)
- [Roadmap F0-F9](project-manager-app/ROADMAP.md)
- [Indice SDD](project-manager-app/docs/SPEC_INDEX.md)

## Nueve dominios

1. SEMSE Core
2. SEMSE Connect
3. SEMSE Payments
4. SEMSE Trust
5. SEMSE AI
6. SEMSE Agro
7. SEMSE BuildOps
8. SEMSE Knowledge
9. SEMSE Integrations

No se autoriza un renombramiento masivo. Los dominios ordenan el ownership sin
obligar a cambiar los nombres actuales de carpetas y modulos.

## Topologia

```text
project-manager-app/
├── apps/
│   ├── api/              NestJS + Fastify + Prisma
│   ├── web/              Next.js + BFF
│   ├── worker/           BullMQ y trabajos asincronos
│   ├── vision-service/   analisis visual
│   ├── autonomy-server/  runtime de autonomia donde se despliegue
│   └── mobile/           cliente movil/offline
├── packages/
│   ├── db/               schema y cliente Prisma
│   ├── schemas/          contratos Zod
│   ├── product-events/   SDK de telemetria de producto
│   ├── agents/           agentes y contratos
│   └── shared, auth, autonomy, knowledge, sdk, tools, ui
└── docs/                 arquitectura, specs, ADR, reportes y runbooks
```

`apps/angular` y `apps/assistant-portal` son superficies adicionales o de
transicion; no sustituyen `apps/web` ni `apps/api` como superficies canónicas.

## Inicio local

Desde `project-manager-app/`:

```bash
pnpm install --frozen-lockfile
pnpm db:generate
pnpm dev:api
pnpm dev:web
pnpm dev:worker
```

Validaciones habituales:

```bash
pnpm verify:workspace
pnpm spec:preflight
pnpm test:unit
pnpm test:e2e
```

Elegir validaciones proporcionales al cambio y reportar por separado estado
local, CI, merge y produccion.

## Reglas de contribucion

- Leer `project-manager-app/AGENTS.md` y las fuentes obligatorias antes de
  modificar el producto.
- No desarrollar features nuevas fuera de `project-manager-app/` sin una
  decision arquitectonica explicita.
- No subir secretos, `.env`, tokens ni credenciales.
- No usar artefactos historicos como fuente de verdad vigente.
- Mantener arquitectura, contexto, roadmap, matriz y `SPEC_INDEX.md` alineados.
- No presentar Stripe como escrow legal sin estructura y revision juridica
  aplicables; usar "pagos protegidos por hitos" por defecto.
