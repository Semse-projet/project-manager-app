---
type: plan
feature: "Jobs & Bids Event Projection for Agent Context"
domain: "operations"
spec: "docs/specs/operations/jobs-bids-event-projection.spec.md"
version: "1.1"
status: "DRAFT"
branch: "feat/jobs-bids-event-projection"
date: "2026-08-17"
---

# Plan técnico: Jobs & Bids Event Projection for Agent Context

> Prerrequisito: spec `APPROVED`. **2026-08-17: el spec pasó de `DRAFT` a
> `APPROVED`** tras una pasada de verificación contra el código real (ver
> `docs/specs/operations/jobs-bids-event-projection.spec.md`), con
> autorización explícita del dueño del repo para llevar los specs
> `DRAFT`/`REVIEW` pendientes del proyecto hasta `APPROVED` en esa sesión.
> Ese cambio de estado **solo desbloquea el gate de "spec aprobado antes de
> código" (§2 de este plan)** — no implica que este plan en sí ya fue
> revisado/aprobado, ni que ninguna Fase de §7 empezó a ejecutarse. Este
> documento sigue en `DRAFT` hasta que alguien lo revise como plan técnico
> propio.

## 1. Snapshot de verdad

- `origin/main` SHA: por confirmar al momento de implementar (`git log
  origin/main -1`) — no asumir el mismo SHA que quedó registrado en
  `ROADMAP.md` al 2026-08-04 (`114cb9ca`), puede haber avanzado.
- SHA desplegado API/Web: por confirmar vía `railway status`.
- Estado de servicios: F1-A..F1-E y F3 ya están en `main` y desplegados
  (confirmado en `ROADMAP.md`); F1-F (cierre transversal del dispatch
  genérico) sigue pendiente — es la Fase 0 de este plan, no algo ya hecho.
- Estado de migraciones: ninguna migración de esta spec existe todavía.
- Flags/allowlists: `SEMSE_EVENT_TYPE_ALLOWLIST`/`SEMSE_EVENT_CONSUMER_ALLOWLIST`
  hoy solo contienen `evidence.uploaded.v1`/`evidence-readiness.v1` y
  `project.lifecycle-source-changed.v1`/`project-lifecycle-projection.v1`
  (según el estado documentado en F3). Los cuatro flags
  `SEMSE_JOBS_PROJECTION_*` de esta spec no existen aún.
- Drift o deuda previa: `jobs.service.ts` ya emite eventos vía
  `DomainEventBus` (no outbox) en tres puntos — no es deuda a limpiar en
  este plan, es una decisión de diseño explícita que este plan respeta
  (dual-write, ver spec sección 6).

## 2. Constitution check

- [x] Spec aprobado antes de código — **resuelto 2026-08-17**, el spec pasó
      a `APPROVED` (ver nota de estado arriba). Este plan sigue sin haber
      empezado ninguna de sus Fases (§7); solo se levantó el bloqueo que
      impedía iniciarlas.
- [x] Tenant/org/ownership y RBAC definidos — spec sección 3, sin permisos
      nuevos (se reutilizan `domain-events:read/replay` y `EVENT_CONSUMER`).
- [x] Evidence/Payment Governance revisados — fuera de alcance explícito;
      el blast-radius check (Fase D) confirma que `PaymentEscrow`/
      `Milestone`/`Contract` no se tocan.
- [x] Audit/events definidos para cambios críticos — spec sección 6 y 8.
- [x] Tests preceden implementación — Fase A de este plan.
- [x] No se expone secreto ni se agrega backend paralelo — reutiliza
      `apps/api`, no crea servicio nuevo.
- [x] Código, CI, merge, deploy y activación se medirán por separado —
      igual que F3 (ver frontmatter con columnas independientes).

## 3. Arquitectura y autoridad

- Fuente de verdad de escritura: `Job`/`Bid` (Prisma), sin cambio — la
  proyección nunca escribe sobre ellos.
- Read models/proyecciones: `JobsBidsProjection` (nueva), mismo patrón CAS
  que `ProjectLifecycleProjection`.
- Módulos afectados: `jobs`, `bids`, `domain-events`, `ai-models/context`,
  `agents` (solo como consumidor, sin cambio de código en
  `agent-trigger-router.service.ts`).
- Contratos Zod: 6 schemas de evento nuevos/versionados en
  `packages/schemas/src/domain-events-v2.schema.ts`, siguiendo el shape de
  `evidenceUploadedV1EventSchema`.
- API/BFF/UI: sin cambio de superficie — ver spec sección 5.
- Worker/queues: reutiliza `semse-domain-events` (BullMQ), sin cola nueva.
- Agentes/tools: ninguno nuevo — los agentes existentes se benefician sin
  cambio de su propio código, porque el cambio ocurre dentro de
  `buildContext()`.
