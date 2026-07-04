---
id: aut-001-permanent-loops
title: "SPEC-AUT-001 — Permanent Loops v1 en apps/autonomy-server"
type: spec
domain: autonomy
status: "DRAFT"
owner: semse-core
risk: medium
related_files:
  - apps/autonomy-server/src/server.mjs
  - packages/autonomy
related_tests: []
related_endpoints: []
related_events: []
related_agents: []
---

# SPEC-AUT-001 — Permanent Loops v1 en `apps/autonomy-server`

**Estado:** DRAFT
**Deriva de:** ADR-021 (GAP-3)
**Módulos afectados:** `apps/autonomy-server/src/server.mjs`, `packages/autonomy`, `packages/agents` (consume SPEC-AGT-001), `apps/worker` (scheduling BullMQ), `packages/db` (persistencia de hallazgos)
**Depende de:** SPEC-AGT-001 implementado (los loops usan el verification loop para toda propuesta de cambio)

---

## 1. Objetivo

Poner en producción los **dos primeros agentes de fondo** del ecosistema: procesos que corren de forma recurrente sin orden humana, detectan problemas, y **proponen** (branch + PR vía `packages/autonomy/src/git.ts`) sin mergear jamás (P4 del ADR). El diseño ataca de frente el riesgo canónico de los loops permanentes: consumo indefinido de cómputo optimizando proxies sin criterio de éxito real.

## 2. Modelo común: `PermanentLoopDefinition`

```ts
export interface PermanentLoopDefinition {
  id: string;                          // "loop.dedup-abstractions"
  agentType: RuntimeAgentRole;         // rol registrado en packages/agents
  schedule: string;                    // cron (BullMQ repeatable job)
  scope: string[];                     // globs de paths que puede leer
  budgetPerCycle: {
    maxTokens: number;
    maxProposals: number;              // PRs máx por ciclo
    timeoutMs: number;
  };
  stopCriteria: {
    maxOpenProposals: number;          // si hay N PRs suyas abiertas sin revisar → SKIP ciclo
    cooldownAfterRejections: number;   // N rechazos seguidos sobre un target → target en blacklist 30 días
    minConfidence: number;             // hallazgos bajo umbral no generan propuesta, solo registro
  };
  successMetric: string;               // métrica OMEGA que justifica su existencia
}
```

**Reglas duras del scheduler** (en `apps/worker`, cola BullMQ dedicada `autonomy:loops`):

1. **Backpressure humano:** si `openProposals ≥ maxOpenProposals`, el ciclo se salta y se audita como `loop.skipped.backpressure`. Un loop que nadie revisa no acumula PRs — se apaga solo.
2. **Memoria de rechazos:** todo hallazgo propuesto y rechazado se persiste (tabla `agent_decisions`, ADR §4.4); el loop consulta antes de proponer y no re-propone lo rechazado. Sin esto, el loop molesta en bucle.
3. **Kill switch:** flag `AUTONOMY_LOOPS_ENABLED` por entorno + endpoint admin `POST /loops/:id/pause` en autonomy-server.
4. **Presupuesto mensual global:** suma de tokens de todos los loops con techo mensual; al 80% se degradan a `economy` tier del router; al 100% se pausan y alertan.

## 3. Loop 1 — `loop.dedup-abstractions` (Detector de abstracciones duplicadas)

**Por qué primero:** es el caso citado por el propio creador de Claude Code como loop de producción real, y el monorepo SEMSE es terreno fértil — ya existen pares `.ts`/`.js` compilados conviviendo en `packages/agents/src/`, y 9 packages con riesgo natural de utilidades repetidas entre `shared`, `tools` y `agents`.

**Ciclo:**

```
1. explore (delegado read-only, SPEC-AGT-001 §4):
   inventario de exports por package (grep de export + firmas)
2. análisis: candidatos a duplicación por
   a. similitud de firma (nombre normalizado + aridad + tipos)
   b. similitud semántica vía embeddings (Prometeo — misma
      infraestructura BM25+embeddings de la Matriz, fila Datos/Búsqueda)
3. filtro: confidence < minConfidence → solo registro en agent_decisions
4. para cada candidato sobre umbral (máx maxProposals):
   propuesta = consolidar en packages/shared + reexport deprecado
   → verification loop completo (typecheck + build + unit tests
     de TODOS los packages afectados)
   → si verified: branch + PR con evidencia (ambas implementaciones,
     call sites, diff)
   → si exhausted: no abre PR; registra hallazgo como "manual review"
5. reporte de ciclo → OMEGA
```

