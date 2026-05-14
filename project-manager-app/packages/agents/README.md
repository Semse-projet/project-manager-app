# packages/agents

Capa agentic-native de SEMSE para agentes runtime especializados.

## Qué incluye

- identidad declarativa por agente runtime;
- manifests de capacidades y restricciones;
- tool registry gobernado;
- risk scoring reutilizable;
- policy engine con `allow | deny | require_approval`;
- runtime gobernado con contexto filtrado;
- apertura de approvals base persistidos;
- audit trail estructurado por ejecución.

## Núcleo del paquete

- `src/governance.ts`
  - manifests de agentes runtime;
  - registry de tools;
  - clasificación de riesgo;
  - engine de políticas;
  - contratos de approval.
- `src/runtime.ts`
  - ejecución especializada;
  - ejecución gobernada (`executeGovernedAgentRun`);
  - filtrado de contexto por manifiesto;
  - tool trace y audit trail.
- `src/index.ts`
  - exportaciones públicas;
  - compatibilidad con catálogo previo.

## Modelo operativo

1. Se resuelve el manifiesto del agente.
2. Se filtra el contexto según `allowedContextSources` y `allowedInputKeys`.
3. Se evalúa la política del run.
4. Se evalúan las tools planeadas.
5. Se ejecuta el handler especializado solo si la política lo permite.
6. Se calcula riesgo final.
7. Se abren approvals si aplica.
8. Se devuelve output estructurado con policy, risk, approvals y audit trail.

## Comandos útiles

- Build del paquete:
  - `pnpm --filter @semse/agents build`
- Tests integrados vía API:
  - `pnpm --filter @semse/api test:unit`
- Build integrado de backend:
  - `pnpm build:api`

## Integración

El paquete está cableado con:

- `apps/api/src/modules/agents`
- `apps/api/src/modules/ops`
- `apps/worker/src/main.mjs`
- `packages/schemas/src/agent-governance.schema.ts`

## Nota

La capa de approvals queda persistida en Prisma dentro del módulo `agents` del API, manteniendo el mismo contrato público hacia `ops`, `worker` y frontend.
