---
id: "agents.agent-queue-retry-idempotency"
title: "RETRY/REQUEUE de AgentRun no debe descartarse en silencio en la cola"
domain: "agents"
sdd_version: "2.0"
version: "0.2"
status: "APPROVED"
owner: "semse-core"
risk: "medium"
code_status: "IN_PROGRESS"
ci_status: "NOT_RUN"
merge_status: "UNMERGED"
deploy_status: "NOT_DEPLOYED"
activation_status: "INACTIVE"
migration_status: "NOT_APPLICABLE"
feature_flags: []
production_evidence:
  - "2026-10-12: el AgentRun cmqb7s6nh0001mi01dqgpeezr quedó QUEUED en BD tras un RETRY (receipt cmv4wer390002l8016khrnfpt SUCCEEDED) pero el worker no lo tomó. En Redis, bull:semse-agent-runs:tenant_default__cmqb7s6nh0001mi01dqgpeezr seguía siendo el job fallido del 2026-06-12 (finishedOn 1781286151638, error chromium_headless_shell-1223) y estaba en el conjunto 'failed'. El queue.add del RETRY usa el mismo jobId y BullMQ lo ignora sin error."
related_files:
  - apps/api/src/infrastructure/queue/agent-queue.service.ts
  - apps/api/src/modules/ops/ops.service.ts
  - apps/api/src/modules/ops/ops.repository.ts
  - apps/api/src/modules/ops/mission-control/mission-control.service.ts
  - apps/api/src/modules/agents/agents.service.ts
  - apps/worker/src/main.mjs
related_tests:
  - "apps/api/test/agent-queue-retry.test.ts"
related_endpoints:
  - "POST /v1/ops/mission-control/actions"
  - "POST /v1/ops/agent-runtime/:runId/retry"
related_events: []
related_agents: ["browser-agent"]
last_verified: "2026-10-12"
---

# Spec: RETRY/REQUEUE de AgentRun no debe descartarse en silencio

> Contrato ejecutable SDD 2.0. Código, CI, merge, deploy y activación se
> registran por separado. **Aprobada por el owner el 2026-10-12** (instrucción en chat:
> "Aprueba la spec de #886 y escribe el arreglo"). La aprobación no autoriza merge ni deploy.

## 1. Problema y resultado

**Para quién:** operadores `OPS_ADMIN` que usan Mission Control (`agent-run-recovery-v1`).

**Problema.** `AgentQueueService.enqueueRun` añade el job con `jobId = <tenant>__<runId>`
(determinista) y `removeOnFail: 1000` / `removeOnComplete: 500`. Mientras el job anterior
de ese run siga retenido en Redis (fallido o completado), `queue.add` con el mismo
`jobId` **no hace nada y no lanza error**. `retryAgentRun`/`requeueAgentRun` ya actualizaron
la fila a `QUEUED` y el recibo sale `SUCCEEDED`, pero ningún worker recibe trabajo: el run
queda huérfano en `QUEUED`. Ocurrió en producción el 2026-10-12 (ver `production_evidence`).