**Configuración inicial:** schedule semanal (`0 6 * * 1`), `maxProposals: 2`, `maxOpenProposals: 3`, `minConfidence: 0.8`, scope: `project-manager-app/packages/**` (excluye `apps/` en v1 — menor blast radius).

**successMetric:** `dedup.accepted_rate` (PRs mergeadas / propuestas). Si tras 8 semanas < 30%, el loop se recalibra o se apaga — criterio de existencia, no solo de parada.

## 4. Loop 2 — `loop.spec-drift` (Auditor de drift entre specs y código)

**Por qué segundo:** SEMSE es SDD (spec-driven, `docs/SDD_GOVERNANCE.md`, `SPEC_INDEX.md`, `PROTOOLS_MASTER_PLAN.md`). El modo de fallo natural del SDD es el drift silencioso: el código avanza y el spec miente. Un auditor de drift protege el activo que hace funcionar al harness completo — incluida la capacidad de otros agentes de arrancar sesión con contexto confiable (`AGENTIC_HARNESS.md` paso 5: "leer el spec del módulo").

**Ciclo:**

```
1. explore: por cada spec en SPEC_INDEX.md, extraer afirmaciones
   verificables (rutas que deben existir, exports prometidos,
   estados de bloques DONE/PENDING, comandos documentados)
2. verificación mecánica (sin LLM, costo ~0):
   a. paths referenciados existen
   b. exports/contratos mencionados existen en el código
   c. comandos documentados existen en package.json
   d. bloques marcados DONE cuyos archivos no existen → drift crítico
3. verificación semántica (LLM economy tier, solo sobre specs
   con cambios de código en su scope desde el último ciclo —
   git log delimita, no se re-lee todo el repo cada vez):
   ¿describe el spec el comportamiento actual?
4. hallazgos:
   - drift mecánico → propuesta de corrección del doc
     (verification: el doc corregido no rompe links ni el índice)
   - drift semántico → NO auto-corrige; abre issue/approval con
     evidencia (el humano decide si el error está en el spec
     o en el código — esa decisión no se delega)
5. reporte → OMEGA + actualización de un docs/reportes/spec-health.md
```

**Configuración inicial:** schedule 2×/semana (`0 6 * * 2,5`), `maxProposals: 3`, `minConfidence: 0.9` para auto-propuestas de docs, scope: `project-manager-app/docs/**` + specs referenciados.

**successMetric:** `spec.drift_detected_before_human` y `spec.health_score` (specs sin drift / total). El health score es además input directo del protocolo de arranque del harness: un agente que va a iniciar un bloque puede consultar si el spec que va a leer está `healthy` o `drifted`.

## 5. Sinergia entre ambos loops

El Loop 2 audita también las propuestas del Loop 1: cuando `dedup-abstractions` consolida una utilidad, `spec-drift` detecta en el siguiente ciclo los docs que referencian la ruta vieja. Los loops se corrigen entre sí sin coordinarse — coordinación por el repo, no por mensajería (mismo principio del harness: el estado vive en archivos).

## 6. Plan de implementación (bloques)

| Bloque | Contenido | Depende de |
|---|---|---|
| AUT-001-A | `PermanentLoopDefinition` + scheduler BullMQ + kill switch + backpressure | SPEC-AGT-001 completo |
| AUT-001-B | Tabla `agent_decisions` (Prisma) + consulta de rechazos previos | A |
| AUT-001-C | Loop 1 dedup (fase mecánica primero, embeddings después) | A, B |
| AUT-001-D | Loop 2 spec-drift (fase mecánica primero — entrega valor sin LLM) | A, B |
| AUT-001-E | Panel OMEGA: métricas de loops + presupuesto consumido + pause/resume | C o D |

Orden recomendado de salida a producción: **D mecánico → C mecánico → capas semánticas**. La fase mecánica de ambos loops no consume tokens y valida toda la infraestructura (scheduler, backpressure, PRs, approvals) con costo cero.

## 7. Criterios de aceptación

1. Con `maxOpenProposals` alcanzado, el ciclo se salta y queda auditado — verificable forzando 3 PRs abiertas en un repo de prueba.
2. Un hallazgo rechazado dos veces no vuelve a proponerse dentro del cooldown.
3. Toda PR generada incluye el `VerificationReport` en el body (evidencia de que pasó typecheck/build/tests).
4. El kill switch detiene un ciclo en curso en < 30s.
5. Cero merges automáticos: no existe ruta de código en los loops que invoque merge — verificable por ausencia de la capability en sus manifests.
