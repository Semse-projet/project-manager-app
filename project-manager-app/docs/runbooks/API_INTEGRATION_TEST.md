# API Integration Test (Local)

Script end-to-end que valida reglas clave del dominio API:

- Marketplace: job -> bid -> accept
- Project auto-creado
- Milestones: create -> submit -> approve -> paid
- Escrow: deposit + release
- Disputes: evita duplicado abierto por proyecto
- Agents: run lifecycle + reclaim stale
- Ops: dashboard agregado

## Ejecución

```bash
cd /home/yoni/labsemse/project-manager-app
node ./scripts/api-integration.mjs
```

## Smoke de persistencia actual

Valida solo lo que hoy ya persiste con Prisma (`health`, `jobs`, `audit`):

```bash
cd /home/yoni/labsemse/project-manager-app
npm run smoke:persistence
```

## Smoke marketplace actual

Valida el flujo persistido `job -> bid -> accept -> project`:

```bash
cd /home/yoni/labsemse/project-manager-app
npm run smoke:marketplace
```

## Smoke milestones actual

Valida el flujo persistido `project -> milestone -> submit -> approve`:

```bash
cd /home/yoni/labsemse/project-manager-app
npm run smoke:milestones
```

## Smoke disputes actual

Valida `create -> duplicate rejection -> assign -> resolve`:

```bash
cd /home/yoni/labsemse/project-manager-app
npm run smoke:disputes
```

## Smoke agents actual

Valida `create -> claim -> heartbeat -> fail -> retry -> complete -> reclaim stale`:

```bash
cd /home/yoni/labsemse/project-manager-app
npm run smoke:agents
```

## Prerrequisitos

- API corriendo en `http://localhost:4000` (o `SEMSE_API_URL`).
- Headers simulados por variables de entorno (roles `OPS_ADMIN,WORKER` por default).

## Variables opcionales

- `SEMSE_API_URL`
- `SEMSE_TENANT_ID`
- `SEMSE_USER_ID`
- `SEMSE_ORG_ID`
- `SEMSE_ROLES`
- `SEMSE_WORKER_ID`