Además `enqueueRun` retorna sin error cuando Redis no está disponible ("left queued in
persistence only"); el mismo síntoma, sin señal para el operador.

**Resultado esperado:** un RETRY/REQUEUE exitoso garantiza un job ejecutable en la cola,
o el recibo lo dice explícitamente (`enqueued:false` con motivo), nunca un éxito vacío.

## 2. Alcance

### Incluido

- `enqueueRun` distingue la intención: creación normal (idempotente, igual que hoy) y
  reintento/reencolado (debe producir un job ejecutable).
- Para reintento/reencolado, según el estado del job existente con el mismo id:
  - `failed` o `completed` → se elimina ese job y se añade uno nuevo.
  - `waiting`, `delayed`, `prioritized` → se deja (ya hay trabajo pendiente), `enqueued:true`.
  - `active` → no se toca; `enqueued:false`, motivo `JOB_ACTIVE`.
  - inexistente → se añade.
- `enqueueRun` devuelve un resultado `{ enqueued, reason }`; `OpsService.retryAgentRun` y
  `requeueAgentRun` lo propagan y Mission Control lo incluye en `result` del recibo.
- Redis no disponible en reintento/reencolado: `enqueued:false`, motivo `QUEUE_UNAVAILABLE`
  (la fila sigue `QUEUED`; el barrido de stale la recogerá cuando el worker corra).
- Error de Redis al reintentar, o job fallido que no se puede eliminar: `enqueued:false`, motivo `QUEUE_ERROR`. En modo creación los errores se propagan como hasta ahora.

### Fuera de alcance

- Cambiar `removeOnFail`/`removeOnComplete` o el esquema de `jobId`.
- Cambiar los llamadores de creación (`agents.service.ts`) más allá del tipo de retorno.
- Modificar el worker, Railway o variables de entorno.
- Recuperación puntual del run de junio: se hace aparte con `job.retry()` autorizado por el owner.

## 3. Actores, permisos y límites

| Actor | Permiso backend | Alcance | Puede | No puede |
|---|---|---|---|---|
| OPS_ADMIN | `ops:dashboard:write` | su tenant | RETRY/REQUEUE vía runbook | reencolar fuera de su tenant |

- Tenant boundary: `jobId` incluye `tenantId`; la eliminación del job previo solo aplica al id calculado con el tenant del actor.
- Aprobación humana: sin cambios; la allowlist de runbooks y el dry-run existentes se mantienen.
- `privacyCritical`: no aplica; no se registran payloads de jobs.
- Auditoría: receipt de Mission Control y `AuditLog` existentes, ahora con `enqueued`/`reason`.

## 4. Escenarios y criterios de aceptación

### P1 — Reintento con job fallido retenido

```gherkin
DADO un AgentRun cuyo job con el mismo jobId está en estado failed
CUANDO el operador ejecuta RETRY
ENTONCES el job viejo se elimina y se añade uno nuevo
Y el recibo incluye enqueued=true
```

### P2 — Reintento con trabajo ya pendiente

```gherkin
DADO un AgentRun cuyo job está waiting o delayed
CUANDO se ejecuta RETRY
ENTONCES no se duplica ni se elimina el job y enqueued=true
```

### P3 — Job activo

```gherkin
DADO un job en estado active
CUANDO se ejecuta RETRY
ENTONCES el job no se toca y el recibo indica enqueued=false, reason=JOB_ACTIVE
```

### P4 — Redis caído

```gherkin
DADO que Redis no responde
CUANDO se ejecuta RETRY
ENTONCES la fila queda QUEUED y el recibo indica enqueued=false, reason=QUEUE_UNAVAILABLE
```

### P5 — Creación normal sin regresión

```gherkin
DADO una creación de run (agents.service)
CUANDO se llama enqueueRun en modo creación
ENTONCES el comportamiento es idéntico al actual (add idempotente por jobId)
```

Casos borde:

- [ ] Dos RETRY concurrentes del mismo run no producen dos jobs ejecutándose a la vez.
- [ ] Un job eliminado entre `getJob` y `remove` no rompe la acción.
- [ ] Aislamiento cross-tenant: el id de otro tenant nunca se elimina.

## 5. Contratos

Sin endpoints nuevos. `result` del recibo de Mission Control añade
`enqueued: boolean` y `reason?: "JOB_ACTIVE" | "QUEUE_UNAVAILABLE" | "QUEUE_ERROR"`. Cambio aditivo.

## 6. FSM, eventos y reconstrucción

- Sin cambios de FSM de `AgentRun`.
- Eventos nuevos: ninguno.
- Replay/rebuild: no aplica.
- Compensación: si `enqueued:false`, el operador decide (esperar al job activo o revisar Redis).

## 7. Datos y migración

Sin cambios de modelo ni migración. Solo claves de Redis de la cola `semse-agent-runs`.

## 8. Observabilidad, despliegue y activación

- Log estructurado por reintento: `runId`, estado previo del job, acción tomada (sin payload).
- SLO: 0 RETRY exitosos con run `QUEUED` sin job en cola (medible con el conteo de `QUEUED` frente a `waiting+delayed+active`).
- Feature flags: ninguno; cambio de comportamiento solo en la ruta de reintento.
- Rollback: revertir el PR; el comportamiento previo es el descarte silencioso.
- Owner operativo: semse-core.

## 9. Tests requeridos

- [ ] Unitaria de `enqueueRun` con cola simulada: failed, completed, waiting, delayed, active, inexistente, Redis caído.
- [ ] Verificación por mutación: quitar el borrado del job previo hace fallar P1.
- [ ] `OpsService.retryAgentRun`/`requeueAgentRun` propagan `enqueued`/`reason`.
- [ ] Prueba de no regresión de la creación (`agents.service`).
- [ ] Mission Control: el recibo incluye `enqueued`.

## 10. Mapa de implementación

### API

- `apps/api/src/infrastructure/queue/agent-queue.service.ts` — modo reintento y resultado.
- `apps/api/src/modules/ops/ops.service.ts` — usar el modo reintento y propagar el resultado.
- `apps/api/src/modules/ops/mission-control/mission-control.service.ts` — incluirlo en el recibo.

### Tests

- `apps/api/test/` — unitarias de cola y de Mission Control.

## 11. Investigación externa

- Reporte con tres búsquedas primarias: no realizado; el comportamiento se verificó en el Redis de producción (solo lectura).
- Backlog: valorar un `jobId` con sufijo de intento en vez de eliminar el job previo.
- Descartado: bajar `removeOnFail` (pierde diagnóstico).

## 12. Gates de cierre

- [ ] Spec aprobado por el owner
- [ ] Pruebas del §9 en CI
- [ ] Run `cmqb7s6nh…` ejecutado (o resuelto) con evidencia en `production_evidence`
- [ ] F4 sigue sin declararse VERIFIED hasta tener un reintento extremo a extremo
