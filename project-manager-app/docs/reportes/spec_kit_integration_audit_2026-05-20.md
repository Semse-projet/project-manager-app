# Spec Kit Integration Audit — SEMSE OS

**Fecha:** 2026-05-20
**Tipo:** Auditoría brownfield — integración SDD governance
**Repo referencia:** https://github.com/github/spec-kit
**Autor:** Claude Sonnet (sesión SDD governance)

---

## 1. Qué es Spec Kit

GitHub Spec Kit es un toolkit open source para Spec-Driven Development.
Su flujo canónico es:

```
constitution → specify → plan → tasks → analyze → implement → validate
```

Provee:
- CLI Python (`specify`) para scaffolding y gestión de specs
- 7 comandos slash registrables en agentes IA: `/speckit.constitution`, `/speckit.specify`, `/speckit.plan`, `/speckit.tasks`, `/speckit.analyze`, `/speckit.checklist`, `/speckit.implement`
- Soporte para 30+ agentes (Claude Code, Copilot, Cursor, Codex, Gemini, etc.)
- Templates para spec, plan, tasks, constitution, checklist
- Sistema de overrides/presets para personalizar por proyecto

Estructura que genera `specify init`:
```
.specify/
├── memory/
│   └── constitution.md
├── templates/
│   └── overrides/    ← personalización por proyecto
└── scripts/
AGENTS.md             ← integración con agentes IA
```

---

## 2. Estado actual de SEMSE antes de integración

### Lo que SEMSE ya tiene (compatible con Spec Kit)

| Elemento Spec Kit | Equivalente SEMSE | Estado |
|------------------|-------------------|--------|
| `constitution.md` | `docs/constitution/01_KERNEL.md` + `VISION_DECISIONS_LOCKED.md` | ✅ Existe, necesita consolidar |
| `spec templates` | `docs/foundation/DOMAIN_MODEL_MVP.md` + parciales | ⚠️ Parcial |
| `AGENTS.md` | `hermes-agent-main/AGENTS.md` (externo) | ⚠️ No en root del repo |
| `SPEC_INDEX.md` | `docs/SPEC_INDEX.md` | ✅ Recién creado |
| `docs/specs/` | No existe aún | ❌ MISSING |
| `.specify/` | No existe | ❌ MISSING |
| Comandos slash | No registrados en Claude | ❌ MISSING |

### Lo que SEMSE tiene y Spec Kit no cubre
- 310 archivos de documentación histórica (reportes, runbooks, architecture)
- FSM formal (`docs/foundation/STATE_MACHINES.md`)
- Event catalog (`docs/foundation/EVENT_CATALOG.md`)
- Domain invariants (`docs/foundation/DOMAIN_INVARIANTS.md`)
- Sistema de agentes completo (Prometeo, BuildOps, RAG, Consciousness, Observer)
- Railway deploy activo con 617 tests
- Ciclo monetizable completo en producción

---

## 3. Qué aporta Spec Kit a SEMSE

| Aporte | Impacto en SEMSE |
|--------|-----------------|
| `constitution.md` unificada | Consolida 9 archivos de constitución dispersos en un solo contrato ejecutable |
| Comandos slash para Claude | Claude puede ejecutar `/speckit.specify` para generar specs de nuevos dominios sin instrucciones ad-hoc |
| Template de spec | Estandariza el formato: escenarios → requisitos → criterios de éxito → FSM → contratos |
| Template de plan | Convierte specs en planes técnicos NestJS/Prisma/Railway con fases claras |
| Template de tasks | Rompe planes en tareas implementables con paralelización marcada |
| AGENTS.md en root | Claude lee el contrato de agente desde el root del repo en cada sesión |
| Override system | SEMSE puede definir campos obligatorios propios (privacyCritical, auditLog, SSE, FSM) |

---

## 4. Archivos que Spec Kit tocaría o agregaría

### Archivos NUEVOS (sin conflicto):
```
.specify/memory/constitution.md        ← nuevo
.specify/templates/overrides/          ← nuevo
.specify/scripts/                      ← nuevo
AGENTS.md                              ← nuevo en root
docs/SDD_GOVERNANCE.md                 ← nuevo
docs/specs/                            ← nuevo directorio
```

### Archivos que NO tocaría (Spec Kit no genera esto):
```
apps/api/                              ← código de producción, intacto
apps/web/                              ← frontend, intacto
packages/                              ← librerías, intacto
docs/reportes/                         ← histórico, intacto
docs/constitution/                     ← se referencia desde constitution.md
docs/foundation/                       ← se referencia desde specs
prisma/schema.prisma                   ← DB, intacto
```

