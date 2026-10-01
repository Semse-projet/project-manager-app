---
id: "platform.resource-scope"
title: "Contrato común ResourceScope (tenant + organización + recurso)"
domain: "platform"
sdd_version: "2.0"
version: "0.1"
status: "APPROVED"
owner: "semse-core"
risk: "high"
code_status: "IN_PROGRESS"
ci_status: "NOT_RUN"
merge_status: "UNMERGED"
deploy_status: "NOT_DEPLOYED"
activation_status: "INACTIVE"
migration_status: "NOT_APPLICABLE"
feature_flags: []
production_evidence: []
related_files:
  - apps/api/src/common/resource-scope.ts
  - apps/api/src/modules/evidence/evidence.policy.ts
  - apps/api/src/modules/milestones/milestones.policy.ts
  - apps/api/src/modules/disputes/disputes.policy.ts
  - apps/api/src/modules/projects/projects.policy.ts
  - apps/api/src/modules/liens/lien-access.service.ts
related_tests:
  - apps/api/test/resource-scope.test.ts
related_endpoints: []
related_events: []
related_agents: []
last_verified: "2026-10-01"
---

# Spec: Contrato común ResourceScope (C51)

> **Aprobado por el dueño en sesión (2026-10-01)**: "crear un contrato común ResourceScope, pero migrarlo por etapas; no big bang; primero endpoints P0/sensibles adaptando las políticas existentes; después el resto; cada migración debe traer tests negativos cross-tenant/cross-org."

## 1. Problema
Cada módulo repetía la misma regla de alcance (OPS_ADMIN o org cliente o org profesional) con copias que divergían: solo `liens` protegía el caso de **org vacía** (`"" === ""` concedía acceso a un actor sin org sobre un proyecto sin profesional asignado). No había un único sitio donde probar tenant/org/recurso.

## 2. Contrato (`apps/api/src/common/resource-scope.ts`)
- `ProjectScope = { tenantId, clientOrgId, assignedProOrgId }`, resuelto **siempre desde la base filtrado por tenant** por el llamador.
- Relaciones (`ScopeAccess`): `read` (cliente o profesional), `client`, `pro`, `ops` (solo OPS_ADMIN).
- Reglas: OPS_ADMIN pasa la regla de organización **pero no cruza tenants**; un recurso de otro tenant = **404** (sin oráculo de existencia), otro org del tenant = **403**; una org vacía/ausente **nunca** coincide con nada (`sameOrg`).
- Las políticas de dominio **delegan** en el contrato y conservan API pública y mensajes.

## 3. Etapas (sin big bang)
1. **Etapa 1 (este PR):** contrato + paridad probada + política delegada en evidence, milestones, disputes, projects, liens; `organizations` y `trust` usan `sameOrg`/`isOpsAdmin`.
2. **Etapa 2:** resto de políticas con la misma forma (`ratings`, `originator`, `users`, `contributor-program`, `domain-events`) y los servicios que comparan `orgId` a mano. Inventario por grep de `orgId ===` / `OPS_ADMIN` fuera de `*.policy.ts`.
   - **2a (hecha):** comparaciones de `orgId` a mano **que deciden acceso** en `jobs` (servicio + repositorio), `materials`, `incidents`, `change-orders`, `contracts` y `reservations`, migradas a `sameOrg`. **Dirección importante:** donde la igualdad *concede* acceso se aprieta (`sameOrg`); donde la igualdad *prohíbe* (p. ej. «el dueño no puede reservar su propio job», `reservations.create`) NO se toca, porque `sameOrg` la aflojaría con orgs vacías. Hallazgo real cerrado: `assertTransitionAuthorized` comparaba contra `professionalOrgId ?? ""`, de modo que un actor con org vacía podía transicionar un job sin profesional asignado.
   - **2b (PR #743):** comparaciones de `orgId` a mano en `buildops-plan-approval`, `buildops-legacy-promotion`, `intake-operations-bridge`, `travel`, `bids`, `budget-intelligence`, `live-sessions.resource-access` y `ratings`, migradas a `sameOrg` con la misma regla de dirección.
   - **2c (inventariada, sin cambio de código):** `originator`, `users`, `contributor-program` y `domain-events` **no autorizan por org**: la propiedad es por `userId` (más `OPS_ADMIN` y tenant); `orgId` solo se registra en auditoría/eventos. No hay igualdad de org que migrar; el contrato queda fijado por `c51-stage2c-user-scoped.test.ts` (misma org u org vacía no conceden acceso; cross-tenant denegado).
   - **Pendiente:** `workspace-memory` (`workspace-memory.repository.ts` compara `input.orgId &&` opcional): requiere definir primero su semántica de ownership/scope; no se toca hasta entonces.
3. **Etapa 3:** `ResourceScope` como dato de primera clase (resolutor único `resolveProjectScope(tenantId, projectId)` en lugar de los de cada módulo) y guarda de arquitectura que falle el CI si un controller con id de recurso no pasa por una política (modo informativo primero; **tocar CI requiere PR aparte autorizado**).
Cada etapa exige tests negativos cross-tenant y cross-org.

## 4. Criterios de aceptación (etapa 1)
1. Para toda combinación actor×ownership×relación, las políticas existentes dan el mismo resultado que el contrato (test de paridad).
2. Cross-tenant ⇒ 404 incluso para OPS_ADMIN; cross-org ⇒ 403.
3. Org vacía no concede acceso en ninguna política migrada.

## 5. Fuera de alcance
Cambiar permisos de rol (`@RequirePermissions`), el modelo de datos o el significado de `OPS_ADMIN`.

## 6. Gates de cierre
Etapas 2–3 · CI terminal · merge SHA · deploy · smoke autenticado multi-tenant · evidencia registrada.
