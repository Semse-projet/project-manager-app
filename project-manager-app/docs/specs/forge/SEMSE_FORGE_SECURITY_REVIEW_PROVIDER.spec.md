---
id: semse-forge-security-review-provider
title: "SEMSE Forge Security Review Provider"
domain: forge
status: APPROVED
owner: semse-core
risk: critical
related_files:
  - packages/forge/src/security-review-provider.ts
  - packages/forge/src/types.ts
  - packages/forge/src/tool-adapter.ts
  - packages/agents/src/runtime.ts
  - apps/api/src/modules/forge/forge.service.ts
  - docs/foundation/EVENT_CATALOG.md
related_tests:
  - tests/unit/forge-security-review-provider.test.mjs
  - tests/unit/forge-runtime-integration.test.mjs
related_endpoints: []
related_events:
  - FORGE_SECURITY_REVIEW_COMPLETED
related_agents:
  - security-reviewer
  - backend-builder
  - frontend-builder
  - integration-engineer
  - devops-release
last_verified: 2026-07-17
---

# SPEC: SEMSE Forge Security Review Provider

## Propósito

Proveer un revisor de seguridad puro (dry-run) para SEMSE Forge que analice el alcance propuesto de un task packet y detecte riesgos de seguridad, secretos, infraestructura, autorización y cambios críticos. No ejecuta scanners reales ni consulta servicios externos; produce un `ForgeSecurityReport` auditable con `decision`, `findings`, `requiredApprovals` y `violations`.

## Alcance

- Evalúa archivos permitidos, archivos propuestos, riesgo del task y entorno.
- Detecta patrones sensibles: secretos, credenciales, infraestructura, CI, auth, datos, agentes.
- Decide `allow` (sin hallazgos bloqueantes), `require_approval` (hallazgos que requieren aprobación de seguridad/ops) o `deny` (violaciones de policy o archivos prohibidos).
- Emite `FORGE_SECURITY_REVIEW_COMPLETED`.
- Integra con `buildForge` para la acción `security.review`.
- Integra con `ForgeService.applyTaskResult` para registrar aprobaciones requeridas y, si procede, bloquear la transición a `ready_for_review`.

## Tipo canónico

```typescript
export type ForgeSecurityFinding = {
  id: string;
  rule: string;
  severity: "low" | "medium" | "high" | "critical";
  path?: string;
  message: string;
};

export type ForgeSecurityReport = {
  mode: "dry-run" | "live";
  decision: "allow" | "deny" | "require_approval";
  reason: string;
  findings: ForgeSecurityFinding[];
  requiredApprovals: ForgeApprovalMode[];
  violations: string[];
  auditTags: string[];
};
```

## Reglas de decisión

1. Si `policy.decision === "deny"` => `deny` con `security.policy.denied`.
2. Si se detecta un archivo prohibido (`.env*`, `**/*.key`, `**/*.pem`) en `allowedFiles` o `proposedFiles` => `deny` con `security.forbidden_file`.
3. Si `task.riskLevel === "critical"` o hay un hallazgo `critical` => `require_approval` con `dual_control`.
4. Si `task.riskLevel === "high"` o hay hallazgo `high` => `require_approval` con `security`/`ops_admin`.
5. Si hay hallazgos `medium`/`low` => `require_approval` con `security`.
6. Si no hay hallazgos => `allow`.

Patrones de riesgo:

- `security.env_file`: archivos `.env*` en el alcance.
- `security.credential_file`: `*.key`, `*.pem`, `*.p12`, `credentials*`.
- `security.database_schema`: `packages/db/prisma/schema.prisma` o migraciones.
- `security.ci_workflow`: `.github/workflows/**`.
- `security.infrastructure`: `**/railway.json`, `**/Dockerfile*`, `**/docker-compose*`.
- `security.auth_module`: `packages/auth/**`.
- `security.agent_runtime`: `packages/agents/**` (cambios en runtime gobernado).
- `security.payment_or_identity`: `packages/payments/**`, `**/identity/**`.

## Eventos

### `FORGE_SECURITY_REVIEW_COMPLETED`

Se emite cuando `applyTaskResult` recibe un `securityReport` en el payload. Incluye:

- `taskId`
- `agentRunId`
- `securityDecision`
- `findingCount`
- `criticalCount`
- `requiredApprovals`

## Integración con el flujo

- `buildForge` invoca `securityReviewProvider.review` para `action === "security.review"`.
- Si el run está en `verifying` y el reporte es `deny`, `ForgeService.applyTaskResult` puede forzar `blocked`.
- Si el reporte es `require_approval`, las aprobaciones requeridas se registran en el run.

## Notas

- `LiveSecurityReviewProvider` lanza `not implemented` en esta fase.
- No se modifica `packages/db/prisma/schema.prisma`.
