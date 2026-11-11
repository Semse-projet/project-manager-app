# El gate de salud de producción ya no depende de RAILWAY_TOKEN

**Fecha:** 2026-11-11 · **Rama:** `ci/health-gate-token-independent` · **Autorización:** el dueño pidió este PR el 2026-11-11 (cambio de CI de deploy; AGENTS.md exige autorización explícita y PR técnico separado).

## Problema

Desde el 2026-10-26, el paso "Deploy exact commit to Railway" de `railway-deploy.yml` falla con `Not Authorized` (secret `RAILWAY_TOKEN`). El job `health-check` dependía de ese paso y quedaba `skipped`, y `Production Health Gate` (`deploy.yml`) exige que `Railway Deploy` termine en `success`, así que tampoco corría. Producción sí se despliega, porque Railway construye `main` con su integración nativa de GitHub, pero durante más de dos semanas ningún deploy pasó por un chequeo de salud ni por el gate de procedencia (C02).

## Cambio (solo `.github/workflows/railway-deploy.yml`)

- El paso con token pasa a `continue-on-error` y publica su resultado (`token_deploy`). Si falla, deja un `::warning`, pero no apaga el resto.
- `health-check` corre siempre que haya SHA:
  - si `main` ya avanzó a otro commit, termina con un aviso (el run del commit más nuevo hace el gate), porque los merges seguidos se agrupan en un solo despliegue;
  - la consulta a la API de Railway ("deployment en SUCCESS") solo se ejecuta cuando el token funcionó;
  - el **gate de procedencia en runtime**, que no usa token, sigue siendo bloqueante: `/v1/health` y `/api/semse/healthz` deben responder 2xx con `gitSha` igual al SHA validado por CI. Sin token espera hasta 20 min (80 × 15 s) a que el build nativo se sirva; con token mantiene 6 × 10 s.
- `deploy.yml` no cambia: vuelve a dispararse porque `Railway Deploy` ya puede terminar en `success`.

## Qué no cambia

- No se tocan secretos, variables ni servicios de Railway.
- Un deploy que no llega a producción sigue fallando: lo detecta el gate de procedencia.
- Renovar `RAILWAY_TOKEN` sigue siendo recomendable (pendiente del dueño); con el token sano, el flujo es el de antes.

## Verificación y límite

- YAML validado (`yaml.safe_load`) y revisión de los 6 pasos del job.
- **No se puede probar antes del merge**: `workflow_run` usa el workflow de la rama por defecto. La primera ejecución real será el siguiente CI verde de `main` tras fusionar; hay que revisar ese run.

## Observación aparte

Los servicios de Railway tienen `checkSuites: false`: la integración nativa despliega cada push a `main` **sin esperar al CI**. El gate "solo se despliega con CI verde" que describe este workflow hoy no se cumple por esa vía. Activar "Wait for CI" en Railway es una decisión del dueño.
