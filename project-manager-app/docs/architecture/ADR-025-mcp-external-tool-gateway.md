# ADR-025 — MCP External Tool Gateway: ¿reabrir la orquestación de herramientas externas?

**Estado:** PROPOSED
**Fecha:** 2026-08-04
**Contexto de origen:** síntesis de producto "Prometeo OS"
(`docs/vision/VISION_PROMETEO_OS_2026.md`), sesión de voz de Samuel donde se
describe a Prometeo orquestando eventualmente herramientas externas
(GitHub, Vercel, Railway, Docker, sandboxes) vía Model Context Protocol
(MCP) para dominios fuera de construcción.
**Relacionado con:**
- `docs/architecture/ADR-023-sense-agentic-architecture-v1.md` (`ACCEPTED`) — sección "Programa transversal — Consolidación Cognitiva" en `ROADMAP.md`, donde `SPEC-INT-001` (CLI Agent Adapter + MCP Gateway externo) figura **retirado**.
- `docs/architecture/ADR-024-browser-agent-obscura.md` §12 ("MCP Gateway") — `PROPOSED`, sin evidencia de implementación.
- `docs/specs/prometeo/tool-registry-governance.spec.md` (`APPROVED`) — el mecanismo de policy/audit/approval sobre herramientas *internas* que ya existe y que esta ADR evalúa reutilizar para herramientas *externas*.
- `packages/agents/src/developer-runtime.ts` — el reemplazo real de `SPEC-INT-001` que sí se construyó.

---

## 0. Por qué esto es reabrir una decisión, no proponer algo nuevo

`SPEC-INT-001` (CLI Agent Adapter + MCP Gateway externo) fue evaluado y
retirado antes de esta ADR — no por falta de interés, sino porque
`packages/agents/src/developer-runtime.ts` cubrió la necesidad concreta que
lo motivaba sin requerir un gateway MCP externo genérico. Esa decisión
sigue vigente hoy: no hay código nuevo que la contradiga. Lo único que
cambió es que la síntesis de producto "Prometeo OS" describe un caso de uso
más amplio (orquestar herramientas externas arbitrarias desde el
orquestador conversacional, no solo un CLI agent adapter puntual). Por eso
este documento no es un spec de implementación: es una ADR que decide
**si** ese caso de uso más amplio justifica revertir el retiro, y **cómo**,
antes de que se escriba una sola línea de código.

## 1. Contexto

Prometeo Operativo (`docs/specs/agents/prometeo-core.spec.md`, `DRAFT`) hoy
orquesta únicamente capacidades internas de SEMSE a través del Tool
Registry gobernado (`docs/specs/prometeo/tool-registry-governance.spec.md`,
`APPROVED`): permisos y scopes por tool, `approvalPolicy`
(`none`/`confirm`/`human_required`), auditoría por invocación
(`PrometeoToolInvocationAudit`). Cero herramientas externas están
conectadas — cero GitHub, Vercel, Railway, Docker o sandboxes.

`ADR-024` §12 ya nombra un "MCP Gateway" como componente de una arquitectura
de Browser Agent más amplia (Obscura), con el objetivo declarado de
"controlar los scopes, evitar el confused deputy, y garantizar auditoría
inmutable" — pero el grep contra `browser-agent.service.ts` confirma cero
coincidencias de `mcp`/`sandbox`/`cdp`: es diseño, no código.

La pregunta que esta ADR responde no es "¿MCP sirve?" — es **¿el
mecanismo de gobernanza que ya construimos para tools internas (F2) es
suficiente, con extensión, para tools externas, o un MCP Gateway externo
necesita su propio modelo de riesgo separado?**

## 2. Decisión

**Esta ADR no aprueba construir nada todavía.** Queda en `PROPOSED` como
marcador de decisión futura. Mientras no pase a `ACCEPTED`:

- Prometeo Operativo no gana herramientas externas nuevas.
- `docs/specs/agents/prometeo-core.spec.md` declara explícitamente esta
  ADR como bloqueante en su sección de fuera de alcance (ver
  `ROADMAP.md`, programa transversal "Prometeo OS").
- Ningún spec de implementación de MCP Gateway se escribe hasta que esta
  ADR tenga una decisión explícita registrada aquí.

