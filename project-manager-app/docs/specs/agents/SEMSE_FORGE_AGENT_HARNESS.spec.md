---
id: semse-forge-agent-harness
title: "SEMSE Forge Agent Harness"
domain: agents
status: APPROVED
owner: semse-core
risk: critical
related_files:
  - packages/forge/src/registry.ts
  - packages/forge/src/policy.ts
  - packages/forge/src/orchestrator.ts
  - packages/forge/src/state-machine.ts
  - docs/agents/forge-agent-registry.md
related_tests:
  - tests/unit/forge-harness.test.mjs
related_endpoints: []
related_events:
  - FORGE_TASK_ASSIGNED
  - FORGE_HUMAN_REVIEW_REQUESTED
  - FORGE_RUN_BLOCKED
  - FORGE_RUN_ROLLED_BACK
related_agents:
  - forge-supervisor
  - spec-architect
  - domain-architect
  - creator-mentor
  - qa-verifier
  - security-reviewer
  - governance-auditor
last_verified: 2026-07-17
---

# SPEC: SEMSE Forge Agent Harness

## 1. Objetivo

Definir un arnés multiagente determinista, gobernado y auditable que permita a SEMSE Forge coordinar agentes de ingeniería sin otorgarles autoridad ilimitada.

## 2. Capas

### Control plane

- run registry;
- task graph;
- FSM;
- scheduler;
- leases;
- budgets;
- approvals.

### Execution plane

- model adapters;
- tool adapters;
- sandbox;
- command runner;
- patch writer.

### Policy plane

- manifests;
- file scopes;
- action scopes;
- network scopes;
- risk scoring;
- approval rules.

### Evidence plane

- tool traces;
- diffs;
- test output;
- screenshots;
- reports;
- audit events.

### Knowledge plane

- specs;
- ADRs;
- code map;
- domain map;
- creator knowledge;
- reusable components.

## 3. Principio de no herencia

El Supervisor puede delegar una tarea, pero no puede ampliar los permisos del agente delegado. El permiso efectivo es la intersección de:

```text
spec scope
∩ task packet scope
∩ agent manifest
∩ environment policy
∩ human approvals
```

## 4. Registro de agentes

El registro inicial contiene 14 roles:

1. Forge Supervisor
2. Spec Architect
3. Domain Architect
4. Creator Mentor
5. UX Composer
6. Data Engineer
7. Backend Builder
8. Frontend Builder
9. Integration Engineer
10. QA Verifier
11. Security Reviewer
12. DevOps Release
13. Documentation Curator
14. Governance Auditor

## 5. Manifest

Cada agente declara:

- identidad y versión;
- owner;
- estado;
- tools;
- acciones;
- scopes de archivos;
- scopes de red;
- riesgo máximo;
- modo de aprobación;
- clase de modelo;
- tags.

Los manifests deben versionarse. Un run conserva la versión usada.

## 6. Tool gateway

Los agentes nunca llaman infraestructura directamente. Toda tool pasa por gateway:

```text
request
 -> context filter
 -> policy evaluation
 -> approval check
 -> execution adapter
 -> output filter
 -> audit record
```

## 7. Context firewall

Solo se entrega al agente:

- datos incluidos por task packet;
- fuentes autorizadas;
- secretos sustituidos por handles;
- PII mínima;
- fragmentos de código relevantes;
- spec digest.

El contexto no autorizado se excluye antes del prompt.

## 8. Scheduling

El scheduler debe soportar:

- dependencias DAG;
- prioridad;
- concurrencia;
- retries;
- backoff;
- cancellation;
- pause on approval;
- timeout;
- lease por recurso.

## 9. Leases

Recursos sensibles:

- `schema.prisma`;
- migraciones;
- lockfiles;
- `railway.json`;
- Dockerfiles;
- auth;
- pagos;
- policy engine.

Solo un task de escritura puede tener lease activo por recurso.

## 10. Mensajería

Envelope mínimo:

```json
{
  "messageId": "uuid",
  "correlationId": "uuid",
  "runId": "uuid",
  "taskId": "string",
  "from": "forge-supervisor",
  "to": "backend-builder",
  "type": "task.assign",
  "specDigest": "sha256",
  "risk": "high",
  "payload": {},
  "createdAt": "ISO-8601"
}
```

## 11. Aprobaciones

- `creator_review`: contenido, marca y publicación del profesor.
- `ops_admin`: cambios operativos high.
- `security`: conectores, auth, network y datos sensibles.
- `dual_control`: critical; requiere dos autoridades independientes.

Un agente nunca aprueba su propia acción.

## 12. Verificación

QA Verifier recibe un workspace de solo lectura, excepto tests/reportes. Debe producir matriz con:

- comando;
- estado;
- duración;
- evidencia;
- error;
- artefacto.

## 13. Recuperación

Ante fallo:

1. detener asignaciones descendientes;
2. revocar leases;
3. conservar evidencia;
4. clasificar retryable/non-retryable;
5. bloquear o rollback;
6. solicitar intervención si es critical.

## 14. Seguridad

- sin shell irrestricto;
- allowlist de comandos;
- límites de red;
- sanitización de prompts;
- protección contra instrucciones contenidas en repositorio;
- no secretos en logs;
- checksum de spec y task packet;
- revisión de dependencia y licencia.

## 15. Compatibilidad con packages/agents

`packages/forge` no duplica el runtime de agentes operativos. Debe integrarse mediante adaptador:

- Forge crea task packet.
- `packages/agents` ejecuta un run gobernado.
- Forge recibe resultado, policy, risk, approvals y audit trail.
- Forge actualiza FSM y verification matrix.

## 16. Criterios de aceptación

- registro completo y sin IDs duplicados;
- tools válidas;
- scopes no vacíos;
- lifecycle total;
- policy deny/approval/allow probado;
- eventos auditables;
- Creator Mentor separado de builders;
- Supervisor sin autoridad de merge/deploy directo.
