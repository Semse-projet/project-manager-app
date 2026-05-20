# SDD_GOVERNANCE — Protocolo Spec-Driven Development

**SEMSE OS · Versión 1.0 · 2026-05-20**

> Este documento define cómo se trabaja bajo SDD en SEMSE.
> Es el manual operativo. La constitución es el por qué. Este archivo es el cómo.

---

## El problema que resuelve

SEMSE fue construido principalmente con vibe coding: prompts iterativos de chat → código, sin spec previo como contrato. El resultado es un sistema poderoso pero con specs retroactivos que coexisten con el código sin gobernarlo.

SDD invierte el orden:

```
Antes (vibe coding):  prompt → código → (si acaso) documentación
Ahora (SDD):          spec → plan → tareas → código → tests → reporte
```

La diferencia clave: el spec es el contrato ejecutable. El código es una consecuencia del spec.

---

## La Secuencia Canónica

```
1. CONSTITUTION    → Principios que no cambian (.specify/memory/constitution.md)
2. SPECIFY         → Spec del feature (docs/specs/<dominio>/<feature>.spec.md)
3. PLAN            → Plan técnico (docs/specs/<dominio>/<feature>.plan.md)
4. TASKS           → Tareas implementables (docs/specs/<dominio>/<feature>.tasks.md)
5. ANALYZE         → Verificar consistencia spec ↔ código existente
6. IMPLEMENT       → Generar/modificar código
7. CHECKLIST       → Verificar completitud pre-merge
8. REPORT          → Reporte de sesión (docs/reportes/<feature>_<fecha>.md)
```

Ningún paso se salta. Ningún feature existe sin spec aprobado.

---

## Dónde viven los Specs

```
docs/specs/
├── api/                         ← Contratos de endpoints REST
│   ├── jobs.spec.md             🔴 MISSING P1
│   ├── milestones.spec.md       🔴 MISSING P1
│   ├── evidence.spec.md         🔴 MISSING P1
│   ├── payments.spec.md         🔴 MISSING P1
│   ├── contracts.spec.md        🟡 MISSING P2
│   ├── disputes.spec.md         🟡 MISSING P2
│   ├── intake.spec.md           🟡 MISSING P2
│   ├── buildops.spec.md         🟡 MISSING P2
│   ├── prometeo.spec.md         🟢 MISSING P3
│   ├── consciousness.spec.md    🟢 MISSING P3
│   └── communications.spec.md  🟢 MISSING P3
├── fsm/                         ← Máquinas de estado formales
│   ├── job-lifecycle.spec.md    🔴 PARTIAL — completar
│   ├── milestone-lifecycle.spec.md  🔴 PARTIAL — completar
│   ├── escrow-lifecycle.spec.md 🔴 PARTIAL — completar
│   └── buildops-lifecycle.spec.md   🟡 MISSING
└── ui/                          ← Flujos de usuario por rol
    ├── client-flows.spec.md     🟡 MISSING
    ├── pro-flows.spec.md        🟡 MISSING
    ├── admin-flows.spec.md      🟡 MISSING
    └── intake-flow.spec.md      🟡 MISSING
```

---

## Formato de Spec SEMSE

Usar template: `.specify/templates/overrides/semse-spec.md`

Todo spec SEMSE DEBE incluir:

| Sección | Descripción | Obligatorio |
|---------|-------------|-------------|
| Actores y permisos | Quién puede hacer qué | ✅ |
| Escenarios P1 con Given/When/Then | Casos críticos de negocio | ✅ |
| FSM (si hay ciclo de vida) | Estados, transiciones, guards, efectos | ✅ para monetizable |
| Contrato de API (por endpoint) | método + ruta + input + output + errores + efectos | ✅ |
| `privacyCritical` | True si datos van a Ollama local | ✅ |
| `auditLog` | True si genera evento de audit | ✅ |
| `sse` | True si emite SSE real-time | ✅ |
| `paymentGovernance` | True si toca escrow/pagos | ✅ para monetizable |
| Tests requeridos | Lista de tests antes de implementar | ✅ |

