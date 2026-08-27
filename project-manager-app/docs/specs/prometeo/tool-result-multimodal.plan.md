---
type: plan
feature: "ToolResult multimodal tipado (alias histórico SPEC-AGT-004)"
domain: "prometeo"
spec: "docs/specs/prometeo/tool-result-multimodal.spec.md"
version: "1.0"
status: "APPROVED"
branch: "claude/roadmap-continuation-vhmve9"
date: "2026-08-27"
---

# Plan técnico: ToolResult multimodal tipado

> Prerrequisito: spec `APPROVED`. Sin plan/tasks previos — este es el
> primer paso de SDD después de `specify` para esta spec.

## 1. Snapshot de verdad

- `origin/main` SHA al empezar: `4649dfb` (merge de PR #590).
- Verificado contra código real (re-confirma §4 del spec, sin drift desde
  2026-08-17): `outputKind` de `vision.analyze_image` sigue siendo
  `"VisionAnalysisResult"` (`prometeo-tool-registry.ts:194`);
  `executeReadTool`'s `case "vision.analyze_image"` (línea 727) devuelve
  `this.vision.runAnalysis(...)` sin envolver; 31 `outputKind` totales en
  el registry (sin cambio).
- **Corrección/hallazgo nuevo de esta sesión, no cubierto por la revisión
  2026-08-17 del spec:** `grep -rn "annotated|overlay|heatmap" apps/api/
  src/modules/vision/ apps/vision-service/` no encuentra **ningún** campo
  de imagen anotada en `VisionAnalysisRecord`, `rawResult`, ni en el
  microservicio `apps/vision-service` (el único hit de "overlay" es
  `timeline_builder.py`, una feature no relacionada). El escenario P1 del
  spec ("cuando la imagen analizada tiene una versión anotada disponible")
  describe una capacidad que **no existe hoy en ningún campo real** — el
  propio spec ya lo anticipa con "si existe" en §5 y con el caso borde P2
  ("sin imagen anotada disponible"), así que no es una contradicción, pero
  sí significa que el camino "con imagen" de P1 es código estructuralmente
  listo pero **no ejercitable con datos reales de producción hoy**. No se
  inventa un nombre de campo especulativo para detectarla (violaría "no
  diseñar para requisitos hipotéticos") — el piloto de este plan solo
  produce la parte `json` (+ `legacyJson`), documentando esto explícitamente
  en vez de fingir una detección que no puede dispararse nunca.

## 2. Constitution check

- [x] Spec aprobado antes de código.
- [x] Tenant/org/ownership y RBAC — sin cambio, `vision:run` ya vigente.
- [x] Evidence/Payment Governance — no aplica, sin pagos ni evidencia
      nueva alcanzable.
- [x] Audit/events — sin cambio, `PrometeoToolInvocationAudit` no cambia
      qué audita.
- [x] Tests preceden implementación — Fase A de este plan.
- [x] No se expone secreto ni se agrega backend paralelo.
- [x] Código, CI, merge, deploy y activación se miden por separado.

## 3. Arquitectura y autoridad

- Contratos Zod nuevos: `toolResultPartSchema` (unión discriminada por
  `type`) y `toolResultSchema` en `packages/schemas/src/prometeo-runtime
  .schema.ts` — mismo archivo que ya declara `PrometeoToolDescriptor`/
  `PrometeoToolExecutionResult`, sin archivo nuevo.
- API: solo dos archivos tocados (`prometeo-tool-registry.ts`,
  `prometeo-tool-execution.service.ts`), sin módulo/servicio nuevo.
- Web: un renderer nuevo por `ToolResultPart.type` en
  `apps/web/components/ai/`, consumido desde `agent-chat-panel.tsx` —
  reusa el patrón BFF existente (no agrega llamada nueva, solo cambia cómo
  se interpreta `result.output.data` ya presente en `executionResults`).
- ADR requerido: no — aplica directamente `ADR-023` §2.3 ítem 2, ya
  `ACCEPTED`.

## 4. Datos y migración

No aplica — confirmado en spec §9 y re-verificado: `vision.analyze_image`
es de lectura, su resultado nunca toca Prisma.

## 5. Seguridad y política

- Sin permisos nuevos (`vision:run` sin cambio).
- Sin política de ownership nueva — el piloto no toca
  `evaluatePrometeoToolPolicy`.
- Abuse case verificado: ninguna URL nueva se expone — el piloto no
  produce partes `image`/`pdf`/`csv` reales todavía (ver hallazgo §1), así
  que no hay superficie de storage nueva que asegurar en este cambio
  concreto; el tipo queda listo para cuando sí exista.

## 6. Eventos, idempotencia y reconstrucción

No aplica — sin FSM ni eventos de dominio afectados (spec §8).

## 7. Estrategia de implementación

### Fase A — Tests y contratos

- Tests unitarios de `toolResultSchema`/`toolResultPartSchema` (acepta
  cada `type`, rechaza un discriminante desconocido).
- Test del handler: `vision.analyze_image` devuelve
  `{ outputKind: "ToolResult", data: { parts: [{type:"json",...}], legacyJson: <resultado original> } }`,
  y el `legacyJson` es exactamente igual al resultado que devolvía antes
  del cambio (regresión de compatibilidad).
- Test de que las otras 30 tools no cambian su `output.data` (P2 del spec).

### Fase B — API

- `prometeo-tool-registry.ts`: `outputKind` de `vision.analyze_image` →
  `"ToolResult"`.
- `prometeo-tool-execution.service.ts`: envolver el resultado de
  `vision.runAnalysis(...)` en `{ parts: [{type:"json", data: result}], legacyJson: result }`
  dentro de `executeReadTool`'s `case "vision.analyze_image"`.

### Fase C — Web

- Renderer por `ToolResultPart.type` en `apps/web/components/ai/
  prometeo-response.ts` (mismo archivo que ya tiene
  `getPrometeoToolResultDetail`/`shouldRenderPrometeoToolError`), con
  fallback al resumen de texto/JSON existente (`describeToolOutput`) si
  `outputKind !== "ToolResult"` o el parseo con `toolResultSchema` falla.
- `agent-chat-panel.tsx`: usar el renderer nuevo antes de caer al resumen
  genérico existente.

### Fase D — Verificación local

- `pnpm --filter @semse/schemas build`, `pnpm --filter @semse/api build`.
- `node ./scripts/run-tests.mjs` (regresión completa de `apps/api`, no
  solo lo tocado — el registry es compartido por las 31 tools).
- `pnpm --filter @semse/web exec tsc --noEmit` (o el typecheck workspace
  ya usado en la sesión) para el lado web.
- `pnpm spec:validate:strict`, `pnpm spec:index`.

### Fase E — Integración

- Commit(s) sobre `claude/roadmap-continuation-vhmve9`, PR (nuevo, la
  rama ya tiene un PR abierto — mismo patrón de "un PR de GitHub por
  mandato de rama única" que la spec anterior).

### Fase F — Producción

- Sin servicio backend nuevo que desplegar aparte de la API existente.
- Canary: invocar `vision.analyze_image` real y confirmar que `apps/web`
  renderiza la parte `json` sin romper — no hay canario de la parte
  `image` posible todavía (§1, no hay dato real que la produzca).
- Rollback: revertir el handler de `vision.analyze_image` a su forma
  anterior no afecta a ninguna otra tool (aditivo, confirmado en spec §9).

## 8. Riesgos

| Riesgo | Probabilidad | Impacto | Mitigación | Señal de rollback |
|---|---|---|---|---|
| Un consumidor de `apps/web` (o futuro) lee `output.data` asumiendo la forma antigua de `VisionAnalysisResult` directamente, sin pasar por `legacyJson` | media | bajo | `legacyJson` conserva el shape exacto; el renderer nuevo hace fallback si `outputKind` no es `"ToolResult"` o si el parseo falla | Un test o reporte de UI mostrando un `[object Object]`/render roto en el resultado de `vision.analyze_image` |
| Inventar una detección especulativa de "imagen anotada" que nunca se dispara, dando falsa sensación de cobertura | alta si no se documenta | bajo | No se implementa detección alguna — documentado explícitamente en este plan y en el código (comentario) que la parte `image` no se emite hasta que exista un campo real | Revisión de código que encuentre un `if` chequeando un campo inexistente |

## 9. Investigación externa

No aplica — patrón de unión discriminada ya interno al repo (spec §13).

## 10. Gates antes de tareas

- [x] Archivos exactos identificados (§7).
- [x] Migración y rollback — N/A, documentado.
- [x] Tests ordenados antes del código (Fase A antes de B/C).
- [x] Canary/feature flag — sin flag, cambio aditivo sin riesgo de romper
      consumidores no actualizados (spec §10).
- [x] Evidencia requerida para cada estado de entrega definida.
- [x] Scope cabe en un cambio reversible — 3 archivos de código + 1 de
      schemas, revertible con `git revert`.
