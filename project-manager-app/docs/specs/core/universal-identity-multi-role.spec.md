---
id: "core.universal-identity-multi-role"
title: "SPEC-CORE-005 — Identidad universal: múltiples capacidades por usuario"
domain: "core"
sdd_version: "2.0"
version: "1.0"
status: "DRAFT"
owner: "semse-core"
risk: "high"
code_status: "NOT_STARTED"
ci_status: "NOT_RUN"
merge_status: "UNMERGED"
deploy_status: "NOT_DEPLOYED"
activation_status: "INACTIVE"
migration_status: "NOT_APPLICABLE"
feature_flags: []
production_evidence: []
related_files:
  - packages/db/prisma/schema.prisma
  - apps/api/src/modules/auth/auth.service.ts
  - apps/api/src/modules/users/users.service.ts
  - apps/api/src/modules/users/users.policy.ts
  - apps/api/src/modules/organizations/organizations.service.ts
related_tests: []
related_endpoints: []
related_events: []
related_agents: []
last_verified: "2026-08-04"
---

# SPEC-CORE-005 — Identidad universal: múltiples capacidades por usuario

**Deriva de:** `docs/vision/VISION_PROMETEO_OS_2026.md` (principio "una cuenta,
múltiples capacidades, cualquier proyecto").
**Módulos afectados:** `apps/api/src/modules/auth/`,
`apps/api/src/modules/users/`, `apps/api/src/modules/organizations/`.
**Fase Matriz:** Programa transversal "Prometeo OS" (`ROADMAP.md`) — sin
dependencia de ninguna fase F0-F9.

> Contrato ejecutable SDD 2.0. `status: DRAFT` — no autoriza código hasta
> `APPROVED` por revisión humana.

## 1. Problema y resultado

**Para quién:** cualquier usuario que participa en más de un proyecto con
más de un rol (ej.: cliente en un proyecto de reforma de su casa, y
profesional independiente en otro proyecto donde ofrece sus servicios).

**Problema:** el producto asume hoy un rol fijo por sesión/usuario. Un
usuario que quiere actuar como cliente en un proyecto y como profesional en
otro tropieza con fricción de UX (selector de rol, navegación, permisos)
aunque el modelo de datos ya soporta la relación. `docs/AUDIT_REMEDIATION_PLAN.md`
ya documenta como síntoma la confusión entre el valor `PRO` en base de
datos y la etiqueta "Profesional" en UI — evidencia de que el producto
piensa en "un rol = una identidad", no en capacidades por proyecto.

**Resultado esperado:** un usuario puede tener membership con distinto
`roleId` en distintas `orgId` (o, dentro de una misma org, participar con
distintas capacidades en distintos proyectos) sin crear una cuenta nueva ni
pasar por un flujo de "cambiar de tipo de cuenta". La sesión ofrece un
selector de capacidad activa por contexto (proyecto/org), no un rol
grabado permanentemente en el usuario.

## 2. Alcance

### Incluido

- UX de selección de capacidad activa por proyecto/organización sobre el
  `Membership` ya existente.
- Reglas de qué combinaciones de rol son válidas simultáneamente para un
  mismo usuario (ej.: puede ser `CLIENT` en `orgA` y `PRO` en `orgB`; a
  definir en clarify si puede ser ambos dentro de la misma `orgId`).
- Resolución de qué rol/capacidad aplica cuando un usuario navega a un
  proyecto concreto (contexto activo).
- Reconciliación de la etiqueta UI vs. el valor de `Role.key` en DB
  (síntoma ya documentado en `AUDIT_REMEDIATION_PLAN.md`).

### Fuera de alcance

- Cambios al schema `Membership`/`Role`/`RolePermission`
  (`packages/db/prisma/schema.prisma:381-415`) — la PK compuesta
  `[userId, orgId, roleId]` ya permite múltiples roles por usuario/org; no
  se requiere migración para el caso base.
- Permisos financieros o de aprobación de pagos — cualquier cambio a
  quién puede aprobar/liberar pagos requiere spec de `payments` aparte.
- El rol "originador/facilitador" — spec propio,
  `docs/specs/core/originador-referral-program.spec.md`.
- Cambios a `Auth`/session signing (`packages/auth/src/`).

## 3. Actores, permisos y límites

| Actor | Permiso backend | Alcance tenant/org/recurso | Puede | No puede |
|---|---|---|---|---|
| Usuario autenticado con >1 `Membership` | permisos del `Role` activo en el contexto | tenant/org/proyecto del `Membership` correspondiente | cambiar de capacidad activa entre proyectos donde tiene `Membership` propio | asumir permisos de un `Role` sin `Membership` real para esa org |
| Admin de organización | `org:manage-members` (a confirmar contra permisos existentes) | su `orgId` | asignar/revocar `Membership` de terceros | crear `Membership` en org ajena |

- Tenant boundary: cada `Membership` sigue acotado a su `orgId`; no se
  introduce acceso cross-org.
- Ownership/resource policy: la capacidad activa se resuelve por el
  `orgId`/proyecto del recurso solicitado, no por un campo global en
  `User`.
- Step-up o aprobación humana: no aplica a este spec (sin superficie de
  pagos).
- Datos `privacyCritical`: ninguno nuevo.
- Requisitos de auditoría: cambio de capacidad activa se registra en audit
  log existente de sesión/contexto.

## 4. Escenarios y criterios de aceptación

### P1 — Usuario con Membership en dos orgs con roles distintos

```gherkin
DADO un usuario con Membership(orgA, CLIENT) y Membership(orgB, PRO)
CUANDO abre un proyecto que pertenece a orgB
ENTONCES el sistema resuelve su capacidad activa como PRO para ese contexto
Y no le ofrece acciones de CLIENT en ese proyecto
```

Casos borde:

- [ ] usuario sin ningún `Membership` en la org del recurso solicitado (debe ver `forbidden`, no una capacidad por defecto)
- [ ] usuario con más de un `Membership` en la misma `orgId` (definir en `clarify` si es válido o se bloquea a nivel de `@@id`)
- [ ] cambio de capacidad activa a mitad de sesión (no debe requerir logout/login)

## 5. Contratos

### API — `GET /v1/me/capabilities`

```yaml
auth: required
permissions: []
input_schema: "{ orgId?: string, projectId?: string }"
output_schema: "{ activeCapability: Role, availableCapabilities: Role[] }"
errors:
  400: orgId y projectId ambos ausentes cuando se requiere contexto
  401: sin sesión
  403: sin Membership en el contexto solicitado
effects:
  audit_log: "capability.viewed"
  domain_event: null
  sse: null
  payment_governance: null
```

### UI

```yaml
surfaces: [selector de capacidad en header/nav, contexto de proyecto]
states:
  - loading
  - empty
  - ready
  - forbidden
  - degraded
  - error
required_behavior: [selector visible solo si el usuario tiene >1 Membership; capacidad activa persiste por proyecto, no globalmente]
```

### Agente/Prometeo

```yaml
tools: []
input_schema: null
output_schema: null
source_citations_required: false
approval_policy: none
forbidden_behavior: [Prometeo no debe inferir ni asumir una capacidad no respaldada por un Membership real]
```

## 6. FSM, eventos y reconstrucción

- Estado/FSM afectado: ninguno nuevo; se lee el `Membership` existente.
- Invariantes: a documentar en `docs/foundation/DOMAIN_INVARIANTS.md` en `clarify`.
- Eventos declarados: ninguno nuevo previsto (lectura, no mutación de estado de negocio).
- Productor + outbox atómico: no aplica.
- Consumidores + idempotencia: no aplica.
- Replay/rebuild: no aplica.
- DLQ/compensación: no aplica.

## 7. Datos y migración

- Modelos Prisma: sin cambios (`Membership`, `Role`, `RolePermission` ya soportan el caso base).
- Migración: ninguna prevista; a confirmar en `clarify` si se requiere un campo de "capacidad activa por defecto" en `Membership` o se resuelve siempre por contexto.
- Estrategia expand/contract: no aplica sin migración.
- Backfill: no aplica.
- Compatibilidad hacia atrás: usuarios con un solo `Membership` no ven cambio de comportamiento.
- Verificación de drift: no aplica.
- Rollback de código: revertir el endpoint/selector nuevo, sin efecto en datos.
- Rollback/forward-fix de datos: no aplica (sin migración).

## 8. Observabilidad, despliegue y activación

- Métricas/SLO: tasa de uso del selector de capacidad, errores 403 por contexto sin `Membership`.
- Logs/traces/correlation: `capability.viewed`/`capability.switched` en audit log existente.
- Health/readiness: sin impacto.
- Feature flags/allowlists: recomendable lanzar detrás de flag para evaluar UX antes de exponer a todos los usuarios con multi-membership.
- Plan de canary: `tenant_default`, igual que el resto del programa F3-F9.
- Evidencia de producción requerida: capturas de selector funcionando con usuario real multi-org.
- Señal de rollback: aumento de 403 inesperados o confusión reportada en soporte.
- Owner operativo: semse-core.

## 9. Tests requeridos

- [ ] Unitarios de resolución de capacidad activa por contexto
- [ ] Contrato API/BFF de `GET /v1/me/capabilities`
- [ ] Permiso denegado y aislamiento tenant/org (usuario sin Membership en la org solicitada)
- [ ] Validación y conflicto de estado (Membership duplicado, si se permite)
- [ ] Idempotencia/reintento/concurrencia (cambio de capacidad activa)
- [ ] Migración y compatibilidad — N/A si no hay migración
- [ ] UI loading/empty/forbidden/degraded/error del selector
- [ ] Canary o smoke autenticado en producción

## 10. Mapa de implementación

### API

- `apps/api/src/modules/auth/`
- `apps/api/src/modules/users/`
- `apps/api/src/modules/organizations/`

### Web

- `apps/web/` — selector de capacidad en header/nav

### Worker/Packages/DB

- `packages/db/prisma/schema.prisma` (solo lectura de `Membership`)

### Tests

- `apps/api/src/modules/users/*.spec.ts` (a crear)

## 11. Investigación externa

- Reporte con tres búsquedas primarias: pendiente — a completar en `clarify`.
- Aplicado ahora: N/A (DRAFT).
- Backlog: N/A.
- Descartado: N/A.

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
