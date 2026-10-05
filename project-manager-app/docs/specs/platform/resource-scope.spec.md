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
ci_status: "PASS"
merge_status: "MERGED"
deploy_status: "DEPLOYED"
activation_status: "INACTIVE"
migration_status: "NOT_APPLICABLE"
verification_scope: "partial:etapas-1-2a-2b-2c-workspace-memory-y-3A-merged-deployed:3B-guarda-informativa-en-PR-749-no-mergeada:prometeo-activos-y-ordenes-en-PR-779-no-mergeado:migracion-gradual-de-resolutores-pendiente:sin-smoke-autenticado-en-produccion"
feature_flags: []
production_evidence:
  - github:pr:742:merge:de33e974c88a9f2db9255277f2cdb37ecbc89c3a
  - github:pr:743:merge:4c80d8fefe47c18b6fb40c422bffd3b6b3cce7b0
  - github:pr:747:merge:cfddc36bffd5c8f8dc78e12fba78ff2920f4fc50
  - github:pr:748:merge:8163825c87d06288aa4faa31057361257f29ec44
  - railway:api:deployment:f55ce430-764b-46bc-8d59-bf984e344462:success:sha:8163825c87d06288aa4faa31057361257f29ec44
  - railway:web:deployment:691f9368-f8f2-4a14-bebe-f9cbe23262c2:success:sha:8163825c87d06288aa4faa31057361257f29ec44
  - github:actions:run:37024403026:runtime-provenance-gate:success:api-and-web-gitSha-equals-deploy-sha
  - "local:smoke-workspace-memory:2026-10-02:postgres-real-api-arrancada-2-tenants — NOT production evidence"
related_files:
  - scripts/architecture/resource-scope-inventory.mjs
  - docs/architecture/RESOURCE_SCOPE_GUARD.md
  - apps/api/src/common/resource-scope.resolver.ts
  - apps/api/src/common/resource-scope.module.ts
  - apps/api/src/modules/knowledge/workspace-memory.access-policy.ts
  - apps/api/src/modules/knowledge/knowledge.controller.ts
  - apps/api/src/modules/knowledge/workspace-memory.repository.ts
  - apps/api/src/common/resource-scope.ts
  - apps/api/src/modules/evidence/evidence.policy.ts
  - apps/api/src/modules/milestones/milestones.policy.ts
  - apps/api/src/modules/disputes/disputes.policy.ts
  - apps/api/src/modules/projects/projects.policy.ts
  - apps/api/src/modules/liens/lien-access.service.ts
  - apps/api/src/modules/prometeo/prometeo-access.policy.ts
  - apps/api/src/modules/prometeo/prometeo.controller.ts
  - apps/api/src/modules/prometeo/prometeo.repository.ts
related_tests:
  - tests/unit/resource-scope-inventory.test.mjs
  - apps/api/test/resource-scope-resolver.test.ts
  - apps/api/test/workspace-memory-access.test.ts
  - apps/api/test/resource-scope.test.ts
  - apps/api/test/prometeo-assets-orders-scope.test.ts
related_endpoints:
  - POST /v1/prometeo/assets
  - GET /v1/prometeo/assets
  - PATCH /v1/prometeo/assets/:id/status
  - POST /v1/prometeo/work-orders
  - GET /v1/prometeo/work-orders
  - PATCH /v1/prometeo/work-orders/:id/status
