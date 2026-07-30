# Matriz de implementación de la arquitectura SEMSE

**Corte:** 2026-07-30
**Git/producción:** `main@d065a2f2`
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
| API | rollback deployment `537892e7-f6b9-4cee-a972-ceacd8e7ab77`, `d065a2f2`, `SUCCESS`, health `/v1/health` |
| Web | deployment `ed9e4238-24d9-486b-a3b6-91cef022a2f1`, `d065a2f2`, `SUCCESS`, health `/api/semse/healthz` |
| Worker/Postgres/Redis/Vision | `SUCCESS` al corte |
| Dominio API | DNS propagado; TLS todavía validando propiedad y certificado no coincide |
| PostgreSQL F3 | migraciones de proyección/reloj aplicadas, tabla vacía; repair Evidence pendiente |

## Matriz

| Capacidad | Estado real | Evidencia | Siguiente gate |
|---|---|---|---|
| Monorepo pnpm | IMPLEMENTADO | `pnpm-workspace.yaml`; runners Node portables para workspace, seeds y tests API | Mantener workspace verde |
| Web/BFF | IMPLEMENTADO/DESPLEGADO | Next.js + Railway `d065a2f2` | SLO y journeys autenticados |
| API NestJS/Prisma | IMPLEMENTADO/DESPLEGADO | NestJS/Prisma + Railway `d065a2f2` | Trazas y migration gates |
| Worker/BullMQ | IMPLEMENTADO/DESPLEGADO | worker Railway `SUCCESS` | Consola común lag/retries/DLQ |
| Identidad/Tenant/RBAC | IMPLEMENTADO/PARCIAL | guards, permissions, policies | PrincipalContext/policy transversal |
| Prometeo Runtime | IMPLEMENTADO/DESPLEGADO | missions, work plans, BFF | Verify/learn/budgets/compensación |
| Tool Registry F2 | IMPLEMENTADO/PARCIAL | policy/audit/approval; adapters reales | video temporal + verification explícita |
| Event Backbone F1 | PARCIAL/DESPLEGADO | outbox Evidence, dispatcher, worker, receipts, replay ops | Flags/canary + adopción multi-dominio |
| Event Catalog | PARCIAL | catálogo y envelope v2 | Producer/consumer/deploy/activation por evento |
| Communications | IMPLEMENTADO/PARCIAL | modelo canónico y delivery vertical | outbox/retry/circuit breaker durable |
| Payment orchestration | IMPLEMENTADO/PARCIAL | escrow, Stripe, governance | reconciliación y lenguaje legal |
| Shared Economic Ledger F5 | PENDIENTE | PaymentTxn no es double-entry | Child spec después de F4 |
| Evidence provenance | PARCIAL | storage/checksum/metadata/review | subject/custody/retention comunes |
| Trust/Governance | IMPLEMENTADO/PARCIAL | ratings, risk, disputes, policies locales | policy rulebook/apelación común |
| Mission Control F4 | PARCIAL | incidents, signals, SSE, health | Cockpit gobernado tras gate F3 |
| Project Lifecycle Projection F3 | DESPLEGADO / CANARY ROLLED BACK | `d065a2f2`; canary detectó `Evidence.tenantId` ausente; rollback `537892e7` sano y 0 snapshots | Aplicar repair Evidence y repetir cálculo/persistencia |
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
Specs VERIFIED:                     44/97 (45%)
Specs high/critical no VERIFIED:    34
Specs SDD 2.0:                       2/97
Tiempo validator estricto:          ~2.1 s (antes ~106 s)
```

## Hallazgos vinculantes

1. Git y producción están en `d065a2f2`; el SQL F3 aplicado conserva su
   checksum y F3 permanece desactivado tras rollback.
2. La tabla F3 tiene cero filas; no existe activación ni adopción.
3. `Evidence.updatedAt` ya está aplicado; el canary reveló drift anterior en
   las columnas canónicas tenant/context de Evidence y requiere repair aditivo.
4. Los flags F3 existen en Railway; cálculo y persistencia están OFF tras un
   rollback verificado, con `tenant_default` conservado como allowlist.
5. F3-F9 se ejecutan como child specs secuenciales, no como big bang.
6. Health 200 confirma arranque, no journey funcional ni activación.

## Protocolo de actualización

Cada cambio de estado registra spec/test, SHA, CI, merge, deployment, flags,
canary y evidencia. No se acepta “implementado” por existencia de archivo,
“desplegado” por build en cola ni “activo” por healthcheck.
