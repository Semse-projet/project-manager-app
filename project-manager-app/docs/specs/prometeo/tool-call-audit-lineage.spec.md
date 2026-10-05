---
id: "prometeo.tool-call-audit-lineage"
title: "Auditoría canónica por tool call y estado de ejecución de aprobaciones de Prometeo"
sdd_version: "2.0"
code_status: "NOT_STARTED"
ci_status: "NOT_RUN"
merge_status: "UNMERGED"
deploy_status: "NOT_DEPLOYED"
activation_status: "INACTIVE"
migration_status: "PENDING"
feature_flags: []
production_evidence: []
domain: "prometeo"
version: "0.1"
status: "DRAFT"
owner: "semse-core"
risk: "high"
date: "2026-10-05"
author: "Claude (a partir de la reconciliación de Prometeo 2026-10-05, H05 y brecha tras aprobación)"
spec_index: "docs/SPEC_INDEX.md"
related_files:
  - packages/db/prisma/schema.prisma
  - apps/api/src/modules/prometeo/tool-governance/tool-governance.repository.ts
  - apps/api/src/modules/prometeo/prometeo-tool-execution.service.ts
  - apps/api/src/modules/agents/agent-approval.service.ts
  - apps/api/src/modules/agents/harnesses/project-copilot.harness.ts
related_tests: []
related_endpoints:
  - "prometeo/tools/invoke"
related_events: []
related_agents:
  - prometeo
last_verified: "2026-10-05"
---

# Spec: Auditoría canónica por tool call y estado de ejecución de aprobaciones

> **Estado: DRAFT. Esta spec NO autoriza implementar** (ver `AGENTS.md`: ninguna spec
> `DRAFT` o `REVIEW` autoriza implementación, y no se toca `schema.prisma` sin una migración
> planificada y aprobada). Propone el diseño y deja las decisiones abiertas al dueño. Nada de
> esto está implementado, mergeado ni desplegado.

## 1. Problema

