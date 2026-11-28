# Contexto operativo canónico de SEMSEproject

**Leer antes de planificar o modificar SEMSE.**
**Corte de código:** 2026-11-24, `main` `594279af` (`594279afefad1fe760b94ec84c2cee382281ceb1`, PR #1169). Comprobado con `git merge-base --is-ancestor` en este checkout.
**Producción:** no re-verificada en este corte. La última lectura en vivo que cita la matriz es del 2026-10-03 (API/Web en `3d9743d4`). El PR abierto [#1142](https://github.com/Semse-projet/project-manager-app/pull/1142) anotó Railway/Postgres el 2026-11-12 contra el despliegue `7e80dd0f`; ese runbook no está en `main` y esta pasada no releyó Railway. `114cb9ca` (2026-07-30) es ancestro histórico, no el HEAD.

## Identidad

SEMSEproject es un sistema operativo modular para coordinar personas,
organizaciones, proyectos, trabajo de campo, evidencia, pagos, confianza,
conocimiento e IA.

- Repositorio: `Semse-projet/project-manager-app`.
- Raiz de aplicacion: `project-manager-app/`.
- Arquitectura vigente: [`architecture/CURRENT_ARCHITECTURE.md`](architecture/CURRENT_ARCHITECTURE.md).
- Estado de capacidades: [`architecture/IMPLEMENTATION_STATUS_MATRIX.md`](architecture/IMPLEMENTATION_STATUS_MATRIX.md).
- Specs: [`SPEC_INDEX.md`](SPEC_INDEX.md).
- Roadmap: [`../ROADMAP.md`](../ROADMAP.md).

## Fuentes de verdad

Usar los ejes de `SOURCE_OF_TRUTH.md`: intención autorizada, código `main`,
producción observada y contratos ejecutables se registran por separado. Una
contradicción es drift a reconciliar, no permiso para ignorar uno de los ejes.

No afirmar que una capacidad esta en produccion solo porque esta en codigo.

## Nueve dominios

1. SEMSE Core.
2. SEMSE Connect.
3. SEMSE Payments.
4. SEMSE Trust.
5. SEMSE AI.
6. SEMSE Agro.
7. SEMSE BuildOps.
8. SEMSE Knowledge.
9. SEMSE Integrations.

No crear identidad, permisos, pagos, evidencia o knowledge paralelos dentro de
un vertical. Reutilizar los contratos transversales.

## Topologia actual

```text
apps/web              Next.js + BFF
apps/api              NestJS + Prisma
apps/worker           BullMQ y jobs
apps/mobile           Expo SDK 57 (~57.0.34) / React Native 0.86.3
apps/vision-service   Vision especializado
apps/autonomy-server  runtime de autonomia
apps/angular          superficie adicional
apps/assistant-portal superficie adicional

packages/agents         packages/auth          packages/autonomy
packages/db             packages/design-tokens packages/forge
packages/knowledge      packages/product-events
packages/schemas        packages/sdk           packages/shared
packages/tools          packages/ui
```

`apps/mobile` es una app del monorepo (`@semse/mobile`, `app.json` slug
`semse-mobile`). Entró por #489 y la consolidación #598 (`a42600ec`, ancestro
de `main`); los parches de compilación llegan hasta #1182. No es un release de
tienda ni un canary en dispositivo re-verificado en este corte. El texto que
la daba por retirada (`archive/mobile-spike-2026-06`) describe el spike de
junio de 2026, no el árbol actual.

`apps/angular` y `apps/assistant-portal` siguen siendo superficies adicionales
o de transición. No cambiar la raíz canónica ni hacer rename big-bang.

## Estado de código en `main` (2026-11-24)

Comprobado en el árbol de `594279af`. Nada de esta lista afirma que el flag
esté encendido en Railway.

- Prometeo Runtime P2 está en el código (`apps/api/src/modules/prometeo`,
  misiones y work plans). Su despliegue no se re-verificó.
- F3 event-driven se mergeó en `f1234291` (ancestro). El cálculo por tenant
  exige `SEMSE_PROJECT_LIFECYCLE_PROJECTION_ENABLED=true` y que el tenant esté
  en `SEMSE_PROJECT_LIFECYCLE_CANARY_TENANT_IDS` (o `*`). La evidencia de
  canary en `tenant_default` no se re-verificó desde el corte del spec
  (2026-07-31).
- `PROMETEO_TOOL_REGISTRY` tiene 41 descriptores: 31 `readTool` y 10
  `writeTool`. `adapterPending: true` queda en `vision.analyze_video`,
  `business_os.assign_task` y `business_os.release_task`. El conteo 31 (24
  read / 7 write) es el corte de 2026-07-31.
- El Event Backbone (envelope v2, outbox de Evidence, dispatcher BullMQ,
  consumers y replay) está en el código. F1-A..F1-E están en `main`. F1-F
  (cierre transversal de canary/SLO) sigue abierto. La allowlist de
  producción no se releyó.
- Hay `PaymentTxn`. No hay modelo compartido de ledger double-entry
  (`Ledger` / `JournalEntry` no están en `schema.prisma`).
- F4 Mission Control 2.0 está mergeado (#486, `afb2dccd`, ancestro). Se
  enciende solo si `SEMSE_MISSION_CONTROL_V2_ENABLED` es exactamente `true`
  o el tenant está en `SEMSE_MISSION_CONTROL_V2_CANARY_TENANT_IDS`. El spec
  sigue en `activation_status: INACTIVE`. La lectura de canary del
  2026-10-11 que guarda el spec no se repitió.
- F10 está en código y detrás de flags. Identidad: #539 (`8e0ad1e3`) y el
  selector web #568 (`500bebc7`) son ancestros; la UI sale solo con
  `SEMSE_IDENTITY_CAPABILITY_UI_ENABLED=true` o el tenant en
  `SEMSE_IDENTITY_CAPABILITY_UI_CANARY_TENANT_IDS`. Originador: #538 y #569
  (`41eca604`) son ancestros; el registro sale solo con
  `SEMSE_ORIGINATOR_REGISTRATION_ENABLED=true` o
  `SEMSE_ORIGINATOR_CANARY_TENANT_IDS`. ADR-025 está `ACCEPTED` en la opción
  C (no construir ahora el cliente MCP externo). El consentimiento entrante
  (`apps/api/src/modules/mcp-consent`) no publica rutas HTTP.
- Product Intelligence incluye el agregado de fricción PI-07 en
  `product-intelligence.service.ts`. `PRODUCT_INTELLIGENCE_ENABLED` tiene que
  ser `true` para el camino del observer que se leyó. El valor en Railway no
  se re-verificó.
- Hay 219 archivos `docs/specs/**/*.spec.md`. En este checkout,
  `node ./scripts/spec-validate.mjs --strict` terminó con 0 errores y 0
  warnings, y `spec:index --check` coincidió con esos 219 specs. Eso no
  sustituye el CI del PR.
- BO-09 (geocerca) y BO-07 (cuadrillas) tienen código en `main` (#1019 y el
  corte #1169). Sus specs siguen `IN_PROGRESS` / `UNMERGED` porque el propio
  spec no se declara cerrado (Gate 5 y OPEN-18 en geocerca). Con la variable
  ausente, `SEMSE_GEOFENCE_POLICY_ENABLED` y `SEMSE_CREWS_ENABLED` quedan
  apagados (`=== "true"`).

## Nueve dominios — presencia en código

Activación de producción: no re-verificada desde 2026-10-03, salvo donde un
spec cita una evidencia anterior (esa fecha es la del spec, no de este corte).

| Dominio | Módulos presentes en `apps/api/src/modules/` | Flag de código relevante |
| --- | --- | --- |
| SEMSE Core | `auth`, `users`, `organizations`, `did`, `worker-verification`, `geofence`, `originator` | Geocerca y cuadrillas: apagadas si la variable no es `true`. Identidad UI y registro de originador: apagados si la variable no es `true`, salvo que el tenant esté en su lista (`SEMSE_IDENTITY_CAPABILITY_UI_CANARY_TENANT_IDS` o `SEMSE_ORIGINATOR_CANARY_TENANT_IDS`) |
| SEMSE Connect | `jobs`, `marketplace`, `matching`, `bids`, `field-ops`, `labor-engine`, `communications`, `contracts`, `reservations` | `SEMSE_LABOR_POLICY_ENABLED` apagado salvo `true` |
| SEMSE Payments | `payments`, `payment-governance`, `finance`, `liens` | `PAYMENTS_RELEASE_COMMAND` solo con `on`; gobernanza de release por defecto `shadow`; `LIEN_ALERTS_ENABLED` solo con `true` |
| SEMSE Trust | `ratings`, `trust`, `governance`, `disputes` | Código presente; sin relectura de producción |
| SEMSE AI | `prometeo`, `ai-models`, `agents`, `autonomy`, `vision`, `browser-agent`, `operational-intelligence`, `product-intelligence` | Chat actions por defecto `off`; Together y voz solo con `true`; Mission Control como F4 |
| SEMSE Agro | `agro` (y pantallas en `apps/mobile/src/screens/worker/Agro*`) | Código presente; sin relectura de producción |
| SEMSE BuildOps | `buildops`, `milestones`, `projects`, `pricing`, `materials`, `incidents`, `tools`, `change-orders` | Proyección de ciclo de vida: flag `true` y allowlist |
| SEMSE Knowledge | `knowledge`, `repo-knowledge`, `runtime-knowledge`, `graphify`, `skills` | `SEMSE_SKILLS_ENABLED` solo con `true` |
| SEMSE Integrations | `satellites`, `evidence-gateway`, `developer-runtime`; consentimiento MCP sin rutas | `SATELLITE_WEBHOOKS_ENABLED` solo con `true` |

## Coordinación con el PR #1142

[#1142](https://github.com/Semse-projet/project-manager-app/pull/1142) sigue
abierto y es el inventario de “mergeado y no encendido”. Este corte no copia
`docs/runbooks/PRODUCTION_ACTIVATION_BACKLOG.md` para no chocar con ese PR.
Lo que se releyó en código el 2026-11-24, y lo que no:

- Siguen apagados por defecto en código (variable ausente o valor distinto
  del esperado): `PAYMENTS_RELEASE_COMMAND` (solo `on`),
  `AI_PRICING_CATALOG_MODE` (default `off`),
  `SEMSE_AGENT_RUN_FINALIZATION_OUTBOX_ENABLED`,
  `SATELLITE_WEBHOOKS_ENABLED`, `SEMSE_GEOFENCE_POLICY_ENABLED`,
  `SEMSE_LABOR_POLICY_ENABLED`, `SEMSE_CHAT_ACTIONS_MODE` (default `off`),
  `SEMSE_CONVERSATION_INTELLIGENCE_MODE` (default `off`),
  `SEMSE_MISSION_CONTROL_V2_ENABLED` (o lista canario),
  `SEMSE_ORIGINATOR_REGISTRATION_ENABLED` (o lista canario),
  `SEMSE_TOGETHER_ENABLED`, `SEMSE_VOICE_ENABLED` junto con
  `SEMSE_VOICESTUDIO_DEV_ENABLED`.
- No están apagados: `PAYMENTS_RELEASE_GOVERNANCE_MODE` cae en `shadow`
  (evalúa y registra `release_governance_shadow_would_block`, no bloquea;
  `off` salta la evaluación y `enforce` bloquea). `SEMSE_VERIFIED_ESCROW_MODE`
  cae en `shadow` y registra lo que habría bloqueado; un valor distinto de
  `shadow` o `enforce` lanza error, no desactiva el control.
- Que Railway deje sin definir cualquiera de estas variables no se
  re-verificó desde el inventario del 2026-11-11.
- En git, después del texto de #1142: #1143/#1145 están en `66314be2`
  (health gate sin `RAILWAY_TOKEN`); #1146 está en `7e80dd0f`; el arreglo de
  contexto pricing/risk está en `7029da63` (#1147/#1149). No hay commit de
  #1141 ni de #1144 en `main`. Si esos jobs corren en producción no se
  re-verificó desde 2026-11-12.
- Las filas de #1142 sobre membresía `AGENT_RUNNER`, conteos HTTP y
  schedulers con HTTP 201 quedan como observación del 2026-11-12, no como
  estado actual.

## Reglas de Prometeo

Runtime:

```text
OBSERVE -> INTERPRET -> PLAN -> REQUEST APPROVAL
        -> EXECUTE -> VERIFY -> LEARN
```

- Prometeo no sustituye modulos de dominio.
- Read-only puede autoaprobarse si permisos/policy lo permiten.
- Write/critical requiere aprobacion, auditoria, verification y compensacion.
- No ejecutar mutaciones criticas directamente desde un LLM.
- No crear tools fuera del registry.

## Reglas de eventos

Objetivo:

```text
domain transaction + outbox row
  -> dispatcher
  -> BullMQ
  -> idempotent consumers
  -> projections/ledger/notifications/agents
  -> Mission Control
```

El bus actual es parcial. La atomicidad está demostrada para Evidence y para el
effect+receipt de consumers. F3 adoptó eventos/replay en canary, pero sus hooks
fuera de Evidence son post-commit hasta la migración explícita de cada dominio.

Todo evento nuevo debe declarar:

- producer y bounded context;
- schema versionado;
- actor, tenant y org;
- correlation/causation;
- idempotency;
- consumers;
- retry/DLQ/replay;
- impacto de seguridad y PII.

## Reglas economicas

- Separar estados de proyecto, hito, evidencia, autorizacion, pago y ledger.
- Stripe no equivale automaticamente a escrow legal.
- Usar “pagos protegidos por hitos” salvo contrato/legal especifico.
- `PaymentTxn` no debe presentarse como ledger double-entry.

## Secuencia activa

1. F0: sincronizar documentación y verdad (revalidado 2026-07-28).
2. F1: Event Backbone (F1-F cierra con canary).
3. F2: Prometeo Tool Registry gobernado.
4. F3: Project Lifecycle Projection (`VERIFIED` en canary).
5. F4: Mission Control 2.0 (mergeado en #486; encendido solo por flag o lista canario; activación de producción no re-verificada desde 2026-10-11).
6. F5: Shared Economic Ledger.
7. F6: Agenda y Dispatch.
8. F7: Prometeo Multimodal.
9. F8: Domain Loops.
10. F9: Production Hardening.

No saltar directamente al ledger o a mutaciones autonomas sin cerrar el backbone
de eventos, idempotencia y supervision.

## Comandos de validacion

```bash
pnpm install --frozen-lockfile
pnpm db:generate
pnpm build:api
pnpm verify:workspace
pnpm spec:preflight
pnpm test:unit
pnpm test:e2e
```

Elegir los comandos proporcionados al riesgo y documentar lo no ejecutado.

## Regla de entrega

Cada PR debe indicar:

- problema y bounded context;
- spec/ADR aplicable;
- cambios de datos y rollback;
- permisos/policy;
- eventos producidos/consumidos;
- pruebas ejecutadas;
- estado local, CI y produccion como evidencias separadas.
