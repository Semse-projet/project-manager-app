# Matriz de implementación de la arquitectura SEMSE

**Corte:** 2026-07-31
**Git/producción:** `main@114cb9ca`; F3 merge `f1234291`
**Tracker:** [`../PRODUCTION_CONVERGENCE_TRACKER.md`](../PRODUCTION_CONVERGENCE_TRACKER.md)

## Leyenda

- **IMPLEMENTADO:** código y validación relevante; no implica merge/deploy.
- **DESPLEGADO:** SHA verificado en un deployment terminal.
- **ACTIVO:** flag/allowlist y journey funcional verificados.
- **PARCIAL:** existe una parte útil, falta el gate transversal.
- **PENDIENTE:** no existe como capacidad común verificable.

Para specs SDD 2.0 mandan las columnas separadas de
`docs/SPEC_INDEX.md`; esta matriz resume capacidades, no sustituye evidencia.

## Producción observada

| Superficie | Evidencia |
|---|---|
| API | `575a82f1-ac99-4d60-a5d2-e6aeb645e096`, `114cb9ca`, `SUCCESS`; health Railway/custom `/v1/health` = 200 |
| Web | `3ffb51d5-6dd1-4fd3-afa2-b7c6b1cff489`, `114cb9ca`, `SUCCESS`; health custom/Railway = 200 |
| Worker/Vision | `8fe3b3fc` / `bf804e3b`, `114cb9ca`, `SUCCESS` |
| Postgres/Redis | `SUCCESS` al corte |
| Dominio API | Railway sync `ACTIVE`; TLS estricto válido; `/v1/health` = 200 |
| PostgreSQL F3 | repair Evidence verificado: 9 columnas, 0 tenant nulo, 2 FKs, 3 índices; 1 snapshot canary y mismatch 0 |

## Matriz

