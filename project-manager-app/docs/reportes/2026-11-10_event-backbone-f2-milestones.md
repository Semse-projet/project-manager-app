# Event backbone F2 — slice 2b: milestones

**Fecha:** 2026-11-10 · **Rama:** `feat/event-backbone-f2-milestones` (apilada sobre 2a, #1139) · **Plan:** `docs/specs/platform/event-backbone-f2-milestones.plan.md` §2b · **Decisiones:** D1–D5

## Qué cambia

Los 5 eventos de milestones (`created`, `submitted`, `approved`, `rejected`, `revision_requested`) pueden escribirse en el outbox **en la misma transacción** que el cambio de estado, detrás de `SEMSE_MILESTONE_EVENTS_V2_MODE` (por defecto `off`) y `SEMSE_MILESTONE_EVENTS_V2_TENANT_IDS`. El consumidor `milestone-effects.v1` comparte `approved/rejected.v1` con `satellite-webhooks.v1` gracias al fan-out de 2a.

| Modo | Outbox v2 | `approved/rejected.v1` para satélites | Bus legacy | Notificación directa en `approved` | Consumidor |
|---|---|---|---|---|---|
| `off` | No | Best-effort, igual que hoy | Todo | Sí | No participa (sin modo sellado) |
| `shadow` | Sí, transaccional | Transaccional (D4), mismo payload | Todo | Sí | Solo registra |
| `on` | Sí, transaccional | Transaccional (D4) | Solo auditoría (D3) | No: la envía el consumidor | Triggers y luego notificaciones |

- `created.v1` y `submitted.v1` llevan referencias y contadores; el título y los participantes se releen por tenant.
- `revision_requested.v1` lleva las instrucciones en el payload (D5), igual que `rejected.v1` ya lleva `rejectionReason`.
- Si el hook no se ejecuta (persistencia en memoria) o falta Prisma/outbox, la llamada degrada a `off`.

## Corrección incluida

`reject` y `requestChanges` rechazan con 400, antes de escribir, un motivo de más de 2000 caracteres. Antes, un motivo así hacía que `reject` confirmara la transición y luego fallara con 500, porque el `parse` del evento de SAT-007 lanza la excepción de forma síncrona después del commit.

## Verificación

- `apps/api/test/milestone-events-v2.test.ts`: **14/14**. Cubre flag, envelope (SAT-007 sigue aceptando `approved.v1`), atomicidad, off/shadow/on, degradación sin hook, límite del motivo, **paridad de los 5 tipos** (incluida la notificación directa de `approved`), consumidor shadow/on/duplicado/otro tenant ⇒ terminal y **fan-out real**: con modo sellado, `approved.v1` va a satélites y a `milestone-effects.v1`; sin modo, solo a satélites.
- Control negativo: con servicio y repositorio de 2a, fallan 8 de 14.
- `tsc --noEmit` y eslint sin errores (la advertencia del repositorio ya existía).
- Suite unitaria de la API: ver la descripción del PR.

## Hallazgos (brechas legacy, no corregidas: cambian qué se notifica)

1. El esquema v1 de `milestone.submitted` no declara `clientUserId`, así que zod lo descarta en el bus y **el cliente nunca recibe aviso de que un hito está listo para revisión**.
2. `milestone.rejected` busca `proUserId` en el payload, pero el evento no lo lleva: el profesional no recibe aviso de rechazo.
3. `milestone.created` y `milestone.revision_requested` no tienen plantilla de notificación.

Hoy, en la práctica, solo notifica la llamada directa de `approved`. El modo `shadow` reproduce estas brechas a propósito para que la paridad sea exacta. Se proponen corregir en el consumidor una vez el tenant esté en `on`; la 1 y la 2 son las de más impacto para el usuario.

## Pendiente

- CI, revisión humana y merge en orden: #1137 → #1138 → #1139 → este PR.
- Activación (dueño, Railway): `milestone-effects.v1` en `SEMSE_EVENT_CONSUMER_ALLOWLIST` y los 3 tipos nuevos en `SEMSE_EVENT_TYPE_ALLOWLIST` (`approved/rejected.v1` ya pueden estar por SAT-007) → `shadow` → comparar recibos → `on`.
- PR de cierre del slice: retirar los `emit()` legacy de milestones.
