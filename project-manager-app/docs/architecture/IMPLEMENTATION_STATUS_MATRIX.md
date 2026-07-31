# Matriz de implementación de la arquitectura SEMSE

**Corte:** 2026-07-31
**Git/producción:** `main@3c2ac45d`; F3 merge `f1234291`
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
| API | `425b8526-4374-450b-ae75-53881791e6bc`, `3c2ac45d`, `SUCCESS`; health Railway `/v1/health` = 200 |
| Web | `00a3e13b-c86c-4edf-b2a2-a2e1f4f274f7`, `3c2ac45d`, `SUCCESS`; health custom/Railway = 200 |
| Worker/Vision | `7d5f6279` / `5e1155a6`, `3c2ac45d`, `SUCCESS` |
| Postgres/Redis | `SUCCESS` al corte |
| Dominio API | Railway reporta sync `ACTIVE`; TLS público todavía falla por hostname/certificado |
| PostgreSQL F3 | repair Evidence verificado: 9 columnas, 0 tenant nulo, 2 FKs, 3 índices; 1 snapshot canary y mismatch 0 |

## Matriz

| Capacidad | Estado real | Evidencia | Siguiente gate |
|---|---|---|---|
| Monorepo pnpm | IMPLEMENTADO | `pnpm-workspace.yaml`; runners Node portables para workspace, seeds y tests API | Mantener workspace verde |
| Web/BFF | IMPLEMENTADO/DESPLEGADO | Next.js + Railway `3c2ac45d` | SLO y journeys autenticados |
| API NestJS/Prisma | IMPLEMENTADO/DESPLEGADO | NestJS/Prisma + Railway `3c2ac45d` | Trazas y migration gates |
| Worker/BullMQ | IMPLEMENTADO/DESPLEGADO | worker Railway `SUCCESS` | Consola común lag/retries/DLQ |
| Identidad/Tenant/RBAC | IMPLEMENTADO/PARCIAL | guards, permissions, policies | PrincipalContext/policy transversal |
| Prometeo Runtime | IMPLEMENTADO/DESPLEGADO | missions, work plans, BFF | Verify/learn/budgets/compensación |
| Tool Registry F2 | IMPLEMENTADO/PARCIAL | policy/audit/approval; adapters reales | video temporal + verification explícita |
| Event Backbone F1 | PARCIAL/DESPLEGADO/CANARY ACOTADO | Evidence + outbox, dispatcher, worker, receipts/replay; F3 ejercitó switches/allowlists | Cierre F1-F transversal + adopción transaccional multi-dominio |
| Event Catalog | PARCIAL/ACTUALIZADO | envelope v2 + `project.lifecycle-source-changed.v1` / `project-lifecycle-projection.v1` | Mantener producer/consumer/deploy/activation por evento |
| Communications | IMPLEMENTADO/PARCIAL | modelo canónico y delivery vertical | outbox/retry/circuit breaker durable |
| Payment orchestration | IMPLEMENTADO/PARCIAL | escrow, Stripe, governance | reconciliación y lenguaje legal |
| Shared Economic Ledger F5 | PENDIENTE | PaymentTxn no es double-entry | Child spec después de F4 |
| Evidence provenance | PARCIAL | storage/checksum/metadata/review | subject/custody/retention comunes |
| Trust/Governance | IMPLEMENTADO/PARCIAL | ratings, risk, disputes, policies locales | policy rulebook/apelación común |
| Mission Control F4 | PARCIAL | incidents, signals, SSE, health | Cockpit gobernado tras gate F3 |
| Project Lifecycle Projection F3 | VERIFIED / CANARY ACTIVO | `f1234291`; repair, cálculo/persistencia, rebuild/event consumer; 5 `PUBLISHED`, 5 `COMPLETED`, replay `no_op`, mismatch 0 | Ventana SLO y promoción global; outbox atómica por dominio |
| Product Intelligence | IMPLEMENTADO/PARCIAL/DESPLEGADO | PI-00..PI-06 | Verificar flags/activación |
| Workspace/Context Bridge | PARCIAL | runtime/context bridge | scope común y terminal registry |
| SDD/Blueprint Engine | IMPLEMENTADO/PARCIAL | 97 specs; strict 0/0; SDD 2.0 | Migrar specs al tocarlas + delivery evidence |
| Knowledge/RAG | IMPLEMENTADO/PARCIAL | documents/chunks/retrieval/feedback | eval set y source governance |
| Vision | IMPLEMENTADO/PARCIAL/DESPLEGADO | servicio Railway y analyzers | evidencia real, thresholds y video |
| Agro | IMPLEMENTADO/PARCIAL | fincas, animales, tareas, costos, sync | tenancy/offline/ledger común |
| Labor Engine | IMPLEMENTADO/PARCIAL | tracker, sesiones, rates, admin | approvals + economic posting |
| Agenda/Dispatch F6 | PARCIAL | reservas/field ops/weather dispersos | calendario/conflictos/routing |
| Observabilidad | PARCIAL | Sentry, Prometheus, health | OTel/correlation/SLOs |
| Backup/DR F9 | PARCIAL | docs/simulaciones | restore real y evidencia RPO/RTO |
| CI/CD | IMPLEMENTADO/DESPLEGADO | GitHub + Railway autodeploy/health | Environments, concurrency, migration gate |

## Salud SDD

```text
Specs:                              97
Spec validate strict:               0 errores / 0 warnings
Specs con related_tests:            86/97 (89%)
Specs VERIFIED:                     45/97 (46%)
Specs high/critical no VERIFIED:    33
Specs SDD 2.0:                       2/97
Tiempo validator estricto:          ~2.1 s (antes ~106 s)
```

## Hallazgos vinculantes

1. `origin/main` y producción están en `3c2ac45d`; F3 event-driven entró por
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
