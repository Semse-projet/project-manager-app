---
type: plan
feature: "[FEATURE_NAME]"
domain: "[DOMAIN]"
spec: "docs/specs/[domain]/[feature].spec.md"
version: "2.0"
status: "DRAFT"
branch: "feat/[feature-slug]"
date: "[YYYY-MM-DD]"
---

# Plan técnico: [FEATURE_NAME]

> Prerrequisito: spec `APPROVED`. El plan separa implementación, merge,
> despliegue y activación; ningún estado se infiere de otro.

## 1. Snapshot de verdad

- `origin/main` SHA:
- SHA desplegado API:
- SHA desplegado Web:
- Estado de servicios:
- Estado de migraciones:
- Flags/allowlists:
- Drift o deuda previa:

## 2. Constitution check

- [ ] Spec aprobado antes de código
- [ ] Tenant/org/ownership y RBAC definidos
- [ ] Evidence/Payment Governance revisados si aplica
- [ ] Audit/events definidos para cambios críticos
- [ ] Tests preceden implementación
- [ ] No se expone secreto ni se agrega backend paralelo
- [ ] Código, CI, merge, deploy y activación se medirán por separado

## 3. Arquitectura y autoridad

- Fuente de verdad de escritura:
- Read models/proyecciones:
- Módulos afectados:
- Contratos Zod:
- API/BFF/UI:
- Worker/queues:
- Agentes/tools:
- ADR requerido:

## 4. Datos y migración

- Cambio Prisma:
- SQL y checksum:
- Expand/contract:
- Backfill/shadow read:
- Compatibilidad durante deploy:
- Pre-deploy command:
- Rollback o forward-fix:
- Prueba de migración:

## 5. Seguridad y política

- Permisos:
- Tenant/org/resource scope:
- Step-up/aprobación:
- Auditoría:
- Riesgos de pagos/evidencia:
- Abuse cases:

## 6. Eventos, idempotencia y reconstrucción

- Productores:
- Outbox atómico:
- Consumers/receipts:
- Replay:
- DLQ:
- Rebuild:
- Correlation/traces:

## 7. Estrategia de implementación

### Fase A — Tests y contratos

- Tests rojos derivados del spec
- Schemas y contratos

### Fase B — Datos y dominio

- Migración aditiva
- Servicio/repositorio
- Invariantes y concurrencia

### Fase C — API/BFF/UI

- Endpoint y permisos
- Estados UX explícitos

### Fase D — Verificación local/CI

- Tests dirigidos
- Regresión
- Build/typecheck/lint
- Spec tooling

### Fase E — Integración

- PR y checks
- Merge SHA
- Config/migración pre-deploy

### Fase F — Producción

- Deployment terminal
- Health/readiness
- Canary autenticado
- Métricas/SLO
- Activación gradual
- Rollback ensayado/documentado

## 8. Riesgos

| Riesgo | Probabilidad | Impacto | Mitigación | Señal de rollback |
|---|---|---|---|---|
| | | | | |

## 9. Investigación externa

| Búsqueda primaria | Fuente | Decisión |
|---|---|---|
| | | |

## 10. Gates antes de tareas

- [ ] Archivos exactos identificados
- [ ] Migración y rollback definidos
- [ ] Tests ordenados antes del código
- [ ] Canary/feature flag definidos
- [ ] Evidencia requerida para cada estado de entrega
- [ ] Scope cabe en un PR reversible
