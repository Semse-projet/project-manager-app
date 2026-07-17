---
id: semse-forge-sdd
title: "SEMSE Forge Spec-Driven Development"
domain: forge
status: APPROVED
owner: semse-core
risk: critical
related_files:
  - packages/forge/src
  - .semse-sdd/forge
  - scripts/forge-validate.mjs
related_tests:
  - tests/unit/forge-harness.test.mjs
related_endpoints: []
related_events:
  - FORGE_RUN_CREATED
  - FORGE_SPEC_APPROVED
  - FORGE_VERIFICATION_COMPLETED
  - FORGE_PR_READY
related_agents:
  - prometeo
  - forge-supervisor
  - spec-architect
  - governance-auditor
last_verified: 2026-07-17
---

# SPEC: SEMSE Forge Spec-Driven Development

## 1. Propósito

SEMSE Forge es el plano de control de ingeniería autónoma de SEMSEproject. Convierte intención humana aprobada en:

1. contexto verificable;
2. especificaciones canónicas;
3. grafos de tareas;
4. cambios de código acotados;
5. evidencia de validación;
6. propuestas de pull request y despliegue;
7. aprendizaje documentado.

Forge no debe convertir una conversación directamente en cambios de producción. La especificación aprobada es el contrato que separa la intención de la ejecución.

## 2. Relación con la arquitectura existente

- La Constitución y el mapa de autoridad conservan precedencia.
- `packages/db` conserva autoridad sobre datos.
- `packages/schemas` conserva autoridad sobre contratos.
- `apps/api`, `apps/web` y `apps/worker` conservan autoridad de implementación.
- `packages/agents` conserva el runtime agentic-native y sus approvals.
- `packages/forge` agrega coordinación de ingeniería, task packets, lifecycle y políticas.
- Prometeo es el punto conversacional y estratégico.
- Forge no reemplaza a Prometeo, BuildOps, Evidence, Crowd, Marketplace ni ProTools.

## 3. Principios normativos

### SDD-001 — No code without spec

Ningún cambio funcional, de esquema, infraestructura, seguridad o integración puede pasar a `building` sin spec `APPROVED`.

Excepciones permitidas:

- documentación no funcional;
- corrección tipográfica;
- emergencia de seguridad bajo runbook, con spec retrospectivo obligatorio.

### SDD-002 — El spec es direccionable e inmutable por digest

Todo task packet debe incluir:

- `spec.id`;
- ruta;
- estado;
- digest;
- acceptance criteria.

Si cambia el digest, las tareas pendientes deben invalidarse o reaprobarse.

### SDD-003 — Alcance explícito

Cada task packet declara:

- archivos permitidos;
- archivos prohibidos;
- comandos permitidos;
- agente requerido;
- riesgo;
- dependencias;
- rama objetivo;
- entorno.

Un agente no puede ampliar su propio alcance.

### SDD-004 — Sin escritura directa a la rama por defecto

Forge nunca autoriza cambios a `main` o `master`. Toda ejecución usa una rama o sandbox aislado.

### SDD-005 — Human-in-the-loop proporcional al riesgo

- Bajo: puede avanzar automáticamente dentro del scope.
- Medio: revisión humana antes de merge.
- Alto: aprobación de owner u ops admin antes de acción sensible.
- Crítico: dual control y plan de rollback.

### SDD-006 — Verificación independiente

El agente que implementa no certifica por sí solo el resultado. `qa-verifier`, `security-reviewer` y `governance-auditor` generan evidencia independiente según riesgo.

### SDD-007 — No degradar controles

Está prohibido:

- desactivar pruebas;
- ocultar errores TypeScript;
- disminuir cobertura para pasar CI;
- eliminar autorización;
- escribir secretos;
- modificar migraciones ya aplicadas;
- falsear evidencia;
- marcar checks como `passed` sin comando o artefacto.

### SDD-008 — Rollback antes de despliegue

Todo cambio de infraestructura, schema, pagos, identidad o datos regulados debe declarar rollback, blast radius y owner de recuperación.

## 4. Entradas

Una ejecución puede originarse por:

- solicitud humana;
- issue;
- incidente;
- fallo de CI;
- señal de observabilidad;
- nueva app de profesor;
- cambio regulatorio;
- deuda técnica aprobada.

La entrada mínima contiene problema, resultado esperado, restricciones y owner.

## 5. Artefactos obligatorios

| Artefacto | Fase | Autoridad |
|---|---|---|
| Intake record | intake | Prometeo / humano |
| Spec canónico | spec_review | Spec Architect |
| Threat/risk classification | spec_review | Security + Governance |
| Task graph | planned | Forge Supervisor |
| Task packets | planned | Forge Supervisor |
| Change set | building | Builder especializado |
| Verification matrix | verifying | QA Verifier |
| Security report | verifying | Security Reviewer |
| PR package | ready_for_review | Forge Supervisor |
| Deployment proposal | merged | DevOps Release |
| Observation report | observing | Runtime/Ops |
| Learning record | closed | Documentation Curator |

