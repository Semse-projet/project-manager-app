# Verification Matrix — SEMSE OS Capability Control Plane

**Estado:** PROPOSED
**Spec:** `platform.semse-os-control-plane`

| ID | Capa | Caso | Evidencia requerida |
| --- | --- | --- | --- |
| CP-001 | Schema | Manifiesto válido/inválido | unit test Zod/JSON Schema |
| CP-002 | Tenant | No existe lectura o mutación cross-tenant | negativos repository/controller |
| CP-003 | Policy | deny no invoca adapter | spy + audit receipt |
| CP-004 | Approval | digest modificado invalida aprobación | policy test |
| CP-005 | Idempotencia | retry no duplica operación/apply | concurrency test |
| CP-006 | Lease | dos reconcilers no mutan la misma instalación | DB integration test |
| CP-007 | Plan | dependencias incompatibles bloquean antes de apply | planner contract test |
| CP-008 | Adapter | Compose recibe plan cerrado, no prompt/shell libre | adapter unit test |
| CP-009 | Health | liveness sin readiness no activa capability | integration test |
| CP-010 | Rollback | fallo de readiness vuelve a revisión previa | fault-injection test |
| CP-011 | Events | state + outbox son atómicos | transaction test |
| CP-012 | Audit | toda transición material conserva actor/digest | audit assertion |
| CP-013 | Secrets | handles no aparecen en logs/resultados | redaction test |
| CP-014 | Recovery | restart continúa desde receipt persistido | crash/replay test |
| CP-015 | SLO | lag y duración exponen métricas | metrics test |

## SLO inicial

| Indicador | Objetivo MVP |
| --- | --- |
| crear plan p95 | < 2 s sin provisionamiento externo |
| reconciliación de drift p95 | < 60 s |
| operación sin estado terminal | 0 sin owner después de 15 min |
| logical apply duplicado | 0 |
| transición material auditada | 100% |
| aislamiento cross-tenant | 100% de pruebas negativas |
| rollback verificable high/critical | 100% |

## Gates de cierre

1. Unit y contract tests afectados pasan.
2. `pnpm spec:validate:strict` pasa.
3. Threat model revisado por Security/Governance.
4. Mission Control puede explicar estado e impacto.
5. Rollback se prueba en target local antes de staging.
6. Producción permanece fuera del primer slice.

