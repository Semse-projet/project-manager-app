# SEMSEproject Blueprint

## 1) Aterrizaje al estado actual

Base existente en este repo:
- Frontend single-page (`index.html` + `app.js` + `logic.mjs`).
- Dominio actual: `Project` local con filtros, presets, calendario y métricas.
- Calidad: unit tests, E2E Playwright, cobertura c8 y CI.

Gap contra SEMSEproject:
- No hay backend/API ni base de datos.
- No hay multi-tenant, auth ni RBAC real.
- No existen módulos de Marketplace/FSM/Evidence/Escrow/Trust.
- No hay motor de disputas, ledger ni auditoría persistente de eventos.

Conclusión: usar la app actual como prototipo UX y migrar gradualmente a arquitectura de plataforma.

## 2) Arquitectura objetivo (monorepo)

```text
apps/
  web/              # Next.js (Cliente/Pro/Ops)
  api/              # Fastify o NestJS + Prisma
packages/
  ui/               # componentes compartidos
  shared/           # tipos, zod schemas, utils, SDK cliente API
infra/
  docker/           # postgres, redis, minio, localstack opcional
docs/
  architecture/
```

Stack propuesto:
- Frontend: Next.js App Router + TypeScript + Tailwind + React Query.
- Backend: Fastify (simple) o NestJS (más opinionado).
- DB: Postgres + Prisma.
- Evidencia: S3 compatible (MinIO local).
- Jobs async: Redis + BullMQ.
- Auth: Auth.js/NextAuth con roles.
- Calidad: ESLint + Prettier + Vitest/Jest + Playwright.

## 3) Modelo de dominio mínimo (MVP plataforma)

Entidades core:
- `User`: perfil base.
- `Organization`: empresa/contratista/cliente.
- `Membership`: rol por organización (`CLIENT`, `PRO`, `OPS`).
- `Job`: publicación de trabajo.
- `Bid`: propuesta económica/tiempo.
- `WorkOrder`: orden ejecutable.
- `TaskChecklistItem`: control operativo.
- `EvidenceAsset`: foto/video/documento con metadatos.
- `Milestone`: hito verificable.
- `EscrowAccount`: bolsa de fondos por trabajo.
- `EscrowTransaction`: depósito/release/holdback/fee/refund.
- `Dispute`: caso abierto, estado, resolución.
- `EventLog`: auditoría inmutable (`actor`, `action`, `resource`, `timestamp`).
- `TrustSignal`: score y señales (consistencia, rechazos, disputas).

## 4) Flujos transversales clave

Flujo A: Marketplace -> Ejecución
1. Cliente crea `Job`.
2. Pros envían `Bid`.
3. Cliente selecciona bid.
4. Se crea `WorkOrder`.

Flujo B: Ejecución -> QA -> Pago por hitos
1. Pro ejecuta checklist y adjunta evidencia.
2. Solicita aprobación de `Milestone`.
3. Cliente/Ops aprueba o rechaza.
4. Si aprueba: release parcial desde `EscrowAccount`.

Flujo C: Disputa
1. Se abre `Dispute` sobre hito/pago/calidad.
2. Ops revisa `EventLog` + evidencia.
3. Resuelve con ajuste financiero y cierre.

## 5) Plan de implementación por fases

## Fase 1 (2-3 semanas): Fundaciones
- Crear estructura monorepo sin romper app actual.
- Levantar `apps/api` con healthcheck y Prisma.
- Implementar auth + RBAC básico.
- Migrar entidad `Project` -> `WorkOrder` inicial.
- CI expandido para web/api/tests.

DoD:
- API desplegable local por Docker.
- Login y rutas protegidas por rol.
- EventLog activo en operaciones críticas.

## Fase 2 (2-4 semanas): Marketplace + FSM Core
- CRUD de Jobs y Bids.
- Conversión Job a WorkOrder.
- FSM: checklist, timer, materiales, estados.

DoD:
- Cliente publica y adjudica.
- Pro ejecuta orden de punta a punta.

## Fase 3 (2-3 semanas): Evidence + QA
- Carga de evidencia con clasificación antes/durante/después.
- Inspección y punch list.
- Hitos con aprobación/rechazo y comentarios.

DoD:
- Cada hito exige evidencia mínima configurable.
- Trazabilidad completa en timeline.

## Fase 4 (3-4 semanas): Escrow + Trust
- Ledger escrow (deposit/release/holdback/fee/refund).
- Disputas con SLA y estados.
- Trust score inicial por señales operativas.

DoD:
- Pagos por hitos verificables.
- Disputa con resolución auditable.

## 6) Métricas de producto (desde MVP)

- `job_to_bid_rate`
- `bid_win_rate`
- `on_time_milestone_rate`
- `approval_first_pass_rate`
- `dispute_rate`
- `avg_resolution_time_dispute`
- `escrow_release_cycle_time`
- `evidence_completeness_score`

## 7) Riesgos y controles

- Riesgo financiero (escrow):
  - Mitigación: ledger inmutable + reconciliación diaria.
- Riesgo legal/compliance:
  - Mitigación: términos, auditoría y retención de evidencia.
- Riesgo de adopción en campo:
  - Mitigación: UX mobile-first, pasos cortos, modo offline progresivo.

## 8) Siguiente sprint recomendado

Objetivo: entrar a Fase 1 sin reescritura brusca.

Backlog inmediato:
1. Inicializar monorepo y mover app actual a `apps/web-legacy`.
2. Crear `apps/api` (Fastify + Prisma + Postgres docker).
3. Definir schema Prisma inicial (`User`, `Organization`, `Membership`, `WorkOrder`, `EventLog`).
4. Implementar login con roles de demo.
5. Exponer endpoints `GET/POST /work-orders`.
6. Conectar vista web a API para listar/crear órdenes.
