# Jobs/Bids Event Projection — Canary (DRAFT)

**Estado:** DRAFT — nace de una auditoría de arquitectura (Buzz vs SEMSEproject),
no de un spec aprobado. No ejecutar contra producción hasta cerrar la nota de
gobernanza de abajo.
**Corte:** 2026-08-06
**Scope propuesto:** un tenant canario único, por definir (mismo patrón que F3
usó `tenant_default`).
**Spec:** pendiente — ver "Nota de gobernanza".

## Nota de gobernanza (leer antes que nada)

`AGENTS.md` de este repo exige specify → plan → tasks → analyze → checklist →
implement antes de que cualquier código de esto exista, y prohíbe
explícitamente "generar código sin spec aprobado" e "inventar nombres de
eventos fuera de `EVENT_CATALOG.md`". Este documento **no reemplaza ese
flujo** — es la plantilla operativa a la que ese flujo debería converger,
escrita ahora para no perder el diseño. Antes de que cualquier paso de este
runbook sea ejecutable:

1. `docs/specs/api/jobs.spec.md` / `docs/specs/api/bids.spec.md` (o un spec
   nuevo de plataforma, a criterio de quien lo apruebe) deben cubrir la
   emisión de eventos de dominio y la proyección — con `plan`/`tasks`/
   `checklist` propios, siguiendo `.specify/templates/overrides/`.
2. `docs/foundation/EVENT_CATALOG.md` necesita una sección `## Bids` (hoy no
   existe) y debe reconciliar los nombres de `job.*` ya listados (línea
   ~102-113 del catálogo) contra lo que el código realmente emite hoy
   (`job.created`, `job.status_changed`, `job.preferred_professional_selected`
   — sin versión `.v1`), antes de fijar los nombres versionados de abajo.
3. El código de las fases 0-4 (dispatch genérico del consumer, instrumentación
   de outbox en `bids`/`jobs`, consumer de proyección, read-through en
   `OperationalContextService`) debe estar mergeado en `main` — igual que
   `F1F_EVENT_BACKBONE_CANARY.md` exige F1-A..F1-E mergeados antes de
   ejecutarse.
4. Falta asignar número de fase en `ROADMAP.md` (F0-F10 están todos
   ocupados hoy) — no asumir que esto es "F11" sin que quien gobierna el
   roadmap lo confirme.

Todo lo que sigue asume que los tres puntos anteriores ya se resolvieron.

## Propósito

Extender el patrón ya verificado en F1 (`evidence.*`) y F3
(`project.lifecycle-source-changed.v1`) a jobs y bids, para que
`OperationalContextService.buildContext()` deje de depender de
`prisma.job.findMany()` directo y lea en su lugar de una proyección derivada
de eventos — cerrando el problema de coherencia entre agentes documentado en
la auditoría (`AgentMemory` no modela estado de job/bid, cada agente lo
consulta con su propio cache TTL).

```text
job/bid mutation (jobs.repository.ts / bids.repository.ts)
  -> job.created.v1 | job.status_changed.v1 | job.preferred_professional_selected.v1
     bid.created.v1 | bid.accepted.v1 | bid.rejected.v1
  -> DomainOutboxEvent
  -> BullMQ semse-domain-events
  -> jobs-bids-projection.v1 (nuevo consumer, dispatch genérico de Fase 0)
  -> rebuild tenant-scoped + CAS (mismo patrón que ProjectLifecycleProjection)
  -> AuditLog + DomainEventConsumption
  -> OperationalContextService.buildContext() lee la proyección (Fase 4,
     con fallback a query directa si la proyección falla o el tenant no
     está en el allowlist de canary)
```

La proyección nunca es autoridad de escritura de `Job`, `Bid`, `Contract`,
`PaymentEscrow` ni `Milestone` — igual que F3 con Project/Milestone/Payment.

## Prerequisito de diseño no resuelto (bloqueante)

