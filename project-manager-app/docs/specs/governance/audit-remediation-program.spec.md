---
id: "governance.audit-remediation-program"
title: "Programa de remediación de auditoría — routing SDD integral"
domain: "governance"
version: "1.4"
status: "APPROVED"
owner: "semse-core"
risk: "critical"
date: "2026-07-23"
author: "Codex"
spec_index: "docs/SPEC_INDEX.md"
related_files:
  - docs/AUDIT_REMEDIATION_PLAN.md
  - docs/specs/ui/client-flows-remediation.spec.md
  - docs/specs/ui/pro-flows-remediation.spec.md
  - docs/specs/ui/admin-flows-remediation.spec.md
  - docs/specs/ui/design-system-remediation.spec.md
  - docs/specs/ui/audit-product-decisions.spec.md
  - docs/specs/api/auth-account-session-remediation.spec.md
  - docs/specs/api/bff-auth-boundary.spec.md
  - docs/specs/api/governance-tenant-boundary.spec.md
  - docs/specs/api/session-revocation-architecture.spec.md
  - docs/specs/api/worker-verification-remediation.spec.md
  - docs/specs/api/vision-service-security.spec.md
  - docs/specs/api/travel.spec.md
  - docs/specs/api/payout-method-tokenization.spec.md
  - docs/specs/labor/labor-engine-remediation.spec.md
related_tests: []
related_endpoints: []
related_events: []
related_agents: []
last_verified: "2026-07-25"
---

# Spec: Programa de remediación de auditoría

## 1. Propósito

Este documento es el mapa canónico entre los **157 ítems originales** y los
IDs de seguimiento que se agreguen a `docs/AUDIT_REMEDIATION_PLAN.md` durante
la remediación. El inventario routable actual contiene **161 IDs**. Evita dos
fallos de gobernanza:

1. implementar un hallazgo sin spec;
2. bloquear un conjunto entero de fixes porque una decisión de producto no
   relacionada sigue abierta.

No sustituye las specs de dominio. Define routing, estado y gates.

## 2. Estados de routing

| Estado | Significado |
|---|---|
| `EXECUTABLE` | existe spec `APPROVED`, `IMPLEMENTED` o `VERIFIED`; puede pasar a plan/tasks |
| `REVIEW_REQUIRED` | existe contrato, pero requiere cerrar decisiones listadas antes de implementar |
| `DECISION_REQUIRED` | no hay comportamiento elegido; solo mitigaciones deny-by-default/copy honesto |
| `CLOSED` | el plan marca el ítem corregido; la spec sigue siendo la fuente para regresiones |

El checkbox del plan y el estado de la spec son dimensiones distintas:
`[x]` describe código verificado localmente según la evidencia anotada; no
convierte automáticamente una spec en `VERIFIED`.

## 3. Routing canónico — Sección 0

| Ítems | Spec primaria | Routing |
|---|---|---|
| `0.0` | `ui.client-flows-remediation`, `ui.pro-flows-remediation`, `ui.admin-flows-remediation`, `api-job-lifecycle-bids` | EXECUTABLE |
| `0.1`, `0.2`, `0.32` | `api.auth-account-session-remediation`, `api-bff-auth-boundary` | EXECUTABLE |
| `0.1b` | `api-bff-auth-boundary` | CLOSED |
| `0.3` | `auth.session-revocation-architecture` | REVIEW_REQUIRED |
| `0.4` | `api-evidence-upload-review`, `api-milestone-lifecycle` | EXECUTABLE |
| `0.5`, `0.23` | `api-change-orders`, `api-payments-escrow` | EXECUTABLE |
| `0.6` | `api-prometeo-copilot`, `api-agents-runtime` | EXECUTABLE |
| `0.7`, `0.8`, `0.25`, `0.34` | `api-evidence-upload-review`, `evidence.canonical-fase1` | EXECUTABLE |
| `0.9` | `api.worker-verification-remediation` | REVIEW_REQUIRED |
| `0.10`, `0.11`, `0.26` | `api.vision-service-security`, `api-evidence-upload-review` | EXECUTABLE |
| `0.12`, `0.13`, `0.14`, `0.15`, `0.16`, `0.17`, `0.35` | `api-payments-escrow`, `fsm-escrow-lifecycle`, `m1-3-stripe-escrow` | EXECUTABLE |
| `0.18` | `semse-forge-agent-harness`, `semse-forge-sdd` | EXECUTABLE |
| `0.19`, `0.20`, `0.24` | `labor.engine-remediation`, `labor.time-tracking-consolidation` | EXECUTABLE |
| `0.21` | `api.rbac-explicit-boundary`, `ui.admin-flows-remediation` | EXECUTABLE |
| `0.22` | `api-reservations`, `fsm-agent-run-lifecycle`, `fsm-reservation-lifecycle` | EXECUTABLE |
| `0.27`, `0.28` | `api-matching` | EXECUTABLE |
| `0.29` | `api-smart-intake`, `api-matching`, `m1-2-regional-costs` | EXECUTABLE |
| `0.30` | `tools.materials-calculator` | EXECUTABLE |
| `0.31` | `ui.client-flows-remediation`, `ui-pro-flows` | EXECUTABLE |
| `0.33` | `api-agents-runtime`, `ui.pro-flows-remediation` | EXECUTABLE |

