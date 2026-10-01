# C02/C62 — procedencia en runtime en CI, modo informativo (2026-10-01)

Autorización del dueño: "PR aislado de CI/CD para provenance. Primero modo informativo: comprobar commit/deployment y reportar digest desconocido sin bloquear. Después de un ciclo verde, convertirlo en gate. No tocar branch protections ni secretos en ese PR."

## Qué ya existía y qué se añade
- Ya existía (workflow `Railway Deploy`, job `health-check`): verifica por la API de Railway que cada servicio tiene el deployment del **commit exacto** en SUCCESS, y que la API/web responden.
- Faltaba: comprobar que lo que **corre** reporta ese commit. Se añade, **sin bloquear**, la comprobación de `/v1/health` (API) y `/api/semse/healthz` (web) contra `DEPLOY_SHA`, con reintentos (6 × 10 s, porque el dominio público puede servir el deployment anterior unos segundos), resumen en `$GITHUB_STEP_SUMMARY` y `::warning` si no coincide.
- `verify-deploy-provenance.mjs`: `--path`, `--retries/--interval`, `--markdown/--label`, acepta la forma `{data:{…}}` de la web. Un `imageDigest` desconocido se tolera (`--allow-unknown-digest`; Railway no lo expone al runtime).

## Alcance y límites (lo único que cambia en CI)
- Solo `.github/workflows/railway-deploy.yml`, job `health-check`: 2 pasos nuevos, ambos `continue-on-error: true` y que terminan en `exit 0`; **no** toca branch protections, secretos, `needs`, ni los pasos existentes.
- Único cambio de permisos: `permissions: contents: read` **en ese job** (el workflow tiene `permissions: {}`) para el checkout sparse (solo el script) con `persist-credentials: false`.
- **No verificable aquí:** no puedo ejecutar GitHub Actions desde el sandbox; el YAML se validó con un parser y el script se probó de punta a punta contra un servidor local (coincide, discrepa, reintentos hasta coincidir, 503). El primer deploy tras fusionar mostrará el resumen real; si el paso falla por sí mismo no afecta al resultado del workflow.

## Para convertirlo en gate (PR aparte, tras un ciclo verde)
Quitar `continue-on-error`/`exit 0` del paso de reporte y, si se desea, exigir `imageDigest` cuando el build inyecte `SEMSE_IMAGE_DIGEST`.