`jobs.service.ts` ya emite eventos hoy vía `DomainEventBus` (no vía outbox),
y ese bus es el mecanismo real por el cual los eventos de job disparan
agentes hoy (`AgentTriggerRouter.route()`). Este runbook asume que la Fase 2
decidió **dual-write** (agregar el insert de outbox junto al `DomainEventBus`
existente, sin retirarlo) — si esa decisión de diseño cambia, este runbook
necesita revisión antes de usarse.

## Configuración segura

API (nombres por convención, a confirmar contra la spec real cuando exista):

- `SEMSE_EVENT_OUTBOX_DISPATCH_ENABLED=true` (ya debe estar `true` por F1/F3)
- `SEMSE_EVENT_CONSUMERS_ENABLED=true` (ídem)
- `SEMSE_EVENT_TYPE_ALLOWLIST` agrega `job.created.v1`,
  `job.status_changed.v1`, `job.preferred_professional_selected.v1`,
  `bid.created.v1`, `bid.accepted.v1`, `bid.rejected.v1`
- `SEMSE_EVENT_CONSUMER_ALLOWLIST` agrega `jobs-bids-projection.v1`
- `SEMSE_JOBS_PROJECTION_ENABLED=true` (nuevo flag, mismo rol que
  `SEMSE_PROJECT_LIFECYCLE_PROJECTION_ENABLED` en F3)
- `SEMSE_JOBS_PROJECTION_PERSIST_ENABLED=true` (mismo rol que
  `SEMSE_PROJECT_LIFECYCLE_PERSIST_ENABLED`)
- `SEMSE_JOBS_PROJECTION_CANARY_TENANT_IDS=<tenant elegido>`
- `SEMSE_JOBS_PROJECTION_READTHROUGH_ENABLED=false` al principio — activa
  Fases 0-3 (escritura de la proyección) sin tocar el path de lectura de
  `buildContext()`. Recién se pasa a `true` después de validar el checklist
  de la sección siguiente con la proyección ya construyéndose en background.

**No retirar** `evidence.uploaded.v1`/`evidence-readiness.v1` ni
`project.lifecycle-source-changed.v1`/`project-lifecycle-projection.v1` de
los allowlists — comparten las mismas variables globales que F1/F3.

Worker: mismo requisito que F3 — `SEMSE_ROLES` debe incluir la capacidad de
servicio `EVENT_CONSUMER` (el incidente conocido de F3 fue justamente un
Worker sin ese rol, ver `F3_PROJECT_LIFECYCLE_EVENT_CANARY.md`, sección
"Incidente conocido y recuperación" — repetir esa verificación acá antes de
generar tráfico).

## Verificación

1. Confirmar deployments terminales `SUCCESS` de API y Worker.
2. Confirmar en logs del Worker que registra el consumer habilitado para la
   cola `semse-domain-events` (mismo check que F1F/F3).
3. Provocar una mutación permitida de job o bid en el tenant canario (crear
   job, crear bid, aceptar bid).
4. `GET /v1/domain-events/outbox` con `domain-events:read` — confirmar
   `PUBLISHED` para el evento generado.
5. `GET /v1/domain-events/:eventId/deliveries` — confirmar receipt
   `COMPLETED`, consumer `jobs-bids-projection.v1`, `lastError=null`.
6. Repetir la entrega y confirmar `duplicate=true`, sin segundo efecto en la
   proyección.
7. Con `SEMSE_JOBS_PROJECTION_READTHROUGH_ENABLED=true` solo para el tenant
   canario: comparar el campo `jobs` que devuelve `buildContext()` contra el
   resultado de la query directa (`prisma.job.findMany`) para el mismo
   usuario — deben coincidir.

## Checklist de cierre

Heredadas de la SLO de F1 (`docs/specs/platform/event-backbone.spec.md`,
sección 14 — aplican tal cual porque jobs/bids usan el mismo outbox):

- [ ] write de dominio + outbox p95 < 500 ms
- [ ] outbox publish lag p95 < 2 s (`semse_outbox_publish_lag_seconds`)
- [ ] eventos `PENDING` > 60 s: 0 sostenidos
      (`semse_outbox_oldest_pending_age_seconds`)
