---
id: "platform.production-convergence-f3-f9"
title: "Programa de convergencia de producción F3-F9"
domain: "platform"
sdd_version: "2.0"
version: "1.0"
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
production_evidence:
  - railway:production:sha:39f6ecbd
  - railway:production:api:89677ecd-439c-46d2-945f-4482042ff9f1:SUCCESS
  - railway:production:web:e377f738-a6b4-4de6-b95a-f60ed0b8d5d2:SUCCESS
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
  - docs/SDD_GOVERNANCE.md
  - docs/SPEC_INDEX.md
  - docs/PRODUCTION_CONVERGENCE_TRACKER.md
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
last_verified: "2026-07-28"
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

F3 es el único child slice autorizado para implementación inmediata. F4-F9
requieren spec, plan, tasks, analyze y checklist propios en `APPROVED`.

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
