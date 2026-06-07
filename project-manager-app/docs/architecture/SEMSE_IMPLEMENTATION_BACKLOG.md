# SEMSE Implementation Backlog

## Fase 0 - Foundation

Objetivo: preparar base productiva sin romper lo existente.

Backlog:
1. Crear monorepo y workspaces (`apps/*`, `packages/*`).
2. Levantar `apps/api` (NestJS + Fastify) con healthcheck.
3. Definir `packages/db` con Prisma y entidades base multi-tenant.
4. Habilitar autenticación inicial + RBAC mínimo.
5. Crear `AuditLog` append-only en operaciones críticas.
6. Integrar observabilidad base (logs JSON + request-id).
7. Pipeline CI para lint, typecheck, tests y build.

Definition of Done:
- `web`, `api`, `worker` inician local con Docker Compose.
- Endpoint `/v1/health` operativo.
- Login y endpoint protegido por rol funcionando.
- Auditoría registrada en acciones de create/update/approve.

Riesgos:
- Sobre-diseño temprano.
- Migraciones de datos sin versionado.

## Fase 1 - Marketplace + FSM core

Backlog:
1. Jobs CRUD y flujo de publicación.
2. Bids CRUD y adjudicación.
3. Creación de WorkOrder desde Job adjudicado.
4. Milestones y checklist operativo.
5. Mensajería básica Cliente-Pro-Ops.

Definition of Done:
- Flujo E2E: crear job -> ofertar -> adjudicar -> ejecutar hito.

## Fase 2 - Evidence + Escrow + Disputes

Backlog:
1. Carga de evidencia con URLs prefirmadas.
2. Validación de evidencia mínima por milestone.
3. Integración escrow (deposit/release/holdback refs).
4. Centro de disputas para Ops.
5. Webhooks de pagos con idempotencia.

Definition of Done:
- Release por milestone aprobado y disputa resoluble en panel Ops.

## Fase 3 - Agents + Risk + Ops hardening

Backlog:
1. Registry y runtime de agentes.
2. AgentRuns con entrada/salida/logs versionados.
3. Cálculo de señales de riesgo y score.
4. Dashboards operativos con alertas.
5. Runbooks de incidentes y BCP.

Definition of Done:
- Al menos 3 agentes productivos con métricas y trazabilidad completa.
