# Backlog de activación en producción — trabajo fusionado que no está encendido

**Fecha:** 2026-11-11 · **Main:** `db92934` (desplegado en los 4 servicios de Railway, 2026-11-10 02:18Z) · **Fuente:** lectura de código de `main` y Railway en **solo lectura**: `describe-service` (solo nombres de variables, nunca valores), logs de deploy y HTTP.

> Este documento no cambia producción. Cada fila marcada **[DUEÑO]** es un cambio de variable o de datos en Railway que requiere tu autorización explícita (AGENTS.md). "No definida" significa que la variable **no existe** en el servicio, así que el código usa su valor por defecto. Los valores de las variables definidas no se leyeron.

## 0. Bloqueos activos (P0)

| # | Qué está roto | Evidencia | Arreglo | Estado |
|---|---|---|---|---|
| P0-1 | **Ningún AgentRun se reclama ni se ejecuta** (agentes de Prometeo, browser agent, retries). | API HTTP: `POST /v1/agents/runs/reclaim-stale` → **403** cada 10 s desde el deploy de #1129 (2026-11-09). #1129 separó `agents:run:claim` en el rol de máquina `AGENT_RUNNER` y su propia nota decía "aprovisionar la identidad del Worker con `AGENT_RUNNER` antes de desplegar". El merge desplegó sin ese paso. | (1) `SEMSE_ROLES` de semse-worker con `AGENT_RUNNER` → **hecho 2026-11-11 00:00Z** (autorizado por el dueño). (2) **[DUEÑO]** verificar y, previa aprobación explícita, aprovisionar la membresía `ACTIVE` de la identidad técnica `usr_worker_system` en el tenant/org reales del Worker; solicitar exclusivamente `AGENT_RUNNER` con el script de membresías (dry-run primero). **No usar `railway run` suponiendo que ejecuta dentro del contenedor**; ver procedimiento seguro §0.1. | Pendiente del paso 2 |
| P0-2 | **Production Health Gate nunca se ejecuta** tras un deploy. | GitHub Actions `Railway Deploy`: el último éxito fue 2026-10-20 (`06dfd7b`); desde 2026-10-26, todos los runs de `main` fallan con `Not Authorized` de la API de Railway. El gate depende de ese job y queda `skipped`. Producción **sí** está al día porque Railway despliega `main` con su integración nativa de GitHub (`checkSuites: false`). | **[DUEÑO]** Regenerar el token de Railway y actualizar el secret `RAILWAY_TOKEN` del repo, o decidir retirar el deploy duplicado de Actions y dejar el Health Gate independiente (cambio de CI, necesita autorización). | Pendiente |
| P0-3 | Los logs del worker registran "sweep/reclaim failed" sin motivo. | pino serializaba el `Error` como `{}`. | PR #1141 (`describeError`), actualizado para omitir cuerpos HTTP, query strings y mensajes no clasificados. | Draft; CI y API Integration verdes en HEAD `3b09e0a5`; no desplegado |

### 0.1 Procedimiento seguro para el 403 de AgentRun

**Causa contractual:** `/v1/agents/runs/claim` y `/v1/agents/runs/reclaim-stale` requieren **ambos** el permiso `agents:run:claim` y el rol efectivo `AGENT_RUNNER`. En API la autorización es la intersección de `Membership ACTIVE`, roles persistidos en `AuthSession` y roles del JWT. Añadir `SEMSE_ROLES` sin la membresía activa y una sesión que incluya el rol no resuelve el 403.

**Dónde ejecutar:** `railway run` ejecuta localmente e inyecta variables remotas, pero no equivale a ejecutar dentro de Railway ni garantiza conexión a una URL privada de PostgreSQL. La imagen final de `Dockerfile.worker` **no copia** `/app/scripts`, así que tampoco se debe intentar el script con `railway ssh -s semse-worker`. La imagen de `Dockerfile.api` sí copia `/app/scripts` y dispone del cliente Prisma. Usar una sesión `railway ssh` autorizada en `semse-API` con `/app` como directorio de trabajo, o un entorno controlado equivalente que tenga acceso a la base correcta.

