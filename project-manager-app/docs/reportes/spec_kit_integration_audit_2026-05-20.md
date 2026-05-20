# Spec Kit Integration Audit — SEMSEproject
**Fecha:** 2026-05-20
**Rama:** feat/spec-kit-sdd-governance
**Estado:** APROBADO PARA INTEGRACIÓN BROWNFIELD MÍNIMA
**Referencia:** https://github.com/github/spec-kit

---

## 1. Qué es Spec Kit

GitHub Spec Kit es un toolkit open source para Spec-Driven Development (SDD). Define un flujo donde las especificaciones son la fuente de verdad y el código es su consecuencia, no al revés.

**Secuencia oficial:**
```
constitution → specify → plan → tasks → implement → analyze → validate
```

**Comandos principales:**
```
/speckit.constitution   → establece principios del proyecto
/speckit.specify        → define requisitos y user stories
/speckit.plan           → crea plan técnico desde el spec
/speckit.tasks          → rompe el plan en tareas ejecutables
/speckit.taskstoissues  → convierte tareas en GitHub Issues
/speckit.implement      → ejecuta tareas con agente
/speckit.clarify        → resuelve ambigüedades antes de planificar
/speckit.analyze        → valida consistencia spec ↔ plan ↔ tasks ↔ código
/speckit.checklist      → genera checklist de calidad
```

**Archivos que genera `specify init`:**
```
.specify/
├── memory/
│   └── constitution.md       ← principios que rigen todo
├── scripts/bash/             ← helpers para prereqs, plan, tasks
├── specs/                    ← directorio de features especificados
├── templates/                ← plantillas default
│   └── overrides/            ← overrides locales del proyecto
└── presets/                  ← presets del proyecto
.claude/commands/             ← comandos para Claude Code
```

**Resolución de templates (prioridad):**
```
1. .specify/templates/overrides/   ← más alta (proyecto local)
2. .specify/presets/templates/
3. .specify/extensions/templates/
4. .specify/templates/             ← default spec-kit
```

---

## 2. Estado actual de SEMSEproject

### Documentos SDD existentes

| Tipo | Ruta | Estado |
|---|---|---|
| Visión core | `labosemse/vision_core.md` | APPROVED |
| Principios de producto | `labosemse/VISION_PRINCIPLES_FOR_PRODUCT.md` | APPROVED |
| Decisiones bloqueadas | `labosemse/VISION_DECISIONS_LOCKED.md` | APPROVED |
| Glosario canónico | `labosemse/VISION_GLOSSARY.md` | APPROVED |
| Métricas de éxito | `labosemse/VISION_SUCCESS_METRICS.md` | APPROVED |
| Visión fusionada | `labosemse/VISION_FUSIONADA_SEMSE_PROMETEO.md` | APPROVED |
| Blueprint maestro | `docs/blueprints/` | APPROVED |
| Mapa de dominio | `docs/domain-map.md` | APPROVED |
| Arquitectura | `docs/architecture.md` | APPROVED |
| ADRs | `docs/adrs/` (10+ archivos) | PARTIAL |
| MVP scope | `specs/mvp-scope.md` | APPROVED |
| Entidades | `specs/entities.md` | APPROVED |
| Workflows core | `specs/SEMSE_CORE_WORKFLOWS.md` | APPROVED |
| Agentes (16 roles) | `AGENTS.md` | APPROVED |
| Checklist absorción | `SEMSE_ABSORPTION_EXECUTION_CHECKLIST.md` | ACTIVE |
| Ecosystem map | `SEMSE_ecosystem_system_map_2026-03-28.md` | APPROVED |

### Lo que NO existe todavía

| Artefacto | Estado | Prioridad |
|---|---|---|
| `.specify/memory/constitution.md` | MISSING | ALTA — se crea en esta sesión |
| `docs/SPEC_INDEX.md` | MISSING | ALTA — se crea en esta sesión |
| `docs/SDD_GOVERNANCE.md` | MISSING | ALTA — se crea en esta sesión |
| `specs/api/*.spec.md` | MISSING | ALTA |
| `specs/fsm/*.spec.md` | MISSING | ALTA |
| `specs/ui/*.spec.md` | MISSING | MEDIA |
| Tests derivados de specs en API | MISSING | ALTA |
| OpenAPI/Swagger desde contracts | MISSING | MEDIA |

---

## 3. Análisis de riesgo de integración

### Riesgos detectados

