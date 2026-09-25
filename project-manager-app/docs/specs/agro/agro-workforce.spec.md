---
id: "agro.workforce-taxonomy"
title: "Agro Workforce Taxonomy — oficios, especialidades, capacidades y verificación"
domain: "agro"
sdd_version: "2.0"
version: "1.0"
status: "IMPLEMENTED"
owner: "semse-core"
risk: "medium"
code_status: "COMPLETE"
ci_status: "NOT_RUN"
merge_status: "UNMERGED"
deploy_status: "NOT_DEPLOYED"
activation_status: "INACTIVE"
migration_status: "PENDING"
feature_flags: []
production_evidence: []
related_files:
  - apps/api/src/modules/agro/agro-farm-policy.ts
  - apps/api/src/modules/agro/agro-farm-access.service.ts
  - apps/api/src/modules/agro/agro-workforce.domain.ts
  - apps/api/src/modules/agro/agro-workforce.repository.ts
  - apps/api/src/modules/agro/agro-workforce.service.ts
  - apps/api/src/modules/agro/agro-workforce.controller.ts
  - packages/db/prisma/migrations/20260925120000_agro_workforce_incidentops/migration.sql
  - packages/auth/src/rbac.ts
  - apps/web/app/agro/[farmId]/workforce/page.tsx
  - apps/web/app/agro/[farmId]/workforce/[workerId]/page.tsx
related_tests:
  - apps/api/test/agro-farm-policy.test.ts
  - apps/api/test/agro-workforce.service.test.ts
  - apps/api/test/agro-workforce-incidents-integration.test.ts
related_endpoints:
  - workforce/catalog
  - farms/:farmId/members
  - farms/:farmId/workforce/matrix
  - farms/:farmId/workers/:workerId
  - farms/:farmId/worker-capabilities/:workerCapabilityId/verify
  - farms/:farmId/worker-capabilities/:workerCapabilityId/revoke
related_events: []
related_agents: []
last_verified: "2026-09-25"
---

# Spec: Agro Workforce Taxonomy

> Aprobación: solicitud explícita del propietario de producto en la sesión del
> 2026-09-25 (consolidación Semse Agro, PR1). Contexto AS-IS y decisiones en
> [AGRO_AS_IS_AUDIT_2026-09-25.md](./AGRO_AS_IS_AUDIT_2026-09-25.md).

## 1. Problema y resultado

**Para quién:** propietario/administrador de finca, supervisor, trabajador, profesionales (veterinario, agrónomo, técnico).

**Problema:** Semse no sabe qué sabe hacer cada persona en una finca. "Porcicultor" no dice si alguien sabe manejar lechones, ni quién lo comprobó.

**Resultado:** cada persona tiene oficios, especialidades y capacidades con nivel y estado; cada verificación deja registro de quién, cómo, cuándo, con qué evidencia y con qué rol de finca.

## 2. Alcance

Incluido: membresía de finca (`AgroFarmMember`), catálogo global extensible (`AgroRole`, `AgroSpecialty`, `AgroRoleSpecialty`, `AgroCapability` jerárquica), `AgroWorkerRole`, `AgroWorkerCapability` (BASIC…EXPERT; SELF_REPORTED, IN_REVIEW, VERIFIED, REJECTED, EXPIRED, REVOKED), `AgroCapabilityVerification` (solo se añaden registros, nunca se editan).

Fuera de alcance: catálogo por finca, archivar entradas del catálogo, credenciales externas (títulos, carnés), portabilidad firmada (DID/VC).

## 3. Actores, permisos y límites

| Actor | Permiso backend | Alcance | Puede | No puede |
|---|---|---|---|---|
| Trabajador | `agro:read`, `agro:report` | fincas donde es miembro ACTIVE | autodeclarar capacidades, pedir revisión, aportar evidencia propia, ver su perfil | ver perfiles ajenos, verificar |
| Supervisor | `agro:report`, `agro:workforce:verify` | su finca | asignar oficios/capacidades, verificar/revocar capacidades estándar | verificar capacidades `requiresProfessional`, gestionar miembros |
| Propietario / administrador | `agro:write` | su finca | gestionar miembros (solo el propietario concede MANAGER) | verificar capacidades profesionales |
| Veterinario / agrónomo / técnico / especialista | `agro:workforce:verify` | fincas donde es miembro | verificar capacidades estándar y profesionales | auto-verificarse |
| OPS_ADMIN | `agro:workforce:admin` | catálogo global | crear oficios, especialidades y capacidades | operar fincas de las que no es miembro |

- Límite de aislamiento: la finca (`AgroFarm.ownerId` + `AgroFarmMember` ACTIVE). Quien no es miembro recibe 404, así no se revela que la finca existe.
- Auditoría: `AgroAuditEvent` (`member.*`, `worker_role.assigned`, `capability.declared|redeclared|review_requested|verified|rejected|revoked`), escrita en la misma transacción que el cambio.
- `privacyCritical`: no (no hay datos de salud humana; la evidencia puede contener imágenes de personas → acceso restringido a miembros).

## 4. Escenarios

```gherkin
DADO un trabajador miembro con "lechones_manejo" autodeclarada
CUANDO un supervisor la verifica con una foto de la misma finca
ENTONCES queda VERIFIED con nivel evaluado, verificador, método y evidencia
Y se registra capability.verified en AgroAuditEvent
```

Casos límite cubiertos por tests: verificar sin evidencia cuando es obligatoria → 400; evidencia de otra finca → 400; verificarse a uno mismo → 403; supervisor verificando capacidad profesional → 403; volver a declarar una capacidad VERIFIED → 409; persona que no es miembro → 404; revocar sin motivo → 400.

## 5. Contratos

`GET v1/agro/workforce/catalog` · `POST v1/agro/workforce/catalog/{roles|specialties|capabilities}` · `GET v1/agro/memberships` · `GET|POST v1/agro/farms/:farmId/members` · `PATCH v1/agro/farms/:farmId/members/:memberId` · `GET v1/agro/farms/:farmId/workforce/matrix` · `GET v1/agro/farms/:farmId/workers/:workerId` (`me`) · `POST …/workers/:workerId/{roles|capabilities}` · `POST v1/agro/farms/:farmId/worker-capabilities/:id/{request-review|evidence|verify|revoke}` · `GET …/timeline`. Validación con `parseWithSchema` (400).

## 6. FSM

`SELF_REPORTED → IN_REVIEW → VERIFIED | REJECTED`; `VERIFIED → REVOKED`; `VERIFIED → EXPIRED` al leer, cuando vence `expiresAt`; `REJECTED | REVOKED | EXPIRED → SELF_REPORTED` al volver a declarar. Sin eventos de dominio: `EVENT_CATALOG.md` no tiene eventos Agro (pendiente, §7 del AS-IS).

## 7. Datos y migración

Migración aditiva `20260925120000_agro_workforce_incidentops` con seed idempotente (`ON CONFLICT (key) DO NOTHING`). Sin backfill. Rollback: el código anterior ignora las tablas nuevas.

## 9. Tests

Unitarios (política, dominio, servicio), permisos denegados, aislamiento por finca, integración HTTP contra Postgres real y UI verificada en navegador.