1. **Solo lectura:** confirmar en la configuración del Worker los identificadores reales `SEMSE_USER_ID`, `SEMSE_TENANT_ID`, `SEMSE_ORG_ID` y que `SEMSE_ROLES` solicite `AGENT_RUNNER`. No asumir valores de la API ni imprimir tokens.
2. **Dry-run:** entrar en `semse-API` por SSH y ejecutar desde `/app` el comando siguiente, sustituyendo `TENANT_REAL` y `ORG_REAL` tras verificar los valores del Worker (se solicitan **solo** los grants faltantes de `AGENT_RUNNER`):

   ```sh
   SEMSE_USER_ID=usr_worker_system SEMSE_TENANT_ID=TENANT_REAL SEMSE_ORG_ID=ORG_REAL SEMSE_ROLES=AGENT_RUNNER node scripts/ops/ensure-worker-service-membership.mjs
   ```

3. **Puerta humana:** revisar `plan.ok=true`, `createRoles`, `createMemberships`, `alreadyActive` y `skippedNonActive`. Si aparece `skippedNonActive` o el tenant/org no coincide, **detenerse**; una suspensión/revocación no debe reactivarse por automatismo. `--apply` solo tras aprobación explícita del dueño para esa identidad/organización/rol, nunca para cuentas humanas.
4. **Refresco y aceptación:** una sesión emitida antes de incluir `AGENT_RUNNER` sigue sin ese rol aunque se actualice la BD; renovar **controladamente** la sesión del Worker después del grant, si corresponde. Verificar respuesta no-403 en `reclaim-stale` y, con un run de prueba aislado, `claim → start → heartbeat → complete` con `claimToken`; no activar nuevas autonomías ni afirmar completitud por solo un 201.

**Sin cambios operativos en este PR:** estas instrucciones no ejecutan el grant, no leen valores secretos y no alteran Railway, DB ni permisos.

## 1. Schedulers del worker: estado comprobado en producción (2026-11-11 13:14 UTC)

La consulta de variables de Railway muestra ahora `PAYMENTS_RECONCILE_ENABLED` y `LIVE_SESSION_SWEEP_ENABLED` **definidas** en `semse-worker`. Sus valores no se leyeron; su ejecución está confirmada de forma independiente por solicitudes HTTP satisfactorias y logs del Worker. Esto actualiza la fotografía histórica anterior, sin implicar que deban modificarse sus valores.

| Variable | Qué activa | Riesgo | Prerrequisito | Recomendación |
|---|---|---|---|---|
| `LIEN_ALERTS_ENABLED` | Chequeo horario de plazos de lien: transiciona `LienCalendar` y genera notices al llegar a 3 días. | Medio (aviso legal) | **El push/email al PRO no está implementado**: falta decidir el destinatario (ver §4, D-LIEN). | Activar después de D-LIEN; sin la notificación, solo cambia estados. |
| `PAYMENTS_RECONCILE_ENABLED` | Cada ~15 min detecta RELEASE `PENDING` estancados, alerta y audita. **Solo lectura sobre dinero.** | Bajo | Ninguno. Runbook `ESCROW_RELEASE_RECONCILIATION.md`. | **ACTIVO, verificado**: HTTP 201 a las 12:38, 12:53 y 13:08 UTC; logs del Worker indican 0 RELEASE `PENDING` estancados en esas ejecuciones. Mantener y monitorizar; no activar otro scheduler ni efectuar releases. |
| `WEATHER_CHECK_ENABLED` | Alertas de clima por proyecto. | Bajo | **`TOMORROW_API_KEY` no está definida en la API**: hoy el módulo de clima usa el cliente **mock**, así que cualquier dato de clima en producción es simulado. | **[DUEÑO]** Configurar `TOMORROW_API_KEY` y después `WEATHER_CHECK_ENABLED=true`. |
| `LIVE_SESSION_SWEEP_ENABLED` | Cierra sesiones live (LiveKit) caducadas cada minuto. | Bajo | Ninguno. | **ACTIVO, verificado**: HTTP 201 cada minuto, incluida la ejecución de 13:14 UTC. Mantener; no duplicar el scheduler. |