La reconciliación funcional de Prometeo (2026-10-05) dejó dos brechas que no se pueden cerrar
sin persistir más información, por eso no se corrigieron en los PR de código (#792–#794):

1. **H05 — no se puede reconstruir qué hizo cada tool call.** `PrometeoToolInvocationAudit`
   guarda tenant, actor, namespace/name, modo, estado, motivo de bloqueo y `requestId`, pero no
   guarda: id de ejecución, run/sesión/proyecto/agente, versión de policy, duración, ni
   referencias a entrada y salida. El `auditRef` que ve el cliente se forma con
   `requestId + UUID` y la fila recibe **otro** id (cuid), así que no es una referencia
   verificable. Además `invokeReadTool()` ejecuta el handler antes de registrar el éxito y no
   captura todas las excepciones del handler, de modo que un fallo puede no dejar fila. No se
   puede prometer "todas las llamadas auditadas".
2. **Caída entre aprobar y ejecutar.** Desde #792 la decisión sobre una aprobación se autoriza y
   se persiste con una transición condicional, pero la ejecución posterior
   (`executeFromApproval`) vive en la misma petición HTTP y su resultado no se guarda en la
   aprobación. Si el proceso cae después de aprobar y antes de ejecutar, la aprobación queda
   `APPROVED` sin efecto ni estado que lo diga, y no hay forma segura de reintentar sin duplicar
   el efecto.

## 2. Alcance

- **Dentro:** extender los modelos existentes (aditivo, columnas nulables, sin backfill), registrar
  inicio y estado terminal de cada tool call, vincularlo con run/sesión/proyecto/agente, guardar
  estado de ejecución de las aprobaciones del copiloto y exponer su consulta autorizada.
- **Fuera:** una tabla genérica nueva de tool calls (ya existen `PrometeoToolInvocationAudit` y
  `PrometeoProposedAction`; crear otra duplicaría), guardar prompts privados o el razonamiento
  interno del modelo, Decision Ledger, Operational Memory Graph, aprendizaje y Conversation
  Intelligence (specs y plan propios), y cambiar la lógica de los gates financieros.

## 3. Diseño propuesto

### 3.1 `PrometeoToolInvocationAudit` (aditivo)

| Columna | Tipo | Nulable | Propósito |
|---|---|---|---|
| `executionId` | `String @unique` (UUID) | no en filas nuevas | identidad de la ejecución; es el `auditRef` que ve el cliente (FK verificable) |
| `source` | `String` | sí | `prometeo_tools` \| `project_copilot` \| `agent_runtime` |
| `runId`, `sessionId`, `threadId` | `String` | sí | vínculo con el run, la sesión o el hilo |
| `projectId` | `String` | sí | alcance del recurso; base del control de acceso a la consulta |
| `agentId` | `String` | sí | agente/persona que ejecuta |
| `approvalId`, `proposedActionId` | `String` | sí | vínculo con la aprobación que autorizó el efecto |
| `policyVersion` | `String` | sí | versión de la policy evaluada (hash del descriptor + reglas) |
| `startedAt`, `completedAt` | `DateTime` | `completedAt` sí | ciclo de vida |
| `durationMs` | `Int` | sí | duración medida en servidor |
| `inputDigest`, `outputDigest` | `String` | sí | SHA-256 del JSON canónico (no el contenido) |
| `inputSummary`, `outputSummary` | `String` (≤ 500) | sí | resumen **redactado** para mostrar al usuario |
| `errorCode` | `String` | sí | código estable (`HANDLER_EXCEPTION`, `TIMEOUT`, `POLICY_DENIED`…) |
| `redactionVersion` | `String` | sí | versión de las reglas de redacción aplicadas |
| `expiresAt` | `DateTime` | sí | retención (§3.4) |

`status` pasa a un conjunto cerrado: `STARTED`, `SUCCEEDED`, `FAILED`, `DENIED`, `TIMEOUT`,
`CANCELLED` (los valores históricos se conservan como están; no se reescriben). Índices nuevos:
`(tenantId, executionId)` único, `(tenantId, projectId, startedAt)`, `(tenantId, runId)`.

### 3.2 Ciclo de vida

1. Antes de despachar, `recordStart()` crea la fila en `STARTED` con `executionId`.
2. El handler corre dentro de un `try/finally` que **siempre** registra el estado terminal
   (`SUCCEEDED`, `FAILED`, `TIMEOUT`, `CANCELLED`) con duración y resumen redactado; un deny de
   policy se registra como `DENIED` sin ejecutar.
3. Una fila que quede en `STARTED` pasado un umbral (p. ej. 15 min) se considera interrumpida y
   se reconcilia a `FAILED/INTERRUPTED` por un barrido; así una caída no "desaparece".
4. **Si falla la propia persistencia del audit:** las tools de **escritura/críticas** no se
   ejecutan (sin registro de inicio no hay efecto); las de **lectura** se ejecutan y la falla se
   cuenta en una métrica y un log de error. *(Decisión abierta D1.)*

### 3.3 `AgentApproval`: estado de ejecución (aditivo)

Columnas nulables: `executionStatus` (`NOT_STARTED` \| `EXECUTING` \| `SUCCEEDED` \| `FAILED`),
`executionStartedAt`, `executionFinishedAt`, `executionError` (redactado) y `executionId`
(vínculo con §3.1).

- La ejecución se **reclama** con una transición condicional `NOT_STARTED → EXECUTING`
  (`updateMany` con la condición, igual que la decisión en #792): como máximo un proceso ejecuta.
- Un barrido/recuperación reintenta las aprobaciones `APPROVED` con `NOT_STARTED` o `EXECUTING`
  caducado, **solo** para efectos con clave de idempotencia por efecto (aprobar hito, liberar
  escrow, abrir/resolver disputa, delegar). Hay que verificar esa idempotencia efecto por efecto
  antes de activar el reintento; si un efecto no la tiene, queda en `FAILED` con motivo y no se
  reintenta solo. *(Decisión abierta D2.)*

### 3.4 Redacción y retención

- Se redactan claves y valores sensibles (tokens, contraseñas, números de cuenta/tarjeta, claves
  de API, correos y teléfonos fuera de los campos necesarios) con una lista versionada
  (`redactionVersion`); lo que no se pueda clasificar se guarda solo como digest.
- No se guardan prompts del usuario ni razonamiento interno del modelo; se muestra un resumen de
  la intención y de la decisión de policy.
- Retención por defecto de 90 días (`expiresAt`); un barrido borra el contenido (`inputSummary`,
  `outputSummary`) y conserva digest, estado y tiempos más allá de ese plazo. *(Decisión D3.)*

### 3.5 Consulta autorizada

Un endpoint de lectura de ejecuciones (por `executionId` y listado por proyecto/run) con las
reglas: mismo tenant; el actor que la inició, `OPS_ADMIN` del tenant o participante del proyecto
(contrato `resource-scope`: 404 otro tenant, 403 otra organización). Mission Control y el widget
pueden mostrar intención resumida, herramienta, policy, aprobación, resultado y evidencia, sin
exponer entradas/salidas completas. *(Decisión D4: quién ve el detalle.)*

## 4. Decisiones abiertas (requieren al dueño)

| ID | Decisión | Propuesta |
|---|---|---|
| D1 | Si falla el audit: ¿fail-closed también para lecturas? | Escrituras y críticas fail-closed; lecturas fail-open con métrica |
| D2 | Alcance del reintento automático de aprobaciones | Solo efectos con idempotencia verificada; el resto, `FAILED` y manual |
| D3 | Retención de contenido redactado | 90 días; digest y tiempos indefinidos |
| D4 | Quién ve el detalle de una ejecución | Iniciador, `OPS_ADMIN` y participantes del proyecto (resumen, no entradas) |
| D5 | ¿Se registra también el `runId` de la persona cuando exista un run padre del copiloto? | Sí, cuando H08 deje de tener `sourceRunId` vacío |

## 5. Criterios de aceptación (de la reconciliación)

- Desde `executionId` se recupera el estado final y sus vínculos (run, proyecto, agente,
  aprobación).
- Una excepción del handler o una caída del audit no desaparecen: dejan fila terminal o, en
  escrituras, impiden el efecto.
- Entradas y salidas sensibles quedan redactadas; un actor sin alcance no puede recuperar trazas
  ajenas (404/403).
- Dos decisiones/ejecuciones simultáneas de una misma aprobación producen una sola ejecución y como
  máximo un efecto; una caída tras aprobar deja un estado explícito y una recuperación idempotente.
- La migración es aditiva y reversible sin pérdida de datos.

## 6. Plan de migración (a aprobar antes de implementar)

1. Migración Prisma aditiva: columnas nulables y los índices de §3.1 y §3.3; sin backfill ni
   cambio de las filas existentes.
2. Código detrás de una bandera (`PROMETEO_TOOL_AUDIT_LIFECYCLE`) que empieza en modo
   `shadow` (escribe las columnas nuevas sin cambiar el comportamiento) y pasa a `enforce` tras
   validar en producción.
3. Barridos (interrupción, retención, recuperación) como jobs idempotentes del worker.
4. Pruebas: regresión por criterio de §5 con dobles y, al menos, una prueba contra base real en CI.

## 7. Rollback

Las columnas son aditivas: apagar la bandera deja de escribirlas y el código anterior las
ignora. No se borran columnas ni filas; revertir el PR restaura el comportamiento actual.