## 6. Flujo canónico

```text
IDEA
  -> INTAKE
  -> SPEC_DRAFT
  -> SPEC_REVIEW
  -> APPROVED
  -> PLANNED
  -> BUILDING
  -> VERIFYING
  -> READY_FOR_REVIEW
  -> MERGED
  -> DEPLOYED
  -> OBSERVING
  -> CLOSED
```

Estados alternos:

- `BLOCKED`
- `ROLLED_BACK`

## 7. Gates

### Gate A — Context

Debe existir evidencia del repositorio, autoridad aplicable, módulos afectados y restricciones.

### Gate B — Spec

Debe pasar `pnpm spec:validate:strict` y contener criterios verificables.

### Gate C — Plan

El grafo no puede tener ciclos; cada tarea declara owner, dependencia y scope.

### Gate D — Build

Solo se ejecutan tools autorizadas por manifest y policy engine.

### Gate E — Verification

Como mínimo:

- typecheck;
- pruebas unitarias afectadas;
- build afectado;
- validación de specs;
- pruebas de contratos;
- revisión de seguridad según riesgo.

### Gate F — Review

El PR contiene trazabilidad spec → tarea → diff → test → evidencia.

### Gate G — Release

Requiere aprobación aplicable, rollback y observación posterior.

## 8. Riesgo

### Low

Documentación, tests adicionales, refactor sin cambio contractual.

### Medium

UI, lógica interna acotada, nuevos componentes sin datos sensibles.

### High

Endpoints, autorizaciones, conectores, eventos, datos confidenciales.

### Critical

Prisma/migraciones, pagos, identidad, secretos, infraestructura de producción, datos regulados, autoejecución.

## 9. Modelo de task packet

El contrato TypeScript vive en `packages/forge/src/types.ts`.

Campos mínimos:

```text
id
title
spec
requestedRole
riskLevel
objective
allowedFiles
forbiddenFiles
allowedCommands
acceptanceCriteria
dependencies
targetBranch
environment
metadata
```

## 10. Estrategia multiagente

Forge debe preferir descomposición antes que un agente monolítico.

- Spec Architect define qué debe existir.
- Domain Architect define límites y contratos.
- Builders implementan.
- QA verifica.
- Security revisa.
- Governance valida autoridad.
- DevOps propone release.
- Documentation Curator conserva trazabilidad.

El Forge Supervisor coordina, pero no hereda permisos de los subagentes.

## 11. Presupuestos y límites

Cada run debe poder declarar:

- límite de tokens;
- límite de costo;
- límite de comandos;
- timeout;
- máximo de iteraciones;
- máximo de archivos;
- máximo de líneas modificadas;
- máximo de concurrencia.

Al superar un límite, el run pasa a `blocked`.

## 12. Idempotencia y concurrencia

- Cada tarea tiene ID estable.
- Las acciones usan correlation ID.
- Un archivo sensible solo puede tener un lease de escritura activo.
- Dos agentes no deben editar el mismo archivo simultáneamente.
- Los reintentos no duplican migraciones, eventos ni approvals.

## 13. Evidencia y auditoría

Cada acción registra:

- actor y agente;
- manifest y versión;
- spec digest;
- task ID;
- tool;
- input filtrado;
- output;
- decisión de policy;
- riesgo;
- approval;
- timestamp;
- evidencia de verificación.

## 14. Integración con GitHub

Forge prepara:

- rama;
- commits atómicos;
- PR en draft;
- cuerpo con trazabilidad;
- checks requeridos;
- reviewers por CODEOWNERS/política.

Nunca hace merge automático de cambios high o critical.

## 15. Integración con Railway

Forge puede leer configuración y proponer cambios. No modifica producción sin aprobación dual. Debe ejecutar preflight equivalente y documentar servicio afectado, causa, fix mínimo, validación y riesgo.

## 16. Métricas

- lead time idea→spec;
- lead time spec→PR;
- first-pass CI rate;
- rollback rate;
- defect escape rate;
- porcentaje de tareas fuera de scope;
- approvals por riesgo;
- costo por run;
- reutilización de componentes;
- tiempo de creación de apps por profesores.

## 17. Criterios de aceptación

1. Existe paquete `@semse/forge`.
2. Existen manifests para todos los roles definidos.
3. El policy engine bloquea escritura directa a `main`.
4. Los cambios fuera de file scope son denegados.
5. Riesgo crítico exige dual control.
6. El FSM rechaza transiciones inválidas.
7. El harness registra eventos y approvals.
8. Las pruebas unitarias cubren policy, lifecycle y Creator Platform.
9. El spec pasa el validador canónico al aplicarse al monorepo.
10. No se altera el comportamiento de producción con esta fundación.