| Capacidad | Estado real | Evidencia | Siguiente gate |
|---|---|---|---|
| Monorepo pnpm | IMPLEMENTADO | `pnpm-workspace.yaml`; runners Node portables para workspace, seeds y tests API | Mantener workspace verde |
| Web/BFF | IMPLEMENTADO/DESPLEGADO | Next.js + Railway `114cb9ca` | SLO y journeys autenticados |
| API NestJS/Prisma | IMPLEMENTADO/DESPLEGADO | NestJS/Prisma + Railway `114cb9ca` | Trazas y migration gates |
| Worker/BullMQ | IMPLEMENTADO/DESPLEGADO | worker Railway `SUCCESS` | Consola común lag/retries/DLQ |
| Cliente móvil (`apps/mobile`) | IMPLEMENTADO/PARCIAL | Expo SDK 57 (RN); Worker (timer/proximidad/jobs/bids/evidencia/push), Client Fase 2, Admin Fase 7a-7h en `main`. Consolidación en curso — rama `feat/semse-product-consolidation-20260906` / PR draft #598 (`ad7cb6f1`→`5c19e8da`): `environment.ts`/`client.ts` (una sola conexión, refresh concurrente, logout seguro, timeout), timer offline (`localTimer.ts`), Prometeo (`/v1/ai-models/prometeo/chat`), pull-to-refresh Admin, bump Expo 57 patch. `tsc` limpio, jest 45/45·213/213, `expo export` iOS+Android OK, build EAS Android `preview` `680386ee` `finished` desde `22ce0a06`. Sin CI real (ver §9), sin merge, sin release a tienda, sin canary en device | Canary autenticado por rol en device; build iOS (cuota EAS Free hasta 2026-10-01); LiveSession por contrato aparte (`docs/consolidation/LIVESESSION_RECOVERY_CONTRACT.md`) |
| Identidad/Tenant/RBAC | IMPLEMENTADO/PARCIAL | guards, permissions, policies | PrincipalContext/policy transversal |
| Identidad universal multi-rol | ver fila F10 más abajo | `Membership(userId, orgId, roleId)` ya permite multi-rol a nivel de datos; UX/producto asume rol fijo | — |
| Originador/Facilitador (referral) | ver fila F10 más abajo | — | — |
| Orquestación externa (MCP) | PENDIENTE/RETIRADO PREVIO | `SPEC-INT-001` retirado; `ADR-024` §12 sin evidencia de código | `ADR-025-mcp-external-tool-gateway.md` (a crear), decisión de propuesta |
| Prometeo Runtime | IMPLEMENTADO/DESPLEGADO | missions, work plans, BFF | Verify/learn/budgets/compensación |
| Tool Registry F2 | IMPLEMENTADO/PARCIAL | policy/audit/approval; adapters reales | video temporal + verification explícita |
| Event Backbone F1 | PARCIAL/DESPLEGADO/CANARY ACOTADO | Evidence + outbox, dispatcher, worker, receipts/replay; F3 ejercitó switches/allowlists | Cierre F1-F transversal + adopción transaccional multi-dominio |
| Event Catalog | PARCIAL/ACTUALIZADO | envelope v2 + `project.lifecycle-source-changed.v1` / `project-lifecycle-projection.v1` | Mantener producer/consumer/deploy/activation por evento |
| Communications | IMPLEMENTADO/PARCIAL | modelo canónico y delivery vertical | outbox/retry/circuit breaker durable |
| Payment orchestration | IMPLEMENTADO/PARCIAL | escrow, Stripe, governance | reconciliación y lenguaje legal |
| Shared Economic Ledger F5 | PENDIENTE | PaymentTxn no es double-entry | Child spec después de F4 |
| Evidence provenance | PARCIAL | storage/checksum/metadata/review; m2.2-dispute-docs Bloque 2.2.A (EXIF timestamp+GPS de fotos, sin dependencia externa, fail-closed) mergeado a `main` — PR #592 merge `140c192c` (2026-08-27); CI real no corrió sobre el merge (ver Event Backbone/hallazgo de infra abajo) | subject/custody/retention comunes; daily logs/change-order trail/extended metrics/PDF export (Bloques 2.2.B-E) sin empezar |
| Trust/Governance | IMPLEMENTADO/PARCIAL | ratings, risk, disputes, policies locales | policy rulebook/apelación común |
| Mission Control F4 | IMPLEMENTADO/MERGEADO/DESPLEGADO | cola normalizada multi-fuente, catálogo allowlisted, receipt key+hash+lease, adapters, migración aditiva, BFF/UI exception-first y SSE autenticado; PR #486 merge `afb2dccd` (2026-07-31), ancestro confirmado de `origin/main` | canary `tenant_default` no re-verificado en esta pasada |
| Project Lifecycle Projection F3 | VERIFIED / CANARY ACTIVO | `f1234291`; repair, cálculo/persistencia, rebuild/event consumer; 5 `PUBLISHED`, 5 `COMPLETED`, replay `no_op`, mismatch 0 | Ventana SLO y promoción global; outbox atómica por dominio |
| Product Intelligence | IMPLEMENTADO/PARCIAL/DESPLEGADO | PI-00..PI-10 (PR #322, 2026-07-17); PI-11.2 auditoría de privacidad aprobada (PR #326, 2026-07-17, "variables activas, 3 servicios SUCCESS") — ambos ancestros confirmados de `origin/main` | Re-verificar flags/activación de forma independiente en esta pasada |
| Workspace/Context Bridge | PARCIAL | runtime/context bridge | scope común y terminal registry |
| SDD/Blueprint Engine | IMPLEMENTADO/PARCIAL | 98 specs; strict 0/0; SDD 2.0 | Migrar specs al tocarlas + delivery evidence |
| Knowledge/RAG | IMPLEMENTADO/PARCIAL | documents/chunks/retrieval/feedback | eval set y source governance |
| Vision | IMPLEMENTADO/PARCIAL/DESPLEGADO | servicio Railway y analyzers | evidencia real, thresholds y video |
| Agro | IMPLEMENTADO/PARCIAL | fincas, animales, tareas, costos, sync | tenancy/offline/ledger común |
| Labor Engine | IMPLEMENTADO/PARCIAL | tracker, sesiones, rates, admin | approvals + economic posting |
| Agenda/Dispatch F6 | PARCIAL | reservas/field ops/weather dispersos; m2.3-weather Bloque 2.3.A (Tomorrow.io + clasificación por trade, `WeatherAlert`) mergeado a `main` — PR #592 merge `140c192c` (2026-08-27); CI real no corrió sobre el merge | calendario/conflictos/routing; push notifications/auto-halt/change-order (Bloques 2.3.B/C) sin empezar |
| Observabilidad | PARCIAL | Sentry, Prometheus, health | OTel/correlation/SLOs |
| Backup/DR F9 | PARCIAL | docs/simulaciones | restore real y evidencia RPO/RTO |
| CI/CD | IMPLEMENTADO/DESPLEGADO | GitHub + Railway autodeploy/health | Environments, concurrency, migration gate |
| Identidad universal multi-capacidad F10 | EN PROGRESO / SDD 2.0 APPROVED | spec `APPROVED` 2026-08-04 (`universal-identity-multi-role.spec.md`); Fase 1-2 (`GET /v1/users/me/capabilities`) mergeada y desplegada — PR #539 merge `8e0ad1e3`, ancestro confirmado de `origin/main`; Fase 3 (selector de capacidad en Web, `CapabilityIndicator`/`CapabilityBadge`, detrás de flag `SEMSE_IDENTITY_CAPABILITY_UI_ENABLED`/`_CANARY_TENANT_IDS`) implementada 2026-08-13 y mergeada — PR #568 | Canario en producción pendiente de acción humana (tocar env var de Railway está prohibido para agentes) |
| Originador/facilitador F10 | EN PROGRESO / SDD 2.0 APPROVED | spec `APPROVED` 2026-08-04 (`originador-referral-program.spec.md`), risk `critical`; RBAC self-service Connect + corrección de reward math mergeadas y desplegadas — PR #538 merge `6040d75e`, ancestro confirmado de `origin/main`; recompensa híbrida vía `StripeConnectAccount` (mismo mecanismo que `PRO`); gate de pagos revisado (§12b); Fase 1-2 (registro/validación de originador, modelo `OriginatorReward`) + slice de triggers reales (`evaluateMilestoneFundedTrigger`/`evaluateProjectCompletedTrigger` enganchados fire-and-forget desde `PaymentsService`/`ProjectsController`, idempotencia vía `@@unique([projectOriginatorId, type])`) implementados 2026-08-13, 12/12 tests verdes contra Postgres real (7 de registro/validación + 5 de triggers); PR #569 mergeado 2026-08-26 (`0cc3c522`) — ver `docs/SPEC_INDEX.md` para `deploy_status` vigente | Fase 3 (pago real) bloqueada por gate legal país por país (solo EE.UU. investigado); F5 ya no es dependencia dura; activación en producción (flag/canary) pendiente de acción humana |
| Orquestación externa MCP F10 | PENDIENTE | 0 código; `SPEC-INT-001` retirado; ADR de reapertura en propuesta | Resolver ADR antes de registrar cualquier tool externa |

## Salud SDD

```text
Specs:                              98
Spec validate strict:               0 errores / 0 warnings
Specs con related_tests:            87/98 (89%)
Specs VERIFIED:                     45/98 (46%)
Specs high/critical no VERIFIED:    34
Specs SDD 2.0:                       3/98
Tiempo validator estricto:          ~2.1 s (antes ~106 s)
```

## Hallazgos vinculantes

1. `origin/main` y producción están en `114cb9ca`; F3 event-driven entró por
   `f1234291` y los cuatro servicios están en deployments `SUCCESS`.
2. La tabla F3 contiene exactamente un snapshot canary, con revisión durable
   igual a la calculada y cero mismatch de tenant/proyecto.
3. `Evidence.updatedAt` y las nueve columnas canónicas tenant/context están
   aplicadas; cuatro filas tienen tenant válido, con dos FKs y tres índices.
4. Los flags F3 están ON únicamente para `tenant_default`; el rollback anterior,
   el forward-fix y el replay quedaron verificados por separado.
5. El Worker requiere `EVENT_CONSUMER`; dos 403 iniciales se reconciliaron y
   tres eventos posteriores se consumieron automáticamente.
6. Evidence usa outbox atómica; los demás hooks F3 son post-commit best-effort.
7. F3-F9 se ejecutan como child specs secuenciales, no como big bang.
8. Health 200 confirma arranque, no journey funcional ni activación.
9. **Hallazgo de infraestructura (2026-08-27, fuera del corte de arriba —
   no re-verifica el resto de esta matriz):** GitHub Actions no generó
   ningún check run real en ninguna rama del repo desde 2026-08-19,
   confirmado con `list_workflow_runs` (no solo el status combinado del
   PR, que mostraba únicamente el bot `Devin Review`, sin ejecutar nada:
   "trial expired and no credits remaining"). `main` mismo no tiene un run
   de `ci.yml` desde 2026-08-12 (fallido); el merge de PR #592 a `140c192c`
   tampoco disparó uno. Reportado en `Semse-projet/project-manager-app#592`
   (comentario) para que un humano con acceso revise Settings → Actions
   (permisos/spending limit) — fuera de la autoridad y visibilidad de un
   agente. Cualquier "PASS" de CI citado en specs/tareas desde esa fecha
   se refiere a verificación local (`tsc`/`eslint`/`node --test`/`pnpm
   build`), no a un run real del pipeline.

10. **Consolidación móvil (2026-09-07, fuera del corte de arriba — no
    re-verifica el resto de esta matriz):** la fila "Cliente móvil" se agregó
    en esta pasada. Base `main@88171003` (posterior a `114cb9ca` del corte).
    Evidencia local verificable (`tsc`, jest 45/45·213/213, `expo export`
    ambos targets, build EAS Android `680386ee`); **sin** merge, deploy,
    release a tienda ni canary autenticado en device — esos gates siguen
    abiertos (PR draft #598, spec `mobile-product-consolidation`
    `code_status: IN_PROGRESS`). El "PASS" de tests es verificación local, no
    un run real del pipeline (mismo hallazgo §9). Ninguna fuente/checkout
    móvil se borró (`docs/consolidation/MOBILE_SOURCE_REGISTER.md`).

## Protocolo de actualización

Cada cambio de estado registra spec/test, SHA, CI, merge, deployment, flags,
canary y evidencia. No se acepta “implementado” por existencia de archivo,
“desplegado” por build en cola ni “activo” por healthcheck.
