---
type: plan
feature: "Labor Engine — guard de ownership y destino en mutaciones de FreeProject (S0)"
domain: "labor"
spec: "docs/specs/labor/free-project-mutation-guard.spec.md"
version: "2.0"
status: "DRAFT"
branch: "fix/labor-s0-free-project-guard"
date: "2026-10-15"
---

# Plan técnico: guard de ownership y destino en mutaciones de FreeProject (S0)

> Prerrequisito: spec `APPROVED` con D1–D10 resueltas. Mientras el spec siga
> en `DRAFT`, este plan es una propuesta y **no autoriza código**. El plan
> separa implementación, merge, despliegue y activación.

## 1. Snapshot de verdad

- `origin/main` SHA: `83375e6` (2026-10-15, lectura de código).
- SHA desplegado API/Web: **no verificado** en esta sesión (sin acceso a
  Railway; no se consultó). Registrar antes de T-002.
- Estado de migraciones: sin cambios requeridos.
- Flags/allowlists: ninguno.
- Drift previo: `labor.engine-remediation` (APPROVED) exige ownership por
  `createdBy`; tres endpoints de FreeProject no lo aplican (spec §1 H1–H7).
- PRs abiertos revisados para no pisar trabajo: #936 (docs, mismo EPIC, sin
  código), #930 y #927 (field-memory/storage, sin solape de archivos).

## 2. Constitution check

- [ ] Spec aprobado antes de código — **pendiente (DRAFT)**
- [x] Tenant/org/ownership y RBAC definidos (spec §3)
- [x] Evidence/Payment Governance revisados: no aplica (spec §3)
- [x] Audit/events definidos para cambios críticos (spec §6, sujeto a D4)
- [x] Tests preceden implementación (Fase A)
- [x] No se expone secreto ni se agrega backend paralelo
- [x] Código, CI, merge, deploy y activación se medirán por separado

## 3. Arquitectura y autoridad

- **Fuente de verdad de escritura:** `FreeProject` vía
  `LaborEngineRepository` (Labor Engine, superficie actual; `field-ops` es
  legacy y no se toca).
- **Regla de Job destino:** `LaborEngineRepository.isJobAssignedToWorker`
  → `jobAssignmentWhere` — la misma que arma la lista del selector
  (`field-ops.repository.ts:210-216`). No se crea una tercera regla.
- **Módulos afectados:** `apps/api/src/modules/labor-engine/` únicamente.
- **Contratos Zod:** sin cambios; `freeProjectUpdateSchema` ya excluye
  `status`.
- **API/BFF/UI:** BFF passthrough sin cambios
  (`apps/web/app/api/semse/labor/free-projects/**`); UI sin cambios.
- **Worker/queues/agentes:** no aplica.
- **ADR requerido:** no.

## 4. Datos y migración

- Cambio Prisma: ninguno. FK de `convertedJobId` queda en backlog.
- Backfill: ninguno. Censo de sólo lectura sólo si D6 lo aprueba, ejecutado
  por el owner fuera de este PR.
- Compatibilidad durante deploy: total para clientes propios (no envían
  `status` en PATCH; no mutan proyectos ajenos).
- Rollback: revert del PR; no hay datos que deshacer.

## 5. Seguridad y política

- **Permisos:** se mantiene `@RequirePermissions("field-ops:write")`.
- **Scope:** `tenantId` + `createdBy = actor.userId` en búsqueda y escritura;
  Job destino con `tenantId` + `deletedAt: null` + `jobAssignmentWhere`
  usando `orgId`/`userId` del contexto autenticado, nunca del cuerpo.
- **Sin oráculo:** FreeProject ajeno e inexistente responden igual (404,
  D1); Job inexistente/eliminado/otro tenant/no asignado responden igual
  (403, D1).
- **Carrera (TOCTOU):** `convert` usa escritura condicional
  `updateMany({ where: { id, tenantId, createdBy, status: "active" } })`;
  `count = 0` → relectura scoped para distinguir 404 / 409 / idempotente.
  `archive` análogo con `status: { not: "archived" }`.
- **Destino del Job:** autorización evaluada en el momento de la petición
  (spec §4). No se bloquea la fila del Job: un borrado/desasignación
  concurrente produce el mismo estado que borrarlo justo después de
  convertir, que ya es posible y que ninguna FK impide.
- **Auditoría:** fila `AuditLog` con acciones de D4 insertada dentro de la
  misma `prisma.$transaction` interactiva que la escritura condicional
  (patrón de `evidence.repository.ts:162`); `ActorContextService.
  ensureActorContext` se llama antes de abrir la transacción porque hace
  upserts fuera de ella. Payload sólo ids, estados, `jobId`, `requestId`.
- **Abuse cases cubiertos:** N1–N14 del spec.

## 6. Eventos, idempotencia y reconstrucción

- Productores: AuditLog en la misma transacción que la mutación (D4). Si la
  inserción falla, la transacción se revierte: no hay transición confirmada
  sin audit, y el atajo idempotente de un reintento nunca oculta un audit
  perdido.
- Outbox/consumers/DLQ/replay: no aplica (sin bus).
- Idempotencia: reintento `convert` mismo `jobId` y `archive` repetido
  devuelven el registro sin escribir ni auditar (D3).
- Correlation: `requestId` del controlador llega al servicio y al AuditLog.

## 7. Estrategia de implementación

### Fase A — Tests rojos (antes de código)

1. `labor-engine.service.test.ts`: casos N1–N12, P1, P2 con el stub de
   repositorio existente; para cada rechazo, aserción de que no hubo
   llamada de escritura. El servicio **no** recibe `AuditService` (su
   constructor no cambia): el audit vive en el repositorio.