related_events: []
related_agents: []
last_verified: "2026-10-02"
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
   - **`workspace-memory` (semántica aprobada por el dueño el 2026-10-01; implementación en PR #747):** memoria compartida del workspace/recurso; boundary tenant + `ProjectScope`; `orgId` es provenance, no ACL (`query()` dejaba de coincidir con `search()` por filtrar por org). Cross-tenant ⇒ 404; otra org del mismo tenant ⇒ 403; org vacía nunca concede. No se infiere implementada hasta que #747 esté mergeada y desplegada.
3. **Etapa 3:** `ResourceScope` como dato de primera clase (resolutor único `resolveProjectScope(tenantId, projectId)` en lugar de los de cada módulo) y guarda de arquitectura que falle el CI si un controller con id de recurso no pasa por una política (modo informativo primero; **tocar CI requiere PR aparte**: el dueño lo autorizó el 2026-10-01 como PR separado, primero report-only y luego otro PR para volverlo bloqueante).
Cada etapa exige tests negativos cross-tenant y cross-org.

### 3.1 Decisión del dueño (2026-10-01): semántica de `WorkspaceMemory`
`WorkspaceMemory` es **memoria compartida del workspace/recurso**, no memoria privada de la organización que la escribió.
- **Workspaces de proyecto** (`workspaceId = project:<projectId>`): el boundary es **tenant + `ProjectScope`**. Antes de leer/buscar/listar hay que resolver el proyecto dentro del tenant y comprobar que el actor sea la org cliente, la org profesional asignada u `OPS_ADMIN`. Otro tenant (o proyecto inexistente) ⇒ **404**; mismo tenant pero actor fuera de las organizaciones participantes ⇒ **403**.
- `orgId` de la entrada es **provenance del productor**, no ACL: no decide quién lee. `sensitivity` es clasificación, no sustituto de ownership. La memoria **nunca autoriza una acción por sí misma**.
- Una org vacía nunca concede acceso; conocer o adivinar un `workspaceId` no basta.
- Si en el futuro se quiere memoria privada por org o usuario, requiere un campo/contrato explícito de audience/visibility; no se sobrecarga `orgId`.
- Otras formas de workspace (misma política, deny-by-default): `job:<id>` y `dispute:<id>` se resuelven a su `ProjectScope`; `worker:<userId>:*` solo el propio usuario u `OPS_ADMIN`; cualquier forma desconocida solo `OPS_ADMIN`.
- `queryAcrossTenant()` queda reservado a flujos internos/admin explícitos (cola de verificación) y exige `OPS_ADMIN` del mismo tenant; no es lectura general.
- Implementación: `WorkspaceMemoryAccessPolicy` (`apps/api/src/modules/knowledge/workspace-memory.access-policy.ts`) sobre `assertScopeAccess`; los endpoints `GET /v1/knowledge/workspace-memory` y `/search` la invocan antes de tocar el repositorio, y `query()` deja de filtrar por `orgId` (corrige la inconsistencia con `search()`).

### 3.2 Etapa 3 autorizada (2026-10-01)
El dueño autoriza un PR de CI **separado** para la guarda de arquitectura, **primero informativa (report-only, nunca bloquea CI)**: `ResourceScopeResolver` canónico (`tenantId + projectId → ProjectScope`) con migración gradual de resolutores duplicados, políticas de dominio encima del resolver común, e inventario de controllers/endpoints con identificador de recurso que no pasan por policy/scope resolver, con allowlist explícita y documentada (no un grep ingenuo como gate de seguridad). Tras un ciclo completo verde y revisión de falsos positivos, otro PR la vuelve bloqueante.

### 3.3 Etapa 3 — progreso
- **3A (este PR, sin CI):** `ResourceScopeResolver` canónico (`apps/api/src/common/resource-scope.resolver.ts`, módulo `ResourceScopeModule`): `resolveProjectScope` / `resolveJobScope` / `resolveDisputeScope` / `requireProjectScope`, siempre filtrado por el tenant del actor (otro tenant o inexistente ⇒ `null`/404). Primer consumidor: `WorkspaceMemoryAccessPolicy`. Las políticas de dominio siguen encima del resolver.
- **Contrato del resolver (regla vigente):** un recurso eliminado lógicamente **no concede alcance**. `resolveJobScope`, `resolveMilestoneScope` y `listAccessibleJobIds` filtran `deletedAt: null` ⇒ `null`/404 en el llamador (también para `OPS_ADMIN`). Consumidores de `resolveJobScope` afectados por esta regla: `tasks.service`, `vision-access.policy`, `PrometeoAccessPolicy` y `WorkspaceMemoryAccessPolicy` (workspaces `job:<id>`, §3.1). Los listados de ids (`listAccessibleProjectIds/JobIds`) enumeran todo por cursor y, por encima de un tope de seguridad, fallan cerrado (422) en lugar de truncar. Prueba: `resource-scope-resolver.test.ts` («job eliminado ⇒ null»).
- **Migración gradual pendiente (un módulo por PR, con sus pruebas; sin big bang):** `evidence.repository` (`resolveScope`), `milestones.repository`, `disputes.repository` (`toOwnership`), `projects.repository`, `payments.repository` / `payment-governance.*`, `trust.repository`, `liens` (`lien-access.service`), `bids`/`contracts`/`reservations`/`jobs` (ownership por job).
- **3B (PR de CI separado, report-only; en PR):** `scripts/architecture/resource-scope-inventory.mjs` + `.github/workflows/resource-scope-guard.yml` + `docs/architecture/resource-scope-allowlist.json` + `docs/architecture/RESOURCE_SCOPE_GUARD.md`. Guarda de arquitectura informativa que inventaría controllers/endpoints con identificador de recurso que no pasan por política/resolver, con allowlist explícita y documentada; nunca bloquea CI. Pasar a bloqueante es otro PR, tras un ciclo verde y revisión de falsos positivos.

### 3.4 Decisión del dueño (2026-10-04): propietario explícito en `prometeo` (activos y órdenes de trabajo)
Documentos, activos y órdenes de `prometeo` deben tener un **propietario explícito validado por el servidor**. `orgId` es obligatorio en `PrometeoDocument`, `PrometeoAsset` y `WorkOrder` (solo `projectId` es opcional) y siempre sale del actor autenticado, nunca del cuerpo de la petición.
- **Asociada a un proyecto o job** del tenant ⇒ rigen los permisos de ese proyecto/job (`read`: org cliente, org profesional asignada u `OPS_ADMIN` del tenant). Si una orden declara proyecto **y** job, el job debe ser el del proyecto (si no ⇒ 400). Un job eliminado lógicamente (`deletedAt`) no concede acceso. Un proyecto/job que ya no existe en el tenant solo lo ve `OPS_ADMIN`.
- **Sin asociación** ⇒ solo la org propietaria (`sameOrg`; la org vacía nunca coincide) u `OPS_ADMIN` del tenant. **Pertenecer al mismo tenant no concede acceso por sí solo.** Otro tenant ⇒ 404; sin relación ⇒ 403.
- **Listados**: sin `projectId` ⇒ solo filas propias sin asociación más las de proyectos/jobs en los que participa la org (consulta filtrada; los ids se enumeran por completo y, por encima de un tope de seguridad, falla cerrado con 422 en lugar de truncar); con `projectId` ⇒ exige participar en ese proyecto (404/403). `OPS_ADMIN` ve todo su tenant, nunca otro.
- **Implementación**: `PrometeoAccessPolicy` (`apps/api/src/modules/prometeo/prometeo-access.policy.ts`) sobre `ResourceScopeResolver` (`listAccessibleProjectIds/JobIds`, `jobBelongsToProject`). Pruebas: `apps/api/test/prometeo-assets-orders-scope.test.ts`.
- **Pendiente de confirmación del dueño (no implementado):** documentos. Propuesta: con `projectId` ⇒ permisos del proyecto; sin proyecto ⇒ solo la org propietaria u `OPS_ADMIN`; biblioteca compartida únicamente por marca explícita validada en el servidor. `search`, `rag-context` y `rag-query` deberán filtrar por documentos accesibles.

## 4. Criterios de aceptación (etapa 1)
1. Para toda combinación actor×ownership×relación, las políticas existentes dan el mismo resultado que el contrato (test de paridad).
2. Cross-tenant ⇒ 404 incluso para OPS_ADMIN; cross-org ⇒ 403.
3. Org vacía no concede acceso en ninguna política migrada.

## 5. Fuera de alcance
Cambiar permisos de rol (`@RequirePermissions`), el modelo de datos o el significado de `OPS_ADMIN`.

## 6. Gates de cierre
Etapas 2–3 · CI terminal · merge SHA · deploy · smoke autenticado multi-tenant · evidencia registrada.
