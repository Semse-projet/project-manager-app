---
id: forge-run-lifecycle
title: "Forge Run Lifecycle FSM"
domain: fsm
status: APPROVED
owner: semse-core
risk: high
related_files:
  - packages/forge/src/state-machine.ts
  - packages/forge/src/orchestrator.ts
related_tests:
  - tests/unit/forge-harness.test.mjs
related_endpoints: []
related_events:
  - FORGE_RUN_CREATED
  - FORGE_RUN_BLOCKED
  - FORGE_RUN_ROLLED_BACK
related_agents:
  - forge-supervisor
  - qa-verifier
  - devops-release
last_verified: 2026-07-17
---

# FSM Spec: Forge Run Lifecycle

## Estados

| Estado | Significado |
|---|---|
| idea | intención registrada |
| intake | contexto y restricciones |
| spec_draft | spec en construcción |
| spec_review | revisión humana/técnica |
| approved | spec autorizada |
| planned | DAG y task packets listos |
| building | implementación en sandbox |
| verifying | matriz de pruebas |
| ready_for_review | PR package listo |
| merged | cambio integrado |
| deployed | desplegado |
| observing | observación post-release |
| closed | ejecución finalizada |
| blocked | detenido por política, dependencia o error |
| rolled_back | reversión ejecutada |

## Reglas

- no saltos desde `idea` a `building`;
- no `building` sin `approved` y `planned`;
- `merged` no implica `deployed`;
- `deployed` debe pasar a `observing`;
- `closed` es terminal;
- `rolled_back` conserva evidencia;
- `blocked` requiere causa y owner.

## Transiciones

La tabla canónica vive en `packages/forge/src/state-machine.ts`.

## Guards

- `spec_review -> approved`: approval registrada.
- `planned -> building`: task graph válido.
- `building -> verifying`: change set cerrado.
- `verifying -> ready_for_review`: checks requeridos passed.
- `ready_for_review -> merged`: revisión humana y branch protections.
- `merged -> deployed`: release approval y rollback.
- `observing -> closed`: SLO estable y sin incidentes abiertos.

## Eventos

Toda transición sensible debe emitir evento auditable con run ID, actor, timestamp y detalle.
