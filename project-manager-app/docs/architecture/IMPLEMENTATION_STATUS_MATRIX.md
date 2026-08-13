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
| Evidence provenance | PARCIAL | storage/checksum/metadata/review | subject/custody/retention comunes |
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
| Agenda/Dispatch F6 | PARCIAL | reservas/field ops/weather dispersos | calendario/conflictos/routing |
| Observabilidad | PARCIAL | Sentry, Prometheus, health | OTel/correlation/SLOs |
| Backup/DR F9 | PARCIAL | docs/simulaciones | restore real y evidencia RPO/RTO |
| CI/CD | IMPLEMENTADO/DESPLEGADO | GitHub + Railway autodeploy/health | Environments, concurrency, migration gate |
| Identidad universal multi-capacidad F10 | EN PROGRESO / SDD 2.0 APPROVED | spec `APPROVED` 2026-08-04 (`universal-identity-multi-role.spec.md`); Fase 1-2 (`GET /v1/users/me/capabilities`) mergeada y desplegada — PR #539 merge `8e0ad1e3`, ancestro confirmado de `origin/main`; Fase 3 (selector de capacidad en Web, `CapabilityIndicator`/`CapabilityBadge`, detrás de flag `SEMSE_IDENTITY_CAPABILITY_UI_ENABLED`/`_CANARY_TENANT_IDS`) implementada 2026-08-13, en working tree local, sin PR/CI/merge/deploy todavía | Fase 3 sin PR abierto ni desplegar; canario en producción pendiente de acción humana (tocar env var de Railway está prohibido para agentes) |
| Originador/facilitador F10 | EN PROGRESO / SDD 2.0 APPROVED | spec `APPROVED` 2026-08-04 (`originador-referral-program.spec.md`), risk `critical`; RBAC self-service Connect + corrección de reward math mergeadas y desplegadas — PR #538 merge `6040d75e`, ancestro confirmado de `origin/main`; recompensa híbrida vía `StripeConnectAccount` (mismo mecanismo que `PRO`); gate de pagos revisado (§12b) | Flujo de recompensa por hitos (Fase 2+) no iniciado; Fase 3 bloqueada por gate legal país por país (solo EE.UU. investigado); F5 ya no es dependencia dura |
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

## Protocolo de actualización

Cada cambio de estado registra spec/test, SHA, CI, merge, deployment, flags,
canary y evidencia. No se acepta “implementado” por existencia de archivo,
“desplegado” por build en cola ni “activo” por healthcheck.
