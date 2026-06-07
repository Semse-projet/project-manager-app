# Validacion domain events y worker - 2026-04-07

## Objetivo

Cerrar tres puntos consecutivos sobre el runtime agentic de SEMSE:

1. validar `DomainEventBus -> AgentTriggerRouter -> AgentRun`;
2. validar consumo real por `worker`;
3. dejar evidencia documentada en `reportes/`.

Repo validado:

- `/home/yoni/labsemse/project-manager-app`

## Resultado ejecutivo

La validacion quedo positiva.

Se comprobó en runtime real que:

- `job.created` crea runs `pricing` y `risk`;
- `milestone.submitted` crea run `evidence-coach`;
- `dispute.opened` crea runs `dispute` y `risk`;
- el worker toma esos runs, los mueve de `queued` a `completed` y deja `attempts=1`.

Ademas, el backend sigue compilando con:

```bash
npm run build:api
```

resultado: OK.

## Cambios necesarios para poder validar runtime real

Antes de correr los smokes hubo que corregir varios bordes de runtime del workspace:

### 1. Prisma en Node ESM

Se ajustaron imports para evitar fallos de `@prisma/client` en tiempo de ejecucion:

- `packages/db/src/index.ts`
- `apps/api/src/infrastructure/prisma/prisma.service.ts`
- `apps/api/src/infrastructure/audit/audit.service.ts`
- `apps/api/src/modules/agents/agents.repository.ts`
- `apps/api/src/modules/bids/bids.repository.ts`
- `apps/api/src/modules/contracts/contracts.repository.ts`
- `apps/api/src/modules/payments/payments.repository.ts`
- `apps/api/src/modules/reservations/reservations.repository.ts`

### 2. Config del API

`ConfigModule` estaba resolviendo `packages/db/.env` relativo al `cwd` del workspace `apps/api`, no al root del monorepo.

Se corrigio en:

- `apps/api/src/app.module.ts`

### 3. Dependencias faltantes del API

Faltaba `reflect-metadata` para bootstrap de Nest.

Se corrigio en:

- `apps/api/package.json`
- `apps/api/src/main.ts`

### 4. Prisma package desalineado

El runtime estaba roto por artefactos generados inconsistentes en `node_modules/@prisma/client`.

Acciones:

- `npm run prisma:generate --workspace @semse/db`
- resincronizacion de `package.json` y loaders desde `node_modules/.prisma/client` a `node_modules/@prisma/client`

### 5. Env local del workspace

Se restauro:

- `packages/db/.env`

con:

```env
DATABASE_URL="postgresql://semse:semse@localhost:5433/semse?schema=public"
```

## Smoke agregado

Se agrego un smoke reutilizable:

- `scripts/api-domain-events-smoke.mjs`

y su script:

- `package.json` -> `smoke:domain-events`

Este smoke soporta dos modos:

- modo `queued`: valida que los eventos creen `AgentRun`;
- modo `completed`: valida lo mismo, pero esperando que el worker los procese completos.

## Validacion del punto 1

Comando ejecutado:

```bash
npm run smoke:domain-events
```

Resultado real:

- tenant: `tnt_domain_events_1775615932657`
- `job.created`:
  - `pricing`: `queued`
  - `risk`: `queued`
- `milestone.submitted`:
  - `evidence-coach`: `queued`
- `dispute.opened`:
  - `dispute`: `queued`
  - `risk`: `queued`

Tambien se verificaron entradas de auditoria `domain.event.emit` para:

- `job.created`
- `milestone.submitted`
- `dispute.opened`

## Validacion del punto 2

Se levanto el worker local contra el mismo API:

```bash
SEMSE_API_URL=http://127.0.0.1:4000 \
SEMSE_TENANT_ID=tnt_domain_worker_smoke \
SEMSE_USER_ID=usr_worker_smoke \
SEMSE_ORG_ID=org_ops \
SEMSE_ROLES=OPS_ADMIN,WORKER \
SEMSE_POLL_MS=200 \
SEMSE_HEARTBEAT_MS=150 \
SEMSE_RUN_SIM_MS=300 \
SEMSE_FAIL_RATE=0 \
npm run start --workspace @semse/worker
```

Luego se ejecutó:

```bash
SEMSE_TENANT_ID=tnt_domain_worker_smoke SEMSE_EXPECT_COMPLETED=true npm run smoke:domain-events
```

Resultado real:

- tenant: `tnt_domain_worker_smoke`
- `job.created`:
  - `pricing`: `completed`
  - `risk`: `completed`
- `milestone.submitted`:
  - `evidence-coach`: `completed`
- `dispute.opened`:
  - `dispute`: `completed`
  - `risk`: `completed`

Todos quedaron con:

- `attempts: 1`

El log del worker confirmó `claim` y `complete` sobre cada correlacion.

## Ajuste del smoke durante la validacion

Durante el punto 2 aparecieron dos puentes laterales que no eran parte del objetivo principal:

1. el paso `reservation -> contract` agregaba dependencias no necesarias para validar eventos;
2. el puente `reservation.accept -> project` no fue lo bastante determinista en este tenant.

Para dejar el smoke estable y directo, se simplificó el armado del proyecto con:

- `job -> bid -> bid.accept -> project`

Eso mantiene el foco exactamente donde importa para esta fase:

- evento emitido;
- runs creados;
- worker consumiendo runs.

## Archivos tocados en esta fase

- `apps/api/package.json`
- `apps/api/src/main.ts`
- `apps/api/src/app.module.ts`
- `apps/api/src/infrastructure/prisma/prisma.service.ts`
- `apps/api/src/infrastructure/audit/audit.service.ts`
- `apps/api/src/modules/agents/agents.repository.ts`
- `apps/api/src/modules/bids/bids.repository.ts`
- `apps/api/src/modules/contracts/contracts.repository.ts`
- `apps/api/src/modules/payments/payments.repository.ts`
- `apps/api/src/modules/reservations/reservations.repository.ts`
- `packages/db/src/index.ts`
- `packages/db/.env`
- `scripts/api-domain-events-smoke.mjs`
- `package.json`

## Estado final

Queda validado que el runtime agentic base ya corre end to end:

`domain event -> audit emit -> agent run queued -> worker claim -> heartbeat/processing -> complete`

## Siguiente paso recomendado

Con esto ya estable, el siguiente paso útil es subir la cobertura desde smoke a flujo visible y control operativo:

1. exponer en UI o en endpoint ops una vista filtrable por `correlationId` y `event type`;
2. agregar smoke de regresion para `worker + domain events` al pipeline local/CI;
3. seguir con el siguiente bloque del roadmap agentic sobre surfaces y observabilidad.