`PRODUCT_INTELLIGENCE_ENABLED`, `CONTRIBUTOR_EXTRACTION_SWEEP_ENABLED`, `AUTONOMY_LOOPS_ENABLED`, `PAYMENTS_RECONCILE_ENABLED` y `LIVE_SESSION_SWEEP_ENABLED` están definidas en el worker. La presencia de una variable por sí sola no acredita su valor; las dos últimas cuentan además con evidencia HTTP de ejecución.

## 2. Funcionalidades de la API con su variable sin definir (valor por defecto)

| Variable | Defecto en código | Qué queda apagado / en modo seguro | Spec | Para activar |
|---|---|---|---|---|
| `PAYMENTS_RELEASE_COMMAND` | off | Comando único de liberación de escrow (ADR-041 slice 2: idempotencia, 1 release por hito). Se sigue usando el camino anterior. | `payments/escrow-release-command.spec.md` | Decisión de dinero: canary primero. |
| `PAYMENTS_RELEASE_GOVERNANCE_MODE` | **shadow** | La gobernanza completa del release solo registra `release_governance_shadow_would_block`, no bloquea. | ADR-041 | Revisar los logs de shadow y pasar a `enforce`. |
| `SEMSE_VERIFIED_ESCROW_MODE` | **shadow** | Prueba de contrato verificado antes de reservar fondos (#839): solo registra. | `tools/fase-1/m1.4-provider-verified-contract-execution.spec.md` | Revisar shadow y pasar a `enforce`. |
| `AI_PRICING_CATALOG_MODE` | off | Costo de IA por catálogo versionado (C39): sin precios, el costo es el legado. | C39 | Cargar precios del dueño, `shadow`, luego `on`. |
| `SEMSE_AGENT_RUN_FINALIZATION_OUTBOX_ENABLED` | off | Efectos de fin de AgentRun (approvals, auditoría, memoria) por outbox transaccional; hoy van por el camino directo. | event backbone F1 | Después de resolver P0-1. |
| `SATELLITE_WEBHOOKS_ENABLED` | off | Webhooks salientes a satélites (SAT-007): los eventos se escriben, pero no se entregan. | `satellites/SAT-007-outbound-webhooks.spec.md` | Si hay satélites registrados. |
| `SEMSE_GEOFENCE_POLICY_ENABLED` | off | Política de geocerca en servidor (BO-09, fusionado como "parcial"). | `core/geofence-policy.spec.md` | Completar el parcial antes de activar. |
| `SEMSE_LABOR_POLICY_ENABLED` | off | Política laboral del Labor Engine. | `core/labor-policy.spec.md` | Revisar la spec. |
| `SEMSE_CHAT_ACTIONS_MODE` | off | Acciones de chat de Prometeo. | `prometeo/chat-actions.spec.md` | `shadow` y después `on`. |
| `SEMSE_CONVERSATION_INTELLIGENCE_MODE` | off | Espejo canónico de conversaciones (no toca la base en off). | `prometeo/conversation-intelligence-foundation.spec.md` | `shadow`. |
| `SEMSE_MISSION_CONTROL_V2_ENABLED` | off | Mission Control 2.0 global; **hay canary por tenant** (`SEMSE_MISSION_CONTROL_V2_CANARY_TENANT_IDS` definida). | `operations/mission-control-2.spec.md` | Ampliar el canary. |
| `SEMSE_ORIGINATOR_REGISTRATION_ENABLED` | off | Registro de originadores global; canary por tenant definido. | `core/originador-referral-program.spec.md` | Ampliar el canary. |
| `SEMSE_TOGETHER_ENABLED` | off | Proveedor LLM Together AI (opt-in, #1073); `TOGETHER_API_KEY` sí está definida. | `llm` | Opcional. |
| `SEMSE_VOICE_ENABLED` / `SEMSE_VOICESTUDIO_DEV_ENABLED` | off | VoiceStudio para Prometeo. | `integrations/voicestudio-voice-gateway.spec.md` (DRAFT) | No activar: spec en DRAFT. |

Web: `SEMSE_IDENTITY_CAPABILITY_UI_ENABLED` está apagado globalmente, pero tiene canary por tenant.

Variables **definidas** cuyo modo no se leyó (pueden estar en `off`/`shadow`): `EVIDENCE_ORIGINAL_SHA256_MODE`, `UPLOADS_SIGNED_GET_MODE`, `PROMETEO_TOOL_AUDIT_LIFECYCLE`, `SEMSE_CHAT_EVIDENCE_MODE`, `SEMSE_COMMUNICATIONS_MODE`, `SEMSE_JEV_*_MODE`, `SEMSE_RUNTIME_MODE`, `SEMSE_JOBS_PROJECTION_*`, `SEMSE_PROJECT_LIFECYCLE_*`. Revisarlas en el panel de Railway, sin copiar los valores.

## 3. Lo que sí funciona (verificado en laboratorio con Postgres real, `main` `db92934`)

- Las 128 migraciones se aplican limpias sobre Postgres 16.
- Ya cubierto por CI con Postgres: `scripts/api-integration.mjs` y el F01 Bid→Accept (`api-f01-bids-integration.mjs`).
- Cadena de dinero **con base real**, `smoke:escrow-contract`: job → reserva → contrato firmado por ambas partes → escrow fondeado (mock) → hito → evidencia → entrega → aprobación → **release**. El único fallo del smoke es que el PRO lee el resumen de escrow (403), y eso es deliberado según la spec de finanzas.
- Smokes `projects`, `reservations`, `contracts`, `milestones`, `evidence`, `disputes` y `domain-events`: verdes.
- Smokes desactualizados frente a endurecimientos posteriores (no son fallos de producto): `persistence` y `marketplace` (estado visible en mayúscula, `toVisibleJob`), `trust` (clave de evidencia con alcance por tenant, #717) y `escrow-contract` (finanzas solo para cliente y Ops). **Ninguno de estos smokes lo ejecuta el CI.**

## 3.1 Verificación de los bloqueos y PRs (2026-11-11)

- **AgentRun:** `POST /v1/agents/runs/reclaim-stale` sigue devolviendo HTTP 403 cada ~10 segundos (última observación de esta revisión: 13:14 UTC). La creación de `Membership ACTIVE` para `AGENT_RUNNER` sigue **no acreditada**; un HTTP 201 en otros barridos no la sustituye.
- **#1141:** CI y API Integration `success` en HEAD `3b09e0a5`; permanece Draft, sin fusionar. Logs sanitizados todavía no están en el Worker productivo.
- **#1142:** CI `success` en HEAD previo `3a389a06`; permanece Draft. Este cambio de inventario requiere que CI se ejecute nuevamente sobre el nuevo HEAD.
- **P0-2 / `RAILWAY_TOKEN`:** permanece pendiente; separar el Production Health Gate del deploy duplicado es una alternativa de CI que debe revisarse y autorizarse. Que un endpoint de salud responda correctamente **no prueba por sí solo que el commit recién fusionado se haya desplegado**.

## 4. Decisiones pendientes del dueño

- **D-LIEN** — ¿Quién recibe la alerta de plazo de lien (spec m2.1: "push + email al PRO")? El proyecto tiene `assignedProOrgId` (una organización), no un usuario. Opciones: (a) el profesional de la reserva aceptada, el mismo criterio que usan las notificaciones de hitos (no existe en proyectos adjudicados por Bid); (b) todos los miembros ACTIVOS de la organización PRO con rol `PRO`; (c) los dueños/administradores de esa organización.
