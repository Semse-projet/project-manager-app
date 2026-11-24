# Matriz de implementación de la arquitectura SEMSE

**Corte de código:** 2026-11-24, `main` `594279afefad1fe760b94ec84c2cee382281ceb1` (PR #1169)
**Producción:** no re-verificada desde 2026-10-03 (lectura de ese día más abajo). `114cb9ca` y `f1234291` son ancestros, no el HEAD.
**Tracker:** [`../PRODUCTION_CONVERGENCE_TRACKER.md`](../PRODUCTION_CONVERGENCE_TRACKER.md) sigue abriendo en el snapshot del 2026-07-31 (`114cb9ca`). No se reescribió aquí y no es el SHA actual.
**Backlog de activación:** PR abierto [#1142](https://github.com/Semse-projet/project-manager-app/pull/1142). No se copia su runbook a `main` en este cambio. Sus observaciones de Railway/Postgres quedan sin re-verificar desde 2026-11-12.

## Leyenda

- **IMPLEMENTADO:** código y validación relevante; no implica merge/deploy.
- **DESPLEGADO:** SHA verificado en un deployment terminal.
- **ACTIVO:** flag/allowlist y journey funcional verificados.
- **PARCIAL:** existe una parte útil, falta el gate transversal.
- **PENDIENTE:** no existe como capacidad común verificable.

Para specs SDD 2.0 mandan las columnas separadas de
`docs/SPEC_INDEX.md`; esta matriz resume capacidades, no sustituye evidencia.

## Producción observada

**No re-verificada desde 2026-10-03.** La tabla de ese día se conserva como
última lectura en vivo (API de Railway, proyecto `SEMSEproject` / environment
`production`). No describe el despliegue del 2026-11-24. El detalle está en
el hallazgo 11.

| Superficie | Evidencia |
|---|---|
| API (`semse-API`) | deployment `71ac7abd`, commit `3d9743d4` (PR #753), `SUCCESS` |
| Web (`semse-web`) | deployment `5df35495`, commit `3d9743d4` (PR #753), `SUCCESS` |
| Worker (`semse-worker`) | deployment `ccdbdfa3`, `SUCCESS`/`online` — commit individual no confirmado en esta pasada |
| Vision (`semse-vision`) | deployment `aa14d6c7`, `SUCCESS`/`online` — commit individual no confirmado en esta pasada |
| Postgres/Redis | `online`; Postgres con 1 warning no crítico, no investigado |
| `origin/main` | `7da0094` (PR #757) — **4 PRs por delante** de lo desplegado (#753) |

**Snapshot anterior (2026-07-31, `HISTORICAL`, conservado para
trazabilidad):**

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
| Web/BFF | IMPLEMENTADO. Despliegue no re-verificado desde 2026-10-03 | Next.js en `main@594279af`. El SHA de Railway `114cb9ca` es el snapshot 2026-07-31 | SLO y journeys autenticados |
| API NestJS/Prisma | IMPLEMENTADO. Despliegue no re-verificado desde 2026-10-03 | NestJS/Prisma en `main@594279af` | Trazas y migration gates |
| Worker/BullMQ | IMPLEMENTADO. Despliegue no re-verificado desde 2026-10-03 | `apps/worker` en `main`. Schedulers (`LIVE_SESSION_SWEEP_ENABLED`, `PAYMENTS_RECONCILE_ENABLED`, `WEATHER_CHECK_ENABLED`, `LIEN_ALERTS_ENABLED`) solo arrancan si la variable es `true` | Releer Railway antes de dar un scheduler por activo. Consola común lag/retries/DLQ |
| Cliente móvil (`apps/mobile`) | IMPLEMENTADO/PARCIAL, en `main` | Expo `~57.0.34`, React Native `0.86.3`, slug `semse-mobile`. #489 creó el `package.json`; #598 (`a42600ec`) está mergeado; #1162–#1182 alinean el SDK, añaden workflow `mobile-checks.yml`, perfil EAS pilot y pantallas de ubicación/cuadrillas (#1169). Pantallas Worker, Client y Admin están en `apps/mobile/src/screens`. Spec `ui.mobile-product-consolidation`: `merge_status: MERGED`, `code_status: IN_PROGRESS`, gates de §12 sin re-ejecutar | Canary autenticado por rol en device y release de tienda, no re-verificados. La cuota EAS “resetea 2026-10-01” es una nota de 2026-09; no se consultó EAS |
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
| Mission Control F4 | MERGEADO en código. Activación no re-verificada desde 2026-10-11 | PR #486 `afb2dccd` (2026-07-31) es ancestro de `594279af`. Flag: `SEMSE_MISSION_CONTROL_V2_ENABLED=true` o tenant en `SEMSE_MISSION_CONTROL_V2_CANARY_TENANT_IDS`. Spec `activation_status: INACTIVE` | Releer el canary en Railway. El “falta merge” de documentos de julio ya no aplica |
| Project Lifecycle Projection F3 | Código en `main`. Canary de producción no re-verificado desde 2026-07-31 | `f1234291` es ancestro. En código el cálculo exige `SEMSE_PROJECT_LIFECYCLE_PROJECTION_ENABLED=true` y allowlist. Los 5 `PUBLISHED` / mismatch 0 son la evidencia histórica del canary, no una lectura nueva | Releer flags y la tabla de snapshots antes de llamar al canary “activo” |
| Product Intelligence | IMPLEMENTADO/PARCIAL/DESPLEGADO | PI-00..PI-10 (PR #322, 2026-07-17); PI-11.2 auditoría de privacidad aprobada (PR #326, 2026-07-17, "variables activas, 3 servicios SUCCESS") — ambos ancestros confirmados de `origin/main` | Re-verificar flags/activación de forma independiente en esta pasada |
| Workspace/Context Bridge | PARCIAL | runtime/context bridge | scope común y terminal registry |
| SDD/Blueprint Engine | 219 `*.spec.md`. Strict local 0/0 el 2026-11-24 | `node ./scripts/spec-validate.mjs --strict` en este checkout. El 98/0/0 es 2026-07-31; el 128/0/0 es 2026-10-03 | El CI del PR puede diferir de esta corrida local |
| Knowledge/RAG | IMPLEMENTADO/PARCIAL | documents/chunks/retrieval/feedback | eval set y source governance |
| Vision | IMPLEMENTADO/PARCIAL/DESPLEGADO | servicio Railway y analyzers | evidencia real, thresholds y video |
| Agro | IMPLEMENTADO/PARCIAL | fincas, animales, tareas, costos, sync | tenancy/offline/ledger común |
| Labor Engine | IMPLEMENTADO/PARCIAL | tracker, sesiones, rates, admin | approvals + economic posting |
| Agenda/Dispatch F6 | PARCIAL | reservas/field ops/weather dispersos; m2.3-weather Bloque 2.3.A (Tomorrow.io + clasificación por trade, `WeatherAlert`) mergeado a `main` — PR #592 merge `140c192c` (2026-08-27); CI real no corrió sobre el merge | calendario/conflictos/routing; push notifications/auto-halt/change-order (Bloques 2.3.B/C) sin empezar |
| Observabilidad | PARCIAL | Sentry, Prometheus, health | OTel/correlation/SLOs |
| Backup/DR F9 | PARCIAL | docs/simulaciones | restore real y evidencia RPO/RTO |
| CI/CD | IMPLEMENTADO/DESPLEGADO | GitHub + Railway autodeploy/health | Environments, concurrency, migration gate |
| Identidad universal multi-capacidad F10 | Código mergeado, detrás de flag | #539 `8e0ad1e3` y #568 `500bebc7` son ancestros de `594279af`. `isCapabilitySelectorEnabled` exige `SEMSE_IDENTITY_CAPABILITY_UI_ENABLED=true` o el tenant en `SEMSE_IDENTITY_CAPABILITY_UI_CANARY_TENANT_IDS`. El spec sigue `activation_status: INACTIVE`. Su `verification_scope` ya no dice que la fase 3 está sin mergear | Canario de producción no re-verificado. No cambiar variables de Railway desde un agente |
| Originador/facilitador F10 | Código mergeado, detrás de flag o lista canario | #538 `6040d75e` y #569 `41eca604` (2026-08-26) son ancestros. `0cc3c522` es un merge de rama, no el commit de GitHub de #569. `isOriginatorRegistrationEnabled` exige `SEMSE_ORIGINATOR_REGISTRATION_ENABLED=true` o el tenant en `SEMSE_ORIGINATOR_CANARY_TENANT_IDS`. El spec dice `activation_status: CANARY` con evidencia del 2026-10-12: eso no se releyó | Fase 3 (pago real) sigue bloqueada por el gate legal del spec. No activar el flag desde un agente |
| Orquestación externa MCP F10 | No construida (ADR-025 `ACCEPTED`, opción C, 2026-08-04) | `SPEC-INT-001` sigue retirado. Hay código de consentimiento entrante en `apps/api/src/modules/mcp-consent` (el repositorio dice que no hay rutas). ADR-045 (MCP entrante) sigue `PROPOSED`. No es el cliente MCP externo de F10 | No registrar tools externas. No tratar `mcp-consent` como gateway saliente |

## Salud SDD

**Conteo y strict local el 2026-11-24:** 219 `docs/specs/**/*.spec.md`.
`node ./scripts/spec-validate.mjs --strict` en este checkout: 0 errores, 0
warnings. No se corrió `spec:coverage`. El bloque del 2026-10-03 queda como
la ejecución anterior (128 specs), no como el conteo de hoy.

**Última ejecución registrada, 2026-10-03** (`pnpm spec:index` +
`spec:validate:strict` + `spec:coverage` — ver Hallazgo 11). No re-ejecutada
desde esa fecha:

```text
Specs:                              128
Spec validate strict:               0 errores / 0 warnings
Specs con related_tests:            114/128 (89%)
Specs VERIFIED:                     46/128 (36%)
Specs high/critical no VERIFIED:    45
Specs SDD 2.0:                      36/128 (28%)
Specs declaradas DEPLOYED:          5
Specs declaradas ACTIVE:            1
```

Cifras del corte anterior (2026-07-31, `HISTORICAL`):

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

1. **Histórico (2026-07-31), no es el corte actual.** Ese día `origin/main` y
   la producción observada estaban en `114cb9ca`; F3 event-driven entró por
   `f1234291`. Esos cuatro deployments `SUCCESS` no se releyeron. `main` al
   2026-11-24 es `594279af`.
2. **Histórico (2026-07-31), no re-verificado.** La tabla F3 contenía exactamente un snapshot canary, con revisión durable
   igual a la calculada y cero mismatch de tenant/proyecto.
3. **Histórico (2026-07-31), no re-verificado.** `Evidence.updatedAt` y las nueve columnas canónicas tenant/context estaban
   aplicadas; cuatro filas tenían tenant válido, con dos FKs y tres índices.
4. **Histórico (2026-07-31), no re-verificado.** Los flags F3 estaban ON únicamente para `tenant_default`; el rollback anterior,
   el forward-fix y el replay quedaron verificados por separado. En el código
   de 2026-11-24 el cálculo exige además `SEMSE_PROJECT_LIFECYCLE_PROJECTION_ENABLED=true`.
5. **Histórico (2026-07-31), no re-verificado.** El Worker requería `EVENT_CONSUMER`; dos 403 iniciales se reconciliaron y
   tres eventos posteriores se consumieron automáticamente.
6. Evidence usa outbox atómica; los demás hooks F3 son post-commit best-effort.
7. F3-F9 se ejecutan como child specs secuenciales, no como big bang.
8. Health 200 confirma arranque, no journey funcional ni activación.
9. **Histórico (2026-08-27). No describe el CI de noviembre.** Ese día no
   aparecía ningún check run real desde 2026-08-19. Después entraron a
   `main` commits que citan CI (#1143 `66314be2`, #1166 `bfcee336`, #1169
   `594279af`, entre otros). Esta pasada no listó los runs de Actions de
   `594279af`, así que no se afirma que el pipeline esté verde. Texto
   original: GitHub Actions no generó
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

10. **Consolidación móvil (nota del 2026-09-07, superada en el merge).**
    Ese día #598 seguía en draft y la evidencia local era `tsc`, jest
    45/45·213/213, `expo export` y el build EAS Android `680386ee`. Esos
    números no se repitieron el 2026-11-24. #598 luego se mergeó
    (`a42600ec`). Siguen sin re-verificar el release de tienda y el canary
    en dispositivo. Ninguna fuente móvil se borró
    (`docs/consolidation/MOBILE_SOURCE_REGISTER.md`).

11. **Refresco de producción y salud SDD (2026-10-03, modo `PRODUCTION_VERIFIED`
    para Railway y `READ_ONLY_VERIFIED` para specs/git — `semseproject`
    SKILL.md §9 — no re-verifica el resto de esta matriz):**
    - `origin/main` confirmado en `7da00947` (PR #757).
    - Producción (Railway, proyecto `SEMSEproject`) verificada en vivo vía
      `environment-status`/`list-deployments`, no solo healthcheck: `semse-API`
      y `semse-web` en `SUCCESS` sobre commit `3d9743d4` (PR #753) — **4 PRs
      detrás** de `main`. `semse-worker`/`semse-vision` `SUCCESS`/`online` en
      la misma ventana de deploy, commit individual no confirmado
      (`READ_ONLY_PARTIAL`). Sin fallos recientes ni trabajo pendiente en
      ningún servicio. Postgres con 1 warning no crítico, no investigado.
    - `pnpm spec:index` + `spec:validate:strict` + `spec:coverage` corridos en
      vivo: specs subieron de 98 (2026-07-31) a 128; 0 errores/warnings
      estrictos; VERIFIED subió en conteo absoluto (45→46) pero bajó en
      proporción (46%→36%) porque la mayoría de los ~30 specs nuevos aún no
      está VERIFIED — dato para priorizar, no una regresión de calidad de los
      specs existentes.
    - No se re-verificó ninguna fila de la tabla "Matriz" arriba en esta
      pasada salvo donde ya cita evidencia 2026-08/09 de pasadas anteriores;
      tratarlas como `HISTORICAL` hasta su propio refresco.

12. **Corte de código 2026-11-24 (`594279af`), sin lectura de producción.**
    - `apps/mobile` existe (Expo `~57.0.34`). El párrafo que lo daba por
      retirado no aplica a este árbol. #598 está mergeado; el spec de
      consolidación pasa a `merge_status: MERGED` y deja los gates de
      dispositivo/tienda sin re-ejecutar (`code_status: IN_PROGRESS`,
      `deploy_status: NOT_DEPLOYED`).
    - F4 está mergeado. El encendido es flag o lista canario. La frase
      “falta CI, merge, deploy y canary” de julio queda retirada.
    - F10 identidad (#539, #568) y originador (#538, #569) están en `main`,
      detrás de flags cuyo default en código es apagado. ADR-025 está
      aceptada en la opción C.
    - Tool registry: 41 descriptores (31 read, 10 write), no 31.
    - PR #1142 sigue abierto. No se vendoriza su backlog. #1141 y #1144 no
      tienen commit en `main`. #1143/#1145, #1146 y #1147/#1149 sí. Las
      observaciones de Railway de ese PR no se re-verificaron desde
      2026-11-12.
    - `PRODUCTION_CONVERGENCE_TRACKER.md` y
      `PRODUCTION_CONVERGENCE_MAP.md` siguen titulando `114cb9ca` como base
      actual. Se dejaron así a propósito: son snapshots fechados, y esta
      pasada no re-verificó producción para reescribirlos.

## Protocolo de actualización

Cada cambio de estado registra spec/test, SHA, CI, merge, deployment, flags,
canary y evidencia. No se acepta “implementado” por existencia de archivo,
“desplegado” por build en cola ni “activo” por healthcheck.
