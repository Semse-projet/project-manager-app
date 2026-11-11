# Backlog de activación en producción — trabajo fusionado que no está encendido

**Fecha:** 2026-11-11 · **Main:** `db92934` (desplegado en los 4 servicios de Railway, 2026-11-10 02:18Z) · **Fuente:** lectura de código de `main` y Railway en **solo lectura**: `describe-service` (solo nombres de variables, nunca valores), logs de deploy y HTTP.

> Este documento no cambia producción. Cada fila marcada **[DUEÑO]** es un cambio de variable o de datos en Railway que requiere tu autorización explícita (AGENTS.md). "No definida" significa que la variable **no existe** en el servicio, así que el código usa su valor por defecto. Los valores de las variables definidas no se leyeron.

## 0. Bloqueos activos (P0)

| # | Qué está roto | Evidencia | Arreglo | Estado |
|---|---|---|---|---|
| P0-1 | **Ningún AgentRun se reclama ni se ejecuta** (agentes de Prometeo, browser agent, retries). | API HTTP: `POST /v1/agents/runs/reclaim-stale` → **403** cada 10 s desde el deploy de #1129 (2026-11-09). #1129 separó `agents:run:claim` en el rol de máquina `AGENT_RUNNER` y su propia nota decía "aprovisionar la identidad del Worker con `AGENT_RUNNER` antes de desplegar". El merge desplegó sin ese paso. | (1) `SEMSE_ROLES` de semse-worker con `AGENT_RUNNER` → **hecho 2026-11-11 00:00Z** (autorizado por el dueño). (2) **[DUEÑO]** `railway run --service semse-worker node scripts/ops/ensure-worker-service-membership.mjs`: primero dry-run; si `ok:true` y `createMemberships` incluye `AGENT_RUNNER`, repetir con `--apply`. | Pendiente del paso 2 |
| P0-2 | **Production Health Gate nunca se ejecuta** tras un deploy. | GitHub Actions `Railway Deploy`: el último éxito fue 2026-10-20 (`06dfd7b`); desde 2026-10-26, todos los runs de `main` fallan con `Not Authorized` de la API de Railway. El gate depende de ese job y queda `skipped`. Producción **sí** está al día porque Railway despliega `main` con su integración nativa de GitHub (`checkSuites: false`). | **[DUEÑO]** Regenerar el token de Railway y actualizar el secret `RAILWAY_TOKEN` del repo, o decidir retirar el deploy duplicado de Actions y dejar el Health Gate independiente (cambio de CI, necesita autorización). | Pendiente |
| P0-3 | Los logs del worker registran "sweep/reclaim failed" sin motivo. | pino serializaba el `Error` como `{}`. | PR #1141 (`describeError`). | En PR |

## 1. Schedulers del worker apagados (semse-worker define 23 variables; ninguna de estas)

| Variable | Qué activa | Riesgo | Prerrequisito | Recomendación |
|---|---|---|---|---|
| `LIEN_ALERTS_ENABLED` | Chequeo horario de plazos de lien: transiciona `LienCalendar` y genera notices al llegar a 3 días. | Medio (aviso legal) | **El push/email al PRO no está implementado**: falta decidir el destinatario (ver §4, D-LIEN). | Activar después de D-LIEN; sin la notificación, solo cambia estados. |
| `PAYMENTS_RECONCILE_ENABLED` | Cada ~15 min detecta RELEASE `PENDING` estancados, alerta y audita. **Solo lectura sobre dinero.** | Bajo | Ninguno. Runbook `ESCROW_RELEASE_RECONCILIATION.md`. | **[DUEÑO]** `true`. |
| `WEATHER_CHECK_ENABLED` | Alertas de clima por proyecto. | Bajo | **`TOMORROW_API_KEY` no está definida en la API**: hoy el módulo de clima usa el cliente **mock**, así que cualquier dato de clima en producción es simulado. | **[DUEÑO]** Configurar `TOMORROW_API_KEY` y después `WEATHER_CHECK_ENABLED=true`. |
| `LIVE_SESSION_SWEEP_ENABLED` | Cierra sesiones live (LiveKit) caducadas cada minuto. | Bajo | Ninguno. | **[DUEÑO]** `true`. |

`PRODUCT_INTELLIGENCE_ENABLED`, `CONTRIBUTOR_EXTRACTION_SWEEP_ENABLED` y `AUTONOMY_LOOPS_ENABLED` sí están definidas en el worker.

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

## 4. Decisiones pendientes del dueño

- **D-LIEN** — ¿Quién recibe la alerta de plazo de lien (spec m2.1: "push + email al PRO")? El proyecto tiene `assignedProOrgId` (una organización), no un usuario. Opciones: (a) el profesional de la reserva aceptada, el mismo criterio que usan las notificaciones de hitos (no existe en proyectos adjudicados por Bid); (b) todos los miembros ACTIVOS de la organización PRO con rol `PRO`; (c) los dueños/administradores de esa organización.
