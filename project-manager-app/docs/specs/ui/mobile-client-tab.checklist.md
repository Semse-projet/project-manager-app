---
type: checklist
feature: "Mobile Client Tab — Fase 2 de apps/mobile"
spec: "docs/specs/ui/mobile-client-tab.spec.md"
version: "2.0"
date: "2026-08-05"
---

# Checklist: Mobile Client Tab — Fase 2 de apps/mobile

> Estado al momento de escribir este checklist: spec en `DRAFT`, cero código
> escrito todavía. Los ítems abajo son gates a cumplir **antes de** marcar
> el spec `APPROVED`/`VERIFIED` — no una confirmación de que ya se
> cumplieron. `[x]` = verificado contra el código real en esta sesión,
> `[ ]` = pendiente de la implementación real, `[N/A]` = no aplica a esta
> fase con justificación.

## Requisitos

- [x] Cada escenario P1 es verificable — P1–P4 (spec §4) apuntan a
      endpoints `/v1` reales, confirmados por grep contra los controllers
      (`jobs`, `bids`, `milestones`, `ratings`)
- [x] Scope y no-objetivos evitan ambigüedad — spec §2 lista 6 exclusiones
      explícitas (job posting, marketplace, milestone reject, escrow,
      disputes, finance/etc.), cada una con su razón
- [~] API/UI/agent contracts no se contradicen — **corregido en esta
      sesión**: el spec original afirmaba que push notifications
      funcionarían para bids "sin cambios"; verificado contra
      `bids.service.ts` que eso es falso (usa `prisma.notification.create`
      directo, bypasea `NotificationsService`/`PushDispatchService`). Ya
      corregido en spec §2 y plan §8 — se documenta como limitación
      conocida, no se oculta

## Seguridad

- [x] Permisos se validan en backend — los 5 endpoints reusados ya tienen
      `@RequirePermissions(...)` en sus controllers; nada de esta fase
      depende de una verificación del lado cliente
- [x] Tenant, org, ownership y resource scope están probados — heredado de
      los servicios existentes (`JobsService.list`, etc.), no hay lógica de
      scope nueva que probar en esta fase
- [N/A] Step-up/aprobación existe para acciones críticas — ninguna acción
      de esta fase (accept bid, approve milestone, create rating) requiere
      step-up hoy en web tampoco; no se introduce una acción que sí lo
      necesitaría (fund/release quedan fuera de alcance)
- [ ] No hay secretos ni PII en logs/evidencia — pendiente de revisar en
      code review real cuando exista el código (T-050 en tasks.md)

## Datos y eventos

- [N/A] Migración es reproducible y compatible — sin migración (spec §7,
      plan §4)
- [N/A] Backfill, rollback o forward-fix están definidos — sin datos nuevos
- [~] Estado + outbox son atómicos cuando aplica — aplica solo a
      milestones (ya atómico, sin cambios); **no aplica del mismo modo a
      bids** porque bids nunca pasó por outbox/eventos para estas
      notificaciones — ver hallazgo de push arriba, es preexistente, no se
      corrige en esta fase
- [x] Consumers son idempotentes y replayables — no se agregan consumers
      nuevos en esta fase

## Evidencia y dinero

- [x] Evidencia no se confunde con aprobación automática — esta fase es
      **solo lectura** de evidencia del lado cliente; aprobar un milestone
      sigue siendo una acción explícita separada (`POST .../approve`), no
      se infiere del hecho de que haya evidencia subida
- [x] Payment Governance bloquea releases incompatibles — no aplica, cero
      endpoints de escrow/pago tocados; confirmado que ninguno de los 7
      endpoints en "Fuera de alcance" (fund/deposit/release) aparece en
      `related_endpoints` del spec
- [N/A] Cálculos financieros excluyen fallos/reversals — sin cálculos
      financieros en esta fase

## Entrega

- [ ] Tests, build, typecheck y lint pasan — pendiente de implementación
      (Fase 1/4 de tasks.md)
- [ ] CI, merge, deploy y activación tienen evidencia separada — pendiente,
      estructura ya definida en plan §7 Fases D–F
- [ ] Healthcheck no sustituye smoke funcional — plan §7 Fase F ya exige
      explícitamente un run real en device/simulador, no solo `tsc --noEmit`
      (mismo estándar ya documentado para Worker en `apps/mobile/README.md`)
- [x] Canary, métricas y rollback están definidos — plan §7 Fase F: canary
      = build EAS `preview` + smoke manual; rollback = no promover a
      `production` (sin flag que revertir, sin servicio backend que
      rollbackear)
- [N/A] `production_evidence` no contiene secretos — vacío todavía
      (`production_evidence: []` en el frontmatter del spec), se llena
      recién en Fase 6 de tasks.md

## Documentación

- [x] Spec index regenerado — `pnpm spec:index` corrido, `ui.mobile-client-tab`
      aparece en `docs/SPEC_INDEX.md` línea 141
- [ ] API surface/event catalog/matriz/roadmap actualizados si aplica —
      **pendiente, hallazgo nuevo de esta sesión**: `SEMSE_API_SURFACE_V1.md`
      no necesita cambios (cero endpoints nuevos), pero
      `docs/foundation/EVENT_CATALOG.md` tiene una deuda preexistente
      (`rating.submitted` no catalogado, ver spec §6) que este spec no
      corrige — dejar constancia aquí para que no se pierda antes de que
      alguien decida si vale la pena un PR de catalogación aparte
- [x] Investigación externa y decisiones registradas — N/A declarado y
      justificado en spec §11 y plan §9
