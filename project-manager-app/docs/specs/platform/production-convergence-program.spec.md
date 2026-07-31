---
id: "platform.production-convergence-f3-f9"
title: "Programa de convergencia de producción F3-F9"
domain: "platform"
sdd_version: "2.0"
version: "1.1"
status: "APPROVED"
owner: "semse-core"
risk: "critical"
code_status: "IN_PROGRESS"
ci_status: "NOT_RUN"
merge_status: "UNMERGED"
deploy_status: "NOT_DEPLOYED"
activation_status: "INACTIVE"
migration_status: "PENDING"
feature_flags:
  - SEMSE_PROJECT_LIFECYCLE_PROJECTION_ENABLED
  - SEMSE_PROJECT_LIFECYCLE_PERSIST_ENABLED
  - SEMSE_PROJECT_LIFECYCLE_CANARY_TENANT_IDS
  - SEMSE_PROJECT_LIFECYCLE_EVENTS_ENABLED
  - SEMSE_EVENT_OUTBOX_DISPATCH_ENABLED
  - SEMSE_EVENT_CONSUMERS_ENABLED
production_evidence:
  - railway:production:sha:39f6ecbd
  - railway:production:api:89677ecd-439c-46d2-945f-4482042ff9f1:SUCCESS
  - railway:production:web:e377f738-a6b4-4de6-b95a-f60ed0b8d5d2:SUCCESS
  - railway:api:variables:f3-projection-persistence-off:2026-07-29
  - github:pr:473:merge:35f6bda3387e6d17b8dcf094f2e790e43b751021
  - railway:production:sha:35f6bda3387e6d17b8dcf094f2e790e43b751021
  - railway:production-health-gate:30509069492:success
  - railway:f3:activation:tenant_default:calculation-and-persistence-canary
  - github:pr:477:merge:f1234291fc190c6611d3f2258630ac08315bd060
  - railway:production-deploy-workflow:30542950757:success
  - railway:f3:event-canary:published=5:completed=5:failed=0:dead-letter=0
  - railway:f3:replay:5173120d-f312-4d8e-880e-2d2adee8d3b8:no_op:duplicate
  - github:pr:480:merge:3c2ac45d4f5d3c43a081767c54405eb08d31c788
  - railway:current-production:sha:3c2ac45d4f5d3c43a081767c54405eb08d31c788:all-services-success
  - github:pr:481:merge:114cb9ca4007d32bf3fbbfc9c36d54b1e862236a
  - github:actions:railway-deploy:30597913257:success
  - railway:current-production:sha:114cb9ca4007d32bf3fbbfc9c36d54b1e862236a:all-services-success
  - railway:custom-domain:api.semseproject.com:active:tls-valid:health=200
related_files:
  - AGENTS.md
  - ROADMAP.md
  - .specify/memory/constitution.md
  - .specify/templates/overrides/semse-spec.md
  - .specify/templates/overrides/semse-plan.md
  - .specify/templates/overrides/semse-tasks.md
  - .specify/templates/overrides/semse-checklist.md
  - docs/architecture/IMPLEMENTATION_STATUS_MATRIX.md
  - docs/architecture/PRODUCTION_CONVERGENCE_MAP.md
  - docs/architecture/CURRENT_ARCHITECTURE.md
  - docs/architecture/SEMSE_API_SURFACE_V1.md
  - docs/foundation/EVENT_CATALOG.md
  - docs/SDD_GOVERNANCE.md
  - docs/SPEC_INDEX.md
  - docs/PRODUCTION_CONVERGENCE_TRACKER.md
  - docs/runbooks/F3_PROJECT_LIFECYCLE_EVENT_CANARY.md
  - docs/runbooks/API_CUSTOM_DOMAIN_TLS_HANDOFF.md
  - scripts/spec-lib.mjs
  - scripts/spec-validate.mjs
  - scripts/spec-index.mjs
  - scripts/spec-coverage.mjs
  - scripts/workspace-runner.mjs
  - apps/api/scripts/run-tests.mjs
  - packages/knowledge/scripts/copy-seeds.mjs
related_tests:
  - tests/unit/spec-lib.test.mjs
related_endpoints: []
related_events: []
related_agents:
  - prometeo
last_verified: "2026-07-31"
---

# Spec: Programa de convergencia de producción F3-F9

