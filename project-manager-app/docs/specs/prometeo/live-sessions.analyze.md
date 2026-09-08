# Análisis de consistencia — LiveSession (`prometeo.live-sessions`)

Fecha: 2026-09-07. Entrada: `live-sessions.spec.md` (`APPROVED`),
`live-sessions.plan.md` (`APPROVED`), `live-sessions.tasks.md` (`PENDING`),
`.specify/memory/constitution.md`, `docs/foundation/DOMAIN_INVARIANTS.md`.

## Autorización

El propietario firmó el spec `DRAFT → APPROVED` en sesión el 2026-09-07 con 4
decisiones cerradas (spec §intro): tabla `LiveSessionParticipant` explícita;
primer corte `inspection` + `assist`; recurso/sesión sin acceso → **404**;
`LIVEKIT_*` en Railway = acción humana que bloquea sólo la fase de media.

## Constitución / invariantes

- **Backend único, contratos compartidos.** ✔ `apps/api` sigue siendo la única
  autoridad de dominio; LiveKit es transporte de media, no un backend paralelo
  (ADR-026 §3). Contratos en `@semse/schemas` (`live-session.schema.ts`),
  reimplementados desde la referencia sin `mediaClass`/`observationMission`.
- **RBAC + ownership + tenant scope.** ✔ Permisos `live_sessions:read`/`:write`;
  autorización = `tenantId` del token **y** fila activa en
  `LiveSessionParticipant`; `create` valida acceso al `scopeId` vía el servicio
  dueño. Corrige el hueco §13.1 de la referencia (autorizaba sólo por tenant).
- **No inventar transiciones de estado de otros dominios.** ✔ La FSM de
  `LiveSession` es nueva y aislada; el spec §6 y el plan §7-B prohíben
  explícitamente escribir FSM de `Job`/`Project`/`Milestone`/`Payment`/`Dispute`
  desde este módulo.
- **Eventos sólo del catálogo.** ⚠ `live_session.requested.v1` /
  `status_changed.v1` **no** están en `docs/foundation/EVENT_CATALOG.md` hoy.
  Gate abierto — T-014 los agrega antes de implementar (spec §6, plan §6).
- **Emitir audit para cambios materiales.** ✔ `AuditService.append` en create y
  cada transición (`beforeJson`/`afterJson`, `reason`); `media_token_issued`
  auditado **sin** el token.
- **`paymentGovernance`.** ✔ N/A declarado y consistente en spec §2/§3/§5 y
  plan §2/§5 — no toca escrow/adjudicaciones; `accept`/`approve` de dominio
  siguen por sus flujos, no desde la sesión.
- **`privacyCritical`.** ✔ Stream de cámara/audio tratado como sensible: no se
  enruta a Ollama, no se persiste en este corte, token efímero no logueado
  (spec §3, plan §5).
- **Migración: nunca `db push` a producción; aditiva.** ✔ spec §7, plan §4,
  tasks T-020/T-021: sólo `CREATE`, `DROP` seguro, `migrate deploy` recién en
  Fase 6.
- **No inferir activación de merge/deploy/healthcheck.** ✔ tasks separa Fases
  D (verificación local) / E (merge) / F (deploy + canary + `VERIFIED`).

## Consistencia spec ↔ plan ↔ tasks

| Punto | spec | plan | tasks | ¿Alineado? |
|---|---|---|---|---|
| Endpoints | §5: 5 REST + SSE | §3 lista los mismos + `participant-ready` | T-030 (+ `participant-ready`) | ✔ (el plan/tasks añaden `participant-ready` como driver de FSM — mejora, no contradicción) |
| FSM | §6 diagrama + tabla de drivers | §7-C webhook + `participant-ready` + barrido | T-010 (tests), T-032 (drivers) | ✔ |
| Participantes | §7 modelo `LiveSessionParticipant` | §4 mismo modelo + enum `LiveSessionParticipantRole` | T-020 (migración), T-022 (siembra) | ✔ |
| 404 (no filtrar) | §3, §4, §5 | §5 | T-010, T-064 (prueba negativa) | ✔ |
| Eventos | §6: 2 eventos, best-effort ok | §6: best-effort + snapshot, outbox sólo si hay consumidor durable | T-014 (catálogo), T-023 (publicación) | ✔ |
| LiveKit | §2, §11 | §3, §11, ADR-026 | T-004 (ADR), T-031/T-032 | ✔ |
| Expo Go | §2, §4, §11 | §7-C import perezoso | T-034 | ✔ |
| Alcance fuera | §2: grabación, ObservationMission, screen share, >2, web | plan §3 idem | T-053 (no ampliar) | ✔ |
| Migración a prod | §7 | §4, §7-F | T-060 (acción humana `LIVEKIT_*` + `migrate deploy`) | ✔ |

## Gaps / riesgos residuales

1. **Eventos sin catalogar** — ~~bloqueante~~ **resuelto 2026-09-07**:
   `live_session.requested.v1` / `status_changed.v1` agregados a
   `docs/foundation/EVENT_CATALOG.md` (§Prometeo — Live Sessions) y la FSM a
   `docs/foundation/STATE_MACHINES.md` (§LiveSession), ambos marcados
   "productor pendiente". Falta la parte de tests de T-014.
2. **`SseEventBusService`** — **verificado 2026-09-07: EXISTE en `main`**
   (`apps/api/src/infrastructure/sse/sse-event-bus.service.ts`, `a23ca60e`,
   ancestro de `origin/main`). API: `emit(channel, event, data)` /
   `on(channel)` / `onPrefix(prefix)`, exactamente lo que usa el controller de
   referencia. Caveat: es un `Subject` **in-process** (una sola instancia, sin
   Redis/fan-out cross-pod) — suficiente para una sesión 1:1 por pod y
   consistente con la entrega best-effort + snapshot del plan §6; anotarlo en
   el plan si el deploy pasa a multi-instancia.
3. **PR grande** — plan §10 y tasks lo marcan `[~]`: fallback a PR-1
   (modelo+FSM+tests, sin LiveKit ni móvil) / PR-2 (LiveKit + webhook + móvil +
   canary). Decidir al escribir el diff de Fase E.
4. **Dependencia de infra humana** (`LIVEKIT_*`) — no bloquea Fases A-E; sí la
   F. Documentado en spec §12, plan §7-E/F, ADR-026 §4, tasks T-060.
5. **CI del repo caído desde 2026-08-19** — los "PASS" de Fase D serán
   verificación local; T-052 lo registra como tal.
6. **Compatibilidad `react-native-livekit` ↔ Expo SDK 57 dev build** — citado
   como investigación primaria (spec §11) pero no validado en un build real;
   ADR-026 §6 lo deja como pendiente pre-`APPROVED` del ADR.

## Veredicto

Spec, plan y tasks son **consistentes entre sí y con la constitución**. Los
gaps son de secuencia (catalogar eventos, verificar el bus SSE, decidir el
split de PR) y de dependencia humana (`LIVEKIT_*`, modo de despliegue de
LiveKit), todos registrados en el tasks y en ADR-026. **No hay contradicción
que impida arrancar la Fase 0 → Fase A.** Fase F queda bloqueada hasta la
acción de infra del propietario.
