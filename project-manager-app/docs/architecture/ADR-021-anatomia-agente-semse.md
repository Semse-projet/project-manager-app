# ADR-021 — Anatomía del Agente SEMSE: mapeo del canon agéntico a la arquitectura existente

**Estado:** PROPOSED
**Fecha:** 2026-07-02
**Contexto de origen:** análisis del canon "cómo funciona por dentro un agente de IA" (agent loop de referencia: Claude Code) aterrizado contra `project-manager-app`.
**Ubicación sugerida en repo:** `project-manager-app/docs/architecture/`
**Relacionado con:** `docs/AGENTIC_HARNESS.md`, `packages/agents/README.md`, `docs/SDD_GOVERNANCE.md`

---

## 1. Contexto

El canon actual de agentes de IA define cuatro componentes irreducibles:

| Componente canónico | Definición | Equivalente SEMSE | Estado |
|---|---|---|---|
| **Cerebro (LLM)** | Modelo que interpreta el objetivo, planifica y decide | Multi-provider LLM Router (OpenAI, Anthropic, DeepSeek, Kimi, Ollama) | ✅ Implementado |
| **Herramientas** | Acciones reales sobre el mundo (archivos, APIs, comandos) | `agentToolRegistry` en `packages/agents/src/governance.ts` + `packages/tools` | ✅ Implementado, gobernado |
| **Loop** | observar → pensar → actuar → verificar → iterar | `AGENTIC_HARNESS.md` (loop de sesión) + `executeGovernedAgentRun` (loop de run) | ⚠️ Parcial: falta verificación post-acción |
| **Memoria** | Contexto persistente entre sesiones y runs | Harness (estado de plan), Prometeo/RAG (conocimiento), `AutonomyResumeState` (estado de run) | ⚠️ Parcial: falta memoria episódica de decisiones |

Adicionalmente, la industria (Cherny, mayo–junio 2026) señala la siguiente fase: **loops permanentes** — agentes de fondo que corren de forma continua sin esperar órdenes, con el riesgo asociado de consumo de cómputo sin criterio de parada.

## 2. Decisión

Adoptar formalmente el modelo de cuatro componentes como vocabulario arquitectónico de SEMSE, y cerrar los tres gaps identificados mediante dos specs derivados de este ADR:

1. **GAP-1 — Verificación autónoma post-acción** → `SPEC-AGT-001` (Verification Loop en `packages/agents`).
2. **GAP-2 — Subagentes con contexto aislado y tipado** → se resuelve dentro de `SPEC-AGT-001` formalizando `delegate.ts` con perfiles `explore` (read-only) y `general` (read-write), límite de 3–4 delegaciones concurrentes.
3. **GAP-3 — Loops permanentes con criterio de parada** → `SPEC-AUT-001` (Permanent Loops en `apps/autonomy-server`).

## 3. Principios que gobiernan la decisión

**P1 — El loop cierra o no existe.** Ninguna acción de escritura de un agente se considera completada sin un paso de validación ejecutado y registrado en el audit trail. `packages/autonomy/src/validator.ts` es la primitiva; el runtime gobernado la orquesta.

**P2 — Presupuesto antes que autonomía.** Todo run y todo loop declara antes de arrancar: máximo de iteraciones, presupuesto de tokens y criterio de éxito medible. Sin los tres, el policy engine devuelve `deny`. Esto responde directamente al riesgo documentado de loops que optimizan proxies indefinidamente.

**P3 — Contexto aislado por delegación.** Un subagente recibe solo el contexto filtrado por su manifest (`allowedContextSources`, `allowedInputKeys` — ya existente), nunca el contexto completo del agente padre. Al terminar devuelve un resultado estructurado y su contexto muere.

**P4 — Humano en el merge.** Los loops permanentes pueden proponer (branch + PR vía `packages/autonomy/src/git.ts`), nunca mergear. `require_approval` es el techo de autonomía para cambios en `main`.

**P5 — Modelo por costo de paso.** El router asigna modelo según el tipo de paso: razonamiento/planificación → modelo frontier; pasos mecánicos (grep, formateo, extracción simple) → modelo económico. Regla operativa, no aspiracional: se configura en `defaultModel` por manifest.