Cobertura: **37/37** (36 originales + 1 seguimiento).

## 4. Routing canónico — Sección 1 Cliente

| Ítems | Spec primaria | Routing |
|---|---|---|
| `1.1`, `1.2`, `1.3`, `1.4`, `1.6`, `1.7`, `1.8`, `1.9`, `1.10`, `1.11`, `1.11c`, `1.12`, `1.13`, `1.14`, `1.18`, `1.20` | `ui.client-flows-remediation` | EXECUTABLE |
| `1.5`, `1.11b`, `1.21` | `ui.audit-product-decisions` | DECISION_REQUIRED |
| `1.15`, `1.16`, `1.17`, `1.19` | `ui.design-system-remediation` | REVIEW_REQUIRED |

Cobertura: **23/23**.

## 5. Routing canónico — Sección 2 PRO/Worker

Todos los ítems mantienen `ui.pro-flows-remediation` como contrato de
superficie; la siguiente tabla identifica el bounded context primario.

| Ítems | Spec primaria adicional | Routing |
|---|---|---|
| `2.1`, `2.40` | `ui.audit-product-decisions` | DECISION_REQUIRED |
| `2.28` | `api.worker-verification-remediation` | REVIEW_REQUIRED |
| `2.44` | `api.payout-method-tokenization` | REVIEW_REQUIRED |
| `2.2`, `2.3`, `2.4`, `2.5`, `2.8`, `2.9`, `2.10`, `2.11`, `2.12`, `2.13`, `2.14`, `2.15`, `2.16` | `labor.engine-remediation` | EXECUTABLE |
| `2.31`, `2.34`, `2.35`, `2.36`, `2.38` | `api.travel-assignments-settlement` | EXECUTABLE |
| `2.1b`, `2.1d`, `2.26`, `2.27`, `2.29`, `2.30`, `2.47` | `api-job-lifecycle-bids`, `api-matching` | EXECUTABLE |
| `2.1e`, `2.41` | `api-agents-runtime`, `api-prometeo-copilot` | EXECUTABLE |
| `2.1f`, `2.18`, `2.21`, `2.22`, `2.45` | `api-evidence-upload-review` | EXECUTABLE |
| `2.19`, `2.20`, `2.24`, `2.25`, `2.32`, `2.33` | `api-field-ops`, `tasks.task-unification-fase1` | EXECUTABLE |
| `2.49` | `api-field-ops` | CLOSED / regresión |
| `2.1c`, `2.39`, `2.42`, `2.43`, `2.46`, `2.48` | `api-payments-escrow`, `api-dispute-lifecycle` | EXECUTABLE |
| `2.6`, `2.7`, `2.17`, `2.23`, `2.37` | `ui.pro-flows-remediation` | EXECUTABLE |

Cobertura: **54/54**.

## 6. Routing canónico — Sección 3 Admin

| Ítems | Spec primaria | Routing |
|---|---|---|
| `3.0`–`3.45` | `ui.admin-flows-remediation` + spec API del bounded context afectado | CLOSED / regresión |
| `3.10b` | `api.governance-tenant-boundary`, `ui.admin-flows-remediation` | CLOSED |

Excepciones con contrato adicional obligatorio:

- `3.7`, `3.8`, `3.26`: `api-payments-escrow`.
- `3.10`, `3.11`, `3.12`, `3.15`, `3.20`: `api-agents-runtime`/Forge.
- `3.13`, `3.21`, `3.22`: `api.worker-verification-remediation`.
- `3.14`, `3.23`: `prometeo.tool-registry-governance-f2`.
- `3.19`: `api-change-orders`.
- `3.24`, `3.35`: `api.travel-assignments-settlement`.
- `3.25`, `3.18`: `api-job-lifecycle-bids`.
- `3.37`: `api-communications`.

Cobertura: **47/47** (45 originales + 2 seguimientos).

## 7. Reglas de ejecución

1. Seleccionar un ítem abierto.
2. Resolver su fila en este mapa.
3. Confirmar el estado real de todas las specs primarias.
4. Si es `EXECUTABLE`, producir plan/tasks/tests del lote acotado.
5. Si es `REVIEW_REQUIRED`, cerrar exclusivamente las decisiones enumeradas.
6. Si es `DECISION_REQUIRED`, pedir decisión al owner; no inferirla.
7. Al cerrar, actualizar plan, spec, tests relacionados y reporte.

## 8. Gates

- Cobertura del inventario actual: 161/161.
- `pnpm spec:audit-plan-coverage`: 161 mapeados, 0 faltantes, 0 extras.
- `node scripts/spec-validate.mjs --strict`: 0 errores/0 warnings.
- `node scripts/spec-index.mjs`: índice regenerado.
- Ninguna spec `DRAFT` o `REVIEW` autoriza implementación.
- Las specs UI aprobadas declaran explícitamente los ítems excluidos.

## 9. Rollback

Este documento solo cambia routing documental. Revertirlo no revierte código;
restaura el estado anterior en el que las decisiones y fixes estaban mezclados,
por lo que no se recomienda sin un mapa sustituto.
