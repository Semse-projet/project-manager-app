# Auditoría: SEMSE Forge Agent Harness — estado real de implementación

**Fecha:** 2026-08-10
**Alcance:** `docs/specs/agents/SEMSE_FORGE_AGENT_HARNESS.spec.md` (spec principal) + 11 specs de proveedores bajo `docs/specs/forge/` + `docs/specs/fsm/forge-run-lifecycle.spec.md`.
**Método:** lectura completa de cada spec, lectura del código correspondiente en `packages/forge/src/` y `packages/agents/src/runtime.ts`, verificación de que cada archivo listado en `related_files`/`related_tests` existe y contiene lógica real (no stub), verificación del estado de PR de cada rama `agent/forge-*` vía `gh`, y ejecución de la suite de tests de Forge (`node --test tests/unit/forge-*.test.mjs`, 137/137 pasando).
**Naturaleza:** auditoría de solo lectura. No se cambió ningún archivo de código como parte de este trabajo.

---

## 1. Veredicto general

El **registro de 14 agentes, el motor de políticas, la máquina de estados (FSM), y los 12 sub-sistemas de "proveedor"** (patch-planner, patch-writer, sandbox, tool-adapter, verification, security-review, deployment, rollback, observation, pr-package, más el SDD y el ciclo de vida FSM) están **genuinamente implementados**: 13 PRs mergeadas (#331–#351, 17–19 jul 2026), archivos reales de 100–330 líneas cada uno, con tests reales (18–67 aserciones por archivo) que efectivamente pasan. Esto contrasta con el patrón de ramas abandonadas encontrado en otras partes del repo esta sesión — acá el trabajo sí llegó a `main`.

Sin embargo, el **harness "gobernado y auditable"** que describe el spec principal — el que coordina agentes con permisos estrictos, leases sobre recursos sensibles, aprobaciones duales reales, y ejecución efectiva — **todavía no existe como tal**. Lo que existe hoy es un simulador de políticas y planificación (`mode: "dry-run"` en todos los proveedores, por diseño explícito de cada spec individual, no un error), conectado a un runtime real (`packages/agents`), pero sin capacidad de ejecución en vivo, sin scheduler, sin leases, y con varios mecanismos de seguridad declarados-pero-no-aplicados.

---

## 2. Parte A — Spec principal (`SEMSE_FORGE_AGENT_HARNESS.spec.md`)

| # | Requisito del spec | Estado | Evidencia |
|---|---|---|---|
| §4 | Registro de 14 roles, sin IDs duplicados | ✅ **IMPLEMENTADO** | `packages/forge/src/types.ts:23-38` (`forgeAgentRoles`), `registry.ts:5-244` (`forgeAgentRegistry`). Tipo `Record<ForgeAgentRole, ...>` hace los duplicados un error de compilación. |
| §2 | 5 planas (control/ejecución/política/evidencia/conocimiento) | ⚠️ **PARCIAL** | Control y política reales. Ejecución = solo simuladores dry-run. Evidencia = eventos en memoria, sin store persistente. Conocimiento = no existe como capa consultable (solo `creator.ts` toca conocimiento de creador de forma acotada). |
| §3 | Principio de no herencia (intersección de 5 scopes) | ⚠️ **PARCIAL** | `policy.ts:86-155` intersecta spec-scope ∩ agent-manifest ∩ task-scope de verdad. "Environment policy" es solo el guard de branch `main`/`master`. "Aprobaciones humanas" se calcula pero no bloquea: nada re-chequea "¿ya se aprobó?" antes de dejar avanzar una acción. |
| §5 | Manifests versionados, run conserva versión usada | ⚠️ **PARCIAL** | Cada manifest tiene `version: "1.0.0"`, pero `ForgeRun` no tiene campo que fije qué versión de manifest se usó en cada tarea — se lee en vivo (`getForgeAgentManifest(role)`), nunca se congela. |
| §6 | Tool gateway (6 etapas: filtro contexto → política → aprobación → ejecución → filtro salida → auditoría) | ⚠️ **PARCIAL / MAYORMENTE STUB** | Solo existen 2 de 6 etapas (política, y una versión "planning" de ejecución). No hay filtro de contexto, ni etapa de aprobación separada, ni filtro de salida, ni store de auditoría durable — solo un array `auditTags: string[]` que nunca se persiste. `LiveToolAdapter.plan()` tira excepción incondicional (`tool-adapter.ts:199-203`). |
| §7 | Firewall de contexto (secretos como handles, digest de spec) | ❌ **NO EXISTE** | Cero código de ensamblado de contexto/prompt en todo el paquete — consistente con que no hay adaptador de modelo. `specDigest` solo existe dentro de `creator.ts`, no como mecanismo general. |
| §8 | Scheduler (DAG, prioridad, concurrencia, reintentos, backoff, cancelación, pausa-por-aprobación, timeout, leases) | ❌ **NO EXISTE** | `ForgeTaskPacket.dependencies` es un array que nadie lee ni valida. No hay clase scheduler, ni prioridad, ni límite de concurrencia, ni retry/backoff, ni cancelación, ni timeout en ningún lado del paquete. |
| §9 | Leases sobre recursos sensibles (`schema.prisma`, migraciones, lockfiles, `railway.json`, Dockerfiles, auth, pagos, policy engine) | ❌ **NO EXISTE COMO LEASE** | Son listas de patrones de string duplicadas de forma independiente en `patch-planner.ts:42-49`, `deployment-provider.ts:17-24`, `rollback-provider.ts:17-21`, `security-review-provider.ts:32-111` — ninguna coordinada, ninguna adquiere/libera un lock real. Dos tareas podrían tocar `schema.prisma` a la vez sin que nada lo detecte. |
| §10 | Envelope de mensajes (messageId, correlationId, runId, taskId, from, to, type, specDigest, risk, payload, createdAt) | ❌ **NO EXISTE** | Cero coincidencias de `messageId`/`correlationId`/`specDigest` fuera de `creator.ts`. `ForgeEvent` solo tiene `id, type, runId, timestamp, actor, detail`. No hay bus de mensajes entre agentes — el orquestador muta el estado del run directamente. |
| §11 | 4 tipos de aprobación + "un agente nunca aprueba su propia acción" | ⚠️ **PARCIAL, con contradicción directa** | Los 4 modos existen y se usan bien (`policy.ts:75-81`). Pero `dual_control` se puede aprobar con **un solo** llamado de un solo `actor` — nada exige un segundo actor distinto, nada impide que el mismo actor apruebe dos veces. Tampoco hay ningún chequeo que impida que un agente apruebe su propia acción. |
| §12 | QA Verifier con workspace de solo lectura salvo tests/reportes | ⚠️ **PARCIAL** | El manifest declara bien el scope (`tests/**`, `docs/reportes/**`, `.semse-sdd/**`) y excluye `code.write`. Pero no existe un sandbox de filesystem real que lo haga cumplir en ejecución — no hace falta hoy porque no hay ejecución en vivo. La matriz de verificación (`ForgeVerificationItem`) le faltan los campos `duration`, `error`, `artifact` que pide el spec. |
| §13 | Procedimiento de recuperación ante fallo (6 pasos) | ❌ **STUB / NO EXISTE** | La FSM puede llegar a `blocked`/`rolled_back`, pero ninguno de los 6 pasos numerados (detener descendientes, revocar leases, clasificar retryable, etc.) está codificado como lógica distinta. |
| §14 | Requisitos de seguridad (shell restringido, sin secretos en logs, checksums, licencias) | ⚠️ **PARCIAL, el mejor cubierto** | Shell: real y cuidadoso (`sandbox.ts` bloquea metacaracteres y un denylist de programas). Pero es denylist + scope-check, no allowlist central. `networkScopes` está declarado pero **nunca se lee ni se aplica en ningún lado**. Sanitización de prompts: no existe (no hay prompts). Checksums: solo para blueprints de creator, task packets no tienen digest. Revisión de licencias/dependencias: no existe implementación pese a que el manifest de `security-reviewer` lista la acción `dependency.audit`. |
| §15 | Integración con `packages/agents` (Forge crea task packet → `packages/agents` ejecuta → Forge recibe resultado) | ❌ **INVERTIDA respecto al spec** | `packages/forge/package.json` no depende de `@semse/agents` en absoluto. En la realidad es al revés: `packages/agents/src/runtime.ts:480-635` es quien importa y llama a los proveedores de Forge (todos hardcodeados en `{ mode: "dry-run" }`). `ForgeRun.agentRunIds` existe como campo pero nunca se popula — campo muerto. |
| §16 | Criterios de aceptación (8 puntos) | Mezcla — ver detalle abajo | Ver sección 2.1 |

### 2.1 — Detalle de §16 (criterios de aceptación)

- Registro completo sin IDs duplicados: ✅ implementado.
- Tools válidas: ⚠️ solo validado contra manifest en modo planificación, nunca contra una invocación real.
- Scopes no vacíos: ⚠️ cierto hoy por construcción, pero no hay ningún assert que lo garantice como invariante.
- Lifecycle total: ⚠️ la FSM cubre todos los estados, pero el procedimiento de recuperación que dispara muchas de esas transiciones no está codificado.
- Policy deny/approval/allow probado: ✅ implementado y testeado.
- Eventos auditables: ⚠️ existen en memoria, nada se persiste fuera del proceso.
- Creator Mentor separado de builders: ✅ implementado (scope distinto, sin `code.write`).
- Supervisor sin autoridad de merge/deploy directo: ⚠️ cierto hoy solo porque el manifest de `forge-supervisor` no lista esas acciones — no hay una restricción estructural aparte, es dato, no arquitectura.

---

## 3. Parte B — Los 12 specs de proveedores/lifecycle

**Hallazgo transversal:** los 13 branches `agent/forge-*` **están todas mergeadas** (#331–#351), a diferencia del patrón de trabajo abandonado visto en otras partes del repo. Cada proveedor tiene lógica real (100–330 líneas), tests reales, y está efectivamente invocado desde `packages/agents/src/runtime.ts`.

**Caveat que aplica a 9 de los 12:** cada proveedor solo opera en `mode: "dry-run"`. La clase `Live*Provider` correspondiente tira `throw new Error("Live X is not implemented in this phase. Use mode 'dry-run'.")`. **Esto no es una violación del spec** — cada spec individual escribe explícitamente que el modo "live" queda para "una fase futura". Pero implica que Forge hoy no puede escribir archivos, correr comandos reales, abrir un PR real, ni deployar nada.

| Spec | Estado | PR | Notas |
|---|---|---|---|
| DEPLOYMENT_PROVIDER | ✅ Implementado (dry-run) | #344 MERGED | `deployment-provider.ts` (128 líneas), 20 aserciones de test. |
| OBSERVATION_PROVIDER | ✅ Implementado | #349 MERGED | `observation-provider.ts` (111 líneas), 27 aserciones. Maneja `deployed→observing→closed`. |
| PATCH_PLANNER | ✅ Implementado | #335 MERGED | `patch-planner.ts` (152 líneas), 36 aserciones. |
| PATCH_WRITER | ✅ Implementado (dry-run, tal cual pide el spec) | #338 MERGED | `patch-writer.ts` (123 líneas) — nunca toca `node:fs`, coherente con el spec. |
| PR_PACKAGE_PROVIDER | ✅ Implementado | #340 MERGED | `pr-package.ts` (231 líneas). Sin llamadas reales a la API de GitHub, según el spec. |
| ROLLBACK_PROVIDER | ✅ Implementado | #346 MERGED | `rollback-provider.ts` (124 líneas), 23 aserciones. |
| RUNTIME_INTEGRATION | ✅ Implementado | #332 MERGED | Los 8 endpoints documentados existen en `forge.controller.ts:74-194`, más uno adicional (`tasks/:taskId/complete`) no documentado pero aditivo. `forge.service.ts` (675 líneas) re-deriva política del lado servidor en vez de confiar en el caller (fix documentado inline). |
| SANDBOX_PROVIDER | ✅ Implementado (dry-run) | #334 MERGED | `sandbox.ts` (206 líneas), 37 aserciones, sin `node:child_process`. |
| SDD | ⚠️ **Parcial** | — | Los criterios de aceptación 1-7 se cumplen. Pero la sección 11 (presupuestos de tokens/costo, límites de iteración/concurrencia) y sección 12 (leases de escritura, correlation IDs anti-duplicados) **no tienen ninguna implementación** — 0 coincidencias al buscar `budget\|tokenLimit\|costLimit\|maxConcurrency\|lease`. |
| SECURITY_REVIEW_PROVIDER | ✅ Implementado | #351 MERGED | `security-review-provider.ts` (241 líneas). PR #362 posterior arregló un bug real (orden de hallazgos) — evidencia de iteración genuina, no un stub que nunca se tocó de nuevo. |
| TOOL_ADAPTER | ✅ Implementado | #336 MERGED | `tool-adapter.ts` (209 líneas), 31 aserciones. |
| VERIFICATION_PROVIDER | ✅ Implementado | #339 MERGED | `verification-provider.ts` (146 líneas), 18 aserciones. Su fallo fuerza `deny` de política. |
| forge-run-lifecycle (FSM) | ✅ Implementado | — | `state-machine.ts`, tabla de transición exhaustiva de 16 estados, invocada en cada `ForgeHarness.transition()`, no se puede saltear. |

---

## 4. Cobertura de tests

`tests/unit/forge-harness.test.mjs`: 8 casos reales (`node:test`), no solo humo — cubre deny en escritura directa a `main`, allow en trabajo de bajo riesgo, `dual_control` en migración crítica, transición inválida de FSM (`assert.throws`), idempotencia de aprobación pendiente, persistencia real de approve/reject (re-fetch explícito), reject sin aprobación pendiente, y el pipeline creator blueprint→task-packet. **No cubre**: `tool-adapter.ts`, `sandbox.ts`, `patch-planner.ts`, `patch-writer.ts`, `verification-provider.ts`, `deployment-provider.ts`, `rollback-provider.ts`, `observation-provider.ts`, `security-review-provider.ts` — dos tercios de los archivos fuente del paquete no tienen cobertura en este archivo (sí la tienen en sus propios `forge-<nombre>.test.mjs` individuales, mencionados en la Parte B). Nota técnica: `forge-harness.test.mjs` importa desde `packages/forge/dist/index.js` (build compilado), no desde `src` — un build desactualizado podría enmascarar cambios de código fuente.

---

## 5. Registro de riesgos consolidado (para priorizar la fase quirúrgica)

Ordenado por lo que más compromete la promesa central del spec ("arnés... gobernado y auditable... sin otorgarles autoridad ilimitada"):

1. **Sin ejecución en vivo** — bloqueante estructural para que Forge haga algo autónomo de verdad. Alcance: 9 proveedores.
2. **Sin leases reales** — dos tareas podrían tocar `schema.prisma`/migraciones a la vez sin coordinación. Riesgo directo de corrupción de estado si algún día se activa modo live.
3. **`dual_control` no es doble control** — un solo actor puede aprobar una acción crítica él solo. Contradice directamente §11 y el criterio de aceptación de §16.
4. **Sin prevención de auto-aprobación** — un agente podría aprobar su propia acción, nada lo impide en código.
5. **Sin scheduler/DAG** — las dependencias declaradas entre tareas no se validan, así que el orden de ejecución no está garantizado.
6. **`networkScopes` declarado pero nunca aplicado** — falso sentido de seguridad si alguien asume que limita tráfico de red.
7. **Sin auditoría persistente** — los eventos viven solo en memoria del proceso; se pierden al reiniciar.
8. **Integración con `packages/agents` invertida** respecto al spec — no es necesariamente un error de diseño, pero el documento normativo describe una arquitectura distinta a la real. Vale la pena decidir cuál de las dos es la fuente de verdad y actualizar la que quede desalineada.
9. **`SEMSE_FORGE_SDD.spec.md` §11/§12** (presupuestos, concurrencia) — requisitos "MUST" del propio spec sin ninguna implementación.

---

## 6. Nota metodológica

Esta auditoría se hizo con dos agentes de exploración en paralelo (uno para el spec principal, otro para los 12 specs de proveedores) para evitar cargar ~30 archivos de spec y código directamente en el contexto principal de la sesión. Ambos reportes se cruzaron manualmente para esta síntesis (por ejemplo, la contradicción de la sección 15 surgió de comparar el hallazgo de "sin dependencia hacia `@semse/agents`" del primer agente contra el hallazgo de "`packages/agents/runtime.ts` sí llama a Forge" del segundo). No se propuso ni implementó ningún fix en este documento — es exclusivamente diagnóstico, a pedido explícito del usuario, para servir de base a un análisis y plan de trabajo posterior.
