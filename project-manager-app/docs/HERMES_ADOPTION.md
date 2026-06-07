# Adopción de Arquitectura Hermes Agent — SEMSE OS

**Fecha:** 2026-05-04  
**Sesión:** Análisis profundo de `NousResearch/hermes-agent` + implementación en `project-manager-app`

---

## Resumen ejecutivo

Se estudiaron los patrones arquitectónicos del framework Hermes Agent (NousResearch) y se adoptaron los más relevantes para SEMSE OS, específicamente para Prometeo (el agente de contractors).

---

## Qué se construyó

### 1. Sistema de Skills de Dominio (`apps/api/skills/`)

8 skills de conocimiento de dominio en formato SKILL.md (idéntico al formato Hermes):

| Skill | Intents cubiertos | Descripción |
|-------|------------------|-------------|
| `cotizacion-construccion` | estimate_generation, price_suggestion, budget_estimate | Estimados profesionales completos con tabla de precios |
| `precios-materiales-eeuu` | materials_list, estimate_generation | Precios HD/Lowes 2024-2025 por categoría |
| `comunicacion-clientes` | client_message, project_summary_client | Templates WhatsApp/email para todos los escenarios |
| `evaluacion-contratistas` | project_report, operational_summary | Checklist, red flags, sistema de scoring 0-100 |
| `gestion-proyectos` | project_report, schedule_plan | Fases, cronogramas, señales de problema |
| `seguimiento-pagos` | payment_status, budget_estimate | Escrow, estados de pago, tipos de cobro |
| `resolucion-disputas` | dispute_status | Proceso, evidencia, small claims |
| `contratos-obra` | legal_compliance | Cláusulas, mechanic's lien, change orders |
| `codigos-construccion` | legal_compliance, project_report | Permisos, inspecciones, por estado |
| `materiales-obra` | materials_list, estimate_generation | Fórmulas de cálculo, conversiones, reglas de oro |

**Formato de cada skill:**
```markdown
---
name: skill-name
description: "Una oración"
version: 1.0.0
metadata:
  semse:
    tags: [tag1, tag2]
    intents: [intent1, intent2]
    related_skills: [otro-skill]
---
# Contenido del skill (markdown)
```

### 2. SkillLoader + SkillMatcher (`apps/api/src/modules/skills/`)

```
apps/api/src/modules/skills/
├── skill.types.ts          — Tipos TypeScript
├── skill-loader.service.ts — Lee SKILL.md del filesystem, cache 5 min
├── skill-matcher.service.ts — Matchea skills por intent/query, score compuesto
├── context-fencing.ts      — StreamingContextScrubber + buildMemoryContextBlock
├── skills.module.ts        — NestJS module
└── index.ts                — Barrel export
```

**Cómo funciona el matching:**
1. Exact intent match → score +10
2. Tag overlap con intent → score +3
3. Query keyword overlap → score +2/+1
4. Top 3 skills seleccionados, máx 5,000 chars de contexto

**Context fencing (port de Hermes `memory_manager.py`):**
```typescript
// Inyecta conocimiento como contexto de fondo (invisible al usuario)
buildMemoryContextBlock(rawContext) 
// → <memory-context>
//   [System note: ... NOT new user input ...]
//   [contenido del skill]
//   </memory-context>

// StreamingContextScrubber — filtra en streaming sin leaks
const scrubber = new StreamingContextScrubber();
const visible = scrubber.feed(chunk); // filtra los bloques <memory-context>
```

### 3. Integración en Prometeo Chat (`ai-models.controller.ts`)

En el endpoint `POST /v1/ai-models/prometeo/chat`:

```typescript
// Antes del request al LLM:
const skillContext = this.skillMatcher.buildForIntent(intent, message);
const systemPromptWithSkills = skillContext
  ? `${baseSystemPrompt}\n\n${buildMemoryContextBlock(skillContext)}`
  : baseSystemPrompt;

// Metadata de auditoría
metadata: {
  skillsInjected: [...], // qué skills se inyectaron
}
```

**Resultado:** Cuando un contractor pide un estimado de drywall, Prometeo recibe automáticamente:
- Precios actualizados de materiales
- Fórmulas de cálculo de cantidades
- Estructura de estimado profesional

**Sin cambios al API público** — el frontend no cambia nada.

### 4. Curator Worker (`apps/worker/src/modules/curator/`)

Port del `curator.py` de Hermes adaptado al dominio construcción:

```
apps/worker/src/modules/curator/
├── curator.prompt.mjs   — Prompt de revisión de skills (en español, dominio SEMSE)
└── curator.service.mjs  — Orchestrador: scan, auto-transitions, LLM review, reports
```

