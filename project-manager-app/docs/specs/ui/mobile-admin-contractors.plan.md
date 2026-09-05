---
type: plan
feature: "Mobile Admin Contractors — Fase 7e de apps/mobile"
domain: "ui"
spec: "docs/specs/ui/mobile-admin-contractors.spec.md"
version: "1.0"
status: "APPROVED"
branch: "claude/roadmap-continuation-vhmve9"
date: "2026-08-26"
---

# Plan técnico: Mobile Admin Contractors — Fase 7e de apps/mobile

> Prerrequisito: spec `APPROVED`.

## 1. Snapshot de verdad

- Rama de trabajo (`claude/roadmap-continuation-vhmve9`) es idéntica a
  `origin/main` al iniciar esta sesión — trae Fase 7a/7b ya mergeadas (PR
  #583).
- `docs/specs/ui/mobile-admin-disputes.spec.md` (`IMPLEMENTED`) es el
  precedente directo de este spec — mismo patrón de tab nuevo + cliente
  API dedicado sin BFF.
- **Drift confirmado:** `apps/web/app/(app)/admin/contractors/page.tsx` usa
  un `LeadStatus` local (`"won"`/`"archived"`) y un campo `trade` que no
  coinciden con `apps/api/src/modules/contractor/contractor.service.ts`
  (`LeadStatus` real, campo `jobType`, sin `conversionRate` en
  `getStats`) — verificado leyendo ambos archivos. Este plan construye
  `apps/mobile`'s cliente contra el contrato real del backend, documentado
  en spec §5; no se toca `apps/web` (fuera de alcance).
- **Drift de superficie:** `AdminContractorsScreen`/`src/api/contractor.ts`
  no existen todavía, confirmado por grep.

## 2. Constitution check

- [x] Spec aprobado antes de código — este documento se escribe con spec ya
      `APPROVED`.
- [x] Tenant/org/ownership y RBAC definidos — spec §3, `jobs:read`/
      `jobs:create` ya otorgados a `OPS_ADMIN`, scoping por `tenantId`+
      `orgId` verificado en `contractor.service.ts`.
- [x] Evidence/Payment Governance revisados — sin evidencia ni pagos
      alcanzables desde esta superficie; crear un lead es aditivo, no
      determina ningún resultado financiero.
- [x] Audit/events definidos — no aplica, ni `GET` ni `POST` emiten
      `AuditLog` hoy.
- [x] Tests preceden implementación — Fase A de este plan.
- [x] No se expone secreto ni se agrega backend paralelo.
- [x] Código, CI, merge, deploy y activación se miden por separado.

## 3. Arquitectura y autoridad

- **Módulos afectados (API):** ninguno — se reusan `GET`/`POST
  /v1/contractor/leads[/stats]` tal cual.
- **Contratos Zod:** ninguno nuevo — el backend no tiene un schema Zod
  dedicado para leads; `src/api/contractor.ts` define tipos TS locales
  espejando `contractor.service.ts` (mismo patrón que otros clientes de
  `apps/mobile` cuando el backend no expone un contrato Zod compartido).
- **API/BFF/UI:** solo UI, mismo patrón sin-BFF que el resto de
  `apps/mobile`.
- **ADR requerido:** no — replica el patrón ya establecido por
  `AdminDisputesScreen`/`worker/DisputesScreen` (lista + formulario-toggle
  de creación).

## 4. Datos y migración

No aplica.

## 5. Seguridad y política

- **Permisos:** `jobs:read`, `jobs:create`, ambos ya otorgados a
  `OPS_ADMIN` en `packages/db/prisma/seed.ts`. Sin permisos nuevos, sin
  exponer `PATCH`/`DELETE`/`suggest-estimate`/`create-estimate` en esta
  fase.
- **Tenant/org/resource scope:** delegado 100% al backend existente
  (`ContractorService` ya filtra por `tenantId`+`orgId` del contexto de
  request), sin lógica de scope nueva del lado cliente.
- **Abuse cases:** creación de leads sin límite de tasa — mismo riesgo que
  ya existe en `apps/web`'s Contractors page contra el mismo endpoint; no
  es una regresión introducida por esta fase, y no hay rate-limiting nuevo
  que agregar del lado backend en este cambio (fuera de alcance de una
  fase de UI).

## 6. Eventos, idempotencia y reconstrucción

No aplica.

## 7. Estrategia de implementación

### Fase A — Tests y contratos

- `AdminContractorsScreen.test.tsx`: loading/empty/ready/error, listado con
  status+stats derivados, creación de lead, ausencia de acciones de
  status/delete/estimate.

### Fase B — Datos y dominio

No aplica.

### Fase C — API/BFF/UI

- `src/api/contractor.ts` — nuevo cliente (`fetchLeads`, `fetchLeadStats`,
  `createLead`), tipos TS contra el contrato real del backend (spec §5).
- `src/screens/admin/AdminContractorsScreen.tsx` — nuevo, mismo patrón de
  formulario-toggle que `worker/DisputesScreen.tsx` + cards de stats que
  `AdminDashboardScreen.tsx`.
- `src/navigation/AdminTabNavigator.tsx` — agregar tab `Contractors` entre
  `Disputes` y `Settings`.
- `src/navigation/types.ts` — `AdminTabParamList` gana `Contractors: undefined`.
- `src/navigation/RoleGate.tsx` — comentario de `TARGET_PRIORITY`
  actualizado (Contractors sale de la lista de pendientes).
- `apps/mobile/README.md` — actualizar sección Admin.

### Fase D — Verificación local

- `pnpm --filter @semse/mobile test` — suite completa.
- `pnpm --filter @semse/mobile check` (`tsc --noEmit`).
- `pnpm spec:validate:strict`, `pnpm spec:index`.

### Fase E — Integración

- Commit sobre un PR nuevo en la rama designada de esta sesión
  (`claude/roadmap-continuation-vhmve9`).

### Fase F — Producción

- Sin servicio backend que desplegar — build EAS `preview` + smoke manual
  con cuenta `OPS_ADMIN` real que tenga leads visibles en su org, mismo
  estándar que Fase 7a/7b.
- **Rollback:** no promover el build `preview` a `production` hasta smoke
  manual confirmado; sin flag que revertir.

## 8. Riesgos

| Riesgo | Probabilidad | Impacto | Mitigación | Señal de rollback |
|---|---|---|---|---|
| Confundir este scope acotado con el resto de Fase 7 (status change, delete, estimate, finance, disputes management, labor-engine) | media | medio (viola AGENTS.md, mezcla una mutación de flujo de venta o financiera sin su propio spec) | Este plan solo cubre lo listado en spec §2 "Incluido"; cualquier acción mutante sobre un lead existente necesita su propio spec | PR que agrega un botón de cambio de status/estimate bajo este cambio → rechazar en review |
| Replicar el drift de tipos de `apps/web`'s Contractors page (`"won"`/`"archived"`, campo `trade`, `conversionRate`) en mobile | baja (ya verificado y documentado en spec §5) | medio (UI mostraría labels/counts que nunca matchean datos reales) | `src/api/contractor.ts` se escribió leyendo `contractor.service.ts` directamente, no copiando `apps/web`'s tipos | Un test que compara un status/stat contra un valor que el backend nunca produce fallaría primero |

## 9. Investigación externa

No aplica.

## 10. Gates antes de tareas

- [x] Archivos exactos identificados (§7 Fase C)
- [x] Migración y rollback definidos — N/A, documentado
- [x] Tests ordenados antes del código (Fase A antes de Fase C)
- [x] Canary/feature flag definidos — sin flag; canary = build EAS preview + smoke manual
- [x] Evidencia requerida para cada estado de entrega
- [x] Scope cabe en un cambio reversible — solo `apps/mobile` + docs, revertible con `git revert`
