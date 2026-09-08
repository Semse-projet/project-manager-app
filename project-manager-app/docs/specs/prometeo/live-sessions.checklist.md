---
type: checklist
feature: "Sesiones en vivo (LiveSession)"
spec: "docs/specs/prometeo/live-sessions.spec.md"
version: "2.0"
date: "2026-09-07"
---

# Checklist: Sesiones en vivo (LiveSession)

> `[x]` = verificado contra el spec/plan en esta pasada · `[ ]` = pendiente de
> la implementación real · `[N/A]` = no aplica, con justificación.
> El spec está `APPROVED`, `code_status: NOT_STARTED` — casi todo lo de
> implementación queda `[ ]` a propósito; estos ítems son gates a cumplir
> antes de marcar el spec `IMPLEMENTED`/`VERIFIED`.

## Requisitos

- [x] Cada escenario P1 es verificable — P1 (inspection feliz), P2 (assist),
      P3 (idempotencia/concurrencia) en spec §4 apuntan a endpoints y estados
      concretos de §5/§6.
- [x] Scope y no-objetivos evitan ambigüedad — spec §2 lista 5 exclusiones
      explícitas con razón (grabación/`mediaClass`, `ObservationMission`,
      screen share, >2 participantes, cliente web).
- [x] API/UI/agent contracts no se contradicen — verificado en
      `live-sessions.analyze.md` (tabla de consistencia); el plan/tasks añaden
      `participant-ready` como driver de FSM, es una mejora no una contradicción.

## Seguridad

- [x] Permisos se validan en backend — `@RequirePermissions(live_sessions:read|write)`
      en los 6 endpoints (spec §3, plan §5, tasks T-030); nada depende de un
      check del lado cliente.
- [x] Tenant, org, ownership y resource scope están **definidos** — `tenantId`
      del token + fila activa en `LiveSessionParticipant`; `create` valida
      acceso al `scopeId`. Corrige el hueco §13.1. (Probado: pendiente, T-010/T-064.)
- [x] Step-up/aprobación existe para acciones críticas — [N/A justificado]
      ninguna acción de esta sesión mueve dinero ni cambia FSM de dominio;
      no se introduce una que lo necesitaría (spec §3).
- [ ] No hay secretos ni PII en logs/evidencia — el token LiveKit **no** se
      loguea ni se guarda en `AuditLog` (spec §3/§5, ADR-026 §3); verificar en
      code review real (T-050) y que el stream no se persista.

## Datos y eventos

- [x] Migración es reproducible y compatible — aditiva, sólo `CREATE`
      (2 tablas + 4 enums + índices), `DROP` seguro; `migrate dev --name
      add_live_sessions` (spec §7, plan §4, tasks T-020/T-021).
- [x] Backfill, rollback o forward-fix están definidos — sin backfill;
      rollback = flag off / `DROP` mientras nunca se activó (spec §7, ADR-026 §5).
- [x] Estado + outbox son atómicos cuando aplica — `transition` es atómico por
      `updateMany where { id, version: expectedVersion }` (0 filas → 409, plan
      §7-B, tasks T-022). **Eventos best-effort a propósito** (plan §6): el SSE
      entrega `snapshot` al reconectar, así que una pérdida de evento no deja
      al cliente inconsistente; si aparece un consumidor durable, se agrega al
      outbox F1 en su incremento.
- [x] Consumers son idempotentes y replayables — no se agregan consumers
      persistentes en este corte; el SSE es efímero sin estado. Cualquier
      consumidor futuro: idempotente por `eventId` (spec §6).
- [~] Eventos declarados están en el catálogo — **NO todavía**:
      `live_session.requested.v1` / `status_changed.v1` faltan en
      `docs/foundation/EVENT_CATALOG.md`. Bloqueante; lo agrega T-014 antes de
      implementar.

## Evidencia y dinero

- [x] Evidencia no se confunde con aprobación automática — [N/A] esta feature
      no captura ni aprueba evidencia; el stream es efímero y no se persiste.
- [x] Payment Governance bloquea releases incompatibles — [N/A] cero endpoints
      de escrow/pago tocados; confirmado en spec §2/§5 y plan §5.
- [x] Cálculos financieros excluyen fallos/reversals — [N/A] sin cálculos
      financieros.

## Entrega

- [ ] Tests, build, typecheck y lint pasan — pendiente de implementación
      (tasks Fase 4). Incluye el test de aislamiento **404** y el gate de
      `media-token` por estado.
- [ ] CI, merge, deploy y activación tienen evidencia separada — estructura ya
      definida en tasks Fases 4/5/6; CI del repo caído desde 2026-08-19 → los
      "PASS" serán verificación local, registrado como tal (T-052).
- [ ] Healthcheck no sustituye smoke funcional — tasks T-064 exige canary
      autenticado en **device nativo iOS + Android**, 2 participantes reales,
      con prueba negativa de aislamiento (3er usuario → 404).
- [x] Canary, métricas y rollback están definidos — flag
      `SEMSE_LIVE_SESSIONS_ENABLED` + `_CANARY_TENANT_IDS`; métricas en plan
      §8 y tasks T-065; rollback = flag off (ADR-026 §5).
- [ ] `production_evidence` no contiene secretos — vacío todavía; se llena en
      Fase 6 con la grabación del canary + la prueba negativa, sin `LIVEKIT_*`.

## Documentación

- [x] Spec index regenerado — `pnpm spec:index`; `prometeo.live-sessions`
      aparece en `docs/SPEC_INDEX.md`.
- [~] API surface/event catalog/matriz/roadmap actualizados si aplica —
      pendiente y anotado: `SEMSE_API_SURFACE_V1.md` (+6 endpoints, T-035),
      `EVENT_CATALOG.md` (+2 eventos, T-014), `STATE_MACHINES.md` (+FSM, T-014),
      `ROADMAP.md` F7 e `IMPLEMENTATION_STATUS_MATRIX.md` (T-067, al cerrar).
- [x] Investigación externa y decisiones registradas — spec §11 (LiveKit, LiveKit
      RN/Expo, permisos Expo 57) + `ADR-026-livekit-media-transport.md` (4
      opciones evaluadas, decisión, reversibilidad) + las 4 decisiones de
      producto del propietario en spec §intro.

## Gates bloqueantes antes de implementar (resumen de `analyze.md`)

- [ ] `live_session.*` en `EVENT_CATALOG.md` (T-014).
- [ ] Verificar si `SseEventBusService` existe en `main` o elegir reemplazo (T-002).
- [ ] Decidir split PR-1/PR-2 al escribir el diff de Fase E.
- [ ] **Acción humana:** cuenta/plan LiveKit + `LIVEKIT_*` en Railway + modo
      de despliegue (cloud vs self-host) — bloquea Fase F, no A-E.