**Cuándo corre:** Cada 6 horas el worker verifica; ejecuta LLM review cada 7 días.

**Lo que hace:**
1. Auto-transitions: marca skills "stale" si no se actualizan en 60 días
2. LLM review: Claude analiza skills y consolida narrow → umbrellas
3. Report: escribe `REPORT.md` + `run.json` en `skills/.curator-reports/`
4. State: persiste `skills/.curator_state.json`

**Activación manual:**
```bash
node apps/worker/src/modules/curator/curator.service.mjs --force --dry-run
node apps/worker/src/modules/curator/curator.service.mjs --force  # live run
```

**Integración en worker main:**
```javascript
// main.mjs — agrega curator al loop existente
curatorTimer = setInterval(() => { void runCuratorSafe(); }, 6 * 60 * 60 * 1_000);
```

---

## Arquitectura resultante

```
User message
    ↓
POST /v1/ai-models/prometeo/chat
    ↓
classifyIntent() → "estimate_generation"
    ↓
SkillMatcherService.buildForIntent("estimate_generation", message)
    → matches: [cotizacion-construccion, precios-materiales-eeuu, materiales-obra]
    ↓
buildMemoryContextBlock(skillContent)
    → <memory-context>[conocimiento de dominio]</memory-context>
    ↓
systemPrompt = persona + <memory-context>
    ↓
LLM(anthropic/deepseek/kimi) genera respuesta
    ↓
StreamingContextScrubber filtra tags en output (si streaming)
    ↓
Response al usuario: estimado completo con precios reales
```

**Worker background:**
```
Cada 6h: runCuratorSafe()
    → shouldRunNow() ← .curator_state.json (interval 7 días)
    → scanSkills() → renderCandidateList()
    → runLlmReview(prompt) → consolidate/archive
    → writeReport() → REPORT.md + run.json
    → saveState()
```

---

## Diferencias con Hermes Agent original

| Aspecto | Hermes | SEMSE OS |
|---------|--------|---------|
| Runtime | Python CLI local | TypeScript NestJS API |
| Skills storage | `~/.hermes/skills/` | `apps/api/skills/` |
| Memory provider | Pluggable (builtin + 1 external) | Integrado en AgentMemoryService existente |
| Curator | Daemon en idle | Worker con timer, usa `@anthropic-ai/sdk` |
| Context fencing | Python StreamingContextScrubber | Port TypeScript idéntico |
| Formato SKILL.md | `metadata.hermes.tags` | `metadata.semse.tags` (misma estructura) |

---

## Próximos pasos recomendados

1. **Agregar more skills**: `inspecciones-campo`, `seguros-contratistas`, `marketing-contratistas`
2. **Curator → Supabase**: mover el state del curator a una tabla DB para multi-instancia
3. **Skill versioning**: endpoint `GET /v1/skills` para que el frontend muestre qué skills están activos
4. **Feedback loop**: cuando el usuario hace thumbs down, marcar el skill como stale
5. **Embeddings para matching**: usar los embeddings de Prometeo para match semántico en lugar de keyword

---

## Archivos creados/modificados

### Nuevos
- `apps/api/skills/cotizacion-construccion/SKILL.md`
- `apps/api/skills/precios-materiales-eeuu/SKILL.md`
- `apps/api/skills/comunicacion-clientes/SKILL.md`
- `apps/api/skills/evaluacion-contratistas/SKILL.md`
- `apps/api/skills/gestion-proyectos/SKILL.md`
- `apps/api/skills/seguimiento-pagos/SKILL.md`
- `apps/api/skills/resolucion-disputas/SKILL.md`
- `apps/api/skills/contratos-obra/SKILL.md`
- `apps/api/skills/codigos-construccion/SKILL.md`
- `apps/api/skills/materiales-obra/SKILL.md`
- `apps/api/src/modules/skills/skill.types.ts`
- `apps/api/src/modules/skills/skill-loader.service.ts`
- `apps/api/src/modules/skills/skill-matcher.service.ts`
- `apps/api/src/modules/skills/context-fencing.ts`
- `apps/api/src/modules/skills/skills.module.ts`
- `apps/api/src/modules/skills/index.ts`
- `apps/worker/src/modules/curator/curator.prompt.mjs`
- `apps/worker/src/modules/curator/curator.service.mjs`

### Modificados
- `apps/api/src/modules/ai-models/ai-models.module.ts` — importa SkillsModule
- `apps/api/src/modules/ai-models/ai-models.controller.ts` — inyecta SkillMatcherService, context fencing
- `apps/worker/src/main.mjs` — agrega curator timer + runCuratorSafe()
