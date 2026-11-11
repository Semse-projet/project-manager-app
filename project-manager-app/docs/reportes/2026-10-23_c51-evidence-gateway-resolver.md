# C51 — evidence-gateway sobre ResourceScopeResolver

Fecha: 2026-10-23 · Alcance: un módulo (`modules/evidence-gateway`) · C51 sigue **PARTIAL**.

## Cambio
- `EvidenceGatewayService.assertProjectAccess` resuelve el proyecto con `ResourceScopeResolver.resolveProjectScope(actor.tenantId, projectId)` en lugar de `EvidenceGatewayRepository.getProjectOwnership` (duplicado, eliminado).
- La decisión de acceso no cambia: sigue `assertEvidenceReadable/Writable` (contrato común `hasScopeAccess`). Otro tenant o proyecto inexistente ⇒ 404; otra org u org vacía del mismo tenant ⇒ 403.
- `EvidenceGatewayModule` importa `ResourceScopeModule`.

## Pruebas
- `evidence-gateway-scope.test.ts` (stub del resolver; permitido: org cliente/pro/OPS_ADMIN; denegado: otra org ⇒ 403, otro tenant ⇒ 404, projectId vacío) y `evidence-validation-write-gate-staging.test.ts`, `evidence-gateway.controller.test.ts`: 21/21.
- Suite `@semse/api test:unit`: 3615 pass, 8 fail, 2 skipped. Los 8 fallos son `satellite-webhooks-service` (`url failed SSRF validation`, requiere resolución DNS que el sandbox no tiene) y fallan igual sin este cambio.

## Pendiente / límites
- `evidence-gateway.service.spec.ts` (jest) ya no se ejecuta en el flujo `node --test`; no se tocó.
- Sin smoke autenticado en producción; no se declara despliegue.
