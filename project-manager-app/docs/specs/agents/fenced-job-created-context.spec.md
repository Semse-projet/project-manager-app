---
id: "agents.fenced-job-created-context"
title: "Lectura de Job limitada por AgentRun reclamado (job.created)"
domain: "agents"
sdd_version: "2.0"
version: "0.1"
status: "DRAFT"
owner: "semse-core"
risk: "high"
code_status: "IN_PROGRESS"
ci_status: "NOT_RUN"
merge_status: "UNMERGED"
deploy_status: "NOT_DEPLOYED"
activation_status: "INACTIVE"
migration_status: "NOT_APPLICABLE"
feature_flags: []
production_evidence: []
related_files:
  - "apps/api/src/modules/agents/agents.controller.ts"
  - "apps/api/src/modules/agents/agents.service.ts"
  - "apps/api/src/modules/agents/agents.repository.ts"
  - "apps/worker/src/main.mjs"
  - "apps/worker/src/job-created-context-reader.mjs"
related_tests:
  - "apps/api/test/agent-run-job-created-context.test.ts"
  - "tests/unit/job-created-context-reader.test.mjs"
  - "scripts/qa-1149-disposable-agentrun-e2e.mjs"
related_endpoints:
  - "POST /v1/agents/runs/:runId/job-created-context"
related_events:
  - "job.created"
related_agents:
  - "pricing"
  - "risk"
last_verified: ""
---

# SDD 2.0 — Contexto mínimo de Job para AgentRuns

> Documento DRAFT, sin aprobación humana ni autorización de despliegue. La corrección
> se preparó como hotfix de investigación en PR #1160; falta conciliar formalmente
> el orden spec → approve → plan de la gobernanza SDD.

## 1. Problema y resultado

El Worker con `AGENT_RUNNER` reclama `pricing` y `risk` por `job.created`, pero
los handlers hacen lecturas globales de Projects y Jobs. Reciben 403
(`projects:read` o `jobs:read`) aunque el evento traiga `jobId`.
Resultado: ambos runs `COMPLETED` sin permisos globales de lectura ni exposición
del `claimToken` al handler.

## 2. Alcance

Incluido: un Job originario, solo `pricing/risk` de `job.created` y proyección
mínima {id,title,scope,category,status,urgency,budgetMin,budgetMax}.
Un Job recién creado puede no tener Project.

Excluido: otros agentes y triggers, datos personales, contratos, pagos,
evidencia, listados de Projects, replay de los 12 runs históricos y issue #1159.

## 3. Actores y límites

| Actor | Permiso | Recursos autorizados | Prohibido |
|---|---|---|---|
| Worker con membresía activa AGENT_RUNNER | agents:run:execute | Solo Job del run en intento reclamado | Leer otros Jobs/Projects o tenants |
| CLIENT con sesión firmada | jobs:create | Job propio | Solicitar contexto de otro run |
| OPS_ADMIN sin claim | No autorizado por este contrato | Ninguno | Suplantar un claim |

Las condiciones deben cumplirse juntas:

- El token HMAC verifica tenant, org de servicio, user, run, worker y attempts.
- El registro permanece `RUNNING`, sin dead-letter, con el mismo worker e intento.
- `triggerType=event`, `eventType=job.created`, agente pricing o risk.
- `correlationId=job:<jobId>:created` y tenant de origen coincidente.
- `eventPayload.clientOrgId=operatorContext.orgId`.
- Job activo con `tenantId` y `clientOrgId` iguales al tenant y org de origen;
  no se usa la org de administración del Worker como dueña del Job.
- La identidad sin claim no obtiene acceso; un runId/JobId aislado no autoriza.

## 4. Escenarios y aceptación

**P1 — positivo.** Un CLIENT registrado crea un Job sintético mediante HTTP;
el evento `job.created` crea dos AgentRuns; el Worker reclama cada uno con
su token; la API devuelve la proyección limitada y ambos terminan COMPLETED
con eventPayload.jobId y lifecycle trazables.

**N1 — negativos obligatorios.** Bloquear tenant, org de origen, Job, correlación,
worker o generación divergente; denegar ruta genérica y métodos de escritura;
rechazar claimToken inválido, sesión sin permiso, intento ya finalizado y
token de un intento anterior. No permitir un score de confianza inventado.

## 5. Contrato API

POST /v1/agents/runs/:runId/job-created-context

- Autenticación firmada, membresía activa y `agents:run:execute`.
- Body: {workerId:string, expectedAttempts:positive_integer, claimToken:string}.
- Output: {requestId, data:{job:{id,title,scope,category,status,urgency,
  budgetMin,budgetMax}}}; sin token ni información de otro recurso.
- 400 invalid body; 401 sin sesión; 403 permiso o HMAC incorrecto;
  404 run no vigente / Job sin scope.
- Sin escritura de BD, pagos, eventos, aprobación o reintentos.

El Worker solicita contexto **tras claim/start** desde su núcleo, sin
entregar claimToken a handlers ni agentes. El lector interno devuelve un
único Job y datos neutros/ausentes para Project, hitos, evidencia y trust
que no existen en job.created; rechaza rutas o métodos arbitrarios.

## 6. FSM / eventos

QUEUED→RUNNING (claim con fencing), RUNNING→COMPLETED o FAILED.
El endpoint no muta estado ni genera outbox. Si el lease cambia, denegar.
El evento original `job.created` permanece inalterado.

## 7. Datos y migración

Modelos existentes AgentRun y Job. No requiere migración, backfill, seed ni
cambio de roles en producción. Los tests de CI usan PostgreSQL/Redis efímeros;
rollback: retirar endpoint y adaptador juntos.

## 8. Observabilidad y activación

Correlación, agente, resultado, intentos, claim y timestamps deben verificarse
por SHA exacto. El CI local exitoso no implica GO de producción. Requiere
revisión humana, CI total, pruebas adversariales y canary antes de despliegue.
Los doce runs históricos permanecen intactos.

## 9. Pruebas

- [x] Proyección y lector del Worker: URL/método/tenant restringidos.
- [x] Repository: tenant, org de origen, worker, intento, correlación.
- [x] GitHub Actions: HTTP firmado, Worker BullMQ, Postgres/Redis descartables,
  un Job creado y pricing/risk COMPLETED (run 43765877708).
- [ ] Contrato HTTP con claim adulterado, sesión sin rol y tokens obsoletos.
- [ ] Seguridad cross-org adicional, idempotencia/replay y revisión humana.
- [ ] CI completo sobre el SHA final del PR y canary aprobado.

## 10. Implementación

Ver related_files y related_tests. Issue #1147 investiga 12 runs, #1161
corrige autorización; PR #1160 implementa el fix y el E2E descartable.

## 11. Evidencia primaria

Repositorio: AgentsController, AgentsRepository, AgentTriggerRouter,
JobsService y Worker handlers. GitHub Actions #43764752468: 403 demostrado.
GitHub Actions #43765877708: pricing y risk COMPLETED en entorno efímero.
No se presupone evidencia de producción.

## 12. Gates de cierre

- [ ] Revisión y aprobación humana de este SDD.
- [ ] Plan, tareas, checklist y análisis reconciliados.
- [ ] pnpm spec:validate:strict PASS.
- [ ] CI, coverage, integration, E2E y CodeQL PASS en HEAD final.
- [ ] Pruebas HTTP adversariales completas.
- [ ] PR fusionado por el propietario.
- [ ] Despliegue y canary autorizados, SHA runtime comprobado.
- [ ] Evidencia de producción y status VERIFIED solo después.