---

## Ciclo de Vida de un Spec

```
DRAFT → APPROVED → [DEPRECATED]
         ↓
       PLAN → TASKS → IMPLEMENT → CHECKLIST → DONE
```

- `DRAFT`: Spec en construcción. Orienta pero no es contrato ejecutable.
- `APPROVED`: Spec revisado y firmado. Gobierna el código. No se viola sin ADR.
- `DEPRECATED`: Supersedado por nuevo spec. No eliminar — mover a `docs/specs/archive/`.

Un spec pasa a `APPROVED` cuando:
- [ ] Todos los escenarios P1 tienen Given/When/Then
- [ ] Todos los endpoints tienen contrato completo (input/output/errores/efectos)
- [ ] FSM declarada (si aplica)
- [ ] Tests requeridos listados
- [ ] Ninguna invariante de `DOMAIN_INVARIANTS.md` violada
- [ ] Registrado en `docs/SPEC_INDEX.md`

---

## Regla de Oro Operativa

> Antes de pedirle a un agente IA que genere código:

```
1. ¿Existe el spec para este feature?   → Si no: /speckit.specify primero
2. ¿El spec está en APPROVED?           → Si no: completarlo con el humano
3. ¿El spec referencia una FSM?         → Verificar STATE_MACHINES.md
4. ¿El test existe?                     → Si no: escribirlo con la IA antes del código
5. ENTONCES: /speckit.implement → generar código pasándole el spec
6. El código debe pasar los tests antes de considerarse terminado
7. Actualizar SPEC_INDEX.md y crear reporte
```

---

## Spec Kit CLI (Fase futura)

Cuando el equipo decida instalar:

```bash
pip install specify          # requiere Python 3.11+ (disponible: 3.12.3)
specify init . --no-overwrite    # inicializar sin sobreescribir docs existentes
specify integration add claude   # registrar Claude Code como agente
specify integration list         # ver todos los agentes disponibles
```

La estructura `.specify/` ya está creada manualmente en Fase 0.
La instalación del CLI agrega capacidad de scaffolding automático.

Referencia: `docs/reportes/spec_kit_integration_audit_2026-05-20.md`

---

## Integración con Docs Existentes

Spec Kit complementa — no reemplaza — la documentación existente:

| Spec Kit | SEMSE equivalente | Relación |
|----------|-------------------|---------|
| `constitution.md` | `docs/constitution/` + `docs/vision/VISION_DECISIONS_LOCKED.md` | constitution.md los consolida y referencia |
| `spec template` | `docs/foundation/DOMAIN_MODEL_MVP.md` + parciales | El template SEMSE extiende el de Spec Kit |
| `AGENTS.md` | Este archivo + `docs/agents/agent-persona-registry.md` | AGENTS.md en root para agentes externos |
| `docs/specs/` | (nuevo) | Directorio de specs formales — no existía |
| `SPEC_INDEX.md` | (nuevo) | Registro canónico de specs |

Los 310 archivos de `docs/reportes/` son historial — no specs. No se eliminan.

---

## Score SDD Actual vs Objetivo

| Nivel | Score anterior | Score actual | Objetivo |
|-------|---------------|--------------|---------|
| Visión escrita | ✅ 100% | ✅ 100% | 100% |
| Dominio mapeado | ✅ 80% | ✅ 80% | 100% |
| Contratos de API | ❌ 20% | ⚠️ 25% | 100% |
| Contratos de UI | ❌ 0% | ❌ 0% | 80% |
| FSM explícito | ⚠️ 50% | ⚠️ 55% | 100% |
| Tests = spec ejecutable | ⚠️ 40% | ⚠️ 40% | 90% |
| Governance ejecutable | ❌ 0% | ✅ 80% | 100% |
| **Score total** | **~55%** | **~65%** | **95%** |

El salto de 55% → 65% es por la governance ejecutable (AGENTS.md, constitution.md, templates, SPEC_INDEX.md).
El 95% se alcanza cuando los 11 specs P1-P3 estén en APPROVED y los tests derivados pasen.