---

## 5. Riesgos de integración

| Riesgo | Nivel | Mitigación |
|--------|-------|-----------|
| `specify init --force` sobreescribe docs existentes | 🔴 Alto | No ejecutar. Crear archivos manualmente. |
| Constitution.md duplica información de 9 archivos existentes | 🟡 Medio | Referenciar, no copiar. La constitución apunta a docs existentes. |
| AGENTS.md en root entra en conflicto con sesiones Claude sin contexto | 🟡 Medio | Diseñar AGENTS.md como contexto incremental, no reemplazante. |
| Templates de Spec Kit no cubren dominio SEMSE (FSM, AuditLog, SSE) | 🟡 Medio | Overrides SEMSE en `.specify/templates/overrides/`. |
| `specify` CLI requiere Python 3.11+ (disponible: 3.12.3) ✅ | 🟢 Bajo | Compatible. Instalar solo cuando el equipo lo decida. |

---

## 6. Estrategia recomendada — Brownfield seguro

### Fase 0 (esta sesión): Integración documental sin CLI
No instalar `specify` CLI todavía. Crear la estructura manualmente:

```
1. .specify/memory/constitution.md          ← SEMSE Constitution formal
2. .specify/templates/overrides/            ← SEMSE Spec Kit preset
3. AGENTS.md (root)                         ← Claude Code integration
4. docs/SDD_GOVERNANCE.md                   ← Protocolo SDD operativo
5. docs/specs/ (estructura vacía + README)  ← Home de specs futuros
```

### Fase 1 (próxima sesión): Specs P1
Usando los templates de `.specify/templates/overrides/`:
```
docs/specs/api/milestones.spec.md
docs/specs/api/jobs.spec.md
docs/specs/api/evidence.spec.md
docs/specs/api/payments.spec.md
```

### Fase 2 (cuando el equipo decida): Instalar specify CLI
```bash
pip install specify
specify init . --no-overwrite    # banderas de seguridad a confirmar
```

---

## 7. Qué conservar de SEMSE

- TODO el contenido de `docs/` — no mover, no borrar
- Los 9 archivos de `docs/constitution/` — la nueva `constitution.md` los referencia
- `docs/foundation/STATE_MACHINES.md` — más completo que cualquier template de Spec Kit
- `docs/foundation/EVENT_CATALOG.md` — no existe equivalente en Spec Kit
- `docs/SPEC_INDEX.md` — extiende el concepto de registry de Spec Kit
- Los 617 tests existentes — no se tocan

## 8. Qué adaptar de Spec Kit

- Template de spec → adaptado con campos SEMSE (FSM, AuditLog, SSE, privacyCritical)
- Template de plan → adaptado para stack NestJS/Prisma/Next.js/Railway/Ollama
- Template de tasks → adaptado con fases SEMSE
- Constitution format → consolida docs/constitution/ existentes
- AGENTS.md → Claude Code integration con contexto SEMSE

## 9. Qué NO hacer

- ❌ No ejecutar `specify init . --force` sin revisar cada archivo que genera
- ❌ No mover `docs/constitution/` ni `docs/foundation/`
- ❌ No reemplazar `docs/SPEC_INDEX.md` con el registry de Spec Kit (SEMSE tiene más detalle)
- ❌ No instalar specify CLI globalmente sin decisión del equipo
- ❌ No tocar lógica de producción (apps/, packages/, prisma/) en esta sesión
- ❌ No eliminar reportes históricos aunque sean redundantes con specs

---

## Resultado de esta sesión

Archivos creados por esta integración:

| Archivo | Propósito |
|---------|-----------|
| `.specify/memory/constitution.md` | Constitución SEMSE formal en formato Spec Kit |
| `.specify/templates/overrides/semse-spec.md` | Template de spec adaptado a SEMSE |
| `.specify/templates/overrides/semse-plan.md` | Template de plan técnico SEMSE |
| `.specify/templates/overrides/semse-tasks.md` | Template de tareas SEMSE |
| `AGENTS.md` | Claude Code integration — contexto de agente |
| `docs/SDD_GOVERNANCE.md` | Protocolo SDD operativo completo |
| `docs/SPEC_INDEX.md` | Ya creado en sesión anterior |

Ningún archivo existente fue modificado o eliminado.
