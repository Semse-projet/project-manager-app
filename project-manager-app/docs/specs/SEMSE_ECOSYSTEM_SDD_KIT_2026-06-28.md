# Kit SDD/SSD para Mejoras del Ecosistema SEMSE

**Fecha:** 2026-06-28
**Estado:** ACTIVO
**Relación:** complementa `docs/SDD_GOVERNANCE.md` y `docs/AGENTIC_HARNESS.md`

## Propósito

Este kit empaqueta lo mínimo que debe existir antes de implementar mejoras grandes del ecosistema. Sirve para evitar que los agentes agreguen pantallas, endpoints o automatizaciones sin contrato.

En este documento, `SDD/SSD` significa:

- **Spec-Driven Development:** el spec gobierna el código.
- **System/Service Design Discipline:** cada servicio declara límites, riesgos, datos, permisos, métricas y operación.

## Paquete obligatorio por mejora

Cada mejora relevante debe crear o actualizar estos artefactos:

| Artefacto | Ruta recomendada | Para qué sirve |
|---|---|---|
| Tesis breve | `docs/program/strategy/` | Explica por qué existe la mejora |
| Spec | `docs/specs/api/`, `docs/specs/ui/`, `docs/specs/agents/` | Contrato funcional/técnico |
| Plan | junto al spec o `docs/program/execution/` | Cómo se implementa |
| Tasks | junto al spec | Pasos atómicos verificables |
| Risk brief | en spec o reporte | Riesgo, permisos, datos, rollback |
| Agent assignment | `docs/agents/harnesses/` o plan | Quién trabaja qué |
| Validation report | `docs/reportes/YYYY-MM-DD_*.md` | Qué se hizo y cómo se validó |

## Plantilla: Improvement Brief

```markdown
# Improvement Brief: [nombre]

**Fecha:** YYYY-MM-DD
**Owner humano:** [nombre/rol]
**Riesgo:** L0 | L1 | L2 | L3 | L4
**Servicios tocados:** [web, api, db, agents, railway, payments, evidence, agro]
**Specs relacionados:** [links]

## Problema
[Qué falla o qué falta en términos de usuario/operación.]

## Resultado esperado
[Qué debe poder hacer el usuario, operador o agente al final.]

## No alcance
[Qué NO se debe tocar en este bloque.]

## Datos y permisos
- Tenant/ownership:
- Roles:
- Permisos:
- AuditLog:
- PII/payment/evidence:

## Validación
- Unit:
- Controller/API:
- E2E:
- Smoke prod/staging:
- Rollback:
```

## Plantilla: WorkItem agentic

```markdown
# WorkItem: [ID] [nombre]

**Objetivo:** [resultado concreto]
**Nivel de riesgo:** L0 | L1 | L2 | L3 | L4
**Agente sugerido:** [rol]
**Owner humano:** [rol/persona]
**SLA:** [tiempo o fecha]
**Contexto requerido:** [archivos, specs, logs, rutas]
**Herramientas permitidas:** [repo-read, tests, browser, web-research, github-read, railway-read]
**Herramientas prohibidas:** [producción mutante, pagos, secrets, deploy manual]

## Criterios de aceptación
- [ ] ...

## Evidencia obligatoria
- [ ] Diff o spec actualizado
- [ ] Tests/validaciones
- [ ] Fuentes si hubo research externo
- [ ] Riesgos residuales
- [ ] Rollback
```

## Plantilla: Research loop externo

El research loop no reemplaza el spec. Solo agrega comparación externa antes de cerrar un bloque.

```markdown
## Investigación externa de mejora

### Búsquedas ejecutadas
1. `[consulta]` - fuente(s): [link]
2. `[consulta]` - fuente(s): [link]
3. `[consulta]` - fuente(s): [link]

### Ideas detectadas
- [idea] - [fuente] - [impacto esperado]

### Decisiones
- Aplicado ahora: [qué y por qué]
- Backlog: [qué queda para después]
- Descartado: [qué no aplica y por qué]
```

## Política de internet para agentes

- Usar internet cuando el bloque dependa de proveedor, framework, seguridad, deploy, pagos, cumplimiento, UX actual o comportamiento que pueda cambiar.
- Preferir fuentes primarias: documentación oficial, specs, OWASP, proveedor cloud, framework, repos oficiales.
- Registrar URLs en el reporte.
- No aplicar una idea externa directamente si cambia arquitectura; primero spec/plan/ADR.
- No ampliar el alcance del PR por hallazgos externos; crear backlog si excede el bloque.

## Niveles de riesgo

| Nivel | Definición | Gate |
|---|---|---|
| L0 | Documentación, lectura, análisis sin cambios funcionales | Agente puede proponer y editar docs |
| L1 | UI no crítica o refactor sin datos sensibles | Tests y revisión normal |
| L2 | Auth, permisos, datos por tenant, rutas API, agentes con tools | Aprobación humana antes de merge |
| L3 | Pagos, escrow, evidencia legal, migraciones, deploys | Aprobación humana + rollback probado |
| L4 | Producción mutante, secretos, pagos reales, borrado de datos | Solo humano autorizado |

## Validaciones base por tipo de cambio

| Cambio | Validaciones mínimas |
|---|---|
| Docs/plan | `git diff --check` |
| Web UI | typecheck, lint, build web, Playwright/smoke de rutas |
| API | unit/controller tests, RBAC negatives, OpenAPI/spec sync |
| DB/migración | migration diff, rollback plan, seed impact |
| Agents | replay/golden task, policy gate, audit trail |
| Railway/deploy | build, health, ready, deployment status, rollback notes |
| Payments/evidence | permission tests, audit log, idempotency, storage checks |

## Checklist pre-implementación

- [ ] El spec existe o se actualizó.
- [ ] El usuario/rol afectado está claro.
- [ ] El dato sensible y ownership están definidos.
- [ ] El riesgo fue clasificado.
- [ ] El agente líder fue asignado.
- [ ] Las herramientas permitidas/prohibidas están declaradas.
- [ ] Los tests esperados están escritos como tareas antes del código.
- [ ] El plan de rollback existe para L2+.

## Checklist de cierre

- [ ] Código o docs implementados según spec.
- [ ] Validaciones ejecutadas y registradas.
- [ ] Research loop registrado cuando corresponde.
- [ ] Riesgos residuales escritos.
- [ ] `docs/reportes/` actualizado.
- [ ] PR listo con resumen, pruebas y fuentes.
