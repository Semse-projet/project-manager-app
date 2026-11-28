# Backlog de activación en producción — trabajo fusionado que no está encendido

**Fecha de inventario original:** 2026-11-11 · **Corte adicional de operación:** 2026-11-12 01:40 UTC · **Main desplegado en API/Worker:** `7e80dd0f` (#1146) · **Fuente:** GitHub, logs de Railway y verificaciones PostgreSQL. El inventario de flags de §2 sigue siendo una fotografía del 11 de noviembre, **no** una lectura nueva de todas las variables.

> Este documento no cambia producción. Cada fila marcada **[DUEÑO]** es un cambio de variable o de datos en Railway que requiere tu autorización explícita (AGENTS.md). "No definida" significa que la variable **no existe** en el servicio, así que el código usa su valor por defecto. Los valores de las variables definidas no se leyeron.

## 0. Bloqueos activos (P0)

| # | Qué está roto | Evidencia | Arreglo | Estado |
|---|---|---|---|---|
| P0-1 | **Incidente histórico 403 de AgentRun: recuperado.** | En PostgreSQL se creó el rol `AGENT_RUNNER` y la membresía única `ACTIVE` para `usr_worker_system` / `org_admin_001` / `tenant_default`. Reinicio autorizado del único `semse-worker` a las 00:00:19 UTC del 12-nov. API HTTP (hasta 01:40 UTC): **323 respuestas 201, 1 respuesta 401 transitoria de renovación, 0 respuestas 403** para `reclaim-stale`. | Sin conceder roles humanos ni cambiar otros servicios. La ejecución `browser-agent` `cmqrerl9g000ik101zkl4sgoy` terminó con `job completed`. **Separar** la falla de 12 runs delegados `pricing`/`risk` sin `projectId` ni `jobId`: nueva brecha de contexto, para corregir en código y probar en QA, sin reintentos en masa. | **RESUELTO el bloqueo de autorización**; pruebas negativas/heartbeat pendientes, defectos de contexto abiertos |
| P0-2 | **Production Health Gate nunca se ejecuta** tras un deploy. | GitHub Actions `Railway Deploy`: el último éxito fue 2026-10-20 (`06dfd7b`); desde 2026-10-26, todos los runs de `main` fallan con `Not Authorized` de la API de Railway. El gate depende de ese job y queda `skipped`. Producción **sí** está al día porque Railway despliega `main` con su integración nativa de GitHub (`checkSuites: false`). | **[DUEÑO]** Regenerar el token de Railway y actualizar el secret `RAILWAY_TOKEN` del repo, o decidir retirar el deploy duplicado de Actions y dejar el Health Gate independiente (cambio de CI, necesita autorización). | Pendiente |
| P0-3 | Los logs del worker registran "sweep/reclaim failed" sin motivo. | pino serializaba el `Error` como `{}`; incluso tras el reinicio hubo mensajes `error: {}` en ejecuciones fallidas. | PR #1141 (`describeError`), serializador que excluye cuerpos HTTP, query strings y mensajes no clasificados. | **Listo para revisión**, no fusionado ni desplegado; CI y API Integration verdes en HEAD `3b09e0a5` |

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

**Cierre de la intervención (2026-11-12):** el dueño autorizó crear el grant y posteriormente reiniciar solo `semse-worker`. Mediante la interfaz de datos de Railway/PostgreSQL se crearon **dos registros**: `Role` (`AGENT_RUNNER`) y `Membership` (`usr_worker_system`, `org_admin_001`, estado `ACTIVE`); la consulta SQL independiente confirmó exactamente una fila `AGENT_RUNNER ACTIVE` junto a las tres membresías anteriores. **No se usó el script CLI para aplicar este grant**, por limitaciones de ejecución remota; el procedimiento anterior sigue siendo el runbook reutilizable en intervenciones futuras. Se reinició solo el Worker; no se hicieron merges, cambios de flags, releases ni DDL durante esta corrección.

## 1. Schedulers del worker: estado comprobado en producción (2026-11-11 13:14 UTC)

La consulta de variables de Railway muestra ahora `PAYMENTS_RECONCILE_ENABLED` y `LIVE_SESSION_SWEEP_ENABLED` **definidas** en `semse-worker`. Sus valores no se leyeron; su ejecución está confirmada de forma independiente por solicitudes HTTP satisfactorias y logs del Worker. Esto actualiza la fotografía histórica anterior, sin implicar que deban modificarse sus valores.

| Variable | Qué activa | Riesgo | Prerrequisito | Recomendación |
|---|---|---|---|---|
| `LIEN_ALERTS_ENABLED` | Chequeo horario de plazos de lien: transiciona `LienCalendar` y genera notices al llegar a 3 días. | Medio (aviso legal) | La implementación de destinatarios PRO activos y notificación está propuesta en **PR #1144**, sin fusionar, con revisión humana/legal pendiente. | **No activar** hasta revisión de la lógica legal, entrega real de mensajes y PR listo; el código desplegado todavía no incluye esta mejora. |
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
| `SEMSE_AGENT_RUN_FINALIZATION_OUTBOX_ENABLED` | off | Efectos de fin de AgentRun (approvals, auditoría, memoria) por outbox transaccional; hoy van por el camino directo. | event backbone F1 | El bloqueo 403 está resuelto; **faltan** aceptación E2E, heartbeat, seguridad multitenant y revisión de efectos antes de activar. |
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

- **AgentRun (actualización 2026-11-12):** el 403 de autorización fue **recuperado** mediante el rol + membresía `AGENT_RUNNER ACTIVE` y reinicio autorizado de solo Worker. De 00:00:17 a 01:40 UTC, `reclaim-stale` registró **323×201, 1×401 transitorio y 0×403**; hay un `browser-agent` completado. **Pendiente:** pruebas negativas, heartbeat/fencing y falla independiente de 12 delegados `pricing`/`risk` sin proyecto o trabajo en su contexto.
- **#1141:** CI y API Integration `success` en HEAD `3b09e0a5`; listo para revisión humana, sin fusionar. Logs sanitizados todavía no están en el Worker productivo.
- **#1142:** pasó a listo para revisión; este commit de documentación reemplaza el P0 de AgentRun obsoleto. Verificar CI del HEAD nuevo antes de integrar.
- **P0-2 / `RAILWAY_TOKEN`:** pendiente. Hay **dos propuestas parcialmente solapadas** y aún sin fusionar: #1143 adapta `railway-deploy.yml`; #1145 crea un gate de runtime separado. Se debe decidir la arquitectura de CI, evitar ejecutar dos verificadores redundantes y exigir revisión humana, SHA y ejecución efectiva antes de declarar el gate operativo. Que un endpoint de salud responda **no prueba por sí solo** la procedencia del commit.

## 4. Decisiones pendientes del dueño

- **D-LIEN:** el PR #1144 documenta la decisión PD-10: notificar a todos los miembros con rol `PRO` y `Membership ACTIVE` de la organización profesional asignada, dentro del tenant y con usuario activo. **Esto no autoriza activar alertas legales**; #1144 sigue pendiente de revisión humana, validación de plazos y configuración del canal de correo. No repetir la decisión como si no existiera.


## 5. Reparto operativo para cerrar la brecha sin duplicar trabajo (2026-11-12)

- **TinyFish (navegación/verificación):** controles de UI pública de SEMSE Web ES/EN, inspección de estados de PR y checks en GitHub, reproducción no destructiva de errores, constatación de releases y de versiones visibles en Railway. Guardar evidencia de URL, pasos, hora y resultados. No adjudicar una prueba funcional a un resultado meramente visual.
- **Codex/herramienta de desarrollo (código y pruebas):** corregir el origen de los 12 runs delegados `pricing`/`risk` sin `projectId`/`jobId`; añadir tests negativos y verificación claim → start → heartbeat → complete con fencing. Cerrar PR #1141 y revisar #1143/#1145 para conservar **un solo diseño aprobado** de health gate con trazabilidad de versión.
- **Owner / gates (producción):** aprobar cada merge tras checks del HEAD y revisión aplicable; observar activaciones `off` → `shadow` → `on` por tenant, nunca activar automáticamente pagos, lien, escrow o publicación/RAG. La membresía `AGENT_RUNNER` y el reinicio puntual del Worker son hechos ya ejecutados, no tareas pendientes.
