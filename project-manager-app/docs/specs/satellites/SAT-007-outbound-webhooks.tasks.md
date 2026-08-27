---
type: tasks
feature: "SAT-007 — Webhooks salientes firmados para satélites"
domain: "api"
plan: "docs/specs/satellites/SAT-007-outbound-webhooks.plan.md"
version: "1.0"
status: "IN_PROGRESS"
branch: "claude/roadmap-continuation-vhmve9"
date: "2026-08-27"
---

# Tareas: SAT-007 — Webhooks salientes firmados para satélites

> `[ ]` pendiente · `[x]` completo · `[~]` bloqueado · `[P]` paralelizable.

## Fase 0 — SDD y verdad

- [x] [T-001] Spec `APPROVED`, sin plan/tasks previos — creados en esta
      sesión.
- [x] [T-002] Hallazgo crítico documentado (plan.md §1.1): los 5 eventos
      del catálogo v1 no tienen outbox durable hoy — decisión de
      resolverlo como prerrequisito de implementación (Fase A), no
      escalarlo como bloqueante de gobernanza.

## Fase A — Prerrequisito: outbox durable + catálogo

- [x] [T-010] 5 schemas Zod (`job.matched.v1`, `job.completed.v1`,
      `rating.requested.v1`, `milestone.approved.v1`,
      `milestone.rejected.v1`) en `domain-events-v2.schema.ts`.
- [x] [T-011] Outbox insert best-effort en `marketplace.agent.ts`
      (`job.matched.v1`).
- [x] [T-012] Outbox insert best-effort en `jobs.service.ts`
      (`job.completed.v1`, `rating.requested.v1`).
- [x] [T-013] Outbox insert best-effort en `milestones.service.ts`
      (`milestone.approved.v1`, `milestone.rejected.v1`), payload
      idéntico a `buildMilestoneApprovedEvent`/`buildMilestoneRejectedEvent`.
- [x] [T-014] `EVENT_CATALOG.md`: sección nueva documentando los 5
      nombres bare + `.v1`, cerrando el gap de spec §6.
- [x] [T-015] Tests: cada productor escribe el outbox event correcto sin
      alterar el flujo existente (notificaciones siguen disparándose).

## Fase B — SSRF compartido + criptografía

- [x] [T-020] `packages/shared/src/safe-url.ts`: `resolveSafeUrl()`
      valida esquema, host y **todas** las IPs resueltas (A y AAAA);
      devuelve la IP a pinnear.
- [x] [T-021] Tests: localhost/loopback/privadas (v4 y v6) rechazadas;
      IP pública aceptada; esquema no-https rechazado.
- [x] [T-022] `satellite-webhook-crypto.ts`: cifrado/descifrado
      AES-256-GCM del secret, firma/verificación HMAC-SHA256,
      generación de secret.
- [x] [T-023] Tests: roundtrip de cifrado, vector de firma fijo,
      `timingSafeEqual` en la comparación.

## Fase C — Modelo, migración, CRUD

- [x] [T-030] Modelo `SatelliteWebhook` + migración escrita a mano
      (sin Postgres disponible, ver plan.md §1).
- [x] [T-031] `satellite-webhooks.service.ts`: crear/listar/borrar,
      SSRF en registro, scope↔evento, duplicado 409, `AuditLog`,
      secret devuelto solo una vez.
- [x] [T-032] `satellite-webhooks.controller.ts`:
      `POST/GET/DELETE /v1/satellites/webhooks`, kill switch 503.
- [x] [T-033] `SatellitesService.revokeToken()`: cascada de suspensión
      de webhooks del token revocado.
- [x] [T-034] Tests: 400/401/403/409 explícitos; aislamiento entre
      satélites; `satellites:admin` ve todos, un satélite solo los suyos;
      revocación en cascada.

## Fase D — Consumer de entrega

- [x] [T-040] `satellite-webhook-delivery.ts`: cliente HTTP con IP
      pinning (conecta contra la IP ya validada, no re-resuelve DNS),
      sin seguir redirects, timeout 10s.
- [x] [T-041] Handler `satellite-webhooks.v1` registrado para los 5
      `eventType` en `domain-event-consumer.service.ts`.
- [x] [T-042] Contador de fallos consecutivos por webhook → `SUSPENDED`
      a los 5; reset a 0 tras una entrega exitosa.
- [x] [T-043] Kill switch `SATELLITE_WEBHOOKS_ENABLED`.
- [x] [T-044] Tests: entrega firmada exitosa; fallo→reintento vía el
      mecanismo estándar del consumer; 5 fallos consecutivos suspende
      solo ese webhook (no el evento completo, no otros webhooks); DNS
      rebinding simulado rechazado en el momento de entrega.

## Fase E — Verificación local

- [x] [T-050] `pnpm --filter @semse/schemas build`,
      `pnpm --filter @semse/shared build`,
      `pnpm --filter @semse/api build` limpios.
- [x] [T-051] `node ./scripts/run-tests.mjs` — regresión completa.
- [x] [T-052] `tsc --noEmit` y `eslint` limpios en todos los archivos
      tocados.
- [x] [T-053] `pnpm spec:validate:strict`, `pnpm spec:index`.
- [x] [T-054] Spec actualizado a `code_status: COMPLETE`,
      `status: IMPLEMENTED`.

## Fase F — PR, CI, merge

- [ ] [T-060] Revisar diff y secretos.
- [ ] [T-061] Commit(s) + push; PR (mandato de rama única — mismo patrón
      de las specs anteriores).
- [ ] [T-062] Esperar CI terminal y registrar `ci_status`.
- [ ] [T-063] Resolver review sin ampliar scope.
- [ ] [T-064] Fusionar y registrar SHA; actualizar `merge_status`.

## Fase G — Deploy y activación

- [ ] [T-070] Migración real verificada contra Postgres — bloqueado en
      esta sesión (sin DB).
- [ ] [T-071] Canary: webhook real desde Railway hacia un receptor de
      prueba; suspensión verificada tras fallos forzados.
- [ ] [T-072] `docs/runbooks/SAT-007-outbound-webhooks-canary.md`
      creado y llevado de DRAFT a verificado.
- [ ] [T-073] Registrar `production_evidence`, `last_verified`,
      `status: VERIFIED`.

## Criterio de Done

- [ ] Código completo y tests verdes
- [ ] CI `PASS`
- [ ] Merge `MERGED`
- [ ] Migración `VERIFIED` contra Postgres real
- [ ] Canary real en Railway confirmado
- [ ] `docs/SPEC_INDEX.md` y `EVENT_CATALOG.md` actualizados
