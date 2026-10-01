# C02 — Verificador de procedencia (2026-10-01)

- Existente: `/v1/health`, web `/api/semse/healthz` y worker exponen `gitSha/deploymentId/environment/imageDigest` (nunca fabricados; "unknown" si faltan).
- Nuevo: `scripts/verify-deploy-provenance.mjs` (solo lectura): falla si el sha no coincide con el esperado o hay campos "unknown" (digest tolerable con `--allow-unknown-digest`, porque Railway no lo expone). Tests: `tests/unit/c02-verify-deploy-provenance.test.mjs`.
- NO hecho (requiere autorización: AGENTS.md prohíbe tocar CI/CD/Railway): el job `health-check` de `.github/workflows/railway-deploy.yml` solo comprueba HTTP 200, no que el sha en producción sea el commit mergeado. Parche propuesto: tras el health check, `node project-manager-app/scripts/verify-deploy-provenance.mjs --url=$API_URL --expect-sha=${{ github.event.workflow_run.head_sha }} --allow-unknown-digest` (con reintentos mientras Railway termina el rollout).
- Digest: seguirá "unknown" hasta que el build lo inyecte como `SEMSE_IMAGE_DIGEST`; no hay forma honesta de obtenerlo desde el runtime en Railway.