| Riesgo | Severidad | Mitigación |
|---|---|---|
| `specify init . --force` puede sobreescribir docs existentes | ALTA | No ejecutar. Integración manual |
| Conflicto de naming entre `AGENTS.md` (SEMSE) y `AGENTS.md` (Spec Kit) | MEDIA | Mantener SEMSE AGENTS.md, crear `.claude/commands/` separado |
| Mezclar templates Spec Kit con docs de visión existentes | MEDIA | Spec Kit vive en `.specify/`, docs SEMSE en sus rutas actuales |
| Duplicar documentos (blueprint vs constitution) | MEDIA | Constitution es resumen ejecutivo, blueprint es detalle |
| Mover docs masivamente y romper referencias internas | BAJA | No mover nada, solo agregar |

### Lo que NO se debe hacer en esta integración

```
✗  No ejecutar `specify init . --force`
✗  No renombrar ni mover labosemse/, docs/, specs/
✗  No tocar apps/, packages/, ningún código funcional
✗  No sobrescribir AGENTS.md con plantilla de Spec Kit
✗  No crear dependencias de npm con spec-kit (innecesario para brownfield)
✗  No modificar Railway, CI/CD, ni variables de entorno
✗  No eliminar ningún documento existente
```

---

## 4. Estrategia de integración brownfield recomendada

### Fase 1 — Integración mínima documental (esta sesión)
Crear solo lo que falta sin tocar lo que existe:
```
.specify/memory/constitution.md     ← constitución SEMSE adaptada
docs/SPEC_INDEX.md                  ← registry de todos los specs
docs/SDD_GOVERNANCE.md              ← reglas de gobierno SDD
.specify/templates/overrides/       ← directorio para preset SEMSE (vacío ahora)
```

### Fase 2 — Contratos de API (próxima sesión)
Por cada dominio del MVP:
```
specs/api/jobs.spec.md
specs/api/milestones.spec.md
specs/api/payments.spec.md
specs/api/evidence.spec.md
specs/api/auth.spec.md
```

### Fase 3 — Specs de FSM y UI
```
specs/fsm/job-lifecycle.spec.md
specs/fsm/milestone-lifecycle.spec.md
specs/fsm/payment-lifecycle.spec.md
specs/ui/client-flows.spec.md
specs/ui/pro-flows.spec.md
specs/ui/admin-flows.spec.md
```

### Fase 4 — Tests derivados de specs
Para cada spec de API, un archivo de test que lo ejecuta.
Regla: ningún endpoint en producción sin su spec + test.

### Fase 5 — Preset SEMSE en `.specify/templates/overrides/`
Adaptar plantillas de Spec Kit con exigencias específicas de SEMSE:
- API Contract (input/output/errors/permissions/effects)
- FSM declaration
- RBAC
- AuditLog
- SSE events
- Payment Governance impact
- Evidence impact
- Privacy routing (Ollama vs cloud)

---

## 5. Qué aporta Spec Kit a SEMSE

| Beneficio | Impacto |
|---|---|
| Flujo constitution → specify → plan → tasks | Elimina el vibe coding en desarrollo nuevo |
| Comandos `/speckit.*` en Claude Code | Gobiernan todas las sesiones con IA |
| Template-driven LLM guidance | La IA genera código desde specs, no desde prompts libres |
| `analyze` command | Detecta inconsistencias spec ↔ código antes de PR |
| Estructura `.specify/` | Separa governance de código limpiamente |
| Overrides locales | Permite preset SEMSE sin depender del upstream |

---

## 6. Relación entre documentos SEMSE y Spec Kit

```
Spec Kit               SEMSEproject (equivalente)
───────────────────────────────────────────────────
constitution.md   ←→   labosemse/vision_core.md
                        + VISION_PRINCIPLES_FOR_PRODUCT.md
                        + VISION_DECISIONS_LOCKED.md
                        (se sintetiza en .specify/memory/constitution.md)

specs/            ←→   specs/ (existente, se extiende)

plan              ←→   docs/blueprints/ (existente, se referencia)

tasks             ←→   SEMSE_ABSORPTION_EXECUTION_CHECKLIST.md (existente)

AGENTS.md         ←→   AGENTS.md (SEMSE tiene el suyo, más completo)

templates/        ←→   .specify/templates/overrides/ (se crea con preset SEMSE)
```

---

## 7. Resultado de esta sesión

```
CREADO:
  ✓ .specify/memory/constitution.md
  ✓ docs/SPEC_INDEX.md
  ✓ docs/SDD_GOVERNANCE.md
  ✓ docs/reportes/spec_kit_integration_audit_2026-05-20.md
  ✓ .specify/templates/overrides/ (directorio, vacío — preset pendiente)

NO TOCADO:
  ✓ labosemse/        (intacto)
  ✓ docs/blueprints/  (intacto)
  ✓ specs/            (intacto)
  ✓ AGENTS.md         (intacto)
  ✓ apps/             (intacto)
  ✓ packages/         (intacto)
  ✓ ningún código funcional modificado
```
