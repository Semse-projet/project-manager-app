---
type: checklist
feature: "ToolResult multimodal tipado (alias histórico SPEC-AGT-004)"
spec: "docs/specs/prometeo/tool-result-multimodal.spec.md"
version: "1.0"
date: "2026-08-27"
---

# Checklist: ToolResult multimodal tipado

> `[x]` = verificado contra el código real en esta sesión, `[ ]` = pendiente
> de CI/merge/deploy/activación, `[N/A]` = no aplica con justificación.

## Requisitos

- [x] Cada escenario P1 es verificable — `vision.analyze_image` produce
      `ToolResult` con `legacyJson` idéntico al resultado previo (test
      dedicado); P2 (las otras 30 tools no cambian) cubierto por la
      regresión completa de `apps/api`.
- [x] Scope y no-objetivos evitan ambigüedad — no se migran las ~30 tools
      restantes; el segundo piloto (export de evidencia) sigue sin
      existir como tool, confirmado, no se construyó.
- [x] API/UI/agent contracts no se contradicen — `PrometeoToolExecutionResult
      .output` sigue siendo `unknown`, sin cambio de contrato; `ToolResult`
      es aditivo.

## Seguridad

- [x] Permisos se validan en backend — sin cambio, `vision:run` intacto.
- [x] Tenant, org, ownership y resource scope están probados — sin ruta de
      acceso nueva, mismo resolver de contexto.
- [N/A] Step-up/aprobación para acciones críticas — tool de lectura, sin
      `approvalPolicy` de escritura.
- [x] No hay secretos ni PII en logs/evidencia — sin cambio de qué se
      audita ni de qué imagen se sirve.

## Datos y eventos

- [N/A] Migración — confirmado que no aplica (§9 del spec, re-verificado
      en esta sesión): `vision.analyze_image` no persiste su resultado.
- [N/A] Backfill/rollback/forward-fix — sin datos nuevos.
- [N/A] Outbox/consumers — sin productores ni consumidores tocados.

## Evidencia y dinero

- [N/A] Evidencia — sin bundles de evidencia nuevos en esta superficie.
- [N/A] Payment Governance — no aplica, cero endpoints de pago tocados.
- [N/A] Cálculos financieros — no aplica.

## Riesgo específico de esta spec

- [x] `legacyJson` es exactamente igual al `VisionAnalysisResult` que el
      handler devolvía antes del cambio — test dedicado, no solo
      documentado.
- [x] Ninguna de las otras 30 tools cambia `output.data` — regresión
      completa verde (2073/2073).
- [x] El consumidor de `apps/web` hace fallback (a `describeToolOutput`/
      `getPrometeoToolResultDetail`) cuando `outputKind !== "ToolResult"`
      o el parseo con `toolResultSchema` falla — por diseño de
      `extractToolResultParts`, no un caso no probado.
- [x] No se implementó una detección especulativa de "imagen anotada" —
      confirmado por lectura directa de `buildVisionAnalyzeImageToolResult`
      (solo produce la parte `json`).

## Entrega

- [x] Tests, build, typecheck y lint pasan — `pnpm --filter @semse/schemas
      build`, `pnpm --filter @semse/api build`, `node ./scripts/run-tests
      .mjs` (2073/2073), `tsc --noEmit` en `apps/web` (único error
      preexistente y no relacionado en `labor-tool-client.tsx`), `eslint`
      limpio en los 4 archivos de código tocados (1 warning aceptado de
      `no-img-element`, mismo patrón ya usado en otros 3 archivos del
      repo para imágenes remotas dinámicas).
- [ ] CI, merge, deploy y activación tienen evidencia separada — pendiente,
      se sube en el PR de esta rama.
- [ ] Healthcheck no sustituye smoke funcional — plan §7 Fase F exige una
      invocación real de `vision.analyze_image` renderizada en `apps/web`.
- [x] Canary, métricas y rollback están definidos — sin flag (cambio
      aditivo sin riesgo, spec §10); rollback = revertir el handler, sin
      efecto en otras tools.
- [N/A] `production_evidence` sin secretos — vacío todavía, se llena en
      Fase 6 de tasks.md.

## Documentación

- [x] Spec index regenerado — `pnpm spec:index` corrido.
- [x] `pnpm spec:validate:strict` — 0 errores, 0 warnings.
- [x] Corrección de alcance real (sin campo de imagen anotada) documentada
      en el spec mismo (§5), no solo en plan/tasks.
- [N/A] API surface/event catalog — sin endpoints ni eventos nuevos.
