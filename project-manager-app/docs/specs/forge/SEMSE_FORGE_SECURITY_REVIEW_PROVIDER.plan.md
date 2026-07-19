# Plan: SEMSE Forge Security Review Provider

## Fases

### 1. Especificación y contratos

- Crear `SEMSE_FORGE_SECURITY_REVIEW_PROVIDER.spec.md` (APPROVED).
- Añadir tipos `ForgeSecurityFinding` y `ForgeSecurityReport` a `packages/forge/src/types.ts`.
- Añadir evento `FORGE_SECURITY_REVIEW_COMPLETED` a `ForgeEvent`.
- Actualizar `docs/foundation/EVENT_CATALOG.md`.

### 2. Implementación del proveedor

- Crear `packages/forge/src/security-review-provider.ts`.
  - `DryRunSecurityReviewProvider`
  - `LiveSecurityReviewProvider` (lanza "not implemented")
  - `createSecurityReviewProvider`
  - Reglas de decisión y patrones del spec.
- Exportar en `packages/forge/src/index.ts`.
- Asegurar que `security.review` esté mapeado en `packages/forge/src/tool-adapter.ts` (ya existe).
- Añadir `security.review` a `allowedActions` del manifest `security-reviewer` si aún no está (ya existe).

### 3. Integración runtime

- `packages/agents/src/runtime.ts`:
  - Importar `createSecurityReviewProvider`.
  - Invocar para `security.review`.
  - Incluir `securityReport` en el payload de resultado.

### 4. Integración API

- `apps/api/src/modules/forge/forge.service.ts`:
  - Extraer `payload.securityReport` en `applyTaskResult`.
  - Emitir `FORGE_SECURITY_REVIEW_COMPLETED`.
  - Si `securityReport.decision === "deny"`, forzar `nextState = "blocked"` (precedente sobre `prPackage` si hay conflicto).
  - Registrar aprobaciones requeridas del reporte.

### 5. Tests

- `tests/unit/forge-security-review-provider.test.mjs`:
  - allow (sin patrones sensibles).
  - deny por archivo prohibido.
  - require_approval por env/credential files.
  - require_approval por auth module.
  - critical risk requiere dual_control.
  - live not implemented.
- `tests/unit/forge-runtime-integration.test.mjs`:
  - assert `payload.securityReport` para `security.review`.

### 6. Validación y PR

- `pnpm --filter @semse/forge build`
- `pnpm --filter @semse/agents build`
- `pnpm typecheck`
- `pnpm lint`
- `pnpm test:unit`
- `pnpm spec:preflight`
- `pnpm spec:validate:strict` (verificar que no se añadan errores nuevos)
- `pnpm spec:index`
- Commit, push y PR.