2. `labor-engine.repository.test.ts`: `where` de búsqueda/escritura incluye
   `createdBy`; conversión condicional con `status: "active"`; `count = 0`
   no produce segunda escritura; `updateMany` y `auditLog.create` usan el
   mismo cliente `tx` y el error del audit se propaga (el stub no prueba el
   rollback).
3. `labor-engine-free-project-integration.test.ts` (nuevo, BD real, se salta
   sin `DATABASE_URL`): fallo forzado del insert de audit → PostgreSQL
   conserva `status` y `convertedJobId`. Sólo datos sintéticos.
4. `labor-engine.controller.test.ts`: el controlador pasa `userId`/`orgId`/
   `requestId`; `status` en PATCH → 400; N13: metadata
   `REQUIRED_PERMISSIONS_KEY` = `["field-ops:write"]` en las tres rutas.
5. Ejecutar contra `main` y registrar el fallo (evidencia del gap).

### Fase B — Dominio/repositorio

1. Repositorio: `findOwnedFreeProject(tenantId, userId, id)`;
   `updateOwnedFreeProject(...)`; `convertOwnedFreeProject(...)` y
   `archiveOwnedFreeProject(...)` como `$transaction` interactiva:
   `updateMany` condicional + `tx.auditLog.create` sólo si `count = 1`. El
   repositorio inyecta `ActorContextService` y llama `ensureActorContext`
   antes de abrir la transacción; no se usa `AuditService.append` (cliente
   raíz, fuera de la transacción).
2. Servicio: firmas con actor `{ tenantId, orgId, userId, requestId }`;
   `convertToJob` = buscar propio → 404 | estado → 409/idempotente →
   `isJobAssignedToWorker` (regla según D8) → 403 → repositorio
   (`ensureActorContext` + transacción con escritura condicional y audit).
3. Mantener `updateFreeProject` rechazando `converted` (2.16) y extender a
   cualquier `status` (D2).

### Fase C — API

1. Controlador: pasar `a.userId`, `a.orgId`, `rid(req)`; rechazar `status`.
2. Sin cambios en BFF/UI; verificación manual de que el error se muestra.

### Fase D — Verificación local/CI

- `pnpm build:packages && pnpm --filter @semse/api build`
- `node --experimental-strip-types --test apps/api/test/labor-engine.*.test.ts`
- Con Postgres local (`infra/docker/compose.semse-mvp.yml`):
  `pnpm --filter @semse/api test:integration` para el rollback real; si no
  hay BD disponible, registrar `NOT_VERIFIED`, no inventar evidencia.
- `pnpm --filter @semse/api test:unit` (regresión), `pnpm typecheck`,
  `pnpm lint`, `pnpm spec:validate:strict`, `pnpm spec:index:check`.

### Fase E — Integración

- PR acotado al módulo + tests + spec/EVENT_CATALOG (si D4) +
  `DOMAIN_INVARIANTS.md` (si D10) + API surface. CI terminal.
  Merge sólo con autorización del owner; registrar SHA.

### Fase F — Producción

- Deploy API terminal; health no basta.
- Smoke autenticado con dos usuarios de prueba autorizados (spec §8);
  evidencia sin PII.
- Activación: inmediata al desplegar (D7). Rollback = revert.

## 8. Riesgos

| Riesgo | Probabilidad | Impacto | Mitigación | Señal de rollback |
|---|---|---|---|---|
| Un cliente no identificado dependía de PATCH `status` | Baja (contrato Zod no lo tiene; web/móvil no lo envían) | Medio | 400 explícito con mensaje que apunta a DELETE/S1 | 400 desde UI propia |
| `jobAssignmentWhere` rechaza un Job que la UI ofrecía | Muy baja (misma regla) | Medio | Test de paridad selector↔guard | 403 en convert desde UI propia |
| Audit falla dentro de la transacción | Baja | Bajo | Rollback de la transición; 5xx sin cambio; reintento seguro | Errores de audit en logs |
| Job borrado/desasignado entre la validación y la escritura | Muy baja (ventana de ms) | Bajo | Aceptado: mismo estado que borrarlo tras convertir; `convertedJobId` es referencia histórica (spec §4) | — |
| D8 rechazada (exigir asignación individual) | — | Medio | Alinear selector y `startTimer` en el mismo slice para no ofrecer Jobs que luego den 403 | 403 en convert desde UI propia |
| Datos ya alterados por el hueco | Desconocida | Medio | D6 censo de sólo lectura; no se puede atribuir sin audit previo | — |

## 9. Investigación externa

| Búsqueda primaria | Fuente | Decisión |
|---|---|---|
| Autorización por objeto (BOLA/IDOR) | OWASP API Security Top 10 2023 — API1 | Aplicar scope por objeto en cada mutación |
| Control de acceso a nivel operación | OWASP ASVS v4 §4.2 | Mismo principio; tests negativos |
| 404 vs 403 para recursos ajenos | Práctica de APIs públicas (p.ej. GitHub para repos privados) | Propuesto en D1 |

## 10. Gates antes de tareas

- [x] Archivos exactos identificados (spec §10)
- [x] Migración y rollback definidos (no hay migración; revert)
- [x] Tests ordenados antes del código (Fase A)
- [x] Canary/feature flag definidos (sin flag, D7; smoke §8)
- [x] Evidencia requerida para cada estado de entrega
- [x] Scope cabe en un PR reversible
- [ ] Spec `APPROVED`