## 1. Problema y resultado

La arquitectura de convergencia existe en síntesis, roadmap y capacidades
parciales, pero producción no tiene una cadena verificable que conecte
proyecto, eventos, evidencia, economía, agenda, Prometeo y Mission Control.
Además, documentación histórica ha confundido código, deploy y activación.

El resultado es un programa de slices independientes que aterriza F3-F9 sobre
los módulos actuales, sin reescritura masiva ni backend paralelo.

## 2. Orden autorizado

| Slice | Capacidad | Gate de salida |
|---|---|---|
| F3 | Project Lifecycle Projection | Vista versionada, tenant-safe, durable y reconstruible |
| F4 | Mission Control 2.0 | Excepciones y acciones gobernadas con runbook |
| F5 | Shared Economic Ledger | Doble partida, reversals y reconciliación |
| F6 | Agenda/Dispatch | Calendario, conflictos, routing y rescheduling |
| F7 | Prometeo Multimodal | Fuentes, permisos, aprobaciones y verificación |
| F8 | Domain Loops | BuildOps/Agro/Labor sobre contratos comunes |
| F9 | Production Hardening | SLO, DR, seguridad, canaries y rollback |

Cada child requiere spec, plan, tasks, analyze y checklist propios antes de
implementarse. `analyze` es un gate de consistencia y puede registrarse en el
checklist/PR sin crear un contrato paralelo.

Al corte 2026-07-31, F3 está `VERIFIED`, desplegado y activo en canary para
`tenant_default`: cálculo/persistencia, rebuild, invalidación por eventos,
consumo automático, duplicado y replay pasaron. Esto abre F4 como siguiente
child autorizado para recorrer su propio ciclo SDD; no autoriza F5-F9 ni una
activación global de F3.

## 3. Principios de aterrizaje

- Conservar `User/Tenant/Org`, `Job/Bid/Contract/Project/Milestone`,
  `PaymentEscrow/PaymentTxn`, Evidence, Trust, Prometeo y outbox actuales.
- No crear un mega-servicio “Core”.
- No aplicar stashes completos ni mezclar WIP ajeno.
- No retirar modelos legacy antes de expand/contract, backfill, shadow read y
  canary.
- No permitir Prisma directo desde agentes.
- No declarar `VERIFIED` sin activación y evidencia de producción.
- Un slice por PR desplegable y reversible.

El mapeo de componentes, autoridad y recorridos está en
`docs/architecture/PRODUCTION_CONVERGENCE_MAP.md`.

## 4. Dependencias y autoridad

```text
Identity + Context + Policy
          |
          v
Domain write authority -> Domain Event/Outbox -> Projection/Ledger/Trust
          |                                      |
          v                                      v
       Evidence --------------------------> Prometeo/Mission Control
```

Las tablas de dominio conservan autoridad de escritura. Proyecciones, búsqueda,
Prometeo y Mission Control son consumidores explicables y reconstruibles.

## 5. Gates transversales

- Seguridad: tenant/org/ownership probado y permisos backend.
- Datos: migraciones versionadas, checksum reconciliado y rollback/forward-fix.
- Eventos: atomicidad, idempotencia, replay, DLQ y correlation.
- Evidence: checksum, subject, custodia y review humano.
- Economía: moneda explícita, reversals y balance.
- Producto: loading/empty/forbidden/degraded/error diferenciados.
- Producción: CI, merge, deploy, health, canary y activación separados.

## 6. No-objetivos

- Implementar F3-F9 en un solo PR.
- Reemplazar PostgreSQL/Prisma, NestJS, Next.js o Railway.
- Convertir la síntesis compartida en evidencia de implementación.
- Activar flags globalmente sin canary y rollback.

## 7. Investigación externa

Fuentes primarias y decisiones se registran en
`docs/PRODUCTION_CONVERGENCE_TRACKER.md`.

## 8. Criterio de cierre del programa

- [ ] Cada child slice tiene SDD 2.0 y evidencia separada.
- [ ] Cada migración aplicada existe en Git con historial reconciliado.
- [ ] Cada capacidad activa tiene canary/smoke y SLO.
- [ ] ROADMAP, matriz, API surface, event catalog y SPEC_INDEX coinciden.
- [ ] F9 valida restore/rollback y cierra gaps críticos remanentes.