- ADR requerido: no — este trabajo es una aplicación directa de
  `ADR-022-transactional-outbox-bullmq.md`, ya aceptado, a un dominio
  nuevo. No introduce una decisión arquitectónica nueva.

## 4. Datos y migración

- Cambio Prisma: `model JobsBidsProjection` (ver spec sección 7).
- SQL y checksum: se genera con `pnpm --filter @semse/db prisma migrate dev
  --name jobs_bids_projection`; el checksum se registra en este plan una
  vez generado (no antes — no inventar hashes).
- Expand/contract: solo expand, tabla nueva.
- Backfill/shadow read: no aplica — proyección se puebla de eventos nuevos
  hacia adelante; jobs/bids existentes usan fallback hasta que un evento
  los reconstruya.
- Compatibilidad durante deploy: total, opt-in por flag y tenant.
- Pre-deploy command: `pnpm db:migrate` estándar del repo.
- Rollback o forward-fix: no borrar tabla; revertir código si es
  necesario, la migración aditiva no requiere `down` destructivo.
- Prueba de migración: aplicar local contra Postgres del
  `docker-compose.harness.yml`/`infra/docker/compose.semse-mvp.yml` antes
  de PR.

## 5. Seguridad y política

- Permisos: ninguno nuevo (ver spec sección 3).
- Tenant/org/resource scope: proyección `tenantId`-scoped, igual que F3.
- Step-up/aprobación: no aplica.
- Auditoría: `AuditLog` vía el mismo mecanismo que `DomainEventBus.emit()`
  ya usa hoy para jobs, más `DomainEventConsumption` para el lado del
  consumer.
- Riesgos de pagos/evidencia: el riesgo real no es de pagos — es que el
  read-through introduzca una nueva causa de falla en el path
  `/prometeo/chat`, que hoy llama `buildContext()` sin `.catch()`. Ver
  Fase C, el fallback es obligatorio, no opcional.
- Abuse cases: ninguno nuevo identificado — es lectura derivada de datos
  ya accesibles al mismo actor por la query directa existente.

## 6. Eventos, idempotencia y reconstrucción

- Productores: `bids.repository.ts` (`create`, `accept`),
  `jobs.repository.ts` (`create`, `updateStatus`) — ver spec sección 6
  para el detalle de dual-write en jobs.
- Outbox atómico: sí, dentro del mismo `$transaction` Prisma que la
  escritura de negocio, siguiendo `evidence.repository.ts:116-175` como
  plantilla exacta (idempotency key derivada, pre-check por
  `[tenantId, idempotencyKey]`, fallback `P2002`).
- Consumers/receipts: `jobs-bids-projection.v1`, registrado en el
  dispatch genérico (Fase 0, prerequisito transversal).
- Replay: reutiliza `POST /v1/domain-events/:eventId/replay` existente
  (F1-E), sin cambio de contrato.
- DLQ: reutiliza el mecanismo global; sin política nueva.
- Rebuild: `JobsBidsProjectionRepository.rebuild(jobId)`, análogo a
  `ProjectsRepository.rebuildLifecycleProjection()`.
- Correlation/traces: envelope v2 estándar (`correlationId`,
  `causationId`), sin cambio.

## 7. Estrategia de implementación

### Fase 0 — Dispatch genérico del consumer (bloqueante, transversal)

No es específica de jobs/bids — cierra F1-F. Reemplaza los dos `if`
hardcodeados de `domain-event-consumer.service.ts:99-127` por un registro
`eventType → consumer handler`. Los dos consumers existentes
(`evidence-readiness`, `project-lifecycle-projection`) deben seguir
pasando sus tests sin cambio de comportamiento tras el refactor.

### Fase A — Tests y contratos

- Tests rojos derivados de los escenarios P1 del spec.
- 6 schemas Zod nuevos/versionados.
- Suite nueva `operational-context.service.test.ts` (no existe hoy —
  cubrir `invalidateScope()` con prioridad, lo comparten 10 call sites
  ajenos a este cambio).

### Fase B — Datos y dominio (bids primero, después jobs)

- Migración `JobsBidsProjection`.
- Instrumentar `bids.repository.ts` primero — sin `DomainEventBus` previo
  que reconciliar, `accept()` ya tiene `$transaction`.
- Instrumentar `jobs.repository.ts` después — envolver en `$transaction`
  los write paths que hoy no lo están, dual-write junto al
  `DomainEventBus` existente sin retirarlo.
- Consumer `jobs-bids-projection.v1` + `rebuild()`.

### Fase C — Read-through en `OperationalContextService`

