# DecisionPackage — Task graph SEMSE OS Control Plane

**Spec:** `platform.semse-os-control-plane`
**Spec status:** `APPROVED` (`plan_only`)
**Plan status:** `APPROVED` (`tasks-only`)
**Tasks status:** `PENDING` (`F0 COMPLETE_WITH_ENV_BLOCKER`)
**Tasks digest autorizado para F0:**
`sha256:62eeb221dcf408e61df085d73aaf26428bf44d29275e3f83cb1f50fb5c4d3714`
**Tasks digest posterior a F0:**
`sha256:3944e09d5ee55c84f2172847b61979e54cae0b62988e8c573e55e0094bcfd2ae`
**Riesgo:** critical
**Revisión F0 autorizada:** sí, completada con T-006 bloqueada
**Implementación autorizada:** no
**Producción autorizada:** no

## Resultado

El plan fue convertido en 90 tareas únicas distribuidas en gates, tests-first,
schemas, núcleo puro, persistencia, API/approvals, queue/executor local,
`local-ai-runtime`, Mission Control y verificación independiente.

- T-000..T-005 y T-007: completadas documentalmente;
- T-006: bloqueada por ausencia de Docker Desktop y WSL;
- 82 tareas: pendientes;
- tareas de implementación completadas: 0.

## Controles incorporados

1. T-001..T-007 separan los reviews previos de la autorización de código.
2. T-008 exige aprobación humana posterior sobre este digest.
3. T-009 exige TaskPackets Forge con scopes/leases antes de implementar.
4. T-010..T-019 escriben tests antes del product code.
5. Prisma requiere gate de migración y ruta exacta aprobada.
6. `CAPABILITY_EXECUTOR` no hereda autoridad de `OPS_ADMIN`.
7. Worker/Redis transportan solo `operationId`.
8. Adapter Compose usa operaciones cerradas y nunca shell del modelo.
9. Docker solo bloquea el slice local y el canary, no el trabajo puro.
10. Railway, Kubernetes y producción están fuera del scope completo.

## Resultado F0 y decisión siguiente

Architecture, Security, Domain Architecture, Governance, Product/Ops y Data
Architecture aceptaron sus contratos. T-006 continúa bloqueando F7/T-094, pero
no F1-F6. T-008 sigue sin autorización y requeriría una decisión humana nueva
sobre el digest posterior a F0, seguida por TaskPackets T-009 acotados.

Evidencia consolidada:
`docs/architecture/reviews/SEMSE_OS_CONTROL_PLANE_F0_REVIEW_2026-07-19.md`.

## Validación documental

```text
node scripts/spec-index.mjs
node scripts/spec-validate.mjs --strict
node --test tests/unit/spec-lib.test.mjs tests/unit/local-container-contract.test.mjs
```