- [ ] cero pérdida de estado/evento en fault tests

Adaptadas del checklist operativo de `F1F_EVENT_BACKBONE_CANARY.md`:

- [ ] `counts.PENDING` no crece sin control durante la ventana de observación
- [ ] ningún evento en `DEAD_LETTER` sin owner por > 15 min
- [ ] `semse_event_consumer_duplicates_total` no indica efecto lógico
      duplicado (solo el receipt puede duplicarse)
- [ ] blast radius: `PaymentEscrow`, `Milestone` y `Contract` no cambian
      como efecto del consumer `jobs-bids-projection.v1` (confirmar contra
      la base real, no solo por código — mismo método que usó F1F para
      Milestone/Payments)

Nuevas para el read-through de Fase 4 (sin precedente en el repo — no hay
SLO de latencia de chat documentado en ningún lado, se definen acá por
primera vez):

- [ ] p95 de `buildContext()` con proyección ON no agrega más delta que la
      query directa (comparación relativa, no absoluta — no hay baseline
      publicado para fijar un número duro)
- [ ] tasa de fallback a query directa < 1% de las invocaciones en el
      tenant canario
- [ ] sin incremento medible de 5xx en `POST /prometeo/chat` atribuible al
      cambio (este es el que protege el hard-fail path — `prometeoChat`
      llama `buildContext()` sin `.catch()`, así que cualquier subida acá
      dispara rollback inmediato, no espera a la ventana sostenida)
- [ ] cero mismatches sostenidos entre `jobs` de la proyección y `jobs` de
      la query directa, muestreados durante la ventana de observación

## Rollback

Orden recomendado (calcado de `F3_PROJECT_LIFECYCLE_EVENT_CANARY.md`):

1. `SEMSE_JOBS_PROJECTION_READTHROUGH_ENABLED=false` — corta el read-through
   de inmediato sin tocar el resto; la proyección sigue construyéndose en
   background.
2. Retirar `job.*`/`bid.*` del type allowlist o `jobs-bids-projection.v1`
   del consumer allowlist si el problema es específico de este flujo.
3. Si es transversal, apagar dispatcher/consumers global — afecta también a
   evidence/F3, requiere evaluación conjunta antes de tocarlo.
4. Si el problema es solo de escritura de la proyección (no de lectura),
   apagar `SEMSE_JOBS_PROJECTION_PERSIST_ENABLED` dejando el resto activo.

No borrar outbox, receipts ni la tabla de proyección de jobs/bids —
conservarlos para diagnóstico, forward-fix y replay auditado, igual que F1/F3.

## Promoción global

El canary no autoriza retirar el tenant allowlist. Antes de promoción global
se requiere una ventana sostenida con todas las métricas del checklist de
cierre dentro de objetivo — mismo criterio que exige
`F3_PROJECT_LIFECYCLE_EVENT_CANARY.md`, sección "Promoción global".

## Después de cerrar el canary

Actualizar (no antes, y solo con evidencia real de este runbook en mano):

- El spec que se haya aprobado para esto (ver "Nota de gobernanza") →
  `status: IMPLEMENTED` o `VERIFIED` según corresponda.
- `docs/foundation/EVENT_CATALOG.md` → confirmar que los nombres de evento
  usados en producción coinciden exactamente con los documentados.
- `ROADMAP.md` → asignar y marcar la fase correspondiente (pendiente de
  numeración, ver "Nota de gobernanza").

## Evidencia del canary

_Pendiente — completar únicamente con datos reales de una ejecución real.
No rellenar con IDs o hashes de ejemplo; una fila vacía es preferible a una
inventada._

- Código: PR `<pendiente>`, merge `<pendiente>`.
- Deployments: API `<pendiente>`, Worker `<pendiente>`.
- Resultado del checklist de cierre: `<pendiente>`.
- Tenant canario: `<pendiente>`.