### 2.1 Opciones evaluadas (para cuando se decida)

**Opción A — Extender el Tool Registry existente (F2) a tools externas.**
Cada herramienta MCP externa se registra como una tool más en el mismo
registro gobernado, con su propio `approvalPolicy` y scopes. Reutiliza
`evaluatePrometeoToolPolicy`, `PrometeoProposedAction` y el flujo de
aprobación humana que F2 ya probó en producción para `payments.propose_release`.
Riesgo principal: el modelo de riesgo de F2 se diseñó para *dominio SEMSE*
(payments, evidence, agro); una tool externa arbitraria (ej.: ejecutar un
comando en un sandbox de Docker) tiene una superficie de "confused deputy"
distinta — quién autoriza qué scope, y contra qué recurso externo, no
tiene precedente en F2.

**Opción B — Gateway MCP separado, con su propio Policy/Approval Engine.**
Como propone `ADR-024` §12 para Obscura: sesiones efímeras, control de
scopes por conexión MCP, auditoría inmutable propia. Más aislado del
dominio SEMSE, pero duplica infraestructura de gobernanza que F2 ya
resolvió (dos lugares donde se audita/aprueba, en vez de uno).

**Opción C — No construirlo ahora; mantener el retiro de `SPEC-INT-001`.**
El caso de uso de "Prometeo OS" hoy es una descripción de producto, no una
demanda de usuario verificada. Se documenta como norte y se revisita
cuando haya una necesidad concreta (ej.: un flujo real donde un usuario
necesite que Prometeo dispare un deploy en Vercel).

Ninguna opción se selecciona en esta ADR. Se deja para revisión humana
explícita de Samuel, con las tres opciones sobre la mesa.

## 3. Superficie de riesgo (aplica a las opciones A y B por igual)

- **Scopes:** una conexión MCP externa puede exponer más capacidad de la
  que el usuario cree estar autorizando (ej.: "conectar GitHub" podría
  implicar leer/escribir en todos los repos accesibles por el token, no
  solo el proyecto en cuestión).
- **Confused deputy:** Prometeo actuando con más privilegio del que el
  usuario que hizo la solicitud realmente tiene, porque el servidor MCP
  usa una credencial de servicio compartida.
- **Auditoría inmutable:** cada llamada a una tool externa debe dejar el
  mismo tipo de `auditRef` que ya exige F2 para tools internas — sin esto,
  no se cumple el gate de "Seguridad" de `docs/SDD_GOVERNANCE.md` §7
  ("no se exponen secretos... en logs o evidencia").
- **Egreso de red:** cualquier gateway MCP externo es, de hecho, un punto
  de egreso de red nuevo — el mismo problema que `ADR-024` §7 ya identificó
  parcialmente resuelto (`isUrlSafe()`) para el Browser Agent, pero sin
  Secure Network Gateway dedicado.

## 4. Consecuencias de dejarla en PROPOSED

- El outline de alineación
  (`docs/reportes/planning/plan_alineacion_prometeo_os_roadmap_sdd_2026-08-03.md`)
  y `docs/vision/VISION_PROMETEO_OS_2026.md` pueden describir la
  orquestación externa como "evaluada, no activa" sin comprometer trabajo
  de implementación.
- El programa transversal "Prometeo OS" en `ROADMAP.md` puede avanzar en
  identidad multi-rol y originador/facilitador sin bloquearse en esta
  decisión — son independientes.
- Si en el futuro se decide `ACCEPTED`, esta ADR debe actualizarse con la
  opción elegida y derivar un spec de implementación nuevo (dominio
  `prometeo` o `platform`, `risk: critical` como mínimo, dado el gate de
  seguridad de red y confused deputy).

## 5. Alternativas descartadas

- **Reactivar `SPEC-INT-001` tal cual estaba escrito:** descartado — ese
  spec resolvía un caso más angosto (CLI Agent Adapter) que ya cubre
  `developer-runtime.ts`; no cubre el caso general de "Prometeo orquesta
  cualquier tool MCP externa" que motiva esta ADR.

## 6. Specs derivados

Ninguno todavía. Se crean solo si esta ADR pasa a `ACCEPTED` con una
opción elegida.