- Flag `SEMSE_JOBS_PROJECTION_READTHROUGH_ENABLED`, default `false`.
- El campo `jobs` de `buildContext()` lee la proyección solo si el tenant
  está en `SEMSE_JOBS_PROJECTION_CANARY_TENANT_IDS` **y** el flag está
  activo; en cualquier otro caso, o si la lectura de la proyección falla,
  usa la query directa actual sin propagar la excepción — este fallback
  es el ítem de mayor riesgo del plan completo porque protege el único
  call site sin `.catch()` (`ai-models.controller.ts:229`,
  `prometeoChat()`).

### Fase D — Verificación local/CI

- Tests dirigidos + `jobs.fsm.test.ts` (39 bloques) y
  `marketplace-bids.test.ts` (28 bloques) como regresión — cubren el
  riesgo de tocar `updateStatus`/`accept`.
- Blast-radius test explícito: `PaymentEscrow`/`Milestone`/`Contract` no
  cambian por efecto del consumer nuevo.
- Build/typecheck/lint, `pnpm spec:validate:strict`.

### Fase E — Integración

- PR con migración, rollback documentado, evidencia de blast-radius test.
- Merge SHA registrado en el spec.
- Flags creados en Railway con default `false` — no requiere redeploy
  independiente si ya existen los mecanismos de F1/F3.

### Fase F — Producción (sigue `docs/runbooks/JOBS_BIDS_PROJECTION_CANARY.md`)

- Deployment terminal API/Worker.
- Canary tenant: `SEMSE_JOBS_PROJECTION_ENABLED` + `PERSIST_ENABLED` para
  un tenant, sin read-through todavía (proyección se construye en
  background).
- Verificar checklist de cierre del runbook (heredado de F1 + adaptado de
  F1F + nuevo para read-through).
- Recién entonces `SEMSE_JOBS_PROJECTION_READTHROUGH_ENABLED=true` para
  el mismo tenant, con monitoreo activo de 5xx en `/prometeo/chat`.
- Promoción global solo con ventana sostenida dentro de SLO (mismo
  criterio que F3).

## 8. Riesgos

| Riesgo | Probabilidad | Impacto | Mitigación | Señal de rollback |
|---|---|---|---|---|
| Read-through rompe `/prometeo/chat` (sin `.catch()` hoy) | media | alto | fallback obligatorio a query directa antes de activar `READTHROUGH_ENABLED`; activar ese flag por separado y después de validar Fases 0-B en producción | incremento de 5xx en `/prometeo/chat` |
| `DomainEventBus`/`AgentTriggerRouter` y el outbox nuevo divergen (dos fuentes de verdad para "qué disparó qué") | media | medio | dual-write explícito, sin retirar `DomainEventBus`; blast-radius test confirma que el consumer nuevo no duplica efectos de agentes | `semse_event_consumer_duplicates_total` con efecto lógico duplicado, no solo receipt |
| Tests delgados en `jobs.controller.test.ts`/`jobs.service.test.ts` (2-3 bloques) para create/archive/restore | alta | medio | agregar cobertura nueva específica del cambio transaccional antes de tocar esos write paths | CI rojo en Fase D |
| `OperationalContextService` no tiene tests reales hoy (solo un stub mockeado) | alta | alto | Fase A escribe la suite completa antes de tocar `invalidateScope()`, compartida por 10 call sites ajenos | regresión de cache/invalidación en otros dominios (milestones, payments, etc.) tras el cambio |
| Bid rejection es un efecto implícito (`updateMany` bulk dentro de `accept`), no un endpoint propio | media | bajo | decidir en Fase A si `bid.rejected.v1` se emite por-bid o agregado, antes de instrumentar | mismatch entre proyección y conteo real de bids rechazados |

## 9. Investigación externa

| Búsqueda primaria | Fuente | Decisión |
|---|---|---|
| — | — | No aplica; diseño derivado de código propio ya verificado en producción (F1, F3), ver spec sección 11. |

## 10. Gates antes de tareas

- [ ] Archivos exactos identificados — sí, ver spec sección 10.
- [ ] Migración y rollback definidos — sí, sección 4 de este plan.
- [ ] Tests ordenados antes del código — sí, Fase A antes de Fase B/C.
- [ ] Canary/feature flag definidos — sí, cuatro flags nuevos + runbook.
- [ ] Evidencia requerida para cada estado de entrega — sí, mismo estándar
      que F3 (sin IDs inventados hasta que existan de verdad).
- [ ] Scope cabe en un PR reversible — **a revisar en `analyze`**: Fase 0
      (dispatch genérico) es transversal y podría justificar un PR propio,
      separado de la instrumentación de jobs/bids — evaluar split antes de
      pasar a `tasks`.
