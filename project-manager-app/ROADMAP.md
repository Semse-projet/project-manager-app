# Roadmap

## Estado actual

- v1.2.0 completado: app local de gestión con lista/kanban/calendario, filtros, presets, backup, undo, tests y CI. ✅

## Próxima evolución (SEMSEproject)

## Fase 1: Fundaciones de plataforma
- Migrar a monorepo (`apps/web`, `apps/api`, `packages/shared`, `infra/docker`).
- Backend TypeScript + Postgres + Prisma.
- Auth + RBAC inicial (Cliente / Pro / Ops).
- Auditoría base (`event_log`).

## Fase 2: Marketplace + FSM Core
- Jobs/publicaciones con bids/cotizaciones.
- Conversión Job -> Work Order.
- Checklists, tiempos y materiales (LF/SF/EA).
- Timeline de ejecución y estados.

## Fase 3: Evidence + QA + Hitos
- Evidencia guiada (antes/durante/después) por hito.
- Inspecciones y punch list.
- Aprobación/rechazo de hitos con trazabilidad.

## Fase 4: Escrow + Disputas + Trust
- Wallet escrow por trabajo e hitos con holdbacks.
- Releases parciales y fees de plataforma.
- Flujo de disputas y resolución Ops.
- Señales de riesgo y reputación.

## Fase 5: Ops Control + Escala
- Consola de operaciones (SLA, bloqueos, revisión de casos).
- Observabilidad (métricas, trazas, alertas).
- Hardening de seguridad, cumplimiento y performance.