## 4. Mapeo detallado componente → código

### 4.1 Cerebro
- Router multi-proveedor ya operativo. Acción derivada: añadir campo `modelTier: "frontier" | "standard" | "economy"` al `RuntimeAgentManifest` para que P5 sea declarativo.

### 4.2 Herramientas
- `agentToolRegistry` + `action-policy.ts` ya implementan permisos mínimos, risk scoring y `allow | deny | require_approval`. Es el equivalente funcional de hooks + permission modes de Claude Code. Sin cambios estructurales; solo se añaden las tools nuevas que requiera el verification loop (`verify.run_tests`, `verify.lint`, `verify.typecheck`).

### 4.3 Loop
- **Loop de sesión** (harness): protocolo de arranque, selección de bloque PENDING, registro de progreso. Se mantiene.
- **Loop de run** (`executeGovernedAgentRun`): hoy es lineal — policy → handler → risk → approvals → output. `SPEC-AGT-001` lo convierte en iterativo: policy → handler → **verify → (fix → verify)\*** → risk → approvals → output.

### 4.4 Memoria
- **Gap de memoria episódica:** hoy `AutonomyRunLogEntry[]` registra qué pasó dentro de un run, pero no existe un almacén consultable de "qué decidió el agente X sobre el módulo Y y por qué" entre runs. Acción derivada (fase posterior, no bloquea specs 1–2): tabla `agent_decisions` en `packages/db` con `(runId, agentType, target, decision, rationale, outcome)`, indexada para retrieval vía Prometeo. Esto le da a los loops permanentes memoria de sus propios hallazgos y evita re-proponer lo ya rechazado.

## 5. Encaje con el ecosistema

- **Prometeo:** el contrato `ParseEvent[]` (parser intercambiable por LLM) ya sigue el patrón tool-swappable; los agentes gobernados consumen Prometeo como `AgentContextSource` adicional (`knowledge.rag`).
- **OMEGA:** los KPIs de loops permanentes (propuestas generadas, aceptadas, rechazadas, tokens consumidos por propuesta aceptada) alimentan el dashboard OMEGA como métricas de gobernanza (mapea a la fila "RLHF y ética algorítmica" y "Marco de Platón" de la Matriz de Conocimientos, F1=I/A).
- **Matriz F0–F5:** este ADR opera en la celda "MCA / Cognitivo (razonamiento/planning)" y "IA/ML / RL y agentes" — nivel requerido F1=I, que es exactamente el alcance de estos specs: intermedio, sin RL formal todavía.

## 6. Consecuencias

**Positivas:** el runtime pasa de "ejecutor gobernado" a "agente completo" según el canon; los loops permanentes nacen con freno económico incorporado; la memoria episódica reduce trabajo repetido entre sesiones de agentes.

**Negativas / costos:** cada run de escritura se encarece (mínimo una pasada de verificación); los approvals humanos son el cuello de botella deliberado de los loops permanentes; la tabla `agent_decisions` añade una migración Prisma.

**Riesgos aceptados:** un verification loop con validadores débiles da falsa confianza — mitigación: los validadores son los mismos comandos de CI (`test:unit`, `build`, lint), nunca checks ad-hoc del propio agente.

## 7. Alternativas descartadas

- **Adoptar Claude Agent SDK como runtime:** descartado por ahora; `packages/agents` ya implementa gobernanza más estricta que el SDK (risk scoring + approvals persistidos) y el router multi-proveedor es requisito de negocio. Se reevalúa si el costo de mantener el loop propio supera el beneficio.
- **Loops permanentes con auto-merge bajo clasificador de seguridad:** descartado; contradice P4 y el propio proveedor advierte que el clasificador "no elimina el riesgo, lo reduce".

## 8. Specs derivados

- `SPEC-AGT-001` — Verification Loop (adjunto).
- `SPEC-AUT-001` — Permanent Loops v1 (adjunto).
- Registrar ambos en `docs/SPEC_INDEX.md` y este ADR en el índice de `docs/architecture/`.
