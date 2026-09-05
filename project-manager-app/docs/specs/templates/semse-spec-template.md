---
id: "[domain.feature]"
title: "[Feature Name]"
domain: "[platform | core | buildops | evidence | payments | trust | prometeo | agents | agro | labor | ui]"
sdd_version: "2.0"
version: "1.0"
status: "DRAFT"
owner: "semse-core"
risk: "medium"
code_status: "NOT_STARTED"
ci_status: "NOT_RUN"
merge_status: "UNMERGED"
deploy_status: "NOT_DEPLOYED"
activation_status: "INACTIVE"
migration_status: "NOT_APPLICABLE"
feature_flags: []
production_evidence: []
related_files: []
related_tests: []
related_endpoints: []
related_events: []
related_agents: []
last_verified: ""
---

# Spec: [Feature Name]

> Contrato ejecutable SDD 2.0. Completar todas las secciones aplicables y
> cambiar `status` a `APPROVED` antes de implementar. Código, CI, merge,
> deploy y activación se registran por separado; un deploy no demuestra
> activación ni verificación funcional.

## 1. Problema y resultado

**Para quién:** [actor]

**Problema:** [dolor de negocio, sin describir primero la solución técnica]

**Resultado esperado:** [cambio observable y medible]

## 2. Alcance

### Incluido

- [capacidad]

### Fuera de alcance

- [no-objetivo explícito]

## 3. Actores, permisos y límites

| Actor | Permiso backend | Alcance tenant/org/recurso | Puede | No puede |
|---|---|---|---|---|
| [actor] | `[permission]` | [scope] | [acción] | [restricción] |

- Tenant boundary:
- Ownership/resource policy:
- Step-up o aprobación humana:
- Datos `privacyCritical`:
- Requisitos de auditoría:

## 4. Escenarios y criterios de aceptación

### P1 — [journey crítico]

```gherkin
DADO [estado inicial]
CUANDO [actor realiza acción]
ENTONCES [resultado]
Y [evento, evidencia o auditoría]
```

Casos borde:

- [ ] [duplicado/reintento/concurrencia]
- [ ] [fuente vacía, caída o no autorizada]
- [ ] [aislamiento cross-tenant/cross-org]

## 5. Contratos

### API — `[METHOD] /v1/[path]`

```yaml
auth: required
permissions: []
input_schema:
output_schema:
errors:
  400:
  401:
  403:
  404:
  409:
effects:
  audit_log:
  domain_event:
  sse:
  payment_governance:
```

### UI

```yaml
surfaces: []
states:
  - loading
  - empty
  - ready
  - forbidden
  - degraded
  - error
required_behavior: []
```

### Agente/Prometeo

```yaml
tools: []
input_schema:
output_schema:
source_citations_required: true
approval_policy:
forbidden_behavior: []
```

## 6. FSM, eventos y reconstrucción

- Estado/FSM afectado:
- Invariantes: `docs/foundation/DOMAIN_INVARIANTS.md`
- Eventos declarados: `docs/foundation/EVENT_CATALOG.md`
- Productor + outbox atómico:
- Consumidores + idempotencia:
- Replay/rebuild:
- DLQ/compensación:

## 7. Datos y migración

- Modelos Prisma:
- Migración:
- Estrategia expand/contract:
- Backfill:
- Compatibilidad hacia atrás:
- Verificación de drift:
- Rollback de código:
- Rollback/forward-fix de datos:

> Nunca usar `prisma db push` para producción. Una migración aplicada no se
> edita: se restaura el archivo exacto o se reconcilia con el flujo oficial.

## 8. Observabilidad, despliegue y activación

- Métricas/SLO:
- Logs/traces/correlation:
- Health/readiness:
- Feature flags/allowlists:
- Plan de canary:
- Evidencia de producción requerida:
- Señal de rollback:
- Owner operativo:

## 9. Tests requeridos

- [ ] Unitarios del dominio/proyección
- [ ] Contrato API/BFF
- [ ] Permiso denegado y aislamiento tenant/org
- [ ] Validación y conflicto de estado
- [ ] Idempotencia/reintento/concurrencia
- [ ] Migración y compatibilidad
- [ ] UI loading/empty/forbidden/degraded/error
- [ ] Canary o smoke autenticado en producción

## 10. Mapa de implementación

### API

- `apps/api/src/...`

### Web

- `apps/web/...`

### Worker/Packages/DB

- `apps/worker/...`
- `packages/...`

### Tests

- `apps/.../test/...`

## 11. Investigación externa

- Reporte con tres búsquedas primarias:
- Aplicado ahora:
- Backlog:
- Descartado:

## 12. Gates de cierre

- [ ] Spec enlazado por `pnpm spec:index`
- [ ] Spec, plan, tasks, analyze y checklist coherentes
- [ ] Tests derivados del spec y verdes
- [ ] `pnpm spec:validate:strict` verde
- [ ] Migración reproducible y rollback/forward-fix documentado
- [ ] CI `PASS`
- [ ] PR fusionado y SHA registrado
- [ ] Deployment terminal `DEPLOYED`
- [ ] Activación/canary verificada por separado
- [ ] `production_evidence` y `last_verified` actualizados
- [ ] Sólo entonces `status: VERIFIED`
