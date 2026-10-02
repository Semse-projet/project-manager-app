# Reporte — C80 Propagación de política local-only (Wave A, lote 1)

**Fecha:** 2026-09-30 · **Base:** main `69c4f04` · **Spec:** SPEC-GTW-001 (APPROVED)

## Estado
- Previo: ROTA (delta: `privacyLevel` ya se chequea antes de `forceModelSlug`; `privacyCritical` sin cobertura en la ruta directa de 5 slugs).
- Actual: **IMPLEMENTED_NOT_VERIFIED** (código + tests locales; sin CI terminal, merge, deploy ni smoke autenticado → no se marca VERIFIED).

## Cambios
- `apps/api/src/modules/ai-models/router/privacy-policy.ts` (nuevo): `requiresPrivateProvider()`, `PRIVATE_MODEL_SLUGS` (`ollama-local`, `glm-ollama`).
- `dto/ai-generate-request.dto.ts`: campos `privacyCritical`, `localOnly`.
- `router/ai-model-router.service.ts`: usa el helper; `privacyCritical`/`localOnly` ganan a `forceModelSlug`, sin fallback.
- `gateway/ai-model-gateway.service.ts`: guardia fail-closed en `executeWithSlug()` (último gate antes de cualquier provider); propaga `localOnly`/`privacyCritical` al orquestador.
- Migraciones: ninguna.

## Tests
- Nuevo `test/ai-model-gateway-privacy.test.ts` (13) + 1 en `ai-model-router-privacy.test.ts`: fail-closed con local caído para 5 flags, `forceModelSlug` cloud/directo no evade, guardia directa, `glm-ollama` permitido, ruta normal intacta.
- `ai-model-*privacy*`: 20/20. API unit completo: 2544 tests, 2507 pass, 0 fail. `pnpm lint` (api) limpio; `nest build` OK.

## Pendiente para VERIFIED
- CI terminal en el PR, merge SHA, deploy y smoke autenticado con Ollama caído (evidencia runtime).
- Residual: `template` como último recurso del orquestador devuelve texto enlatado (sin fuga); decidir si se convierte en denegación dura.
- `AiModelRouterService.selectRoute()` es alcanzable por `POST /route` sin gateway: sólo informa, no ejecuta.
