# Reporte — C02 Trazabilidad de versiones activas: campos de manifiesto (Wave A, A5)

**Fecha:** 2026-09-30 · **Base:** main

## Estado
C02 (PARCIAL): **avance, sigue abierta**. Criterio: "manifiesto por servicio con commit, digest, deployment ID y resultado de CI".

| Campo | Antes | Ahora | Fuente |
|---|---|---|---|
| commit | sí (`gitSha`) | sí | `RAILWAY_GIT_COMMIT_SHA` |
| build time | sí | sí | `RAILWAY_DEPLOYMENT_CREATED_AT` |
| deployment ID | no | **sí** (`deploymentId`) | `RAILWAY_DEPLOYMENT_ID` |
| entorno | no | **sí** (`environment`) | `RAILWAY_ENVIRONMENT_NAME` |
| digest de imagen | no | **sí, solo si se suministra** (`imageDigest`) | `SEMSE_IMAGE_DIGEST` (Railway no lo expone al servicio) |
| resultado de CI | no | **no** | ver abajo |

## Cambios (aditivos, sin romper consumidores)
- `packages/shared/src/deploy-provenance.ts`: `deploymentId`, `environment`, `imageDigest`; siempre `"unknown"` si falta (nunca inferido).
- `GET /v1/health` (API), `/api/semse/healthz` (Web) y log de arranque (Worker) publican los campos nuevos. Sin secretos ni PII.
- Tests: +2 en `tests/unit/deploy-provenance.test.ts` (5/5). Raíz: 1158 tests, 0 fail; API: 2559 tests, 0 fail; `pnpm typecheck` OK; lint/build API OK.

## Lo que NO se puede cerrar desde el runtime (decisión/autorización)
1. **Resultado de CI**: es un hecho externo al proceso. Opciones: (a) el workflow de CI publica un manifiesto (commit → run/conclusión) como artefacto o check; (b) el registro de programa (C79) lo resuelve en el momento del reporte consultando GitHub checks por SHA. (a) toca CI/CD, prohibido sin autorización (AGENTS.md). Recomiendo (b) ahora y (a) cuando se autorice.
2. **Digest de imagen**: requiere que el build/deploy lo inyecte como `SEMSE_IMAGE_DIGEST` (cambio de Railway/CI; no realizado).
3. **Verificación en producción**: los campos nuevos solo aparecerán tras el próximo deploy; hasta entonces el health actual muestra solo `gitSha`/`buildTime`. No se marca VERIFIED.
